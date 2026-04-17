# Phase 13: New Outcome Metrics (CRT / Interval / Responder) — Research

**Researched:** 2026-04-16
**Domain:** React/Recharts chart extension + TypeScript shared math utilities + i18n
**Confidence:** HIGH — all findings verified against the live codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Metric Selector Placement**
Inline tab strip (segmented control) at the top of `OutcomesView`, above the panels — adjacent to or just below the existing axis-mode / settings controls. URL param `?metric=visus|crt|interval|responder` deep-links to the selection. Default = `visus`. Read by `OutcomesView` via `useSearchParams()`, consistent with cohort params.

**D-02: Layer State on Metric Switch**
Reset y-metric, axis-mode, and layer toggles to per-metric defaults when switching metrics via `resetToMetricDefaults(metric)`. Defaults:
- Visus: `yMetric='delta'`, all layers on
- CRT: `yMetric='delta'`, all layers on
- Interval: no y-metric concept, OD+OS combined by default
- Responder: no y-metric / layer concept, fixed layout

**D-03: CRT Panel Architecture**
Reuse `OutcomesPanel` with added `metric: 'visus' | 'crt'` prop. New `computeCrtTrajectory()` in `shared/cohortTrajectory.ts` using `LOINC_CRT` and µm units. Y-axis absolute domain `[0, 800]` µm. Three sub-panels (OD / OS / combined) same layout as visus.

**D-04: Treatment-Interval Visualization**
Histogram (BarChart) of per-patient injection gap days + median-gap ReferenceLine. Bins: 0–30d, 30–60d, 60–90d, 90–120d, 120–180d, 180+d. Eye filter: OD / OS / combined toggle. X = bin labels, Y = count. New `computeIntervalDistribution(cases, eye)` in `shared/intervalMetric.ts`. Uses `SNOMED_IVI`.

**D-05: Responder Classification Visualization**
Two-section layout: (1) grouped/stacked BarChart — count per bucket (responder / partial / non-responder) for OD, OS, combined; (2) trajectory overlay — median visus for each bucket, 3 colored lines (green/yellow/red). Threshold input in `OutcomesSettingsDrawer` (default 5 letters). 5 letters ≈ 0.1 logMAR conversion. New `classifyResponders(cases, thresholdLetters, eye)`.

**D-06: CRT Server Aggregation**
Add `metric: 'visus' | 'crt'` to `POST /api/outcomes/aggregate` body. Server branches on `metric`: `LOINC_VISUS` vs `LOINC_CRT`. Cache key extended to include `metric`. Backward compatibility: missing `metric` defaults to `'visus'`.

**D-07: CSV Export**
- Visus: existing columns
- CRT: `crt_um`, `crt_delta_um`
- Interval: `pseudonym`, `eye`, `gap_index`, `gap_days`, `procedure_date`
- Responder: `pseudonym`, `eye`, `bucket`, `delta_visus_letters`, `measurement_date`
- Filename: `outcomes-{metric}-export-{date}.csv`

**D-08: i18n Keys**
All new strings in `src/i18n/translations.ts` with prefix `metrics`. i18n completeness test extends `tests/outcomesI18n.test.ts` to cover the `metrics` prefix.

### Claude's Discretion

None — all implementation details are locked.

### Deferred Ideas (OUT OF SCOPE)

- Dark-mode contrast for new metric charts
- Histogram bin count configurability
- Keycloak OIDC integration
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| METRIC-01 | CRT trajectory panel with OD/OS/combined, absolute + Δ + Δ%, all layers | `computeCrtTrajectory()` mirrors `computeCohortTrajectory()`; `OutcomesPanel` extended with `metric` prop |
| METRIC-02 | Treatment-interval histogram + median line, filterable by eye | New `computeIntervalDistribution()` + `IntervalHistogram.tsx` Recharts BarChart |
| METRIC-03 | Responder classification with configurable threshold, bucket counts + trajectories | New `classifyResponders()` + `ResponderView.tsx` two-section layout |
| METRIC-04 | Metric selector (`?metric=`) without page navigation, deep-linkable | Inline tab strip in `OutcomesView`, `useSearchParams` read/write |
| METRIC-05 | Metric-appropriate CSV export with metric slug in filename | `OutcomesDataPreview` metric-conditional column sets + `datedFilename` |
| METRIC-06 | Full DE+EN i18n with completeness test | All `metrics*` keys in `translations.ts`, extend `outcomesI18n.test.ts` |
</phase_requirements>

---

## Summary

Phase 13 extends the existing outcomes view (`OutcomesView.tsx`) with three new metrics (CRT, Treatment Interval, Responder) behind a metric selector tab strip. The work is primarily additive — new React components and new pure-math functions in `shared/` — with targeted modifications to five existing files.

The codebase is well-structured for this extension. `OutcomesPanel` is a Recharts `ComposedChart` container that already accepts typed props and renders median/IQR/per-patient/scatter layers. Adding a `metric` prop to switch y-axis domain behavior is a clean, isolated change. The `computeCohortTrajectory()` function in `shared/cohortTrajectory.ts` serves as the direct template for `computeCrtTrajectory()` — same algorithm, different LOINC code and unit system (µm instead of logMAR). The interval and responder computations are pure math with no chart infrastructure dependency.

