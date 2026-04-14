# Phase 8: Cohort Outcome Trajectories — Research

**Researched:** 2026-04-14
**Domain:** React 19 + Recharts 3 longitudinal analytical view; pure client-side cohort aggregation math over FHIR data already authorized server-side
**Confidence:** HIGH

## Summary

Phase 8 adds a new `/outcomes` route that renders three side-by-side Recharts `ComposedChart`
panels (OD / OS / combined) over a cohort's visus observations, with a pure-math aggregator
(`src/utils/cohortTrajectory.ts`) that derives per-grid-point median and IQR bands from
linearly-interpolated per-patient curves. All data paths already exist: `useData().activeCases`
exposes cohort members with full `observations[]` and `procedures[]` arrays, and
`src/services/fhirLoader.ts` already has `getObservationsByCode(obs, LOINC_VISUS)` and
`applyFilters(cases, CohortFilter)`. No new data endpoints are required. Recharts 3.8.1
(pinned in `package.json`) supports the full primitive set called out in the UI-SPEC
(`ComposedChart` + `Area` + `Line` + `Scatter` + `ReferenceLine`) — verified against the
installed `.d.ts` files.

Three CONTEXT.md claims diverge from the codebase and must be reconciled by the planner
before work begins:

1. **D-07/D-08 cite `MedicationAdministration`** for treatment-index computation. The synthetic
   bundles contain **zero** `MedicationAdministration` resources — treatment events are encoded
   as `Procedure` resources with SNOMED `36189003` (IVOM) and `bodySite.coding[].code` =
   `362503005` (right eye) / `362502000` (left eye). The existing codebase already exposes these
   via `PatientCase.procedures`. The treatment-index algorithm must read Procedures, not
   MedicationAdministrations; the SNOMED laterality codes are the two in `fhirLoader.ts`
   (`SNOMED_EYE_RIGHT` / `SNOMED_EYE_LEFT`), not the 8966001/18944008 pair cited in D-08.
2. **D-32 audit pattern** references `server/audit.ts` and "the pattern used by AnalysisPage."
   Neither exists — audit is implemented purely as a middleware on every `/api/*` request
   (`server/auditMiddleware.ts` → `server/auditDb.ts`). AnalysisPage has **no** explicit audit
   call; its audit trail is produced implicitly by the bundle-fetch calls its data context makes.
   For `open_outcomes_view` to appear as a distinct, queryable audit row we need a new
   no-op `GET /api/audit/events/view-open` endpoint (or similar) that the page hits on mount —
   middleware captures method, path, query-string (which will carry `cohort=...` or
   `filter=...`), user, status, duration. No write into the audit DB is needed from the client.
3. **D-35 `outcomes.*` namespace.** The existing translation store (`src/i18n/translations.ts`)
   is a **flat** `{ key: { de, en } }` object, not nested namespaces. "Namespace" in this
   codebase is a naming convention: keys are prefixed (`cohortTitle`, `analysisTitle`).
   Phase 8 strings must be flat keys prefixed with `outcomes…` (e.g. `outcomesTitle`,
   `outcomesLayerMedian`). The UI-SPEC already uses this shape — the planner should follow
   the UI-SPEC keys verbatim and ignore the "namespace" wording in D-35.

**Primary recommendation:** Plan four plans — (1) `cohortTrajectory.ts` pure utility +
exhaustive vitest suite, (2) `OutcomesPage` + `components/outcomes/*` with ComposedChart
composition + settings drawer + summary cards + data preview, (3) `CohortBuilderPage` entry
points + `/outcomes` router wiring + i18n additions, (4) thin audit endpoint + Layout nav
entry + documentation sweep.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Entry point & routing**
- **D-01:** New route `/outcomes` in the client router (sibling of `/analysis`, not a tab inside it).
- **D-02:** Entry button lives on `CohortBuilderPage` — both per-row (for saved cohorts) and a header action (for the currently-applied ad-hoc filter).
- **D-03:** URL carries cohort identity two ways: `?cohort=<savedSearchId>` when navigating from a saved cohort; `?filter=<urlencoded-JSON>` when navigating from an ad-hoc filter.
- **D-04:** Page component lives at `src/pages/OutcomesPage.tsx`; all chart rendering lives inside that page and its co-located components under `src/components/outcomes/`.

**Baseline definition**
- **D-05:** Baseline = earliest Observation with LOINC_VISUS (`79880-1`) for (patient, eye), computed from the patient's entire observation record — cohort-independent.
- **D-06:** A patient with no visus in one eye is excluded from that eye's panel.

**Treatment index (X-axis mode 2)**
- **D-07:** "Number of treatments" index is computed per patient as the cumulative count of `MedicationAdministration` resources up to and including each observation's date.
- **D-08:** Treatment index is eye-aware per panel (OD counts right-eye injections, OS left-eye, combined all). Laterality read from `MedicationAdministration.bodySite` (SNOMED 8966001 = left eye, 18944008 = right eye) with fallback to `bodySiteLaterality` extension. Neither available → excluded from OD/OS panels but counted in combined.
- **D-09:** If a patient has zero MedicationAdministration resources and X-axis mode "Number of treatments" is active, render as a single scatter dot at index 0 for each observation (same as sparse-data D-18).

**Y-metric modes**
- **D-10:** Three modes (radio in settings drawer): `absolute` — raw logMAR (Snellen in tooltip only); `delta` — logMAR minus patient+eye baseline; `delta_percent` — `(value - baseline) / baseline * 100` clamped to ±200 % (outliers render as clipped scatter dots with tooltip note).

**Spread band**
- **D-11:** Per-grid-point IQR (25th–75th percentile), not ±SD.
- **D-12:** UI label: "Streuband (IQR)" (DE) / "Spread band (IQR)" (EN). Checkbox key `spreadBand` (not `sdShading`).
- **D-13:** Pluggable `spreadMode: 'iqr' | 'sd1' | 'sd2'` parameter (default `'iqr'`).

**Interpolation grid**
- **D-14:** Slider range 20–300, default 120.
- **D-15:** Linear interpolation onto shared grid between each patient's min and max time-on-axis; no extrapolation — grid points outside a patient's span are `null` for that patient and excluded from per-grid-point median/IQR.
- **D-16:** Grid regenerated live from slider; computation memoized keyed on `(cohort members, axis mode, metric mode, grid_points)`.

**Missing / sparse data**
- **D-17:** 0 measurements in an eye → patient excluded from that eye's panel; shown in summary card as `excluded: N` with tooltip.
- **D-18:** 1 measurement in an eye → single scatter dot (baseline point); no curve; excluded from median/IQR.
- **D-19:** 2..⌈grid_points/10⌉-1 measurements → curve drawn at reduced opacity (0.3 vs normal 0.6); flagged in legend tooltip as "sparse — N points".
- **D-20:** Combined panel: patient included if ≥1 measurement in either eye; OD + OS series both plotted; median/IQR over all pooled measurements.

**Settings UI layout**
- **D-21:** Right-side collapsible drawer (same Sheet pattern as CohortBuilderPage filters).
- **D-22:** Gear icon trigger in view header next to "Outcomes: <cohort name>".
- **D-23:** Drawer content order: X-axis (radio) → Y metric (radio) → Display layers (4 checkboxes) → Interpolation grid slider (20–300 step 10).
- **D-24:** Drawer state session-only (React state + URL hash, no localStorage).

