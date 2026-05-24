---
phase: 29-home-panel-ux
verified: 2026-05-21T14:20:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
gaps: []
human_verification: []
---

# Phase 29: Home Panel UX Verification Report

**Phase Goal:** Users can act on home-panel alerts and return to recent work with a single click
**Verified:** 2026-05-21T14:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Therapy-breaker Review button routes to `/quality?therapy=breaker` | VERIFIED | `LandingPage.tsx:288` — `onClick={() => navigate('/quality?therapy=breaker')}` with `aria-label={t('reviewTherapyBreakers')}` |
| 2 | Implausible-CRT Review button routes to `/quality?status=flagged` (gate removed) | VERIFIED | `LandingPage.tsx:302` — no `canSeeDocQuality &&` wrapper; `onClick={() => navigate('/quality?status=flagged')}` |
| 3 | Navigating to `/quality?therapy=breaker` pre-selects the breaker filter on mount | VERIFIED | `QualityPage.tsx:101–104` — `useState(() => { const v = searchParams.get('therapy'); return v === 'breaker' || v === 'interrupter' ? v : 'all'; })` |
| 4 | Navigating to `/quality?status=flagged` pre-selects `in_progress` filter (not `'flagged'`) | VERIFIED | `QualityPage.tsx:93–99` — `return v === 'flagged' ? 'in_progress' : 'all'`; comment explains the D-04 mapping |
| 5 | Unknown `?therapy=` / `?status=` value falls back to `'all'` silently | VERIFIED | Both lazy initializers return `'all'` for any unrecognized value; `qualityPageDeepLink.test.tsx` asserts this explicitly — 25/25 GREEN |
| 6 | Jump Back In renders rows from `useRecentActivity` when entries exist; shows empty-state otherwise | VERIFIED | `LandingPage.tsx:239–270` — conditional on `entries.length === 0`; rows map `entries` from the hook; `data-testid="jump-back-in-empty"` preserved |
| 7 | Each row's arrow navigates to `entry.path` with a single click | VERIFIED | `LandingPage.tsx:252–253` — `onClick={() => navigate(entry.path)}` + `onKeyDown` Enter; `jumpBackIn.test.tsx` asserts row-click navigation — 25/25 GREEN |
| 8 | Opening a case in QualityPage, or visiting AnalysisPage / OutcomesView with an active cohort, records a recent-activity entry | VERIFIED | `QualityPage.tsx:115–123` — `useEffect` on `[selectedCase]`; `AnalysisPage.tsx:55,83` — mount-only `useEffect`; `OutcomesView.tsx:86,166` — `useEffect` on `[primaryCohortId]` guarded by `activeCases.length > 0` |
| 9 | Explicit logout clears all recents before nulling the user | VERIFIED | `AuthContext.tsx:141` — `recentActivityStore.clearAll()` before `setUser(null)` (ordering check: indexOf 5685 < 6124); login also calls `clearAll()` (lines 208, 238) — CR-01 fix in commit b4bbfa4 |
| 10 | Cross-tab BroadcastChannel logout clears all `emd-recent:*` keys before removing the token | VERIFIED | `authHeaders.ts:35` — `recentActivityStore.clearAll()` before `sessionStorage.removeItem('emd-token')` (ordering check: indexOf 1812 < 1848) — CR-02 fix in commit 175e011 |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/recentActivityStore.ts` | localStorage CRUD: getEntries/record/clear/clearAll + isValidEntry type guard | VERIFIED | 87 lines; exports all four functions + `RecentActivityEntry`; `isValidEntry` rejects untrusted `path` values (CR-02 fix); every localStorage call try/catch-guarded |
| `src/hooks/useRecentActivity.ts` | React hook wrapping the store, keyed to `user.username` | VERIFIED | 43 lines; imports `* as store`; `useCallback` for record/clear with `[username]` deps; synchronous re-hydrate on username change |
| `tests/recentActivityStore.test.ts` | Unit tests for store dedupe/cap-5/clear/clearAll/silent-failure | VERIFIED | Present; runs GREEN (25/25 total across 4 files) |
| `tests/qualityPageDeepLink.test.tsx` | Deep-link filter-seeding + unknown-param fallback tests | VERIFIED | Asserts `?therapy=breaker` → `breaker`, `?status=flagged` → `in_progress`, unknown → `all`; GREEN |
| `tests/landingPageAlerts.test.tsx` | Review-button navigation-target tests | VERIFIED | Asserts both button targets and distinct aria-labels; GREEN |
| `tests/jumpBackIn.test.tsx` | Jump Back In empty-state vs rows + row-click navigation tests | VERIFIED | Empty-state testid, populated rows, row-click `navigate(entry.path)`; GREEN |
| `src/i18n/translations.ts` | `reviewTherapyBreakers` + `reviewFlaggedCases` aria-label keys | VERIFIED | Both keys present at lines 862/866 with DE + EN values |
| `src/pages/LandingPage.tsx` | Review-button targets + Jump Back In conditional row list | VERIFIED | Contains `/quality?therapy=breaker` (line 288) and `/quality?status=flagged` (line 302); `entries.map(...)` rendering (lines 247–270) |
| `src/context/AuthContext.tsx` | `recentActivityStore.clearAll()` in `performLogout` + login (CR-01) | VERIFIED | Lines 141, 208, 238 — clearAll on logout and both login branches |
| `src/services/authHeaders.ts` | `recentActivityStore.clearAll()` in cross-tab logout branch | VERIFIED | Line 35 — clearAll before token removal |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `LandingPage.tsx` | `useRecentActivity().entries` | Hook import + `entries.map(entry => navigate(entry.path))` | WIRED | `import { useRecentActivity }` at line 17; `const { entries } = useRecentActivity()` at line 35; rows at lines 247–270 |
| `QualityPage.tsx` | URL query params `therapy`/`status` | `useSearchParams` lazy `useState` initializer | WIRED | `useSearchParams` at line 83; lazy initializers at lines 93–108 |
| `AuthContext.tsx performLogout` | `recentActivityStore.clearAll()` | Import at line 5; call at line 141 before `setUser(null)` at line 148 | WIRED | Ordering verified: indexOf 5685 < 6124 |
| `authHeaders.ts logout branch` | `recentActivityStore.clearAll()` | Import at line 13; call at line 35 before `sessionStorage.removeItem('emd-token')` | WIRED | Ordering verified: indexOf 1812 < 1848 |
| `useRecentActivity.ts` | `recentActivityStore.ts` | `import * as store from '../services/recentActivityStore'` | WIRED | Namespace import confirmed; `store.getEntries`, `store.record`, `store.clear` called |
| `QualityPage.tsx` → `useRecentActivity` | `record({ id: selectedCase.id, label: selectedCase.pseudonym, ... })` | `useEffect` on `[selectedCase]` | WIRED | Lines 115–123; guard `if (!selectedCase) return` |
| `AnalysisPage.tsx` → `useRecentActivity` | `record({ id: savedSearchId ?? 'analysis', ... })` | Mount-only `useEffect` | WIRED | Lines 55, 83–89 |
| `OutcomesView.tsx` → `useRecentActivity` | `record({ ... })` guarded by `activeCases.length > 0` | `useEffect` on `[primaryCohortId]` | WIRED | Lines 86, 166–173 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `LandingPage.tsx` Jump Back In rows | `entries` | `useRecentActivity()` → `store.getEntries(username)` → localStorage parse + `isValidEntry` filter | Yes — reads real localStorage state written by `record()` calls | FLOWING |
| `QualityPage.tsx` filter state | `filterTherapy`, `filterStatus` | `useSearchParams()` lazy `useState` initializers reading `?therapy=` / `?status=` | Yes — reads real URL search params on mount | FLOWING |
| `AuthContext.tsx` recent-activity clearing | n/a | `recentActivityStore.clearAll()` iterates `localStorage.length` collecting `emd-recent:*` keys | Yes — operates on real localStorage; no static shortcut | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 4 Phase 29 test files GREEN | `npx vitest run tests/recentActivityStore.test.ts tests/qualityPageDeepLink.test.tsx tests/landingPageAlerts.test.tsx tests/jumpBackIn.test.tsx` | 4 files, 25/25 passed | PASS |
| Full test suite passes (754 baseline) | `npm run test:ci` | 72 files, 754/754 passed | PASS |
| clearAll precedes setUser(null) in AuthContext | `node -e "...indexOf check..."` | indexOf 5685 < 6124 — ORDER OK | PASS |
| clearAll precedes removeItem in authHeaders | `node -e "...indexOf check..."` | indexOf 1812 < 1848 — ORDER OK | PASS |
| Deep-link filter mapping strings present | `grep -n "flagged\|in_progress" QualityPage.tsx` | Lines 93–99 — mapping present with D-04 comment | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| UX-01 | 29-01, 29-03, 29-04 | Home "Attention needed" panel — Review buttons route to appropriate pre-filtered review area via defined query contract (FB-02) | SATISFIED | Both buttons route to `/quality?therapy=breaker` / `/quality?status=flagged`; QualityPage seeds filters from URL on mount; tests 25/25 GREEN |
| UX-02 | 29-01, 29-02, 29-04 | Home "Jump Back In" panel — arrows route to last-visited view for patient/case (FB-03); requires new client-side recent-activity tracking | SATISFIED | `recentActivityStore.ts` + `useRecentActivity.ts` implement per-username localStorage tracking; LandingPage renders rows that navigate to `entry.path`; three recording surfaces wired; logout clears on both paths |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/pages/LandingPage.tsx` | 128 | `{/* Export not yet implemented — disabled to avoid silent no-ops */}` | INFO | Pre-existing comment for a feature outside Phase 29 scope; disabled export button with `disabled` attribute and German title. Not a debt marker (no TBD/FIXME/XXX); export is explicitly disabled rather than silently broken. Not a blocker. |

