# Phase 12: Server-Side Outcomes Pre-Aggregation — Research

**Researched:** 2026-04-16
**Domain:** Server-side aggregation endpoint (Express + tsx/Vite monorepo), shared client/server math module, in-memory TTL cache, byte-parity guarantee, HMAC audit trail
**Confidence:** HIGH for code-sharing + cache + compression patterns (direct codebase inspection); HIGH for audit/skip-list patterns (Phase 11 precedent verified); MEDIUM for JSON.stringify byte-parity edge cases (Node vs browser); HIGH for environment availability (all tooling verified locally).

## Summary

Phase 12 stands up `POST /api/outcomes/aggregate` as a drop-in server implementation of `computeCohortTrajectory` with five interlocking correctness gates: (1) a shared TS module so the math literally cannot drift, (2) a user-scoped in-memory TTL cache with explicit cohort-mutation invalidation, (3) a route-scoped `compression()` middleware that leaves existing raw-stream consumers untouched, (4) a Phase 11 handler-own-row audit event carrying a hashed cohortId only, and (5) a client-side size gate in `OutcomesView.tsx` that routes cohorts above the configured threshold to the server and leaves smaller cohorts on the unchanged client path.

The dominant technical risk is not architectural — all patterns have direct Phase 11 precedent — but rather the byte-parity test (AGG-02). The research below documents the five structural causes of serialization drift and pins the parity test strategy to `JSON.stringify` string equality with zero tolerance. The secondary risk is `fhirLoader.ts` import coupling: the pure-math module currently depends on LOINC/SNOMED constants plus `getObservationsByCode` which live in a file that also imports a browser-only `authFetch`. The shared move must cleave these constants from the network code.

**Primary recommendation:** Extract the pure parts (constants, `getObservationsByCode`, `getLatestObservation`) from `src/services/fhirLoader.ts` into `shared/fhirCodes.ts` and `shared/fhirQueries.ts` as a precondition to moving `cohortTrajectory.ts` to `shared/`. Otherwise the server import chain will transitively pull `authFetch` → `sessionStorage` → `window` and fail at Node import time.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Code Sharing (client ↔ server):**
- **D-01:** Promote `src/utils/cohortTrajectory.ts` to a shared module both client and server import from — single source of truth for median / IQR / interpolation math.
  - Chosen location: `shared/cohortTrajectory.ts` (TS project root), with `src/utils/cohortTrajectory.ts` re-exporting from the shared module for backward compatibility.
  - Rationale: AGG-02 demands byte-identical aggregation; a shared module is the only option that enforces parity by construction (vs duplication + round-trip test alone).
  - Rejected alternatives: (A) server imports via tsconfig path alias — brittle at build time; (B) duplicate code + round-trip test — drift-prone.

**Endpoint Contract:**
- **D-02:** Endpoint path: `POST /api/outcomes/aggregate`. Body: `{ cohortId: string, axisMode: "days" | "treatments", yMetric: "absolute" | "delta" | "delta_percent", gridPoints: number, eye: "od" | "os" | "combined", spreadMode?: "iqr" | "sd1" | "sd2", includePerPatient?: boolean, includeScatter?: boolean }`.
- **D-03:** Response: `{ median: GridPoint[], iqrLow: number[], iqrHigh: number[], perPatient?: PatientSeries[], scatter?: ScatterPoint[], meta: { patientCount, excludedCount, measurementCount, cacheHit: boolean } }`. Types reuse the `shared/cohortTrajectory.ts` exports.
- **D-04:** `perPatient` and `scatter` arrays are **opt-in** via request flags (default `false`). Full per-patient payload for 1000+ patients is the very thing we're trying to avoid sending over the wire.

**Authorization Gate:**
- **D-05:** Center filter is applied **inside the handler** from `req.auth.centers` (populated by `authMiddleware` on the Express stack). The request body's `centers` field — if any — is ignored.
- **D-06:** Cohort lookup uses the authenticated user's saved-search store; requests for cohort ids not owned by the caller return `403` with a generic message.

**Cache Backend:**
- **D-07:** In-memory `Map<cacheKey, { result, expires }>` inside the handler module, with TTL safety net (default 30 min) plus explicit invalidation. No new dependency. Survives until process restart — acceptable for the demonstrator.
- **D-08:** `cacheKey = JSON.stringify({ cohortId, axisMode, yMetric, gridPoints, eye, spreadMode, includePerPatient, includeScatter, user })` — user-scoped so two users with the same cohort id don't share entries.

**Cache Invalidation:**
- **D-09:** Explicit invalidation hook — when `dataApi` saved-search update/delete fires for a cohort id, drop all cache entries whose key includes that cohort id.
- **D-10:** TTL (default 30 min, override via `settings.yaml` `outcomes.aggregateCacheTtlMs`) as safety net against missed invalidation paths.

**Configuration:**
- **D-11:** Threshold and cache TTL live in `config/settings.yaml` under a new `outcomes:` section: `serverAggregationThresholdPatients: 1000` + `aggregateCacheTtlMs: 1800000`.
- **D-12:** Non-admin GET `/api/settings` exposes both fields (they are not sensitive — no strip needed). Admins can edit via PUT `/api/settings`.

**Client Routing:**
- **D-13:** `src/components/outcomes/OutcomesView.tsx` adds a size check against `settings.outcomes.serverAggregationThresholdPatients` (fetched once on mount via existing `settingsService`). If `cohort.cases.length > threshold`, use `fetch POST /api/outcomes/aggregate`; else compute client-side via `computeCohortTrajectory` unchanged.
- **D-14:** Loading state: show a subtle "Computing on server..." indicator while the POST is in flight.

**Response Compression:**
- **D-15:** Mount Express `compression()` middleware on `/api/outcomes/aggregate` (route-scoped, not global — keeps raw-stream consumers untouched per the Phase 11 scoped-middleware precedent). Default gzip/deflate.

**Audit Event (AGG-05):**
- **D-16:** Handler writes an `outcomes.aggregate` audit row via the Phase 11 `SKIP_AUDIT_PATHS` + handler-own-row pattern. Row body: `{ name: "outcomes.aggregate", cohortHash: hashCohortId(cohortId), user, centers, payloadBytes, cacheHit }`. Never the raw `cohortId`.
- **D-17:** Add `/api/outcomes/aggregate` to `SKIP_AUDIT_PATHS` in `server/auditMiddleware.ts` so the generic middleware does not double-write.

### Claude's Discretion
- The specific Express compression library (`compression` npm package — planner picks if an alternative is meaningfully better).
- The `meta.cacheHit` plumbing: handler vs cache wrapper — planner decides.
- Order of handler operations within the security envelope (auth first, audit last).

