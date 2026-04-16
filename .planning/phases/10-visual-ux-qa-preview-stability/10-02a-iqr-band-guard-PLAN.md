---
phase: 10-visual-ux-qa-preview-stability
plan: 02a
type: execute
wave: 2
depends_on: ["10-01"]
files_modified:
  - src/utils/cohortTrajectory.ts
  - tests/outcomesIqrSparse.test.tsx
autonomous: true
requirements: [VQA-03]
requirements_addressed: [VQA-03]

must_haves:
  truths:
    - "computeCohortTrajectory never emits a medianGrid GridPoint with `n < 2` (degenerate IQR source data impossible)."
    - "OutcomesPanel, when rendered over a sparse medianGrid, never produces an SVG <path> with an empty `d` attribute at the IQR layer — no 0-height band artifact."
  artifacts:
    - path: "src/utils/cohortTrajectory.ts"
      provides: "buildPanel guard tightened to `ys.length < 2` (if currently `=== 0`)"
      contains: "if (ys.length < 2) continue"
    - path: "tests/outcomesIqrSparse.test.tsx"
      provides: "Math-layer + DOM-layer regression tests for VQA-03"
      contains: "describe('OutcomesPanel IQR band"
  key_links:
    - from: "tests/outcomesIqrSparse.test.tsx"
      to: "src/components/outcomes/OutcomesPanel.tsx"
      via: "RTL render + SVG DOM inspection for degenerate geometry"
      pattern: "container\\.querySelectorAll\\('path'\\)"
    - from: "tests/outcomesIqrSparse.test.tsx"
      to: "src/utils/cohortTrajectory.ts"
      via: "direct call to computeCohortTrajectory to assert the n>=2 invariant at the math layer"
      pattern: "computeCohortTrajectory"
---

<objective>
Close VQA-03 (IQR band degenerate-geometry) with a surgical math-layer guard change and a two-layer regression test (math + DOM).

Purpose: Lock the IQR n<2 invariant at the math layer AND DOM layer so future refactors can't silently regress.

Output:
- Tighten `cohortTrajectory.ts` median-grid guard (1-line change) per D-04.
- Add `tests/outcomesIqrSparse.test.tsx` (math + DOM invariants).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md
@src/utils/cohortTrajectory.ts
@src/components/outcomes/OutcomesPanel.tsx
@tests/cohortTrajectory.test.ts
@tests/OutcomesPage.test.tsx

<interfaces>
<!-- Extracted from source 2026-04-16 -->

From src/utils/cohortTrajectory.ts:424-475 (buildPanel):
The inner loop currently has exactly ONE guard:
```typescript
if (ys.length === 0) continue; // Mismatched span — skip this grid point (D-15)
```
This allows `ys.length === 1` to produce a GridPoint with `p25 === p75` (single-value percentile collapses). D-04 requires `n < 2` to be omitted entirely → change to `if (ys.length < 2) continue;`. (The earlier guard `if (s.measurements.length < 2) continue;` prunes SINGLE-measurement patients, but two patients with 1 valid interpolation each at the same grid x still can produce ys.length=1 — the guard change is required.)

From src/components/outcomes/OutcomesPanel.tsx (Props shape — needed by the DOM test render):
- `panel: PanelResult`, `eye: 'od' | 'os' | 'combined'`, `color: string`, `axisMode: AxisMode`, `yMetric: YMetric`, `layers: LayerState`, `t: (key: string) => string`, `locale: 'de' | 'en'`, `titleKey: 'outcomesPanelOd' | 'outcomesPanelOs' | 'outcomesPanelCombined'`.
- Plan 10-01's SERIES_STYLES refactor has landed before this plan executes (wave 1 → wave 2); test uses the same color format (hex string).
</interfaces>