**Summary cards**
- **D-25:** Four cards horizontally at top: Patient count, Total measurement count, OD measurement count, OS measurement count.
- **D-26:** Each card recomputes on any filter/toggle change; all values derived from the same memoized aggregator as the charts (single source of truth).

**Data preview & CSV export**
- **D-27:** Expandable `<details>` panel below the three chart panels; closed by default.
- **D-28:** Table columns (matches CSV export 1:1): `patient_pseudonym, eye, observation_date, days_since_baseline, treatment_index, visus_logmar, visus_snellen_numerator, visus_snellen_denominator`.
- **D-29:** CSV export via existing `src/utils/download.ts` `downloadCsv` + `datedFilename(...)`.
- **D-30:** `center_id` intentionally excluded from the CSV.

**Authz / audit**
- **D-31:** All aggregation client-side over data already authorized (Phase 5 center-based restriction still applies). No new data-bypass endpoint.
- **D-32:** Opening the Outcomes view triggers a server-side audit entry via the existing audit pattern used by AnalysisPage. Entry includes: action (`open_outcomes_view`), user id, cohort identifier or filter snapshot, timestamp.

**Pure utility boundary**
- **D-33:** All math lives in `src/utils/cohortTrajectory.ts` as pure, side-effect-free functions.
- **D-34:** Unit tests in `tests/cohortTrajectory.test.ts` cover the 5 edge cases from OUTCOME-10.

**i18n**
- **D-35:** Every new user-facing string added to both `de` and `en` bundles in `src/i18n/translations.ts` under a new `outcomes.*` namespace. No hardcoded text.
- **D-36:** Strings follow the namespace shape used by existing analytical views (`cohortBuilder.*`, `analysis.*`).

### Claude's Discretion

- Recharts vs raw SVG for the three panels (default: Recharts)
- Exact color palette for OD/OS/combined panels (pick from `CHART_COLORS`, colorblind-safe)
- Whether the three panels stack vertically on narrow viewports (< ~1100px) or scroll horizontally
- Specific drawer animation, hover tooltip content beyond required fields
- Loading skeleton design while aggregation runs
- Exact layout of summary cards (density, iconography)

All discretion items are RESOLVED in `08-UI-SPEC.md`. The planner should use the UI-SPEC as
the visual contract; CONTEXT.md D-markers constrain the behavior.

### Deferred Ideas (OUT OF SCOPE)

- CRT trajectory view (parallel visualization for retinal thickness) — future analytics phase
- Treatment-interval distribution charts — future analytics phase
- Responder classification (clustering patients into response categories) — future analytics phase
- Cross-cohort comparison (overlaying two cohorts on the same plot) — future feature
- Outcome metrics beyond visus (visual field, IOP, etc.) — out of scope for v1.5
- Persisting settings drawer state across sessions (intentionally deferred)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OUTCOME-01 | Open Outcomes view from saved or ad-hoc cohort | `CohortBuilderPage` existing save/filter flow + new `?cohort=` / `?filter=` params; reused `applyFilters()` in `fhirLoader.ts` resolves both paths to a `PatientCase[]` the same way. |
| OUTCOME-02 | Three panels (OD / OS / combined) with per-patient curves + bolder median overlay | Recharts 3.8.1 `ComposedChart` with stacked `Line[]` (per-patient, stroke 1.5) + `Line` (median, stroke 3). `getObservationsByCode(obs, LOINC_VISUS)` already splits observations; `observation.bodySite.coding[].code` splits OD/OS using `SNOMED_EYE_RIGHT`/`SNOMED_EYE_LEFT` constants already exported from `fhirLoader.ts`. |
| OUTCOME-03 | X-axis toggle: days-since-baseline vs number-of-treatments | Days: `(obsDate - baselineDate) / 86400000`, integer days. Treatments: cumulative count of `Procedure` resources with SNOMED 36189003 (IVOM) up to/including obsDate, filtered by `bodySite.coding[].code` laterality — see deviation note in Summary (CONTEXT D-07/D-08 reference MedicationAdministration which is absent from bundles). |
| OUTCOME-04 | Y-metric toggle: Absolute / Δ / Δ% | Pure-function modes in `cohortTrajectory.ts`; baseline per (patient, eye) = earliest LOINC_VISUS observation. Δ% clamped to ±200 % with clipped-outlier marker per D-10. |
| OUTCOME-05 | Independent display toggles: median, per-patient curves, scatter, spread band | Boolean state → conditional Recharts children. Checkbox key names match UI-SPEC (`median`, `perPatient`, `scatter`, `spreadBand`). |
| OUTCOME-06 | Shared interpolation grid, slider 20–300, default 120 | Linear interpolation `y(t) = y_i + (y_{i+1} - y_i) * (t - t_i) / (t_{i+1} - t_i)` within each patient's observed span; `null` outside span (no extrapolation per D-15). Per-grid-point median + IQR from non-null values across patients. |
| OUTCOME-07 | Summary cards: patient count, total measurements, OD count, OS count; live-recompute | Derived from the same memoized aggregator output as charts (single source of truth per D-26). |
| OUTCOME-08 | Expandable Data preview with CSV export | Native `<details>` element (per UI-SPEC) + `downloadCsv()` from `src/utils/download.ts`. Column list locked in D-28. |
| OUTCOME-09 | Client-side aggregation; no new data-bypass path | `useData().activeCases` already reflects server-filtered, center-authorized data (Phase 5 enforcement via `fhirApiPlugin`). No new endpoint touches FHIR data. |
| OUTCOME-10 | Pure utility with unit tests for 5 edge cases | `src/utils/cohortTrajectory.ts` + `tests/cohortTrajectory.test.ts` per existing test pattern (vitest, node environment for pure utils). Edge cases enumerated in Runtime State Inventory → Test-framework section below. |
| OUTCOME-11 | Audit entry on view open | New `GET /api/audit/events/view-open?name=open_outcomes_view&cohort=…&filter=…` endpoint; middleware captures the request into audit_log. See Code Examples § Audit integration. |
| OUTCOME-12 | DE/EN i18n, no untranslated strings | Add all keys listed in UI-SPEC §Copywriting Contract to `src/i18n/translations.ts` (flat keys, not nested). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

**None found.** There is no `CLAUDE.md` at the project root
(`/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app/CLAUDE.md` does not exist; verified via
filesystem read). Project conventions are instead recorded in `docs/` and in the existing code
patterns. The planner should treat the following de-facto conventions as equivalent:

- i18n via the `useLanguage().t(key)` helper and flat keys in `src/i18n/translations.ts`.
- Server-side center authorization is authoritative — clients never access data outside
  `req.auth.centers` scope (`.planning/STATE.md` §Accumulated Context).
- Audit is automatic on every `/api/*` request; **no client ever writes the audit log directly**
  (`server/auditApi.ts` — only GET routes exist).
- Pure utilities live under `src/utils/`; components under `src/components/<feature>/`;
  pages under `src/pages/`; tests under `tests/` using vitest (`vitest.config.ts`).
