---
phase: 24-feedback-fixes
plan: 04
type: execute
wave: 2
depends_on:
  - 24-01
files_modified:
  - src/utils/qualityMetrics.ts
  - src/components/doc-quality/CenterComparisonChart.tsx
  - tests/qualityMetrics.test.ts
autonomous: true
requirements:
  - FB-04
must_haves:
  truths:
    - "DocQuality bar-chart bars use the project's muted palette tokens already established for the page (D-12, D-13)"
    - "Four series (completeness, dataCompleteness, plausibility, overall) remain visually distinguishable (D-14)"
    - "No contrast regression in light or dark mode (D-15)"
    - "No new palette is introduced — only existing tokens reused"
  artifacts:
    - path: "src/utils/qualityMetrics.ts"
      provides: "QUALITY_CATEGORY_COLORS reusing the established muted palette"
      contains: "QUALITY_CATEGORY_COLORS"
  key_links:
    - from: "src/utils/qualityMetrics.ts QUALITY_CATEGORY_COLORS"
      to: "src/components/doc-quality/CenterComparisonChart.tsx Bar fill"
      via: "fill={QUALITY_CATEGORY_COLORS[category]}"
      pattern: "QUALITY_CATEGORY_COLORS"
---

<objective>
Re-skin the DocQuality bar chart so its four bars use the muted palette tokens already used on the same page (D-12), instead of the saturated COHORT_PALETTES borrowed from cohort-overlay charts. Series must stay distinguishable (D-14) and contrast must hold in both light and dark modes (D-15). Today `QUALITY_CATEGORY_COLORS` (src/utils/qualityMetrics.ts:21-26) maps the four categories to `COHORT_PALETTES[0..3]` (emerald/amber/cyan/fuchsia 700) — too vibrant for this page.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/24-feedback-fixes/24-CONTEXT.md
@CLAUDE.md
@src/utils/qualityMetrics.ts
@src/components/doc-quality/CenterComparisonChart.tsx
@src/pages/DocQualityPage.tsx
@src/components/doc-quality/MetricCard.tsx
@src/components/doc-quality/CenterDetailPanel.tsx

<interfaces>
Today (qualityMetrics.ts:21-26):
```ts
export const QUALITY_CATEGORY_COLORS: Record<QualityCategory, string> = {
  completeness: COHORT_PALETTES[0],     // emerald-700 — too vibrant
  dataCompleteness: COHORT_PALETTES[1], // amber-700
  plausibility: COHORT_PALETTES[2],     // cyan-700
  overall: COHORT_PALETTES[3],          // fuchsia-700
};
```
The DocQuality page already uses muted tokens elsewhere — `var(--color-teal)`, `var(--color-sage)`, `var(--color-indigo)`, `var(--color-amber)`, `var(--color-coral)` — visible in `LandingPage.tsx` CENTRE_ACCENTS and the page's MetricCard / ScoreBadge components. These are the established muted family per D-13.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Inspect and re-map QUALITY_CATEGORY_COLORS to muted page tokens</name>
  <files>src/utils/qualityMetrics.ts, src/components/doc-quality/CenterComparisonChart.tsx</files>
  <action>
    Per D-12..D-15:
    1. Inspect `src/components/doc-quality/MetricCard.tsx`, `ScoreBadge.tsx`, `CenterDetailPanel.tsx`, and `DocQualityPage.tsx` for the muted CSS-variable tokens already in use on the page (likely some combination of `var(--color-teal)`, `var(--color-sage)`, `var(--color-indigo)`, `var(--color-amber)`).
    2. Pick four perceptually-distinct tokens from that established set for the four QualityCategory values. Suggested mapping (verify against actual page usage; adjust if a token is already overloaded for another meaning):
       - completeness → `var(--color-teal)`
       - dataCompleteness → `var(--color-sage)`
       - plausibility → `var(--color-indigo)`
       - overall → `var(--color-amber)`
    3. Update `QUALITY_CATEGORY_COLORS` to use those CSS-var strings directly. The bar-chart component already reads `fill={QUALITY_CATEGORY_COLORS[category]}` (CenterComparisonChart.tsx:84) — recharts accepts `var(...)` fills, so no Bar-component change is required unless verification shows otherwise.
    4. If recharts cannot resolve `var(...)` in SSR/test contexts (verify by running tests), fall back to resolving the variable at component mount with `getComputedStyle(document.documentElement).getPropertyValue('--color-teal')` inside CenterComparisonChart and pass concrete colours to Bar. Prefer the simpler `var(...)` route first.
    5. Verify visually distinguishable per D-14: if two adjacent muted tokens collapse perceptually, vary by lightness within the same family (e.g. swap `--color-sage` for `--color-sage-soft` is NOT correct — soft variants are backgrounds; instead pick a different muted hue like `--color-coral`).
    6. Verify dark mode per D-15: the project uses Tailwind v4 `@variant dark`; CSS-var tokens are already dark-mode-aware (see Phase 17 VIS-01..03), so reusing tokens auto-inherits dark contrast. Spot-check by toggling theme in dev mode if practical, otherwise rely on the existing token contract.
    Commit message: `refactor(24): align DocQuality bar palette with muted page tokens (FB-04)`
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run lint &amp;&amp; npm run knip</automated>
  </verify>
  <done>QUALITY_CATEGORY_COLORS uses 4 muted CSS-var tokens already established on the DocQuality page; CenterComparisonChart renders without errors; safety net green; the four series stay distinguishable.</done>
</task>

<task type="auto">
  <name>Task 2: Update or add palette test for the new mapping</name>
  <files>tests/qualityMetrics.test.ts</files>
  <action>
    1. If `tests/qualityMetrics.test.ts` exists and asserts the old COHORT_PALETTES mapping, update those assertions to match the new muted token strings.
    2. If no such test exists, add a focused test asserting:
       - `QUALITY_CATEGORY_COLORS` has exactly the 4 keys `completeness`, `dataCompleteness`, `plausibility`, `overall`
       - Each value is a non-empty string starting with `var(--color-` (the muted-palette contract)
       - The four values are pairwise distinct
    3. Per CLAUDE.md: no jest-dom; use plain `expect(...)` from vitest.
    Commit message: `test(24): assert DocQuality palette uses distinct muted page tokens (FB-04)`
  </action>
  <verify>
    <automated>npm run test:ci -- qualityMetrics</automated>
  </verify>
  <done>Palette test passes; full suite green.</done>
</task>

</tasks>

<verification>
- `grep -n COHORT_PALETTES src/utils/qualityMetrics.ts` returns nothing (or only an unrelated import that knip doesn't flag)
- DocQuality bar chart renders in dev mode with bars in the muted family
- Light + dark modes both pass spot-check (tokens inherit theme)
- Full safety net (test:ci + build + lint + knip) green
</verification>

<success_criteria>
ROADMAP §Phase 24 success criterion 4: Documentation Quality bar chart uses the project's muted chart palette consistent with other charts on the page; series remain visually distinguishable; no contrast regression.
</success_criteria>

<output>
After completion, create `.planning/phases/24-feedback-fixes/24-04-SUMMARY.md`.
</output>
