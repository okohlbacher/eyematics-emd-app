# Phase 11: Audit Beacon PII Hardening — Research

**Researched:** 2026-04-16
**Domain:** Server-side PII hardening (audit trail) + reusable HMAC hashing primitive
**Confidence:** HIGH

## Summary

This phase has no unknown architecture. The stack (Node 22 + Express 5 + `better-sqlite3` + `js-yaml` + Vitest + supertest + jsdom) is already in the repo, every surface touched already has an established pattern, and CONTEXT.md has locked every substantive decision. Research output therefore focuses on two things: (1) confirming the existing patterns that the plan must mirror — fail-fast startup secret loading like `jwt-secret.txt`, the `REDACT_PATHS` set for middleware opt-in, the supertest fixture shape in `tests/auditApi.test.ts` — and (2) pinning down the few concrete choices the planner still has to make (settings key name, utility module path, skip-list mechanism) so the plan can be prescriptive rather than exploratory.

Node's built-in `crypto.createHmac('sha256', secret).update(id).digest('hex')` is fully sufficient for D-04; no new dependencies are required. The existing audit test harness (temp dir + `initAuditDb()` + direct `logAuditEntry()` seeding + supertest against a hand-mounted Express app that injects `req.auth`) extends cleanly to the new POST flow. The single React test that currently asserts the GET beacon URL shape (`tests/OutcomesPage.test.tsx` test 6) is the only client-side surface that changes.

**Primary recommendation:** Create `server/hashCohortId.ts` with a two-function module (`initHashCohortId(secret)` + `hashCohortId(id)`), mirror `initAuth.ts`'s fail-fast pattern, wire it from `server/index.ts` step 3.5 (after `initAuth`, before `initAuditDb`), add the settings key `audit.cohortHashSecret` to `settings.yaml` schema validation, flip the beacon route from GET to POST, extend `REDACT_PATHS` with a sibling `SKIP_PATHS` set the middleware consults before calling `logAuditEntry`, and write the new row directly from the handler.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Transport (how cohort reference reaches the server)**
- **D-01:** Switch `/api/audit/events/view-open` from `GET` to `POST`. Client sends JSON body `{ name, cohortId?, filter? }`. No cohort or filter in the URL.
- **D-02:** Client uses `fetch('/api/audit/events/view-open', { method: 'POST', body: JSON.stringify(...), keepalive: true, credentials: 'include' })` — not `navigator.sendBeacon`. Keepalive survives unload, stays testable in jsdom, and allows standard `Content-Type: application/json` header.
- **D-03:** The beacon remains fire-and-forget — the handler continues to respond 204 and the client discards errors.

**Hashing primitive**
- **D-04:** `hashCohortId(id)` uses HMAC-SHA256 via Node's `crypto.createHmac('sha256', secret).update(id).digest('hex')`, truncated to **16 hex chars (64 bits)** before storage.
- **D-05:** HMAC secret sourced from `settings.yaml` under a new key (name to be picked by planner, e.g. `audit.cohort_hash_secret`). No env vars, no client exposure, no hardcoded fallback — missing secret is a startup error.
- **D-06:** Determinism lock: same (secret, id) MUST produce same hash across process restarts. No per-process salt, no time-based inputs.
- **D-07:** Utility lives in server code (planner decides exact path, e.g. `server/hashCohortId.ts`) and is exported for AGG-05 (Phase 12) reuse without modification.

**filter parameter treatment**
- **D-08:** Move `filter` payload off the URL into the same POST body alongside cohortId. No hashing — filter is an ad-hoc criteria snapshot, not an identifier. D-11 middleware body redaction does NOT apply here (see D-11 below).

**Audit write path**
- **D-09:** Beacon handler is the audit row writer. It computes `cohortHash` via `hashCohortId(cohortId)`, constructs the event payload `{ name, cohortHash, filter }`, calls `logAuditEntry()` directly, then returns 204.
- **D-10:** The audit middleware MUST skip-list `POST /api/audit/events/view-open` so it does not write a duplicate row or log the raw request body. Planner defines the skip-list mechanism (config entry or path match).
- **D-11:** Raw `cohortId` is never written to `audit_log.body` or `audit_log.query`. Unit test seeds a cohort, fires the beacon, reads the audit DB row, asserts `cohortHash` present AND raw id absent.

**Historical audit data**
- **D-12:** Existing audit_log rows containing raw cohort ids in the query field are left untouched. Append-only principle (D-13 / AUDIT-05) preserved. Only new rows use the hashed form.

### Claude's Discretion
- Exact settings.yaml key name for the HMAC secret
- Exact path of the hash utility module
- Skip-list mechanism shape in middleware (path constant vs config list)
- Whether to expose a small convenience wrapper (e.g., `hashCohortIdFromRequest(req)`) for AGG-05 reuse — planner decides based on shape of Phase 12 work