The i18n pattern is well-established: single `translations.ts` flat object with `{de, en}` pairs; `outcomesI18n.test.ts` already has a completeness test for the `outcomes*` prefix that must be cloned for `metrics*`. The test imports `translations` dynamically and verifies every key has non-empty DE and EN values.

**Primary recommendation:** Implement in waves: (1) shared math utilities and server extension, (2) CRT view, (3) Interval histogram, (4) Responder view, (5) metric selector wiring and CSV, (6) i18n + tests.

---

## Standard Stack

### Core (already installed — verified from package.json and live imports)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 | All chart rendering (ComposedChart, BarChart, ReferenceLine) | [VERIFIED: npm view] Already used for visus panels |
| react | 19.2.4 | Component model | [VERIFIED: package.json] |
| react-router-dom | 7.14.0 | `useSearchParams` for `?metric=` deep-link | [VERIFIED: package.json] Already used in OutcomesView |
| typescript | 6.0.2 | Type system | [VERIFIED: package.json] |
| vitest | 4.1.4 | Test framework | [VERIFIED: package.json] |
| lucide-react | 1.8.0 | Icons (Users for empty states) | [VERIFIED: 13-UI-SPEC.md] |

**No new packages required.** All chart, routing, icon, and test infrastructure is already installed. [VERIFIED: codebase imports]

### Supporting (existing utilities reused)

| Utility | Location | Purpose |
|---------|----------|---------|
| `downloadCsv` / `datedFilename` | `src/utils/download.ts` | CSV export for all metrics |
| `EYE_COLORS`, `SERIES_STYLES` | `src/components/outcomes/palette.ts` | Chart colors for CRT panels and interval histogram |
| `LOINC_CRT`, `SNOMED_IVI` | `shared/fhirCodes.ts` | FHIR codes — already defined |
| `eyeOf`, `getObservationsByCode` | `shared/cohortTrajectory.ts` and `shared/fhirQueries.ts` | Eye laterality and observation lookup |
| `postAggregate` | `src/services/outcomesAggregateService.ts` | CRT server routing (>1000 patients) |

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 13:

```
shared/
├── cohortTrajectory.ts      # MODIFY: add computeCrtTrajectory()
├── intervalMetric.ts        # CREATE: computeIntervalDistribution()
├── responderMetric.ts       # CREATE: classifyResponders()
└── fhirCodes.ts             # READ-ONLY: LOINC_CRT + SNOMED_IVI already defined

src/components/outcomes/
├── OutcomesView.tsx          # MODIFY: metric selector, resetToMetricDefaults, routing
├── OutcomesPanel.tsx         # MODIFY: add metric prop, CRT y-domain logic
├── OutcomesSettingsDrawer.tsx # MODIFY: metric-aware control visibility + responder threshold
├── OutcomesEmptyState.tsx    # MODIFY: add 'no-crt', 'no-interval', 'no-responder' variants
├── OutcomesDataPreview.tsx   # MODIFY: metric-conditional columns + filename
├── IntervalHistogram.tsx     # CREATE: BarChart + eye toggle + median ReferenceLine
└── ResponderView.tsx         # CREATE: grouped bar + trajectory overlay

src/i18n/
└── translations.ts           # MODIFY: add all metrics* keys

server/
└── outcomesAggregateApi.ts   # MODIFY: add metric param to body + cache key

tests/
├── outcomesI18n.test.ts      # MODIFY: add metrics* completeness test
├── intervalMetric.test.ts    # CREATE: pure-math tests for computeIntervalDistribution
├── responderMetric.test.ts   # CREATE: pure-math tests for classifyResponders
└── crtTrajectory.test.ts     # CREATE: parity tests for computeCrtTrajectory
```

### Pattern 1: CRT Trajectory — Mirror `computeCohortTrajectory`

[VERIFIED: shared/cohortTrajectory.ts lines 276-323]

The new `computeCrtTrajectory()` function has the same signature and return type as `computeCohortTrajectory()` but uses `LOINC_CRT` and µm units:

```typescript
// Source: shared/cohortTrajectory.ts (pattern — mirror for CRT)
export function computeCrtTrajectory(input: {
  cases: PatientCase[];
  axisMode: AxisMode;
  yMetric: YMetric;
  gridPoints: number;
  spreadMode?: SpreadMode;
}): TrajectoryResult {
  // Replace LOINC_VISUS with LOINC_CRT
  // Replace decimalToLogmar with identity (µm is already numeric)
  // Absolute y = raw µm value, delta = µm - baseline µm, delta_percent = same clamp logic
  // buildPanel is reusable unchanged
}
```

**Key difference from visus:** CRT observations store the value directly in µm (no logMAR conversion). The `baseline` field stores raw µm. The `decimalToLogmar` call is omitted. The `decimalToSnellen` call is omitted. `y` for absolute = `valueQuantity.value` (µm), delta = µm change, delta_percent = % change with same ±200% clamp.

