---
phase: 10-visual-ux-qa-preview-stability
plan: 02b
type: execute
wave: 3
depends_on: ["10-01", "10-02a"]
files_modified:
  - src/components/outcomes/OutcomesTooltip.tsx
  - src/components/outcomes/OutcomesPanel.tsx
  - tests/outcomesTooltip.test.tsx
autonomous: true
requirements: [VQA-04]
requirements_addressed: [VQA-04]

must_haves:
  truths:
    - "OutcomesTooltip receives a `layers` prop and SUPPRESSES per-patient entries by filtering the Recharts payload when `layers.perPatient === false`."
    - "OutcomesTooltip renders fields in D-05 order: pseudonym → eye (uppercase) → x-value with unit (`{n} d` for days, `#{n}` for treatments) → y-value with metric-appropriate unit (`logMAR`, `Δ logMAR`, `%`) — all numbers formatted via `Intl.NumberFormat(locale)`."
    - "OutcomesPanel.tsx passes `layers={layers}` into OutcomesTooltip and augments per-patient Line data with a synthetic `__series: 'perPatient'` marker + `pseudonym` field so the tooltip can filter + display D-05 content."
  artifacts:
    - path: "src/components/outcomes/OutcomesTooltip.tsx"
      provides: "D-05 field order, D-06 per-patient suppression, `layers` prop"
      contains: "layers.perPatient"
    - path: "src/components/outcomes/OutcomesPanel.tsx"
      provides: "layers prop threaded to Tooltip + __series marker injection"
      contains: "__series: 'perPatient'"
    - path: "tests/outcomesTooltip.test.tsx"
      provides: "D-05 format + D-06 suppression tests"
      contains: "describe('OutcomesTooltip"
  key_links:
    - from: "src/components/outcomes/OutcomesPanel.tsx"
      to: "src/components/outcomes/OutcomesTooltip.tsx"
      via: "Tooltip content prop with `layers={layers}`"
      pattern: "<OutcomesTooltip[\\s\\S]*?layers=\\{layers\\}"
    - from: "tests/outcomesTooltip.test.tsx"
      to: "src/components/outcomes/OutcomesTooltip.tsx"
      via: "direct render with controlled payload + layers prop"
      pattern: "layers=\\{perPatientOff\\}|layers=\\{allLayersOn\\}"
---

<objective>
Close VQA-04 (tooltip D-05 content + D-06 per-patient suppression) with surgical edits to the tooltip + panel and a new dedicated test file.

Purpose: Upgrade the tooltip to show D-05's field order with localized units and implement D-06 suppression via payload filtering inside the tooltip component (not by unmounting it).

Output:
- Extend `OutcomesTooltip.tsx` Props with `layers` + filter payload; reorder JSX per D-05.
- Inject `__series: 'perPatient'` marker + `pseudonym` into per-patient Line data in `OutcomesPanel.tsx`; pass `layers={layers}` to Tooltip.
- Add `tests/outcomesTooltip.test.tsx` (D-05 format + D-06 suppression).
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
@src/components/outcomes/OutcomesTooltip.tsx
@tests/cohortTrajectory.test.ts
@tests/OutcomesPage.test.tsx

<interfaces>
<!-- Extracted from source 2026-04-16 -->

From src/components/outcomes/OutcomesTooltip.tsx (current Props, lines 11-18):
```typescript
interface Props {
  active?: boolean;
  payload?: PayloadEntry[];
  yMetric: YMetric;
  axisMode: AxisMode;
  t: (key: string) => string;
  locale: 'de' | 'en';
}
```
Must add:
```typescript
layers: { median: boolean; perPatient: boolean; scatter: boolean; spreadBand: boolean };
```

From src/components/outcomes/OutcomesPanel.tsx:150-165 (per-patient Line):
Currently `<Line data={p.measurements} ... />` — `Measurement` objects carry `eye`, `x`, `y`, `date` but NOT `pseudonym` (pseudonym lives on the parent `PatientSeries.pseudonym`). Must map measurements to include `__series: 'perPatient'` AND `pseudonym: p.pseudonym` so the tooltip payload can both (a) be identified as per-patient (for D-06 filter) and (b) display the pseudonym (D-05 first field).

From src/components/outcomes/OutcomesTooltip.tsx:62 (isMedian heuristic):
`const isMedian = first.dataKey === 'y' && pseudo === '';` — median path. The per-patient/scatter path is the `else` branch. D-06 filter runs BEFORE `first = filtered[0]` derivation; if filtering drops everything, return null.

