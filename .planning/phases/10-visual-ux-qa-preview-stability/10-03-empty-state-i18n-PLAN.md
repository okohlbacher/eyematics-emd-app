---
phase: 10-visual-ux-qa-preview-stability
plan: 03
type: execute
wave: 2
depends_on: ["10-01", "10-04a"]
files_modified:
  - src/components/outcomes/OutcomesEmptyState.tsx
  - src/pages/OutcomesPage.tsx
  - src/i18n/translations.ts
  - tests/outcomesEmptyState.test.tsx
autonomous: true
requirements: [VQA-05]
requirements_addressed: [VQA-05]

must_haves:
  truths:
    - "OutcomesEmptyState's `Variant` union is exactly `'no-cohort' | 'no-visus' | 'all-eyes-filtered'`."
    - "OutcomesPage dispatches the new `all-eyes-filtered` variant when `cohort.cases.length > 0` but the computed aggregate has zero eligible measurements after the OD/OS layer filters (post-filter measurement count is zero)."
    - "`src/i18n/translations.ts` contains `outcomesEmptyAllEyesFilteredTitle` and `outcomesEmptyAllEyesFilteredBody` with non-empty de + en strings matching D-08 copy verbatim."
    - "`tests/outcomesI18n.test.ts` passes — both new keys are enumerated and verified for non-empty de+en + placeholder parity."
    - "A new test `tests/outcomesEmptyState.test.tsx` asserts the variant dispatch contract (D-07): given a cohort with cases but zero post-filter measurements, OutcomesPage renders the `all-eyes-filtered` empty state; and the empty state localizes correctly in de + en."
  artifacts:
    - path: "src/components/outcomes/OutcomesEmptyState.tsx"
      provides: "Extended Variant union + D-08 copy routing"
      contains: "'all-eyes-filtered'"
    - path: "src/pages/OutcomesPage.tsx"
      provides: "Dispatch branch for the all-eyes-filtered variant"
      contains: "variant=\"all-eyes-filtered\""
    - path: "src/i18n/translations.ts"
      provides: "D-08 DE + EN copy for the new variant"
      contains: "outcomesEmptyAllEyesFilteredTitle"
    - path: "tests/outcomesEmptyState.test.tsx"
      provides: "Variant-dispatch and localization regression test"
      contains: "describe('OutcomesEmptyState"
  key_links:
    - from: "src/pages/OutcomesPage.tsx"
      to: "src/components/outcomes/OutcomesEmptyState.tsx"
      via: "variant prop dispatch on zero post-filter measurementCount"
      pattern: "variant=\"all-eyes-filtered\""
    - from: "src/components/outcomes/OutcomesEmptyState.tsx"
      to: "src/i18n/translations.ts"
      via: "t(titleKey) + t(bodyKey) for 'all-eyes-filtered' keys"
      pattern: "outcomesEmptyAllEyesFilteredTitle|outcomesEmptyAllEyesFilteredBody"
    - from: "tests/outcomesI18n.test.ts"
      to: "src/i18n/translations.ts"
      via: "walks src/ for t('outcomes*') references + enumerates outcomes* keys"
      pattern: "outcomesEmptyAllEyesFiltered"
---

<objective>
Add a third empty-state variant `all-eyes-filtered` (D-07) with D-08 copy (DE + EN), dispatch it from `OutcomesPage.tsx` when a non-empty cohort has zero post-filter eligible measurements, and keep `tests/outcomesI18n.test.ts` green by registering the new keys. Add a regression test that asserts the dispatch contract and localization.

Purpose: Close VQA-05. Three distinct empty states now exist (`no-cohort`, `no-visus`, `all-eyes-filtered`), each localized in DE + EN.
Output: Extended component + page dispatch + translations + new component test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md
@src/components/outcomes/OutcomesEmptyState.tsx
@src/pages/OutcomesPage.tsx
@src/i18n/translations.ts
@tests/outcomesI18n.test.ts

<interfaces>
<!-- Current empty-state surface — extracted from source 2026-04-16 -->

