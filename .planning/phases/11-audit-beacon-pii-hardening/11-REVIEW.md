---
status: issues_found
phase: 11-audit-beacon-pii-hardening
depth: standard
files_reviewed: 12
findings:
  critical: 0
  warning: 0
  info: 10
  total: 10
reviewed: 2026-04-16
reviewer: gsd-code-reviewer
---

# Phase 11: Code Review Findings

**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found (all Info-level)

## Summary

All four critical invariants are correctly implemented:

1. **`hashCohortId`** (`server/hashCohortId.ts`) — HMAC-SHA256 with 16-hex truncation (D-04), fail-fast init on missing/short secret (T-11-03), deterministic across restarts (D-06). Secret sourced from `settings.audit.cohortHashSecret`, never logged.
2. **Audit beacon** (`server/auditApi.ts:114-135`) — POST handler hashes cohort id via `hashCohortId()` before calling `logAuditEntry`. `express.json({ limit: '16kb' })` is correctly scoped to `/api/audit/events/view-open` only (`server/index.ts:190`), preserving the raw stream for `issueApi` and `settingsApi` (which use `readBody()` on the raw stream per `server/utils.ts:12` and `server/settingsApi.ts:159`).
3. **Middleware skip-list** (`server/auditMiddleware.ts:131-133`) — `SKIP_AUDIT_PATHS.has(urlPath)` is the FIRST statement inside `res.on('finish')` after computing `urlPath`, returning before any body capture. Tests `auditMiddleware.test.ts:191-204` verify no body capture even when a raw cohort id is present.
4. **Client beacon** (`src/pages/OutcomesPage.tsx:90-111`) — POST with `keepalive: true`, JSON `Content-Type`, body carries `cohortId` + `filter` (no querystring). Covered by tests 6, 6b, 6c, 6d.

Settings GET strip-path correctly removes `audit.cohortHashSecret` for non-admins while preserving other audit fields (`server/settingsApi.ts:83-90`, test T-11-04). No Critical or Warning issues found. A handful of low-value observations follow.

## Critical Issues

None.

## Warnings

None.

## Info

### IN-01: `cohortId` body field not bounded — large strings hashed to O(n) cost

**File:** `server/auditApi.ts:117-119`
**Issue:** `hashCohortId(body.cohortId)` is called unconditionally on any string body value shorter than the 16 KiB body cap. A well-formed request could submit a ~16,000-char `cohortId` string; HMAC still completes quickly, but the subsequent 16-hex hash is indistinguishable from a 10-char saved-search id. This is not a security bug (HMAC output is fixed-size), just a missing input-shape check that would fail loudly rather than silently hash oversized input.
**Fix:** Optional — add a sanity bound such as `body.cohortId.length <= 128` before hashing; reject with 400 otherwise. Not required for CRREV-01 success criteria.

### IN-02: `filter` is stored verbatim in audit row — relies on caller discipline

**File:** `server/auditApi.ts:120, 130`
**Issue:** Per D-08 the filter payload is intentionally stored as-is. A caller could, however, embed PII-shaped strings (e.g. patient identifiers) inside the filter object and they would be persisted unredacted. The current design documents this as accepted (see test "preserves filter payload verbatim"), but there is no depth/size bound on the filter itself beyond the 16 KiB JSON cap.
**Fix:** Document the trust boundary in a JSDoc note on the handler ("filter fields are stored verbatim; callers must not include PII"). Consider a shallow field-allowlist in a later phase if the filter taxonomy stabilises.

### IN-03: eslint-disable for exhaustive-deps hides a re-fire edge case

**File:** `src/pages/OutcomesPage.tsx:111`
**Issue:** The beacon `useEffect` uses `[]` with `eslint-disable-next-line react-hooks/exhaustive-deps`. This is intentional (fire once per mount, D-03), but if `searchParams` changes in-place (same route, different cohort id via client nav) the beacon would not re-fire. That matches current spec — comment clarifies intent — but the dependency array does not include `searchParams`, so readers have no signal that the design is deliberate.
**Fix:** Strengthen the inline comment from "fire-and-forget" to explicitly state "fires exactly once per mount — same-route cohort switches do NOT retrigger (by design, per D-03)."