### Deferred Ideas (OUT OF SCOPE)
- **Persistent cache** — disk-backed aggregate cache that survives restart.
- **Streaming response** — NDJSON / chunked for very large cohorts.
- **Client-side pre-warming** — warm the cache when a user opens Cohort Builder.
- **Per-metric aggregation support beyond visus** — Phase 13 concern.
- **Rate limiting on the aggregate endpoint** — `server/rateLimiting.ts` pattern is ready to apply but not in-scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGG-01 | `POST /api/outcomes/aggregate` accepts `{ cohortId, axisMode, yMetric, gridPoints, eye }` and returns `{ median, iqrLow, iqrHigh, perPatient?, scatter? }` — center-filtered from JWT | §Architecture Patterns ("Handler skeleton"), §Standard Stack (Express 5 Router), §Security Domain (center filter from `req.auth.centers`) |
| AGG-02 | Server aggregation uses the same algorithm as the client `aggregate` useMemo; parity verified by a round-trip byte-identity test | §Architecture Patterns ("Shared module extraction"), §Common Pitfalls (JSON.stringify drift vectors), §Validation Architecture (parity test sampling) |
| AGG-03 | Client `/outcomes` auto-routes to server endpoint when cohort size exceeds configurable threshold; below threshold keeps current path | §Architecture Patterns ("Client routing"), §Code Examples ("Size check in OutcomesView") |
| AGG-04 | Response cacheable per `{ cohortId, axisMode, yMetric, gridPoints, eye }` with explicit cache invalidation on cohort mutation | §Architecture Patterns ("In-memory cache module"), §Code Examples ("Cache wrapper with TTL + explicit invalidation") |
| AGG-05 | Aggregation endpoint emits `outcomes.aggregate` audit event with hashed cohort id via Phase 11 `hashCohortId` utility | §Don't Hand-Roll (reuse Phase 11 `hashCohortId`), §Architecture Patterns ("Audit row template") |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` exists at the project root. Applicable user-memory directives (confirmed via auto-memory load):

- **Security-first approach** — Audit immutability, server-side enforcement, no client trust. Center filter MUST come from JWT, never request body.
- **Config in settings.yaml** — Single config source, no env vars. Both `outcomes.*` keys must live in settings.yaml.
- **Full Review Workflow** — `full-review` triggers parallel Claude/Codex/Gemini review; downstream planner should structure plans so each task has an independently reviewable diff.

No `.claude/skills/` or `.agents/skills/` directory exists in the project — no project-specific skill rules to honor beyond these.

## Standard Stack

### Core (verified in `package.json`)
| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| express | ^5.2.1 [VERIFIED: package.json] | HTTP framework | Already the project's server stack |
| better-sqlite3 | ^12.8.0 [VERIFIED: package.json] | SQLite driver for audit_log writes | Already wired via `server/auditDb.ts` |
| js-yaml | ^4.1.1 [VERIFIED: package.json] | Parse `settings.yaml` at startup | Already wired via `server/index.ts:61` |
| jsonwebtoken | ^9.0.3 [VERIFIED: package.json] | JWT verify (HS256 + RS256) | `server/authMiddleware.ts` consumes this |
| tsx | ^4.21.0 [VERIFIED: package.json] | TypeScript node loader — runs server without compile | Project `npm start` uses `node --import tsx` |
| vitest | ^4.1.4 [VERIFIED: package.json] | Test runner (node env + optional jsdom docblock) | 358/358 tests currently green on this runner |

### Supporting (NEW dependency to add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| compression | 1.8.1 [VERIFIED: npm view compression version — published 2026-03-28] | Route-scoped gzip/deflate middleware for D-15 | Mount on `/api/outcomes/aggregate` only |
| @types/compression | 1.8.1 [VERIFIED: npm view @types/compression version] | TS types for `compression` | Required — TS strict build will fail without |

**Installation (authoritative):**
```bash
npm install compression@^1.8.1
npm install --save-dev @types/compression@^1.8.1
```