From src/components/outcomes/OutcomesEmptyState.tsx (lines 6-17):
```typescript
type Variant = 'no-cohort' | 'no-visus';

export default function OutcomesEmptyState({ variant, t }: {
  variant: Variant;
  t: (key: TranslationKey) => string;
}) {
  const titleKey: TranslationKey = variant === 'no-cohort' ? 'outcomesEmptyCohortTitle' : 'outcomesNoVisusTitle';
  const bodyKey: TranslationKey = variant === 'no-cohort' ? 'outcomesEmptyCohortBody' : 'outcomesNoVisusBody';
  const actionKey: TranslationKey | null = variant === 'no-cohort' ? 'outcomesEmptyCohortAction' : null;
  // ...
}
```

From src/pages/OutcomesPage.tsx (lines 112-131) — existing early returns:
- `if (!cohort || cohort.cases.length === 0) return <OutcomesEmptyState variant="no-cohort" ... />;`
- After aggregate computed: `if (aggregate.od.summary.measurementCount === 0 && aggregate.os.summary.measurementCount === 0) return <OutcomesEmptyState variant="no-visus" ... />;`

D-07 condition for the new `all-eyes-filtered` variant:
"`cohort.cases.length > 0` but post-OD/OS filter returns zero eligible measurements."

**Important distinction**: the CURRENT `no-visus` branch already catches zero total measurements across both eyes. D-07 is about POST-FILTER state — i.e., the user has LAYER toggles that hide all eyes (both OD and OS filtered out), OR the OD/OS filter applied to the aggregate leaves no eligible measurements.

After reading OutcomesPage.tsx more carefully: there is no OD/OS filter in the current UI — `layers.median/perPatient/scatter/spreadBand` control which LAYERS render, not which EYES. However, the CONTEXT.md D-07 text says "post-OD/OS filter returns zero eligible measurements". The most faithful interpretation given current code: treat D-07 as firing when the cohort has cases BUT every patient in the cohort has no LOINC_VISUS observations in either eye — i.e., aggregate.od.summary.measurementCount === 0 AND aggregate.os.summary.measurementCount === 0 BUT cohort.cases.length > 0.

That condition is currently handled by the `no-visus` branch. D-07 refines this: "Adjust the OD/OS or layer toggles to see data" — the copy ASSUMES the user applied a filter. So D-07 variant fires when the cases exist, but all layer toggles are OFF (no median, no perPatient, no scatter, no spreadBand), rendering a cohort-present-but-nothing-visible state.

Planner decision (resolved at plan time):
Fire `all-eyes-filtered` when `cohort.cases.length > 0` AND `(aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount > 0)` (there IS data) AND `!layers.median && !layers.perPatient && !layers.scatter && !layers.spreadBand` (every layer is off). This matches D-08 copy ("adjust the layer toggles"). The `no-visus` branch continues to handle "zero measurements regardless of filters".

(If future PRs add a real OD/OS filter UI, the dispatch condition will need to expand; for now the layer-toggle-off case is the only way to reach D-07 from the UI.)