- Imports are sorted by `eslint-plugin-simple-import-sort` (`eslint.config.js`).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.4 | UI framework | `[VERIFIED: package.json]` — pinned across the codebase; no alternative permitted |
| react-router-dom | ^7.14.0 | Client routing | `[VERIFIED: package.json + src/App.tsx]` — `BrowserRouter`, `Route`, `useSearchParams`, `NavLink` already in use |
| recharts | ^3.8.1 | Chart composition | `[VERIFIED: package.json + node_modules/recharts/types/index.d.ts]` — `ComposedChart`, `Area`, `Line`, `Scatter`, `ReferenceLine`, `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ResponsiveContainer` all exported from 3.8.1 |
| lucide-react | ^1.8.0 | Icons | `[VERIFIED: package.json]` — project icon set (UI-SPEC §Registry Safety) |
| tailwindcss | ^4.2.2 | Styling utilities | `[VERIFIED: package.json]` — Tailwind v4 utility classes, no `tailwind.config.*` file |
| vitest | ^4.1.4 | Test runner | `[VERIFIED: package.json + vitest.config.ts]` — node environment default; jsdom opted in per-file |

### Supporting (already in the codebase; no new installs)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (internal) `src/services/fhirLoader.ts` | — | `getObservationsByCode`, `LOINC_VISUS`, `SNOMED_EYE_RIGHT`, `SNOMED_EYE_LEFT`, `applyFilters` | Reuse verbatim for observation extraction and cohort resolution |
| (internal) `src/utils/download.ts` | — | `downloadCsv(headers, rows, filename)`, `datedFilename(prefix, ext)` | CSV export per D-29 |
| (internal) `src/context/DataContext.tsx` | — | `useData().activeCases`, `savedSearches` | Cohort member and saved-search lookup |
| (internal) `src/context/LanguageContext.tsx` | — | `useLanguage().t(key)`, `locale` | All strings via t() per D-35 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts `ComposedChart` | D3.js direct SVG | D3 would give precise per-grid-point band rendering but adds ~60 KB + a new coding convention. Recharts 3.8.1 `ComposedChart` supports `Area` (fill) + `Line` (stroke) + `Scatter` + `ReferenceLine` in one viewport — sufficient for every layer the UI-SPEC requires. **Stick with Recharts** per CONTEXT.md Discretion default. |
| Per-patient `Line` element explosion | Single `Line` with multi-dimensional data | Recharts `Line` is one series per element; 45 × 7 ≈ 315 `Line` nodes per panel. At typical cohort sizes (≤ 315 patients) this is fine; profile if cohorts exceed ~500. See Common Pitfalls §1. |
| `<Sheet>` / Radix Dialog | Bespoke fixed `<aside>` | No Radix/Sheet primitive installed. UI-SPEC §Settings drawer specifies bespoke `fixed right-0 …` aside. |

**Installation:**
```bash
# No new dependencies required.
```

**Version verification:** All packages are already pinned in `package.json` v1.4.0. No `npm
view` calls are necessary — the versions used are the versions installed. `[VERIFIED:
package.json + node_modules/recharts/types/index.d.ts inspected 2026-04-14]`

## Architecture Patterns

### Recommended Project Structure
```
src/
├── pages/
│   └── OutcomesPage.tsx                  # D-04 — route entry
├── components/
│   └── outcomes/
│       ├── OutcomesSummaryCards.tsx      # 4 cards, D-25/D-26
│       ├── OutcomesPanel.tsx             # One ComposedChart (OD / OS / Combined)
│       ├── OutcomesSettingsDrawer.tsx    # gear-triggered aside, D-21..D-24
│       ├── OutcomesDataPreview.tsx       # <details> table + CSV export, D-27..D-30
│       └── OutcomesEmptyState.tsx        # cohort-empty / no-visus fallback (UI-SPEC)
├── utils/
│   └── cohortTrajectory.ts               # D-33 — pure math
├── i18n/translations.ts                  # add outcomesFoo keys here (flat)
└── App.tsx                               # add /outcomes route
server/
└── (new) auditApi.ts addition: GET /api/audit/events/view-open  # D-32 / OUTCOME-11
tests/
└── cohortTrajectory.test.ts              # D-34 + OUTCOME-10
```

### Pattern 1: Query-param-driven analytical page
**What:** Route component reads cohort identity from `useSearchParams()`, resolves to a
`PatientCase[]` via the already-existing data context, renders analyses.
**When to use:** Always — this matches `AnalysisPage` (`src/pages/AnalysisPage.tsx:40-62`) and
lets the entry buttons in `CohortBuilderPage` stay stateless.

**Example (adapted from `AnalysisPage.tsx`):**
```typescript
// Source: src/pages/AnalysisPage.tsx lines 38-62
export default function OutcomesPage() {
  const { activeCases, savedSearches } = useData();
  const [searchParams] = useSearchParams();
  const { locale, t } = useLanguage();

  const cohort = useMemo(() => {
    const cohortId = searchParams.get('cohort');
    const filterParam = searchParams.get('filter');

    if (cohortId) {
      const saved = savedSearches.find((s) => s.id === cohortId);
      return saved ? applyFilters(activeCases, saved.filters) : [];
    }
    if (filterParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(filterParam));
        // M-04 safe-pick pattern from AnalysisPage.tsx L48-59 — copy verbatim
        return applyFilters(activeCases, safePickFilter(parsed));
      } catch { return []; }
    }
    return activeCases;
  }, [activeCases, savedSearches, searchParams]);
  // …
}
```
**Note:** Reuse the same `safePickFilter` inlined in AnalysisPage.tsx (L48-59) verbatim — it
prevents prototype pollution (security fix M-04 from Phase 5).

### Pattern 2: Memoized aggregation keyed on inputs
**What:** Run the entire cohortTrajectory aggregator once per (cohort, axisMode, yMetric,
gridPoints, spreadMode) combination; summary cards, panels, and data preview all derive from
the same output.
**When to use:** Mandatory per D-16 and D-26.

**Example:**
```typescript
const aggregate = useMemo(
  () => computeCohortTrajectory({
    cases: cohort,
    axisMode,      // 'days' | 'treatments'
    yMetric,       // 'absolute' | 'delta' | 'delta_percent'
    gridPoints,    // 20..300
    spreadMode,    // 'iqr' (future: 'sd1' | 'sd2')
  }),
  [cohort, axisMode, yMetric, gridPoints, spreadMode],
);
// aggregate.od, aggregate.os, aggregate.combined each shape:
//   { patients: {id, pseudonym, points:[{x, y, sparse, interpolated}]}[],
//     medianGrid: {x, y, p25, p75, n}[],
//     summary: { patientCount, excludedCount, measurementCount } }
```

