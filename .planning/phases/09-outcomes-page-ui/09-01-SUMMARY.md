---
phase: 09
plan: 09-01
subsystem: outcomes-page-shell
tags: [tdd, outcomes, route, audit-beacon, empty-state, cohort-resolution]
dependency_graph:
  requires:
    - src/utils/cohortTrajectory.ts (defaultScatterOn, AxisMode, YMetric, SpreadMode)
    - src/context/DataContext.ts (useData → activeCases, savedSearches)
    - src/context/LanguageContext.tsx (useLanguage → t)
    - src/services/fhirLoader.ts (applyFilters)
    - server/auditApi.ts (GET /api/audit/events/view-open — landed in 08-02)
    - src/i18n/translations.ts (71 outcomes* keys from 08-04)
  provides:
    - src/pages/OutcomesPage.tsx (route shell, cohort resolution, audit beacon, toggle state)
    - src/components/outcomes/OutcomesEmptyState.tsx (no-cohort + no-visus empty states)
    - src/App.tsx route registration for /outcomes
    - tests/OutcomesPage.test.tsx (tests 1-7 of 17-case phase suite)
  affects:
    - 09-02-PLAN.md (wires panels, cards, tooltip, drawer into the shell)
    - 09-03-PLAN.md (wires DataPreview + CSV export)
tech_stack:
  added: []
  patterns:
    - TDD RED-GREEN-REFACTOR
    - safePickFilter M-04 prototype-pollution guard (verbatim from AnalysisPage.tsx)
    - fire-and-forget audit beacon via useEffect empty dep array
    - D-37 default-scatter-off via cohort-dependent useEffect
key_files:
  created:
    - src/pages/OutcomesPage.tsx
    - src/components/outcomes/OutcomesEmptyState.tsx
    - tests/OutcomesPage.test.tsx
  modified:
    - src/App.tsx (route registration for /outcomes)
decisions:
  - "safePickFilter lives inline in OutcomesPage.tsx (not extracted to shared util) — bounded scope; M-04 pattern kept co-located"
  - "TranslationKey imported in OutcomesPage + OutcomesEmptyState for type-safe t() calls (LanguageContext t type is (key: TranslationKey) => string)"
  - "D-37 default-scatter-off enforced via cohort-dependent useEffect; surfaced via data-testid='outcomes-scatter-default-off' for RTL test assertion"
  - "Audit beacon useEffect has empty dep array (eslint-disable inline) — fires exactly once per mount per OUTCOME-11"
  - "Pre-existing auditService.ts TS error (MAX_AUDIT_ENTRIES) is out of scope — pre-existed before this plan"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-15"
  tasks_completed: 3
  files_changed: 4
---

# Phase 09 Plan 01: OutcomesPage Scaffold Summary