**Y-axis domain:** [VERIFIED: 13-CONTEXT.md D-03]
- Absolute: fixed `[0, 800]` µm
- Delta / delta_percent: data-driven symmetric (same `yDomain()` logic already in `OutcomesPanel.tsx`)

### Pattern 2: Interval Histogram — New Component

[VERIFIED: 13-CONTEXT.md D-04, 13-UI-SPEC.md Interaction Contract]

```typescript
// Source: 13-CONTEXT.md D-04
// File: src/components/outcomes/IntervalHistogram.tsx
interface IntervalDistribution {
  bins: Array<{ label: string; count: number }>;
  medianGap: number;
}

// shared/intervalMetric.ts
export function computeIntervalDistribution(
  cases: PatientCase[],
  eye: 'od' | 'os' | 'combined'
): IntervalDistribution {
  // 1. For each case, collect SNOMED_IVI procedures filtered by eye laterality
  // 2. Sort procedures by date ascending
  // 3. For consecutive pairs, compute gap = days between procedure dates
  // 4. Bucket each gap into the 6 bins: [0,30), [30,60), [60,90), [90,120), [120,180), [180,∞)
  // 5. medianGap = median of all gaps (use existing percentile() helper from cohortTrajectory)
}
```

**Recharts BarChart pattern:**
```typescript
// Source: Recharts 3.8.1 API (same version used for ComposedChart in OutcomesPanel)
<ResponsiveContainer width="100%" height={320}>
  <BarChart data={bins}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
    <YAxis tick={{ fontSize: 11 }} />
    <Tooltip content={<CustomTooltip />} />
    <Bar dataKey="count" fill={activeEyeColor} fillOpacity={0.85} />
    <ReferenceLine
      y={medianGap}           // Note: x-axis is categorical, median line is on Y
      stroke="#94a3b8"
      strokeDasharray="5 5"
      label={{ value: `Median ${medianGap}d`, position: 'right', fontSize: 11, fill: '#6b7280' }}
    />
  </BarChart>
</ResponsiveContainer>
```

**Critical implementation note:** The median reference line uses `y={medianGap}` on a BarChart where X is categorical (bin labels). The `ReferenceLine` with `y` works correctly in BarChart for a horizontal line at that Y value. [VERIFIED: Recharts 3 docs — BarChart supports ReferenceLine with y prop for horizontal lines]

**However:** The histogram X-axis is bin labels (strings), Y-axis is count (numbers). The `medianGap` is in days, not in count. The design intent (13-CONTEXT.md D-04) is a "median-gap reference line" — this should be interpreted as a label/annotation showing the median day value, not a line at that Y-coordinate. The correct implementation is: render the median as a text annotation or a separate `<text>` SVG element, NOT as `ReferenceLine y={medianGap}` (which would try to draw a horizontal bar-count line at that day value). [ASSUMED] — the planner should confirm whether the median display should be a ReferenceLine at the median-bin-count or a text label above the chart.

Actually, re-reading the design: the histogram Y-axis is "count of intervals", and the median gap is in days. A horizontal `ReferenceLine` does not make literal sense here. The most reasonable interpretation consistent with the UI spec ("A horizontal `ReferenceLine` at the median gap in days") suggests the x-axis might be treated as numeric (gap day midpoints) rather than categorical labels — OR the ReferenceLine is displayed as a vertical line at the median bin. [ASSUMED] — the planner should either (a) use a vertical ReferenceLine (`x` prop matching the median bin label) or (b) show median as a text annotation. Recommend vertical line approach since the UI spec says "horizontal" reference line but the axis semantics make a vertical marker more meaningful for interval histograms.

### Pattern 3: Responder Classification — Two-Section Layout

[VERIFIED: 13-CONTEXT.md D-05, 13-UI-SPEC.md]

```typescript
// File: src/components/outcomes/ResponderView.tsx
interface ResponderBuckets {
  responder: PatientCase[];
  partial: PatientCase[];
  nonResponder: PatientCase[];
}

// shared/responderMetric.ts
export function classifyResponders(
  cases: PatientCase[],
  thresholdLetters: number,
  eye: 'od' | 'os' | 'combined'
): ResponderBuckets {
  const thresholdLogmar = thresholdLetters * 0.02; // 5 letters = 0.1 logMAR
  // For each case × eye: find the visus measurement closest to day 365
  // deltaVisus = visusAtYear1 - baseline (in logMAR)
  // Note: lower logMAR = better vision, so improvement = negative delta
  // Responder = delta ≤ -thresholdLogmar (improvement >= threshold)
  // Non-responder = delta >= +thresholdLogmar (worsening >= threshold)
  // Partial = between
}
```

**ETDRS letter conversion:** [VERIFIED: 13-CONTEXT.md D-05]
5 ETDRS letters ≈ 0.1 logMAR. The exact formula: 1 line on ETDRS chart = 0.1 logMAR = 5 letters.
So `thresholdLogmar = thresholdLetters / 50` (50 letters = 1.0 logMAR = 10 ETDRS lines).
This is consistent with `decimalToLogmar` already in the codebase.

