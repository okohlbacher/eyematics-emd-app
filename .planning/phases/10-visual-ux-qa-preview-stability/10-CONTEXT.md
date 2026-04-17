# Phase 10: Visual/UX QA & Preview Stability — Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Close every v1.5 visual/UX QA flag with a **verifiable test** (snapshot, contrast, or uniqueness), fix the OutcomesDataPreview row key instability, and add a third empty-state variant for fully-filtered cohorts.

**Requirements:** VQA-01, VQA-02, VQA-03, VQA-04, VQA-05, CRREV-02

Out of phase: any new feature, any server-side work, any dark-mode theming (see Deferred).
</domain>

<decisions>
## Implementation Decisions

### Chart Palette (VQA-02, VQA-03)

- **D-01:** **Per-eye base color, role-derived series.** Each panel (OD / OS / OD+OS) keeps one base color; series derive from opacity + stroke weight:
  - Median line — base color, `strokeWidth=3`, no opacity.
  - Per-patient lines — base color, `strokeWidth=1.5`, `strokeOpacity=0.6` (dense) / `0.3` (sparse). (Already in `OutcomesPanel.tsx:159-161` — keep.)
  - Scatter dots — base color, fill alpha `0.7`, no stroke.
  - IQR band — base color, `fillOpacity=0.15`, `stroke="none"` (already at 15% in `OutcomesPanel.tsx:144` — keep).
- **D-02:** Base colors MUST pass WCAG AA contrast (≥ 4.5:1 for text-equivalent, ≥ 3:1 for large/graphical) against the panel background (`white` / `#ffffff`) at `strokeWidth=3` (median) — codified by a unit test that computes relative luminance for each declared base color.
- **D-03:** Base colors live in a single `src/components/outcomes/palette.ts` module exporting `EYE_COLORS: { OD: string; OS: string; 'OD+OS': string }` + `SERIES_STYLES` constants. No inline hex literals in `OutcomesPanel.tsx` after this phase.

### IQR Band Edge Case (VQA-03)

- **D-04:** When `n < 2` at a grid point, the median-grid row omits `p25` / `p75` (already the behavior in `utils/cohortTrajectory.ts` — verify). The panel's `<Area>` must tolerate missing band values without rendering a 0-height artifact — verified by a test that seeds a grid with sparse points and asserts the rendered SVG has no `<path>` with `d` producing degenerate geometry at those x-values.

### Tooltip (VQA-04) — Claude's Discretion within these guardrails

- **D-05:** Tooltip shows (in order): **patient pseudonym**, **eye** (OD / OS), **x-value** with unit (`d` for days or `#N` for treatment index), **y-value** with metric-appropriate unit (`logMAR` absolute, `Δ logMAR` delta, `%` for Δ%). All numbers use `Intl.NumberFormat(locale)`.
- **D-06:** Per-patient series tooltip is **suppressed** when `layers.perPatient === false`. Median / scatter / IQR tooltips remain independent. Implementation: filter Recharts `<Tooltip>` payload by `dataKey` in `OutcomesTooltip.tsx` before rendering.

### Empty States (VQA-05) — Claude's Discretion

