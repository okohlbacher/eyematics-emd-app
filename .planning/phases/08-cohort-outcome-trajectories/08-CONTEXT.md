# Phase 8: Cohort Outcome Trajectories — Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a cohort-scoped **Outcomes view** that plots longitudinal visual-acuity (visus) trajectories across the members of any cohort — saved or ad-hoc — with OD/OS/combined panels, toggleable X-axis (time vs treatment index) and Y-metric (absolute/Δ/Δ%), independently hideable display layers (median line, per-patient curves, scatter, spread band), an interpolation-grid slider, summary cards, a Data-preview panel with CSV export, server-side audit, and full DE/EN localization.

**Out of scope** (moved to future phases): CRT trajectory, treatment-interval distributions, responder classification, any non-visus outcome metric.

</domain>

<decisions>
## Implementation Decisions

### Entry point & routing
- **D-01:** New route `/outcomes` in the client router (sibling of `/analysis`, not a tab inside it).
- **D-02:** Entry button lives on `CohortBuilderPage` — both per-row (for saved cohorts) and a header action (for the currently-applied ad-hoc filter).
- **D-03:** URL carries cohort identity two ways:
  - `?cohort=<savedSearchId>` when navigating from a saved cohort
  - `?filter=<urlencoded-JSON>` when navigating from an ad-hoc filter
- **D-04:** Page component lives at `src/pages/OutcomesPage.tsx`; all chart rendering lives inside that page and its co-located components under `src/components/outcomes/`.

### Baseline definition
- **D-05:** Baseline = **earliest Observation with LOINC_VISUS (`79880-1`) for (patient, eye)**, computed from the patient's entire observation record — **cohort-independent**. Δ and Δ% are computed against that per-(patient,eye) baseline.
- **D-06:** A patient with no visus in one eye is excluded from that eye's panel (see missing-data rules D-17..D-19).

### Treatment index (X-axis mode 2)
> **Reconciled 2026-04-14 after research:** Bundles contain **zero** `MedicationAdministration` resources; all treatments are `Procedure` resources with SNOMED code `36189003` (IVOM injection). `fhirLoader.ts` already exports `SNOMED_EYE_RIGHT` (362503005), `SNOMED_EYE_LEFT` (362502000), `SNOMED_IVI` (36189003).
- **D-07:** "Number of treatments" index is computed **per patient** as the cumulative count of `Procedure` resources with `code.coding.code == '36189003'` (`SNOMED_IVI`) up to and including each observation's date.
- **D-08:** Treatment index is **eye-aware per panel**: OD panel counts only right-eye injections (`bodySite.coding.code == '362503005'` / `SNOMED_EYE_RIGHT`), OS panel only left-eye (`362502000` / `SNOMED_EYE_LEFT`), combined panel uses all. If `bodySite` is missing or has no recognized laterality code, the procedure is **excluded from OD/OS panels but counted in the combined panel**.
- **D-09:** If a patient has zero IVI Procedures and X-axis mode "Number of treatments" is active, that patient is rendered as a single scatter dot at index 0 for each observation (same as the sparse-data rule D-18).

### Y-metric modes
- **D-10:** Three modes, controlled by a radio group in the settings drawer:
  - `absolute` — raw logMAR (primary plot unit); Snellen shown in tooltip only
  - `delta` — logMAR value minus patient+eye baseline (signed, negative = improvement on logMAR scale)
  - `delta_percent` — `(value - baseline) / baseline * 100`, clamped to ±200% for display (outliers beyond that are rendered as clipped scatter dots with a tooltip note)

### Spread band (toggle: "SD shading" in roadmap wording, relabeled for accuracy)
- **D-11:** Computation is **per-grid-point IQR** (25th–75th percentile band), not ±SD. Rationale: visus distributions are skewed; IQR is robust and matches clinical reporting convention.
- **D-12:** UI label: **"Streuband (IQR)"** (DE) / **"Spread band (IQR)"** (EN). The checkbox key is `spreadBand` (not `sdShading`) so it reads honestly.
- **D-13:** Computation is **pluggable** in `cohortTrajectory.ts` — the exported aggregator accepts a `spreadMode: 'iqr' | 'sd1' | 'sd2'` parameter defaulting to `'iqr'`. Future toggles can surface SD options without changing call sites.

### Interpolation grid
- **D-14:** Slider range **20–300**, default **120** (matches OUTCOME-06).
- **D-15:** For each patient curve, linear interpolation onto the shared grid between their min and max time-on-axis; **no extrapolation** beyond a patient's observed span — grid points outside each patient's span are `null` for that patient and excluded from per-grid-point median/IQR calculations.
- **D-16:** Grid is regenerated live from the slider; computation is memoized keyed on `(cohort members, axis mode, metric mode, grid_points)`.