**Grouped BarChart pattern:**
```typescript
// Three groups on X-axis: OD, OS, Combined
// Three bar series: responder (green), partial (yellow), nonResponder (red)
<BarChart data={[
  { eye: 'OD', responder: counts.od.responder, partial: counts.od.partial, nonResponder: counts.od.nonResponder },
  { eye: 'OS', ... },
  { eye: 'OD+OS', ... },
]}>
  <Bar dataKey="responder" fill="#16a34a" />
  <Bar dataKey="partial" fill="#ca8a04" />
  <Bar dataKey="nonResponder" fill="#dc2626" />
  <Legend fontSize={12} />
</BarChart>
```

### Pattern 4: Metric Selector — URL-Synced Tab Strip

[VERIFIED: OutcomesView.tsx lines 10-13, 87-100; 13-UI-SPEC.md Interaction Contract]

```typescript
// OutcomesView.tsx — new state + URL sync
const [searchParams, setSearchParams] = useSearchParams();
const activeMetric = (searchParams.get('metric') ?? 'visus') as MetricType;

const handleMetricChange = (metric: MetricType) => {
  setSearchParams((p) => { p.set('metric', metric); return p; });
  resetToMetricDefaults(metric);
};

function resetToMetricDefaults(metric: MetricType) {
  switch (metric) {
    case 'visus':
    case 'crt':
      setYMetric('delta');
      setAxisMode('days');
      setLayers({ median: true, perPatient: true, scatter: defaultScatterOn(cohort.cases.length), spreadBand: true });
      break;
    case 'interval':
      // no y-metric / layer state — only intervalEye
      setIntervalEye('combined');
      break;
    case 'responder':
      // no layer state — fixed layout
      break;
  }
}
```

**ARIA pattern:** [VERIFIED: 13-UI-SPEC.md]
```html
<nav role="tablist">
  <button role="tab" aria-selected={activeMetric === 'visus'}>Visus</button>
  <button role="tab" aria-selected={activeMetric === 'crt'}>CRT</button>
  ...
</nav>
```

### Pattern 5: Metric-Aware CSV Export

[VERIFIED: OutcomesDataPreview.tsx handleExport; download.ts datedFilename]

The existing `handleExport` uses `datedFilename('outcomes-cohort', 'csv')`. For Phase 13, the filename must carry the metric slug. The `OutcomesDataPreview` component will need an `activeMetric` prop and conditionally render different column sets and row data.

```typescript
// Metric-conditional filename — replaces datedFilename('outcomes-cohort', 'csv')
const filename = datedFilename(`outcomes-${activeMetric}-export`, 'csv');

// Metric-conditional headers and rows
if (activeMetric === 'crt') {
  headers = ['pseudonym', 'eye', 'date', 'days_since_baseline', 'crt_um', 'crt_delta_um'];
} else if (activeMetric === 'interval') {
  headers = ['pseudonym', 'eye', 'gap_index', 'gap_days', 'procedure_date'];
} else if (activeMetric === 'responder') {
  headers = ['pseudonym', 'eye', 'bucket', 'delta_visus_letters', 'measurement_date'];
}
```

### Pattern 6: Settings Drawer Metric Visibility

[VERIFIED: OutcomesSettingsDrawer.tsx; 13-UI-SPEC.md Settings Drawer table]

The drawer currently shows all four sections unconditionally. Adding a `activeMetric` prop and conditional rendering:

| Active Metric | Visible Sections |
|--------------|-----------------|
| visus | X-axis, Y-metric (logMAR labels), Layer toggles, Grid points |
| crt | X-axis, Y-metric (µm labels: "Absolut (µm)", "Δ (µm zur Baseline)", "Δ %"), Layer toggles, Grid points |
| interval | Eye selector only (new section) |
| responder | Responder threshold input only (new section) |

Y-metric labels for CRT: the drawer currently shows `outcomesYAbsolute` ("Absolut (logMAR)"). For CRT, these labels must read "Absolut (µm)" / "Δ (µm zur Baseline)" / "Δ %". This requires either new i18n keys or a `metric`-aware label selection.

### Pattern 7: Server Aggregate Extension (D-06)

[VERIFIED: server/outcomesAggregateApi.ts — validateBody function, cache key construction]

**Body validation extension:**
```typescript
// Add to ValidBody interface:
metric: 'visus' | 'crt';

// Add to validateBody():
const VALID_METRICS = new Set(['visus', 'crt']);
const metric = body.metric === undefined ? 'visus' : body.metric;
if (typeof metric !== 'string' || !VALID_METRICS.has(metric)) return null;
```

**Cache key extension:**
```typescript
// Current cache key (line 154-163):
const cacheKey = JSON.stringify({ cohortId, axisMode, yMetric, gridPoints, eye, spreadMode, includePerPatient, includeScatter, user });
// Extended:
const cacheKey = JSON.stringify({ cohortId, axisMode, yMetric, gridPoints, eye, spreadMode, includePerPatient, includeScatter, user, metric });
```

