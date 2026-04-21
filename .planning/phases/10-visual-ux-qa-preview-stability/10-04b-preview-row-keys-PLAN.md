---
phase: 10-visual-ux-qa-preview-stability
plan: 04b
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/outcomes/OutcomesDataPreview.tsx
  - tests/outcomesDataPreviewKeys.test.tsx
autonomous: true
requirements: [CRREV-02]
requirements_addressed: [CRREV-02]

must_haves:
  truths:
    - "`OutcomesDataPreview.tsx` uses a pipe-delimited composite key `${r.patient_pseudonym}|${r.eye}|${r.observation_date}` per D-10 — the array-index suffix is gone."
    - "For D-11 rare same-day duplicate tuples, a stable per-dataset `#n` suffix is appended to the 2nd/3rd/... occurrences only (first keeps the clean D-10 shape)."
    - "A `tests/outcomesDataPreviewKeys.test.tsx` suite asserts key uniqueness across row reorderings, pipe-delimiter shape, D-11 duplicate handling, and absence of the React 'unique key prop' console warning."
  artifacts:
    - path: "src/components/outcomes/OutcomesDataPreview.tsx"
      provides: "Stable pipe-delimited composite key + D-11 duplicate resolver"
      contains: "patient_pseudonym}|${r.eye}|${r.observation_date"
    - path: "tests/outcomesDataPreviewKeys.test.tsx"
      provides: "React key uniqueness + order-independence + D-11 duplicate test"
      contains: "describe('OutcomesDataPreview row keys"
  key_links:
    - from: "tests/outcomesDataPreviewKeys.test.tsx"
      to: "src/components/outcomes/OutcomesDataPreview.tsx"
      via: "RTL render + data-row-key attribute inspection"
      pattern: "data-row-key"
---

<objective>
Close CRREV-02 (stable `OutcomesDataPreview` row keys with D-11 duplicate handling).

CRREV-02 work:
- Replace `OutcomesDataPreview.tsx:237`'s array-index key with `` `${r.patient_pseudonym}|${r.eye}|${r.observation_date}${r.dup_suffix ?? ''}` `` (D-10).
- In `flattenToRows`, assign `dup_suffix = '#n'` to the 2nd+ occurrence of each `(pseudonym|eye|date)` tuple (D-11 — Row has no measurement_id, so we use the deterministic counter).
- Expose `data-row-key` on each `<tr>` for tests to inspect.
- Create `tests/outcomesDataPreviewKeys.test.tsx` — asserts uniqueness across row reorderings, pipe-delimiter shape, D-11 duplicate resolution, and absence of React key-duplication console warning.

Output: OutcomesDataPreview edit, one new test file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md
@src/components/outcomes/OutcomesDataPreview.tsx
@tests/OutcomesPage.test.tsx

<interfaces>
<!-- OutcomesDataPreview Row shape — extracted from src/components/outcomes/OutcomesDataPreview.tsx:35-44 -->

```typescript
interface Row {
  patient_pseudonym: string;
  eye: 'od' | 'os';
  observation_date: string;          // ISO YYYY-MM-DD
  days_since_baseline: number;
  treatment_index: number;
  visus_logmar: number;
  visus_snellen_numerator: number;
  visus_snellen_denominator: number;
}
```

D-11 planner decision (resolved):
- Row has NO `measurement_id` field — the "tuple + measurement_id if available" option from D-11 does NOT apply.
- Use the second option: "a stable incrementing counter within the dataset". Implementation: after `flattenToRows` builds `rows[]`, walk the array; for each row whose `(pseudonym|eye|date)` tuple has been seen before, set `row.dup_suffix = '#${n}'` (where n = 2, 3, ...).
- First occurrence keeps the CLEAN D-10 key (no suffix).
- Add an optional `dup_suffix?: string` to the Row interface.

Current render loop (lines 235-251):
```tsx
{rows.map((r, i) => (
  <tr
    key={`${r.patient_pseudonym}-${r.eye}-${r.observation_date}-${i}`}
    className="text-sm hover:bg-gray-50"
  >
  ...
  </tr>
))}
```

New shape: drop the `i` index param, compute `rowKey` once per row, expose as `data-row-key`.
</interfaces>

