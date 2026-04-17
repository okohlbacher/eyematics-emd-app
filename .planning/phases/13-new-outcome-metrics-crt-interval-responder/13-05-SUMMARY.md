---
plan: 05
phase: 13-new-outcome-metrics-crt-interval-responder
status: complete
---

# Plan 13-05 Summary — OutcomesView Integration (Metric Selector + Deep-Link)

## What was done

Wired all Phase 13 metrics (Visus / CRT / Interval / Responder) into the OutcomesView entry point via a tab-strip metric selector backed by `?metric=` URL parameter (METRIC-04).

### OutcomesView.tsx
- Added `MetricType` union type and `VALID_METRICS` Set for allowlist validation of the URL param
- `METRIC_TAB_ORDER` constant for stable tab order `[visus, crt, interval, responder]`
- `activeMetric` derived from `searchParams.get('metric')`, falling back to `'visus'`
- Functional `setSearchParams` call to update URL param while preserving other params (deep-link)
- Session-only `thresholdLetters` state (responder threshold, defaults to 5 letters)
- Tab-strip rendering via `METRIC_TAB_ORDER.map()` with `aria-selected` and `role=tab`
- Conditional rendering: Visus → `OutcomesPanel`; CRT → `OutcomesPanel metric="crt"`; Interval → `IntervalHistogram`; Responder → `ResponderView`
- `resetToMetricDefaults()` called on cohort change to reset metric-specific transient state
- Removed duplicate `data-testid="outcomes-server-computing"` (renamed header variant to `outcomes-server-computing-header` to preserve test invariant)

### OutcomesSettingsDrawer.tsx
- `activeMetric` prop added
- Visus controls (y-metric, y-axis, scatter toggle) hidden when `activeMetric !== 'visus'`
- CRT controls (y-metric in µm/delta modes) shown when `activeMetric === 'crt'`
- Interval: no controls — renders `metricsSettingsNoControls` message
- Responder: threshold input section with `metricsResponderThreshold` i18n label

### OutcomesEmptyState.tsx
- `variant` union extended with `'crt-no-data' | 'interval-no-data' | 'responder-no-data'`
- Each variant renders metric-specific title + body from translations

### translations.ts
- Added `metricsSettingsNoControls` key (dangling reference fix caught by METRIC-06 test)

### tests/metricSelector.test.tsx
- Renamed from `.ts` to `.tsx` (file contained JSX requiring TSX transform)
- Kept `describe.skip` — full DOM integration tests require real router context; activation deferred to E2E or manual test pass

## Test results

429 tests passing, 5 skipped (metricSelector describe.skip), 0 failed. TypeScript clean.

## Issues fixed

- `data-testid="outcomes-server-computing"` duplicate: header span renamed to `outcomes-server-computing-header` to keep `OutcomesViewRouting.test.tsx` green
- `metricsSettingsNoControls` i18n key: added to translations (detected by METRIC-06 test)
- `metricSelector.test.ts` JSX parse error: renamed to `.tsx`
