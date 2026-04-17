---
phase: 11-audit-beacon-pii-hardening
plan: 02
subsystem: server/audit
tags: [security, pii, audit, beacon, http]
dependency_graph:
  requires:
    - server/hashCohortId.ts (Plan 01 — HMAC-SHA256 primitive)
    - server/auditDb.ts (logAuditEntry, queryAudit)
    - server/auditMiddleware.ts (REDACT_PATHS pattern mirror)
  provides:
    - server/auditApi.ts :: POST /events/view-open handler (writes handler-own audit row with cohortHash)
    - server/auditMiddleware.ts :: SKIP_AUDIT_PATHS Set (first-statement skip-list inside res.on('finish'))
    - server/index.ts :: scoped express.json({ limit: '16kb' }) mount on /api/audit/events/view-open
  affects:
    - Plan 11-03 (client transport migration: fetch POST with JSON body)
    - Plan 11-03 (end-to-end verification: inspect audit.db rows for raw-id absence)
tech_stack:
  added: []
  patterns:
    - Sibling Set-based skip-list alongside REDACT_PATHS (middleware pattern extension)
    - Handler-written audit rows (bypass middleware for per-route hashed identifiers)
    - Scoped express.json() mount (per-path; preserves raw-stream consumers)
key_files:
  created: []
  modified:
    - server/auditApi.ts
    - server/auditMiddleware.ts
    - server/index.ts
    - tests/auditApi.test.ts
    - tests/auditMiddleware.test.ts
decisions:
  - D-10 honored: handler-written row replaces middleware-captured row for this path
  - D-11 honored: hashed id in body, NULL query, no raw id anywhere
  - D-08 honored: filter payload preserved verbatim without hashing
  - CRREV-01 server-side closed: raw cohort id absent from all new beacon rows
metrics:
  tasks_completed: 2
  tests_added: 9
  files_created: 0
  files_modified: 5
  completed_date: 2026-04-16
requirements: [CRREV-01]
---

# Phase 11 Plan 02: Audit Beacon POST + Hashed Cohort Id Summary

Flip `/api/audit/events/view-open` from GET to POST, make the handler the sole audit writer (hashed cohort id in body, never in URL), and install a middleware skip-list so the generic `auditMiddleware` does not double-write or capture the raw body.

## Files Modified

| Change   | Path                               | Purpose                                                                                                    |
| -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| modified | `server/auditMiddleware.ts`        | Added `SKIP_AUDIT_PATHS` Set alongside `REDACT_PATHS`; first-statement skip check inside `res.on('finish')` |
| modified | `server/auditApi.ts`               | Removed legacy GET /events/view-open; added POST handler that hashes cohortId and writes the audit row     |
| modified | `server/index.ts`                  | Scoped `express.json({ limit: '16kb' })` mount on `/api/audit/events/view-open` before `auditMiddleware`   |
| modified | `tests/auditApi.test.ts`           | Replaced GET describe block with POST describe block; added hashCohortId init in beforeEach                |
| modified | `tests/auditMiddleware.test.ts`    | Appended `SKIP_AUDIT_PATHS — handler-written rows` describe block (3 assertions)                           |

## Two-Layer Mitigation for T-11-01

### Layer 1 — middleware skip-list (`server/auditMiddleware.ts`)

```typescript
const SKIP_AUDIT_PATHS = new Set([
  '/api/audit/events/view-open',  // Phase 11: handler writes row with hashed cohortId
]);

res.on('finish', () => {
  const urlPath = req.originalUrl.split('?')[0];

  // Phase 11 / D-10 / T-11-01: skip paths whose handlers write their own audit row.
  // This check MUST precede body capture so the raw body is never read/serialised here.
  if (SKIP_AUDIT_PATHS.has(urlPath)) return;

  const duration = Date.now() - startMs;
  // ... existing body-capture / redact / logAuditEntry pipeline
});
```

Key property: the skip check is the **first executable statement** after `urlPath` is extracted. Nothing reads `req.body` for skipped paths — raw ids cannot leak into debug logs, stack traces, or the DB row.