**Computation branch:**
```typescript
const trajectory = metric === 'crt'
  ? computeCrtTrajectory({ cases, axisMode, yMetric, gridPoints, spreadMode })
  : computeCohortTrajectory({ cases, axisMode, yMetric, gridPoints, spreadMode });
```

**Client service extension:**
```typescript
// src/services/outcomesAggregateService.ts
export interface AggregateRequest {
  // ... existing ...
  metric?: 'visus' | 'crt';  // optional for backward compat
}
```

### Pattern 8: i18n Completeness Test Extension

[VERIFIED: tests/outcomesI18n.test.ts]

The existing test checks keys prefixed with `outcomes`. Phase 13 adds `metrics*` keys. The test extension:

```typescript
// tests/outcomesI18n.test.ts — add new describe block or extend existing
it('every metrics* key has a non-empty de and en translation', async () => {
  const mod = await import('../src/i18n/translations');
  const t = (mod as any).translations ?? (mod as any).default;
  const metricsKeys = Object.keys(t).filter((k) => k.startsWith('metrics'));
  expect(metricsKeys.length).toBeGreaterThan(25); // ~35+ new keys
  for (const k of metricsKeys) {
    expect(t[k].de, `${k} has no DE translation`).toBeTruthy();
    expect(t[k].en, `${k} has no EN translation`).toBeTruthy();
  }
});
```

### Anti-Patterns to Avoid

- **Calling `computeCohortTrajectory` twice in `OutcomesView`:** The CRT trajectory must be computed separately and stored in its own state variable. Do not attempt to extract CRT from the visus trajectory.
- **Using `decimalToLogmar` for CRT values:** CRT is stored as raw µm — no conversion needed. Applying logMAR conversion to µm values will produce nonsense.
- **Adding `metric` state to `OutcomesView` as independent React state:** The `activeMetric` should be derived from `useSearchParams()`, not duplicated in `useState`. The URL is the source of truth (D-01).
- **Showing all settings drawer controls regardless of metric:** The drawer must conditionally render sections based on `activeMetric` to prevent nonsensical combinations (D-02).
- **Using array index as React key in new tables:** The CRREV-02 pattern (composite key) must be applied to the interval and responder CSV preview tables.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Histogram bars | Custom SVG bar chart | `recharts BarChart + Bar` | Recharts 3.8.1 already installed, handles responsive sizing, tooltips, legend |
| CSV generation | Custom string concatenation | `buildCsv` + `downloadCsv` in `src/utils/download.ts` | Already handles BOM, quote-escaping, Blob URL pattern |
| Median calculation | Custom sort + middle-element | `percentile(sorted, 0.5)` from `shared/cohortTrajectory.ts` | Already exported, tested, handles edge cases |
| Eye laterality lookup | Inline FHIR coding check | `eyeOf()` from `shared/cohortTrajectory.ts` | Already handles both Observation.bodySite and Procedure.bodySite |
| URL state management | `useState` + `useEffect` for URL sync | `useSearchParams()` + `setSearchParams()` | React Router v7 pattern already used in `OutcomesView` |
| Date arithmetic | Custom millisecond math | `daysBetween()` pattern from `cohortTrajectory.ts` (internal) | Already used for treatment intervals; reuse the pattern |

---

## Common Pitfalls

### Pitfall 1: CRT Y-axis Domain for Delta Mode

**What goes wrong:** Applying the visus absolute y-domain `[0, 2]` to CRT absolute mode, or applying the logMAR-scaled delta range to CRT µm delta.

**Why it happens:** `OutcomesPanel.yDomain()` is currently hardcoded for logMAR: absolute returns `[0, 2]`, delta is data-driven. CRT absolute must return `[0, 800]`.

**How to avoid:** The `metric` prop on `OutcomesPanel` must branch the `yDomain()` function:
```typescript
function yDomain(yMetric: YMetric, medianGrid: GridPoint[], metric: 'visus' | 'crt'): [...] {
  if (yMetric === 'absolute') return metric === 'crt' ? [0, 800] : [0, 2];
  // ... delta logic unchanged (data-driven symmetric, works for both µm and logMAR)
}
```

**Warning signs:** CRT absolute panel shows flat line near zero because logMAR domain `[0,2]` squashes µm values in the 200–500 range.

### Pitfall 2: Interval Histogram Median Reference Line Semantics

**What goes wrong:** `ReferenceLine y={medianGapDays}` interpreted as "draw a horizontal line at y=medianGapDays" — but Y is "count of intervals", not days. medianGap=45 days draws a line at count=45, which may be meaningless.

**Why it happens:** The UI spec says "horizontal ReferenceLine at the median gap in days" — but X-axis is categorical (bin labels) and Y-axis is count.

**How to avoid:** Render the median gap as a text annotation over the chart, or as a vertical marker. The most defensible implementation: annotate the bin that contains the median with a distinct bar color or a label, OR display the median as a stat card above the chart.