### Pattern 3: Recharts ComposedChart layer z-order
Bottom-to-top per UI-SPEC §Chart panel:
```typescript
// Source: UI-SPEC L329-335
<ComposedChart data={aggregate.od.medianGrid}>
  <CartesianGrid strokeDasharray="3 3" />
  {yMetric !== 'absolute' && <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="5 5" />}
  {layers.spreadBand && <Area dataKey="p75" stroke="none" fill={PANEL_HEX} fillOpacity={0.15} />}
  {layers.spreadBand && <Area dataKey="p25" stroke="none" fill="#fff" fillOpacity={1} />}  // mask to clip
  {layers.perPatient && aggregate.od.patients.map((p) => (
    <Line key={p.id} data={p.points} dataKey="y" dot={false}
          stroke={PANEL_HEX}
          strokeOpacity={p.sparse ? 0.3 : 0.6} strokeWidth={1.5} />
  ))}
  {layers.scatter && <Scatter data={aggregate.od.scatterPoints} fill={PANEL_HEX} fillOpacity={0.5} />}
  {layers.median && <Line data={aggregate.od.medianGrid} dataKey="y" stroke={PANEL_HEX} strokeWidth={3} />}
  <XAxis dataKey="x" tick={{ fontSize: 11 }} />
  <YAxis domain={yDomain} tick={{ fontSize: 11 }} />
  <Tooltip content={<OutcomesTooltip t={t} yMetric={yMetric} />} />
  <Legend wrapperStyle={{ fontSize: 12 }} />
</ComposedChart>
```
**Spread-band implementation detail:** Recharts `Area` fills from the axis baseline to
`dataKey`. To render a band between p25 and p75, stack **two Areas**: a filled p75 area, then a
p25-shaped "mask" in background color. Alternatively, construct the data array with `y0`
(baseline) and `y` keys and use `<Area dataKey="y" baseLine="y0" />`. Recharts 3.x exposes the
`baseLine` prop; pre-populate each grid point with `{x, y: p75, y0: p25}` and one `Area
dataKey="y" baseLine="y0"` renders the IQR region directly — **this is the recommended
pattern** (simpler than two-area masking).

### Anti-Patterns to Avoid
- **Recomputing in each child component.** Every panel, card, and preview must read from the
  single `useMemo` aggregate. Re-running the interpolation inside `OutcomesPanel` duplicates
  CPU and lets values drift under the same toggles.
- **Hardcoding strings.** Every user-facing label must be a translation key per D-35 and
  OUTCOME-12. Use `t('outcomesFoo')` not `'Outcomes'`.
- **Writing to audit_log from the client.** The audit log is append-only and the write path is
  middleware-only; clients only `GET` the new view-open endpoint. Attempting a POST will 404
  per `server/auditApi.ts` comments (L90-93).
- **Re-exporting observations through a new API.** D-31/OUTCOME-09: use `useData().activeCases`
  only. Do not add `/api/outcomes/*` — that would bypass Phase 5 center authz tests.
- **Using `localStorage` for drawer state.** D-24 forbids. Use React state plus (optionally)
  URL hash for shareable state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Manual string concat | `src/utils/download.ts` `downloadCsv(headers, rows, filename)` | Already handles BOM for Excel, CSV-escaping `"` inside fields, `text/csv;charset=utf-8` blob, cleanup of object URL. `[VERIFIED: src/utils/download.ts]` |
| Date-stamped filename | Manual `new Date().toISOString().slice(…)` | `datedFilename(prefix, ext)` | Matches other pages' export convention. `[VERIFIED: src/utils/download.ts:51]` |
| Cohort resolution from filter JSON | Re-implement filter matching | `applyFilters(cases, CohortFilter)` in `fhirLoader.ts` | Center/gender/diagnosis/age/visus/CRT filters with the safety/pseudonymization semantics already locked. `[VERIFIED: src/services/fhirLoader.ts:247-283]` |
| Visus observation extraction | Manually filter `observations[]` | `getObservationsByCode(obs, LOINC_VISUS)` — returns ascending-by-date | Already sorted ascending by `effectiveDateTime`; reuse for baseline derivation. `[VERIFIED: src/services/fhirLoader.ts:125-136]` |
| Audit entry | Explicit audit API call | Any `GET /api/*` endpoint — middleware logs automatically | `server/auditMiddleware.ts` captures method/path/user/query/status/duration on every `/api/*`. `[VERIFIED: server/auditMiddleware.ts:105-151]` |
| i18n switching | Parallel string maps | `t()` from `useLanguage()` with flat keys | `src/context/LanguageContext.tsx` already provides locale + translation switching + persistence. |
| JSON-safe parse of URL filter | Naïve `JSON.parse` | The "safe pick" pattern from `AnalysisPage.tsx:48-59` (M-04 prototype-pollution guard) | Locked security pattern from Phase 5. Copy the block verbatim. |
| Chart color selection | Hardcoded hex constants | `CHART_COLORS` in `src/config/clinicalThresholds.ts` | UI-SPEC picks indices 0 / 2 / 4 for OD / OS / combined. `[VERIFIED: src/config/clinicalThresholds.ts:13]` |

**Key insight:** Phase 8 is a composition phase — every piece of infrastructure it touches
(data loader, filter matcher, CSV writer, i18n, audit, chart library) already exists. The only
genuinely new code is the pure math in `cohortTrajectory.ts`, the chart composition, and the
one-route audit endpoint. Do not introduce new dependencies or new abstractions.

## Runtime State Inventory

*Phase 8 is greenfield (no rename/migration).* This section is kept for completeness but
contains no active items — the planner may skip it. A fresh Outcomes view adds routes/files
and one GET endpoint; no stored data, live service config, OS state, secrets, or build
artifacts carry over that need migration.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — view is read-only over existing observations/procedures | none |
| Live service config | None | none |
| OS-registered state | None | none |
| Secrets/env vars | None | none |
| Build artifacts | `dist/` is rebuilt by `npm run build`; no stale artifacts | none — standard `npm run build` refreshes |

## Common Pitfalls

### Pitfall 1: Recharts performance with 300+ per-patient `Line` elements
**What goes wrong:** Each patient becomes a `<Line>` element; a cohort of ~300 patients in the
combined panel becomes ~600 `Line` nodes (OD+OS); SVG re-rendering can stall on slider
changes.
**Why it happens:** Recharts renders each `Line` as a separate SVG group with its own event
handlers, tooltip plumbing, and path interpolation. React diffs every element every render.
**How to avoid:** (a) Memoize the per-patient points array by `(patient.id, axisMode,
yMetric)` — do NOT regenerate per-patient data on grid-points slider change unless necessary.
(b) Pass `isAnimationActive={false}` to all high-volume `Line`/`Area` elements inside the
per-patient loop — the default 1.5 s animation × 300 lines is the worst case. (c) If cohorts
exceed ~500 patients, switch to a single pre-computed `Line` receiving a multi-series data
array keyed by patient ID, one dataKey per patient; Recharts handles this more efficiently.
**Warning signs:** Slider drag lag > 100 ms, Chrome profiler showing > 50 % time in Recharts
`<Line>` reconciliation.
`[ASSUMED from Recharts training knowledge; validated only against synthetic cohort sizes
≤ 45 × 7 ≈ 315 in this repo]`

### Pitfall 2: Linear interpolation extrapolating past observed span
**What goes wrong:** A patient with observations at days 10 and 100 gets their curve extended
to day 300 of the cohort grid, producing a flat extrapolated tail that drags the median in
sparse late regions.
**Why it happens:** Naïve `y = y0 + slope * (t - t0)` has no guard on `t > t_max`.
**How to avoid:** D-15 explicitly requires `null` for grid points outside each patient's
`[min(obs.date), max(obs.date)]` span. Median/IQR aggregation must `filter(v => v != null)`
before sorting.
**Warning signs:** Median line extending horizontally at the last observed value past the
cohort end; unit test "mismatched-span" failing.

