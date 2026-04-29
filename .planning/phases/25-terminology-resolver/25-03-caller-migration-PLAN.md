---
phase: 25-terminology-resolver
plan: 03
type: execute
wave: 3
depends_on:
  - 25-01
files_modified:
  - src/pages/CohortBuilderPage.tsx
  - src/pages/AnalysisPage.tsx
  - src/pages/QualityPage.tsx
  - src/components/quality/QualityCaseDetail.tsx
  - src/components/case-detail/PatientHeader.tsx
  - src/services/fhirLoader.ts
  - tests/*.test.tsx
autonomous: true
requirements:
  - TERM-02
must_haves:
  truths:
    - "All 5 callers (CohortBuilderPage, AnalysisPage, QualityPage, QualityCaseDetail, PatientHeader) import from src/services/terminology.ts; none import getDiagnosisLabel/FullText (D-19)"
    - "PatientHeader, CohortBuilderPage, AnalysisPage use the useDiagnosisDisplay hook (high-frequency render path) (D-19)"
    - "QualityPage and QualityCaseDetail use getCachedDisplay sync helper (CSV / non-render path) (D-19)"
    - "Callers pass cond.code.coding[0]?.system alongside code (D-20)"
    - "getDiagnosisLabel and getDiagnosisFullText are removed from src/services/fhirLoader.ts (TERM-02 success criterion)"
    - "Any test that imported getDiagnosisLabel/FullText from fhirLoader is updated to import from terminology.ts OR rewritten against the new API (D-23)"
    - "Each caller migration lands as a separate atomic commit for reviewability (CONTEXT plan layout requirement)"
    - "Test suite stays green after every commit; final safety net (test:ci + build + lint + knip) green (D-24)"
  artifacts:
    - path: "src/services/fhirLoader.ts"
      provides: "Loader without diagnosis-display knowledge — only resource extraction (D-03)"
      contains: "loadAllBundles"
    - path: "src/components/case-detail/PatientHeader.tsx"
      provides: "Diagnosis pill render via useDiagnosisDisplay hook"
      contains: "useDiagnosisDisplay"
  key_links:
    - from: "all 5 callers"
      to: "src/services/terminology.ts"
      via: "import { useDiagnosisDisplay | getCachedDisplay | getCachedFullText }"
      pattern: "from.*services/terminology"
    - from: "src/services/fhirLoader.ts"
      to: "(nothing — diagnosis display knowledge removed)"
      via: "lines 112-170 deleted"
      pattern: "getDiagnosisLabel"
---

<objective>
Migrate all 5 callers from `getDiagnosisLabel` / `getDiagnosisFullText` (in `src/services/fhirLoader.ts:112-170`) to the new terminology module from plan 25-01. Apply the D-19 split: `PatientHeader`, `CohortBuilderPage`, `AnalysisPage` use the `useDiagnosisDisplay` hook (label + tooltip in render); `QualityPage` and `QualityCaseDetail` use the `getCachedDisplay` sync helper (CSV / non-render contexts). Pass `coding[0]?.system` alongside `code` (D-20). Once all callers are migrated, remove the two functions from `fhirLoader.ts` (TERM-02). One commit per caller for reviewability.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/25-terminology-resolver/25-CONTEXT.md
@.planning/REQUIREMENTS.md
@.planning/phases/25-terminology-resolver/25-01-SUMMARY.md
@CLAUDE.md
@src/services/fhirLoader.ts
@src/services/terminology.ts
@src/pages/CohortBuilderPage.tsx
@src/pages/AnalysisPage.tsx
@src/pages/QualityPage.tsx
@src/components/quality/QualityCaseDetail.tsx
@src/components/case-detail/PatientHeader.tsx

<interfaces>
Caller call-sites (verified by grep on current main):

| Caller | Lines | Current API | Target API |
|--------|-------|-------------|------------|
| `src/components/case-detail/PatientHeader.tsx` | 16, 135-137 | `getDiagnosisLabel(cond.code.coding[0]?.code ?? '', locale)` + `getDiagnosisFullText(...)` | `useDiagnosisDisplay(cond.code.coding[0]?.code ?? '', cond.code.coding[0]?.system, locale)` returning `{label, fullText}` |
| `src/pages/CohortBuilderPage.tsx` | 24-25, 103, 635-636 | `getDiagnosisLabel(code, locale)` + `getDiagnosisFullText(code, locale)` (note: only `code` available at line 103 — CSV row export; lines 635-636 are JSX render) | Line 103 (CSV): `getCachedDisplay(undefined, code, locale)` since the system isn't in scope at that aggregation point — accept undefined system per D-05 sentinel. Lines 635-636 (JSX): `useDiagnosisDisplay(code, undefined, locale)` since this map is also `code`-only without coding context. |
| `src/pages/AnalysisPage.tsx` | 35-36, 105, 115 | `getDiagnosisLabel(code, locale)` + `getDiagnosisFullText(code, locale)` | Line 105 (label compute) + Line 115 (fullText): use `useDiagnosisDisplay(code, undefined, locale)` or `getCachedDisplay/getCachedFullText` depending on whether the surrounding code is a hook context vs. a memoized non-hook function. Inspect the surrounding scope to choose. |
| `src/pages/QualityPage.tsx` | 15, 183 | `getDiagnosisLabel(cond.code?.coding?.[0]?.code ?? '', locale)` inside a `.map()` for CSV export | `getCachedDisplay(cond.code?.coding?.[0]?.system, cond.code?.coding?.[0]?.code ?? '', locale)` (D-19 — CSV path, sync helper) |
| `src/components/quality/QualityCaseDetail.tsx` | 20, 171 | `getDiagnosisLabel(c.code.coding[0]?.code ?? '', locale)` inside a `.map()` joining diagnosis labels | `getCachedDisplay(c.code.coding[0]?.system, c.code.coding[0]?.code ?? '', locale)` (D-19) |

Discretionary decision: CONTEXT D-20 says "use a small `pickCoding(cond)` helper if it pops up >2x". Counting actual repetitions: PatientHeader (1×), CohortBuilderPage line 635 (1×), QualityPage (1×), QualityCaseDetail (1×) → 4 distinct call-sites with the `cond.code.coding[0]?.{system,code}` pattern. **Decision per Claude discretion (CONTEXT §"Claude's Discretion"): add `pickCoding(cond)` to `shared/fhirQueries.ts`** returning `{ system: string | undefined, code: string }` (with empty-string fallback for code). The 4-site repetition exceeds the 2× threshold.

Tests touching the old API — search candidates (verify by grep before editing):
- `tests/PatientHeader.test.tsx` (if exists)
- `tests/CohortBuilderPage.test.tsx` (if exists)
- Any test importing `from .*services/fhirLoader` and using `getDiagnosisLabel\|getDiagnosisFullText`
- Run `grep -rln "getDiagnosisLabel\|getDiagnosisFullText" tests/` BEFORE Task 1 and treat each hit as work to handle in this plan (D-23).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add pickCoding helper + migrate PatientHeader (caller 1/5)</name>
  <files>shared/fhirQueries.ts, src/components/case-detail/PatientHeader.tsx, tests/*.test.tsx</files>
  <action>
    Per D-19, D-20, CLAUDE.md (cross-boundary helpers in `shared/`):
    1. Add `pickCoding(cond)` to `shared/fhirQueries.ts` (or create the file if it doesn't host this concern yet — verify with `ls shared/`):
       ```ts
       export function pickCoding(cond: { code?: { coding?: Array<{ system?: string; code?: string }> } }):
         { system: string | undefined; code: string } {
         const c = cond.code?.coding?.[0];
         return { system: c?.system, code: c?.code ?? '' };
       }
       ```
    2. Edit `src/components/case-detail/PatientHeader.tsx`:
       - Replace the import `getDiagnosisFullText, getDiagnosisLabel` with the hook + helper: `import { useDiagnosisDisplay } from '../../services/terminology'` and `import { pickCoding } from '../../../shared/fhirQueries'`.
       - The diagnoses are rendered in a `.map((cond) => <span ...>)` (lines 131-150). Hook usage inside `.map` requires extracting the row into its own component to keep hook calls at the top level of a component (React rules of hooks). Create an internal `DiagnosisPill` component in the same file:
         ```tsx
         function DiagnosisPill({ cond, locale, t, dateFmt }: {...}) {
           const { system, code } = pickCoding(cond);
           const { label, fullText } = useDiagnosisDisplay(code, system, locale);
           return (<span title={fullText}>{label}{...laterality+onset spans...}</span>);
         }
         ```
         Then in the parent: `{primaryDiagnoses.map((cond) => <DiagnosisPill key={cond.id} cond={cond} locale={locale} t={t} dateFmt={dateFmt} />)}`.
    3. Update or replace any existing test importing the old API for PatientHeader (D-23). Run `grep -n "getDiagnosisLabel\|getDiagnosisFullText" tests/` to discover. For tests that asserted on the rendered diagnosis label/title text: keep the assertion (the seed map preserves byte-identical strings per 25-01 D-08, so `queryByText('AMD')` and `title='Altersbedingte Makuladegeneration (267718000)'` continue to work).
    4. Safety net: `npm run test:ci && npm run build && npm run lint`.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <done>
    PatientHeader renders without importing fhirLoader's diagnosis fns. Existing tests still green (seed strings byte-identical). Atomic commit: `refactor(25-03): migrate PatientHeader to useDiagnosisDisplay hook (TERM-02)`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate CohortBuilderPage + AnalysisPage (callers 2-3/5)</name>
  <files>src/pages/CohortBuilderPage.tsx, src/pages/AnalysisPage.tsx, tests/*.test.tsx</files>
  <action>
    Per D-19, D-20:

    **CohortBuilderPage.tsx (commit 1 of this task):**
    1. Replace imports `getDiagnosisFullText, getDiagnosisLabel` with `import { useDiagnosisDisplay, getCachedDisplay } from '../services/terminology'`.
    2. Line 103 (CSV row build — non-render context): replace `getDiagnosisLabel(code, locale)` with `getCachedDisplay(undefined, code, locale)`. Note: at this aggregation point only `code` is in scope (the original code was already system-less), so we pass `undefined` per D-05 sentinel. The seed map's `_` sentinel keys won't match these codes, so the resolver will return the raw code on first call and may resolve via server on subsequent. This is acceptable for CSV export (it's the existing behavior — D-09 preserves "raw code for unmapped").
    3. Lines 635-636 (JSX render): the `.map((code) => <span title={...}>{...}</span>)` runs inside the parent component's render. Per React rules-of-hooks, extract a `DiagnosisCodeChip({ code, locale })` inner component that calls `useDiagnosisDisplay(code, undefined, locale)` and renders the span. Replace the `.map` body with `<DiagnosisCodeChip key={code} code={code} locale={locale} />`.
    4. Atomic commit: `refactor(25-03): migrate CohortBuilderPage to terminology module (TERM-02)`.

    **AnalysisPage.tsx (commit 2 of this task):**
    5. Replace imports `getDiagnosisFullText, getDiagnosisLabel` with `import { useDiagnosisDisplay, getCachedDisplay, getCachedFullText } from '../services/terminology'`.
    6. Inspect the surrounding context of lines 105 + 115. If they're inside a top-level component render path, refactor into a small chip component using `useDiagnosisDisplay`. If they're inside a memoized helper function (e.g. `useMemo(() => diagnoses.map(code => ({label: getDiagnosisLabel(code, locale), fullText: getDiagnosisFullText(code, locale)})), [diagnoses, locale])`), use `getCachedDisplay(undefined, code, locale)` and `getCachedFullText(undefined, code, locale)` directly inside the memo (D-19's split allows the sync helper for non-hook contexts even on render-adjacent paths).
    7. Update or replace any existing AnalysisPage test that imported the old API.
    8. Atomic commit: `refactor(25-03): migrate AnalysisPage to terminology module (TERM-02)`.

    Safety net after each commit: `npm run test:ci && npm run build && npm run lint`.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <done>
    Two atomic commits land. Both pages compile, render, and tests stay green. No remaining `getDiagnosisLabel\|getDiagnosisFullText` references in `src/pages/CohortBuilderPage.tsx` or `src/pages/AnalysisPage.tsx`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Migrate QualityPage + QualityCaseDetail (callers 4-5/5)</name>
  <files>src/pages/QualityPage.tsx, src/components/quality/QualityCaseDetail.tsx, tests/*.test.tsx</files>
  <action>
    Per D-19 (sync helper for CSV / .map non-render):

    **QualityPage.tsx (commit 1 of this task):**
    1. Replace import `getDiagnosisLabel` with `import { getCachedDisplay } from '../services/terminology'` and `import { pickCoding } from '../../shared/fhirQueries'`.
    2. Line 183: replace
       ```ts
       (c.conditions ?? []).map((cond) => getDiagnosisLabel(cond.code?.coding?.[0]?.code ?? '', locale)).join('; ')
       ```
       with
       ```ts
       (c.conditions ?? []).map((cond) => {
         const { system, code } = pickCoding(cond);
         return getCachedDisplay(system, code, locale);
       }).join('; ')
       ```
    3. Atomic commit: `refactor(25-03): migrate QualityPage to getCachedDisplay (TERM-02)`.

    **QualityCaseDetail.tsx (commit 2 of this task):**
    4. Replace import `getDiagnosisLabel` with `import { getCachedDisplay } from '../../services/terminology'` and `import { pickCoding } from '../../../shared/fhirQueries'`.
    5. Line 171: replace
       ```ts
       .map((c) => getDiagnosisLabel(c.code.coding[0]?.code ?? '', locale))
       ```
       with
       ```ts
       .map((c) => { const { system, code } = pickCoding(c); return getCachedDisplay(system, code, locale); })
       ```
    6. Atomic commit: `refactor(25-03): migrate QualityCaseDetail to getCachedDisplay (TERM-02)`.

    Safety net after each commit: `npm run test:ci && npm run build && npm run lint`.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run lint</automated>
  </verify>
  <done>
    Two atomic commits land. `grep -rn "getDiagnosisLabel\|getDiagnosisFullText" src/` returns ONLY `src/services/fhirLoader.ts` (the export itself — to be removed in Task 4).
  </done>
</task>

<task type="auto">
  <name>Task 4: Remove getDiagnosisLabel + getDiagnosisFullText from fhirLoader.ts + final safety net</name>
  <files>src/services/fhirLoader.ts, tests/*.test.ts</files>
  <action>
    Per D-03 (loader's only job is resource extraction) + TERM-02 success criterion:
    1. `grep -rn "getDiagnosisLabel\|getDiagnosisFullText" src/ tests/` — confirm callers are zero outside `src/services/fhirLoader.ts` and any remaining test stubs.
    2. Delete lines 112-170 from `src/services/fhirLoader.ts` (the two `export function` blocks). Also delete the `/** Full display text for a code (used as tooltip). Locale-aware (m-03). */` JSDoc on line 123 and the comment on line 12 ("getDiagnosisLabel, getDiagnosisFullText, etc.") — update that re-export header comment to reflect that diagnosis display moved to `terminology.ts`.
    3. Verify the SNOMED_AMD / SNOMED_DR exports above line 112 are still consumed elsewhere — `grep -rn "SNOMED_AMD\|SNOMED_DR" src/`. If they're only consumed by code we just migrated, leave them in place (they may still be used by `PatientHeader` for the eye-laterality SNOMED check or similar). The new terminology module duplicates these as seed-map keys; that's acceptable (the constants serve a different purpose — comparing codes in resource extraction).
    4. Update or remove any test that imported `getDiagnosisLabel` / `getDiagnosisFullText` from `fhirLoader` (D-23). For each:
       - If the test was asserting the function output → either rewrite to import from `terminology.ts` (`getCachedDisplay`/`getCachedFullText`) OR delete if the assertion is now redundant with the 25-01 module tests.
       - Use `git grep` and the unmistakable import path to find them.
    5. Final safety net (D-24):
       - `npm run test:ci` — must be green; total expected ~622–624 (619 baseline + ~5 from 25-01 + ~4 from 25-02 + any new caller-tests touched here, possibly minus removed redundant tests). Exact number is Claude's call per CONTEXT discretion.
       - `npm run build` — green. (Pitfall 3 — explicit check after deletions.)
       - `npm run lint` — green; no unused imports left dangling.
       - `npm run knip` — green; if `SNOMED_AMD`/`SNOMED_DR` are now unused, knip will flag them — either delete or document the retention reason.
    6. Atomic commit: `refactor(25-03): remove getDiagnosisLabel/FullText from fhirLoader (TERM-02)`.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run lint &amp;&amp; npm run knip</automated>
  </verify>
  <done>
    `grep -rn "getDiagnosisLabel\|getDiagnosisFullText" src/ tests/` returns zero results. Full safety net green. Atomic commit landed.
  </done>
</task>

</tasks>

<verification>
- `grep -rn "getDiagnosisLabel\|getDiagnosisFullText" src/ tests/` returns zero hits.
- Each of the 5 callers imports from `src/services/terminology` (3 use the hook, 2 use sync helper).
- `pickCoding` exists in `shared/fhirQueries.ts` and is consumed by ≥3 callers.
- 5–6 atomic commits landed: PatientHeader, CohortBuilderPage, AnalysisPage, QualityPage, QualityCaseDetail, fhirLoader cleanup.
- Final test:ci count ≈ 622–624 (Claude's call per discretion).
</verification>

<success_criteria>
- TERM-02 fully satisfied: `getDiagnosisLabel` + `getDiagnosisFullText` are gone from `fhirLoader.ts`; all 5 callers compile against the new API.
- Display strings byte-identical to pre-migration (preserves D-08 / specifics §1 — no spurious snapshot diff).
- One commit per caller (plus the helper + cleanup) — reviewable history per CONTEXT plan-layout requirement.
- Safety net green at end of plan.
</success_criteria>

<output>
After completion, create `.planning/phases/25-terminology-resolver/25-03-SUMMARY.md` per the standard summary template.
</output>
