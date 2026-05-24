# Phase 33: Cohort Builder UX & Advanced Filters - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden and extend the cohort builder UX along four axes:
1. **COH-01** — plausibility validation on the filter inputs (age lower≤upper, Visus 0–1, reject negative/non-numeric on age/Visus/CRT) with inline errors that block saving.
2. **COH-02** — persist filter state across navigation for the session (client-side), with the existing Reset control.
3. **COH-03** — four issue-based presets selectable in the cohort builder (Therapie-Abbrecher, Unplausible CRT-Werte, Flagged data-quality cases, Implausible Visus).
4. **COH-04** — an advanced filter dialog exposing a curated additional-attribute set.
5. **DASH-02** — fix the dashboard "Attention needed" Review buttons so each lands where its label promises.

**In scope:** input validation in `CohortBuilderPage`; sessionStorage-backed filter persistence + logout clear; predicate-based preset filters in the cohort builder; an advanced-filter dialog with a curated attribute set; correcting the two `LandingPage` Attention Review button destinations (incl. a new CRT-specific Quality filter).

**Out of scope:** server-side filter persistence; a formal `/gsd-spike` ceremony for COH-04 (decision recorded inline instead — see D-12); new backend tables; DASH-01 (stubs/consent — Phase 34); changing the saved-search/subcohort model from Phase 31.
</domain>

<decisions>
## Implementation Decisions

### Input validation (COH-01)
- **D-01:** Invalid input shows an **inline per-field error** and **blocks the Save Cohort action** (button disabled), consistent with the Phase 31 inline-under-field validation pattern. This replaces today's silent clamping (`Math.max(0, Number(...) || default)`).
- **D-02:** The **manual Visus filter fields are constrained to 0–1**: a value >1 shows an inline error. The "Implausible Visus" preset (which must find values >1) does **not** use the manual range field — it uses a separate predicate (see D-07). Age lower>upper, and negative/non-numeric on age/Visus/CRT, are also inline errors.
- **D-03:** When a field holds an invalid value, the **live results list keeps updating from the valid filters** — the invalid field is simply not applied. Only Save is blocked; results never freeze.

### Filter persistence (COH-02)
- **D-04:** Filter state is persisted in **`sessionStorage`** (survives in-app navigation AND full page reload within the tab; cleared when the tab closes). Chosen over in-memory React context specifically for reload survival.
- **D-05:** Persisted filter state is **cleared on logout** (security-first — next user on the same browser starts clean). The existing Reset control (`setFilters({})`) continues to clear filters on demand.
- **D-06:** Persistence covers the full filter object including the advanced-dialog attributes (D-11). Serialization must round-trip the `CohortFilter` shape (and any advanced extension).

### Presets + dashboard routing (COH-03 / DASH-02)
- **D-07:** All four presets live as **one-click preset buttons in the cohort builder**. They are **ephemeral applied filters** — clicking a preset applies its filter to the builder live; the user may then Save manually. Presets do NOT auto-create SavedSearch entries.
- **D-08:** Presets require **predicate semantics the range-only `CohortFilter` cannot express**, so the filter engine (`shared/patientCases.ts applyFilters`) must be extended with preset predicates: Therapie-Abbrecher (IVI-gap > `therapyBreakerDays`), Unplausible CRT (outside the CRT clinical threshold), Flagged data-quality cases (has an open `QualityFlag`), Implausible Visus (latest Visus outside 0–1). Reuse the therapy-status logic already in `QualityPage` (`computeTherapyStatus`) rather than duplicating it.
- **D-09 (DASH-02):** The **dashboard Review buttons route to the Quality review surface**, NOT the cohort-builder presets — these buttons serve a data-quality *review* intent. Therapie-Abbrecher button keeps `/quality?therapy=breaker` (correct today). The **Implausible CRT button** must stop routing to `/quality?status=flagged` (the bug) and instead route to a **new CRT-specific Quality filter** (e.g. `/quality?crt=implausible`), which `QualityPage` must learn to seed. Each button lands where its label promises.

### Advanced dialog (COH-04)
- **D-10:** **Decide now — curated attribute set** (no formal spike). The advanced dialog exposes a curated set rather than rolling all data-model fields; full-field exposure is rejected as poor UX over the nested FHIR resource shapes.
- **D-11:** Curated attribute set = **diagnosis subtype, comorbidities, HbA1c, drug/agent, laterality** (all five confirmed). These extend the filter model beyond the current `{diagnosis, gender, ageRange, visusRange, crtRange, centers}`.
- **D-12 (records the COH-04 "spike outcome"):** COH-04's success criterion requires the full-field-vs-curated outcome be "recorded as a decision." That decision is **recorded here as D-10/D-11** in lieu of a separate spike artifact — the recorded rationale (nested FHIR fields make generic full-field UX poor; curated 5-field set covers the clinically meaningful axes) satisfies the "recorded as a decision" requirement.

### Claude's Discretion
- Exact DE/EN i18n strings for preset labels, validation messages, and advanced-dialog field labels (follow `t()` + `src/i18n/translations.ts` patterns).
- The concrete `sessionStorage` key name and serialization format.
- Where the CRT clinical threshold value is sourced (locate the existing CRT-implausibility threshold; `therapyBreakerDays: 365` and `therapyInterrupterDays: 120` are in `config/settings.yaml`).
- AND/OR combination semantics within the advanced dialog (default to AND, consistent with existing filters, unless research surfaces a reason otherwise).
- Visual layout of the advanced dialog (modal vs expandable panel) — defer to UI-SPEC.
- How preset predicates are typed/added to `CohortFilter` vs a parallel preset descriptor.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec
- `.planning/ROADMAP.md` §"Phase 33: Cohort Builder UX & Advanced Filters" — goal + 5 success criteria (authoritative).
- `.planning/REQUIREMENTS.md` §"Cohort Builder (COH)" lines 36–39 (COH-01..04) and §"Dashboard / Data Completeness (DASH)" line 32 (DASH-02) — full requirement text incl. the threshold rules.