### IN-04: `unknown` narrowing for `body.cohortId` also accepts empty string after `.length > 0` guard

**File:** `server/auditApi.ts:117`
**Issue:** `typeof body.cohortId === 'string' && body.cohortId.length > 0` correctly drops empty strings, but a whitespace-only string (`"   "`) would still be hashed. Not a bug — resulting hash is simply the HMAC of that whitespace — but could yield a spurious "cohort id seen" row.
**Fix:** Optional: `body.cohortId.trim().length > 0` if semantic cleanliness matters. Low impact.

### IN-05: Duplicate `audit` destructure names in `settingsApi.ts` reads awkwardly

**File:** `server/settingsApi.ts:82-90`
**Issue:** The destructure renames `audit` to `_audit`, then reassigns it via `(safe as Record<string, unknown>).audit = safeAudit`. The cast-through-`Record` and the underscore prefix suggest the original name was avoided to silence unused-var lint. This works correctly (tests T-11-04 pass), but the control flow is slightly tangled: it reads and sometimes re-adds the same key under a different alias.
**Fix:** Consider a small helper for clarity:
```ts
function stripSensitiveAudit(audit: unknown): Record<string, unknown> | undefined {
  if (!audit || typeof audit !== 'object') return undefined;
  const { cohortHashSecret: _c, ...rest } = audit as Record<string, unknown>;
  return Object.keys(rest).length > 0 ? rest : undefined;
}
```
Purely cosmetic.

### IN-06: Stale comment in `auditMiddleware.ts` references "globally" scoped json()

**File:** `server/auditMiddleware.ts:11`
**Issue:** Comment reads "Plan 03 (wiring) adds express.json() globally." — this contradicts the current `server/index.ts:182-190` design where `express.json()` is deliberately NOT global (scoped to /api/auth, /api/data, /api/audit/events/view-open, /api/issues, /api/fhir). A future reader could be misled into adding a global parser, which would break `issueApi`/`settingsApi` raw-stream consumers.
**Fix:**
```ts
// - Review concern #4 (HIGH): Requires express.json() (or readBody() via _capturedBody)
//   to populate req.body. index.ts mounts express.json() scoped to specific routes
//   (NOT global) because issueApi and settingsApi consume the raw stream via readBody().
```

### IN-07: `tests/auditApi.test.ts` uses global `crypto` without import

**File:** `tests/auditApi.test.ts:33, 44, 55`
**Issue:** `crypto.randomUUID()` relies on Node 20+ global `crypto`. No `import crypto from 'node:crypto'` at the top. Runs today (Node 20+ exposes `globalThis.crypto`), but is inconsistent with `server/auditApi.ts:13` and `server/auditMiddleware.ts:18` which both import explicitly.
**Fix:** Add `import crypto from 'node:crypto';` near the existing imports for consistency and to avoid surprises on older Node.

### IN-08: `tests/settingsApi.test.ts` mock YAML hardcodes cohortHashSecret <32 chars check

**File:** `tests/settingsApi.test.ts:17, 33`
**Issue:** The test fixture contains `cohortHashSecret: "test-cohort-hash-secret-32-chars-min-xxxx"` — count: 41 chars, fine. Flagging only because it's not obvious at a glance that the literal is ≥32 and silently drifting below 32 would flip admin PUT tests into 400s (if PUT added a secret-length check in a later phase). Not a current bug.
**Fix:** Add a one-line comment `// >=32 chars to satisfy hashCohortId init` next to the literal.

### IN-09: OutcomesPage beacon lacks test for the Content-Length / keepalive upper bound