Tests/outcomesI18n.test.ts walk rules (for key discovery):
- `t('outcomes*')` regex at line 48: `/\bt\(\s*['"`](outcomes[A-Za-z0-9_]+)['"`]\s*\)/g` — so any `t('outcomesEmptyAllEyesFilteredTitle')` reference in src/ will be auto-discovered AND required to resolve to a defined key.
- `outcomesKeys.length > 40` sanity floor — adding 2 more keys (we're already at ~73) stays well above this.
</interfaces>

<scope_note>
D-07's "post-OD/OS filter" text does not match current UI (no OD/OS filter exists) — we interpret it as the layer-all-off state. If the phase discovers a genuine OD/OS filter control (e.g., inside OutcomesSettingsDrawer) that already exists, expand the dispatch condition to include that case and add a second test assertion. Pre-plan grep of OutcomesSettingsDrawer.tsx for an "eye filter" is advised during execution.
</scope_note>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add D-08 copy to src/i18n/translations.ts (DE + EN)</name>
  <files>src/i18n/translations.ts</files>
  <read_first>
    - src/i18n/translations.ts lines 660-665 (existing outcomesEmpty* / outcomesNoVisus* keys — find insertion point that keeps outcomes* keys grouped)
    - .planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md §Empty States (D-07, D-08) for verbatim copy
  </read_first>
  <behavior>
    - `translations.outcomesEmptyAllEyesFilteredTitle.de` === `"Keine Augen entsprechen den aktuellen Filtern."`
    - `translations.outcomesEmptyAllEyesFilteredTitle.en` === `"No eyes match the current filters."`
    - `translations.outcomesEmptyAllEyesFilteredBody.de` === `"Passen Sie die OD/OS- oder Layer-Filter an, um Daten zu sehen."`
    - `translations.outcomesEmptyAllEyesFilteredBody.en` === `"Adjust the OD/OS or layer toggles to see data."`
    - Insertion preserves file grouping: new keys sit immediately after the existing `outcomesNoVisusBody` line.
  </behavior>
  <action>
    Open `src/i18n/translations.ts`. Locate the block (currently lines 660-664):
    ```typescript
      outcomesEmptyCohortTitle: { de: 'Keine Patient:innen in dieser Kohorte', en: 'No patients in this cohort' },
      outcomesEmptyCohortBody: { de: 'Passen Sie den Filter in der Kohortenbildung an oder wählen Sie eine andere gespeicherte Suche.', en: 'Adjust filters in the Cohort Builder or pick a different saved search.' },
      outcomesEmptyCohortAction: { de: 'Zur Kohortenbildung', en: 'Go to Cohort Builder' },
      outcomesNoVisusTitle: { de: 'Keine Visus-Messungen in dieser Kohorte', en: 'No visus measurements in this cohort' },
      outcomesNoVisusBody: { de: 'Die ausgewählten Patient:innen haben keine Observation mit LOINC 79880-1.', en: 'The selected patients have no observation with LOINC 79880-1.' },
    ```

    Immediately AFTER the `outcomesNoVisusBody` line, insert these two new keys (preserve the 2-space indent and trailing comma patterns used in the file):
    ```typescript
      outcomesEmptyAllEyesFilteredTitle: { de: 'Keine Augen entsprechen den aktuellen Filtern.', en: 'No eyes match the current filters.' },
      outcomesEmptyAllEyesFilteredBody: { de: 'Passen Sie die OD/OS- oder Layer-Filter an, um Daten zu sehen.', en: 'Adjust the OD/OS or layer toggles to see data.' },
    ```

    Do NOT add an `outcomesEmptyAllEyesFilteredAction` key — D-08 specifies no action link ("user fixes it inline via the same toolbar they're looking at").
  </action>
  <verify>
    <automated>grep -n "outcomesEmptyAllEyesFiltered" src/i18n/translations.ts &amp;&amp; npm run typecheck 2>&amp;1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -F "outcomesEmptyAllEyesFilteredTitle: { de: 'Keine Augen entsprechen den aktuellen Filtern.', en: 'No eyes match the current filters.' }" src/i18n/translations.ts` matches
    - `grep -F "outcomesEmptyAllEyesFilteredBody: { de: 'Passen Sie die OD/OS- oder Layer-Filter an, um Daten zu sehen.', en: 'Adjust the OD/OS or layer toggles to see data.' }" src/i18n/translations.ts` matches
    - `! grep -E "outcomesEmptyAllEyesFilteredAction" src/i18n/translations.ts` (no action key — D-08 explicit)
    - `npm run typecheck` exits 0
  </acceptance_criteria>
  <done>Two new DE+EN keys added verbatim per D-08; no action key; TypeScript compiles (TranslationKey literal union picks up new keys automatically because translations object is the source of truth).</done>
</task>

<task type="auto">
  <name>Task 2: Extend OutcomesEmptyState.tsx Variant union + routing</name>
  <files>src/components/outcomes/OutcomesEmptyState.tsx</files>
  <read_first>
    - src/components/outcomes/OutcomesEmptyState.tsx (entire file — current Variant union + conditional title/body/action derivation)
    - src/i18n/translations.ts (verify TranslationKey resolves for `outcomesEmptyAllEyesFilteredTitle` after Task 1 lands)
  </read_first>
  <behavior>
    - `Variant` type union is exactly `'no-cohort' | 'no-visus' | 'all-eyes-filtered'`.
    - When `variant === 'all-eyes-filtered'`, titleKey = `'outcomesEmptyAllEyesFilteredTitle'`, bodyKey = `'outcomesEmptyAllEyesFilteredBody'`, actionKey = `null`.
    - Existing `no-cohort` and `no-visus` routing is unchanged.
  </behavior>
  <action>
    Rewrite the top of `src/components/outcomes/OutcomesEmptyState.tsx` as follows, keeping the existing JSX body identical (the `<div>` + icon + title/body/action link layout):

    ```typescript
    import { Users } from 'lucide-react';
    import { Link } from 'react-router-dom';

    import type { TranslationKey } from '../../i18n/translations';

    type Variant = 'no-cohort' | 'no-visus' | 'all-eyes-filtered';

    export default function OutcomesEmptyState({
      variant,
      t,
    }: {
      variant: Variant;
      t: (key: TranslationKey) => string;
    }) {
      let titleKey: TranslationKey;
      let bodyKey: TranslationKey;
      let actionKey: TranslationKey | null;

      switch (variant) {
        case 'no-cohort':
          titleKey = 'outcomesEmptyCohortTitle';
          bodyKey = 'outcomesEmptyCohortBody';
          actionKey = 'outcomesEmptyCohortAction';
          break;
        case 'no-visus':
          titleKey = 'outcomesNoVisusTitle';
          bodyKey = 'outcomesNoVisusBody';
          actionKey = null;
          break;
        case 'all-eyes-filtered':
          titleKey = 'outcomesEmptyAllEyesFilteredTitle';
          bodyKey = 'outcomesEmptyAllEyesFilteredBody';
          actionKey = null;
          break;
      }

      return (
        <div className="p-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
          <Users aria-hidden="true" className="w-12 h-12 text-gray-300 mb-4" />
          <h2 className="text-base font-semibold text-gray-900 mb-2">{t(titleKey)}</h2>
          <p className="text-sm text-gray-500 mb-4 max-w-md">{t(bodyKey)}</p>
          {actionKey && (
            <Link to="/cohort" className="text-sm text-blue-600 underline hover:text-blue-700">
              {t(actionKey)}
            </Link>
          )}
        </div>
      );
    }
    ```

    Keep the file's imports and overall shape identical to the pre-edit version — only the `Variant` union and the title/body/action derivation block change.
  </action>
  <verify>
    <automated>npm run typecheck 2>&amp;1 | tail -10 &amp;&amp; grep -n "all-eyes-filtered" src/components/outcomes/OutcomesEmptyState.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "^type Variant = 'no-cohort' \| 'no-visus' \| 'all-eyes-filtered';" src/components/outcomes/OutcomesEmptyState.tsx` matches
    - `grep -E "case 'all-eyes-filtered':" src/components/outcomes/OutcomesEmptyState.tsx` matches
    - `grep -E "titleKey = 'outcomesEmptyAllEyesFilteredTitle';" src/components/outcomes/OutcomesEmptyState.tsx` matches
    - `grep -E "bodyKey = 'outcomesEmptyAllEyesFilteredBody';" src/components/outcomes/OutcomesEmptyState.tsx` matches
    - `npm run typecheck` exits 0 (TranslationKey union resolves; no-switch-fall-through warning absent)
  </acceptance_criteria>
  <done>Variant union extended; new variant routes to D-08 keys.</done>
</task>

<task type="auto">
  <name>Task 3: Dispatch `all-eyes-filtered` variant from OutcomesPage.tsx</name>
  <files>src/pages/OutcomesPage.tsx</files>
  <read_first>
    - src/pages/OutcomesPage.tsx (entire file — especially early-return chain at lines 112-131; confirm `layers` state + `aggregate` shape)
    - src/components/outcomes/OutcomesEmptyState.tsx (the component from Task 2)
    - src/components/outcomes/OutcomesSettingsDrawer.tsx (grep for an OD/OS filter control — if one exists, broaden the dispatch; if not, use the layer-all-off signal)
  </read_first>
  <behavior>
    - New early return dispatches `<OutcomesEmptyState variant="all-eyes-filtered" t={...} />` when:
      - `cohort.cases.length > 0` (non-empty cohort)
      - `aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount > 0` (data exists — else `no-visus` handles it)
      - `!layers.median && !layers.perPatient && !layers.scatter && !layers.spreadBand` (every layer toggle is off — user has filtered everything out)
    - The new return is placed AFTER the existing `no-visus` branch so the branch order is: `no-cohort` → `no-visus` → `all-eyes-filtered`.
    - No other logic in the page changes.
  </behavior>
  <action>
    Before editing, run a quick grep to verify no existing OD/OS filter control exists that the dispatch should also check:
    ```bash
    grep -En "eyeFilter|od_filter|os_filter|showOd|showOs" src/components/outcomes/OutcomesSettingsDrawer.tsx src/pages/OutcomesPage.tsx
    ```
    If the grep returns zero matches (expected), use the layer-all-off signal below. If matches exist, widen the dispatch condition to include the filter predicate and note this in SUMMARY.

    Edit `src/pages/OutcomesPage.tsx`. After the existing `no-visus` early return (currently lines 120-131):
    ```tsx
      // No-visus early return: both panels have zero measurements
      if (
        aggregate.od.summary.measurementCount === 0 &&
        aggregate.os.summary.measurementCount === 0
      ) {
        return (
          <OutcomesEmptyState
            variant="no-visus"
            t={t as (key: TranslationKey) => string}
          />
        );
      }
    ```

    INSERT a new block immediately after it:
    ```tsx
      // VQA-05 / D-07: all-eyes-filtered — data exists but every layer toggle is off.
      // Distinct from no-visus (no data at all). Copy in D-08 directs the user to the toolbar.
      if (
        cohort.cases.length > 0 &&
        aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount > 0 &&
        !layers.median &&
        !layers.perPatient &&
        !layers.scatter &&
        !layers.spreadBand
      ) {
        return (
          <OutcomesEmptyState
            variant="all-eyes-filtered"
            t={t as (key: TranslationKey) => string}
          />
        );
      }
    ```

    Do NOT reorder the `no-cohort` or `no-visus` branches — `all-eyes-filtered` strictly follows them.
  </action>
  <verify>
    <automated>npm run typecheck 2>&amp;1 | tail -10 &amp;&amp; grep -n "all-eyes-filtered" src/pages/OutcomesPage.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "variant=\"all-eyes-filtered\"" src/pages/OutcomesPage.tsx` matches exactly once
    - `grep -E "!layers\.median &&\s*!layers\.perPatient &&\s*!layers\.scatter &&\s*!layers\.spreadBand" src/pages/OutcomesPage.tsx` matches (or on multiple lines with whitespace — the logic MUST check all four layer flags are false)
    - `grep -E "aggregate\.od\.summary\.measurementCount \+ aggregate\.os\.summary\.measurementCount > 0" src/pages/OutcomesPage.tsx` matches
    - `npm run typecheck` exits 0
    - `npx vitest run tests/OutcomesPage.test.tsx` exits 0 (existing page tests do not set all layers to false; new branch should not trigger for them)
  </acceptance_criteria>
  <done>OutcomesPage dispatches the new variant with the layer-all-off condition; TypeScript green; existing page tests unaffected.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Add tests/outcomesEmptyState.test.tsx (D-07 dispatch + D-08 localization)</name>
  <files>tests/outcomesEmptyState.test.tsx</files>
  <read_first>
    - src/components/outcomes/OutcomesEmptyState.tsx (the component from Task 2 — variant union + copy routing)
    - src/i18n/translations.ts (to verify D-08 strings exist)
    - tests/cohortTrajectory.test.ts (RTL style reference)
    - tests/OutcomesPage.test.tsx lines 60-90 (context mocking pattern for DataContext + LanguageContext; we need a LIGHTER harness here — just rendering OutcomesEmptyState directly with a translation stub)
  </read_first>
  <behavior>
    - Test 1 (EN copy, 'all-eyes-filtered'): render OutcomesEmptyState with variant='all-eyes-filtered' and an EN-locale translation stub; assert `container.textContent` includes `No eyes match the current filters.` and `Adjust the OD/OS or layer toggles to see data.`.
    - Test 2 (DE copy): same variant with a DE-locale translation stub; assert `Keine Augen entsprechen den aktuellen Filtern.` and `Passen Sie die OD/OS- oder Layer-Filter an, um Daten zu sehen.`.
    - Test 3 (no action link): in the `all-eyes-filtered` variant, assert `container.querySelector('a')` is null (no link rendered — D-08 is explicit: no action link).
    - Test 4 (no-cohort variant retains action link): render with variant='no-cohort'; assert `container.querySelector('a')` is NOT null (regression guard on existing variant).
    - Test 5 (i18n key presence via import): import the raw translations object and assert both `outcomesEmptyAllEyesFilteredTitle.de` and `.en` resolve to the verbatim D-08 strings.
  </behavior>
  <action>
    Create `tests/outcomesEmptyState.test.tsx`:

    ```typescript
    // @vitest-environment jsdom
    /**
     * VQA-05 / D-07 / D-08: OutcomesEmptyState third variant ('all-eyes-filtered')
     * with DE + EN localization verified verbatim.
     */
    import { describe, expect, it, afterEach } from 'vitest';
    import { render, cleanup } from '@testing-library/react';
    import { MemoryRouter } from 'react-router-dom';

    import OutcomesEmptyState from '../src/components/outcomes/OutcomesEmptyState';
    import type { TranslationKey } from '../src/i18n/translations';

    afterEach(() => cleanup());

    // Translation stub that reads from the real translations object, keyed by locale.
    // Keeps the test independent of LanguageContext and guarantees we check the real strings.
    async function makeT(locale: 'de' | 'en'): Promise<(k: TranslationKey) => string> {
      const mod = await import('../src/i18n/translations');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (mod as any).translations ?? (mod as any).default;
      return (k: TranslationKey) => {
        const entry = table[k];
        if (!entry) throw new Error(`Missing translation key in fixture: ${k}`);
        return entry[locale];
      };
    }

    describe('OutcomesEmptyState — all-eyes-filtered variant (D-07 / D-08)', () => {
      it('renders EN copy for the all-eyes-filtered variant verbatim', async () => {
        const t = await makeT('en');
        const { container } = render(
          <MemoryRouter>
            <OutcomesEmptyState variant="all-eyes-filtered" t={t} />
          </MemoryRouter>,
        );
        const text = container.textContent ?? '';
        expect(text).toContain('No eyes match the current filters.');
        expect(text).toContain('Adjust the OD/OS or layer toggles to see data.');
      });

      it('renders DE copy for the all-eyes-filtered variant verbatim', async () => {
        const t = await makeT('de');
        const { container } = render(
          <MemoryRouter>
            <OutcomesEmptyState variant="all-eyes-filtered" t={t} />
          </MemoryRouter>,
        );
        const text = container.textContent ?? '';
        expect(text).toContain('Keine Augen entsprechen den aktuellen Filtern.');
        expect(text).toContain('Passen Sie die OD/OS- oder Layer-Filter an, um Daten zu sehen.');
      });

      it('renders NO action link for the all-eyes-filtered variant (D-08)', async () => {
        const t = await makeT('en');
        const { container } = render(
          <MemoryRouter>
            <OutcomesEmptyState variant="all-eyes-filtered" t={t} />
          </MemoryRouter>,
        );
        expect(container.querySelector('a')).toBeNull();
      });

      it('still renders an action link for the no-cohort variant (regression guard)', async () => {
        const t = await makeT('en');
        const { container } = render(
          <MemoryRouter>
            <OutcomesEmptyState variant="no-cohort" t={t} />
          </MemoryRouter>,
        );
        const link = container.querySelector('a');
        expect(link).not.toBeNull();
        expect(link?.getAttribute('href')).toBe('/cohort');
      });
    });

    describe('VQA-05 translations — D-08 strings exist verbatim', () => {
      it('outcomesEmptyAllEyesFilteredTitle has the D-08 DE + EN strings', async () => {
        const mod = await import('../src/i18n/translations');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const table = (mod as any).translations ?? (mod as any).default;
        expect(table.outcomesEmptyAllEyesFilteredTitle).toBeDefined();
        expect(table.outcomesEmptyAllEyesFilteredTitle.en).toBe('No eyes match the current filters.');
        expect(table.outcomesEmptyAllEyesFilteredTitle.de).toBe('Keine Augen entsprechen den aktuellen Filtern.');
      });

      it('outcomesEmptyAllEyesFilteredBody has the D-08 DE + EN strings', async () => {
        const mod = await import('../src/i18n/translations');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const table = (mod as any).translations ?? (mod as any).default;
        expect(table.outcomesEmptyAllEyesFilteredBody).toBeDefined();
        expect(table.outcomesEmptyAllEyesFilteredBody.en).toBe('Adjust the OD/OS or layer toggles to see data.');
        expect(table.outcomesEmptyAllEyesFilteredBody.de).toBe('Passen Sie die OD/OS- oder Layer-Filter an, um Daten zu sehen.');
      });
    });
    ```
  </action>
  <verify>
    <automated>npx vitest run tests/outcomesEmptyState.test.tsx 2>&amp;1 | tail -30 &amp;&amp; npx vitest run tests/outcomesI18n.test.ts 2>&amp;1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/outcomesEmptyState.test.tsx` exits 0
    - `grep -E "describe\('OutcomesEmptyState — all-eyes-filtered variant" tests/outcomesEmptyState.test.tsx` matches
    - `grep -F "No eyes match the current filters." tests/outcomesEmptyState.test.tsx` matches
    - `grep -F "Keine Augen entsprechen den aktuellen Filtern." tests/outcomesEmptyState.test.tsx` matches
    - `grep -E "expect\(container\.querySelector\('a'\)\)\.toBeNull\(\)" tests/outcomesEmptyState.test.tsx` matches
    - `npx vitest run tests/outcomesEmptyState.test.tsx` exits 0 (all 6 tests pass)
    - `npx vitest run tests/outcomesI18n.test.ts` exits 0 (new keys pass existing i18n completeness suite)
  </acceptance_criteria>
  <done>Empty-state + i18n tests green; VQA-05 closed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none) | Client-only presentation change + two new translation entries. No network, no auth, no PII, no new input. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-03-01 | Spoofing | — | N/A | No identity surface. |
| T-10-03-02 | Tampering | translations.ts | accept | New entries are static literals; tests/outcomesI18n.test.ts is the regression gate. |
| T-10-03-03 | Repudiation | — | N/A | No audit surface touched. |
| T-10-03-04 | Information Disclosure | — | N/A | Empty-state copy reveals only generic UI guidance; no PII. |
| T-10-03-05 | Denial of Service | — | N/A | Constant-time branch. |
| T-10-03-06 | Elevation of Privilege | — | N/A | No auth surface. |

Severity summary: **none**.
</threat_model>

<verification>
Maps to ROADMAP Phase 10 Success Criterion #5 (distinct empty-state copy localized DE + EN).

- `npx vitest run tests/outcomesEmptyState.test.tsx` exits 0 (D-07 dispatch + D-08 copy verbatim)
- `npx vitest run tests/outcomesI18n.test.ts` exits 0 (i18n completeness — new keys resolve in both locales + placeholder parity)
- `npx vitest run tests/OutcomesPage.test.tsx` exits 0 (page-level regression: existing tests don't toggle all layers off, so they still render panels)
- `grep -F "outcomesEmptyAllEyesFilteredTitle" src/i18n/translations.ts` matches
- `grep -F "outcomesEmptyAllEyesFilteredBody" src/i18n/translations.ts` matches
- `grep -F "variant=\"all-eyes-filtered\"" src/pages/OutcomesPage.tsx` matches
</verification>

<success_criteria>
- All 4 tasks' acceptance criteria pass.
- VQA-05 closed: three distinct empty-state variants localized DE + EN, dispatch contract tested.
- Existing i18n completeness test still green (no orphan keys, no missing translations).
- Phase regression gate preserved.
</success_criteria>

<output>
After completion, create `.planning/phases/10-visual-ux-qa-preview-stability/10-03-SUMMARY.md` with:
- Whether the OutcomesSettingsDrawer grep revealed a real OD/OS filter (expected: no); if yes, how the dispatch condition was broadened
- Exact copy shipped per D-08 (DE + EN strings) + confirmation of no action-link per D-08
- i18n completeness test delta (went from ~73 keys to ~75 keys)
</output>
</content>
</invoke>