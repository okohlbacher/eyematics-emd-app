# Phase 16: Cross-Cohort Comparison - Research

**Researched:** 2026-04-21
**Domain:** React / Recharts multi-series chart overlay + drawer UI + URL state encoding
**Confidence:** HIGH

## Summary

Phase 16 adds cross-cohort trajectory comparison to the existing `OutcomesView` / `OutcomesPanel` stack. All infrastructure (Recharts `ComposedChart`, slide-over drawer, URL search params, `savedSearches` data, trajectory computation) already exists and is stable. The work is entirely additive: new `COHORT_PALETTES`, a `CohortCompareDrawer`, multi-series props on `OutcomesPanel`, URL read/write for `?cohorts=`, and the VIS-04 spaghetti-hierarchy tweak.

No new dependencies are required. Every technical decision is locked in CONTEXT.md. The main implementation question the planner must answer is the `OutcomesPanel` extension strategy: whether to extend the existing component with optional multi-series props or create a thin `CrossCohortPanel` wrapper. The research below recommends extending in-place because the component is already responsible for legend, axis, IQR, and scatter layers — forking doubles maintenance.

VIS-04 is a two-line palette change (`perPatient` stroke color from `color` to `#9ca3af`, opacity to 0.22, `median` strokeWidth from 3 to 4) and is low-risk.

**Primary recommendation:** Extend `OutcomesPanel` with optional `cohortSeries?: CohortSeries[]` prop; when the prop is provided the panel renders one `Line` + `Area` per cohort instead of the single-color single-cohort path. All existing single-cohort tests remain green because the new prop is optional.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** A GitCompare/Layers icon button sits beside the existing gear icon in the outcomes header top-right. Clicking it opens the cohort comparison drawer.
- **D-02:** Mechanism is a slide-over drawer (same pattern as `OutcomesSettingsDrawer`). Lists all `savedSearches` with checkboxes — max 4 selectable. Shows cohort name + patient count per entry. Primary cohort (from `?cohort=`) is pre-checked and cannot be unchecked.
- **D-03:** Keep the 3-panel grid (OD / OS / combined). Each `OutcomesPanel` renders all selected cohorts as overlaid series using `COHORT_PALETTES` colors. COHORT_PALETTES colors replace the per-eye colors for cross-cohort series.
- **D-04:** Legend in each panel shows cohort display name + `(N=X patients)` per cohort.
- **D-05:** `?cohorts=id1,id2` encodes cross-cohort state. `?cohort=id` (single-cohort) continues unchanged. `?cohorts=` takes precedence when both params are present.
- **D-06:** `COHORT_PALETTES` — 4 WCAG 3:1 compliant colors, distinct from `EYE_COLORS`. Planner/researcher pick specific values.
- **D-07:** In cross-cohort mode, per-patient lines are **locked off** — not toggleable via the settings drawer.
- **D-08:** axisMode, yMetric, gridPoints settings apply globally to all cohorts (no per-cohort overrides).
- **D-09:** Per-patient lines (VIS-04): render as `#9ca3af` (Tailwind gray-400) at ~20-25% opacity. Median line stays full-saturation `EYE_COLORS[eye]` at strokeWidth 4px.
- **D-10:** VIS-04 applies to the visus and CRT metric tabs only.

### Claude's Discretion

- Exact `COHORT_PALETTES` hex values (must pass WCAG 3:1 on white, distinct from blue/red/violet)
- Whether the compare drawer shows a "Clear all" / "Reset" button
- How the header subtitle changes in cross-cohort mode (e.g., "4 cohorts compared")
- Whether a "you're comparing X cohorts" summary bar appears above the charts

### Deferred Ideas (OUT OF SCOPE)