### Pitfall 3: Baseline drift when cohort changes
**What goes wrong:** Patient's baseline silently changes based on which cohort they're in.
**Why it happens:** Baseline is computed from the *filtered* observation set instead of the
patient's full observation record.
**How to avoid:** D-05: baseline = earliest LOINC_VISUS observation in
`patientCase.observations` (the full record served by the bundle), not in the cohort
intersection. `getObservationsByCode` already returns ascending-by-date — take `[0]`.
**Warning signs:** Δ values for the same patient differ across two cohorts containing them.

### Pitfall 4: Treatment index ambiguity when MedicationAdministration is absent
**What goes wrong:** CONTEXT.md D-07/D-08 specify `MedicationAdministration.bodySite` with
SNOMED 8966001 / 18944008. These codes and resource type don't exist in the bundles (see
Summary finding 1).
**Why it happens:** The spec was written against FHIR idealized model; the synthetic generator
emits `Procedure` (SNOMED 36189003 "Intravitreal injection") with
`bodySite.coding[].code` = `362503005` (right eye) / `362502000` (left eye), plus one
`MedicationStatement` per patient encoding only the drug.
**How to avoid:** **Use `patientCase.procedures`** (already exposed on `PatientCase`) and filter
by `code.coding.some(c => c.code === SNOMED_IVI)` where `SNOMED_IVI = '36189003'` is already
exported from `fhirLoader.ts:147`. Laterality comes from `proc.bodySite[0].coding[0].code`
against `SNOMED_EYE_RIGHT` / `SNOMED_EYE_LEFT` already exported from `fhirLoader.ts:148-149`.
The combined panel counts all procedures regardless of laterality. The planner **must flag
D-07/D-08 for user confirmation** before locking the treatment-index implementation.
**Warning signs:** `npm run generate-bundles` produces bundles that load but have zero
treatments visible in the Outcomes view; treatment-index X-axis is always 0.

### Pitfall 5: Saved-search ID referencing a cohort the current user can't view
**What goes wrong:** User follows a shared `/outcomes?cohort=abc-123` URL whose saved search
includes centers they're not assigned to.
**Why it happens:** Saved searches persist by user (per-username table in dataDb), but the URL
parameter is opaque; if another user shares the URL, `savedSearches.find(id === ...)` returns
undefined.
**How to avoid:** Accept gracefully — render the "no cohort" empty state
(`outcomesEmptyCohortTitle` / `outcomesEmptyCohortBody`) with a link back to Cohort Builder.
Do not fetch the saved search from the server; the center-authz layer is already enforced at
the observation level, not at the saved-search level.
**Warning signs:** Page crashes on missing saved search; empty table without explanation.

### Pitfall 6: Snellen conversion rounding
**What goes wrong:** Snellen numerator/denominator columns drift because logMAR ↔ Snellen is
computed by different formulas in different places.
**Why it happens:** Observation values are stored as `decimal` unit (verified:
`"unit": "decimal"` in all bundles; see Sources). D-28 expects Snellen numerator/denominator
columns. Conversion `snellen_denominator = round(20 / decimal_value)` loses precision.
**How to avoid:** Compute conversion once in `cohortTrajectory.ts` and surface it on each
aggregated observation. Store both logMAR and Snellen (num, den) on each measurement object;
consumers (tooltip, CSV) read the same values.
**Warning signs:** Tooltip shows Snellen 20/50 but CSV row for same observation shows 20/51.

### Pitfall 7: Unit confusion — logMAR vs decimal visus
**What goes wrong:** UI-SPEC and CONTEXT refer to "logMAR" throughout, but the data is stored
as `unit: "decimal"` (Snellen decimal, not logMAR). logMAR = `-log10(decimal)`. A
decimal 0.5 ≈ logMAR 0.30; a decimal 1.0 = logMAR 0.
**Why it happens:** Ophthalmology uses both scales. The existing `VisusCrtChart.tsx` plots
decimal (Y axis `[0, 1]` per line 70). The Outcomes view aspires to logMAR.
**How to avoid:** `cohortTrajectory.ts` explicitly converts `decimal → logMAR` at the
"normalize" step. **Document in the file header** that all downstream values are logMAR.
Snellen conversion goes through a shared helper. Y-axis domain for absolute mode should be
`[0, 2]` (UI-SPEC L339 says `[0, 2]`) which corresponds to ~decimal 0.01–1.0.
**Warning signs:** Y values compressed near zero because logMAR of decimals 0.5–1.0 is in
[0, 0.30]; wrong Y-axis tick labels.

## Code Examples