- **D-07:** Third variant added: `all-eyes-filtered` — triggered when `cohort.cases.length > 0` but post-OD/OS filter returns zero eligible measurements.
- **D-08:** Copy (Claude-authored, DE + EN):
  - Title: "No eyes match the current filters." / "Keine Augen entsprechen den aktuellen Filtern."
  - Body: "Adjust the OD/OS or layer toggles to see data." / "Passen Sie die OD/OS- oder Layer-Filter an, um Daten zu sehen."
  - No action link (user fixes it inline via the same toolbar they're looking at).

### Admin Filter Snapshot Test (VQA-01)

- **D-09:** Test lives in `tests/adminCenterFilter.test.tsx` (new). Uses RTL + the shared test harness already in use. Asserts: exactly 7 center options render with the current roster shorthand labels (UKA, UKC, UKD, UKG, UKL, UKMZ, UKT); filter selection narrows the user table by at least one user when seeded with multi-center users. **Lock the list** — if `data/centers.json` changes, this test must be updated in lockstep (serves as the roster-change canary).

### OutcomesDataPreview Row Key (CRREV-02)

- **D-10:** Replace `` key={`${r.patient_pseudonym}-${r.eye}-${r.observation_date}-${i}`} `` with `` key={`${r.patient_pseudonym}|${r.eye}|${r.observation_date}`} `` (no array index). Verification test seeds the preview with two identical rows' datasets in different orders and asserts no React key-duplication warning and rows render with consistent keys.
- **D-11:** If the same `(pseudo, eye, date)` tuple legitimately appears twice (multiple measurements same day — possible but rare), the key uses the tuple + `measurement_id` if available; otherwise a stable incrementing counter within the dataset. Decision at plan time which applies — not a blocker.

### Claude's Discretion

- Tooltip background/border styling (matches existing Tailwind conventions).
- Exact HSL triple for the three base colors — Claude picks values meeting WCAG AA (D-02), logs rationale in plan.
- Test framework choices within the existing Vitest + RTL stack.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & milestone state
- `.planning/REQUIREMENTS.md` §v1.6 Requirements — Visual/UX QA (VQA-01..05) + Phase 9 Code-Review Findings (CRREV-02)
- `.planning/ROADMAP.md` §Phase 10 — goal + 6 success criteria
- `.planning/v1.5-MILESTONE-AUDIT.md` — origin of the visual-QA flags

### Existing code surfaces (targets of this phase)
- `src/pages/AdminPage.tsx:58-109` — center filter state + load path (VQA-01 test target)
- `src/components/outcomes/OutcomesPanel.tsx` — chart container; IQR at line 140-145, series at 126-186
- `src/components/outcomes/OutcomesTooltip.tsx` — tooltip component (VQA-04 target)
- `src/components/outcomes/OutcomesEmptyState.tsx` — 2-variant empty state (VQA-05 extends to 3)
- `src/components/outcomes/OutcomesDataPreview.tsx:237` — the `key=` string using array index (CRREV-02 target)
- `src/utils/cohortTrajectory.ts` — median-grid computation (IQR edge case semantics)
- `src/i18n/translations.ts` — DE+EN string keys (VQA-05 adds 2 new keys each)
- `tests/outcomesI18n.test.ts` — i18n completeness pattern (new empty-state keys must be covered)

### No external specs
Requirements fully captured in the decisions above + REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **OutcomesPanel color prop** — already threaded per-eye; D-01 extends this with role-derived styles instead of adding new color props.
- **OutcomesTooltip component** — already handles pseudonym + metric formatting; D-05/D-06 extend, not replace.
- **OutcomesEmptyState 2-variant pattern** — D-07 adds a 3rd variant by extending the `Variant` union type.
- **Vitest + RTL** — test stack already in use (`tests/outcomesI18n.test.ts`, `tests/cohortTrajectory.test.ts`). No new test infrastructure needed.

### Established Patterns
- **i18n single-source** — `src/i18n/translations.ts` holds `{de, en}` pairs; completeness test in `tests/outcomesI18n.test.ts` catches missing translations — VQA-05 new keys MUST appear in both locales or the test fails.
- **Center shorthand map** — `/api/fhir/centers` is the single roster source; AdminPage already consumes it — VQA-01 test consumes the same endpoint.
- **No inline hex colors** (aspirational post-Phase 10) — current code mixes literals in OutcomesPanel; D-03 centralizes them.

### Integration Points
- `src/components/outcomes/palette.ts` (NEW) — consumed by `OutcomesPanel.tsx` and potentially by Phase 13 metric panels (CRT/interval/responder) — forward-compatible.
- `tests/adminCenterFilter.test.tsx` (NEW) — separate from `tests/outcomesI18n.test.ts`; standalone RTL test using the existing harness.

</code_context>

<specifics>
## Specific Ideas

- User explicitly excluded dark-mode from contrast verification (light only). See Deferred.
- User accepted Claude's discretion on tooltip content, empty-state copy, and test placement — decisions D-05..D-11 are proposed defaults, not user-authored preferences.

</specifics>

<deferred>
## Deferred Ideas

- **Dark mode contrast verification** — VQA-02 requirement text mentions "light and dark mode"; codebase has **no dark-mode infrastructure** (no Tailwind config, no `prefers-color-scheme` usage, no theme provider). Phase 10 scope is light-only. REQUIREMENTS.md footnote should be added at plan time to reflect this deviation; dark-mode theming belongs in a future milestone if desired.
- **Centralized design tokens beyond chart palette** — Phase 10 extracts chart colors only (D-03). Broader token system (spacing, typography, semantic colors) is out of scope.
- **Visual regression via image snapshots** — D-04 and D-02 use unit tests + contrast math, not pixel snapshots. Adding an image-snapshot harness (Playwright / storycap) is a separate initiative.
- **OutcomesDataPreview virtual scrolling for large cohorts** — CRREV-02 addresses row keys only; performance of the preview for thousands of rows is a candidate for Phase 12's pre-aggregation follow-up.

### Scope Boundary Note
The REQUIREMENTS.md text for VQA-02 says "both light and dark mode". Decision D-01/D-02 narrow this to light-only because no dark-mode theming exists to test against. If dark mode is later added, VQA-02 remains partially open — flag on the milestone audit.

</deferred>

---

*Phase: 10-visual-ux-qa-preview-stability*
*Context gathered: 2026-04-16*