- Chart layout: single-chart or eye-selector tabs (user chose 3-panel grid)
- Per-patient line toggle in cross-cohort mode (locked off, not configurable)
- Per-cohort axis mode / yMetric overrides
- Phase 17 (dark mode) COHORT_PALETTES dark-mode variants
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XCOHORT-01 | User can select up to 4 saved cohorts for overlay comparison on a single trajectory chart | `savedSearches` array in `useData()` provides cohort list; checkboxes in `CohortCompareDrawer`; max-4 guard in selection handler |
| XCOHORT-02 | Cross-cohort view suppresses per-patient lines; renders median + IQR band per cohort with distinct 4-color categorical palette | `OutcomesPanel` extension: `cohortSeries` prop drives multi-series render; per-patient render blocked when `cohortSeries.length > 1`; `COHORT_PALETTES` for colors |
| XCOHORT-03 | Each cohort's legend entry shows patient count `(N=X patients)` | Recharts `<Line name="Cohort A (N=42 patients)">` populates the `<Legend>` automatically |
| XCOHORT-04 | `?cohorts=id1,id2` deep-link URL parameter encodes cross-cohort view state | `useSearchParams` + `setSearchParams` already in `OutcomesView`; extend read/write to handle `cohorts` param |
| VIS-04 | Individual patient curves rendered at low opacity and desaturated color; median line overplotted with increased stroke weight | Two-field change in `SERIES_STYLES` (perPatient color + opacity, median strokeWidth); applies to per-patient `<Line>` stroke and `median` `<Line>` strokeWidth |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 | `ComposedChart` multi-series rendering | Already the chart layer; `Line` + `Area` per cohort is the standard pattern [VERIFIED: package.json] |
| lucide-react | 1.8.0 | `GitCompare` and `Layers` icons | Already a dep; both icons confirmed present [VERIFIED: node_modules inspection] |
| react-router-dom | 7.14.0 | `useSearchParams` / `setSearchParams` | Already driving `?cohort=`, `?metric=` URL state [VERIFIED: package.json] |
| tailwindcss | 4.2.2 | Styling for drawer + header button | Entire app uses Tailwind; no CSS modules [VERIFIED: package.json] |
| vitest | 4.1.4 | Test framework | Established; `// @vitest-environment jsdom` docblock for component tests [VERIFIED: vitest.config.ts] |

**Installation:** None required.

### New Artifacts to Create

| Artifact | Path | Type |
|----------|------|------|
| `CohortCompareDrawer` | `src/components/outcomes/CohortCompareDrawer.tsx` | New component |
| `COHORT_PALETTES` export | `src/components/outcomes/palette.ts` | Addition to existing file |
| `OutcomesPanel` multi-series extension | `src/components/outcomes/OutcomesPanel.tsx` | Prop extension |
| `OutcomesView` cross-cohort mode | `src/components/outcomes/OutcomesView.tsx` | Logic + URL additions |
| i18n keys | `src/i18n/translations.ts` | Key additions |

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
src/
├── components/outcomes/
│   ├── CohortCompareDrawer.tsx     # NEW — mirrors OutcomesSettingsDrawer structure
│   ├── OutcomesPanel.tsx           # EXTEND — optional cohortSeries prop
│   ├── OutcomesView.tsx            # EXTEND — cross-cohort mode + URL
│   └── palette.ts                 # EXTEND — COHORT_PALETTES constant + VIS-04 tweaks
└── i18n/
    └── translations.ts            # EXTEND — new i18n keys
```

### Pattern 1: Multi-Series Props on OutcomesPanel

**What:** Add an optional `cohortSeries?: CohortSeriesEntry[]` prop. When absent, existing single-cohort path runs unchanged. When present, the chart renders one `Line` + `Area` per entry using COHORT_PALETTES colors instead of `EYE_COLORS`.

**When to use:** Cross-cohort mode (`?cohorts=` present in URL).

**CohortSeriesEntry type:**
```typescript
// Source: inferred from PanelResult shape in shared/cohortTrajectory.ts
export interface CohortSeriesEntry {
  cohortId: string;
  cohortName: string;
  patientCount: number;
  color: string;           // from COHORT_PALETTES[index]
  panel: PanelResult;      // computeCohortTrajectory result for this cohort
}
```

**OutcomesPanel prop extension:**
```typescript
// Source: OutcomesPanel.tsx existing Props interface
interface Props {
  // ... existing props unchanged ...
  cohortSeries?: CohortSeriesEntry[];  // when present: cross-cohort mode
}
```

**Render logic in OutcomesPanel:**
```typescript
// Source: pattern inferred from existing panel.patients loop
const isCrossMode = Boolean(cohortSeries && cohortSeries.length > 1);

