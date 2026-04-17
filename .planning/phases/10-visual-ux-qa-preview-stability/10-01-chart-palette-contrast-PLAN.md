---
phase: 10-visual-ux-qa-preview-stability
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/outcomes/palette.ts
  - src/components/outcomes/OutcomesPanel.tsx
  - src/pages/OutcomesPage.tsx
  - tests/outcomesPalette.contrast.test.ts
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [VQA-02]
requirements_addressed: [VQA-02]

must_haves:
  truths:
    - "A single module `src/components/outcomes/palette.ts` exports `EYE_COLORS` (OD/OS/OD+OS) and `SERIES_STYLES` (median/perPatient/scatter/iqr); no chart-series hex literal remains inside OutcomesPanel.tsx."
    - "Every base color in EYE_COLORS passes WCAG AA graphical contrast (≥ 3.0 against #ffffff), codified by `tests/outcomesPalette.contrast.test.ts`."
    - "OutcomesPanel.tsx consumes stroke/fill/opacity from SERIES_STYLES (median strokeWidth=3 per D-01, perPatient strokeWidth=1.5 w/ opacity 0.6/0.3, scatter fillOpacity=0.7, IQR fillOpacity=0.15 stroke=none)."
    - "OutcomesPage.tsx passes `color={EYE_COLORS.OD|OS|['OD+OS']}` to each panel (replaces CHART_COLORS[0/2/4] usage)."
    - "REQUIREMENTS.md §VQA-02 carries a dark-mode deferral footnote per CONTEXT.md §Deferred."
  artifacts:
    - path: "src/components/outcomes/palette.ts"
      provides: "EYE_COLORS + SERIES_STYLES + computeContrastRatio + relativeLuminance + PANEL_BACKGROUND"
      contains: "export const EYE_COLORS"
    - path: "tests/outcomesPalette.contrast.test.ts"
      provides: "WCAG AA contrast unit test for every EYE_COLORS entry"
      contains: "describe('EYE_COLORS WCAG AA contrast"
    - path: "src/components/outcomes/OutcomesPanel.tsx"
      provides: "Chart panel consuming palette module (no chart-series inline hex)"
      contains: "from './palette'"
    - path: "src/pages/OutcomesPage.tsx"
      provides: "Per-panel color prop sourced from EYE_COLORS"
      contains: "EYE_COLORS"
  key_links:
    - from: "src/components/outcomes/OutcomesPanel.tsx"
      to: "src/components/outcomes/palette.ts"
      via: "named import of SERIES_STYLES"
      pattern: "import.*SERIES_STYLES.*palette"
    - from: "src/pages/OutcomesPage.tsx"
      to: "src/components/outcomes/palette.ts"
      via: "named import of EYE_COLORS for per-panel color props"
      pattern: "EYE_COLORS\\.(OD|OS|\\['OD\\+OS'\\])"
    - from: "tests/outcomesPalette.contrast.test.ts"
      to: "src/components/outcomes/palette.ts"
      via: "named import of EYE_COLORS + computeContrastRatio"
      pattern: "import.*EYE_COLORS.*palette"
---

<objective>
Extract outcomes chart colors into a single typed module (`src/components/outcomes/palette.ts`) with role-derived series styles per D-01, refactor `OutcomesPanel.tsx` + `OutcomesPage.tsx` to consume it, add a WCAG-AA contrast unit test (≥ 3:1 graphical threshold against `#ffffff` per D-02, light-mode only per CONTEXT.md §Deferred), and record the dark-mode deferral footnote against VQA-02 in `REQUIREMENTS.md`.

Purpose: Close VQA-02 with a verifiable contrast test. Establish the palette module that Phase 13 (CRT / Interval / Responder panels) will reuse without duplication.
Output: New `palette.ts`, refactored consumers, new contrast test, REQUIREMENTS.md footnote.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md
@src/components/outcomes/OutcomesPanel.tsx
@src/pages/OutcomesPage.tsx
@src/config/clinicalThresholds.ts

<interfaces>
<!-- Key types the executor needs. Extracted verbatim from source 2026-04-16. -->