### Deferred Ideas (OUT OF SCOPE)
- Retroactive migration / redaction of existing audit_log rows (explicitly out of scope — append-only preserved)
- Client-side hashing with server-provided salt (rejected: violates security-first / no-client-trust rule)
- Symmetric hashing of `filter` payload (rejected: filter is criteria, not identifier)
- `navigator.sendBeacon` adoption (deferred: fetch+keepalive is equivalent for our needs and more testable)
- Full 256-bit hash storage (deferred: 64 bits is collision-resistant for cohort-id space)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CRREV-01 | Audit beacon `GET /api/audit/events/view-open` no longer carries cohort id in querystring; cohort reference sent as hashed id in the event payload, verified by test against the audit DB row. | Entire research applies. Transport flip (D-01/D-02) closes the querystring leak; handler-writes-row path (D-09/D-11) plus middleware skip-list (D-10) ensure the audit DB row stores `cohortHash` not raw id. Test in `tests/auditApi.test.ts` pattern seeds DB, fires supertest POST, asserts DB row contents. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` file exists at the project root [VERIFIED: Read tool returned ENOENT]. Project-level guidance is therefore inherited from `.planning/STATE.md` §Accumulated Context and MEMORY-level preferences:
- **Security-first** — server-side enforcement, no client trust, audit immutability [VERIFIED: STATE.md + user memory `feedback_security_first`]
- **Config in `settings.yaml`** — single config source, no env vars [VERIFIED: STATE.md + user memory `feedback_config_settings_yaml`]. D-05 aligns with this directly.
- **Audit is append-only from the server's perspective** — no update/delete/PATCH endpoints [VERIFIED: auditApi.ts:109-115 comment]. D-12 honors this.
- **v1.5 regression surface is 313/313 tests across 27 files** — no phase may regress this count [VERIFIED: ROADMAP.md line 21]. New tests must add, not replace, and existing beacon GET tests must be migrated not deleted where possible.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` | built-in (Node 22.22.0) | HMAC-SHA256 computation | [VERIFIED: node --version in workspace]. Already imported by `server/auditMiddleware.ts:18` (`randomUUID`) and `server/initAuth.ts:8` (`randomBytes`) — zero new dependency surface. |
| `express` | 5.2.1 | Routing (beacon handler) | [VERIFIED: package.json:21]. Existing `auditApiRouter` uses Express 5 Router — same module gets a new `.post()` next to the existing `.get()`. |
| `js-yaml` | 4.1.1 | `settings.yaml` parse | [VERIFIED: package.json:25]. `yaml.load()` already used at `server/index.ts:60`. The new secret key goes through the same pipeline. |
| `better-sqlite3` | 12.8.0 | Audit DB writes | [VERIFIED: package.json:20]. `logAuditEntry()` already the single-writer function — beacon handler calls it directly per D-09. |
| `vitest` | 4.1.4 | Test runner | [VERIFIED: package.json:59]. Node env default, jsdom via per-file docblock — pattern used by `tests/OutcomesPage.test.tsx:1`. |
| `supertest` | 7.2.2 | HTTP assertion harness | [VERIFIED: package.json:54]. Existing `tests/auditApi.test.ts` uses `request(app).get()`/`.post().send()` — new POST test extends same fixture. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jsdom` | 29.0.2 | Component test env | [VERIFIED: package.json:53]. Required for `tests/OutcomesPage.test.tsx` test 6 migration (fetch spy + RTL). |
| `express.json()` | (express 5) | Request body parsing | [VERIFIED: server/index.ts:180-181]. Currently scoped to `/api/auth/*` and `/api/data/*`. Beacon's new POST needs `express.json()` added on its route — see Architecture Patterns. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `crypto.createHmac('sha256', secret)` | `crypto.subtle.sign('HMAC', ...)` (WebCrypto) | WebCrypto is async and returns `ArrayBuffer` — slower path for a simple sync hot path. Node's callback-free `createHmac` is the project's idiomatic choice (no existing use of `crypto.subtle` in server code [VERIFIED: grep `crypto.subtle` server/ → 0 matches]). |
| Separate JSON body parser mount | Global `express.json()` | Global parsing would consume the stream before `readBody()` routes (issues, settings YAML) — documented at `server/index.ts:178-181`. Must scope the new parser to `/api/audit/events/view-open` only. |
| Full 64-char hex hash | 16-char truncation | D-13 locks 16 chars (64 bits). Research support: 64 bits resists birthday collisions up to ~2^32 distinct cohort ids (~4B) which dwarfs realistic saved-search counts [ASSUMED]. |

**Installation:**
```bash
# No new dependencies required — all primitives are already installed.
```

**Version verification** [VERIFIED: `npm view` at research time]:
- `js-yaml@4.1.1` published 2024 — current version stream [VERIFIED: npm view].
- `better-sqlite3@12.9.0` latest; project on `^12.8.0` — compatible.
- `vitest@4.1.4` matches installed.
- Node 22.22.0 LTS [VERIFIED: `node --version`].

## Architecture Patterns

### File / Module Layout
```
server/
├── hashCohortId.ts         # NEW — init + compute, exported for Phase 12 reuse
├── auditApi.ts             # CHANGED — GET beacon → POST beacon; handler writes audit row
├── auditMiddleware.ts      # CHANGED — add SKIP_PATHS (siblings to REDACT_PATHS)
├── auditDb.ts              # UNCHANGED — logAuditEntry signature already accepts a pre-built row
├── index.ts                # CHANGED — call initHashCohortId(settings) between initAuth and initAuditDb; add express.json() mount for /api/audit/events/view-open
└── settingsApi.ts          # CHANGED — validateSettingsSchema must require the new key when present OR the startup path must handle missing-key

config/
└── settings.yaml           # CHANGED — add audit.cohortHashSecret (32+ byte random value)

tests/
├── hashCohortId.test.ts    # NEW — determinism + different-input-different-hash + 16-char length
├── auditApi.test.ts        # CHANGED — replace GET beacon tests with POST-body tests; assert audit row contents
├── auditMiddleware.test.ts # CHANGED — add skip-list assertion (POST /api/audit/events/view-open NOT logged by middleware)
└── OutcomesPage.test.tsx   # CHANGED — test 6 now asserts POST method + JSON body + keepalive
```

### Pattern 1: Fail-fast startup secret loading
**What:** Required secret is read from settings/disk at startup; absence throws and crashes the process before the server starts listening.
**When to use:** Any secret that must exist at steady state and must not fall back to a generated-per-process value (determinism requirement D-06 forbids regeneration).
**Example (mirrors `server/initAuth.ts:56-68` JWT secret pattern):**
```typescript
// Source: server/initAuth.ts:56-68 (VERIFIED pattern)
// NEW FILE: server/hashCohortId.ts
import crypto from 'node:crypto';

let _secret: string | null = null;

export function initHashCohortId(settings: Record<string, unknown>): void {
  const auditSection = (settings.audit ?? {}) as Record<string, unknown>;
  const secret = auditSection.cohortHashSecret;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error(
      '[hashCohortId] FATAL: settings.audit.cohortHashSecret is required and must be at least 32 characters'
    );
  }
  _secret = secret;
}

export function hashCohortId(id: string): string {
  if (_secret === null) {
    throw new Error('[hashCohortId] hashCohortId() called before initHashCohortId()');
  }
  return crypto.createHmac('sha256', _secret).update(id).digest('hex').slice(0, 16);
}
```
**Why this shape:** `initAuth.ts` already uses module-level `let _jwtSecret: string | null = null` with an init function and a getter that throws if uninitialised. Reusing the pattern gives the planner zero novel territory and keeps AGG-05 reuse trivial (`import { hashCohortId } from './hashCohortId.js'`).

### Pattern 2: Middleware opt-out via a `Set<string>` path list
**What:** The middleware consults a `Set` of paths and skips action for matches, analogous to the existing `REDACT_PATHS`.
**When to use:** The beacon handler writes its own authoritative row (D-09); the middleware must not write a duplicate or log the raw body.
**Example (mirrors `server/auditMiddleware.ts:34-38`):**
```typescript
// Source: server/auditMiddleware.ts:34-38 (VERIFIED pattern)
const REDACT_PATHS = new Set([...]);

// NEW — add next to REDACT_PATHS:
const SKIP_AUDIT_PATHS = new Set([
  '/api/audit/events/view-open',  // D-10: handler writes its own row with hashed cohort id
]);

// Inside the res.on('finish') handler, short-circuit before logAuditEntry:
if (SKIP_AUDIT_PATHS.has(urlPath)) return;
```
**Why this shape:** The existing `REDACT_PATHS` set is the canonical opt-in mechanism; a sibling `SKIP_AUDIT_PATHS` keeps the vocabulary consistent and colocates audit-policy configuration. Path match is keyed on the already-computed `urlPath` (querystring already stripped at `auditMiddleware.ts:117`).

### Pattern 3: Handler writes audit row directly
**What:** The beacon handler builds the `AuditDbRow` itself and calls `logAuditEntry()` before `res.status(204).end()`.
**When to use:** The handler has data (the hashed cohort id, the filter snapshot) that the middleware cannot compute from req/res alone.
**Example (mirrors the middleware's row construction at `auditMiddleware.ts:140-150`):**
```typescript
// Source: server/auditMiddleware.ts:140-150 (VERIFIED pattern)
// NEW — inside auditApiRouter.post('/events/view-open', ...):
import crypto from 'node:crypto';
import { logAuditEntry } from './auditDb.js';
import { hashCohortId } from './hashCohortId.js';

auditApiRouter.post('/events/view-open', (req: Request, res: Response): void => {
  const body = (req.body ?? {}) as { name?: string; cohortId?: string; filter?: unknown };
  const name = typeof body.name === 'string' ? body.name : 'unknown';
  const cohortHash = typeof body.cohortId === 'string' ? hashCohortId(body.cohortId) : null;
  const filter = body.filter ?? null;

  logAuditEntry({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: 'POST',
    path: '/api/audit/events/view-open',
    user: req.auth?.preferred_username ?? 'anonymous',
    status: 204,
    duration_ms: 0,
    body: JSON.stringify({ name, cohortHash, filter }),
    query: null,
  });

  res.status(204).end();
});
```
**Why this shape:** `logAuditEntry(entry)` is a thin wrapper over a prepared insert (`server/auditDb.ts:114-119`) — no req/res coupling. The middleware uses the same construction shape, so the on-disk row shape stays uniform.

### Pattern 4: Client POST with `keepalive: true`
**What:** Client uses the standard Fetch API with `{ method: 'POST', body: JSON.stringify(...), keepalive: true, credentials: 'include', headers: { 'Content-Type': 'application/json' } }`.
**When to use:** Fire-and-forget telemetry that must survive page unload without adopting the `sendBeacon` API surface (which only supports `Blob`/form-encoded bodies).
**Example (replaces `src/pages/OutcomesPage.tsx:86-94`):**
```typescript
// CURRENT (to be replaced):
const params = new URLSearchParams({ name: 'open_outcomes_view' });
if (cid) params.set('cohort', cid);
if (fp) params.set('filter', fp);
fetch(`/api/audit/events/view-open?${params.toString()}`, { credentials: 'include' });

// NEW (D-01 / D-02 / D-08):
const body: Record<string, unknown> = { name: 'open_outcomes_view' };
if (cid) body.cohortId = cid;
if (fp) { try { body.filter = JSON.parse(decodeURIComponent(fp)); } catch { /* drop */ } }
fetch('/api/audit/events/view-open', {
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
  keepalive: true,
  credentials: 'include',
}).catch(() => { /* beacon is fire-and-forget */ });
```
**Why this shape:** The existing call site is a `useEffect` with empty deps — a single fire on mount. `keepalive: true` is the semantically correct flag for "may outlive this document" [CITED: MDN `fetch` keepalive option]. Existing test (`OutcomesPage.test.tsx:198-199`) already stubs `global.fetch`, so keepalive behaviour in jsdom is not exercised — the spy just records the RequestInit.

### Pattern 5: Mount `express.json()` on just the beacon route
**What:** Call `express.json({ limit: '16kb' })` only on the beacon route, not globally.
**When to use:** The project deliberately avoids global body parsers because `issueApiRouter` and `settingsApiRouter` use `readBody()` on the raw stream (`server/index.ts:178-181` comment). Global parsers would consume the stream before those handlers.
**Example:**
```typescript
// Source: server/index.ts:180-181 + 194-195 (VERIFIED pattern)
// Option A — mount on the router internally before the route (preferred: co-locates wiring with handler):
// inside server/auditApi.ts
import express from 'express';
auditApiRouter.post(
  '/events/view-open',
  express.json({ limit: '16kb' }),
  (req, res) => { /* handler */ }
);