Both packages are currently absent from `node_modules/` and `package.json` [VERIFIED: `ls node_modules/compression` returned not found; grep of package.json returned zero matches].

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `compression` | Native `zlib.createGzip()` piped onto `res` | Hand-rolls content-negotiation, Accept-Encoding parsing, 204/Content-Length edge cases. The `compression` package solves these [CITED: https://github.com/expressjs/compression]. Do not reinvent. |
| `compression` | Brotli via `shrink-ray-current` | Brotli adds CPU cost and the `compression` package's gzip is already in the 70–90 % savings range for JSON. Not worth the dep churn for a demonstrator. [ASSUMED: general Node ecosystem knowledge; brotli-vs-gzip bytes-saved on JSON is well-documented but unverified in this session] |
| In-memory `Map` TTL | Disk-backed JSON cache | Explicit Deferred Idea. In-memory survives the demonstrator's lifetime (process restart invalidates — acceptable per D-07). |
| In-memory `Map` TTL | ETag + `Cache-Control` | Invalidation on cohort mutation is opaque to the browser; explicit Map control is simpler and user-scoped (D-08). |

## Architecture Patterns

### Recommended Project Structure
```
shared/
├── fhirCodes.ts              # NEW — pure LOINC/SNOMED constants (split from fhirLoader.ts)
├── fhirQueries.ts            # NEW — pure getObservationsByCode, getLatestObservation
└── cohortTrajectory.ts       # NEW — moved from src/utils/ with zero logic change

src/
├── utils/cohortTrajectory.ts # NOW a re-export shim: export * from '../../shared/cohortTrajectory'
└── services/fhirLoader.ts    # refactored: re-exports constants from shared/, keeps network code

server/
├── outcomesApi.ts            # NEW — the aggregate handler + cache module
├── outcomesCache.ts          # NEW — Map<key,{result,expires}> + invalidate hook
└── ...                       # existing files unchanged except index.ts + auditMiddleware.ts

tsconfig.app.json             # EDIT — add "shared" to include
tsconfig.server.json          # EDIT — add "shared" to include
vitest.config.ts              # no change — tests/ glob still resolves shared/ via relative imports
```

**Critical tsconfig implication [VERIFIED: tsconfig.app.json line 24 and tsconfig.server.json line 16 both have single-entry `include`]:**

Both tsconfigs currently have their `include` arrays scoped to a single directory (`src` for app, `server` for server). A top-level `shared/` directory won't be type-checked by either until both configs add it. The plan must extend both `include` arrays in a single task — leaving either side out means one side breaks at build time.

### Pattern 1: Shared Module Extraction (D-01)

**What:** Pure math + pure constants live in `shared/`; network code + browser APIs stay in `src/services/`.

**When to use:** Any code that must be called from both client and server and has no I/O.

**Precondition — decouple `fhirLoader.ts` first:**

`src/utils/cohortTrajectory.ts:13-20` imports:
```typescript
import {
  getObservationsByCode,
  LOINC_VISUS,
  SNOMED_EYE_LEFT,
  SNOMED_EYE_RIGHT,
  SNOMED_IVI,
} from '../services/fhirLoader';
```

`src/services/fhirLoader.ts:1-17` then imports `authFetch` from `./authHeaders`, which uses `sessionStorage` and `window.location` [VERIFIED: `src/services/authHeaders.ts` lines 6, 23-27].

If we move only `cohortTrajectory.ts` to `shared/` and keep the `fhirLoader` import, Node evaluation of `shared/cohortTrajectory.ts` on the server will transitively load `authHeaders.ts` and crash on `sessionStorage is not defined`. The move requires splitting `fhirLoader.ts` into a pure half and a networked half.

**Example (recommended split):**

```typescript
// shared/fhirCodes.ts — pure constants, zero imports
export const LOINC_VISUS = '79880-1';
export const LOINC_CRT = 'LP267955-5';
// ... (rest of the 11 codes at src/services/fhirLoader.ts:138-149)
export const SNOMED_IVI = '36189003';
export const SNOMED_EYE_RIGHT = '362503005';
export const SNOMED_EYE_LEFT = '362502000';

// shared/fhirQueries.ts — pure functions over FHIR types
import type { Observation } from '../src/types/fhir';  // or relocate types to shared/ too
export function getObservationsByCode(obs: Observation[], loincCode: string): Observation[] { /* ... */ }
export function getLatestObservation(obs: Observation[], loincCode: string): Observation | undefined { /* ... */ }

// src/services/fhirLoader.ts — KEEP network code, RE-EXPORT for back-compat
export * from '../../shared/fhirCodes';
export * from '../../shared/fhirQueries';
// (unchanged: loadAllBundles, authFetch wrapper, loadCenterShorthands, etc.)
```

**FHIR types placement:** `src/types/fhir.ts` is imported by `cohortTrajectory.ts:20`. Moving the trajectory file to `shared/` requires either (a) moving the types to `shared/types/fhir.ts` or (b) letting `shared/` reach up to `../src/types/fhir`. Option (a) is cleaner and the downstream planner should pick it.

### Pattern 2: Handler Skeleton (AGG-01, AGG-05)

```typescript
// server/outcomesApi.ts (NEW)
import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { computeCohortTrajectory } from '../shared/cohortTrajectory.js';
import { hashCohortId } from './hashCohortId.js';
import { logAuditEntry } from './auditDb.js';
import { getSavedSearches } from './dataDb.js';
import { applyFilters } from '../shared/fhirQueries.js';  // if relocated
import { getActivePatientCases } from './fhirApi.js';     // center-filtered loader
import { aggregateCacheGet, aggregateCacheSet } from './outcomesCache.js';

export const outcomesApiRouter = Router();

outcomesApiRouter.post('/aggregate', (req: Request, res: Response): void => {
  // 1. Auth already enforced globally by authMiddleware — req.auth is populated.
  const user = req.auth!.preferred_username;
  const userCenters = req.auth!.centers;

  // 2. Extract + validate body (D-02 shape)
  const body = (req.body ?? {}) as Record<string, unknown>;
  const cohortId = typeof body.cohortId === 'string' ? body.cohortId : null;
  if (!cohortId || cohortId.length > 128) {
    res.status(400).json({ error: 'cohortId required' });
    return;
  }
  // ... validate axisMode, yMetric, gridPoints, eye, spreadMode, flags

  // 3. Cohort ownership + center filter (D-05 + D-06)
  const savedSearches = getSavedSearches(user);
  const cohort = savedSearches.find((s) => s.id === cohortId);
  if (!cohort) { res.status(403).json({ error: 'Forbidden' }); return; }  // generic

  // 4. Cache read (D-07 + D-08)
  const cacheKey = JSON.stringify({
    cohortId, axisMode, yMetric, gridPoints, eye, spreadMode,
    includePerPatient, includeScatter, user,
  });
  let result = aggregateCacheGet(cacheKey);
  let cacheHit = result !== null;

  // 5. Compute if miss
  if (!result) {
    const cases = applyFilters(getActivePatientCases(userCenters), JSON.parse(cohort.filters));
    const trajectory = computeCohortTrajectory({ cases, axisMode, yMetric, gridPoints, spreadMode });
    result = shapeResponse(trajectory, { includePerPatient, includeScatter });
    aggregateCacheSet(cacheKey, cohortId, result);
  }

  // 6. Audit event (D-16, D-17) — always, even on cache hit
  const payloadBytes = Buffer.byteLength(JSON.stringify(result), 'utf-8');
  logAuditEntry({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: 'POST',
    path: '/api/outcomes/aggregate',
    user,
    status: 200,
    duration_ms: 0,  // handler-written sentinel per IN-10 convention
    body: JSON.stringify({
      name: 'outcomes.aggregate',
      cohortHash: hashCohortId(cohortId),
      centers: userCenters,
      payloadBytes,
      cacheHit,
    }),
    query: null,
  });

  // 7. Respond
  res.json({ ...result, meta: { ...result.meta, cacheHit } });
});
```

### Pattern 3: In-Memory Cache Module (AGG-04)

```typescript
// server/outcomesCache.ts (NEW)
interface CacheEntry { result: unknown; expires: number; cohortId: string; }
const _cache = new Map<string, CacheEntry>();
let _ttlMs = 30 * 60 * 1000; // default 30 min

export function initOutcomesCache(settings: Record<string, unknown>): void {
  const outcomes = (settings.outcomes ?? {}) as Record<string, unknown>;
  if (typeof outcomes.aggregateCacheTtlMs === 'number' && outcomes.aggregateCacheTtlMs > 0) {
    _ttlMs = outcomes.aggregateCacheTtlMs;
  }
}

export function aggregateCacheGet(key: string): unknown | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    _cache.delete(key);       // lazy expiry on read (D-10 TTL safety net)
    return null;
  }
  return entry.result;
}

export function aggregateCacheSet(key: string, cohortId: string, result: unknown): void {
  _cache.set(key, { result, expires: Date.now() + _ttlMs, cohortId });
}

export function invalidateByCohort(cohortId: string): void {
  // D-09 explicit invalidation — called from dataApi on saved-search update/delete
  for (const [key, entry] of _cache) {
    if (entry.cohortId === cohortId) _cache.delete(key);
  }
}

// test hook only
export function _resetForTesting(): void { _cache.clear(); _ttlMs = 30 * 60 * 1000; }
```

**Precedent in codebase:** `server/rateLimiting.ts:18-55` uses an analogous `Map` + `setInterval` cleanup pattern. The outcome cache does **not** need a `setInterval` sweep because lazy expiry on read is sufficient for this scale — entries are only read via cache key hits, and misses never grow the cache.

### Pattern 4: Route-Scoped Compression (D-15)

```typescript
// server/index.ts — new lines after the existing scoped JSON mounts
import compression from 'compression';

// Body parser for the aggregate route — before compression, before auditMiddleware
app.use('/api/outcomes/aggregate', express.json({ limit: '8kb' }));
// 8 KiB is 10× the realistic body size (cohortId UUID + 7 flags ≈ 200 bytes)

// Route-scoped compression BEFORE the route handler
app.use('/api/outcomes/aggregate', compression());
```

**Why scoped not global** [VERIFIED: `server/index.ts:184-190` already uses scoped `express.json()` for exactly this reason]: a global `app.use(compression())` would wrap `issueApi` and `settingsApi` which consume `req.body` via `readBody()` on the raw stream. Compression on the response side is generally safe, but mounting scoped is the project's established precedent [CITED: `.planning/phases/11-audit-beacon-pii-hardening/11-SECURITY.md` AR-11-01 accepted risk].

### Pattern 5: Client Routing (D-13)

```typescript
// src/components/outcomes/OutcomesView.tsx — replace the existing aggregate useMemo

// On mount, fetch threshold once (existing loadSettings call chain)
const [threshold, setThreshold] = useState<number>(1000);  // default from settings
const [serverAggregate, setServerAggregate] = useState<TrajectoryResult | null>(null);
const [serverLoading, setServerLoading] = useState(false);

useEffect(() => {
  loadSettings().then((s) => {
    setThreshold(s.outcomes?.serverAggregationThresholdPatients ?? 1000);
  });
}, []);

const routeServerSide = cohort && cohort.cases.length > threshold;

useEffect(() => {
  if (!routeServerSide || !cohort) { setServerAggregate(null); return; }
  setServerLoading(true);
  authFetch('/api/outcomes/aggregate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cohortId: searchParams.get('cohort'),
      axisMode, yMetric, gridPoints, eye: 'combined', spreadMode,
      includePerPatient: layers.perPatient, includeScatter: layers.scatter,
    }),
  })
    .then((r) => r.json())
    .then(setServerAggregate)
    .finally(() => setServerLoading(false));
}, [routeServerSide, axisMode, yMetric, gridPoints, spreadMode, layers.perPatient, layers.scatter]);

const aggregate = useMemo(() => {
  if (routeServerSide) return serverAggregate;  // may be null while loading
  if (!cohort || cohort.cases.length === 0) return null;
  return computeCohortTrajectory({ cases: cohort.cases, axisMode, yMetric, gridPoints, spreadMode });
}, [routeServerSide, serverAggregate, cohort, axisMode, yMetric, gridPoints, spreadMode]);
```

Note the D-14 "Computing on server..." indicator should render when `routeServerSide && serverLoading && !serverAggregate`.

### Anti-Patterns to Avoid
- **Global `app.use(compression())`** — breaks `issueApi`/`settingsApi` raw-stream contract. Scope to the single route.
- **Global `app.use(express.json())` for aggregate route** — already violated-then-fixed in Phase 11 with AR-11-01 accepted risk. Keep the scoped pattern.
- **Storing `cohortId` in the audit row body** — Phase 11 Layer 2 mitigation applies verbatim. The handler must JSON.stringify `{ name, cohortHash, centers, payloadBytes, cacheHit }` — never a literal `cohortId` field, even as a local variable bound to the serialized object.
- **Building the cache key with `hash(body)` or `btoa(body)`** — D-08 specifies `JSON.stringify(...)` with a fixed key order. Any other form will drift from the invalidation hook in D-09 (which searches by cohortId substring).
- **Reading threshold from JWT claim** — it's a config value, not an authorization claim. Always read from `settings.yaml` via `settingsService`.
- **Returning raw `TrajectoryResult`** — D-03 response shape has `{ median, iqrLow, iqrHigh, perPatient?, scatter?, meta }` which differs from `TrajectoryResult` (which has `{ od, os, combined }`). The handler must shape the response per panel-per-eye request.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cohort-id hashing | Custom HMAC, SHA truncation | `hashCohortId()` from `server/hashCohortId.ts` | Phase 11 primitive, 8 tests, constant-time failure, 16-hex output. Reusing preserves cross-event joinability. |
| Gzip/Deflate | `zlib.createGzip()` pipe | `compression` npm package | Handles Accept-Encoding negotiation, threshold, content-type filtering, streaming. |
| Audit row writing | New audit writer | `logAuditEntry()` from `server/auditDb.js` | Same SQLite prepared statement, same schema, participates in retention purge. |
| Skip-list audit middleware | New middleware | Extend `SKIP_AUDIT_PATHS` Set in `server/auditMiddleware.ts:50` | Single-line addition, preserves the first-statement skip invariant. |
| YAML settings parsing | Custom parser | `js-yaml` (already imported at `server/index.ts:33`) | Already the project's YAML lib. |
| Cohort lookup | New lookup path | `getSavedSearches(user)` from `server/dataDb.js` | Already user-scoped (DATA-02 pattern). |
| Center filtering | New filter | Existing pattern: `server/fhirApi.ts:isBypass()` + `getCaseToCenter()` | Mirrors `dataApi.ts:validateCaseCenters()` template — 6 callsites and counting. |
| Median/IQR math | Server port of client math | `computeCohortTrajectory` from `shared/cohortTrajectory.ts` | D-01 mandates shared module. Re-implementing defeats AGG-02 byte parity. |

**Key insight:** Every primitive Phase 12 needs already exists. The phase is almost entirely composition work — routing, wiring, config, and one shared-module extraction. The only genuinely new primitive is the `outcomesCache` module.

## Runtime State Inventory

Phase 12 is a pure addition — no rename/refactor/migration of existing runtime state. The single refactor (`src/utils/cohortTrajectory.ts` → `shared/cohortTrajectory.ts` + re-export shim) is a code-only move with backward-compatible re-exports.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema migrations. audit_log gets new row type `outcomes.aggregate` but that's data addition, not migration. [VERIFIED: `server/auditDb.ts` schema at line 75+ is a flat append-only table; no type column constrains body.name] | None |
| Live service config | `config/settings.yaml` gains `outcomes.*` section — that IS the deployed config state. [VERIFIED: `config/settings.yaml` currently has 12 lines, no `outcomes:` key.] | Add to settings.yaml (plan task) |
| OS-registered state | None — no pm2, launchd, systemd, Task Scheduler entries tied to this path. | None |
| Secrets/env vars | None new. `audit.cohortHashSecret` remains unchanged; Phase 12 reuses it via `hashCohortId()`. | None |
| Build artifacts | `tsc -b` build artifacts regenerate automatically on next build. `node_modules/.tmp/tsconfig.*.tsbuildinfo` may cache pre-`shared/` state — safe to delete if stale errors occur. [VERIFIED: `tsconfig.app.json:3` and `tsconfig.node.json:3` both write build info to `node_modules/.tmp/`.] | `rm -rf node_modules/.tmp && npm run build` if stale-type errors appear |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tsx, Express, Vite | ✓ | v22.22.0 [VERIFIED] | — |
| npm | package install | ✓ | 11.12.1 [VERIFIED] | — |
| tsx | `npm start` server loader | ✓ (devDep 4.21.0 [VERIFIED: package.json:54]) | 4.21.0 | — |
| express | HTTP server | ✓ | 5.2.1 [VERIFIED: package.json] | — |
| better-sqlite3 | audit_log writes | ✓ | 12.8.0 [VERIFIED: package.json] | — |
| js-yaml | settings.yaml parse | ✓ | 4.1.1 [VERIFIED: package.json] | — |
| vitest | test runner | ✓ | 4.1.4 [VERIFIED: package.json] | — |
| supertest | HTTP integration tests | ✓ | 7.2.2 [VERIFIED: package.json:53] | — |
| compression | D-15 gzip middleware | ✗ | — (1.8.1 in registry [VERIFIED: npm view compression]) | Install — no viable fallback; hand-rolling is explicitly anti-pattern |
| @types/compression | TS types for `compression` | ✗ | — (1.8.1 in registry [VERIFIED]) | Install alongside `compression` |

**Missing dependencies with no fallback:** None — `compression` is the only missing package and installing it is the chosen approach.

**Missing dependencies with fallback:** None.

## Common Pitfalls

### Pitfall 1: JSON.stringify byte-parity drift (AGG-02's main hazard)
**What goes wrong:** The parity test asserts `JSON.stringify(clientResult) === JSON.stringify(serverResult)` but the strings differ even though the mathematical values are equal.

**Why it happens — five structural causes:**

1. **Object key order.** `JSON.stringify({a:1, b:2})` ≠ `JSON.stringify({b:2, a:1})`. V8 preserves insertion order for non-numeric string keys [CITED: https://tc39.es/ecma262/ §OrdinaryOwnPropertyKeys]. Construct output objects in the **same literal order** on both sides. Pattern: share a single factory function from `shared/`.
2. **Floating-point representation.** `JSON.stringify(0.1 + 0.2)` → `"0.30000000000000004"` on Node and browser, deterministically. But `JSON.stringify(1e21)` → `"1e+21"` while `JSON.stringify(1000000)` → `"1000000"`. ECMA-262 specifies `Number.prototype.toString(10)` as the serialization — deterministic across V8 versions but surprising near integer boundaries. Tests that round-trip through `Math.log10` or `Math.round` must keep the same operation order on both sides.
3. **`NaN` / `Infinity`.** `JSON.stringify(NaN)` → `"null"` on both Node and browser. But `NaN !== NaN` downstream — a result with NaN will stringify equal but compare unequal via `expect(a).toEqual(b)`. Prefer `expect(JSON.stringify(a)).toBe(JSON.stringify(b))` for the parity test per CONTEXT §specifics.
4. **`undefined` fields.** `JSON.stringify({a:1, b: undefined})` → `'{"a":1}'` — the key drops. If one side sets `b: undefined` explicitly and the other omits it, they stringify equal. But if one side sets `b: null`, the string is `'{"a":1,"b":null}'` — they diverge. Standardize: never emit `undefined` inside shared output; use `null` or omit entirely.
5. **Map/Set serialization.** `JSON.stringify(new Map())` → `'{}'`. The trajectory code does not currently expose Maps in its output shape [VERIFIED: `src/utils/cohortTrajectory.ts:59-71` returns only plain objects and arrays], but be wary if the shape ever evolves.

**How to avoid:** 
- The parity test must `JSON.stringify` BOTH sides (never use `toEqual`).
- The shared module must be the sole producer of the result objects — the server handler only **projects** fields from the shared result (picks `median`, `iqrLow`, `iqrHigh`, etc.) and MUST use the same projection order as the client.
- Response body written with `res.json(payload)` on the server is equivalent to `JSON.stringify(payload)` for this purpose [CITED: Express 5 `res.json` docs].

**Warning signs:** Parity test diffs showing identical-looking objects; diff tools flagging only whitespace or trailing-zero differences; `toEqual` passing but `.toBe(JSON.stringify(...))` failing.

### Pitfall 2: `req.auth.centers` vs body centers (AGG-01)
**What goes wrong:** Handler trusts `req.body.centers` over `req.auth.centers`, allowing a non-admin user to query cross-center data.

**Why it happens:** Copy-paste from a test fixture or client code that did pass centers explicitly.

**How to avoid:** `grep -n "body\.\?.centers" server/outcomesApi.ts` must return zero matches. `req.auth!.centers` is the ONLY legitimate source. A unit test MUST assert that a request body containing `centers: ['org-uka', 'org-ukc']` on behalf of a user authenticated only to `['org-uka']` returns results that do NOT include `org-ukc` patients.

**Warning signs:** Any `Array.isArray(body.centers)` check; any variable named `requestCenters`.

### Pitfall 3: Cache key collisions across users (D-08)
**What goes wrong:** Two users with the same saved-search id (they have identical saved names like "AMD patients") share a cache entry. User B sees User A's filtered view.

**Why it happens:** Cache key omits `user` field. D-08 explicitly includes `user` in the key shape for exactly this reason.

**How to avoid:** Key construction is literal: `JSON.stringify({ cohortId, axisMode, ..., user })`. A test MUST seed two users with the same cohortId and assert their responses differ when their center sets differ.

**Warning signs:** `cacheKey` computation that doesn't contain `user`; test fixtures that authenticate as the same user across runs.

### Pitfall 4: Missing cache invalidation on cohort mutation (D-09)
**What goes wrong:** User edits saved-search filters via `PUT /api/data/saved-searches/:id` (or similar); next aggregate request returns stale pre-edit result for up to 30 minutes.

**Why it happens:** `dataApi.ts` saved-search handlers don't know about `outcomesCache`. The hook must be added explicitly.

**How to avoid:** `server/dataApi.ts` `DELETE /saved-searches/:id` at line 236 and the POST handler at line 179 must call `invalidateByCohort(cohortId)` after mutation. Regression test: create cohort → request aggregate (cache miss) → request again (cache hit, `meta.cacheHit === true`) → update filter → request (cache miss, freshly computed).

**Warning signs:** `grep invalidateByCohort server/dataApi.ts` returns 0 matches at plan-end; cache tests only cover read paths.

### Pitfall 5: Adding `shared/` without updating both tsconfigs
**What goes wrong:** `shared/cohortTrajectory.ts` lives on disk but neither `tsconfig.app.json` nor `tsconfig.server.json` includes it. Build passes (because `tsc -b` skips uncovered files), but `noEmit` means nothing catches the gap until someone tries to strict-typecheck.

**Why it happens:** `tsconfig.app.json:24` and `tsconfig.server.json:16` each have single-entry `include: ["src"]` / `include: ["server"]` respectively [VERIFIED].

**How to avoid:** Both tsconfigs' `include` arrays must add `"shared"`. This is a single atomic task. Plans that only edit one file should fail review.

**Warning signs:** `tsc --noEmit` error-free but IDE complains; imports from `shared/` resolve at runtime via `tsx` (no compile step) but fail when someone runs `npm run build`.

### Pitfall 6: Breaking the `auditMiddleware` skip-list invariant (D-17)
**What goes wrong:** `/api/outcomes/aggregate` is added to `SKIP_AUDIT_PATHS` but the skip check no longer runs before body capture (someone reorders the middleware during refactor).

**Why it happens:** Phase 11 established a first-statement invariant at `server/auditMiddleware.ts:128-134` proved by `awk` ordering check. Any edit that introduces statements between `urlPath` extraction and `SKIP_AUDIT_PATHS.has(...)` breaks the invariant.

**How to avoid:** Same shell assertion used in Phase 11:
```bash
awk '/SKIP_AUDIT_PATHS.has/{skip=NR} /rawBody =/{body=NR} END{exit !(skip < body)}' server/auditMiddleware.ts
```
MUST exit 0. Add to the verification task.

**Warning signs:** Any variable assignment or function call introduced between lines 130 and 134.

## Code Examples

### Example 1: Settings read with new `outcomes.*` keys (client side)

```typescript
// src/services/settingsService.ts — add outcomes to AppSettings shape
export interface AppSettings {
  // ... existing fields
  outcomes?: {
    serverAggregationThresholdPatients?: number;
    aggregateCacheTtlMs?: number;
  };
}
// DEFAULTS update:
const DEFAULTS: AppSettings = {
  // ...
  outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1_800_000 },
};
```

### Example 2: Server cache TTL load at startup

```typescript
// server/index.ts — add after line 120 (after initHashCohortId)
import { initOutcomesCache } from './outcomesCache.js';
initOutcomesCache(settings);
```

### Example 3: Parity test sketch (AGG-02)

```typescript
// tests/outcomesAggregateParity.test.ts (NEW)
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { computeCohortTrajectory } from '../shared/cohortTrajectory';
// ... seed DB fixture, mount aggregate router, auth shim

describe('AGG-02 byte parity', () => {
  it('server response body is byte-identical to client compute', async () => {
    const cases = /* 50-patient synthetic fixture */;
    const clientResult = computeCohortTrajectory({ cases, axisMode: 'days', yMetric: 'absolute', gridPoints: 120 });
    // Project to server shape — same projection the handler uses
    const clientShaped = {
      median: clientResult.combined.medianGrid,
      iqrLow: clientResult.combined.medianGrid.map(g => g.p25),
      iqrHigh: clientResult.combined.medianGrid.map(g => g.p75),
      // no perPatient / scatter (flags default false)
      meta: {
        patientCount: clientResult.combined.summary.patientCount,
        excludedCount: clientResult.combined.summary.excludedCount,
        measurementCount: clientResult.combined.summary.measurementCount,
        cacheHit: false,
      },
    };
    const server = await request(app)
      .post('/api/outcomes/aggregate')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ cohortId: 'test-cohort', axisMode: 'days', yMetric: 'absolute', gridPoints: 120, eye: 'combined' });
    expect(JSON.stringify(server.body)).toBe(JSON.stringify(clientShaped));
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-only `computeCohortTrajectory` in `OutcomesView.tsx` | Server route with size-gated client fallback | Phase 12 (this) | Cohorts > 1000 patients no longer freeze browser |
| Shared code via tsconfig path alias | Single physical `shared/` directory with dual tsconfig `include` | Phase 12 D-01 | Build-time guarantee of parity; no path magic |
| Cohort id in audit beacon URL | Hashed cohort id in audit row body (POST) | Phase 11 | Reused here for AGG-05 |
| Global `express.json()` | Route-scoped body parsers | Phase 02 (original), reinforced Phase 11 | Pattern now reused for compression too |

**Deprecated/outdated:**
- Nothing deprecated by Phase 12. The existing client path `computeCohortTrajectory` → `OutcomesPanel` continues to serve cohorts ≤ threshold.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Brotli vs gzip CPU tradeoff for JSON doesn't justify the dep churn | Alternatives Considered | Planner may still choose brotli; correctness unaffected |
| A2 | `fhirLoader.ts` splitting into `fhirCodes`/`fhirQueries` is the cleanest decoupling | Pattern 1 | Planner may inline constants in `cohortTrajectory.ts` instead — also valid but creates silent duplication risk |
| A3 | `getActivePatientCases(centers)` exists on the server side | Pattern 2 handler skeleton | Current server layer exposes `getCaseToCenter()` + raw `loadBundles` — the handler may need to compose patient extraction from `fhirApi.ts` rather than call a single helper. Concretely, the handler will call `extractPatientCases(filteredBundles)` equivalent logic server-side. Verify during planning. |
| A4 | Express 5's `res.json(payload)` produces byte-identical output to `JSON.stringify(payload)` for the purposes of the parity test | Pattern 1 | If Express adds whitespace or reorders keys, parity test fails. Direct check: `res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload))` is a safe fallback. |
| A5 | The in-memory `Map` cache won't exceed memory pressure for the demonstrator scale | Pattern 3 | Unbounded growth possible if many unique cohort/config combos. Plan can add a soft size cap (e.g., `MAX_ENTRIES = 256`) + LRU eviction if concern surfaces. |

## Open Questions (RESOLVED)

1. **Shared types placement — `shared/types/fhir.ts` vs keep in `src/types/fhir.ts` with a reach-up import?**
   - What we know: `cohortTrajectory.ts` imports `Observation`, `PatientCase`, `Procedure` from `../types/fhir`. Moving to `shared/` means either relocating types or allowing `shared/` to reach into `src/`.
   - What's unclear: Whether the planner wants `shared/` to be a true leaf (no reach-up) or whether a one-level reach is acceptable.
   - RESOLVED: Relocate types to `shared/types/fhir.ts` and re-export from `src/types/fhir.ts` for existing callers. Matches the cohortTrajectory re-export shim pattern. Internalized by Plan 12-01 Task 1 (creates shared/types/fhir.ts) + Task 3 (installs the re-export shim in src/types/fhir.ts).

2. **How does the server discover "active cases" for a cohortId?**
   - What we know: `server/dataDb.js` has `getSavedSearches(user) → SavedSearchRow[]` with `filters` as JSON string. `server/fhirApi.ts` has `getCaseToCenter()` and internal bundle cache. The client path uses `applyFilters(activeCases, savedSearch.filters)`.
   - What's unclear: Whether the server has a single `getActiveCases(centers)` helper equivalent to the client's `useData().activeCases`, or whether the handler must compose `loadBundles → extractPatientCases → center-filter → applyFilters`.
   - RESOLVED: Plan 12-02 Task 2 exports `getCachedBundles` from `server/fhirApi.ts` and the aggregate handler composes `filterBundlesByCenters` + `extractPatientCases` + `applyFilters` inline in `resolveCohortCases`. A single `getActivePatientCases(centers)` helper was not extracted because the composition is only 4 lines and keeping the seams visible aids the AGG-01 center-filter audit (Pitfall #2).

3. **Saved-search update path for D-09 invalidation.**
   - What we know: `server/dataApi.ts` has `POST /saved-searches` (create-or-replace) and `DELETE /saved-searches/:id`. There is no explicit `PUT`.
   - What's unclear: Whether `POST /saved-searches` for an existing id counts as a mutation requiring invalidation.
   - RESOLVED: Yes — Plan 12-02 Task 2 adds `invalidateByCohort(row.id)` after `addSavedSearch` in the POST /saved-searches handler and after `removeSavedSearch` in the DELETE /saved-searches/:id handler of `server/dataApi.ts`. Both paths are treated as mutation triggers.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 [VERIFIED: package.json] with Node env default and jsdom via per-file `// @vitest-environment jsdom` docblock |