// Suppress per-patient block when cross-cohort
if (!isCrossMode && layers.perPatient) {
  // ... existing per-patient lines loop ...
}

// Multi-cohort median + IQR when cross-mode
if (isCrossMode && cohortSeries) {
  cohortSeries.map((series, i) => (
    <>
      <Area key={`iqr-${series.cohortId}`} ... fill={series.color} ... />
      <Line
        key={`median-${series.cohortId}`}
        data={series.panel.medianGrid}
        dataKey="y"
        stroke={series.color}
        strokeWidth={SERIES_STYLES.median.strokeWidth}
        name={`${series.cohortName} (N=${series.patientCount} patients)`}
        ...
      />
    </>
  ))
}
```

### Pattern 2: Cross-Cohort Mode Detection in OutcomesView

**What:** Derive `crossCohortIds: string[]` from `?cohorts=` param. Run `computeCohortTrajectory` once per cohort ID using `useMemo`. Pass resulting `cohortSeries` arrays to each `OutcomesPanel`.

**Example:**
```typescript
// Source: extends existing OutcomesView URL reading pattern
const cohortIdsParam = searchParams.get('cohorts');
const isCrossMode = Boolean(cohortIdsParam);
const crossCohortIds: string[] = isCrossMode
  ? cohortIdsParam!.split(',').filter(Boolean).slice(0, 4)
  : [];