// Option B — mount at index.ts alongside other scoped parsers:
// inside server/index.ts near line 181
app.use('/api/audit/events/view-open', express.json({ limit: '16kb' }));
```
**Why this shape:** `/api/data` uses Option B (`server/index.ts:181`), `/api/issues` uses `app.use('/api/issues', express.json(...), issueApiRouter)` compound form (`server/index.ts:194`). Option A is the least invasive to `index.ts`. Planner picks; both work. Small limit (16kb) prevents abuse since filter payloads are always small JSON.

### Pattern 6: Settings schema validation hook
**What:** Add the new key to `validateSettingsSchema` in `settingsApi.ts:39-55` so PUT /api/settings rejects invalid updates, and add startup-time validation in `initHashCohortId`.
**When to use:** Any new required settings key.
**Why this shape:** Defence in depth — startup fails fast if the bootstrap file is bad (index.ts path), and runtime PUTs can't poison the key if an admin edits settings via the UI.

### Anti-Patterns to Avoid
- **Regenerating the HMAC secret per process** — violates D-06 determinism. Contrast with JWT secret at `initAuth.ts:66-69` where `crypto.randomBytes(32)` generates a secret if missing. For the cohort hash secret, missing-key MUST be fatal, not auto-generated, because different-secret values on restart would produce different hashes for the same cohort id, defeating cross-row correlation in audit queries.
- **Logging raw `cohortId` anywhere** — middleware normally stores `req.body` for POST routes (`auditMiddleware.ts:134`). The skip-list must fire BEFORE the body-capture code path, not after, or the middleware's `logAuditEntry` call will still run with the raw body in hand.
- **Mounting global `express.json()`** — breaks `issueApi` and `settingsApi` which consume the raw stream (`server/index.ts:178-181`).
- **Hashing inside the client** — explicitly rejected in CONTEXT.md deferred list. Client code must send the raw cohortId in the POST body; server hashes.
- **Using `path.includes()` or regex on `urlPath`** — existing code uses exact `Set` membership (`REDACT_PATHS.has(urlPath)`). Reuse that shape.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC-SHA256 | Hand-rolled SHA-256 + XOR pad | `crypto.createHmac('sha256', secret)` | Node built-in is constant-time, FIPS-validated, and avoids `Buffer`/`string` encoding pitfalls. [CITED: Node.js crypto docs]. |
| Secure random secret generation | `Math.random()`, `Date.now()`, ad-hoc PRNG | `crypto.randomBytes(32).toString('hex')` | Already the pattern at `initAuth.ts:66`. Planner should include a setup note (README or PROJECT.md) telling deployers how to generate the secret — not generate it in code. |
| Request body parsing | Manual stream reading for the beacon route | Scoped `express.json({ limit: '16kb' })` | The project reserves raw stream handling for routes that need it (YAML, binary) — beacon body is trivial JSON. |
| Path-based middleware opt-out | `path.startsWith()` / regex | `Set<string>.has(urlPath)` | Matches existing `REDACT_PATHS` style (`auditMiddleware.ts:34-38`). Exact-match is correct here — no prefix confusion possible. |
| Test DB setup | Mock `better-sqlite3` | `initAuditDb(tmpDir)` with `fs.mkdtempSync` | Existing test suite uses real in-tmp-dir databases (`tests/auditApi.test.ts:65-67`). Real DB round-trips are fast (<10ms) and catch schema drift. |

**Key insight:** This phase is almost pure configuration — every primitive is already in the tree. The value the planner adds is shape discipline (match existing patterns), not invention.

## Common Pitfalls

### Pitfall 1: Skip-list check placed after body-capture in middleware
**What goes wrong:** Middleware reads and serialises `req.body` for the POST beacon (raw cohortId included) before the skip-list fires. Even if no row is written, a raw-id leak can appear in debug logs or stack traces.
**Why it happens:** `auditMiddleware.ts:114-151` currently captures body, queries, duration, etc. inside `res.on('finish')` and then calls `logAuditEntry`. Inserting a skip check at the bottom of that block is tempting but does no harm; inserting it at the top is safer.
**How to avoid:** Put the `SKIP_AUDIT_PATHS.has(urlPath)` check as the first statement inside `res.on('finish')`, before body extraction (`const rawBody = req.method !== 'GET' ? ...`).
**Warning signs:** Tests that grep for the raw cohort id in any captured log output still find matches even though the DB row is correct.

### Pitfall 2: `express.json()` mounted globally to "simplify" the new route
**What goes wrong:** Subsequent PUTs to `/api/settings` fail because the raw YAML stream has already been consumed by the JSON parser.
**Why it happens:** `settingsApi.ts` uses `express.text()` (index.ts:195) and `issueApi.ts` uses `express.json()` scoped inline (index.ts:194). A global `app.use(express.json())` call breaks the scoping contract documented at `index.ts:178-179`.
**How to avoid:** Scope the JSON parser to `/api/audit/events/view-open` only (Pattern 5).
**Warning signs:** `tests/settingsApi.test.ts` starts failing after the beacon change lands.

### Pitfall 3: Missing `initHashCohortId()` call in test harness
**What goes wrong:** `tests/auditApi.test.ts` for the new POST route fails at runtime because `hashCohortId()` throws "called before initHashCohortId()".
**Why it happens:** The test `beforeEach` initialises the audit DB but not the hash module. `initAuth` and `initAuditDb` are per-test concerns that existing tests handle; the hash module is new.
**How to avoid:** Add `initHashCohortId({ audit: { cohortHashSecret: 'test-secret-32-chars-minimum-xxxxx' } })` to the `beforeEach` block alongside `initAuditDb(tmpDir)`.
**Warning signs:** New test throws `[hashCohortId] hashCohortId() called before initHashCohortId()` even though the handler code looks correct.

### Pitfall 4: `OutcomesPage.test.tsx` test 6 breaks silently
**What goes wrong:** Test 6 currently asserts `url.toContain('cohort=abc')` — after the GET-to-POST flip the URL no longer contains the cohort id, so the assertion fails, but the descriptive test name still reads "fires audit beacon exactly once on mount with correct URL and credentials" which is misleading.
**Why it happens:** The test was written against the leaky URL shape.
**How to avoid:** Migrate the assertion to: method === 'POST', `init.keepalive === true`, `JSON.parse(init.body)` contains `cohortId: 'abc'` (client still sends raw id; server hashes), `init.headers['Content-Type']` === `application/json`.
**Warning signs:** Test 6 fails on the first run after the client change; update both the assertions and the test description.

### Pitfall 5: Startup ordering — `initHashCohortId` must run before any request could reach the handler
**What goes wrong:** The POST route is live (via `auditApiRouter`) but `hashCohortId` was never initialised because `initHashCohortId(settings)` was placed after `app.listen()`.
**Why it happens:** `server/index.ts` has a specific startup sequence documented at lines 1-22; easy to miss the right slot.
**How to avoid:** Insert the init call at step "3.5" — after `initAuth(DATA_DIR, settings)` (line 116), before `initAuditDb(DATA_DIR, retentionDays)` (line 125). Both dependencies (`settings` object, no DB needed yet) are satisfied there.
**Warning signs:** First production POST to the beacon returns 500 (thrown by hash getter); no audit row written.

### Pitfall 6: Settings validator silently accepts missing key at PUT time
**What goes wrong:** An admin edits `settings.yaml` via the UI, omits `audit.cohortHashSecret`, and subsequent requests fail because `updateAuthConfig`-equivalent logic for the hash module is absent.
**Why it happens:** `validateSettingsSchema` (settingsApi.ts:39-55) only validates the fields it explicitly checks; unknown fields pass through. The new key is required at startup but optional at PUT because there's no `updateHashCohortId` corollary to `updateAuthConfig`.
**How to avoid:** Either (a) add `audit.cohortHashSecret` required-check to `validateSettingsSchema`, or (b) keep the startup-only model and document that rotating the secret requires a restart. Decision belongs to the planner; option (b) is simpler and aligns with the JWT-secret model (`initAuth.ts` never re-reads the secret from settings).
**Warning signs:** Admin PUTs settings without the key, restart reveals the error, audit events 500 in the meantime.

## Code Examples

### Hash utility + determinism test (Pattern 1)
```typescript
// Source: server/hashCohortId.ts — NEW (follows server/initAuth.ts:38-115 VERIFIED pattern)
import crypto from 'node:crypto';