Metric → y-unit mapping (D-05):
- `yMetric === 'absolute'` → `logMAR`
- `yMetric === 'delta'` → `Δ logMAR`
- `yMetric === 'delta_percent'` → `%`

Axis → x-unit mapping (D-05):
- `axisMode === 'days'` → `"{n} d"` (e.g., `"42 d"`)
- `axisMode === 'treatments'` → `"#{n}"` (e.g., `"#3"`)

Panel-level Tooltip mount (OutcomesPanel.tsx:126-135): `layers` is already in scope as a prop; just pass it through:
```tsx
<OutcomesTooltip yMetric={yMetric} axisMode={axisMode} layers={layers} t={t} locale={locale} />
```
</interfaces>

<scope_note>
This plan depends on 10-02a (both touch the same sequence of concerns on OutcomesPanel — 10-02a's DOM test renders the panel, and this plan edits the panel's Tooltip + per-patient Line data. The ordering protects the panel rendering path from interleaved edits). Plan 10-01's SERIES_STYLES refactor must also have landed before this plan — the per-patient `<Line>` `strokeWidth` / `strokeOpacity` literals have been replaced with `SERIES_STYLES.perPatient.*` references; this plan only mutates the `data={...}` prop, so the two edits compose cleanly. Preserve both sets of changes on merge.
</scope_note>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend OutcomesTooltip.tsx with `layers` prop, D-05 formatting, D-06 suppression</name>
  <files>src/components/outcomes/OutcomesTooltip.tsx</files>
  <read_first>
    - src/components/outcomes/OutcomesTooltip.tsx (entire file — understand isMedian branch + fmtNum helper)
    - src/utils/cohortTrajectory.ts (AxisMode, YMetric types)
    - .planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md §Tooltip (D-05, D-06)
  </read_first>
  <behavior>
    - Props interface adds required `layers: { median: boolean; perPatient: boolean; scatter: boolean; spreadBand: boolean }`.
    - Immediately after the existing `if (!active || !payload || payload.length === 0) return null;`, apply D-06 filter:
      ```typescript
      const filtered = layers.perPatient
        ? payload
        : payload.filter((e) => (e.payload as Record<string, unknown> | undefined)?.__series !== 'perPatient');
      if (filtered.length === 0) return null;
      ```
      Replace the subsequent `const first = payload[0];` with `const first = filtered[0];`.
    - D-05 x-value formatting via a new local helper:
      ```typescript
      const xDisplay = axisMode === 'days'
        ? `${fmtNum(xValue, 0)} d`
        : `#${fmtNum(xValue, 0)}`;
      ```
      Replace the two existing `{xLabel}: {fmtNum(xValue, 0)}` lines (median branch + per-patient branch) with `{xLabel}: {xDisplay}`.
    - D-05 y-unit via a new local helper:
      ```typescript
      const yUnit = yMetric === 'absolute' ? 'logMAR' : yMetric === 'delta' ? 'Δ logMAR' : '%';
      ```
      Replace the per-patient branch's `{fmtNum(logmar)}` line with `{fmtNum(logmar)} {yUnit}` appended.
    - `fmtNum` continues to call `new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n)` — no change.
    - Median branch keeps existing IQR line; no D-05 shape change required there (pseudonym is intentionally absent for median).
  </behavior>
  <action>
    Make the following edits in `src/components/outcomes/OutcomesTooltip.tsx`:

    Step 1: Extend the `Props` interface (lines 11-18) by adding the `layers` field (keep alphabetical order below `locale` — or place it adjacent to `axisMode` for grouping; the exact ordering is indifferent as long as it exists):
    ```typescript
    interface Props {
      active?: boolean;
      payload?: PayloadEntry[];
      yMetric: YMetric;
      axisMode: AxisMode;
      layers: { median: boolean; perPatient: boolean; scatter: boolean; spreadBand: boolean };
      t: (key: string) => string;
      locale: 'de' | 'en';
    }
    ```

    Step 2: Update the default export signature to destructure `layers`:
    ```typescript
    export default function OutcomesTooltip({
      active,
      payload,
      yMetric,
      axisMode,
      layers,
      t,
      locale,
    }: Props) {
    ```

    Step 3: Insert D-06 filter RIGHT AFTER the existing `if (!active || !payload || payload.length === 0) return null;` line (the current line 28), then replace the subsequent `const first = payload[0];` with `const first = filtered[0];`:
    ```typescript
      if (!active || !payload || payload.length === 0) return null;

      // D-06: when the per-patient layer is off, suppress per-patient tooltip entries.
      const filtered = layers.perPatient
        ? payload
        : payload.filter(
            (e) =>
              (e.payload as Record<string, unknown> | undefined)?.__series !== 'perPatient',
          );
      if (filtered.length === 0) return null;

      const first = filtered[0];
      const raw = (first.payload ?? {}) as Record<string, unknown>;
    ```

    Step 4: Add the D-05 formatting helpers just BEFORE the `return (` statement (around line 69):
    ```typescript
      // D-05: x-value formatting — "{n} d" for days, "#{n}" for treatments.
      const xDisplay =
        axisMode === 'days' ? `${fmtNum(xValue, 0)} d` : `#${fmtNum(xValue, 0)}`;

      // D-05: y-unit string — metric-specific.
      const yUnit: string =
        yMetric === 'absolute' ? 'logMAR' : yMetric === 'delta' ? 'Δ logMAR' : '%';
    ```

    Step 5: In the median branch JSX (currently lines 71-91), replace:
    ```tsx
      <div className="text-xs text-gray-500">
        {xLabel}: {fmtNum(xValue, 0)}
      </div>
    ```
    with:
    ```tsx
      <div className="text-xs text-gray-500">
        {xLabel}: {xDisplay}
      </div>
    ```

    Step 6: In the per-patient/scatter branch (currently lines 92-123), replace:
    ```tsx
      <div className="text-xs text-gray-500">
        {xLabel}: {fmtNum(xValue, 0)}
      </div>
      {logmar !== null && (
        <div className="text-xs text-gray-500">
          {t('outcomesTooltipLogmar')}: {fmtNum(logmar)}
        </div>
      )}
    ```
    with:
    ```tsx
      <div className="text-xs text-gray-500">
        {xLabel}: {xDisplay}
      </div>
      {logmar !== null && (
        <div className="text-xs text-gray-500">
          {t('outcomesTooltipLogmar')}: {fmtNum(logmar)} {yUnit}
        </div>
      )}
    ```

    No other change is needed — Tailwind chrome (background/border/shadow) stays; snellen/clipped/sparse lines stay.
  </action>
  <verify>
    <automated>npm run typecheck 2>&amp;1 | tail -10</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "layers: \{ median: boolean; perPatient: boolean; scatter: boolean; spreadBand: boolean \}" src/components/outcomes/OutcomesTooltip.tsx` matches
    - `grep -E "__series !== 'perPatient'" src/components/outcomes/OutcomesTooltip.tsx` matches
    - `grep -E "const filtered = layers\.perPatient" src/components/outcomes/OutcomesTooltip.tsx` matches
    - `grep -E "const first = filtered\[0\];" src/components/outcomes/OutcomesTooltip.tsx` matches
    - `grep -E "const xDisplay =" src/components/outcomes/OutcomesTooltip.tsx` matches
    - `grep -E "axisMode === 'days' \? .\\$\{fmtNum\(xValue, 0\)\} d. : .#\\$\{fmtNum\(xValue, 0\)\}." src/components/outcomes/OutcomesTooltip.tsx` matches (OR equivalent — template literals with `d` and `#`)
    - `grep -E "'logMAR'" src/components/outcomes/OutcomesTooltip.tsx` matches
    - `grep -E "'Δ logMAR'" src/components/outcomes/OutcomesTooltip.tsx` matches
    - `grep -E "Intl\.NumberFormat\(locale" src/components/outcomes/OutcomesTooltip.tsx` matches (fmtNum preserved)
    - `npm run typecheck` exits 0
  </acceptance_criteria>
  <done>Tooltip has D-05 field order + D-06 filter; TypeScript compiles.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire layers + inject __series/pseudonym markers in OutcomesPanel.tsx</name>
  <files>src/components/outcomes/OutcomesPanel.tsx</files>
  <read_first>
    - src/components/outcomes/OutcomesPanel.tsx (entire file — especially Tooltip mount at lines 126-135 and per-patient Line at lines 150-165; confirm Plan 10-01's SERIES_STYLES refactor has landed if it did — this task's edits are independent and composable)
    - src/components/outcomes/OutcomesTooltip.tsx (the updated file from Task 1)
  </read_first>
  <behavior>
    - The `<Tooltip content={<OutcomesTooltip ... />}>` element passes `layers={layers}` into OutcomesTooltip.
    - The per-patient `<Line data={...}>` call maps `p.measurements` into `{...m, __series: 'perPatient', pseudonym: p.pseudonym}` so the tooltip payload can (a) be filtered (D-06) and (b) display the pseudonym (D-05 first field).
    - No other chart series (Area, Scatter, median Line) carries `__series` — only per-patient gets the marker; absence of the marker is how scatter/median bypass the D-06 filter.
  </behavior>
  <action>
    Make the following edits in `src/components/outcomes/OutcomesPanel.tsx`:

    Step 1: Locate the Tooltip mount (currently lines 126-135):
    ```tsx
          <Tooltip
            content={
              <OutcomesTooltip
                yMetric={yMetric}
                axisMode={axisMode}
                t={t}
                locale={locale}
              />
            }
          />
    ```
    Add `layers={layers}`:
    ```tsx
          <Tooltip
            content={
              <OutcomesTooltip
                yMetric={yMetric}
                axisMode={axisMode}
                layers={layers}
                t={t}
                locale={locale}
              />
            }
          />
    ```

    Step 2: Locate the per-patient Line render (currently lines 150-165):
    ```tsx
          {layers.perPatient &&
            panel.patients
              .filter((p) => !p.excluded && p.measurements.length >= 2)
              .map((p) => (
                <Line
                  key={p.id}
                  data={p.measurements}
                  dataKey="y"
                  type="linear"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={p.sparse ? 0.3 : 0.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
    ```
    Replace the `data={p.measurements}` prop so each measurement carries `__series` + `pseudonym`:
    ```tsx
          {layers.perPatient &&
            panel.patients
              .filter((p) => !p.excluded && p.measurements.length >= 2)
              .map((p) => (
                <Line
                  key={p.id}
                  data={p.measurements.map((m) => ({
                    ...m,
                    __series: 'perPatient' as const,
                    pseudonym: p.pseudonym,
                  }))}
                  dataKey="y"
                  type="linear"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={p.sparse ? 0.3 : 0.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
    ```

    Note: if Plan 10-01 landed first, the `strokeWidth` and `strokeOpacity` literals have already been replaced with `SERIES_STYLES.perPatient.*` references; that is compatible — only the `data={...}` attribute on the `<Line>` changes here, the style attributes are untouched by this edit. If there is any merge conflict, preserve both sets of changes: SERIES_STYLES references AND the `.map` data augmentation.

    Do NOT touch median `<Line>`, IQR `<Area>`, or `<Scatter>` — leave their `data` props unchanged.
  </action>
  <verify>
    <automated>npm run typecheck 2>&amp;1 | tail -10 &amp;&amp; grep -n "__series" src/components/outcomes/OutcomesPanel.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "layers=\{layers\}" src/components/outcomes/OutcomesPanel.tsx` matches
    - `grep -E "__series: 'perPatient' as const" src/components/outcomes/OutcomesPanel.tsx` matches
    - `grep -E "pseudonym: p\.pseudonym" src/components/outcomes/OutcomesPanel.tsx` matches
    - `grep -E "p\.measurements\.map\(\(m\) =>" src/components/outcomes/OutcomesPanel.tsx` matches
    - `npm run typecheck` exits 0
    - `npx vitest run tests/OutcomesPage.test.tsx` exits 0 (existing panel regression gate)
  </acceptance_criteria>
  <done>Panel wires layers + injects __series marker; panel tests still green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add tests/outcomesTooltip.test.tsx (D-05 format + D-06 suppression)</name>
  <files>tests/outcomesTooltip.test.tsx</files>
  <read_first>
    - src/components/outcomes/OutcomesTooltip.tsx (the updated component from Task 1)
    - tests/cohortTrajectory.test.ts (RTL + Vitest style reference)
    - tests/OutcomesPage.test.tsx (existing translation stub pattern)
  </read_first>
  <behavior>
    - Test 1 — absolute / days: per-patient payload `{pseudonym: 'P001', eye: 'od', x: 42, y: 0.12, logmar: 0.12, __series: 'perPatient'}`, `yMetric='absolute'`, `axisMode='days'`, all layers on → text contains `P001`, `OD`, matches `/42\s*d/`, contains `0.12`, contains `logMAR`.
    - Test 2 — delta_percent / treatments: payload x=3, y=-15.5, `yMetric='delta_percent'`, `axisMode='treatments'`, all layers on → text contains `#3` and `%`.
    - Test 3 — delta / days: payload logmar=-0.2, `yMetric='delta'` → text contains `Δ logMAR`.
    - Test 4 — D-06 suppression: only per-patient payload entry, `layers.perPatient=false` → `container.firstChild` is `null`.
    - Test 5 — D-06 non-suppression of median: median entry (no `__series`, has `n`/`p25`/`p75`), `layers.perPatient=false` → renders and shows `Median` content.
  </behavior>
  <action>
    Create `tests/outcomesTooltip.test.tsx`:

    ```typescript
    // @vitest-environment jsdom
    /**
     * VQA-04 / D-05 / D-06: OutcomesTooltip field order + per-patient suppression.
     */
    import { describe, expect, it, afterEach } from 'vitest';
    import { render, cleanup } from '@testing-library/react';

    import OutcomesTooltip from '../src/components/outcomes/OutcomesTooltip';

    afterEach(() => cleanup());

    const t = (k: string) => {
      const map: Record<string, string> = {
        outcomesTooltipDay: 'Day',
        outcomesTooltipTreatmentIndex: 'Treatment',
        outcomesTooltipEye: 'Eye',
        outcomesTooltipLogmar: 'logMAR',
        outcomesTooltipMedian: 'Median (n={n})',
        outcomesTooltipSnellen: 'Snellen',
        outcomesTooltipIqr: 'IQR [{p25}, {p75}]',
        outcomesTooltipClipped: 'clipped',
        outcomesTooltipSparse: 'sparse',
      };
      return map[k] ?? k;
    };

    const allLayersOn = { median: true, perPatient: true, scatter: true, spreadBand: true };
    const perPatientOff = { median: true, perPatient: false, scatter: true, spreadBand: true };

    describe('OutcomesTooltip — D-05 field order + units', () => {
      it('absolute / days: pseudonym, eye OD, "42 d", "0.12", "logMAR"', () => {
        const { container } = render(
          <OutcomesTooltip
            active
            payload={[
              {
                dataKey: 'y',
                value: 0.12,
                payload: {
                  pseudonym: 'P001',
                  eye: 'od',
                  x: 42,
                  y: 0.12,
                  logmar: 0.12,
                  __series: 'perPatient',
                },
              } as any,
            ]}
            yMetric="absolute"
            axisMode="days"
            layers={allLayersOn}
            t={t}
            locale="en"
          />,
        );
        const text = container.textContent ?? '';
        expect(text).toContain('P001');
        expect(text.toUpperCase()).toContain('OD');
        expect(text).toMatch(/42\s*d/);
        expect(text).toContain('0.12');
        expect(text).toContain('logMAR');
      });

      it('delta_percent / treatments: shows "#3" and "%"', () => {
        const { container } = render(
          <OutcomesTooltip
            active
            payload={[
              {
                dataKey: 'y',
                value: -15.5,
                payload: {
                  pseudonym: 'P002',
                  eye: 'os',
                  x: 3,
                  y: -15.5,
                  logmar: -15.5,
                  __series: 'perPatient',
                },
              } as any,
            ]}
            yMetric="delta_percent"
            axisMode="treatments"
            layers={allLayersOn}
            t={t}
            locale="en"
          />,
        );
        const text = container.textContent ?? '';
        expect(text).toContain('#3');
        expect(text).toContain('%');
      });

      it('delta / days: y-unit is "Δ logMAR"', () => {
        const { container } = render(
          <OutcomesTooltip
            active
            payload={[
              {
                dataKey: 'y',
                value: -0.2,
                payload: {
                  pseudonym: 'P003',
                  eye: 'od',
                  x: 60,
                  y: -0.2,
                  logmar: -0.2,
                  __series: 'perPatient',
                },
              } as any,
            ]}
            yMetric="delta"
            axisMode="days"
            layers={allLayersOn}
            t={t}
            locale="en"
          />,
        );
        const text = container.textContent ?? '';
        expect(text).toContain('Δ logMAR');
      });
    });

    describe('OutcomesTooltip — D-06 per-patient suppression', () => {
      it('renders null when layers.perPatient=false and payload has only per-patient entries', () => {
        const { container } = render(
          <OutcomesTooltip
            active
            payload={[
              {
                dataKey: 'y',
                value: 0.12,
                payload: {
                  pseudonym: 'P001',
                  eye: 'od',
                  x: 42,
                  y: 0.12,
                  logmar: 0.12,
                  __series: 'perPatient',
                },
              } as any,
            ]}
            yMetric="absolute"
            axisMode="days"
            layers={perPatientOff}
            t={t}
            locale="en"
          />,
        );
        expect(container.firstChild).toBeNull();
      });

      it('still shows median tooltip when layers.perPatient=false and payload contains a median entry', () => {
        const { container } = render(
          <OutcomesTooltip
            active
            payload={[
              {
                dataKey: 'y',
                value: 0.2,
                payload: { x: 60, y: 0.2, p25: 0.1, p75: 0.3, n: 5 },
              } as any,
            ]}
            yMetric="absolute"
            axisMode="days"
            layers={perPatientOff}
            t={t}
            locale="en"
          />,
        );
        const text = container.textContent ?? '';
        expect(text).toContain('Median');
      });
    });
    ```
  </action>
  <verify>
    <automated>npx vitest run tests/outcomesTooltip.test.tsx 2>&amp;1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/outcomesTooltip.test.tsx` exits 0
    - `grep -E "describe\('OutcomesTooltip — D-05 field order" tests/outcomesTooltip.test.tsx` matches
    - `grep -E "describe\('OutcomesTooltip — D-06 per-patient suppression" tests/outcomesTooltip.test.tsx` matches
    - `grep -E "expect\(container\.firstChild\)\.toBeNull\(\)" tests/outcomesTooltip.test.tsx` matches
    - `grep -E "__series: 'perPatient'" tests/outcomesTooltip.test.tsx` matches (at least 3 occurrences: Tests 1, 2, 3, 4)
    - `grep -E "Δ logMAR" tests/outcomesTooltip.test.tsx` matches
    - `npx vitest run tests/outcomesTooltip.test.tsx` exits 0 (all 5 tests pass)
    - `npx vitest run tests/OutcomesPage.test.tsx` exits 0 (regression gate)
  </acceptance_criteria>
  <done>Tooltip format + suppression tests green; VQA-04 closed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none) | All changes are client-side presentation. Patient pseudonym was already displayed in the tooltip pre-Phase 10 (OutcomesTooltip.tsx:94 existing line); no new disclosure boundary. `__series` is a synthetic marker, never persisted, never sent to server. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-02b-01 | Spoofing | — | N/A | No identity surface. |
| T-10-02b-02 | Tampering | OutcomesPanel per-patient data augmentation | accept | Client-side transform; no persistence. `tests/OutcomesPage.test.tsx` regression gate preserved. |
| T-10-02b-03 | Repudiation | — | N/A | No audit surface touched. |
| T-10-02b-04 | Information Disclosure | tooltip pseudonym field | accept | Pre-existing display; no change to disclosure boundary. D-05 preserves the same field. |
| T-10-02b-05 | Denial of Service | OutcomesPanel `.map` augmentation | accept | Linear in per-patient measurement count; dominated by existing filter/map work. |
| T-10-02b-06 | Elevation of Privilege | — | N/A | No auth surface. |

Severity summary: **none**. No high-severity threats.
</threat_model>

<verification>
Maps to ROADMAP Phase 10 Success Criterion #4 (tooltip D-05 content + D-06 suppression).

- `npx vitest run tests/outcomesTooltip.test.tsx` exits 0 (D-05 + D-06)
- `npx vitest run tests/OutcomesPage.test.tsx` exits 0 (panel regression gate — Tooltip `layers` prop wiring must not break existing OutcomesPage tests; if it does because existing tests call `<OutcomesTooltip>` without `layers`, update those call sites in the same task)
- `grep -E "layers=\{layers\}" src/components/outcomes/OutcomesPanel.tsx` matches
- `grep -E "__series: 'perPatient'" src/components/outcomes/OutcomesPanel.tsx` matches
</verification>

<success_criteria>
- All 3 tasks' acceptance criteria pass.
- VQA-04 closed: D-05 format + D-06 suppression verified.
- Phase regression gate preserved (313/313 + new tests).
</success_criteria>

<output>
After completion, create `.planning/phases/10-visual-ux-qa-preview-stability/10-02b-SUMMARY.md` noting:
- Whether OutcomesPage.test.tsx needed a `layers` prop update at any OutcomesTooltip call site (and, if so, which)
- Interaction with Plan 10-01 (both touch OutcomesPanel.tsx): note merge resolution around per-patient `<Line>` (SERIES_STYLES references from 10-01 vs `.map(...)` data augmentation here must co-exist)
- Sequencing with 10-02a (both touch the cohortTrajectory / OutcomesPanel rendering path): confirm the IQR guard from 10-02a is in place before DOM-test assertions evaluated here
</output>
</content>