<scope_note>
The OutcomesDataPreview test must NOT check `aggregate.summary` values it doesn't need (keep the test minimal and focused on row keys). Use a minimal stub TrajectoryResult whose `summary.measurementCount` fields are any non-negative numbers.
</scope_note>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace OutcomesDataPreview row key with pipe-delimited composite + D-11 dup_suffix</name>
  <files>src/components/outcomes/OutcomesDataPreview.tsx</files>
  <read_first>
    - src/components/outcomes/OutcomesDataPreview.tsx (entire file — key literal at line 237, Row interface at lines 35-44, flattenToRows at lines 57-140)
    - .planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md §OutcomesDataPreview Row Key (D-10, D-11)
  </read_first>
  <behavior>
    - `Row` interface adds optional `dup_suffix?: string;` field.
    - At the end of `flattenToRows` (before `return rows;`), a deterministic pass walks `rows` in array order, tracks `(pseudonym|eye|date)` occurrences in a `Map<string, number>`, and sets `row.dup_suffix = '#${n}'` on 2nd+ occurrences only.
    - Render loop drops the `i` param; computes `rowKey = ` `${r.patient_pseudonym}|${r.eye}|${r.observation_date}${r.dup_suffix ?? ''}` once per row.
    - `<tr>` gains `data-row-key={rowKey}` so tests can inspect keys without reading React internals.
    - No other behavior changes (CSV export, parity invariant, rendering).
  </behavior>
  <action>
    Edit `src/components/outcomes/OutcomesDataPreview.tsx`:

    Step 1: Update the `Row` interface (lines 35-44) — add one optional field at the end:
    ```typescript
    interface Row {
      patient_pseudonym: string;
      eye: 'od' | 'os';
      observation_date: string;
      days_since_baseline: number;
      treatment_index: number;
      visus_logmar: number;
      visus_snellen_numerator: number;
      visus_snellen_denominator: number;
      dup_suffix?: string; // D-11: set only when (pseudonym|eye|date) duplicates within this dataset.
    }
    ```

    Step 2: In `flattenToRows`, immediately before the final `return rows;` (current line 139), insert the D-11 deterministic resolver:
    ```typescript
      // D-11 (CRREV-02): deterministic suffix for duplicate (pseudonym|eye|date) tuples.
      // First occurrence stays unsuffixed (preserves the clean D-10 key shape);
      // subsequent occurrences get `#2`, `#3`, ... in encounter order.
      const seen = new Map<string, number>();
      for (const r of rows) {
        const key = `${r.patient_pseudonym}|${r.eye}|${r.observation_date}`;
        const n = (seen.get(key) ?? 0) + 1;
        seen.set(key, n);
        if (n > 1) r.dup_suffix = `#${n}`;
      }
    ```

    Step 3: Replace the render loop (lines 235-251):
    ```tsx
                {rows.map((r, i) => (
                  <tr
                    key={`${r.patient_pseudonym}-${r.eye}-${r.observation_date}-${i}`}
                    className="text-sm hover:bg-gray-50"
                  >
                    <td className="px-3 py-2">{r.patient_pseudonym}</td>
                    <td className="px-3 py-2">
                      {t(r.eye === 'od' ? 'outcomesPreviewEyeOd' : 'outcomesPreviewEyeOs')}
                    </td>
                    <td className="px-3 py-2">{r.observation_date}</td>
                    <td className="px-3 py-2">{r.days_since_baseline}</td>
                    <td className="px-3 py-2">{r.treatment_index}</td>
                    <td className="px-3 py-2">{fmt(r.visus_logmar)}</td>
                    <td className="px-3 py-2">{r.visus_snellen_numerator}</td>
                    <td className="px-3 py-2">{r.visus_snellen_denominator}</td>
                  </tr>
                ))}
    ```
    With:
    ```tsx
                {rows.map((r) => {
                  const rowKey = `${r.patient_pseudonym}|${r.eye}|${r.observation_date}${r.dup_suffix ?? ''}`;
                  return (
                    <tr
                      key={rowKey}
                      data-row-key={rowKey}
                      className="text-sm hover:bg-gray-50"
                    >
                      <td className="px-3 py-2">{r.patient_pseudonym}</td>
                      <td className="px-3 py-2">
                        {t(r.eye === 'od' ? 'outcomesPreviewEyeOd' : 'outcomesPreviewEyeOs')}
                      </td>
                      <td className="px-3 py-2">{r.observation_date}</td>
                      <td className="px-3 py-2">{r.days_since_baseline}</td>
                      <td className="px-3 py-2">{r.treatment_index}</td>
                      <td className="px-3 py-2">{fmt(r.visus_logmar)}</td>
                      <td className="px-3 py-2">{r.visus_snellen_numerator}</td>
                      <td className="px-3 py-2">{r.visus_snellen_denominator}</td>
                    </tr>
                  );
                })}
    ```

    Do NOT touch CSV export, parity invariant div, headers, or `<details>` chrome.
  </action>
  <verify>
    <automated>npm run typecheck 2>&amp;1 | tail -5 &amp;&amp; grep -E "patient_pseudonym\}\|\\$\\{r\\.eye\\}\|\\$\\{r\\.observation_date\\}" src/components/outcomes/OutcomesDataPreview.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "dup_suffix\?: string;" src/components/outcomes/OutcomesDataPreview.tsx` matches exactly once
    - `grep -E "const seen = new Map<string, number>\(\);" src/components/outcomes/OutcomesDataPreview.tsx` matches
    - `grep -E "r\.dup_suffix = .#\\$\\{n\\}." src/components/outcomes/OutcomesDataPreview.tsx` matches (template literal assigning `#${n}`)
    - `grep -E "data-row-key=\{rowKey\}" src/components/outcomes/OutcomesDataPreview.tsx` matches
    - `grep -E "const rowKey = .\\$\\{r\\.patient_pseudonym\\}\|\\$\\{r\\.eye\\}\|\\$\\{r\\.observation_date\\}\\$\\{r\\.dup_suffix \?\? ''\\}." src/components/outcomes/OutcomesDataPreview.tsx` matches (OR equivalent — the composite template literal present)
    - `! grep -E "\\$\\{r\\.patient_pseudonym\\}-\\$\\{r\\.eye\\}-\\$\\{r\\.observation_date\\}-\\$\\{i\\}" src/components/outcomes/OutcomesDataPreview.tsx` (old unstable key gone)
    - `! grep -E "rows\.map\(\(r, i\) =>" src/components/outcomes/OutcomesDataPreview.tsx` (no index-bearing render map remains)
    - `npm run typecheck` exits 0
    - `npx vitest run tests/OutcomesPage.test.tsx` exits 0 (existing page tests still pass)
  </acceptance_criteria>
  <done>OutcomesDataPreview uses pipe-delimited composite key + D-11 resolver; TypeScript compiles; existing tests unaffected.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add tests/outcomesDataPreviewKeys.test.tsx (CRREV-02 uniqueness + D-11)</name>
  <files>tests/outcomesDataPreviewKeys.test.tsx</files>
  <read_first>
    - src/components/outcomes/OutcomesDataPreview.tsx (after Task 1 lands — confirm `data-row-key` attribute present)
    - src/types/fhir.ts (PatientCase shape — what `cases` prop consumes)
    - src/services/fhirLoader.ts (LOINC_VISUS, SNOMED_EYE_RIGHT, SNOMED_EYE_LEFT constants for fixtures)
    - src/utils/cohortTrajectory.ts (TrajectoryResult shape for stub — need `.od.summary.measurementCount`, etc.)
  </read_first>
  <behavior>
    - Test 1 — uniqueness within a single render: seed 2 patients × 2 obs each = 4 rows; assert `new Set(rowKeys).size === rowKeys.length` and > 0.
    - Test 2 — order independence: render same data in reversed patient order; assert the SET of rowKeys is equal to Test 1's SET.
    - Test 3 — pipe delimiter shape: every rowKey matches `/^[^|]+\|(od|os)\|\d{4}-\d{2}-\d{2}(#\d+)?$/`.
    - Test 4 — D-11 duplicate tuple: seed a single patient with TWO same-day, same-eye obs (legitimate same-day remeasurement); assert 2 distinct rowKeys, one clean (`P003|od|2024-06-01`), one with suffix (`P003|od|2024-06-01#2`).
    - Test 5 — no React duplicate-key console warning: spy on `console.error`, render Test 1 data, assert no call matches `/unique "key" prop/i`.
  </behavior>
  <action>
    Create `tests/outcomesDataPreviewKeys.test.tsx`:

    ```typescript
    // @vitest-environment jsdom
    /**
     * CRREV-02 / D-10 / D-11: OutcomesDataPreview row keys are stable,
     * pipe-separated composites (no array index), and duplicate (pseudonym|eye|date)
     * tuples receive a deterministic `#n` suffix on second+ occurrences.
     */
    import { describe, expect, it, vi, afterEach } from 'vitest';
    import { cleanup, render } from '@testing-library/react';

    import OutcomesDataPreview from '../src/components/outcomes/OutcomesDataPreview';
    import type { PatientCase } from '../src/types/fhir';
    import {
      LOINC_VISUS,
      SNOMED_EYE_LEFT,
      SNOMED_EYE_RIGHT,
    } from '../src/services/fhirLoader';
    import type { TrajectoryResult } from '../src/utils/cohortTrajectory';

    afterEach(() => cleanup());

    const t = (k: string) => k;

    function makeObs(date: string, decimal: number, eyeCode: string) {
      return {
        resourceType: 'Observation',
        code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
        valueQuantity: { value: decimal, unit: 'decimal' },
        effectiveDateTime: date,
        bodySite: { coding: [{ code: eyeCode }] },
      } as any;
    }

    function makeCase(
      pseudonym: string,
      obsList: Array<[string, number, 'od' | 'os']>,
    ): PatientCase {
      return {
        pseudonym,
        patient: { resourceType: 'Patient', id: pseudonym } as any,
        observations: obsList.map(([date, dec, eye]) =>
          makeObs(date, dec, eye === 'od' ? SNOMED_EYE_RIGHT : SNOMED_EYE_LEFT),
        ),
        procedures: [],
      } as PatientCase;
    }

    // Minimal stub — OutcomesDataPreview only reads aggregate.od.summary.measurementCount
    // and aggregate.os.summary.measurementCount for the parity-invariant hidden div.
    const stubAggregate: TrajectoryResult = {
      od: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, excludedCount: 0, measurementCount: 0 } },
      os: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, excludedCount: 0, measurementCount: 0 } },
      combined: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, excludedCount: 0, measurementCount: 0 } },
    };

    function renderPreview(cases: PatientCase[]): HTMLElement {
      const { container } = render(
        <OutcomesDataPreview
          cases={cases}
          aggregate={stubAggregate}
          t={t as any}
          locale="en"
        />,
      );
      // The preview is inside a <details> — force it open so rows render.
      const details = container.querySelector('details');
      if (details) details.open = true;
      return container;
    }

    function collectRowKeys(container: HTMLElement): string[] {
      return Array.from(container.querySelectorAll('tr[data-row-key]')).map(
        (el) => el.getAttribute('data-row-key') ?? '',
      );
    }

    const casesA: PatientCase[] = [
      makeCase('P001', [
        ['2024-01-01', 0.5, 'od'],
        ['2024-04-01', 0.6, 'od'],
      ]),
      makeCase('P002', [
        ['2024-02-15', 0.4, 'os'],
        ['2024-05-15', 0.45, 'os'],
      ]),
    ];
    const casesB: PatientCase[] = [...casesA].reverse();

    describe('OutcomesDataPreview row keys — stability and uniqueness (CRREV-02)', () => {
      it('every row key is unique within a single render', () => {
        const container = renderPreview(casesA);
        const keys = collectRowKeys(container);
        expect(keys.length).toBeGreaterThan(0);
        expect(new Set(keys).size).toBe(keys.length);
      });

      it('reordering cases yields the same SET of row keys (order-independence)', () => {
        const c1 = renderPreview(casesA);
        const keysA = new Set(collectRowKeys(c1));
        cleanup();
        const c2 = renderPreview(casesB);
        const keysB = new Set(collectRowKeys(c2));
        expect(keysA).toEqual(keysB);
      });

      it('row keys use pipe separator (D-10 exact shape)', () => {
        const container = renderPreview(casesA);
        const keys = collectRowKeys(container);
        for (const k of keys) {
          expect(k).toMatch(/^[^|]+\|(od|os)\|\d{4}-\d{2}-\d{2}(#\d+)?$/);
        }
      });

      it('duplicate (pseudonym|eye|date) tuple emits distinct keys via #n suffix (D-11)', () => {
        const dupCase: PatientCase[] = [
          makeCase('P003', [
            ['2024-06-01', 0.5, 'od'],
            ['2024-06-01', 0.55, 'od'],
          ]),
        ];
        const container = renderPreview(dupCase);
        const keys = collectRowKeys(container);
        expect(keys.length).toBe(2);
        expect(new Set(keys).size).toBe(2);
        expect(keys).toContain('P003|od|2024-06-01');
        expect(keys).toContain('P003|od|2024-06-01#2');
      });

      it('emits no React "unique key prop" warning during render', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
          renderPreview(casesA);
          const offending = spy.mock.calls.find((call) =>
            String(call[0] ?? '').match(/unique "key" prop/i),
          );
          expect(
            offending,
            `React emitted a duplicate-key warning: ${JSON.stringify(offending)}`,
          ).toBeUndefined();
        } finally {
          spy.mockRestore();
        }
      });
    });
    ```
  </action>
  <verify>
    <automated>npx vitest run tests/outcomesDataPreviewKeys.test.tsx 2>&amp;1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/outcomesDataPreviewKeys.test.tsx` exits 0
    - `grep -E "describe\('OutcomesDataPreview row keys" tests/outcomesDataPreviewKeys.test.tsx` matches
    - `grep -E "expect\(keysA\)\.toEqual\(keysB\)" tests/outcomesDataPreviewKeys.test.tsx` matches
    - `grep -F "P003|od|2024-06-01#2" tests/outcomesDataPreviewKeys.test.tsx` matches
    - `grep -E "unique .key. prop" tests/outcomesDataPreviewKeys.test.tsx` matches
    - `npx vitest run tests/outcomesDataPreviewKeys.test.tsx` exits 0 (all 5 tests pass)
  </acceptance_criteria>
  <done>Row key tests pass; CRREV-02 closed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none) | OutcomesDataPreview key change is client-side; `data-row-key` attribute embeds pseudonym + eye + date which are ALREADY rendered in adjacent `<td>` elements (lines 240-244 of the pre-existing component). No new disclosure. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-04b-01 | Spoofing | — | N/A | No identity surface. |