### Trajectory math — core algorithm
```typescript
// Source: derived from research; algorithm specified in CONTEXT.md D-05, D-14, D-15
// File: src/utils/cohortTrajectory.ts

import type { PatientCase } from '../types/fhir';
import {
  getObservationsByCode,
  LOINC_VISUS,
  SNOMED_EYE_RIGHT,
  SNOMED_EYE_LEFT,
  SNOMED_IVI,
} from '../services/fhirLoader';

export type AxisMode = 'days' | 'treatments';
export type YMetric = 'absolute' | 'delta' | 'delta_percent';
export type SpreadMode = 'iqr' | 'sd1' | 'sd2';
export type Eye = 'od' | 'os' | 'combined';

export interface Measurement {
  date: string;
  decimal: number;
  logmar: number;
  snellenNum: number;
  snellenDen: number;
  eye: 'od' | 'os';
  x: number;          // depends on axisMode
  y: number | null;   // depends on yMetric; null for absolute-mode delta-denominator=0 etc.
}

export interface PatientSeries {
  id: string;
  pseudonym: string;
  measurements: Measurement[];   // sorted by x
  sparse: boolean;               // < ⌈grid_points/10⌉
  excluded: boolean;             // 0 measurements for this eye
  baseline: number | null;       // logMAR at earliest observation for (patient, eye)
}

export interface GridPoint {
  x: number;
  y: number;     // median
  p25: number;   // 25th percentile
  p75: number;   // 75th percentile
  n: number;     // patients contributing
}

export interface PanelResult {
  patients: PatientSeries[];
  scatterPoints: Array<{ x: number; y: number; patientId: string }>;
  medianGrid: GridPoint[];
  summary: { patientCount: number; excludedCount: number; measurementCount: number };
}

export interface TrajectoryResult { od: PanelResult; os: PanelResult; combined: PanelResult; }

// ---------- pure helpers ----------

/** Snellen decimal → logMAR. Decimal 1.0 → 0; 0.5 → 0.30; 0.1 → 1.0. */
export function decimalToLogmar(decimal: number): number {
  if (decimal <= 0) return NaN;
  return -Math.log10(decimal);
}

export function decimalToSnellen(decimal: number, numerator = 20): { num: number; den: number } {
  return { num: numerator, den: Math.round(numerator / decimal) };
}

/** Eye side of an observation or procedure. Returns null if unknown. */
export function eyeOf(resourceBodySite: unknown): 'od' | 'os' | null {
  // Observation.bodySite is a single CodeableConcept; Procedure.bodySite is an array.
  const first = Array.isArray(resourceBodySite)
    ? (resourceBodySite as Array<{ coding?: Array<{ code?: string }> }>)[0]
    : (resourceBodySite as { coding?: Array<{ code?: string }> } | undefined);
  const code = first?.coding?.[0]?.code;
  if (code === SNOMED_EYE_RIGHT) return 'od';
  if (code === SNOMED_EYE_LEFT) return 'os';
  return null;
}

/** Cumulative treatment index: count of IVOM procedures for (patient, eye) with
 *  performedDateTime <= observationDate. `eye === 'combined'` ignores laterality. */
export function treatmentIndexAt(
  procs: PatientCase['procedures'],
  observationDate: string,
  eye: 'od' | 'os' | 'combined',
): number {
  const obsTs = new Date(observationDate).getTime();
  return procs.filter((p) => {
    if (!p.performedDateTime) return false;
    if (new Date(p.performedDateTime).getTime() > obsTs) return false;
    const isIvom = p.code.coding.some((c) => c.code === SNOMED_IVI);
    if (!isIvom) return false;
    if (eye === 'combined') return true;
    return eyeOf(p.bodySite) === eye;
  }).length;
}

/** Linear interpolation of `series` (sorted by x) onto `grid`. Returns null
 *  for grid points outside [series[0].x, series[last].x] — no extrapolation. */
export function interpolate(
  series: Array<{ x: number; y: number }>,
  grid: number[],
): Array<number | null> {
  if (series.length === 0) return grid.map(() => null);
  if (series.length === 1) return grid.map((x) => (x === series[0].x ? series[0].y : null));
  const result: Array<number | null> = [];
  let j = 0;
  for (const x of grid) {
    if (x < series[0].x || x > series[series.length - 1].x) { result.push(null); continue; }
    while (j < series.length - 2 && series[j + 1].x < x) j++;
    const a = series[j], b = series[j + 1];
    if (b.x === a.x) { result.push(a.y); continue; }
    result.push(a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x));
  }
  return result;
}

/** Percentile (linear interpolation) of a sorted array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Build the shared X grid: uniform between the pooled min and max of the
 *  cohort's observation X values, `gridPoints` steps. */
export function buildGrid(xsByPatient: number[][], gridPoints: number[]): number[] {
  const flat = xsByPatient.flat();
  if (flat.length === 0) return [];
  const min = Math.min(...flat), max = Math.max(...flat);
  const n = gridPoints[0] ?? 120;
  if (max === min) return [min];
  return Array.from({ length: n }, (_, i) => min + ((max - min) * i) / (n - 1));
}
```

### Audit endpoint — view-open beacon
```typescript
// Source: server/auditApi.ts addition; middleware captures automatically
// Adds to the existing auditApiRouter (server/auditApi.ts)

// Add alongside existing auditApiRouter.get('/', …) definitions:
auditApiRouter.get('/events/view-open', (req: Request, res: Response): void => {
  // No-op: the auditMiddleware has already captured this request
  // (method, path, query-string, user, status, duration, timestamp) into audit_log.
  // The query string carries the view name + cohort identifier.
  // Recognized query params:
  //   name   — e.g. 'open_outcomes_view'  (required, free-form but constrained by the client)
  //   cohort — saved search id, if navigating from a saved cohort
  //   filter — urlencoded JSON snapshot of the ad-hoc filter, if navigating from a filter
  res.status(204).end();
});
```

Client hook (OutcomesPage):
```typescript
// Fire once on mount; rely on auditMiddleware to write the log row.
useEffect(() => {
  const params = new URLSearchParams({ name: 'open_outcomes_view' });
  const cohortId = searchParams.get('cohort');
  const filter = searchParams.get('filter');
  if (cohortId) params.set('cohort', cohortId);
  if (filter) params.set('filter', filter);
  authFetch(`/api/audit/events/view-open?${params.toString()}`).catch(() => {
    // Audit failure is non-fatal for the user; server retains no-op response semantics
  });
}, []); // eslint-disable-line react-hooks/exhaustive-deps — open event fires once per mount
```