Proof: `awk '/SKIP_AUDIT_PATHS.has/{skip=NR} /rawBody =/{body=NR} END{exit !(skip < body)}' server/auditMiddleware.ts` exits 0 (skip at line 133, body capture at line 147).

### Layer 2 — handler-side field selection (`server/auditApi.ts`)

```typescript
auditApiRouter.post('/events/view-open', (req: Request, res: Response): void => {
  const body = (req.body ?? {}) as { name?: unknown; cohortId?: unknown; filter?: unknown };
  const name = typeof body.name === 'string' ? body.name : 'unknown';
  const cohortHash = typeof body.cohortId === 'string' && body.cohortId.length > 0
    ? hashCohortId(body.cohortId)
    : null;
  const filter = body.filter !== undefined ? body.filter : null;

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

Key property: the JSON.stringify literal is `{ name, cohortHash, filter }` — **never** `cohortId`. Even if `req.body.cohortId` is held in a local, it is only read by `hashCohortId()` and never bound to any local that reaches the serialised audit row.

Negative assertion test: `expect(row.body).not.toContain('saved-search-xyz')` — the canonical raw-id marker is absent from `row.body` for every beacon row produced in tests.

## Test Count Added + Migrated

### Deleted (legacy GET describe block — 4 tests)

- `responds 204 with empty body when authenticated (user role)`
- `responds 204 for admin role too (no role gating)`
- `accepts oversized filter query string without rejection`
- `POST to same URL returns 404 (no write route exists)`

### Added (`tests/auditApi.test.ts` — 6 tests, new POST describe block)

- `responds 204 with empty body for an authenticated user`
- `writes audit row with cohortHash (16 hex) and NO raw cohortId anywhere (D-11 / T-11-01)`
- `records cohortHash: null when no cohortId is sent`
- `preserves filter payload verbatim without hashing (D-08)`
- `GET /api/audit/events/view-open returns 404 (legacy route removed)`
- `rejects body larger than 16 KiB with 413`

### Added (`tests/auditMiddleware.test.ts` — 3 tests, new SKIP_AUDIT_PATHS describe block)

- `skips POST /api/audit/events/view-open (no middleware-written row)`
- `still logs other /api/ paths (regression — skip-list does not over-reach)`
- `skip fires even when request body would contain a raw cohort id`

### Net test delta

- Migrated: 4 → 6 in `auditApi.test.ts` (+2 for hashed-beacon assertions that had no GET counterpart)
- Added: +3 in `auditMiddleware.test.ts`
- **Net +5 tests.** Full suite: **355/355 passing across 34 files** (baseline 350/34 from Plan 01 close).

## Threat Model Outcomes

| Threat ID | Disposition | Outcome                                                                                                                                                                                                                                                                  |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-11-01   | mitigated   | Two-layer mitigation. Middleware skip-list prevents middleware-written row and raw-body capture (Layer 1). Handler serialises only `{name, cohortHash, filter}` — no `cohortId` field reaches `audit_log.body` (Layer 2). Negative assertion locked in by test `row.body !.toContain('saved-search-xyz')`. |
| T-11-01 (URL variant) | mitigated | Legacy GET `/events/view-open` deleted. Test proves `GET /api/audit/events/view-open?cohort=abc` returns 404.                                                                                                                                                               |
| T-11-05   | mitigated   | Handler never passes `body.cohortId` to `console.log`, `JSON.stringify`, or error bodies. Only `hashCohortId(body.cohortId)` reads the raw id — and that closure doesn't leak the value back.                                                                                 |
| T-11-06   | mitigated   | `express.json({ limit: '16kb' })` scoped mount rejects oversized bodies with 413. Test `rejects body larger than 16 KiB with 413` verifies.                                                                                                                                   |
| T-11-07   | accepted    | Per Pattern 5 from RESEARCH.md — scoped mount, not global. `issueApi.test.ts` (raw-stream consumer) and `settingsApi.test.ts` (raw-stream consumer) continue to pass in the full-suite run: 355/355 green across 34 files.                                                     |

## Verification

### Automated

- `npm test -- tests/auditApi.test.ts tests/auditMiddleware.test.ts --run` → 26/26 green
- `npm test -- --run` → 355/355 green across 34 files (no regressions)

### Shell assertions

- `grep -q "SKIP_AUDIT_PATHS" server/auditMiddleware.ts` → OK
- `grep -q "auditApiRouter.post('/events/view-open'" server/auditApi.ts` → OK
- `grep -q "auditApiRouter.get('/events/view-open'" server/auditApi.ts` → legacy GET removed
- `grep -q "hashCohortId(body.cohortId)" server/auditApi.ts` → OK
- `grep -q "logAuditEntry({" server/auditApi.ts` → OK
- `grep -q "JSON.stringify({ name, cohortHash, filter })" server/auditApi.ts` → OK
- `grep -Ec "JSON.stringify\(\{[^}]*cohortId" server/auditApi.ts` → 0 (no `cohortId` field in any JSON literal)
- `grep -q "app.use('/api/audit/events/view-open', express.json({ limit: '16kb' }))" server/index.ts` → OK
- Ordering: skip-list check (line 133) precedes body capture (line 147) inside `res.on('finish')`

## Deviations from Plan

None — plan executed exactly as written. Action blocks applied verbatim:

- Middleware: skip-list added as sibling to REDACT_PATHS; urlPath extraction moved up; skip check is first executable statement after urlPath.
- Handler: GET deleted, POST added with exactly the JSON.stringify shape specified; no `cohortId` field in any body literal.
- Index wiring: scoped `express.json({ limit: '16kb' })` mounted before `auditMiddleware`.
- Test file updates: createApp mounts the same scoped parser; beforeEach resets + initialises `hashCohortId` with a 32-char secret; describe blocks match spec.

## Commits

| Phase     | Hash    | Message                                                                                  |
| --------- | ------- | ---------------------------------------------------------------------------------------- |
| Task 1 RED   | 69f7b61 | `test(11-02): add failing tests for SKIP_AUDIT_PATHS middleware skip-list`             |
| Task 1 GREEN | 6b5d371 | `feat(11-02): add SKIP_AUDIT_PATHS skip-list to auditMiddleware`                        |
| Task 2 RED   | e289cdb | `test(11-02): add failing tests for POST /api/audit/events/view-open beacon`           |
| Task 2 GREEN | 708ca95 | `feat(11-02): flip view-open beacon to POST with hashed cohort id`                     |

Four commits total (two TDD RED→GREEN pairs), all atop base `7dd8165` (Plan 01 close).

## Remaining Work for CRREV-01

Plan 11-03 (parallel wave) handles the **client transport migration**:

- Replace the browser-side beacon call from `fetch('/api/audit/events/view-open?...')` (GET) with `fetch('/api/audit/events/view-open', { method: 'POST', body: JSON.stringify({name, cohortId, filter}), headers: { 'Content-Type': 'application/json' } })`.
- Any request-retry / Beacon-API fallback needs to be updated to emit POST with a JSON body.
- End-to-end verification: open a saved-search in `/outcomes`, inspect `audit.db`, confirm the beacon row has `method=POST`, `query=NULL`, and `body.cohortHash` matches `/^[0-9a-f]{16}$/` with no raw id.

With Plan 11-02 merged the server rejects the legacy GET with 404 — so **Plan 11-03 must ship before any client that relies on the GET transport**, or view-open events are silently lost. This sequencing matches the phase wave plan.

## Self-Check: PASSED

- `server/auditMiddleware.ts` — FOUND (modified)
- `server/auditApi.ts` — FOUND (modified)
- `server/index.ts` — FOUND (modified)
- `tests/auditMiddleware.test.ts` — FOUND (modified)
- `tests/auditApi.test.ts` — FOUND (modified)
- Commit `69f7b61` — FOUND
- Commit `6b5d371` — FOUND
- Commit `e289cdb` — FOUND
- Commit `708ca95` — FOUND
- `npm test -- tests/auditApi.test.ts tests/auditMiddleware.test.ts --run` — 26/26 green
- `npm test -- --run` — 355/355 green across 34 files (no regressions; baseline 350/34)
