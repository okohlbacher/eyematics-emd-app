---
phase: 29-home-panel-ux
plan: "04"
subsystem: home-panel-ux
tags: [ux, recent-activity, deep-link, logout-privacy, react-hooks]
dependency_graph:
  requires: [29-01, 29-02, 29-03]
  provides: [LandingPage UX-01 buttons, Jump Back In rows, recording triggers, D-02 logout clearing]
  affects:
    - src/pages/LandingPage.tsx
    - src/context/AuthContext.tsx
    - src/services/authHeaders.ts
    - src/pages/AnalysisPage.tsx
    - src/components/outcomes/OutcomesView.tsx
    - src/pages/QualityPage.tsx
tech_stack:
  added: []
  patterns:
    - useRecentActivity hook consumption
    - useEffect with minimal stable deps for recording (no render-loop)
    - recentActivityStore.clear before setUser(null) (ordering constraint)
    - recentActivityStore.clearAll in module-level BroadcastChannel handler
key_files:
  created: []
  modified:
    - src/pages/LandingPage.tsx
    - src/context/AuthContext.tsx
    - src/services/authHeaders.ts
    - src/pages/AnalysisPage.tsx
    - src/components/outcomes/OutcomesView.tsx
    - src/pages/QualityPage.tsx
    - tests/jumpBackIn.test.tsx
    - tests/landingPageAlerts.test.tsx
    - tests/LandingPage.test.tsx
    - tests/OutcomesPage.test.tsx
    - tests/OutcomesViewRouting.test.tsx
    - tests/metricSelector.test.tsx
    - tests/qualityPageDeepLink.test.tsx
    - tests/recentActivityStore.test.ts
decisions:
  - "Use navQuality/navAnalysis/outcomesTitle i18n keys as sub-labels — no new keys needed (UI-SPEC compliant)"
  - "Record path=/quality in QualityPage (not filtered URL) so restoration lands on the review surface without re-pre-filtering"
  - "Empty dep array [] for AnalysisPage recording effect (mount-only) since savedSearchId is stable at mount"
  - "Dep [primaryCohortId] for OutcomesView recording effect so recording updates on cohort switch"
  - "Fixed vi.fn() mock issue in jumpBackIn.test.tsx — mock factory needed vi.fn() not plain arrow for vi.mocked().mockReturnValue to work"
  - "Added useRecentActivity stub to 4 existing test files (OutcomesPage, OutcomesViewRouting, metricSelector, LandingPage) that render OutcomesView or LandingPage without AuthContext provider"
  - "Updated LandingPage.test.tsx FB-02 tests to match Plan 04 behavior — buttons now have distinct aria-labels, removed role gate"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-21"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 14
---

# Phase 29 Plan 04: Home Panel UX End-to-End Wiring Summary

**One-liner:** LandingPage Review buttons wired to `/quality?therapy=breaker` and `/quality?status=flagged` deep-links (UX-01), Jump Back In renders `useRecentActivity` rows with accessible navigation (UX-02), three review surfaces record visits, and both logout paths clear recents in verified order (D-02).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix Review-button targets + render Jump Back In rows | cd68fca | src/pages/LandingPage.tsx, tests/jumpBackIn.test.tsx, tests/landingPageAlerts.test.tsx |
| 2 | Add recording triggers on three review surfaces | a6afbaf | src/pages/QualityPage.tsx, src/pages/AnalysisPage.tsx, src/components/outcomes/OutcomesView.tsx, tests/LandingPage.test.tsx, tests/OutcomesPage.test.tsx, tests/OutcomesViewRouting.test.tsx, tests/metricSelector.test.tsx |
| 3 | Clear recents on both logout paths | 78cdbfb | src/context/AuthContext.tsx, src/services/authHeaders.ts |
| 4 | Fix import ordering (lint auto-fix) | d50f5e0 | tests/qualityPageDeepLink.test.tsx, tests/recentActivityStore.test.ts |

## Verification Results

- `npx vitest run tests/landingPageAlerts.test.tsx tests/jumpBackIn.test.tsx`: 6/6 GREEN
- `npx vitest run tests/landingPageAlerts.test.tsx tests/jumpBackIn.test.tsx tests/qualityPageDeepLink.test.tsx tests/recentActivityStore.test.ts`: 25/25 GREEN
- `npm run test:ci`: 754/754 passed (619 baseline + Phase 29 tests)
- `npm run build`: clean (2380 modules, 0 errors)
- `npm run lint`: 0 errors (5 pre-existing warnings, import-sort only)
- Ordering check (positional indexOf): ORDER OK on both logout paths
- `grep -c "/quality?therapy=breaker" src/pages/LandingPage.tsx`: 1 (present)
- `grep -c "/quality?status=flagged" src/pages/LandingPage.tsx`: 1 (present)
- `canSeeDocQuality` removed from LandingPage (no unused const)
- Both Review buttons have distinct `aria-label` attributes

## Decisions Made