let _secret: string | null = null;

export function initHashCohortId(settings: Record<string, unknown>): void {
  const auditSection = (settings.audit ?? {}) as Record<string, unknown>;
  const secret = auditSection.cohortHashSecret;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error(
      '[hashCohortId] FATAL: settings.audit.cohortHashSecret must be a string of at least 32 characters'
    );
  }
  _secret = secret;
}

export function hashCohortId(id: string): string {
  if (_secret === null) {
    throw new Error('[hashCohortId] hashCohortId() called before initHashCohortId()');
  }
  return crypto.createHmac('sha256', _secret).update(id).digest('hex').slice(0, 16);
}

// tests/hashCohortId.test.ts — NEW
import { describe, expect, it, beforeEach } from 'vitest';
import { initHashCohortId, hashCohortId } from '../server/hashCohortId';

const SECRET = 'deterministic-test-secret-32chars';

beforeEach(() => { initHashCohortId({ audit: { cohortHashSecret: SECRET } }); });

describe('hashCohortId', () => {
  it('same input produces same hash (determinism / D-06)', () => {
    expect(hashCohortId('abc')).toBe(hashCohortId('abc'));
  });
  it('different inputs produce different hashes', () => {
    expect(hashCohortId('abc')).not.toBe(hashCohortId('abd'));
  });
  it('produces exactly 16 hex chars (D-04)', () => {
    const h = hashCohortId('abc');
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });
  it('throws if init not called', () => {
    // reset by direct re-import mock — or add a resetForTesting() export
  });
});
```

### Middleware skip + beacon handler integration test (Pattern 2 + 3)
```typescript
// Source: tests/auditApi.test.ts — EXTEND (pattern from lines 117-145)
describe('POST /api/audit/events/view-open — hashed beacon', () => {
  it('writes an audit row with cohortHash and NO raw cohortId', async () => {
    const app = createApp('researcher', 'researcher');
    const res = await request(app)
      .post('/api/audit/events/view-open')
      .send({ name: 'open_outcomes_view', cohortId: 'saved-search-xyz', filter: { diagnosis: ['AMD'] } });
    expect(res.status).toBe(204);

    const { rows } = queryAudit({ path: '/api/audit/events/view-open' });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.method).toBe('POST');
    expect(row.body).not.toContain('saved-search-xyz');   // D-11 negative assertion
    const parsed = JSON.parse(row.body!);
    expect(parsed.cohortHash).toMatch(/^[0-9a-f]{16}$/);
    expect(parsed.filter).toEqual({ diagnosis: ['AMD'] });
    expect(parsed).not.toHaveProperty('cohortId');
  });

  it('middleware does NOT write a duplicate row (D-10 skip-list)', async () => {
    // Assert exactly one row exists for the beacon path after a single POST.
    // The middleware-written row would have method=POST and body containing "saved-search-xyz" raw,
    // so its absence is proved by the assertion above. A second query for row count confirms.
  });
});
```

### Client transport migration (Pattern 4)
```typescript
// Source: src/pages/OutcomesPage.tsx lines 86-94 — REPLACE
useEffect(() => {
  const cid = searchParams.get('cohort');
  const fp = searchParams.get('filter');
  const body: Record<string, unknown> = { name: 'open_outcomes_view' };
  if (cid) body.cohortId = cid;
  if (fp) {
    try { body.filter = JSON.parse(decodeURIComponent(fp)); } catch { /* drop malformed filter */ }
  }
  fetch('/api/audit/events/view-open', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    credentials: 'include',
  }).catch(() => { /* beacon is fire-and-forget (D-03) */ });
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

### Startup wiring (`server/index.ts`)
```typescript
// Source: server/index.ts — INSERT between line 116 (initAuth) and line 122 (auditSection)
import { initHashCohortId } from './hashCohortId.js';
// ...
initAuth(DATA_DIR, settings);

// NEW — Phase 11 / D-05 / D-06: cohort-id hash secret, fail-fast
initHashCohortId(settings);

// ...
initAuditDb(DATA_DIR, retentionDays);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw identifier in audit URL query | HMAC-hashed identifier in audit body | This phase | Closes IN-01. Server-held secret means the hash is not reversible by clients or users who read audit rows. |
| `navigator.sendBeacon` for unload-safe telemetry | `fetch(..., { keepalive: true })` | Universally supported since Chrome 66 / Firefox 78 / Safari 13 [ASSUMED: general browser support timing — not verified this session] | Better ergonomics: standard headers, readable bodies, testable with standard fetch spies. |
| GET-with-querystring beacons | POST-with-JSON-body beacons | PII hygiene shift in telemetry design | URLs are logged in more places (access logs, proxies, referrers) than request bodies. Moving identifiers off the URL shrinks leak surface. |

**Deprecated/outdated:**
- Nothing in the current codebase is deprecated; this phase is additive + one transport flip.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 64-bit hash is collision-resistant for realistic cohort-id cardinality (saved searches count measured in thousands, not billions). | Standard Stack "Alternatives Considered" | Low. If cohort-id space ever exceeds ~4B values, birthday collisions become plausible. Realistic cardinality is many orders of magnitude below this. |
| A2 | Minimum secret length of 32 characters is a reasonable floor. The JWT secret uses 32 random bytes hex-encoded (64 chars) at `initAuth.ts:66`; 32 chars matches common HMAC guidance. | Code Examples "hashCohortId" | Low. Higher floor (e.g., 64) would be safer; 32 is the common floor in HMAC practice. Planner may raise. |
| A3 | `keepalive: true` on fetch is a web-platform flag jsdom's test env does not need to implement because the test suite always stubs `global.fetch`. Verified by: `tests/OutcomesPage.test.tsx:198-199` sets `global.fetch = fetchSpy`; the spy records RequestInit verbatim. | Architecture Patterns "Pattern 4" | Very low — confirmed by reading the existing test. |
| A4 | Phase 12's `AGG-05` call site will pass a string cohortId and receive a string hash, not a richer signature. | Open Questions | Medium. If AGG-05 needs user-scoped hashing or incorporates more inputs (e.g., `hashCohortId(cohortId, userId)`), the single-argument interface would need extension. See Open Questions #1. |
| A5 | `keepalive: true` with `fetch` has been supported across evergreen browsers for years; the project already depends on modern-browser-only features (Recharts, React 19). | Architecture Patterns "Pattern 4" | Low. Browser support [CITED: MDN fetch `keepalive` option, WHATWG Fetch §4.5] is mature. |

## Open Questions

1. **Phase 12 AGG-05 signature expectations**
   - What we know: AGG-05 says "emits an audit event `outcomes.aggregate` with cohort id hash (not raw id), user, center set, and payload size" (REQUIREMENTS.md line 29). This is one consumer, identical input shape.
   - What's unclear: Whether Phase 12 will want a `hashCohortIdFromRequest(req)` convenience wrapper (CONTEXT.md discretion item) or will call `hashCohortId(cohortId)` directly.
   - Recommendation: Ship only the base `hashCohortId(id: string) => string` in Phase 11. AGG-05 can add a wrapper in Phase 12 if its handler code needs one. Keeps Phase 11 scope minimal and interface surface narrow.

2. **Secret rotation path**
   - What we know: D-06 locks determinism — same (secret, id) → same hash across restarts.
   - What's unclear: Does "no per-process salt" also mean "same secret forever"? If the secret is ever rotated, existing hashed audit rows become orphaned (cannot be cross-referenced to new hashes of the same cohort).
   - Recommendation: Document in a PROJECT.md or operational-notes comment that secret rotation is a breaking change for audit-row correlation. Not a code change this phase; a deliberate non-feature.

3. **Skip-list mechanism choice (explicitly flagged as Claude's discretion)**
   - What we know: CONTEXT.md leaves "config entry or path match" open.
   - What's unclear: Whether other routes will need the same skip treatment in v1.7+.
   - Recommendation: Use a module-level `const SKIP_AUDIT_PATHS = new Set<string>([...])` in `auditMiddleware.ts` now (match `REDACT_PATHS` style). Don't over-design; if a config entry is needed later, promote the set to a settings.yaml array — trivial refactor.

4. **Request body size limit for the beacon**
   - What we know: `filter` payloads are ad-hoc JSON; existing GET beacon test (`tests/auditApi.test.ts:133-138`) uses `Array(20).fill('org-x')` — tiny.
   - What's unclear: No upper bound is specified in CONTEXT.md.
   - Recommendation: 16 KiB cap on `express.json({ limit: '16kb' })` — generous for a filter snapshot, cheap DoS protection.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All server code | ✓ | 22.22.0 [VERIFIED: `node --version`] | — |
| `node:crypto` | HMAC | ✓ | built-in | — |
| `better-sqlite3` | Audit DB | ✓ | 12.8.0 [VERIFIED: package.json] | — |
| `js-yaml` | Settings parse | ✓ | 4.1.1 [VERIFIED: package.json] | — |
| `vitest` + `supertest` + `jsdom` | Tests | ✓ | 4.1.4 / 7.2.2 / 29.0.2 | — |
| `config/settings.yaml` | Startup | ✓ | present | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (env: `node`; jsdom via per-file `// @vitest-environment jsdom` docblock) |
| Quick run command | `npm test -- tests/hashCohortId.test.ts tests/auditApi.test.ts tests/auditMiddleware.test.ts tests/OutcomesPage.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CRREV-01 | `hashCohortId(id)` is deterministic across calls with same secret | unit | `npm test -- tests/hashCohortId.test.ts -t "determinism"` | ❌ Wave 0 (new file) |
| CRREV-01 | `hashCohortId(id)` returns 16 hex chars | unit | `npm test -- tests/hashCohortId.test.ts -t "16 hex"` | ❌ Wave 0 |
| CRREV-01 | Different inputs produce different hashes | unit | `npm test -- tests/hashCohortId.test.ts -t "different inputs"` | ❌ Wave 0 |
| CRREV-01 | `initHashCohortId` throws if secret missing/too short | unit | `npm test -- tests/hashCohortId.test.ts -t "throws if secret missing"` | ❌ Wave 0 |
| CRREV-01 | POST `/api/audit/events/view-open` returns 204 | integration (supertest) | `npm test -- tests/auditApi.test.ts -t "returns 204"` | ✅ (extend existing describe) |
| CRREV-01 | POST beacon writes audit row with `cohortHash` (16 hex chars) and no raw id in body | integration (supertest + DB read) | `npm test -- tests/auditApi.test.ts -t "cohortHash"` | ✅ (extend) |
| CRREV-01 | Middleware does NOT write a duplicate row for the beacon path (skip-list works) | integration | `npm test -- tests/auditMiddleware.test.ts -t "skip-list"` | ✅ (extend) |
| CRREV-01 | GET to the old URL shape returns 404 (route removed) | integration | `npm test -- tests/auditApi.test.ts -t "GET returns 404"` | ✅ (repurpose existing line 140 test) |
| CRREV-01 | Client fires POST with JSON body, `keepalive: true`, `credentials: 'include'`, `Content-Type: application/json` | component (jsdom + fetch spy) | `npm test -- tests/OutcomesPage.test.tsx -t "audit beacon"` | ✅ (test 6; needs update) |
| CRREV-01 | `settings.yaml` schema validation rejects PUT with missing `audit.cohortHashSecret` when feature enabled (optional — see Open Question #4/6) | integration | `npm test -- tests/settingsApi.test.ts -t "cohortHashSecret"` | ✅ (extend, optional) |

### Sampling Rate
- **Per task commit:** `npm test -- tests/hashCohortId.test.ts tests/auditApi.test.ts tests/auditMiddleware.test.ts tests/OutcomesPage.test.tsx` (the four files touched by this phase)
- **Per wave merge:** `npm test` (full suite — must remain ≥ 313 passing)
- **Phase gate:** `npm test` green across the whole 27+1 file suite before `/gsd-verify-work`. v1.5 baseline is 313/313; Phase 10 may have added more. New Phase 11 tests must not regress existing counts.

### Wave 0 Gaps
- [ ] `tests/hashCohortId.test.ts` — new file, covers the unit tests for the utility (determinism, length, different-input, init-guard).
- [ ] `tests/auditApi.test.ts` — extensions (new `describe('POST /api/audit/events/view-open')` block; repurpose or delete existing GET describe block).
- [ ] `tests/auditMiddleware.test.ts` — extension (skip-list assertion for the beacon path).
- [ ] `tests/OutcomesPage.test.tsx` — update test 6 assertions to match new POST shape.
- [ ] Framework install: none needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Beacon inherits request auth via the middleware mount at `/api` (server/index.ts:188); no auth changes. |
| V3 Session Management | no | No session changes. `credentials: 'include'` preserves existing cookie behaviour. |
| V4 Access Control | yes | Route inherits authenticated-only access via `authMiddleware` mounted at `/api`. No role gating (any authenticated user can emit a view-open). |
| V5 Input Validation | yes | Validate POST body shape: `name` must be string; `cohortId` must be string if present; `filter` must be object-or-null if present. Reject oversize bodies via `express.json({ limit: '16kb' })`. |
| V6 Cryptography | yes | HMAC-SHA256 via Node `crypto` — never hand-roll. Secret is >= 32 chars from settings. |
| V7 Error Handling & Logging | yes | Audit log is the append-only trail. Do NOT log the raw `cohortId` anywhere (console, stack traces) — handler must extract it from body, pass to `hashCohortId`, and never re-stringify the input. |
| V8 Data Protection | yes | Hashed id is the stored representation of a quasi-identifier. Secret is fail-fast required and not client-exposed (no reflection to any /api/settings GET response that non-admins see — confirmed by `settingsApi.ts:79-87` which strips `otpCode`, `maxLoginAttempts`, `provider` for non-admins; the new key must be added to that strip list). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Identifier leak via URL (querystring → access logs / proxies / Referer) | Information Disclosure | Move identifier to request body (D-01). |
| Hash-then-guess (rainbow table / brute force over small id space) | Information Disclosure | HMAC with server-held secret (D-04, D-05). Attacker cannot compute `HMAC(secret, candidate_id)` without `secret`. |
| Duplicate audit rows (middleware + handler both write) | Integrity / Repudiation | Skip-list in middleware (D-10). Handler is sole writer. |
| Body parser stream consumption breaking downstream raw-stream routes | Availability | Scope `express.json()` to `/api/audit/events/view-open` only (Pattern 5). |
| Secret exposure to non-admins via GET /api/settings | Information Disclosure | Add `cohortHashSecret` to the non-admin field-strip list in `settingsApi.ts:82` (`const { otpCode, maxLoginAttempts, provider, cohortHashSecret, ...safe } = parsed`). |
| DoS via oversized beacon body | Availability | `express.json({ limit: '16kb' })` scoped to the route. |
| Request-body logging of the raw `cohortId` by any intermediate middleware | Information Disclosure | Skip-list check is the first statement in `res.on('finish')`, before body-capture logic runs. |

## Sources

### Primary (HIGH confidence)
- `server/auditApi.ts` (lines 1-115) — current beacon handler and append-only comment.
- `server/auditMiddleware.ts` (lines 1-154) — `REDACT_PATHS` pattern, body-capture ordering, request-finish write.
- `server/auditDb.ts` (lines 1-223) — `logAuditEntry` signature, `AuditDbRow`, `queryAudit`.
- `server/initAuth.ts` (lines 1-115) — module-level secret + init + getter pattern (direct template for `hashCohortId`).
- `server/settingsApi.ts` (lines 1-175) — YAML schema validator, non-admin field strip list.
- `server/index.ts` (lines 1-260) — startup sequence, scoped body-parser mounts.
- `server/constants.ts` (line 105) — `SETTINGS_FILE` resolution.
- `src/pages/OutcomesPage.tsx` (lines 85-94) — current client beacon call site.
- `tests/auditApi.test.ts` — supertest fixture pattern.
- `tests/auditMiddleware.test.ts` — mock logAuditEntry, res finish simulation.
- `tests/OutcomesPage.test.tsx` (lines 193-301) — fetch spy pattern, test 6 audit-beacon assertion.
- `tests/issueApi.test.ts` (lines 28-46) — supertest + express.json + req.auth injection fixture.
- `package.json` — dependency pinned versions.
- `vitest.config.ts` — test env configuration.

### Secondary (MEDIUM confidence)
- MDN Fetch API — `keepalive` RequestInit option behaviour (survives document unload, same-origin default).
- Node.js docs — `crypto.createHmac` FIPS-validated, constant-time.

### Tertiary (LOW confidence)
- [Node.js Undici fetch keepalive discussion](https://github.com/nodejs/undici/issues/2169) — historical note that undici's native fetch previously ignored the `keepalive` RequestInit flag; not load-bearing because tests stub `global.fetch`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive verified in the current repo via Read/Grep.
- Architecture: HIGH — all patterns copied from existing verified code.
- Pitfalls: HIGH — derived from direct reading of middleware and index.ts, not speculation.
- Hashing primitive details: HIGH — Node built-in.
- Hash length rationale: MEDIUM — A1 is reasonable but untested in this session.

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days — stable subsystem, no fast-moving dependencies)