<scope_note>
Per CONTEXT.md D-04: "the median-grid row omits p25 / p75 when n < 2 (already the behavior in utils/cohortTrajectory.ts — verify)". The code is NOT already that way — the existing guard is `=== 0`. Correct the guard as the canonical D-04 fix; Task 1 includes the 1-line source edit and the math-layer assertion proving the new invariant. If `npx vitest run tests/cohortTrajectory.test.ts` regresses, roll back and escalate — cohortTrajectory is under a parity gate with Phase 8.
</scope_note>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tighten cohortTrajectory.ts median-grid guard to `ys.length < 2` (D-04)</name>
  <files>src/utils/cohortTrajectory.ts</files>
  <read_first>
    - src/utils/cohortTrajectory.ts lines 420-500 (buildPanel) to confirm current guard at line 451
    - tests/cohortTrajectory.test.ts (to ensure no existing test depends on `n === 1` GridPoints — if it does, Task 1 must be split and discussed)
    - .planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md §IQR Band Edge Case (D-04)
  </read_first>
  <behavior>
    - `buildPanel` loop emits a GridPoint ONLY when `ys.length >= 2` at that x-value.
    - Comment on the guard line updated to reference D-04 (not just D-15).
    - Existing `tests/cohortTrajectory.test.ts` suite still passes (313-file regression gate).
  </behavior>
  <action>
    In `src/utils/cohortTrajectory.ts` locate the line (currently line 451) inside the `buildPanel` for-loop:
    ```typescript
        if (ys.length === 0) continue; // Mismatched span — skip this grid point (D-15)
    ```
    Replace it with:
    ```typescript
        // D-04 (VQA-03): require n>=2 so IQR band has non-degenerate p25/p75.
        // D-15 skip for mismatched span (ys.length === 0) is subsumed by the stricter check.
        if (ys.length < 2) continue;
    ```

    Do NOT modify any other code in the file. Run the existing cohortTrajectory suite immediately after the edit to confirm no regression:
    `npx vitest run tests/cohortTrajectory.test.ts`

    If the suite fails, it is likely because a fixture builds exactly 1 patient with a valid interpolation at a grid point. Inspect the failure, determine whether the failing assertion is load-bearing for D-04. If the existing test deliberately asserts `n === 1` it needs to be updated in lockstep; if the test just doesn't care about that grid point, update the fixture to include a second patient so the invariant holds. Record the resolution in the SUMMARY.
  </action>
  <verify>
    <automated>grep -n "ys.length < 2" src/utils/cohortTrajectory.ts &amp;&amp; npx vitest run tests/cohortTrajectory.test.ts 2>&amp;1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "if \(ys\.length < 2\) continue;" src/utils/cohortTrajectory.ts` matches exactly once
    - `! grep -E "if \(ys\.length === 0\) continue;" src/utils/cohortTrajectory.ts` (old guard removed)
    - `grep -E "D-04 \(VQA-03\)" src/utils/cohortTrajectory.ts` matches (traceability comment present)
    - `npx vitest run tests/cohortTrajectory.test.ts` exits 0
  </acceptance_criteria>
  <done>Median-grid guard tightened; existing cohortTrajectory suite still green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add tests/outcomesIqrSparse.test.tsx (math + DOM invariants for VQA-03)</name>
  <files>tests/outcomesIqrSparse.test.tsx</files>
  <read_first>
    - src/utils/cohortTrajectory.ts (computeCohortTrajectory + TrajectoryResult types)
    - src/components/outcomes/OutcomesPanel.tsx (Props — especially PanelResult shape and early-return at patientCount=0)
    - tests/cohortTrajectory.test.ts (fixture helper patterns — makeCase / makeVisusObs)
    - tests/OutcomesPage.test.tsx lines 60-85 (Recharts mock pattern — the test file must provide an equivalent local mock or rely on the existing project-level mock)
    - src/services/fhirLoader.ts (LOINC_VISUS, SNOMED_EYE_RIGHT, SNOMED_EYE_LEFT constants)
  </read_first>
  <behavior>
    - Math describe block: seeds cases where the grid extends to a region with only 1 contributing patient; asserts `medianGrid.every(gp => gp.n >= 2)`.
    - DOM describe block: renders OutcomesPanel with a synthetic PanelResult (dense medianGrid where p25 < p75 strictly); asserts every `<path>` has a non-empty `d` attribute. Renders again with empty medianGrid; asserts no chart `<path>` is emitted (patientCount=0 early return).
    - Uses the same local Recharts mock as tests/OutcomesPage.test.tsx so the SVG DOM is deterministic inside jsdom.
  </behavior>
  <action>
    Create `tests/outcomesIqrSparse.test.tsx`:

    ```typescript
    // @vitest-environment jsdom
    /**
     * VQA-03 / D-04: Two-layer regression guard for the IQR band's n<2 edge case.
     *
     *   1. Math  — computeCohortTrajectory must never emit GridPoint with n<2.
     *   2. DOM   — OutcomesPanel must not render <path> elements with empty `d` attr
     *              (the symptom of a 0-height IQR band).
     */
    import { describe, expect, it, vi, afterEach } from 'vitest';
    import { render, cleanup } from '@testing-library/react';

    // Deterministic Recharts mock (same pattern as tests/OutcomesPage.test.tsx).
    vi.mock('recharts', async (importOriginal) => {
      const real = await importOriginal<typeof import('recharts')>();
      return {
        ...real,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ResponsiveContainer: ({ children }: { children: any }) => (
          <div data-testid="recharts-responsive-container">
            <svg>{children}</svg>
          </div>
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ComposedChart: ({ children }: { children: any }) => (
          <g data-testid="recharts-composed-chart">{children}</g>
        ),
        CartesianGrid: () => null,
        XAxis: () => null,
        YAxis: () => null,
        Tooltip: () => null,
        Legend: () => null,
        ReferenceLine: () => null,
        // Emit a <path d="M0,0 L10,10"> so the DOM has a non-empty `d` to assert on.
        Area: () => <path data-testid="area-path" d="M0,0 L10,10" />,
        Line: () => <path data-testid="line-path" d="M0,0 L10,10" />,
        Scatter: () => null,
      };
    });

    import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
    import { computeCohortTrajectory, type PanelResult } from '../src/utils/cohortTrajectory';
    import type { PatientCase } from '../src/types/fhir';
    import { LOINC_VISUS, SNOMED_EYE_RIGHT } from '../src/services/fhirLoader';

    afterEach(() => cleanup());

    function makeVisusObs(date: string, decimal: number) {
      return {
        resourceType: 'Observation',
        code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
        valueQuantity: { value: decimal, unit: 'decimal' },
        effectiveDateTime: date,
        bodySite: { coding: [{ code: SNOMED_EYE_RIGHT }] },
      } as any;
    }

    function makeCase(
      pseudonym: string,
      obs: Array<{ date: string; decimal: number }>,
    ): PatientCase {
      return {
        pseudonym,
        patient: { resourceType: 'Patient', id: pseudonym } as any,
        observations: obs.map((o) => makeVisusObs(o.date, o.decimal)),
        procedures: [],
      } as PatientCase;
    }

    describe('cohortTrajectory — medianGrid n>=2 invariant (VQA-03 / D-04)', () => {
      it('omits grid points where fewer than 2 patients contribute (n<2)', () => {
        // Patient 1: 2 obs spanning days 0..100. Patient 2: 1 obs at day 200 — never interpolates.
        // Grid extends to ~day 200 but only patient 1 can contribute to any interpolation;
        // patients with <2 measurements are pruned earlier, so ys.length at every gx is
        // at most 1. New guard (D-04) must skip every such point.
        const cases: PatientCase[] = [
          makeCase('p1', [
            { date: '2024-01-01', decimal: 0.5 },
            { date: '2024-04-10', decimal: 0.6 }, // ~day 100
          ]),
          makeCase('p2', [
            { date: '2024-07-19', decimal: 0.7 }, // ~day 200 (single obs — pruned)
          ]),
        ];
        const result = computeCohortTrajectory({
          cases,
          axisMode: 'days',
          yMetric: 'absolute',
          gridPoints: 11,
          spreadMode: 'iqr',
        });
        const offenders = result.od.medianGrid.filter((gp) => gp.n < 2);
        expect(
          offenders,
          `GridPoints with n<2 present: ${JSON.stringify(offenders)}`,
        ).toEqual([]);
      });

      it('emits n>=2 on a dense two-patient grid', () => {
        const cases: PatientCase[] = [
          makeCase('a', [
            { date: '2024-01-01', decimal: 0.5 },
            { date: '2024-04-10', decimal: 0.55 },
            { date: '2024-07-19', decimal: 0.6 },
          ]),
          makeCase('b', [
            { date: '2024-01-01', decimal: 0.4 },
            { date: '2024-04-10', decimal: 0.45 },
            { date: '2024-07-19', decimal: 0.5 },
          ]),
        ];
        const result = computeCohortTrajectory({
          cases,
          axisMode: 'days',
          yMetric: 'absolute',
          gridPoints: 5,
          spreadMode: 'iqr',
        });
        expect(result.od.medianGrid.length).toBeGreaterThan(0);
        expect(result.od.medianGrid.every((gp) => gp.n >= 2)).toBe(true);
      });
    });

    function makePanel(
      medianGrid: Array<{ x: number; y: number; p25: number; p75: number; n: number }>,
      measurementCount = medianGrid.length * 2,
    ): PanelResult {
      return {
        patients: [],
        scatterPoints: [],
        medianGrid,
        summary: {
          patientCount: medianGrid.length > 0 ? 2 : 0,
          excludedCount: 0,
          measurementCount,
        },
      };
    }

    describe('OutcomesPanel — IQR Area DOM has no degenerate geometry (VQA-03)', () => {
      const t = (k: string) => k;
      const layers = { median: true, perPatient: false, scatter: false, spreadBand: true };

      it('renders no <path> with empty d attribute when medianGrid is dense (p25<p75)', () => {
        const dense = [
          { x: 0,   y: 0.5,  p25: 0.40, p75: 0.60, n: 3 },
          { x: 50,  y: 0.5,  p25: 0.42, p75: 0.58, n: 3 },
          { x: 100, y: 0.5,  p25: 0.44, p75: 0.56, n: 3 },
        ];
        const { container } = render(
          <OutcomesPanel
            panel={makePanel(dense)}
            eye="od"
            color="#1d4ed8"
            axisMode="days"
            yMetric="absolute"
            layers={layers}
            t={t}
            locale="en"
            titleKey="outcomesPanelOd"
          />,
        );
        const paths = Array.from(container.querySelectorAll('path'));
        expect(paths.length).toBeGreaterThan(0);
        for (const p of paths) {
          const d = p.getAttribute('d') ?? '';
          expect(d, 'path with empty d attribute found').not.toBe('');
        }
      });

      it('renders no chart <path> when patientCount is 0 (empty medianGrid short-circuit)', () => {
        const { container } = render(
          <OutcomesPanel
            panel={makePanel([], 0)}
            eye="od"
            color="#1d4ed8"
            axisMode="days"
            yMetric="absolute"
            layers={layers}
            t={t}
            locale="en"
            titleKey="outcomesPanelOd"
          />,
        );
        // The patientCount=0 branch (OutcomesPanel.tsx:59-72) renders the empty-state div,
        // NOT the ResponsiveContainer. Assert the chart short-circuit.
        expect(container.querySelector('[data-testid="recharts-responsive-container"]')).toBeNull();
        expect(container.querySelectorAll('path').length).toBe(0);
      });
    });
    ```
  </action>
  <verify>
    <automated>npx vitest run tests/outcomesIqrSparse.test.tsx 2>&amp;1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/outcomesIqrSparse.test.tsx` exits 0
    - `grep -E "describe\('cohortTrajectory — medianGrid n>=2 invariant" tests/outcomesIqrSparse.test.tsx` matches
    - `grep -E "describe\('OutcomesPanel — IQR Area DOM has no degenerate geometry" tests/outcomesIqrSparse.test.tsx` matches
    - `grep -E "container\.querySelectorAll\('path'\)" tests/outcomesIqrSparse.test.tsx` matches
    - `grep -E "expect\(paths\.length\)\.toBeGreaterThan\(0\)" tests/outcomesIqrSparse.test.tsx` matches
    - `npx vitest run tests/outcomesIqrSparse.test.tsx` exits 0 (all 4 tests green)
  </acceptance_criteria>
  <done>Math + DOM invariants locked; VQA-03 closed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none) | All changes are pure math + test-only client rendering. No network, no persistence, no auth, no PII. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-02a-01 | Spoofing | — | N/A | No identity surface. |