### Edge-case test fixtures (tests/cohortTrajectory.test.ts outline)
```typescript
// Source: pattern from tests/constants.test.ts and tests/fhirApi.test.ts
import { describe, expect, it } from 'vitest';
import {
  decimalToLogmar, decimalToSnellen, eyeOf, treatmentIndexAt,
  interpolate, percentile, computeCohortTrajectory,
} from '../src/utils/cohortTrajectory';

describe('cohortTrajectory — pure helpers', () => {
  it('decimalToLogmar: 1.0 → 0, 0.5 → ~0.301, 0.1 → 1.0', () => {
    expect(decimalToLogmar(1)).toBe(0);
    expect(decimalToLogmar(0.5)).toBeCloseTo(0.301, 3);
    expect(decimalToLogmar(0.1)).toBeCloseTo(1, 3);
  });
  it('interpolate: returns null outside observed span (D-15)', () => {
    const r = interpolate([{ x: 10, y: 1 }, { x: 100, y: 2 }], [5, 10, 50, 100, 200]);
    expect(r).toEqual([null, 1, 1.5, 2, null]);
  });
  it('percentile: linear on sorted input', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(percentile([1, 2, 3, 4, 5], 0.75)).toBe(4);
  });
});

describe('cohortTrajectory — OUTCOME-10 edge cases', () => {
  it('empty cohort yields empty panel results', () => { /* … */ });
  it('single patient: median equals their curve, IQR degenerate (p25 == p75 == median)', () => { /* … */ });
  it('single measurement: scatter dot only, no curve drawn, excluded from median', () => { /* … */ });
  it('sparse series (< grid/10 points): flagged sparse=true, opacity applied downstream', () => { /* … */ });
  it('mismatched spans: p1 covers days 0–100, p2 covers 500–600; no overlap in grid → median undefined in gap', () => { /* … */ });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recharts 2.x `Cartesian`-based band patterns | Recharts 3.x `Area` with `baseLine` prop for banded IQR | Recharts 3.0 (2024) | Enables single-element IQR band without two-area masking — cleaner DOM |
| Per-chart `width`/`height` props | `ResponsiveContainer` wrapping chart | Recharts 2.x+ | Already standard in this codebase (VisusCrtChart, AnalysisPage) |
| React Router v6 `useSearchParams` | Same API in Router 7 | Router 7.0 | No change in usage; `react-router-dom@^7.14.0` preserves `useSearchParams` ergonomics |

**Deprecated/outdated:**
- Global `localStorage` for analytical view state — replaced by session-only state + URL hash per D-24
- Manual CSV construction — replaced by `src/utils/download.ts` helpers
- CONTEXT.md reference to MedicationAdministration (never present in the codebase) — see Summary finding 1

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recharts 3.x `Area` supports `baseLine` for banded regions in a single element | Pattern 3 / Code Examples | If unsupported, fall back to the two-area masking pattern shown as the alternative. `[ASSUMED from training knowledge; not verified against Recharts 3.8.1 source]` |
| A2 | Y-metric mode `delta` uses signed logMAR difference where negative = improvement | D-10 interpretation | If clinicians expect decimal-scale delta (positive = improvement), sign convention inverts. Flag for user confirmation before locking tooltip copy. |
| A3 | Treatment index should use `Procedure.SNOMED 36189003` (not MedicationAdministration per CONTEXT D-07/D-08) | Summary finding 1, Pitfall 4 | If user truly wants MedicationAdministration, bundles must first be regenerated with that resource type. Requires user confirmation. |
| A4 | Audit should be produced by a single `GET /api/audit/events/view-open` request per page open, not on every toggle | Audit integration | If auditors require per-toggle granularity, add hits on axisMode/yMetric changes too. Defaults to "view open" only per D-32 wording. |
| A5 | Snellen conversion uses numerator=20 convention (US) rather than 6 (metric) | Pitfall 6 | If clinicians prefer 6/x notation, switch numerator constant. Confirm during discuss-phase. |
| A6 | Performance is acceptable at ~315 per-panel `Line` elements for current synthetic cohorts (~45 patients × 7 centers) | Pitfall 1 | Cohorts exceeding 500 patients may lag; mitigations documented. |
| A7 | `outcomes.*` namespace in D-35/D-36 means flat `outcomesFoo` keys (matching existing translation file shape), not a nested sub-object | Summary finding 3 | If a nested namespace is truly required, the translation module needs refactor. Follow UI-SPEC which already assumes flat. |

## Open Questions

1. **Treatment-resource type mismatch (HIGHEST priority).**
   - What we know: Bundles contain `Procedure` (SNOMED 36189003) with `bodySite` laterality; `MedicationAdministration` is absent.
   - What's unclear: Whether the user wants to switch the spec to Procedure or regenerate bundles with MedicationAdministration.
   - Recommendation: Ask the user during discuss-phase confirmation. Default to Procedure-based implementation (no data migration).

2. **Audit granularity.**
   - What we know: Current audit is middleware-based, per-request.
   - What's unclear: Whether toggle changes (axis/metric/layer/grid) also need distinct audit entries, or only the initial view-open.
   - Recommendation: Start with view-open only (D-32 wording); add toggle audits only if explicitly required.

3. **Snellen numerator convention.**
   - What we know: `unit: "decimal"` is what the bundles store.
   - What's unclear: Whether CSV export should use 20/x (US) or 6/x (metric/UK).
   - Recommendation: 20/x (most common in EyeMatics documentation).

4. **Cohort size ceiling before server-side aggregation.**
   - What we know: OUTCOME-09 says client-side over authorized data.
   - What's unclear: Whether to set a hard cap (e.g., 1000 patients) with a graceful degradation.
   - Recommendation: No cap in v1.5; document the perf expectation and let `Future Requirements` (requirements §Future) handle >1000.

## Environment Availability

Phase 8 is code-only — no new external tools, runtimes, or services. All tooling is already
pinned in `package.json` and installed in `node_modules/`.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | Build, test, dev | ✓ | — (project already builds) | — |
| Recharts | Chart primitives | ✓ | 3.8.1 | — |
| React / React Router | Routing + rendering | ✓ | 19.2.4 / 7.14.0 | — |
| lucide-react | Icons | ✓ | 1.8.0 | — |
| vitest | Unit tests | ✓ | 4.1.4 | — |
| jsdom | (Not needed — pure utils tested under node env) | — | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.4 |
| Config file | `vitest.config.ts` (node environment default; jsdom opt-in per-file via `// @vitest-environment jsdom`) |
| Quick run command | `npm test -- tests/cohortTrajectory.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUTCOME-01 | Open from saved cohort + ad-hoc filter | integration (component) | `npm test -- tests/components.test.tsx` (extend) | extend existing |
| OUTCOME-02 | Three panels render OD/OS/combined | integration (component) | `npm test -- tests/components.test.tsx` | extend existing |
| OUTCOME-03 | Axis toggle switches X-data | unit | `npm test -- tests/cohortTrajectory.test.ts` | ❌ Wave 0 |
| OUTCOME-04 | Y-metric modes absolute/Δ/Δ% | unit | `npm test -- tests/cohortTrajectory.test.ts` | ❌ Wave 0 |
| OUTCOME-05 | Layer toggles | manual + component test | `npm test -- tests/components.test.tsx` | extend existing |
| OUTCOME-06 | Grid slider recomputes median | unit (aggregator) | `npm test -- tests/cohortTrajectory.test.ts` | ❌ Wave 0 |
| OUTCOME-07 | Summary cards recompute live | unit (aggregator outputs summary) | `npm test -- tests/cohortTrajectory.test.ts` | ❌ Wave 0 |
| OUTCOME-08 | Data preview + CSV export rows | unit (buildCsvRows pure fn) | `npm test -- tests/cohortTrajectory.test.ts` | ❌ Wave 0 |
| OUTCOME-09 | Client-side only; no new data endpoint | integration | `npm test -- tests/dataApiCenter.test.ts` (existing suite stays green) | existing |
| OUTCOME-10 | Edge cases: empty / single / single-meas / sparse / mismatched | unit | `npm test -- tests/cohortTrajectory.test.ts` | ❌ Wave 0 |
| OUTCOME-11 | Audit entry on view open | integration | `npm test -- tests/auditApi.test.ts` (extend with `/events/view-open`) | extend existing |
| OUTCOME-12 | DE/EN coverage of new keys | lint-style | `npm test -- tests/ui-requirements.test.ts` (extend; it pins some translation keys) | extend existing |

### Sampling Rate
- **Per task commit:** `npm test -- tests/cohortTrajectory.test.ts` (pure-utility fast loop)
- **Per wave merge:** `npm test` (full suite; < ~60 s locally based on prior phases)
- **Phase gate:** Full suite green, including the existing `dataApiCenter.test.ts`, `centerBypass.test.ts`, `fhirApi.test.ts` suites, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/cohortTrajectory.test.ts` — covers OUTCOME-03, 04, 06, 07, 08, 10
- [ ] No shared `tests/fixtures/` directory exists — if fixtures balloon, create `tests/fixtures/cohortTrajectory.ts` for reusable FHIR stubs
- [ ] Extend `tests/components.test.tsx` with `OutcomesPage` smoke test and layer-toggle interaction
- [ ] Extend `tests/auditApi.test.ts` (creating it if no direct integration exists) to assert the new `/api/audit/events/view-open` route returns 204 and is captured by auditMiddleware (`tests/auditMiddleware.test.ts` pattern works)
- [ ] Extend `tests/ui-requirements.test.ts` to assert all `outcomes*` translation keys have both `de` and `en` values

## Security Domain