// Memoize all cohort aggregates
const crossCohortAggregates = useMemo(() => {
  if (!isCrossMode || crossCohortIds.length === 0) return null;
  return crossCohortIds.map((id, idx) => {
    const saved = savedSearches.find((s) => s.id === id);
    if (!saved) return null;
    const cases = applyFilters(activeCases, saved.filters);
    const result = computeCohortTrajectory({ cases, axisMode, yMetric, gridPoints, spreadMode });
    return {
      cohortId: id,
      cohortName: saved.name,
      patientCount: cases.length,
      color: COHORT_PALETTES[idx],
      od: result.od,
      os: result.os,
      combined: result.combined,
    };
  }).filter(Boolean);
}, [isCrossMode, crossCohortIds, savedSearches, activeCases, axisMode, yMetric, gridPoints, spreadMode]);
```

### Pattern 3: CohortCompareDrawer Structure

**What:** Slide-over drawer identical to `OutcomesSettingsDrawer` layout; renders checkboxes for each `savedSearch`. The primary cohort is pre-checked and disabled. Max 4 enforced by disabling unchecked items when 4 are already selected.

**Drawer structural pattern (from OutcomesSettingsDrawer.tsx):**
```typescript
// Source: OutcomesSettingsDrawer.tsx — cloned layout
<aside
  id="outcomes-compare-drawer"
  className={`fixed right-0 top-0 h-screen w-full sm:w-96 bg-white border-l border-gray-200 shadow-lg z-40 transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
>
  {/* Header with X button */}
  {/* Scrollable body: checkbox list of savedSearches */}
  {/* Footer: optional "Clear all" button */}
</aside>
```

**Max-4 enforcement:**
```typescript
const isMaxReached = selectedIds.length >= 4;
// For each savedSearch checkbox:
disabled={isMaxReached && !selectedIds.includes(s.id) && s.id !== primaryCohortId}
```

### Pattern 4: URL Serialization

**What:** `?cohorts=id1,id2,id3` written by `setSearchParams`. Read at mount to restore selection. Mutually exclusive with `?cohort=` — `?cohorts=` takes precedence.

```typescript
// Write
setSearchParams((p) => {
  if (selectedIds.length > 1) {
    p.set('cohorts', selectedIds.join(','));
    p.delete('cohort');  // avoid ambiguity
  } else {
    p.delete('cohorts');
  }
  return p;
});

// Read (already handled by crossCohortIds derivation above)
```

### Pattern 5: VIS-04 Palette Changes

**What:** Two changes to `SERIES_STYLES` in `palette.ts`.

```typescript
// Source: palette.ts SERIES_STYLES (existing)
// BEFORE:
perPatient: { strokeWidth: 1.5, opacityDense: 0.6, opacitySparse: 0.3 },
median: { strokeWidth: 3 },

// AFTER (VIS-04):
perPatient: { strokeWidth: 1.5, opacityDense: 0.22, opacitySparse: 0.12, color: '#9ca3af' },
median: { strokeWidth: 4 },
```

In `OutcomesPanel.tsx`, the per-patient `<Line>` stroke is currently `color` (the eye color). VIS-04 changes it to `SERIES_STYLES.perPatient.color` (`#9ca3af`).

### Pattern 6: COHORT_PALETTES Definition

```typescript
// Source: computed via relativeLuminance/computeContrastRatio — all verified above
// All pass WCAG 3:1 graphical threshold vs #ffffff:
//   emerald-700 #047857  5.48:1
//   amber-700   #b45309  5.02:1
//   cyan-700    #0e7490  5.36:1
//   fuchsia-700 #a21caf  6.32:1
// None overlap EYE_COLORS (blue-700, red-700, violet-700)
export const COHORT_PALETTES = [
  '#047857', // emerald-700
  '#b45309', // amber-700
  '#0e7490', // cyan-700
  '#a21caf', // fuchsia-700
] as const satisfies readonly string[];
```

### Anti-Patterns to Avoid

- **Forking OutcomesPanel into a separate CrossCohortPanel:** Doubles maintenance; IQR, axis, tooltip, and legend logic would need to be duplicated. Extend with optional prop instead.
- **Calling `computeCohortTrajectory` inside OutcomesPanel:** Panels are pure renderers. All computation stays in `OutcomesView` useMemo — consistent with existing pattern.
- **Using `?cohort=` and `?cohorts=` simultaneously:** CONTEXT.md D-05 says they are mutually exclusive. Writing both creates ambiguous URL state.
- **Per-cohort scatter in cross-mode:** Not in scope (scatter is suppressed with per-patient lines); do not attempt to render cross-cohort scatter.
- **Hardcoding cohort count limit in the panel:** Limit enforcement belongs in the drawer's selection handler, not in the render path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slide-over drawer | Custom animation/portal | Clone `OutcomesSettingsDrawer.tsx` layout (Tailwind translate-x transition) | Already implemented, tested, accessible |
| WCAG contrast verification | Custom color math | `computeContrastRatio` / `relativeLuminance` already in `palette.ts` | Correct formula already present; just call it in tests |
| Multi-series legend | Custom legend component | Recharts `<Legend>` + `<Line name="...">` | Name prop automatically populates legend chip |
| URL state | Custom history management | `useSearchParams` + `setSearchParams` (react-router-dom 7) | Established pattern in OutcomesView |

---

## Common Pitfalls

### Pitfall 1: Recharts Legend Chip Explosion

**What goes wrong:** Adding per-patient `<Line>` elements in cross-cohort mode without `legendType="none"` causes hundreds of legend chips to appear.

**Why it happens:** Recharts injects a legend chip for every `Line` child that doesn't explicitly opt out.

**How to avoid:** All per-patient `<Line>` components already carry `legendType="none"` in the existing code. The per-cohort median lines must NOT have `legendType="none"` — they must appear in the legend.

**Warning signs:** Legend overflows chart container; visual clutter; Phase 10 bug report documented this exact issue.

### Pitfall 2: IQR baseLine Prop Shape

**What goes wrong:** Passing a dataKey string to the Recharts `Area` `baseLine` prop silently breaks the IQR band rendering.

**Why it happens:** Recharts 3.8.1 `baseLine` accepts `number | ReadonlyArray<NullableCoordinate>`, NOT a dataKey string. Phase 8 research incorrectly assumed dataKey support.

**How to avoid:** Pass `baseLine` as a coordinate array (`panel.medianGrid.map((g) => ({ x: g.x, y: g.p25 }))`). The existing code already does this correctly — replicate the same pattern for cross-cohort IQR bands.

**Warning signs:** IQR band renders as flat line or disappears entirely.

### Pitfall 3: useMemo Hook Order Violation

**What goes wrong:** Adding a new `useMemo` call after an early-return guard causes React to throw the "Rules of Hooks" error in some render paths.

**Why it happens:** React requires hooks to be called in the same order on every render. `OutcomesView` already has a comment (D-26) noting this constraint: all `useMemo` hooks are hoisted above early returns.

**How to avoid:** Add `crossCohortAggregates` useMemo ABOVE any conditional return statements in `OutcomesView`, alongside the existing `aggregate` and `crtAggregate` memos.

**Warning signs:** React invariant violation at runtime in tests or dev mode.

### Pitfall 4: i18n Key Completeness Test Failure

**What goes wrong:** Adding new `t('outcomes*')` call sites in components without adding corresponding keys to `translations.ts` causes `outcomesI18n.test.ts` to fail.

**Why it happens:** `tests/outcomesI18n.test.ts` walks `src/` for all `t('outcomes*')` string literals and verifies each key has both DE and EN translations.

**How to avoid:** For every new `t('outcomes*')` call added in Phase 16, add the corresponding key object with both `de` and `en` strings to `translations.ts` before committing.

**Warning signs:** `outcomesI18n.test.ts` fails with "key not found" or "missing DE/EN" assertion.

### Pitfall 5: Primary Cohort Cannot Be Deselected

**What goes wrong:** The primary cohort (`?cohort=id`) must always be in the comparison. If the user can uncheck it, the `?cohort=` route resolution breaks.

**Why it happens:** CONTEXT.md D-02 says the primary cohort is pre-checked and cannot be unchecked.

**How to avoid:** In `CohortCompareDrawer`, the checkbox for `primaryCohortId` is `disabled` and `checked`. Wrap it with a tooltip or note explaining it is the baseline cohort.

**Warning signs:** User unchecks primary cohort; URL drops original `?cohort=` param; single-cohort fallback no longer resolves.

### Pitfall 6: Server-Side Routing in Cross-Cohort Mode

**What goes wrong:** In cross-cohort mode, `routeServerSide` (driven by `cohort.cases.length > threshold`) may be `true` for the primary cohort, causing `OutcomesView` to try server aggregation while also computing client-side for the additional cohorts.

**Why it happens:** The existing server-routing logic checks only the primary cohort's size. Additional cohorts always use the client compute path.

**How to avoid:** In cross-cohort mode, bypass `routeServerSide` entirely — set `serverAggregate = null` and compute all cohorts client-side via `computeCohortTrajectory`. The `crossCohortAggregates` memo handles this naturally because it never calls `postAggregate`. The existing `routeServerSide` guard in `renderBody()` should be short-circuited when `isCrossMode` is true.

**Warning signs:** Mixed server/client result displayed; one cohort panel shows server data while others show client data.

---

## Code Examples

### i18n Keys Required (Phase 16)

```typescript
// Source: translations.ts existing pattern; new keys to add
outcomesCrossMode: {
  de: '{count} Kohorten verglichen',
  en: '{count} cohorts compared',
},
outcomesCompareDrawerTitle: {
  de: 'Kohorten vergleichen',
  en: 'Compare Cohorts',
},
outcomesCompareDrawerHint: {
  de: 'Bis zu 4 Kohorten auswählen',
  en: 'Select up to 4 cohorts',
},
outcomesComparePrimaryLabel: {
  de: 'Basis-Kohorte (fest)',
  en: 'Primary cohort (locked)',
},
outcomesCompareOpenDrawer: {
  de: 'Kohorten vergleichen',
  en: 'Compare cohorts',
},
```

### Recharts Multi-Series Render (cross-cohort mode)

```typescript
// Source: OutcomesPanel.tsx pattern, extended for cohortSeries
{isCrossMode && cohortSeries?.map((series) => {
  const iqrData = series.panel.medianGrid.map((g) => ({
    x: g.x, iqrLow: g.p25, iqrHigh: g.p75,
  }));
  const iqrBaseLine = series.panel.medianGrid.map((g) => ({ x: g.x, y: g.p25 }));
  return (
    <>
      <Area
        key={`iqr-${series.cohortId}`}
        data={iqrData}
        dataKey="iqrHigh"
        baseLine={iqrBaseLine}
        fill={series.color}
        fillOpacity={SERIES_STYLES.iqr.fillOpacity}
        stroke={SERIES_STYLES.iqr.stroke}
        isAnimationActive={false}
        legendType="none"
      />
      <Line
        key={`median-${series.cohortId}`}
        data={series.panel.medianGrid}
        dataKey="y"
        type="linear"
        stroke={series.color}
        strokeWidth={SERIES_STYLES.median.strokeWidth}
        dot={false}
        isAnimationActive={false}
        name={`${series.cohortName} (N=${series.patientCount} patients)`}
      />
    </>
  );
})}
```

### VIS-04: Per-Patient Line Stroke Change

```typescript
// Source: OutcomesPanel.tsx lines 197-221 (existing per-patient loop)
// BEFORE:
stroke={color}
strokeOpacity={p.sparse ? SERIES_STYLES.perPatient.opacitySparse : SERIES_STYLES.perPatient.opacityDense}

// AFTER (VIS-04 — D-09):
stroke={SERIES_STYLES.perPatient.color}   // '#9ca3af'
strokeOpacity={p.sparse ? SERIES_STYLES.perPatient.opacitySparse : SERIES_STYLES.perPatient.opacityDense}
// opacityDense: 0.6 -> 0.22, opacitySparse: 0.3 -> 0.12
```

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is frontend-only React/TypeScript code changes using already-installed npm packages).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/OutcomesPanel.test.tsx tests/outcomesPalette.contrast.test.ts tests/outcomesI18n.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| XCOHORT-01 | Drawer renders up to 4 selectable cohorts; primary pre-checked and disabled | unit (jsdom) | `npx vitest run tests/cohortCompareDrawer.test.tsx` | ❌ Wave 0 |
| XCOHORT-02 | Cross-cohort mode: per-patient lines absent; median+IQR per cohort visible | unit (jsdom) | `npx vitest run tests/OutcomesPanel.test.tsx` | ✅ extend |
| XCOHORT-03 | Legend entries show `(N=X patients)` format per cohort | unit (jsdom) | `npx vitest run tests/OutcomesPanel.test.tsx` | ✅ extend |
| XCOHORT-04 | `?cohorts=id1,id2` restores cross-cohort selection on load | unit (jsdom) | `npx vitest run tests/OutcomesViewRouting.test.tsx` | ✅ extend |
| VIS-04 | Per-patient stroke is gray (#9ca3af) + low opacity; median strokeWidth=4 | unit (jsdom) | `npx vitest run tests/OutcomesPanel.test.tsx` | ✅ extend |
| COHORT_PALETTES | All 4 colors pass WCAG 3:1 vs #ffffff | unit | `npx vitest run tests/outcomesPalette.contrast.test.ts` | ✅ extend |
| i18n | All new `t('outcomes*')` keys have DE+EN translations | unit | `npx vitest run tests/outcomesI18n.test.ts` | ✅ auto-catches |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/OutcomesPanel.test.tsx tests/outcomesPalette.contrast.test.ts tests/outcomesI18n.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/cohortCompareDrawer.test.tsx` — covers XCOHORT-01 (drawer checkbox behavior, max-4 enforcement, primary cohort locked)

*(All other test files exist; they need test-case additions, not new files.)*

---

## Security Domain

The `security_enforcement` key is absent from `.planning/config.json`. Treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 16 has no auth changes |
| V3 Session Management | no | No session changes |
| V4 Access Control | partial | Cohort IDs in URL — server already enforces cohort ownership; `?cohorts=` IDs are resolved via `savedSearches` from `useData()` which is pre-authorized server data |
| V5 Input Validation | yes | `cohorts` URL param parsed via `.split(',').filter(Boolean).slice(0, 4)` — limit enforced client-side; unknown IDs silently filtered out (saved is undefined → skipped) |
| V6 Cryptography | no | No new crypto surface |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged `?cohorts=` containing IDs from other users | Information Disclosure | `savedSearches.find(s => s.id === id)` returns `undefined` for IDs not owned by the current user; those cohorts silently skip — no data leak |
| URL param too long / DoS via many cohort IDs | DoS | `.slice(0, 4)` hard limit on client; server is not queried for cross-cohort in Phase 16 (client-side only) |

---

## Open Questions (RESOLVED)

1. **Should the compare drawer hide or disable the per-patient layers toggle in the settings drawer when cross-mode is active?**
   - What we know: D-07 says per-patient is locked off in cross-mode; the layers section in `OutcomesSettingsDrawer` currently has an unconstrained `perPatient` checkbox.
   - What's unclear: The planner must decide whether to hide the entire "Display Layers" section or just disable the per-patient checkbox with explanatory text when `isCrossMode` is true.
   - Recommendation: Hide the `perPatient` checkbox only (not the entire section) and add a note such as "Per-patient lines are suppressed in comparison mode."
   - RESOLVED: Plan 16-04 Task 2 hides the `perPatient` checkbox and adds a suppression note when `isCrossMode` is true.

2. **Header subtitle format in cross-cohort mode**
   - What we know: CONTEXT.md mentions "4 cohorts compared" as an example; this is Claude's discretion.
   - Recommendation: Use `{count} cohorts compared · {name1}, {name2}...` truncated at ~50 chars using a utility. Keep it within the existing `<p className="text-gray-500 text-sm mt-1">` subtitle element.
   - RESOLVED: Plan 16-04 Task 1 step I implements this subtitle format.

3. **"Clear all" button in compare drawer**
   - What we know: Claude's discretion.
   - Recommendation: Include a "Reset to single cohort" link in the drawer footer (matching the `outcomesResetSettings` link style). This removes `?cohorts=` and restores `?cohort=primaryId` only.
   - RESOLVED: Plan 16-03 Task 1 implements the "Reset to single cohort" footer link.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Server-side routing (`routeServerSide`) should be bypassed entirely in cross-cohort mode | Architecture Patterns (Pitfall 6) | If not bypassed, mixed server/client data could display; but impact is bounded to large cohorts and degrades gracefully |

**All other claims were verified by reading source files directly in this session.**

---

## Sources

### Primary (HIGH confidence)

- `src/components/outcomes/OutcomesView.tsx` — URL param patterns, hook order, existing cohort resolution
- `src/components/outcomes/OutcomesPanel.tsx` — Recharts component tree, per-patient loop, IQR baseLine pattern, legendType="none" pattern
- `src/components/outcomes/palette.ts` — `EYE_COLORS`, `SERIES_STYLES`, WCAG helpers
- `src/components/outcomes/OutcomesSettingsDrawer.tsx` — Drawer layout to clone
- `src/context/DataContext.tsx` — `savedSearches: SavedSearch[]` shape confirmed
- `shared/cohortTrajectory.ts` — `PanelResult`, `TrajectoryResult`, `computeCohortTrajectory` signatures
- `shared/types/fhir.ts` — `SavedSearch { id, name, createdAt, filters }` confirmed
- `tests/outcomesPalette.contrast.test.ts` — Test pattern for WCAG assertions
- `tests/OutcomesPanel.test.tsx` — Recharts mock pattern for jsdom
- `tests/OutcomesViewRouting.test.tsx` — URL routing test pattern
- `tests/outcomesI18n.test.ts` — i18n completeness test that catches missing keys automatically
- `package.json` + `node_modules` inspection — Confirmed versions and icon availability
- Contrast ratio computation (executed in session) — COHORT_PALETTES hex values verified programmatically

### Secondary (MEDIUM confidence)

- None

### Tertiary (LOW confidence)

- None (all claims are verified from source)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json and node_modules
- Architecture: HIGH — all integration points read from canonical source files
- Pitfalls: HIGH — pitfalls derived from comments and bug reports in the existing codebase
- COHORT_PALETTES values: HIGH — contrast ratios computed programmatically in this session

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (dependencies are stable; no fast-moving ecosystem)