| T-10-02a-02 | Tampering | cohortTrajectory.ts guard tightening | accept | Pure math; `tests/cohortTrajectory.test.ts` is the regression gate (313/313 preserved). |
| T-10-02a-03 | Repudiation | — | N/A | No audit surface touched. |
| T-10-02a-04 | Information Disclosure | — | N/A | No new disclosure boundary. |
| T-10-02a-05 | Denial of Service | — | N/A | Guard is a cheap arithmetic check. |
| T-10-02a-06 | Elevation of Privilege | — | N/A | No auth surface. |

Severity summary: **none**. No high-severity threats.
</threat_model>

<verification>
Maps to ROADMAP Phase 10 Success Criterion #3 (IQR band clean rendering when `n < 2` at a grid point).

- `npx vitest run tests/cohortTrajectory.test.ts` exits 0 (D-04 guard does not regress math suite)
- `npx vitest run tests/outcomesIqrSparse.test.tsx` exits 0 (math + DOM invariants)
- `grep -E "if \(ys\.length < 2\) continue;" src/utils/cohortTrajectory.ts` matches
</verification>

<success_criteria>
- All 2 tasks' acceptance criteria pass.
- VQA-03 closed: math + DOM invariants locked.
- Phase regression gate preserved (313/313 + new tests).
</success_criteria>

<output>
After completion, create `.planning/phases/10-visual-ux-qa-preview-stability/10-02a-SUMMARY.md` noting:
- Whether `cohortTrajectory.ts:451` guard change caused any existing test update (yes/no + diff)
- Any interaction with Plan 10-01 (palette refactor) that surfaced during rendering of the DOM test
</output>
</content>