No TBD, FIXME, or XXX markers found in any Phase 29 modified files.

---

### Code Review Status

Both Critical findings from `29-REVIEW.md` are confirmed resolved in the actual codebase:

- **CR-01** (commit b4bbfa4): `AuthContext.tsx` calls `recentActivityStore.clearAll()` (not just `clear(username)`) on every interactive logout, AND on every successful login — purging all `emd-recent:*` keys so no prior user's pseudonyms survive on shared hardware.
- **CR-02** (commit 175e011): `recentActivityStore.ts` implements `isValidEntry()` type guard that validates all fields including `path.startsWith('/') && !path.startsWith('//')` before any entry flows into `navigate()` or rendered DOM.

6 Warnings + 4 Info findings in `29-REVIEW.md` remain open and advisory (not blocking):
- WR-01 through WR-06 are quality improvements (deep-link re-apply on remount, double timestamp, AnalysisPage empty guard, stale-closure risk, clearAll per-key error isolation, Space key on rows).
- IN-01 through IN-04 are observations (empty-username key, dead code in test, magic constant, double getEntries call).
None of these prevent the phase goal from being achieved.

---

### Human Verification Required

None — all behavioral checks are automatable and have been verified programmatically.

---

## Summary

Phase 29 goal fully achieved. Both UX requirements are satisfied end-to-end:

**UX-01:** The "Attention needed" panel's two Review buttons now route to `/quality?therapy=breaker` and `/quality?status=flagged` respectively. The stale role gate (`canSeeDocQuality`) has been removed from the implausible-CRT button. QualityPage seeds `filterTherapy` and `filterStatus` from URL params via lazy `useState` initializers on mount, with correct allow-listing (`'flagged'` → `'in_progress'` mapping documented).

**UX-02:** A new `recentActivityStore.ts` service and `useRecentActivity.ts` hook provide per-username localStorage tracking. LandingPage's "Jump Back In" panel renders live rows or the preserved empty-state. Three recording surfaces (QualityPage on case open, AnalysisPage on mount, OutcomesView on cohort change) record deduped, restorable entries. Both logout paths (explicit and cross-tab BroadcastChannel) clear recents in verified positional order before session teardown, including the CR-01-upgraded `clearAll()` on login.

The test suite is 754/754 GREEN. Build and lint are clean.

---

_Verified: 2026-05-21T14:20:00Z_
_Verifier: Claude (gsd-verifier)_