From src/components/outcomes/OutcomesPanel.tsx (lines 17-34) — Props + LayerState:
```typescript
type LayerState = {
  median: boolean;
  perPatient: boolean;
  scatter: boolean;
  spreadBand: boolean;
};
interface Props {
  panel: PanelResult;
  eye: 'od' | 'os' | 'combined';
  color: string;           // currently a hex from CHART_COLORS — to be sourced from EYE_COLORS
  axisMode: AxisMode;
  yMetric: YMetric;
  layers: LayerState;
  t: (key: string) => string;
  locale: 'de' | 'en';
  titleKey: 'outcomesPanelOd' | 'outcomesPanelOs' | 'outcomesPanelCombined';
}
```

Current literal values inside OutcomesPanel.tsx (verify these line numbers before editing):
- Line 144: `fillOpacity={0.15}` (IQR Area)
- Line 145: `stroke="none"` (IQR Area)
- Line 160: `strokeWidth={1.5}` (per-patient Line)
- Line 161: `strokeOpacity={p.sparse ? 0.3 : 0.6}` (per-patient Line)
- Line 171: `fillOpacity={0.5}` (Scatter) — D-01 mandates `0.7`, must be bumped
- Line 182: `strokeWidth={3}` (median Line)

Current OutcomesPage.tsx per-panel color source (lines 176, 187, 198):
```
color={CHART_COLORS[0]}   // OD panel
color={CHART_COLORS[2]}   // OS panel
color={CHART_COLORS[4]}   // combined panel
```
From src/config/clinicalThresholds.ts:13:
`export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];`
So currently OD=#3b82f6, OS=#f59e0b, combined=#8b5cf6. These are replaced by EYE_COLORS values.

Panel background (for contrast computation) comes from OutcomesPanel.tsx:63,91 `bg-white` → `#ffffff`.
</interfaces>