**Recommendation:** Render median as a labeled text annotation (`<Label>` in Recharts) or a `<text>` element positioned over the bars, showing "Median: Xd" — not as a ReferenceLine competing with the count Y-axis.

### Pitfall 3: logMAR Sign Convention for Responder Classification

**What goes wrong:** Classifying a patient as "responder" when their logMAR delta is positive (logMAR increased = vision worsened) instead of negative (logMAR decreased = vision improved).

**Why it happens:** In logMAR, lower is better. Improvement = delta < 0. A 5-letter improvement = deltaLogmar ≈ -0.1.

**How to avoid:** In `classifyResponders()`:
- Responder = `deltaLogmar ≤ -thresholdLogmar` (vision improved by at least threshold)
- Non-responder = `deltaLogmar ≥ +thresholdLogmar` (vision worsened by at least threshold)
- When displaying to users, convert to letters: show `-deltaLogmar * 50` letters (positive = gain)

**Warning signs:** All patients classified as non-responders; green bars show 0 patients.

### Pitfall 4: CRT Server Aggregate Cache Invalidation

**What goes wrong:** CRT and visus responses share the same cache key (if `metric` is not included), causing CRT queries to return visus data.

**Why it happens:** Forgetting to add `metric` to the cache key construction in `server/outcomesAggregateApi.ts`.

**How to avoid:** The cache key JSON.stringify must include `metric`. [VERIFIED: outcomesAggregateApi.ts line 154-164 — current key structure; extend with `metric`]

### Pitfall 5: TranslationKey Type Errors

**What goes wrong:** TypeScript compile error when passing new `metrics*` i18n keys to components typed as `(key: TranslationKey) => string`.

**Why it happens:** `TranslationKey = keyof typeof translations` — adding keys to `translations.ts` automatically expands the union type. But if keys are added to `translations.ts` without adding them to the TypeScript const first, import ordering can cause stale types.

**How to avoid:** Add all `metrics*` keys to `translations.ts` in Wave 0 (i18n keys task) before any component references them. Run `npm run typecheck` after adding keys to verify the union expands correctly.

### Pitfall 6: OutcomesDataPreview Metric Dispatch

**What goes wrong:** The `OutcomesDataPreview` component currently calls `flattenToRows(cases)` which iterates `LOINC_VISUS` observations. For CRT export, the same function would return visus data under CRT-labeled columns.

**Why it happens:** `flattenToRows` is hardcoded to `LOINC_VISUS`. [VERIFIED: OutcomesDataPreview.tsx line 68]

**How to avoid:** Add separate flatten functions for each metric, or make `flattenToRows` accept a LOINC code + column configuration. Each metric needs its own data extraction logic:
- CRT: iterate `LOINC_CRT` observations, emit `crt_um` + `crt_delta_um`
- Interval: iterate `SNOMED_IVI` procedures, emit gap calculations
- Responder: iterate classification results, emit bucket + measurement

### Pitfall 7: setSearchParams Clears Other Params

**What goes wrong:** `setSearchParams({ metric: 'crt' })` replaces the entire query string, losing `?cohort=` and `?filter=` params.

**Why it happens:** React Router v7 `setSearchParams(object)` replaces all params.

**How to avoid:** Always use the functional form: [VERIFIED: 13-CONTEXT.md D-01]
```typescript
setSearchParams((p) => { p.set('metric', value); return p; });
```
This is already the documented pattern and matches how the existing visus view handles params.

---

## Code Examples

### CRT Observation Extraction (mirror of visus pattern)

```typescript
// Source: shared/cohortTrajectory.ts lines 293-296 (visus pattern to mirror)
// For CRT: replace LOINC_VISUS with LOINC_CRT, remove decimalToLogmar
const allCrt = getObservationsByCode(c.observations, LOINC_CRT);
const odCrt = allCrt.filter((o) => eyeOf(o.bodySite) === 'od');
// valueQuantity.value is already in µm — no conversion needed
const baselineMicron = baselineObs.valueQuantity?.value ?? NaN;
```

### Interval Gap Computation

```typescript
// Source: Pattern from SNOMED_IVI usage in cohortTrajectory.ts (treatmentIndexAt)
// For gap computation: sort by date, compute consecutive differences
const iviDates = case.procedures
  .filter(p => p.code.coding.some(c => c.code === SNOMED_IVI))
  .filter(p => eye === 'combined' || eyeOf(p.bodySite) === eye)
  .filter(p => p.performedDateTime)
  .map(p => p.performedDateTime!)
  .sort();

const gaps: number[] = [];
for (let i = 1; i < iviDates.length; i++) {
  const gap = Math.floor(
    (new Date(iviDates[i]).getTime() - new Date(iviDates[i-1]).getTime()) / 86400000
  );
  gaps.push(gap);
}
```

### Bin Boundaries