| Config file | `vitest.config.ts` [VERIFIED] |
| Quick run command | `npm test -- tests/outcomesAggregate.test.ts tests/outcomesAggregateParity.test.ts --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| AGG-01 | `POST /api/outcomes/aggregate` accepts contract body, enforces center filter from JWT, returns shape with `meta` | integration (supertest) | `npm test -- tests/outcomesAggregate.test.ts -x` | ❌ Wave 0 — new file |
| AGG-02 | Byte-identical JSON.stringify between client `computeCohortTrajectory` and server response | integration (supertest + shared import) | `npm test -- tests/outcomesAggregateParity.test.ts -x` | ❌ Wave 0 — new file |
| AGG-03 | Client routes to server when cohort.cases.length > threshold; to local path otherwise | component (RTL + mocked fetch) | `npm test -- tests/outcomesClientRouting.test.tsx -x` | ❌ Wave 0 — new file |
| AGG-04 | Cache hit path returns `meta.cacheHit: true`; cache invalidates on cohort POST/DELETE | integration (supertest) + unit (cache module) | `npm test -- tests/outcomesCache.test.ts tests/outcomesAggregateCache.test.ts -x` | ❌ Wave 0 — new file |
| AGG-05 | Audit row `outcomes.aggregate` contains hashed cohortId and `payloadBytes`; no raw `cohortId` anywhere | integration (supertest + audit DB query) | `npm test -- tests/outcomesAggregateAudit.test.ts -x` | ❌ Wave 0 — new file |

### Sampling Rate
- **Per task commit:** `npm test -- tests/outcomes*.test.* --run` (new files) + any modified test file
- **Per wave merge:** `npm test -- --run` (full suite, baseline 358/358 from Phase 11 close — must remain green)
- **Phase gate:** Full suite green + `awk` skip-list invariant + grep assertions (`grep -q "body\.centers" server/outcomesApi.ts` → 0 matches)

### Wave 0 Gaps
- [ ] `tests/outcomesAggregate.test.ts` — covers AGG-01 (contract, auth, center filter, cohort ownership)
- [ ] `tests/outcomesAggregateParity.test.ts` — covers AGG-02 (JSON.stringify byte equality at 50-patient seed)
- [ ] `tests/outcomesClientRouting.test.tsx` — covers AGG-03 (size gate + loading state)
- [ ] `tests/outcomesCache.test.ts` — covers AGG-04 cache module unit (get/set/invalidateByCohort/TTL expiry)
- [ ] `tests/outcomesAggregateCache.test.ts` — covers AGG-04 integration (cache hit meta.cacheHit + invalidation on saved-search mutation)
- [ ] `tests/outcomesAggregateAudit.test.ts` — covers AGG-05 (row shape, hashed id, `payloadBytes`, `cacheHit` field, negative assertion for raw cohort id)
- [ ] No framework install required — vitest + supertest already present

### Nyquist Sampling / Boundary Conditions

For AGG-02 parity the test must exercise at least these structural conditions (sampling at rates that catch drift):
- **Patient counts:** 1 (degenerate), 2 (IQR boundary), 50 (canonical), boundary at `gridPoints / 10 - 1` (sparse flag trigger)
- **Axis modes:** both `days` and `treatments`
- **Y metrics:** all three — `absolute`, `delta`, `delta_percent` (last exercises the `clamp(-200, 200)` branch)
- **Eye values:** `od`, `os`, `combined` (combined exercises the pooled-measurements path at `cohortTrajectory.ts:301-316`)
- **Edge values:** measurements producing `NaN` logMAR (decimal ≤ 0), single-measurement patients (sparse → scatter-only path)

For AGG-04 cache sampling:
- **Cache miss → hit:** Same request twice; second response `meta.cacheHit: true`
- **TTL expiry:** Mock clock advance past TTL; response `cacheHit: false` on re-request
- **Explicit invalidation:** Cache populated → DELETE saved-search → same request `cacheHit: false`
- **User scoping:** Same cohortId, different authenticated user → two distinct cache entries

## Security Domain

### Trust Boundaries (carry forward from Phase 11 + new for Phase 12)

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser → `POST /api/outcomes/aggregate` | Untrusted JSON body; `cohortId`, flags originate from the browser. Body MUST NOT be trusted for `centers`. | Cohort id (saved-search id), axis/metric flags |
| `authMiddleware` → aggregate handler | `req.auth.centers` is the authoritative center set. | JWT-verified center list |
| Handler → `getSavedSearches(user)` | Cohort ownership check — a cohortId not owned by `user` must return 403 (D-06). | Saved-search row for the authenticated user |
| Handler → in-memory cache | Cache key is user-scoped (D-08); two users never share an entry. | Serialized aggregate result |
| Handler → `hashCohortId(id)` | Raw id crosses once to produce hash; hash is what reaches the audit log. | Raw cohort id → 16-hex digest |
| Handler → `logAuditEntry(row)` | Row body contains `{ name, cohortHash, centers, payloadBytes, cacheHit }` — never `cohortId`. | Hashed id only |
| `auditMiddleware` → handler | No row written by middleware for this path — `SKIP_AUDIT_PATHS` short-circuits before body capture. | (none — skip-listed) |
| `dataApi` saved-search mutation → cache | Invalidation event flows to `invalidateByCohort(id)`. | Cohort id (in-process, no network) |
| Handler → response body | Response via gzip/deflate wire; client `authFetch` dispatches with `Authorization: Bearer <jwt>`. | Aggregated metrics (already de-identified to pseudonyms) |

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `authMiddleware` enforces JWT on all `/api/*` — no new auth surface |
| V3 Session Management | no | Reuses existing JWT session — no new session primitives |
| V4 Access Control | yes | Center filter from `req.auth.centers`; cohort ownership check returns 403 with generic message (prevents enumeration — L-11 pattern) |
| V5 Input Validation | yes | Body validated: `cohortId` type + length (≤128 like Phase 11 IN-01), axisMode/yMetric/eye enum, gridPoints numeric bounds, flags boolean. Scoped `express.json({ limit: '8kb' })`. |
| V6 Cryptography | yes | `hashCohortId()` — HMAC-SHA256, Phase 11 primitive — never hand-rolled |
| V7 Error Handling & Logging | yes | Audit row via `logAuditEntry` (append-only); errors return generic messages — no stack traces, no cohortId in error bodies |
| V8 Data Protection | yes | Cohort id never appears in audit log body/query; payload size logged (enables abuse detection without content) |
| V9 Communication | yes | HTTPS enforced at reverse proxy; CSP `connectSrc: 'self'` already locked down |
| V11 Business Logic | yes | Rate limiting deferred (explicit out-of-scope); in-memory cache must not be a DoS surface (see Pitfall 3 + A5 open question) |
| V12 Files & Resources | no | No file upload / path traversal surface |
| V13 API | yes | Content-Type `application/json` asserted; methods other than POST return 404 via `app.use('/api', ...)` catchall |

### Known Threat Patterns for this Stack (STRIDE)

| Threat ID | Pattern | STRIDE | Standard Mitigation | Notes for Planner |
|-----------|---------|--------|---------------------|-------------------|
| T-12-01 | Cohort enumeration via response timing / 403 variants | Info Disclosure | Generic 403 message for both "cohort not found" and "cohort not owned" (mirror Phase 11 L-11 pattern). Constant-ish compute via handler-own audit row fire-and-forget style. | Negative assertion test: 403 response body is identical between "nonexistent" and "owned-by-other-user" cases |
| T-12-02 | Cross-center data leak via `body.centers` override | Elevation of Privilege | Handler MUST read only `req.auth.centers`. Grep assertion at verification time. | See Pitfall 2; required unit test |
| T-12-03 | Cache cross-user bleed (same cohortId, different user) | Info Disclosure | Cache key includes `user` field (D-08). Required test: two users, same cohortId, different responses. | See Pitfall 3 |
| T-12-04 | Raw cohortId in audit row | Info Disclosure | Handler serializes `{ name, cohortHash, centers, payloadBytes, cacheHit }` — literal object, no `cohortId` field. `SKIP_AUDIT_PATHS` prevents middleware capture. | Negative assertion: `expect(row.body).not.toContain(rawCohortIdMarker)` (Phase 11 pattern) |
| T-12-05 | Body-size DoS via oversized request | Denial of Service | Scoped `express.json({ limit: '8kb' })` — 413 on oversized | Mirror Phase 11 T-11-06 test |
| T-12-06 | Response-size DoS via 1M-patient cohort + `includePerPatient: true` | Denial of Service | `compression()` mitigates wire cost; cohort size already bounded by active-cases layer; opt-in flags keep default responses small (D-04) | Accept risk or add a patient-count soft cap — planner's call |
| T-12-07 | Timing oracle on cache hit/miss | Info Disclosure | `meta.cacheHit` is exposed in response by design (needed for verification test). Accept risk — same-user cache state is not confidential. | Document as accepted risk |
| T-12-08 | Cache memory exhaustion (unbounded `Map` growth) | Denial of Service | A5 open question — planner may add `MAX_ENTRIES` soft cap with LRU eviction. For the demonstrator the cohort × config cardinality is small. | Revisit if deployed at scale |
| T-12-09 | Stale cache on cohort filter mutation | Integrity / Info Disclosure | D-09 explicit invalidation + D-10 TTL safety net. Required test: mutation → next request is cache miss. | See Pitfall 4 |
| T-12-10 | `compression()` BREACH-style attack on mixed secret/public response | Info Disclosure | Response contains no user-controlled secret interleaved with user-controlled input (aggregate metrics are de-identified). BREACH is low risk here. | Accept risk — document explicitly |

### Accepted Risks (to propose during discuss/plan)

| Risk ID | Threat Ref | Proposed Rationale |
|---------|------------|-------------------|
| AR-12-01 (proposed) | T-12-07 | `meta.cacheHit` is intentionally exposed because AGG-04's success criterion requires an observable cache-hit signal for testing. Same-user cache state is not confidential — the user owns the cohort. |
| AR-12-02 (proposed) | T-12-08 | In-memory unbounded `Map` is acceptable at demonstrator scale; each cohort × config combo generates at most one entry. Hard DoS would require 1000s of distinct saved searches per user. |
| AR-12-03 (proposed) | T-12-10 | BREACH mitigation via `compression()` disabling or randomization is disproportionate for aggregate metrics that contain no per-request secrets. |

## Sources

### Primary (HIGH confidence)
- Codebase — `src/utils/cohortTrajectory.ts` (504 lines, verified pure math)
- Codebase — `server/auditMiddleware.ts` (verified SKIP_AUDIT_PATHS skip-list pattern, ordering invariant)
- Codebase — `server/auditApi.ts` (verified handler-own-row POST pattern)
- Codebase — `server/hashCohortId.ts` + `tests/hashCohortId.test.ts` (8 tests, 16-hex determinism)
- Codebase — `server/index.ts` (scoped `express.json` mounts, startup ordering)
- Codebase — `server/authMiddleware.ts` (AuthPayload shape, `req.auth.centers`)
- Codebase — `config/settings.yaml` (verified 12-line shape, `audit.cohortHashSecret` presence)
- Codebase — `tsconfig.app.json` / `tsconfig.server.json` / `tsconfig.json` (single-entry `include` arrays)
- Codebase — `package.json` (dep versions + test script)
- Codebase — `vitest.config.ts` (test glob + node default env)
- `.planning/phases/11-audit-beacon-pii-hardening/11-SECURITY.md` — 11 threats, AR-11-01/02 accepted risks
- `.planning/phases/11-audit-beacon-pii-hardening/11-01-SUMMARY.md` — hashCohortId primitive spec
- `.planning/phases/11-audit-beacon-pii-hardening/11-02-SUMMARY.md` — SKIP_AUDIT_PATHS + handler-own-row
- `npm view compression version` — 1.8.1 published 2026-03-28 (VERIFIED via registry)

### Secondary (MEDIUM confidence)
- Express compression docs — https://expressjs.com/en/resources/middleware/compression.html (scoped middleware guidance)
- expressjs/compression GitHub — https://github.com/expressjs/compression (API surface, default options)

### Tertiary (LOW confidence)
- None — all claims herein are either codebase-verified or cited to authoritative sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library verified against installed `package.json` + npm registry
- Architecture: HIGH — patterns are direct extensions of Phase 11 precedent, all integration points inspected
- Pitfalls: HIGH for Pitfalls 2-6 (codebase-verified invariants); MEDIUM for Pitfall 1 (JSON.stringify byte-parity is well-understood but the test will surface reality)
- Security domain: HIGH — trust boundaries mirror Phase 11 with aggregate-specific extensions; STRIDE catalog covers the request → compute → cache → audit chain

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days — the Express 5 + `compression` 1.8.x combination is stable)

Sources:
- [Express compression middleware](https://expressjs.com/en/resources/middleware/compression.html)
- [expressjs/compression GitHub](https://github.com/expressjs/compression)
