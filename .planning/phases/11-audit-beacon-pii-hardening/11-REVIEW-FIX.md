---
phase: 11-audit-beacon-pii-hardening
fixed_at: 2026-04-16
review_path: .planning/phases/11-audit-beacon-pii-hardening/11-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 9
skipped: 1
status: partial
---

# Phase 11: Code Review Fix Report

**Fixed at:** 2026-04-16
**Source review:** `.planning/phases/11-audit-beacon-pii-hardening/11-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (0 Critical, 0 Warning, 10 Info)
- Fixed: 9
- Skipped: 1 (IN-09 — optional test-only by reviewer designation)
- Full test suite after fixes: **358/358 passing**

## Fixed Issues

### IN-01: `cohortId` body field not bounded

**Files modified:** `server/auditApi.ts`
**Commit:** `367257f`
**Applied fix:** Added a 128-char upper bound on `body.cohortId` in the POST `/api/audit/events/view-open` handler. Requests with `cohortId.length > 128` now return 400 before reaching `hashCohortId()`. Saved-search ids are UUID-like and fit well under this cap.

### IN-02: `filter` stored verbatim — caller discipline trust boundary

**Files modified:** `server/auditApi.ts`
**Commit:** `b917912`
**Applied fix:** Added a JSDoc "Trust boundary" paragraph on the view-open handler making explicit that `filter` is persisted VERBATIM and callers MUST NOT embed PII. Also noted that a field allowlist may arrive in a later phase once the filter taxonomy stabilises.

### IN-03: eslint-disable hides re-fire edge case

**Files modified:** `src/pages/OutcomesPage.tsx`
**Commit:** `aabab23`
**Applied fix:** Expanded the inline comment block above the beacon `useEffect` to make the "fire exactly once per mount — same-route cohort switches do NOT retrigger" invariant explicit, and noted the contract for any future maintainer who wants to change the dependency array.

### IN-04: `length > 0` accepts whitespace-only cohortId

**Files modified:** `server/auditApi.ts`
**Commit:** `71006fd`
**Applied fix:** Replaced `body.cohortId.length > 0` with `body.cohortId.trim().length > 0` so whitespace-only strings no longer produce spurious HMAC rows. Added an inline comment tagging the finding.

### IN-05: Extract `stripSensitiveAudit` helper

**Files modified:** `server/settingsApi.ts`
**Commit:** `36e9e4e`
**Applied fix:** Extracted the tangled destructure / re-assign block into a pure `stripSensitiveAudit(audit)` helper that returns the remaining audit fields (or `undefined`). The GET handler now reads `const safeAudit = stripSensitiveAudit(rawAudit)` and assigns only when non-empty. All 10 settingsApi tests still pass (T-11-04 admin + non-admin paths).

### IN-06: Stale "express.json() globally" comment

**Files modified:** `server/auditMiddleware.ts`
**Commit:** `77bdd05`
**Applied fix:** Rewrote the stale comment to reflect the current design: `express.json()` is deliberately scoped to specific routes (NOT global) because `issueApi` and `settingsApi` consume the raw stream via `readBody()`. This matches the reviewer's suggested wording.

### IN-07: `tests/auditApi.test.ts` uses global `crypto` without import

**Files modified:** `tests/auditApi.test.ts`
**Commit:** `0d9692c`
**Applied fix:** Added `import crypto from 'node:crypto';` near the existing imports for consistency with `server/auditApi.ts:13` and `server/auditMiddleware.ts:18`. All 13 auditApi tests still pass.

### IN-08: `cohortHashSecret` mock length not self-documenting

**Files modified:** `tests/settingsApi.test.ts`
**Commit:** `24ef0a0`
**Applied fix:** Added a block comment above the `vi.mock('node:fs', ...)` call plus inline `// >=32 chars to satisfy hashCohortId init` markers next to both the mocked-YAML and `VALID_YAML` literals. Future edits that drop the length below 32 will be caught at review time.

### IN-10: `duration_ms=0` sentinel on handler-written rows

**Files modified:** `server/auditApi.ts`
**Commit:** `e70bad1`
**Applied fix:** Added a "Timing convention" paragraph to the view-open handler JSDoc explaining that `duration_ms: 0` is a SENTINEL for handler-written rows (no middleware timing available) and that dashboards filtering on `duration_ms > 0` will exclude these rows by design.

## Skipped Issues

### IN-09: No test for Content-Length / keepalive upper bound on client beacon

**File:** `tests/OutcomesPage.test.tsx` (whole file)
**Reason:** Skipped per explicit workflow instruction. The REVIEW.md itself classifies this as "Useful, not required" and notes it is an optional test-only addition with marginal value over the existing 6/6b/6c/6d coverage plus the server-side 413 test in `auditApi.test.ts`. The server 16 KiB cap is already verified; adding a synthetic 32 KiB client-side payload test was judged low-value against commit-log noise for this phase.
**Original issue:** Tests 6/6b/6c/6d cover happy-path body shape and malformed-filter handling, but no test proves the client beacon stays under the server's 16 KiB cap for a reasonable ad-hoc filter. The reviewer's suggested test would construct a 32 KiB `?filter=` value and assert the client still POSTs (server rejects — client beacon swallows per D-03).

---

## Verification

- Per-fix: syntax check via `npx tsc --noEmit -p tsconfig.server.json` for server files (no new errors in modified files; 3 pre-existing errors in `server/authApi.ts` are unrelated and predate this phase).
- Per-fix: targeted `npx vitest run <test-file>` after IN-05, IN-07, IN-08.
- Final: `npx vitest run` — **34 test files, 358/358 tests passing**.

---

_Fixed: 2026-04-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