### Files to edit / create
- `src/pages/CohortBuilderPage.tsx` — filter inputs (age/Visus/CRT) at ~lines 425–555 need plausibility validation (D-01..D-03); `filters` local `useState` (~line 60) becomes session-persisted (D-04); add preset buttons (D-07/D-08) and the advanced-dialog entry (D-10/D-11). Existing Reset at ~line 559; existing inline-validation pattern for `saveName` at ~lines 84–138 is the model for D-01.
- `shared/patientCases.ts` — `applyFilters` (line 111) extended with preset predicates (D-08) and curated advanced attributes (D-11).
- `shared/types/fhir.ts:159-166` — `CohortFilter` (`{diagnosis, gender, ageRange, visusRange, crtRange, centers}`); re-exported via `src/types/fhir.ts`. Extend for advanced attributes + preset descriptors.
- `src/pages/LandingPage.tsx:288,302` — the two Attention Review buttons; CRT button (line 302) currently `navigate('/quality?status=flagged')` — fix per D-09.
- `src/pages/QualityPage.tsx` — URL-param seeding (`status`, `therapy` at ~lines 93–104); add a CRT-implausible filter param (D-09); reuse `computeTherapyStatus` (~line 44) for the Therapie-Abbrecher preset (D-08).
- `src/context/AuthContext.tsx` — logout path must clear the persisted-filters sessionStorage key (D-05).
- `src/i18n/translations.ts` — new DE/EN keys; existing Attention keys at lines 880–895.
- `config/settings.yaml` — `therapyBreakerDays: 365`, `therapyInterrupterDays: 120`; locate/confirm the CRT clinical threshold.

### Grounding references (read, do not reshape)
- `src/context/DataContext.tsx` — `savedSearches` + `qualityFlags` stores (`qualityFlags` at line 88, used for the Flagged preset, D-08).
- `.planning/phases/31-subcohort-support/31-CONTEXT.md` — Phase 31 validation pattern (D-01 inline-under-field) and the SavedSearch/subcohort model that presets must not disturb (D-07).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CohortBuilderPage` `saveName` inline validation block (lines 84–138) — the established pattern for D-01 field-level inline errors (hard error blocks Save, soft warning does not).
- `applyFilters` in `shared/patientCases.ts` (line 111) — single filter engine consumed by `CohortBuilderPage`, `AnalysisPage`, `OutcomesView`; extend here so all consumers benefit.
- `computeTherapyStatus` in `QualityPage.tsx` (~line 44) — IVI-gap → breaker/interrupter logic; reuse for the Therapie-Abbrecher preset predicate (don't duplicate).
- `DataContext.qualityFlags` — source for the "Flagged data-quality cases" preset.
- `QualityPage` URL-param seeding (`status`, `therapy`) — extend with a CRT param for DASH-02.
- `t()` i18n + `src/i18n/translations.ts` — bilingual DE/EN; Attention keys at 880–895.

### Established Patterns
- Inline-under-field validation, hard-error-blocks-save (Phase 31 D-01).
- Throw-only error handling; camelCase TS identifiers; wire/FHIR strings unchanged (D-05 project rule).
- Types imported in `src/` via the `src/types/fhir.ts` re-export shim; `shared/` imports `shared/types/fhir.ts` directly.
- Config from `config/settings.yaml` only — no env vars, no hardcoded client constants (project convention; thresholds like `therapyBreakerDays` live here).
- Tests: Vitest, no jest-dom, `queryByText().not.toBeNull()` style. Baseline 828/828 must stay green.

### Integration Points
- Filter flow: `CohortBuilderPage` filters → `applyFilters` (shared) → live results; presets apply predicate filters via the same path (D-07/D-08).
- Persistence flow: filters ↔ sessionStorage (D-04); `AuthContext` logout clears the key (D-05).
- Dashboard flow: `LandingPage` Attention buttons → `QualityPage` URL params (D-09).

</code_context>

<specifics>
## Specific Ideas

- Manual Visus filter strictly 0–1; the Implausible-Visus preset is the only way to surface >1 (separate predicate).
- Presets are one-click, ephemeral, non-persisted filter applications (no auto SavedSearch clutter).
- Dashboard Review buttons go to the Quality review surface (review intent), distinct from the cohort-builder presets (analysis intent) — same clinical concept, two destinations on purpose.
- Curated advanced set: diagnosis subtype, comorbidities, HbA1c, drug/agent, laterality.
- sessionStorage (not in-memory context) specifically so filters survive a page reload within the tab.

</specifics>

<deferred>
## Deferred Ideas

- Server-side / cross-device filter persistence — out of scope (COH-02 is client-side only).
- Full data-model field exposure in the advanced dialog — rejected (D-10); revisit only if the curated set proves insufficient.
- A formal `/gsd-spike` artifact for COH-04 — short-circuited by D-12; the decision is recorded in this CONTEXT instead.
- Auto-materializing presets as SavedSearch entries — rejected (D-07); user saves manually if desired.
- OR-logic / advanced boolean filter composition beyond default AND — deferred unless research justifies it.

</deferred>

---

*Phase: 33-cohort-builder-ux-advanced-filters*
*Context gathered: 2026-05-21*