### Missing / sparse data
- **D-17:** **0 measurements in an eye** → patient is excluded from that eye's panel. Shown in that panel's summary card as `excluded: N` with a tooltip listing reason.
- **D-18:** **1 measurement in an eye** → rendered as a single scatter dot (baseline point); no curve drawn; excluded from median/IQR interpolation.
- **D-19:** **2..⌈grid_points/10⌉-1 measurements** → curve is drawn at **reduced opacity (0.3 vs normal 0.6)** and flagged in the legend tooltip as "sparse — N points".
- **D-20:** **Combined panel** rule: a patient is included if they have ≥1 measurement in either eye; their OD and OS series are both plotted; median/IQR is computed over all measurements pooled.

### Settings UI layout
- **D-21:** All toggles and the slider live in a **right-side collapsible drawer** (same `Sheet` pattern used in `CohortBuilderPage` for filters).
- **D-22:** Drawer opens with a gear icon in the view header next to "Outcomes: <cohort name>".
- **D-23:** Drawer content, in order:
  1. X-axis mode (radio): Days since baseline / Number of treatments
  2. Y metric (radio): Absolute / Δ / Δ%
  3. Display layers (checkboxes): Median, Per-patient curves, Scatter, Spread band (IQR)
  4. Interpolation grid slider (20–300, step 10)
- **D-24:** Drawer state is **session-only** (React state + URL hash, no localStorage). Rationale: persisted settings bleed across cohorts and would confuse comparison.

### Summary cards
- **D-25:** Four cards, horizontally at top of the view:
  - Patient count
  - Total measurement count
  - OD measurement count
  - OS measurement count
- **D-26:** Each card recomputes on any filter/toggle change. All values derived from the same memoized aggregator used by the charts (single source of truth).

### Data preview & CSV export
- **D-27:** Expandable `<details>` panel below the three chart panels; closed by default.
- **D-28:** Table columns (matches CSV export 1:1):
  ```
  patient_pseudonym, eye, observation_date, days_since_baseline,
  treatment_index, visus_logmar, visus_snellen_numerator, visus_snellen_denominator
  ```
  Snellen convention: **20/x** numerator (US foot-based, e.g. 20/40). Rationale: international readability; convention isolated to a single helper in `cohortTrajectory.ts` so switching to 6/x is a one-line change if later requested.
- **D-29:** CSV export via existing `src/utils/download.ts` `downloadCsv` helper; filename via `datedFilename(...)`.
- **D-30:** `center_id` is **intentionally excluded** from the CSV (honors Phase 5 authz — the user already sees the data on-screen filtered to their authorized centers; exporting center_id adds no value and invites cross-site artifacts).

### Authz / audit
- **D-31:** All aggregation is **client-side** over data the existing data layer has already authorized (center-based restriction from Phase 5 still applies). **No new data-bypass endpoint.**
- **D-32:** Opening the Outcomes view triggers a server-side audit entry via the existing per-request audit middleware. Implementation: a new no-op endpoint `GET /api/audit/events/view-open?name=open_outcomes_view&cohort=<id|filter_hash>` called on mount; middleware captures the row automatically. **View-open only** — toggle changes do not emit additional audit events (matches AnalysisPage pattern).

### Pure utility boundary
- **D-33:** All math (baseline derivation, Δ/Δ%, treatment index computation, grid interpolation, median, IQR) lives in **`src/utils/cohortTrajectory.ts`** as pure, side-effect-free functions.
- **D-34:** Unit tests in `tests/cohortTrajectory.test.ts` cover the 5 edge cases from OUTCOME-10: empty cohort, single patient, single measurement, sparse series (< grid/10), mismatched-span (patients with non-overlapping observation windows).

### i18n
- **D-35:** Every new user-facing string is added to both `de` and `en` bundles in `src/i18n/translations.ts` under a new `outcomes.*` namespace. No hardcoded text.
- **D-36:** Strings follow the namespace shape used by existing analytical views (`cohortBuilder.*`, `analysis.*`).

### Performance ceiling
- **D-37:** Soft ceiling on cohort size for default scatter layer rendering. When `patientCount > 30`, the **Scatter** display layer is **toggled off by default** on mount (user can still enable it). A subtle advisory badge appears in the settings drawer next to the Scatter toggle: "Scatter disabled by default for cohorts > 30 patients (performance)" / "Streupunkte bei Kohorten > 30 Patient:innen standardmäßig aus (Performance)".
- **D-38:** The median line, per-patient curves, and IQR spread band remain on by default regardless of cohort size — scatter is the only layer throttled.
- **D-39:** Unit test for the default-layer-resolution helper covers the 30-patient boundary (29 → scatter on, 30 → on, 31 → off).

### Unit handling (visus observation source)
- **D-40:** Observations store visus as `value` with `unit: "decimal"` (decimal acuity, e.g. 0.5 = 20/40). `cohortTrajectory.ts` **normalizes to logMAR at ingest** via `logMAR = -log10(decimal)`. All downstream math (baseline Δ, Δ%, median, IQR, grid interpolation) operates in logMAR space. Snellen (`20/x`) is computed only for the CSV export / tooltip display: `x = round(20 / decimal)`.
- **D-41:** Y-axis shows logMAR values in plot (matches clinical outcome reporting convention); tooltip additionally displays the Snellen equivalent on a second line.