```typescript
// Source: 13-CONTEXT.md D-04
const BINS = [
  { label: '0–30d', min: 0, max: 30 },
  { label: '30–60d', min: 30, max: 60 },
  { label: '60–90d', min: 60, max: 90 },
  { label: '90–120d', min: 90, max: 120 },
  { label: '120–180d', min: 120, max: 180 },
  { label: '180+d', min: 180, max: Infinity },
] as const;

function gapBin(gap: number): number {
  return BINS.findIndex(b => gap >= b.min && gap < b.max);
}
```

### Responder Threshold Conversion

```typescript
// Source: 13-CONTEXT.md D-05 — "5 logMAR letters ≈ 0.1 logMAR"
// ETDRS: 1 line = 5 letters = 0.1 logMAR → 1 letter = 0.02 logMAR
// But the codebase uses logMAR = -log10(decimal) convention
// Improvement in vision = logMAR decreases = delta is negative
const thresholdLogmar = thresholdLetters * 0.02; // always positive

// Responder: delta ≤ -thresholdLogmar (improved)
// Non-responder: delta ≥ +thresholdLogmar (worsened)
```

### Eye Selector Segmented Control (Interval Histogram)

```typescript
// Source: 13-UI-SPEC.md Interaction Contract — D-04
// Three-button toggle above the histogram
<div role="group" aria-label={t('metricsIntervalEyeSelector')}>
  {(['od', 'os', 'combined'] as const).map((eye) => (
    <button
      key={eye}
      type="button"
      onClick={() => setIntervalEye(eye)}
      className={intervalEye === eye
        ? 'px-3 py-1 text-xs rounded bg-violet-700 text-white'
        : 'px-3 py-1 text-xs rounded bg-white border border-gray-200 text-gray-700'}
    >
      {eye === 'od' ? 'OD' : eye === 'os' ? 'OS' : 'OD + OS'}
    </button>
  ))}
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `OutcomesPage.tsx` route | `OutcomesView.tsx` tab inside `AnalysisPage` | Phase 9/12 | The route change means `?metric=` must be handled inside `OutcomesView`, not `AnalysisPage` |
| Client-only aggregation | Size-based routing to `POST /api/outcomes/aggregate` | Phase 12 | CRT also routes server-side at >1000 patients |
| Single metric (Visus) | Multi-metric with selector | Phase 13 | All new work |

**Deprecated/outdated:**
- `src/pages/OutcomesPage.tsx`: Removed in Phase 9/12, replaced by `OutcomesView` tab. Do NOT attempt to restore or reference this file.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Interval histogram "median reference line" should be displayed as a text annotation rather than a true `ReferenceLine y={medianGap}` (since Y-axis is count, not days) | Architecture Patterns § Pattern 2, Pitfall 2 | Wrong: the median line may be misrendered as a horizontal line at count=medianGapDays which could be confusing or overflowed |
| A2 | 1 ETDRS letter = 0.02 logMAR (5 letters = 0.1 logMAR = 1 ETDRS line) | Code Examples § Responder Threshold Conversion | Wrong: incorrect classification threshold; patients classified into wrong buckets. Standard ophthalmology conversion — well-established but [ASSUMED] not verified against project-specific documentation |
| A3 | CRT LOINC code `LP267955-5` in `shared/fhirCodes.ts` matches what's actually stored in the synthetic FHIR bundles | Architecture Patterns § Pattern 1 | Wrong: `computeCrtTrajectory()` returns 0 measurements for all patients; CRT panels show empty state |

**If A3 is a risk:** The synthetic bundle generator at `scripts/generate-center-bundle.ts` should be checked to confirm CRT observations use `LP267955-5`. [NOT VERIFIED in this research session — add to Wave 0 verification]

---

## Open Questions (RESOLVED)

1. **Interval histogram median line rendering** — RESOLVED
   - Resolution: Plan 13-03 renders the median as a `<p data-testid="interval-median">Median: {medianGap}d</p>` text annotation above the histogram, NOT as `ReferenceLine y={medianGap}`. The Y-axis is count (not days), so a ReferenceLine at count=medianGapDays is semantically incorrect. Text annotation is the correct approach.

2. **CRT observations in synthetic bundles** — RESOLVED
   - Resolution: Verified `scripts/generate-center-bundle.ts` line 74 defines `CRT_CODE = { system: LOINC, code: 'LP267955-5', display: 'Central retinal thickness' }` and lines 211–224 generate CRT observations for every patient (baseline + every 3rd visit), with realistic µm values in range [200, 600] trending downward with noise. No Wave 0 patching needed.

3. **Responder "closest to 365 days" measurement lookup** — RESOLVED
   - Resolution: Plan 13-04 implements as days since first baseline observation (matching `axisMode='days'` x-axis convention), finding the measurement that minimizes `Math.abs(daysSinceBaseline - 365)` with a ±180-day window (`YEAR_1_WINDOW_DAYS = 180`, `YEAR_1_TARGET_DAYS = 365`).

---

## Environment Availability

Step 2.6: SKIPPED — Phase 13 is purely code/component additions with no new external dependencies. All tools (Node 22, npm, vitest) are present and verified.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` (inferred from package.json `"test": "vitest run"`) |
| Quick run command | `npm test -- --reporter=dot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| METRIC-01 | CRT trajectory computation matches visus parity for µm units | unit | `npm test -- tests/crtTrajectory.test.ts` | ❌ Wave 0 |
| METRIC-02 | `computeIntervalDistribution` buckets gaps correctly, median correct | unit | `npm test -- tests/intervalMetric.test.ts` | ❌ Wave 0 |
| METRIC-03 | `classifyResponders` returns correct buckets at threshold boundary | unit | `npm test -- tests/responderMetric.test.ts` | ❌ Wave 0 |
| METRIC-04 | `?metric=` param round-trip: set param → refresh → same metric shown | unit | `npm test -- tests/outcomesMetricSelector.test.ts` | ❌ Wave 0 |
| METRIC-05 | CSV export per metric has metric-appropriate columns + slug filename | unit | `npm test -- tests/outcomesDataPreview.test.ts` (extend existing or create) | ❌ Wave 0 |
| METRIC-06 | All `metrics*` keys have DE + EN translations | unit | `npm test -- tests/outcomesI18n.test.ts` | ✅ (extend) |

### Sampling Rate

- **Per task commit:** `npm test -- tests/outcomesI18n.test.ts tests/cohortTrajectory.test.ts`
- **Per wave merge:** `npm test` (full suite — must preserve 313+ tests)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/crtTrajectory.test.ts` — METRIC-01: unit tests for `computeCrtTrajectory` (absolute µm, delta µm, delta%)
- [ ] `tests/intervalMetric.test.ts` — METRIC-02: bin assignment, gap computation, median, empty cohort, single-procedure patients
- [ ] `tests/responderMetric.test.ts` — METRIC-03: threshold boundary cases, logMAR sign convention, eye filtering
- [ ] `tests/outcomesMetricSelector.test.ts` — METRIC-04: `?metric=` URL param read/write, backward compat (no param = visus), param preservation on switch

