---
phase: 21-test-uat-polish
reviewed: 2026-04-23T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - tests/outcomesPanelCrt.test.tsx
  - src/components/outcomes/OutcomesView.tsx
  - scripts/check-skipped-tests.mjs
  - tests/setup.ts
  - tests/authFetchRefreshSuite.test.ts
  - tests/authFetchRefresh.test.ts
  - server/auditMiddleware.ts
  - vitest.config.ts
  - tests/sessionTimers.test.tsx
  - src/context/AuthContext.tsx
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-04-23
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 21 (Test & UAT Polish) ships automation for Phase 20 UAT items 1–5 plus a
CRT y-domain regression guard and a CI skip-test gate. Production changes are
appropriately minimal: `credentials: 'include'` added to the view-open beacon
and two test-hook constants exported (`INACTIVITY_TIMEOUT`, `SKIP_AUDIT_IF_STATUS`).

No critical bugs or security issues found. The new test suites are carefully
scoped — the per-file `vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)`
pattern in `authFetchRefreshSuite.test.ts` correctly overrides Node 18+ native
BroadcastChannel (which does not deliver cross-instance messages in-process),
matching the documented RESEARCH Assumption A2.

One warning: the exported `SKIP_AUDIT_IF_STATUS` record is mutable at runtime
(callers can mutate nested Sets), which weakens the regression guard intent.
The rest of the findings are informational — minor robustness / consistency
notes.

## Warnings

### WR-01: Exported `SKIP_AUDIT_IF_STATUS` is mutable (can be modified by callers)

**File:** `server/auditMiddleware.ts:88-90`
**Issue:** The exported record and its Set values are fully mutable at runtime.
A caller (test or otherwise) could call
`SKIP_AUDIT_IF_STATUS['/api/auth/refresh'].add(401)`, which would silently
defeat the T-20-21 repudiation guard (failed refresh attacks must remain
audited). Because the export doubles as a regression-guard surface per the
UAT-AUTO-03 test (`tests/authFetchRefreshSuite.test.ts:140-143`), mutating it
from another test would leak across files and break the invariant the test
claims to enforce.

**Fix:** Freeze both the outer record and each Set. `readonly` on the type is
compile-time only; also freeze at runtime:

```ts
export const SKIP_AUDIT_IF_STATUS: Readonly<Record<string, ReadonlySet<number>>> = Object.freeze({
  '/api/auth/refresh': new Set([200]),
});
// Note: Set.add() on a frozen wrapper still mutates internal state; to fully
// lock it, wrap as ReadonlySet and assign via a factory that returns a
// proxy, or simply accept the compile-time `ReadonlySet<number>` contract
// and rely on TS to prevent accidental mutation in-repo.
```

At minimum, add a comment at the export site warning that the Set contents
are part of the T-20-19 / T-20-21 audit contract and must not be mutated.

## Info

### IN-01: `/api/auth/users/me` fetch in AuthContext bypasses authFetch silent-refresh

**File:** `src/context/AuthContext.tsx:126-128`
**Issue:** The display-name fetch uses raw `fetch()` rather than `authFetch()`,
so a 401 from this endpoint will not trigger silent refresh. Pre-existing
(not introduced by Phase 21), but noted because Phase 21 strengthens the
silent-refresh contract — divergent call sites weaken the contract's coverage.

**Fix:** Consider migrating to `authFetch` in a follow-up, or document
explicitly that display-name fetch is best-effort and a 401 here is harmless
because all authorization decisions are server-side.

### IN-02: `scripts/check-skipped-tests.mjs` walks symlinks without guard

**File:** `scripts/check-skipped-tests.mjs:8-16`
**Issue:** `statSync` follows symlinks by default. A symlink loop under
`tests/` would cause an infinite recursion / stack overflow. Low risk in
practice (tests/ doesn't contain symlinks today), but a 5-line hardening is
cheap.

**Fix:** Use `lstatSync` and skip symlinks, or use `fs.readdirSync(dir, { withFileTypes: true })` and check `dirent.isSymbolicLink()`.

### IN-03: Known limitation of skip-test CI gate acknowledged but not enforced

**File:** `scripts/check-skipped-tests.mjs:1-4`
**Issue:** Header comment correctly notes alternative constructs
(`it['skip']()`, aliased variables) are not detected, with ESLint enforcement
deferred to v1.9 Phase 23 (D-11). Acceptable scope tradeoff, just confirming
the deferral is tracked.

**Fix:** None needed — tracked in D-11. Confirm Phase 23 ROADMAP entry exists.

### IN-04: `OutcomesView.tsx` beacon effect depends on `searchParams` but deps array empty

**File:** `src/components/outcomes/OutcomesView.tsx:159-180`
**Issue:** The beacon useEffect reads `searchParams.get('cohort')` /
`searchParams.get('filter')` but disables exhaustive-deps lint with empty
deps to enforce fire-once-per-mount. This is correct (beacon contract is
"once when Trajectories tab mounts"), but if a user stays on the tab and
changes `?cohort=` via another control without remounting, the beacon will
not fire again. Behaviour is by design per Phase 11 CRREV-01; flagging for
future-reviewer context.

**Fix:** None needed. The existing eslint-disable + comment on line 180
document the intent. Not introduced by Phase 21.

### IN-05: `tests/setup.ts` MockBroadcastChannel iterates listeners without snapshot

**File:** `tests/setup.ts:20-23`
**Issue:** `postMessage` iterates `peer.listeners` directly. If a listener
invokes `addEventListener`/`removeEventListener` during dispatch, the
iteration could skip or double-visit listeners. Not exercised by the current
test suite (listeners are static), so not an active bug.

**Fix:** Snapshot the array before iterating:
```ts
for (const fn of [...peer.listeners]) fn({ data } as MessageEvent);
```

---

_Reviewed: 2026-04-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