**File:** `tests/OutcomesPage.test.tsx` (whole file)
**Issue:** Tests 6/6b/6c/6d cover happy-path body shape and malformed-filter handling. The server enforces a 16 KiB cap (`server/index.ts:190` and test auditApi "rejects body larger than 16 KiB with 413"), but no test proves the client beacon stays under that cap for a reasonable ad-hoc filter. Useful, not required.
**Fix:** Optional: a test that constructs a 32 KiB `?filter=` value and asserts the client still POSTs (server rejects — client beacon swallows the error per D-03).

### IN-10: Handler-written row timestamp uses `new Date().toISOString()` without duration

**File:** `server/auditApi.ts:129`
**Issue:** `duration_ms: 0` is hardcoded on the handler-written row. Middleware-written rows capture true duration via `Date.now() - startMs`. Zero is semantically accurate ("no measurable processing") but visually distinguishes handler-written rows from middleware-written ones in audit queries — ops staff filtering by `duration_ms > 0` would miss these rows. Acceptable by design (D-03 fire-and-forget) but worth calling out for future dashboarding work.
**Fix:** Document the convention in a JSDoc comment on the handler: `// duration_ms=0 is the sentinel for handler-written rows (no middleware timing available)`.

---

## Files Reviewed

- config/settings.yaml
- server/auditApi.ts
- server/auditMiddleware.ts
- server/hashCohortId.ts
- server/index.ts
- server/settingsApi.ts
- src/pages/OutcomesPage.tsx
- tests/OutcomesPage.test.tsx
- tests/auditApi.test.ts
- tests/auditMiddleware.test.ts
- tests/hashCohortId.test.ts
- tests/settingsApi.test.ts

## Invariant Verification Trail

1. **hashCohortId fail-fast** — `server/hashCohortId.ts:28-32` throws if secret missing or `< 32` chars. Test `hashCohortId.test.ts:37-45` covers both missing and too-short cases. PASS.
2. **Secret from settings.yaml, not env** — `server/hashCohortId.ts:26-27` reads `settings.audit.cohortHashSecret`; no `process.env` reference. `settings.yaml:13-14` carries the dev default. PASS.
3. **Secret stripped for non-admin GET** — `server/settingsApi.ts:82-90` destructures `audit` out, strips `cohortHashSecret`, re-adds remaining audit fields. Test `settingsApi.test.ts:73-93` verifies both admin (preserved) and non-admin (stripped) paths. PASS.
4. **POST beacon is SOLE audit writer** — `server/auditMiddleware.ts:49-51` adds `/api/audit/events/view-open` to `SKIP_AUDIT_PATHS`; `server/auditMiddleware.ts:131-133` skips before body capture. Test `auditMiddleware.test.ts:168-204` verifies zero middleware rows for this path. PASS.
5. **Cohort id hashed before persistence** — `server/auditApi.ts:117-130` computes `cohortHash` via `hashCohortId()` and stores only the hash; raw `cohortId` never reaches `logAuditEntry`. Test `auditApi.test.ts:133-158` asserts `row.body` does NOT contain the raw id. PASS.
6. **express.json scoped** — `server/index.ts:184, 185, 190, 203, 215` show scoped mounts only; no `app.use(express.json())` at global scope. `server/settingsApi.ts:159` and `server/issueApi.ts:140` use `readBody()` on the raw stream — would break if a global parser consumed it. PASS.
7. **SKIP_AUDIT_PATHS as first statement** — `server/auditMiddleware.ts:127-133` shows `res.on('finish')` body: `urlPath` derivation (cheap string split, no body read) then `SKIP_AUDIT_PATHS.has(urlPath)` return. Body/query capture happens only after. PASS.
8. **Client POST + keepalive + JSON + no URL id** — `src/pages/OutcomesPage.tsx:102-110` POSTs to `/api/audit/events/view-open` with `keepalive: true`, JSON header, body carrying `cohortId` and `filter`. Tests 6/6b/6c/6d cover URL absence of cohort id, body shape, malformed-filter, and empty-params cases. PASS.