| T-10-04b-02 | Tampering | flattenToRows duplicate resolver | accept | Client-side transform; tests cover determinism. |
| T-10-04b-03 | Repudiation | — | N/A | Audit surface not touched. |
| T-10-04b-04 | Information Disclosure | data-row-key attribute | accept | Exposes no field not already rendered elsewhere in the same preview (pseudonym, eye, date appear in adjacent `<td>`s). |
| T-10-04b-05 | Denial of Service | flattenToRows duplicate resolver | accept | O(n) additional pass, where n = preview row count (bounded by cohort size). Negligible. |
| T-10-04b-06 | Elevation of Privilege | — | N/A | No auth surface. |

Severity summary: **none**. No high-severity threats.
</threat_model>

<verification>
Maps to ROADMAP Phase 10 Success Criterion #6 (OutcomesDataPreview stable composite key).

- `npx vitest run tests/outcomesDataPreviewKeys.test.tsx` exits 0 (uniqueness + order-independence + D-11 + no React warning)
- `npx vitest run tests/OutcomesPage.test.tsx` exits 0 (OutcomesPage embeds preview — regression gate)
- `grep -F 'dup_suffix' src/components/outcomes/OutcomesDataPreview.tsx` matches
</verification>

<success_criteria>
- All 2 tasks' acceptance criteria pass.
- CRREV-02 closed: pipe-delimited composite key + D-11 duplicate resolver + React-warning guard.
- Phase regression gate preserved (313/313 + new tests).
</success_criteria>

<output>
After completion, create `.planning/phases/10-visual-ux-qa-preview-stability/10-04b-SUMMARY.md` with:
- D-11 resolution shipped: counter-suffix (because Row has no measurement_id)
- Confirmation that OutcomesPage.test.tsx regression gate stays green after the key change
</output>
</content>