---

## Security Domain

Phase 13 has no new auth, no new API endpoints beyond extending the existing `POST /api/outcomes/aggregate`. The existing center-filtering-from-JWT invariant is preserved by D-06 (server branches on metric but center filtering remains server-enforced). No new ASVS categories are introduced.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (metric param in aggregate body) | Extend `validateBody()` with `VALID_METRICS` set |
| V4 Access Control | inherited | JWT center filter already enforced in outcomesAggregateApi.ts |
| V2 Authentication | no new auth | Existing middleware |

**Only actionable security item:** Add `metric` to the server-side allowlist (`VALID_METRICS = new Set(['visus', 'crt'])`) in `validateBody()`. Interval and Responder are client-only computations with no new API surface.

---

## Sources

### Primary (HIGH confidence)

- `shared/cohortTrajectory.ts` — full file read; CRT pattern directly mirrors visus trajectory
- `shared/fhirCodes.ts` — confirmed `LOINC_CRT = 'LP267955-5'` and `SNOMED_IVI = '36189003'` are defined
- `src/components/outcomes/OutcomesView.tsx` — full file read; metric selector integration points identified
- `src/components/outcomes/OutcomesPanel.tsx` — full file read; `yDomain` logic verified
- `src/components/outcomes/OutcomesSettingsDrawer.tsx` — full file read; section structure verified
- `src/components/outcomes/OutcomesEmptyState.tsx` — full file read; variant pattern verified
- `src/components/outcomes/OutcomesDataPreview.tsx` — full file read; CSV export pattern verified
- `src/components/outcomes/palette.ts` — full file read; EYE_COLORS and SERIES_STYLES verified
- `src/utils/download.ts` — full file read; `datedFilename` and `downloadCsv` verified
- `src/services/outcomesAggregateService.ts` — full file read; `AggregateRequest` interface verified
- `server/outcomesAggregateApi.ts` — full file read; cache key construction and validateBody verified
- `src/i18n/translations.ts` — full file read; outcomes* key patterns verified (~90 keys)
- `tests/outcomesI18n.test.ts` — full file read; test pattern for metrics* extension verified
- `package.json` — recharts 3.8.1, react 19.2.4, vitest 4.1.4, typescript 6.0.2 confirmed
- `.planning/phases/13-new-outcome-metrics-crt-interval-responder/13-CONTEXT.md` — all decisions locked
- `.planning/phases/13-new-outcome-metrics-crt-interval-responder/13-UI-SPEC.md` — component inventory, colors, copy, interaction contracts

### Tertiary (LOW confidence — flagged in Assumptions Log)

- ETDRS letter-to-logMAR conversion (A2) — standard ophthalmology knowledge, not verified against project docs
- Interval histogram median line rendering interpretation (A1) — design intent ambiguous from UI spec

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and existing imports
- Architecture: HIGH — all patterns directly mirror existing code; decisions locked in CONTEXT.md
- Pitfalls: HIGH — identified from direct code reading of the files to be modified
- Open questions: MEDIUM — A1 (median line) is implementation detail; A2 (ETDRS) is standard medical knowledge; A3 (synthetic bundles) needs verification

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable codebase; no external dependencies to expire)