**One-liner:** `/outcomes` route shell with safePickFilter cohort resolution (saved/filter/fallback), once-on-mount audit beacon, D-37 scatter-off init, and no-cohort/no-visus empty states — 7 RTL tests passing.

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/pages/OutcomesPage.tsx` | 121 | Route entry point — cohort resolution (3 paths), audit beacon, scatter toggle state, empty-state gate |
| `src/components/outcomes/OutcomesEmptyState.tsx` | 34 | Full-page empty state for no-cohort and no-visus variants (Users icon, title/body/link) |
| `tests/OutcomesPage.test.tsx` | 163 | RTL suite — 7 tests covering route resolution, audit beacon, safePickFilter, D-37 scatter-off |

## Files Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Added `import OutcomesPage` + `<Route path="/outcomes" element={<OutcomesPage />} />` inside the authenticated DataProvider/Layout group |

## Requirements Addressed

| Requirement | Status | Evidence |
|-------------|--------|---------|
| OUTCOME-01 | Closed | Three cohort-resolution paths: `?cohort=<id>` (savedSearches.find), `?filter=<json>` (safePickFilter → applyFilters), no-params (fallback to activeCases) |
| OUTCOME-09 | Closed | No new `/api/*` data endpoints — aggregation uses `useData().activeCases` only; only the audit beacon hits the server |
| OUTCOME-11 | Closed | `GET /api/audit/events/view-open?name=open_outcomes_view[&cohort|&filter]` fires exactly once per mount with `credentials: 'include'` |

## Test Coverage

- **Tests 1-7 of 17 phase-wide cases** — all passing (GREEN)
  1. Renders `outcomesTitle` heading — fallback (activeCases, no params)
  2. No-cohort empty state — activeCases empty, no params
  3. No-cohort empty state — `?cohort=does-not-exist`
  4. Renders title — `?filter=<valid-json>` parsed via safePickFilter
  5. No-cohort empty state — `?filter=<invalid-json>` (catch branch)
  6. Audit beacon fires once with correct URL + `credentials: 'include'`
  7. D-37 scatter-off: 31-patient cohort → `outcomes-scatter-default-off` testid present

## Handoff to 09-02

**Toggle state declared (ready for drawer wiring):**
```typescript
const [axisMode, setAxisMode] = useState<AxisMode>('days');
const [yMetric, setYMetric] = useState<YMetric>('absolute');
const [gridPoints, setGridPoints] = useState<number>(120);
const [spreadMode, setSpreadMode] = useState<SpreadMode>('iqr');
const [layers, setLayers] = useState({ median, perPatient, scatter, spreadBand });
```

**Mount point for 09-02 components:**
- `data-testid="outcomes-content-placeholder"` marks where summary cards + panels wire in
- `data-testid="outcomes-scatter-default-off|on"` is the D-37 marker

**Open items for 09-02:**
- Wire `OutcomesSummaryCards` (patient count, baseline visus, delta at 12mo, treatment count)
- Wire three `OutcomesPanel` instances (OD / OS / combined) using `computeCohortTrajectory`
- Wire `OutcomesTooltip` (custom Recharts tooltip)
- Wire `OutcomesSettingsDrawer` (axis mode, Y metric, spread mode, layer toggles)
- Add `computeCohortTrajectory` memo: `useMemo(() => computeCohortTrajectory({ cases, axisMode, yMetric, gridPoints, spreadMode }), [cohort, axisMode, yMetric, gridPoints, spreadMode])`
- IQR band via `<Area dataKey="iqrHigh" baseLine="iqrLow" ...>` primary approach

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TranslationKey type mismatch for OutcomesEmptyState `t` prop**
- **Found during:** Task 1.2 GREEN — `npm run build` revealed TS2322
- **Issue:** `LanguageContext.useLanguage().t` is typed `(key: TranslationKey) => string`, but plan skeleton typed the `t` prop as `(key: string) => string` — TS rejected the assignment
- **Fix:** Imported `TranslationKey` in both `OutcomesPage.tsx` and `OutcomesEmptyState.tsx`; prop type changed to `(key: TranslationKey) => string`; cast applied at call site
- **Files modified:** `src/pages/OutcomesPage.tsx`, `src/components/outcomes/OutcomesEmptyState.tsx`
- **Commit:** 904749f

## Deferred Issues

**Pre-existing TS error in `src/services/auditService.ts`:**
- `Module '"../config/clinicalThresholds"' has no exported member 'MAX_AUDIT_ENTRIES'`
- Present before this plan (confirmed by stash-and-build test)
- Out of scope per deviation rules — out-of-fence file

## Known Stubs

- `data-testid="outcomes-content-placeholder"` div — intentional; 09-02 wires actual content here
- Toggle state declared but not rendered (`void axisMode; void yMetric; ...`) — intentional; 09-02 renders the drawer that exposes these controls

## Threat Flags

None — T-09-01 (safePickFilter M-04 guard) and T-09-02 (audit beacon URL) mitigations are implemented per plan threat register.

## Self-Check: PASSED

- `src/pages/OutcomesPage.tsx` exists: YES
- `src/components/outcomes/OutcomesEmptyState.tsx` exists: YES
- `src/App.tsx` contains `path="/outcomes"`: YES
- `tests/OutcomesPage.test.tsx` exists with 7 tests: YES
- Commits 313cff2 (test), 904749f (feat): YES
- 7 tests passing: YES
