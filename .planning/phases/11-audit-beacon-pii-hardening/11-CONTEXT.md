# Phase 11: Audit Beacon PII Hardening - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Cohort identifiers stop leaking into audit URLs. The view-open beacon is refactored so (a) no cohort id appears in the request URL or querystring, (b) the audit row records the cohort reference as a hashed id in the event payload, and (c) a reusable `hashCohortId(id)` utility is established and unit-tested so Phase 12's AGG-05 audit event can reuse it without duplication.

Out of scope: new audit capabilities, audit export changes, `filter` payload semantics beyond moving it off the URL, retroactive backfill of existing audit rows.

</domain>

<decisions>
## Implementation Decisions

### Transport (how cohort reference reaches the server)
- **D-01:** Switch `/api/audit/events/view-open` from `GET` to `POST`. Client sends JSON body `{ name, cohortId?, filter? }`. No cohort or filter in the URL.
- **D-02:** Client uses `fetch('/api/audit/events/view-open', { method: 'POST', body: JSON.stringify(...), keepalive: true, credentials: 'include' })` — not `navigator.sendBeacon`. Keepalive survives unload, stays testable in jsdom, and allows standard `Content-Type: application/json` header.
- **D-03:** The beacon remains fire-and-forget — the handler continues to respond 204 and the client discards errors.

### Hashing primitive
- **D-04:** `hashCohortId(id)` uses HMAC-SHA256 via Node's `crypto.createHmac('sha256', secret).update(id).digest('hex')`, truncated to **16 hex chars (64 bits)** before storage.
- **D-05:** HMAC secret sourced from `settings.yaml` under a new key (name to be picked by planner, e.g. `audit.cohort_hash_secret`). No env vars, no client exposure, no hardcoded fallback — missing secret is a startup error.
- **D-06:** Determinism lock: same (secret, id) MUST produce same hash across process restarts. No per-process salt, no time-based inputs.
- **D-07:** Utility lives in server code (planner decides exact path, e.g. `server/hashCohortId.ts`) and is exported for AGG-05 (Phase 12) reuse without modification.

### filter parameter treatment
- **D-08:** Move `filter` payload off the URL into the same POST body alongside cohortId. No hashing — filter is an ad-hoc criteria snapshot, not an identifier. D-11 middleware body redaction does NOT apply here (see D-11 below).

### Audit write path
- **D-09:** Beacon handler is the audit row writer. It computes `cohortHash` via `hashCohortId(cohortId)`, constructs the event payload `{ name, cohortHash, filter }`, calls `logAuditEntry()` directly, then returns 204.
- **D-10:** The audit middleware MUST skip-list `POST /api/audit/events/view-open` so it does not write a duplicate row or log the raw request body. Planner defines the skip-list mechanism (config entry or path match).
- **D-11:** Raw `cohortId` is never written to `audit_log.body` or `audit_log.query`. Unit test seeds a cohort, fires the beacon, reads the audit DB row, asserts `cohortHash` present AND raw id absent.

### Historical audit data
- **D-12:** Existing audit_log rows containing raw cohort ids in the query field are left untouched. Append-only principle (D-13 / AUDIT-05) preserved. Only new rows use the hashed form.

### Claude's Discretion
- Exact settings.yaml key name for the HMAC secret
- Exact path of the hash utility module
- Skip-list mechanism shape in middleware (path constant vs config list)
- Whether to expose a small convenience wrapper (e.g., `hashCohortIdFromRequest(req)`) for AGG-05 reuse — planner decides based on shape of Phase 12 work

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` §CRREV-01 — The requirement this phase closes
- `.planning/ROADMAP.md` §"Phase 11: Audit Beacon PII Hardening" — Phase goal + success criteria
- `.planning/ROADMAP.md` §"Phase 12: Server-Side Outcomes Pre-Aggregation" §AGG-05 — Downstream consumer of `hashCohortId`

### Existing audit subsystem (read before touching)
- `server/auditApi.ts` (lines 88–107) — Current `GET /api/audit/events/view-open` handler
- `server/auditMiddleware.ts` — Request/response audit capture, D-11 body redaction, REDACT_PATHS mechanism
- `server/auditDb.ts` (lines 70–104) — audit_log schema (id, timestamp, method, path, user, status, duration_ms, body, query) and `logAuditEntry` interface
- `src/pages/OutcomesPage.tsx` (lines 85–94) — Client beacon call site that must change from GET to POST

### Prior decisions to honor
- OUTCOME-11 / D-32 (referenced in auditApi.ts:90) — Original beacon design intent
- D-11 (auditMiddleware.ts:7,122) — "Mutations log (redacted) body; GETs log query params only" — This beacon becomes a mutation but is NOT a standard redact-on-middleware case because the handler writes its own row
- D-13 / AUDIT-05 — Audit log is append-only from server's perspective
- D-14 (auditDb.ts:75) — audit_log schema

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/auditDb.ts` `logAuditEntry()` — already used by middleware; beacon handler calls it directly
- `settings.yaml` loader (config system) — provides secret
- Node built-in `crypto` — no new dependencies needed for HMAC-SHA256

### Established Patterns
- Audit writes go through `logAuditEntry()` (single writer function)
- Redaction uses a path allow-list in middleware (`REDACT_PATHS`) — analogous skip-list pattern for this beacon
- Settings live in `settings.yaml`, loaded once at startup; missing required keys crash startup (fail-fast)

### Integration Points
- Client: one `fetch()` call site in `src/pages/OutcomesPage.tsx`
- Server: one handler in `server/auditApi.ts` + one middleware skip-list entry in `server/auditMiddleware.ts` + new `server/hashCohortId.ts` utility
- Test harness: `tests/auditApi.test.ts` (existing) — extend with view-open POST test; new `tests/hashCohortId.test.ts` for utility determinism

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose recommendations across Transport, Hash primitive, filter treatment, Backfill, Beacon style, Hash length, and Audit write path — security-first defaults accepted cleanly.
- `hashCohortId` must be drop-in reusable for AGG-05 in Phase 12 — no Phase-11-specific coupling in its interface.
- No dark-mode / theming concerns; purely server-side PII hardening with one client transport change.

</specifics>

<deferred>
## Deferred Ideas

- Retroactive migration / redaction of existing audit_log rows (explicitly out of scope — append-only preserved)
- Client-side hashing with server-provided salt (rejected: violates security-first / no-client-trust rule)
- Symmetric hashing of `filter` payload (rejected: filter is criteria, not identifier)
- `navigator.sendBeacon` adoption (deferred: fetch+keepalive is equivalent for our needs and more testable)
- Full 256-bit hash storage (deferred: 64 bits is collision-resistant for cohort-id space)

</deferred>

---

*Phase: 11-audit-beacon-pii-hardening*
*Context gathered: 2026-04-16*
