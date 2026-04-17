# Phase 12: Server-Side Outcomes Pre-Aggregation — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 12-server-side-outcomes-pre-aggregation
**Mode:** `--auto` (single pass, recommended options auto-selected)
**Areas discussed:** Code sharing, Cache backend, Cache invalidation, Threshold configuration, Response shape, Response compression, Auth gate, Audit event

---

## Code Sharing (client ↔ server)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep in `src/utils/`, server imports via tsconfig path alias | Simplest file move, relies on build-time path magic | |
| Promote to `shared/cohortTrajectory.ts`, both sides import | Single source of truth, byte-parity by construction | ✓ |
| Duplicate code on server; guard with round-trip test | Easy to start, drift-prone; rejected by AGG-02 spirit | |

**User's choice:** Option B (auto-recommended).
**Notes:** AGG-02 demands byte-identical output. A shared module is the only option that enforces parity by construction. Path alias approach has surprise-bug potential at build time. Duplication is the classic source of production-vs-dev drift.

---

## Endpoint Contract

| Option | Description | Selected |
|--------|-------------|----------|
| `POST /api/outcomes/aggregate`, JSON body with flags | Matches AGG-01 spec; scoped express.json + compression | ✓ |
| `GET /api/outcomes/aggregate?...` | Cachable via browser, but cohort id in URL (CRREV-01 regression) | |
| `WebSocket /ws/outcomes` | Streaming; overkill, adds runtime surface | |

**User's choice:** Option A (auto-recommended).
**Notes:** POST keeps cohort id out of URL — consistent with Phase 11 CRREV-01 mitigation. AGG-01 spec explicitly calls for POST.

---

## Response Shape (`perPatient` / `scatter`)

| Option | Description | Selected |
|--------|-------------|----------|
| Always include all series | Simple, but defeats the purpose for 1000+ cohorts | |
| Opt-in via `includePerPatient` / `includeScatter` flags | Client only requests what the visible layer needs | ✓ |
| Never include — client fetches separately | Extra round trips; loses cache coherence | |

**User's choice:** Option B (auto-recommended).
**Notes:** Visual layers (per-patient, scatter) are toggleable in the UI settings drawer. The server should mirror that toggle — send what's visible, skip what's not.

---

## Auth Gate Posture

| Option | Description | Selected |
|--------|-------------|----------|
| Handler reads `req.auth.centers`, applies filter | Centralized enforcement at the point of use | ✓ |
| Middleware + handler double-check | Belt and suspenders; marginal benefit | |
| Trust client-sent `centers` field | Forbidden per security-first MEMORY.md rule | |

**User's choice:** Option A (auto-recommended).
**Notes:** authMiddleware already validates JWT and populates `req.auth`. Handler-level enforcement keeps the filter close to the cohort lookup. Ignoring any body-sent `centers` field is enforced in the handler itself.

---

## Cache Backend

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory `Map<key, { result, expires }>` with TTL | Zero new dependencies, fast, loses on restart | ✓ |
| Disk JSON cache under `data/aggregate-cache/` | Survives restart, slower, I/O complexity | |
| ETag + `Cache-Control` (browser-side) | No server state, but invalidation opaque to browser | |

**User's choice:** Option A (auto-recommended).
**Notes:** Demonstrator scope — process restart is a clean-slate event. Survives the session. Disk I/O adds complexity without correctness win. ETag alone can't reflect cohort mutation without extra plumbing on the client.

---

## Cache Invalidation

| Option | Description | Selected |
|--------|-------------|----------|
| TTL only (30 min default) | Simple, stale on cohort mutation | |
| Explicit invalidation on cohort mutation + TTL safety net | Correct on mutation, robust to missed hooks | ✓ |
| Version tag per cohort in cache key | Correct but requires plumbing through saved-search layer | |

**User's choice:** Option B (auto-recommended).
**Notes:** Mirrors Phase 11's two-layer mitigation pattern (SKIP_AUDIT_PATHS + handler field selection). Explicit hook is correct; TTL is the safety net.

---

## Threshold Configuration Location

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded constant | Simple, but not runtime-adjustable | |
| `config/settings.yaml` under `outcomes:` | Matches MEMORY.md "settings.yaml, no env vars" | ✓ |
| Environment variable | Rejected per MEMORY.md no-env-vars rule | |
| Per-user URL override | Feature creep | |

**User's choice:** Option B (auto-recommended).
**Notes:** Single source of truth: `config/settings.yaml`. Admins can tune via PUT /api/settings. Values are non-sensitive — no strip needed.

---

## Response Compression

| Option | Description | Selected |
|--------|-------------|----------|
| Express `compression()` middleware (gzip/deflate), route-scoped | Standard, route-scoped like Phase 11 body parser | ✓ |
| Brotli-only | Better compression, more deps | |
| No compression | Wasteful for 1000+ patient cohorts | |

**User's choice:** Option A (auto-recommended).
**Notes:** Mount on `/api/outcomes/aggregate` only — scoped middleware precedent from Phase 11. Don't compress raw-stream consumers (`issueApi`, `settingsApi`).

---

## Audit Event (AGG-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Handler-own row, `SKIP_AUDIT_PATHS` skip middleware, `hashCohortId` | Phase 11 pattern applied verbatim | ✓ |
| Middleware-written row with body redaction | Doesn't have access to the hashed id at write time | |
| No audit event (rely on generic middleware) | Raw cohort id would leak into body | |

**User's choice:** Option A (auto-recommended).
**Notes:** This is the central reuse of Phase 11 (as ROADMAP dependency note states). Add `/api/outcomes/aggregate` to `SKIP_AUDIT_PATHS`, handler calls `logAuditEntry({ name: "outcomes.aggregate", cohortHash: hashCohortId(cohortId), user, centers, payloadBytes, cacheHit })`.

---

## Claude's Discretion

- Specific compression library package (`compression` from npm, standard choice).
- `meta.cacheHit` plumbing location (handler vs cache wrapper).
- Handler operation order within the security envelope.

## Deferred Ideas

- Persistent / disk-backed cache (Phase 12+).
- Streaming / NDJSON response (Phase 12+).
- Client-side cache warming.
- Aggregation support for metrics beyond Visus — owned by Phase 13.
- Rate limiting on the aggregate endpoint.