- **Sub-label keys**: Used `navQuality` (Datenqualität/Data Quality), `navAnalysis` (Analyse/Analysis), `outcomesTitle` (Outcomes/Outcomes) as recording sub-labels. UI-SPEC says reuse existing keys rather than adding new ones — all three are good matches for their surfaces.
- **QualityPage path**: Records `/quality` (not filtered URL) so restoring the entry opens the full review surface. The plan explicitly calls this out (RESEARCH §5) to avoid confusing re-filtering on return.
- **AnalysisPage deps**: Empty `[]` dep array (mount-only recording). `savedSearchId` is stable at mount time.
- **OutcomesView deps**: `[primaryCohortId]` so recording fires when the user switches between cohorts without unmounting.
- **Test mock pattern**: `vi.fn(() => {...})` in the `useRecentActivity` mock factory (not a plain arrow function) — required for `vi.mocked().mockReturnValue` to work at per-test override time in jumpBackIn.test.tsx.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jumpBackIn.test.tsx mock factory returned non-spy function**
- **Found during:** Task 1 test run
- **Issue:** `vi.mock('../src/hooks/useRecentActivity', () => ({ useRecentActivity: () => ({...}) }))` creates a plain function. `vi.mocked(useRecentActivity).mockReturnValue` requires the function to be a `vi.fn()` spy.
- **Fix:** Changed factory to `useRecentActivity: vi.fn(() => ({...}))`.
- **Files modified:** tests/jumpBackIn.test.tsx
- **Commit:** cd68fca

**2. [Rule 2 - Missing critical functionality] useRecentActivity missing from 4 existing test files**
- **Found during:** Task 2 test run
- **Issue:** Adding `useRecentActivity` to OutcomesView, AnalysisPage (indirectly via hook consuming `useAuth`) caused `useAuth must be used within AuthProvider` errors in OutcomesPage.test.tsx, OutcomesViewRouting.test.tsx, metricSelector.test.tsx. LandingPage.test.tsx similarly lacked the mock.
- **Fix:** Added `vi.mock('../src/hooks/useRecentActivity', () => ({ useRecentActivity: () => ({...}) }))` stub to all four test files.
- **Files modified:** tests/OutcomesPage.test.tsx, tests/OutcomesViewRouting.test.tsx, tests/metricSelector.test.tsx, tests/LandingPage.test.tsx
- **Commit:** a6afbaf

**3. [Rule 1 - Bug] LandingPage.test.tsx FB-02 tests asserted obsolete button behavior**
- **Found during:** Task 2 test run
- **Issue:** Old Phase 24-02 tests expected buttons with aria-label "Review" navigating to `/cohort` and `/doc-quality`, and a role gate hiding the CRT button. Plan 04 changes all three behaviors.
- **Fix:** Updated the 4 FB-02 test cases to match the new aria-labels (`reviewTherapyBreakers`, `reviewFlaggedCases`), new targets (`/quality`), and removed gate assertion. Added `/quality` route to `renderLanding`. Updated test names to document the Plan 04 change.
- **Files modified:** tests/LandingPage.test.tsx
- **Commit:** a6afbaf

**4. [Rule 1 - Bug] Comment in AuthContext.tsx caused indexOf false-positive in ordering check**
- **Found during:** Task 3 verify step
- **Issue:** The comment "clear...BEFORE setUser(null)" contained the literal string `setUser(null)`, which `String.prototype.indexOf` found first (at comment position, before the actual function call), making the positional ordering check fail.
- **Fix:** Reworded comment to "BEFORE nulling the user" to avoid the false positive.
- **Files modified:** src/context/AuthContext.tsx
- **Commit:** 78cdbfb

## Known Stubs

None — all recording entries use real data (case IDs, pseudonyms, saved search names). The Jump Back In rows consume live `useRecentActivity` entries from localStorage. No placeholder or hardcoded values flow to the UI.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-29-09 mitigated | src/context/AuthContext.tsx | `recentActivityStore.clear(user?.username)` before `setUser(null)` — ordering verified positionally |
| threat_flag: T-29-10 mitigated | src/services/authHeaders.ts | `recentActivityStore.clearAll()` before `sessionStorage.removeItem('emd-token')` — ordering verified positionally |
| threat_flag: T-29-11 accepted | src/pages/LandingPage.tsx | `canSeeDocQuality` gate removed; `/quality` is `ProtectedRoute` accessible to all authenticated roles |
| threat_flag: T-29-12 mitigated | src/pages/QualityPage.tsx, AnalysisPage.tsx, OutcomesView.tsx | Recorded entries store only id, pseudonym, sub-label, and app-internal path — no clinical values or tokens |

## Self-Check: PASSED

- src/pages/LandingPage.tsx: FOUND (modified — useRecentActivity, fixed buttons, Jump Back In rows)
- src/context/AuthContext.tsx: FOUND (modified — recentActivityStore.clear in performLogout)
- src/services/authHeaders.ts: FOUND (modified — recentActivityStore.clearAll in logout handler)
- src/pages/AnalysisPage.tsx: FOUND (modified — useRecentActivity recording on mount)
- src/components/outcomes/OutcomesView.tsx: FOUND (modified — useRecentActivity recording on cohort change)
- src/pages/QualityPage.tsx: FOUND (modified — useRecentActivity recording on case open)
- Commit cd68fca (Task 1): FOUND
- Commit a6afbaf (Task 2): FOUND
- Commit 78cdbfb (Task 3): FOUND
- Commit d50f5e0 (lint cleanup): FOUND
- Tests 754/754: CONFIRMED
- Build clean: CONFIRMED
- Lint 0 errors: CONFIRMED
- Ordering check ORDER OK: CONFIRMED