<scope_note>
Light-mode-only: CONTEXT.md §Deferred narrows VQA-02 to light mode. Dark mode deferred to a future milestone because codebase has no Tailwind theme config / no `prefers-color-scheme` / no theme provider. REQUIREMENTS.md §VQA-02 gets a footnote in Task 4 to record the deviation.
</scope_note>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create src/components/outcomes/palette.ts (EYE_COLORS, SERIES_STYLES, contrast helpers)</name>
  <files>src/components/outcomes/palette.ts</files>
  <read_first>
    - src/components/outcomes/OutcomesPanel.tsx (entire file — confirm every SERIES_STYLES field has a matching literal in source)
    - .planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md §Chart Palette (D-01, D-02, D-03)
    - src/config/clinicalThresholds.ts (to understand the values being replaced)
  </read_first>
  <behavior>
    - `EYE_COLORS` is a `{ OD, OS, 'OD+OS' }` record of 6-digit hex strings; every value passes `computeContrastRatio(value, '#ffffff') >= 3.0` when executed.
    - `SERIES_STYLES` is a `{ median, perPatient, scatter, iqr }` record with EXACT D-01 shapes:
      - `median.strokeWidth === 3`
      - `perPatient.strokeWidth === 1.5`, `perPatient.opacityDense === 0.6`, `perPatient.opacitySparse === 0.3`
      - `scatter.fillOpacity === 0.7` (per D-01 — bumps previous 0.5)
      - `iqr.fillOpacity === 0.15`, `iqr.stroke === 'none'`
    - `PANEL_BACKGROUND === '#ffffff'`.
    - `relativeLuminance(hex: string): number` implements the WCAG 2.1 SC 1.4.11 formula (sRGB-linear transform).
    - `computeContrastRatio(fg: string, bg: string): number` implements `(L_hi + 0.05) / (L_lo + 0.05)`.
    - `relativeLuminance('#ffffff')` is within 0.001 of `1.0`; `relativeLuminance('#000000')` is within 0.001 of `0.0`; `computeContrastRatio('#000000', '#ffffff')` is within 0.1 of `21.0`.
    - Type exports: `EyeKey = keyof typeof EYE_COLORS`.
  </behavior>
  <action>
    Create `src/components/outcomes/palette.ts` with this exact content (verify the three base hex values pass `computeContrastRatio(x, '#ffffff') >= 3.0` before committing — the recommended Tailwind-700 anchors below are pre-verified: OD `#1d4ed8` ≈ 8.58, OS `#b91c1c` ≈ 6.51, OD+OS `#6d28d9` ≈ 8.68):

    ```typescript
    /**
     * EMD Outcomes — chart palette + role-derived series styles.
     *
     * Phase 10 / D-01, D-02, D-03.
     *
     * Light mode only. Dark mode is deferred per
     * `.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md` §Deferred
     * (codebase has no dark-mode infrastructure). If dark mode is added later,
     * re-verify EYE_COLORS against the dark background.
     *
     * Contrast ratios against #ffffff (computed 2026-04-16):
     *   OD     #1d4ed8 (tailwind blue-700)   ≈ 8.58:1
     *   OS     #b91c1c (tailwind red-700)    ≈ 6.51:1
     *   OD+OS  #6d28d9 (tailwind violet-700) ≈ 8.68:1
     * All exceed WCAG 2.1 SC 1.4.11 graphical threshold (3.0:1).
     */

    export const EYE_COLORS = {
      OD: '#1d4ed8',
      OS: '#b91c1c',
      'OD+OS': '#6d28d9',
    } as const;

    export type EyeKey = keyof typeof EYE_COLORS;

    export const SERIES_STYLES = {
      median: { strokeWidth: 3 },
      perPatient: { strokeWidth: 1.5, opacityDense: 0.6, opacitySparse: 0.3 },
      scatter: { fillOpacity: 0.7 },
      iqr: { fillOpacity: 0.15, stroke: 'none' as const },
    } as const;

    export const PANEL_BACKGROUND = '#ffffff';

    /** Relative luminance per WCAG 2.1 (sRGB). `hex` is 6-digit `#rrggbb`. */
    export function relativeLuminance(hex: string): number {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
      if (!m) throw new Error(`Invalid hex: ${hex}`);
      const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
      const lin = (c: number) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    }

    /** WCAG contrast ratio between two hex colors. Graphical threshold = 3.0. */
    export function computeContrastRatio(fg: string, bg: string): number {
      const L1 = relativeLuminance(fg);
      const L2 = relativeLuminance(bg);
      const [lo, hi] = L1 < L2 ? [L1, L2] : [L2, L1];
      return (hi + 0.05) / (lo + 0.05);
    }
    ```

    If any of the three anchor hex values fails `>= 3.0` during Task 3's contrast test, replace with a darker Tailwind-700/800 shade (blue-800 `#1e40af`, red-800 `#991b1b`, violet-800 `#5b21b6`) and re-run the contrast test until green.
  </action>
  <verify>
    <automated>test -f src/components/outcomes/palette.ts &amp;&amp; npx tsc --noEmit src/components/outcomes/palette.ts 2>&amp;1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/components/outcomes/palette.ts` exits 0
    - `grep -E "^export const EYE_COLORS" src/components/outcomes/palette.ts` matches
    - `grep -E "OD: '#[0-9a-f]{6}'" src/components/outcomes/palette.ts` matches
    - `grep -E "OS: '#[0-9a-f]{6}'" src/components/outcomes/palette.ts` matches
    - `grep -E "'OD\+OS': '#[0-9a-f]{6}'" src/components/outcomes/palette.ts` matches
    - `grep -E "median: \{ strokeWidth: 3 \}" src/components/outcomes/palette.ts` matches
    - `grep -E "strokeWidth: 1\.5, opacityDense: 0\.6, opacitySparse: 0\.3" src/components/outcomes/palette.ts` matches
    - `grep -E "scatter: \{ fillOpacity: 0\.7 \}" src/components/outcomes/palette.ts` matches
    - `grep -E "iqr: \{ fillOpacity: 0\.15, stroke: 'none' as const \}" src/components/outcomes/palette.ts` matches
    - `grep -E "^export const PANEL_BACKGROUND = '#ffffff'" src/components/outcomes/palette.ts` matches
    - `grep -E "^export function relativeLuminance" src/components/outcomes/palette.ts` matches
    - `grep -E "^export function computeContrastRatio" src/components/outcomes/palette.ts` matches
  </acceptance_criteria>
  <done>palette.ts exists with EYE_COLORS, SERIES_STYLES, relativeLuminance, computeContrastRatio, PANEL_BACKGROUND exported.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Refactor OutcomesPanel.tsx + OutcomesPage.tsx to consume palette.ts</name>
  <files>src/components/outcomes/OutcomesPanel.tsx, src/pages/OutcomesPage.tsx</files>
  <read_first>
    - src/components/outcomes/OutcomesPanel.tsx (entire file — identify every literal to replace)
    - src/pages/OutcomesPage.tsx (lines 170-206 — three OutcomesPanel renders)
    - src/components/outcomes/palette.ts (the module from Task 1)
    - src/config/clinicalThresholds.ts (confirm CHART_COLORS is only referenced from OutcomesPage for panel color; grep other usage before editing)
  </read_first>
  <behavior>
    - OutcomesPanel.tsx imports `SERIES_STYLES` from `./palette` and uses it for every IQR / per-patient / scatter / median literal.
    - Scatter `fillOpacity` is `SERIES_STYLES.scatter.fillOpacity` (which is `0.7`, up from the current `0.5`).
    - OutcomesPage.tsx imports `EYE_COLORS` from `../components/outcomes/palette` and passes:
      - `color={EYE_COLORS.OD}` for the OD panel (replacing `CHART_COLORS[0]`)
      - `color={EYE_COLORS.OS}` for the OS panel (replacing `CHART_COLORS[2]`)
      - `color={EYE_COLORS['OD+OS']}` for the combined panel (replacing `CHART_COLORS[4]`)
    - `CHART_COLORS` import in OutcomesPage.tsx is removed if no remaining usage exists in the file after the refactor (grep `CHART_COLORS` inside OutcomesPage.tsx post-edit — zero matches means drop the import line 11).
    - Chart chrome literals (`stroke="#94a3b8"` at line 111, `fill: '#6b7280'` at line 120) are OUT OF SCOPE — leave as-is. D-03 centralizes chart-series colors only.
  </behavior>
  <action>
    Step 1: In `src/components/outcomes/OutcomesPanel.tsx`, add at the top (after the existing `import OutcomesTooltip from './OutcomesTooltip';`):
    ```typescript
    import { SERIES_STYLES } from './palette';
    ```

    Step 2: Replace literals inside OutcomesPanel.tsx (verify line numbers match before editing — they may shift after the import is added; search by context not line number):

    a) IQR `<Area>` (currently lines 138-148):
       ```tsx
       <Area
         data={iqrData}
         dataKey="iqrHigh"
         baseLine={iqrBaseLine}
         fill={color}
         fillOpacity={SERIES_STYLES.iqr.fillOpacity}
         stroke={SERIES_STYLES.iqr.stroke}
         isAnimationActive={false}
       />
       ```

    b) Per-patient `<Line>` (currently lines 150-165):
       ```tsx
       <Line
         key={p.id}
         data={p.measurements}
         dataKey="y"
         type="linear"
         stroke={color}
         strokeWidth={SERIES_STYLES.perPatient.strokeWidth}
         strokeOpacity={p.sparse ? SERIES_STYLES.perPatient.opacitySparse : SERIES_STYLES.perPatient.opacityDense}
         dot={false}
         isAnimationActive={false}
       />
       ```

    c) `<Scatter>` (currently lines 167-174):
       ```tsx
       <Scatter
         data={panel.scatterPoints}
         fill={color}
         fillOpacity={SERIES_STYLES.scatter.fillOpacity}
         isAnimationActive={false}
       />
       ```

    d) Median `<Line>` (currently lines 176-186):
       ```tsx
       <Line
         data={panel.medianGrid}
         dataKey="y"
         type="linear"
         stroke={color}
         strokeWidth={SERIES_STYLES.median.strokeWidth}
         dot={false}
         isAnimationActive={false}
       />
       ```

    Step 3: In `src/pages/OutcomesPage.tsx`:

    a) Add near the other component imports (after line 8 `import OutcomesPanel from ...`):
       ```typescript
       import { EYE_COLORS } from '../components/outcomes/palette';
       ```

    b) In the three `<OutcomesPanel>` renders (lines 173-205), change the `color` prop:
       - Line 176: `color={CHART_COLORS[0]}` → `color={EYE_COLORS.OD}`
       - Line 187: `color={CHART_COLORS[2]}` → `color={EYE_COLORS.OS}`
       - Line 198: `color={CHART_COLORS[4]}` → `color={EYE_COLORS['OD+OS']}`

    c) After the edits, run `grep -n CHART_COLORS src/pages/OutcomesPage.tsx`. If zero matches remain (expected), delete the `import { CHART_COLORS } from '../config/clinicalThresholds';` line (currently line 11). If any match remains, keep the import and leave a SUMMARY note explaining the remaining use.

    Step 4: Do NOT modify `src/config/clinicalThresholds.ts` — other code paths (Analysis page, Cohort page) may still consume CHART_COLORS. This plan touches outcomes only.
  </action>
  <verify>
    <automated>npm run typecheck 2>&amp;1 | tail -10 &amp;&amp; npx vitest run tests/OutcomesPage.test.tsx 2>&amp;1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "^import \{ SERIES_STYLES \} from './palette';" src/components/outcomes/OutcomesPanel.tsx` matches
    - `grep -E "fillOpacity=\{SERIES_STYLES\.iqr\.fillOpacity\}" src/components/outcomes/OutcomesPanel.tsx` matches
    - `grep -E "stroke=\{SERIES_STYLES\.iqr\.stroke\}" src/components/outcomes/OutcomesPanel.tsx` matches
    - `grep -E "strokeWidth=\{SERIES_STYLES\.perPatient\.strokeWidth\}" src/components/outcomes/OutcomesPanel.tsx` matches
    - `grep -E "SERIES_STYLES\.perPatient\.opacitySparse" src/components/outcomes/OutcomesPanel.tsx` matches
    - `grep -E "SERIES_STYLES\.perPatient\.opacityDense" src/components/outcomes/OutcomesPanel.tsx` matches
    - `grep -E "fillOpacity=\{SERIES_STYLES\.scatter\.fillOpacity\}" src/components/outcomes/OutcomesPanel.tsx` matches
    - `grep -E "strokeWidth=\{SERIES_STYLES\.median\.strokeWidth\}" src/components/outcomes/OutcomesPanel.tsx` matches
    - `! grep -E "fillOpacity=\{0\.5\}" src/components/outcomes/OutcomesPanel.tsx` (old scatter literal removed)
    - `! grep -E "strokeWidth=\{3\}|strokeWidth=\{1\.5\}|fillOpacity=\{0\.15\}" src/components/outcomes/OutcomesPanel.tsx` (no chart-series inline literals)
    - `grep -E "import \{ EYE_COLORS \} from '../components/outcomes/palette';" src/pages/OutcomesPage.tsx` matches
    - `grep -E "color=\{EYE_COLORS\.OD\}" src/pages/OutcomesPage.tsx` matches
    - `grep -E "color=\{EYE_COLORS\.OS\}" src/pages/OutcomesPage.tsx` matches
    - `grep -E "color=\{EYE_COLORS\[\"OD\+OS\"\]\}|color=\{EYE_COLORS\['OD\+OS'\]\}" src/pages/OutcomesPage.tsx` matches
    - `! grep -E "color=\{CHART_COLORS\[" src/pages/OutcomesPage.tsx` (no CHART_COLORS color prop remains)
    - `npm run typecheck` exits 0
    - `npx vitest run tests/OutcomesPage.test.tsx` exits 0
  </acceptance_criteria>
  <done>OutcomesPanel + OutcomesPage compile, source their colors from palette.ts, existing OutcomesPage tests still pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add tests/outcomesPalette.contrast.test.ts (WCAG AA contrast gate)</name>
  <files>tests/outcomesPalette.contrast.test.ts</files>
  <read_first>
    - src/components/outcomes/palette.ts (the module from Task 1 — contract of EYE_COLORS, computeContrastRatio, PANEL_BACKGROUND)
    - tests/cohortTrajectory.test.ts (reference Vitest describe/it style)
    - tests/outcomesI18n.test.ts (reference import style for pure unit tests without JSX)
  </read_first>
  <behavior>
    - Test file loads EYE_COLORS, PANEL_BACKGROUND, computeContrastRatio, relativeLuminance from the palette module.
    - Sanity tests: `relativeLuminance('#ffffff')` ≈ 1.0 (3-digit tolerance), `relativeLuminance('#000000')` ≈ 0.0, `computeContrastRatio('#000000', '#ffffff')` ≈ 21.0 (1-digit tolerance).
    - For EVERY key in `Object.entries(EYE_COLORS)`, assert `computeContrastRatio(hex, PANEL_BACKGROUND) >= 3.0`; the test message embeds the offending key + hex + computed ratio.
    - The test fails LOUDLY if any base color falls below WCAG AA graphical threshold (D-02).
  </behavior>
  <action>
    Create `tests/outcomesPalette.contrast.test.ts` with this exact content:

    ```typescript
    /**
     * VQA-02 / D-02: WCAG AA contrast gate for outcomes chart palette.
     *
     * Scope: light mode only (panel background #ffffff).
     * Dark mode deferred per .planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md §Deferred.
     * Threshold: ≥ 3.0 (WCAG 2.1 SC 1.4.11 graphical elements).
     */
    import { describe, expect, it } from 'vitest';

    import {
      EYE_COLORS,
      PANEL_BACKGROUND,
      computeContrastRatio,
      relativeLuminance,
    } from '../src/components/outcomes/palette';

    describe('palette — WCAG sanity references', () => {
      it('relativeLuminance(#ffffff) ≈ 1.0', () => {
        expect(relativeLuminance('#ffffff')).toBeCloseTo(1.0, 3);
      });
      it('relativeLuminance(#000000) ≈ 0.0', () => {
        expect(relativeLuminance('#000000')).toBeCloseTo(0.0, 3);
      });
      it('computeContrastRatio(#000000, #ffffff) ≈ 21.0', () => {
        expect(computeContrastRatio('#000000', '#ffffff')).toBeCloseTo(21.0, 1);
      });
    });

    describe('EYE_COLORS WCAG AA contrast against panel background', () => {
      const WCAG_AA_GRAPHICAL = 3.0;

      for (const [key, hex] of Object.entries(EYE_COLORS)) {
        it(`EYE_COLORS['${key}']=${hex} contrast vs ${PANEL_BACKGROUND} is ≥ ${WCAG_AA_GRAPHICAL}`, () => {
          const ratio = computeContrastRatio(hex, PANEL_BACKGROUND);
          expect(
            ratio,
            `EYE_COLORS['${key}']=${hex} → ratio ${ratio.toFixed(2)} < ${WCAG_AA_GRAPHICAL}`,
          ).toBeGreaterThanOrEqual(WCAG_AA_GRAPHICAL);
        });
      }
    });
    ```
  </action>
  <verify>
    <automated>npx vitest run tests/outcomesPalette.contrast.test.ts 2>&amp;1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/outcomesPalette.contrast.test.ts` exits 0
    - `grep -E "describe\('EYE_COLORS WCAG AA contrast" tests/outcomesPalette.contrast.test.ts` matches
    - `grep -E "WCAG_AA_GRAPHICAL = 3\.0" tests/outcomesPalette.contrast.test.ts` matches
    - `grep -E "toBeGreaterThanOrEqual\(WCAG_AA_GRAPHICAL\)" tests/outcomesPalette.contrast.test.ts` matches
    - `npx vitest run tests/outcomesPalette.contrast.test.ts` exits 0 (all EYE_COLORS entries pass contrast; 3 sanity refs pass)
  </acceptance_criteria>
  <done>Contrast test runs green for all three EYE_COLORS entries (OD, OS, OD+OS) vs #ffffff.</done>
</task>

<task type="auto">
  <name>Task 4: Record dark-mode deferral footnote in REQUIREMENTS.md §VQA-02</name>
  <files>.planning/REQUIREMENTS.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (lines 10-18 — §Visual / UX QA block, VQA-02 line at line 15)
    - .planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md §Deferred §Scope Boundary Note (lines 119, 124-126)
  </read_first>
  <behavior>
    - `.planning/REQUIREMENTS.md` §Visual / UX QA has a footnote/note under VQA-02 clarifying the light-mode-only scope and pointing at the phase CONTEXT for rationale.
    - The footnote content explicitly states "Phase 10 scope: light mode only" and references 10-CONTEXT.md §Deferred.
    - The original VQA-02 bullet text is NOT rewritten — a single note line is appended immediately after the bullet.
  </behavior>
  <action>
    Open `.planning/REQUIREMENTS.md`. Locate the VQA-02 bullet (currently line 15):
    ```
    - [ ] **VQA-02**: Outcomes chart palette meets WCAG AA contrast for median / per-patient / scatter series against panel background in both light and dark mode — codified by a visual-regression or contrast-unit test.
    ```

    Immediately after this bullet (as a new line preserving the 2-space indent pattern used elsewhere in the file), insert:
    ```
        - *Phase 10 scope note (2026-04-16):* Verified in **light mode only** (panel background `#ffffff`). Dark-mode contrast deferred — codebase has no dark-mode infrastructure (no Tailwind theme config, no `prefers-color-scheme`, no theme provider). Rationale and deferral captured in `.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md` §Deferred. VQA-02 remains partially open pending dark-mode work in a future milestone.
    ```

    Do NOT modify any other requirement text or change the checkbox state. Preserve file trailing newline.
  </action>
  <verify>
    <automated>grep -E "Phase 10 scope note \(2026-04-16\)" .planning/REQUIREMENTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -F "Phase 10 scope note (2026-04-16)" .planning/REQUIREMENTS.md` matches exactly once
    - `grep -F "Verified in **light mode only**" .planning/REQUIREMENTS.md` matches exactly once
    - `grep -F "10-CONTEXT.md" .planning/REQUIREMENTS.md` matches at least once (reference to phase context)
    - The VQA-02 bullet line itself is unchanged: `grep -F "**VQA-02**: Outcomes chart palette meets WCAG AA contrast" .planning/REQUIREMENTS.md` matches
  </acceptance_criteria>
  <done>REQUIREMENTS.md carries the dark-mode deferral footnote under VQA-02.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none) | Pure visual refactor. `palette.ts` holds public-constant color values. No network, no persistence, no auth, no new user input, no PII, no fixtures. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-01-01 | Spoofing | palette.ts | N/A | No identity surface. |
