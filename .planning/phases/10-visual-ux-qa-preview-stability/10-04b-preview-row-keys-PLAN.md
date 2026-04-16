---
phase: 10
plan: 04b
subsystem: outcomes-preview
type: implementation
wave: B
autonomous: true
depends_on: []
requirements: [CRREV-02]
tags: [outcomes, data-preview, react-keys, tdd]
---

# Phase 10 Plan 04b: OutcomesDataPreview Row Key Stability

## Objective

Replace `OutcomesDataPreview`'s row `key={...}` (which currently includes the array index) with a stable composite key derived from the row's identity tuple, and guarantee uniqueness even when the same `(patient_pseudonym, eye, observation_date)` legitimately repeats. Lock the invariant with a React-key-uniqueness test.

Satisfies **CRREV-02** — Phase 9 code-review INFO finding IN-02.

## Context

- `@.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md` — decisions D-10 / D-11
- `@.planning/REQUIREMENTS.md` — CRREV-02
- `@src/components/outcomes/OutcomesDataPreview.tsx:237` — the line to change
- `@tests/OutcomesPage.test.tsx:500-661` — existing preview test pattern (reuse `buildPatientCaseWithMeasurements`, `renderWith`)

## Decisions (inherited from 10-CONTEXT.md)

- **D-10:** Key format is `` `${patient_pseudonym}|${eye}|${observation_date}` `` — no array index.
- **D-11:** If the same `(pseudo, eye, date)` tuple appears twice (rare — multiple measurements same day), append a stable `#N` suffix counting repeats within that tuple group. `flattenToRows` visits observations in sorted order, so N is deterministic across renders regardless of how React subsequently reorders the row array.

## Tasks

<task id="1" type="auto" tdd="true">

### Task 1: Add React-key-uniqueness test (RED → GREEN)

<behavior>
A new test file `tests/outcomesDataPreview.test.tsx` asserts:

1. **Unique keys per row** — render the preview with a fixture containing two patients × (3 OD + 2 OS) = 10 measurements, programmatically open the `<details>`, inspect every `<tr>` inside `tbody`, extract its React fiber key, and assert `new Set(keys).size === rows.length`.
2. **No array index in key** — assert none of the keys end with `-0`, `-1`, … (i.e. no trailing `-N` after the date); accept `|N` counter only when the tuple truly repeats.
3. **Stable keys across reorder** — render the preview twice with two fixtures whose patient lists are in reverse order; gather keys from each render; assert the **set** of keys is identical. (Stable identity = same logical row yields the same React key whatever the insertion order.)
4. **Duplicate-tuple fallback** — fixture with two observations for the same `(patient, eye, date)`: keys for those two rows differ (one gets the `|#2` suffix), and no React key-uniqueness warning fires (`console.error` spy has zero calls matching `/Encountered two children with the same key/`).

Reuses `buildPatientCaseWithMeasurements` shape from `tests/OutcomesPage.test.tsx` so fixtures stay consistent with the 09-03 suite.
</behavior>

<implementation>
- Create `tests/outcomesDataPreview.test.tsx` with `// @vitest-environment jsdom` docblock.
- Mock `../src/utils/download` the same way `tests/OutcomesPage.test.tsx` does (vi.fn for downloadCsv + datedFilename).
- Import `OutcomesDataPreview` directly (not via OutcomesPage) to avoid the whole context stack — pass `t = (k) => k`, `locale = 'en'`, and an `aggregate` stub matching the fixture's row count for the parity invariant.
- Use React Testing Library to render and `container.querySelectorAll('tbody tr')` to count rendered rows.
- Extract keys from the rendered DOM via a `data-row-key={key}` attribute added in Task 2 (so tests can assert on keys without reaching into React fibers).
- Spy on `console.error` to catch React's duplicate-key warning.

Initial run expectation: **RED** — the current key uses array index so test 2 (no trailing `-N`) fails.
</implementation>

<verification>
- `npm test -- tests/outcomesDataPreview.test.tsx` — at least one of the 4 expectations fails before Task 2.
- After Task 2 it must go GREEN.
</verification>

**Done when:**
- [ ] Test file exists and runs in the vitest jsdom environment.
- [ ] Test initially RED on at least the "no trailing `-N`" assertion.

</task>

<task id="2" type="auto" tdd="true">

### Task 2: Implement stable composite key (GREEN)

<behavior>
`OutcomesDataPreview.tsx` renders each `<tr>` with a `key` that is a pure function of row identity, not of rendering order. When two rows truly share `(patient_pseudonym, eye, observation_date)`, their keys differ via a `|#N` suffix counting repeats within that tuple (N starts at 2 for the second occurrence; first occurrence has no suffix).

The rendered `<tr>` also exposes `data-row-key={key}` for test observability.
</behavior>

<implementation>
- In `OutcomesDataPreview.tsx`:
  - Before the `rows.map` render, compute a `rowKeys: string[]` array in one pass:
    ```ts
    const seen = new Map<string, number>();
    const rowKeys = rows.map((r) => {
      const base = `${r.patient_pseudonym}|${r.eye}|${r.observation_date}`;
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return n === 1 ? base : `${base}|#${n}`;
    });
    ```
  - Replace the `<tr key={...}>` with `key={rowKeys[i]}` and add `data-row-key={rowKeys[i]}`.
  - Keep the `rows.map((r, i) => …)` signature so `i` indexes into `rowKeys`.

- No changes to `flattenToRows`, `Row` type, CSV columns, or parity invariant.
</implementation>

<verification>
- `npm test -- tests/outcomesDataPreview.test.tsx` → all 4 assertions pass (GREEN).
- `npm test -- tests/OutcomesPage.test.tsx` → the 09-03 suite (tests 13..17) remains green.
</verification>

**Done when:**
- [ ] Key is `` `${pseudo}|${eye}|${date}` `` (or `|#N` when repeating tuple).
- [ ] `data-row-key` attribute present.
- [ ] New test file fully green; no regression in existing OutcomesPage preview tests.

</task>

<task id="3" type="auto">

### Task 3: Full regression sweep

<behavior>
Full vitest run remains green — no file outside `OutcomesDataPreview.tsx` + the new test file was touched, so the 313/313 v1.5 baseline must hold.
</behavior>

<implementation>
- Run `npm test` (entire vitest suite).
- Capture total count.
</implementation>

<verification>
- Total passing test count ≥ 313.
- No new failing tests.
</verification>

**Done when:**
- [ ] `npm test` exits 0 with ≥ 313 passing tests.

</task>

## Success Criteria

- `OutcomesDataPreview` rows use `${patient_pseudonym}|${eye}|${observation_date}` (plus `|#N` for rare duplicates), not `…-${i}`.
- New test `tests/outcomesDataPreview.test.tsx` guards the invariant with four assertions.
- No regression: full vitest suite remains green.

## Output

- `src/components/outcomes/OutcomesDataPreview.tsx` — patched key construction + `data-row-key` attribute.
- `tests/outcomesDataPreview.test.tsx` — new test file (4 assertions covering uniqueness, no-index, stability-under-reorder, duplicate-tuple fallback).