The project has no explicit `security_enforcement: false` in `.planning/config.json`, so the
section is included. Phase 8 **adds no new data paths**; all ASVS-relevant controls are
inherited from Phase 5 center-based restriction.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no-new — inherited | `authMiddleware` (keycloakAuth / authMiddleware.ts) already guards all `/api/*` |
| V3 Session Management | no-new — inherited | Existing JWT session carries `preferred_username`, `role`, `centers` |
| V4 Access Control | yes | **Inherited** — `fhirApiPlugin` enforces center-based bundle filtering; OUTCOME-09 mandates no new path. `server/dataApi.ts` `validateCaseCenters` pattern is the canonical guard for any case-id list — though Phase 8 does not introduce one. |
| V5 Input Validation | yes (low surface) | URL filter JSON must use the **safe-pick pattern from AnalysisPage.tsx:48-59** (M-04 fix: prototype-pollution guard). Slider value clamped to [20, 300]. Query-string parameters `cohort`, `filter`, `name` sanitized before being echoed in the audit body. |
| V6 Cryptography | no | No crypto operations in the view |
| V7 Error Handling & Logging | yes | Audit entry on view open per D-32. Middleware already redacts `password/otp/challengeToken/generatedPassword` from bodies — the new endpoint carries none of those. Use the no-op 204 response to avoid leaking data. |
| V13 API & Web Service | yes | New GET-only endpoint; no write semantics. No CORS change. |

### Known Threat Patterns for {React 19 + Recharts 3 + Express 5 + SQLite}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution via URL-encoded JSON filter (OUTCOME-01) | Tampering | Safe-pick parse (explicit key whitelist) — copy from `AnalysisPage.tsx:48-59` |
| Unbounded slider value → gigantic grid allocation | DoS | Clamp `gridPoints` to `[20, 300]`; aggregator asserts range |
| CSV injection (formula injection) — leading `=`, `+`, `-`, `@` in exported cells | Tampering | `downloadCsv` already wraps every cell in `"…"` and escapes internal quotes; acceptable for Excel but consider prefixing dangerous cells with `'` if exported into spreadsheets that interpret formulas. `[ASSUMED — risk is low because pseudonyms and center names are app-controlled; add a test case]` |
| Cross-cohort data leak via shared `/outcomes?cohort=id` URL | Info Disclosure | Server authz (Phase 5) already filters observations per user; even if user A gives user B their saved-search ID, user B's `useData().activeCases` is scoped to their own centers — their resolved cohort is a subset. |
| Audit log row blowup from bots hammering `/events/view-open` | DoS | 90-day retention (D-15 Phase 2) caps growth; rate limiting already active (`server/rateLimiting.ts`) |
| Saved-search content used as JSON input to the aggregator | Tampering | Same safe-pick parse at every entry point; saved-search server API already bounds `filters` stringified size to 50 000 chars (`server/dataApi.ts:197`) |

## Sources

### Primary (HIGH confidence)
- `src/pages/AnalysisPage.tsx` — query-param → cohort pattern, Recharts composition, safe-pick parse `[VERIFIED 2026-04-14]`
- `src/pages/CohortBuilderPage.tsx` — entry-button placement, filter Sheet pattern, existing navigation to `/analysis` `[VERIFIED 2026-04-14]`
- `src/components/case-detail/VisusCrtChart.tsx` — ResponsiveContainer, Tooltip, ReferenceLine patterns, `connectNulls` idiom `[VERIFIED 2026-04-14]`
- `src/services/fhirLoader.ts` — `getObservationsByCode`, `LOINC_VISUS`, `SNOMED_EYE_RIGHT`, `SNOMED_EYE_LEFT`, `SNOMED_IVI`, `applyFilters` `[VERIFIED 2026-04-14]`
- `src/types/fhir.ts` — `PatientCase`, `CohortFilter`, `Observation`, `Procedure`, `MedicationStatement`, `FhirCodeableConcept` `[VERIFIED 2026-04-14]`
- `src/utils/download.ts` — `downloadCsv`, `datedFilename` `[VERIFIED 2026-04-14]`
- `src/config/clinicalThresholds.ts` — `CHART_COLORS` array order `[VERIFIED 2026-04-14]`
- `src/i18n/translations.ts` — flat-key structure, `{de, en}` shape (`[VERIFIED 2026-04-14, 588 lines]`)
- `src/context/DataContext.tsx` — `useData().activeCases`, `savedSearches` resolution `[VERIFIED 2026-04-14]`
- `src/App.tsx` — route table, `ProtectedRoute`, `Layout` wrapping `[VERIFIED 2026-04-14]`
- `server/auditMiddleware.ts` — automatic `/api/*` logging, body redaction, no explicit audit call needed from client `[VERIFIED 2026-04-14]`
- `server/auditDb.ts` — schema `(id, timestamp, method, path, user, status, duration_ms, body, query)`; 90-day retention `[VERIFIED 2026-04-14]`
- `server/auditApi.ts` — read-only by design; new `/events/view-open` GET follows the same router pattern `[VERIFIED 2026-04-14]`
- `server/dataApi.ts` — `validateCaseCenters` authz pattern, input size caps `[VERIFIED 2026-04-14]`
- `scripts/generate-center-bundle.ts` — authoritative generator for bundle shape; confirms Procedure-based treatment encoding, laterality codes 362503005/362502000, `unit: "decimal"` for visus `[VERIFIED 2026-04-14]`
- `public/data/center-*.json` — 7 bundles, 41–45 MedicationStatement each, 416–556 Procedures each, zero MedicationAdministration `[VERIFIED via grep count 2026-04-14]`
- `tests/constants.test.ts` + `tests/fhirApi.test.ts` + `tests/auditMiddleware.test.ts` — vitest patterns for pure utilities and middleware (`vi.mock`, `beforeEach`, `describe` / `it` / `expect`) `[VERIFIED 2026-04-14]`
- `package.json` — pinned versions: react 19.2.4, react-router-dom 7.14.0, recharts 3.8.1, vitest 4.1.4, lucide-react 1.8.0 `[VERIFIED 2026-04-14]`
- `node_modules/recharts/types/chart/ComposedChart.d.ts` + `types/cartesian/Area` via `types/index.d.ts` lines 70, 105 — confirms ComposedChart + Area export from 3.8.1 `[VERIFIED 2026-04-14]`
- `.planning/phases/08-cohort-outcome-trajectories/08-CONTEXT.md` — decisions D-01..D-36 `[VERIFIED 2026-04-14]`
- `.planning/phases/08-cohort-outcome-trajectories/08-UI-SPEC.md` — visual contract, copy, accessibility `[VERIFIED 2026-04-14]`
- `.planning/REQUIREMENTS.md` — OUTCOME-01..12 `[VERIFIED 2026-04-14]`

### Secondary (MEDIUM confidence)
- Recharts 3.x `Area` `baseLine` prop — feature present in Recharts 2.x+; assumed preserved in 3.8.1 based on release-note style (not directly inspected in installed `.d.ts`). Fallback (two-area masking) documented in Pattern 3. `[CITED: Recharts documentation patterns]`

### Tertiary (LOW confidence)
- Performance estimate for 300+ `<Line>` elements in Recharts — order-of-magnitude only, based on training knowledge of React SVG reconciliation. Should be profiled during Wave 1 if cohorts exceed ~150 patients.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified against installed `node_modules`
- Architecture: HIGH — patterns are all live in the current codebase (AnalysisPage, VisusCrtChart)
- Pitfalls: MEDIUM-HIGH — P1 (Recharts perf) and P4 (MedicationAdministration absent) are empirical but need the user's confirmation before locking
- Audit integration: HIGH — middleware + ledger verified; the new endpoint is a one-line addition
- Math: HIGH — algorithm is standard linear interpolation + percentile; edge cases enumerated

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30 days; stable domain, pinned dependencies)
