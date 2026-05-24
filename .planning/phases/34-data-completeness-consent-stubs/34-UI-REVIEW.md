---
phase: 34
slug: data-completeness-consent-stubs
audited: 2026-05-24
baseline: 34-UI-SPEC.md
screenshots: not captured (no dev server)
---

# Phase 34 — UI Review

**Audited:** 2026-05-24
**Baseline:** 34-UI-SPEC.md (approved design contract)
**Screenshots:** not captured (no dev server detected on ports 3000, 5173, 8080)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | `datenvollstaendigkeitLabel` key defined but never used — left sub-label "Datenvollzähligkeit" absent from card |
| 2. Visuals | 3/4 | Card layout collapses the spec's two-row label structure; icon/fraction/patients are correct |
| 3. Color | 4/4 | All new markup uses CSS token variables; no hex values; semantic color function correct |
| 4. Typography | 3/4 | Patient sub-label uses `ink-3` instead of spec-required `ink-2`; no out-of-spec sizes in new markup |
| 5. Spacing | 3/4 | No `mt` between KPI tiles row and completeness card; `mb-3.5` only covers below-card gap |
| 6. Experience Design | 4/4 | Loading guard, zero-division guard, ARIA progressbar with valuenow/min/max + aria-label, ShieldCheck aria-hidden |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Missing left sub-label "Datenvollzähligkeit"** — The `datenvollstaendigkeitLabel` i18n key is defined in translations but never called in `LandingPage.tsx`. The spec's label row requires a left element (`text-[12px] text-[var(--color-ink-2)]`) reading "Datenvollzähligkeit" / "Data completeness". Without it the card gives no contextual label below the fraction — users must infer meaning from the caption alone. Fix: add `<span className="text-[12px] text-[var(--color-ink-2)]">{t('datenvollstaendigkeitLabel')}</span>` as the left side of the label row, shifting the patients sub-label to the right with `flex justify-between`.

2. **Patient sub-label color mismatch** — Line 200 uses `text-[var(--color-ink-3)]` for the "N / M patients" span. The spec typography table classifies secondary metric values as the "Label" role (`text-[var(--color-ink-2)]`). Using ink-3 (tertiary, lightest) makes the consented/total count visually subordinate to the progress bar track, reducing readability. Fix: change `text-[var(--color-ink-3)]` to `text-[var(--color-ink-2)]` on line 200.

3. **No vertical gap above the completeness card** — The KPI tiles row (`div.px-8.grid`, line 151) closes at line 173 and the completeness card wrapper (`div.px-8.mb-3.5`, line 176) immediately follows with no top margin. The `mb-3.5` only creates a gap below the card (before the Centers row). The KPI tiles themselves use `gap-3.5` (14px) internally, but the row-to-row transition has no equivalent separation. Fix: add `mt-3.5` to the completeness card wrapper div (line 176): `<div className="px-8 mt-3.5 mb-3.5">`.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

WARNING: `datenvollstaendigkeitLabel` key is defined at `src/i18n/translations.ts:904` (`de: 'Datenvollzähligkeit'`, `en: 'Data completeness'`) but is never referenced in `src/pages/LandingPage.tsx`. The spec's Copywriting Contract (§Card Internal Structure) explicitly declares a label row with left text "Datenvollzähligkeit" using this key. The key is a dead symbol — it was added (Task 1) but the card markup (Task 2) omitted its usage.

Remaining 3 keys are correctly implemented:
- `datenvollstaendigkeitCaption` used at line 191 (DE: `DATENVOLLZÄHLIGKEIT` / EN: `DATA COMPLETENESS`)
- `datenvollstaendigkeitPatients` used at lines 201-203 with correct `.replace('{n}',…).replace('{m}',…)` interpolation
- `datenvollstaendigkeitAriaLabel` used at lines 218-220 with correct `.replace('{pct}',…)` interpolation

All three used keys match the spec's exact DE/EN strings exactly. No generic labels ("Submit", "OK", "Cancel") are present in the new card markup.

### Pillar 2: Visuals (3/4)

WARNING: The spec defines a card internal structure of four distinct layers:
1. Icon container (w-8 h-8, teal-soft bg) — ShieldCheck icon
2. Fraction display ("21 %") — 32px semibold mono
3. **Label row**: left "Datenvollzähligkeit" (12px ink-2), right "N / M Patienten" (11px ink-3)
4. Progress bar

The implementation collapses layers 2 and 3 into a single `flex items-baseline gap-3` row containing the fraction and the patients sub-label side by side, rather than the spec's two-row layout (fraction on its own row above the label row). The left label element is entirely absent (see Pillar 1). This reduces the label density and visual hierarchy slightly — the card works but the information architecture deviates from the contract.

What matches the spec:
- `w-8 h-8 rounded-lg` icon container with `background: var(--color-teal-soft)` — correct
- `ShieldCheck` icon at `w-4 h-4` with `color: var(--color-teal)` — correct
- Caption at 11px / semibold / uppercase / tracking-[0.12em] / ink-3 — correct (`LandingPage.tsx:190`)
- 32px / semibold / font-data fraction display — correct (`LandingPage.tsx:195`)
- Progress bar `h-1.5 rounded-full` with `bg-[var(--color-teal-soft)]` track — correct (`LandingPage.tsx:207`)
- Full-width row placement between KPI tiles and Centers row — correct (`LandingPage.tsx:175-228`)

### Pillar 3: Color (4/4)

All new markup uses CSS token variables exclusively. No hardcoded hex values detected in `src/pages/LandingPage.tsx` (confirmed by grep — 0 hex matches, 50 `var(--color-*)` usages).