### Claude's Discretion
- Recharts vs raw SVG for the three panels (default: Recharts, to match the existing codebase; fall back to raw SVG only if Recharts can't express per-grid-point band rendering cleanly)
- Exact color palette for OD/OS/combined panels (pick from `CHART_COLORS` in `clinicalThresholds`, preferring a colorblind-safe pair)
- Whether the three panels stack vertically on narrow viewports (< ~1100px) or scroll horizontally
- Specific drawer animation, hover tooltip content beyond required fields
- Loading skeleton design while aggregation runs
- Exact layout of summary cards (density, iconography)

</decisions>

<specifics>
## Specific Ideas

- "Three panels side-by-side for OD, OS, combined" — wide layout, drawer keeps plot area maximum
- Follow Recharts patterns already established in `AnalysisPage.tsx`, `VisusCrtChart.tsx`, `DistributionCharts.tsx`
- Spread band should not be called "SD shading" in the UI — IQR is what we compute
- The settings drawer should feel like the existing CohortBuilder filter Sheet — same mental model
- Data preview is always the CSV export source — table rows and CSV rows are identical; users can paste from either

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §"Cohort Outcome Trajectories (OUTCOME-*)" — acceptance criteria OUTCOME-01..12 (phase requirement IDs)
- `.planning/ROADMAP.md` §"Phase 8: Cohort Outcome Trajectories" — goal and success criteria

### Existing patterns (code references)
- `src/pages/AnalysisPage.tsx` — query-param-driven analytical page pattern, Recharts composition
- `src/pages/CohortBuilderPage.tsx` — cohort navigation source, filter Sheet pattern (mirror for settings drawer)
- `src/components/case-detail/VisusCrtChart.tsx` — per-case visus plotting with OD/OS separation (nearest existing analog)
- `src/services/fhirLoader.ts` — `getObservationsByCode(obs, LOINC_VISUS)`, `applyFilters(cases, CohortFilter)`, `LOINC_VISUS = '79880-1'`
- `src/context/DataContext.tsx` — `activeCases`, cohort access point
- `src/i18n/translations.ts` — i18n bundle structure (`de`/`en` locales, namespaced keys)
- `src/utils/download.ts` — `downloadCsv`, `datedFilename` (CSV export helpers)
- `src/config/clinicalThresholds.ts` — `CHART_COLORS` palette

### Authz & audit (carried from Phase 5)
- `.planning/phases/05-*/` — completed Phase 5 phase directory (audit + center-based restriction patterns; archived)
- `server/audit.ts` — audit write helper (pattern to match for `open_outcomes_view` entry)
- `server/fhirApi.ts` — center-based access enforcement (no new endpoint needed; reuses existing authorized reads)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Recharts` (ResponsiveContainer, LineChart, ScatterChart, ReferenceArea, etc.) — already a dependency, used across 7 files
- `getObservationsByCode(obs, LOINC_VISUS)` — extracts visus observations per case
- `applyFilters(cases, CohortFilter)` — cohort member resolution from filter JSON
- `CohortFilter`, `SavedSearch` types in `src/types/fhir.ts`
- `downloadCsv` + `datedFilename` in `src/utils/download.ts` — CSV export with consistent filenames
- `CHART_COLORS` palette in `src/config/clinicalThresholds.ts`
- `useLanguage()` / `useData()` hooks — i18n + cohort data access
- Sheet/drawer component (used in CohortBuilderPage filters)

### Established Patterns
- Analytical pages are route-addressable and take cohort context via URL search params (`useSearchParams`)
- FHIR resource access goes through `src/services/fhirLoader.ts`; LOINC/SNOMED code constants live there
- All user-facing strings go through `useLanguage().t(...)` with bundles in `src/i18n/translations.ts`
- Server-side audit via `server/audit.ts` — called by the data endpoints, not the client
- Unit tests in `tests/` use vitest; pure utilities are the testing sweet spot (see `tests/constants.test.ts`, `tests/fhirApi.test.ts`)

### Integration Points
- **Router:** Add `/outcomes` to the route table (location TBD during research — likely `src/App.tsx` or a routes config)
- **Navigation:** `CohortBuilderPage` adds "Outcomes" button (per-row + header)
- **Data:** `useData()` supplies cohort members; no new data context needed
- **Audit:** New endpoint (or extend an existing view-open endpoint) to log `open_outcomes_view`
- **i18n:** New `outcomes.*` namespace in both locale bundles

</code_context>

<deferred>
## Deferred Ideas

- CRT trajectory view (parallel visualization for retinal thickness) — future analytics phase
- Treatment-interval distribution charts — future analytics phase
- Responder classification (clustering patients into response categories) — future analytics phase
- Cross-cohort comparison (overlaying two cohorts on the same plot) — future feature
- Outcome metrics beyond visus (visual field, IOP, etc.) — out of scope for v1.5
- Persisting settings drawer state across sessions (intentionally deferred — avoids cross-cohort bleed)

</deferred>

---

*Phase: 08-cohort-outcome-trajectories*
*Context gathered: 2026-04-14 via /gsd-discuss-phase*