| T-10-01-02 | Tampering | OutcomesPanel.tsx refactor | accept | OutcomesPage.test.tsx regression gate detects rendering regressions; 313/313 green gate preserved. |
| T-10-01-03 | Repudiation | — | N/A | No audit-generating surface touched. |
| T-10-01-04 | Information Disclosure | palette.ts color constants | accept | Hex values are non-secret UI constants; no PII. |
| T-10-01-05 | Denial of Service | — | N/A | Static constants, no IO, no resource consumption. |
| T-10-01-06 | Elevation of Privilege | — | N/A | No auth surface. |

Severity summary: **none**. Security enforcement satisfied with justification; no high-severity threats introduced.
</threat_model>

<verification>
Maps to ROADMAP Phase 10 Success Criterion #2 (WCAG AA contrast codified by unit test).

- `npx vitest run tests/outcomesPalette.contrast.test.ts` exits 0 — every EYE_COLORS entry ≥ 3:1 against #ffffff
- `npx vitest run tests/OutcomesPage.test.tsx` exits 0 — no regression from panel refactor
- `npm run typecheck` exits 0 — palette import/type contract compiles
- `! grep -En "fillOpacity=\{0\.5\}" src/components/outcomes/OutcomesPanel.tsx` — D-01 scatter bump enforced
- `grep -E "EYE_COLORS\.(OD|OS)|EYE_COLORS\[['\"]OD\+OS['\"]\]" src/pages/OutcomesPage.tsx` — all three panels sourced from palette
- `grep -F "Phase 10 scope note" .planning/REQUIREMENTS.md` matches — dark-mode deferral recorded
</verification>

<success_criteria>
- All 4 tasks' acceptance criteria pass.
- VQA-02 closed via light-mode contrast test; dark-mode deferral recorded in REQUIREMENTS.md.
- Phase regression gate: 313/313 existing tests preserved (plus the 6 new contrast assertions = 3 sanity + 3 EYE_COLORS entries).
- Palette module ready for Phase 13 CRT / Interval / Responder reuse (forward compat).
</success_criteria>

<output>
After completion, create `.planning/phases/10-visual-ux-qa-preview-stability/10-01-SUMMARY.md` with:
- Exact hex values chosen for OD / OS / OD+OS + their computed contrast ratios
- Whether scatter fillOpacity 0.5→0.7 bump altered any snapshot in OutcomesPage.test.tsx
- Whether CHART_COLORS import was dropped from OutcomesPage.tsx (yes/no + why)
- Forward-compat note: palette.ts ready for Phase 13 metric panels
</output>
</content>
</invoke>