The `completenessColor()` helper at lines 31-35 correctly uses:
- `var(--color-sage)` for fraction >= 0.50
- `var(--color-amber)` for fraction >= 0.25
- `var(--color-coral)` for fraction < 0.25

This matches the spec's fraction color rule exactly.

Accent (teal) usage: icon container background (`var(--color-teal-soft)`) and icon stroke (`var(--color-teal)`) — strictly scoped to the card icon pair as specified. Teal is not leaked onto any other new element.

The 60/30/10 distribution is maintained: canvas dominates, surface/surface-2 for tiles, teal accent is one icon pair.

### Pillar 4: Typography (3/4)

New card markup uses these sizes: 11px (caption), 32px (display), 12px (patient sub-label).

**Match:**
- Caption: `text-[11px] font-semibold tracking-[0.12em] uppercase` — matches spec Caption role exactly (`LandingPage.tsx:190`)
- Display: `text-[32px] font-semibold tracking-[-0.03em] font-data` — matches spec Display role exactly (`LandingPage.tsx:195`)

**Mismatch:**
- Patient sub-label: `text-[12px] text-[var(--color-ink-3)]` at line 200. The spec typography table defines "Label" as 12px / 400 / 1.4 with `text-[var(--color-ink-2)]`. The size (12px) matches but the color token is ink-3 (tertiary) instead of ink-2 (secondary). The spec layout diagram notes "11px ink-3" for the right sub-label, but the spec typography table — which governs new markup — classifies secondary metric values as the Label role = 12px ink-2. The color deviation is the actionable finding.

No out-of-spec font sizes introduced in new card markup. The pre-existing page text sizes (10px, 13px, 14px, 15px, 28px) are excluded from this contract by the spec's scoping clause.

Font weights in new card: `font-semibold` only (caption and fraction). Correct — no `font-bold` or additional weights introduced.

### Pillar 5: Spacing (3/4)

New card spacing analysis (lines 176-227):

| Element | Applied | Spec | Status |
|---------|---------|------|--------|
| Card wrapper vertical gap above | none (`mb-3.5` only) | should match `gap-3.5` (14px) from KPI row pattern | MISS |
| Card wrapper bottom margin | `mb-3.5` (14px) | sufficient (matches KPI grid gap) | OK |
| Icon-content flex gap | `gap-4` (16px = md) | md (16px) | OK |
| Caption bottom margin | `mb-1` (4px = xs) | xs (4px) | OK |
| Fraction+patients flex gap | `gap-3` (12px) | not specified; reasonable | OK |
| Progress bar top margin | `mt-2` (8px = sm) | sm (8px) | OK |
| Tile padding | `p-[18px_18px_14px]` | inherited from Tile primitive (spec exclusion clause) | OK (excluded) |

The gap-above issue: the KPI tiles grid closes at line 173, then the completeness card wrapper at line 176 begins with `px-8 mb-3.5` — no `mt` or `mt-3.5`. The existing KPI tiles grid uses `gap-3.5` to separate tiles, but no equivalent separation exists between the KPI row and the completeness row. The visual result is the card visually "merges" with the KPI tile row — the page reader gets no breathing room to distinguish them as separate sections.

No arbitrary `[Npx]` or `[Nrem]` spacing values introduced in new card markup. All spacing values map to declared scale tokens.

### Pillar 6: Experience Design (4/4)

All required states are handled:

**Loading state:** `if (loading) { return <div>…{t('dataLoading')}</div> }` at line 44-49 — the completeness card is inside the loading guard, so it is never rendered while data is absent. Inherits the full-page loader correctly as specified.

**Zero-fraction state:** `const completenessFraction = totalRawPatients > 0 ? consentedPatients / totalRawPatients : 0` at line 69-70 — explicit zero-division guard. Progress bar fills to `Math.min(completenessPercent, 100)%` = `Math.min(0, 100)%` = 0%, and `completenessColor(0)` returns `var(--color-coral)` (< 0.25 branch). No crash. Correct.

**Accessibility:**
- `ShieldCheck` has `aria-hidden="true"` at line 184 — decorative icon correctly hidden from AT
- Progress bar has `role="progressbar"` with `aria-valuenow={completenessPercent}`, `aria-valuemin={0}`, `aria-valuemax={100}`, and `aria-label` from the `datenvollstaendigkeitAriaLabel` key with `{pct}` interpolated — full ARIA compliance
- Card is read-only; no interactive elements requiring keyboard focus management

**Tests:** `tests/datenvollstaendigkeitCard.test.tsx` — 7/7 tests green. Tests cover: LandingPage renders without crash, card caption presence (`DATA COMPLETENESS`), percentage display (`70 %` for 7/10), patients sub-label (`7 / 10 patients`), ShieldCheck aria-hidden, progressbar role with aria-valuenow. No `it.skip` markers remain. Fraction-reactivity is implicitly tested via the 70% case.

---

## Registry Safety

Registry audit: no shadcn (`components.json` absent). No third-party registries. Not applicable.

---

## Files Audited

- `src/pages/LandingPage.tsx` — primary implementation (full file, 380 lines)
- `src/i18n/translations.ts` — 4 datenvollstaendigkeit keys (lines 903-906)
- `tests/datenvollstaendigkeitCard.test.tsx` — card test file (198 lines)
- `.planning/phases/34-data-completeness-consent-stubs/34-UI-SPEC.md` — design contract
- `.planning/phases/34-data-completeness-consent-stubs/34-04-SUMMARY.md` — execution summary
- `.planning/phases/34-data-completeness-consent-stubs/34-04-PLAN.md` — plan specification
- `.planning/phases/34-data-completeness-consent-stubs/34-CONTEXT.md` — locked decisions
