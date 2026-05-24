# Phase 33: Cohort Builder UX & Advanced Filters — Research

**Researched:** 2026-05-21
**Domain:** Frontend UX — filter validation, sessionStorage persistence, preset predicates, advanced dialog, dashboard routing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Invalid input shows inline per-field error and blocks the Save Cohort action (button disabled), consistent with the Phase 31 inline-under-field validation pattern. Replaces silent clamping (`Math.max(0, Number(...) || default)`).
- **D-02:** Manual Visus filter fields constrained to 0–1; value >1 shows inline error. The "Implausible Visus" preset (finds values >1) uses a separate predicate. Age lower>upper, and negative/non-numeric on age/Visus/CRT, are also inline errors.
- **D-03:** Invalid field is not applied to live results; only Save is blocked.
- **D-04:** Filter state persisted in `sessionStorage` (survives reload within tab; cleared on tab close). Chosen over in-memory React context for reload survival.
- **D-05:** Persisted filter state cleared on logout. Existing Reset control (`setFilters({})`) continues to work.
- **D-06:** Persistence covers full filter object including advanced-dialog attributes. Serialization must round-trip the `CohortFilter` shape (and any advanced extension).
- **D-07:** Presets are one-click preset buttons in the cohort builder. Ephemeral applied filters — clicking a preset applies its filter to the builder live; user saves manually. Presets do NOT auto-create SavedSearch entries.
- **D-08:** Presets require predicate semantics `CohortFilter` cannot express; `applyFilters` extended with preset predicates. Reuse therapy-status logic in `QualityPage` (`getTherapyStatus`) rather than duplicating.
- **D-09 (DASH-02):** Dashboard Review buttons route to Quality review surface. Therapie-Abbrecher keeps `/quality?therapy=breaker`. CRT button must stop routing to `/quality?status=flagged` and instead route to a new CRT-specific Quality filter (e.g. `/quality?crt=implausible`), which `QualityPage` must learn to seed.
- **D-10:** Advanced dialog exposes a curated set (not all data-model fields).
- **D-11:** Curated attribute set = diagnosis subtype, comorbidities, HbA1c, drug/agent, laterality.
- **D-12:** COH-04 spike outcome recorded here in lieu of a separate spike artifact.

### Claude's Discretion
- Exact DE/EN i18n strings for preset labels, validation messages, and advanced-dialog field labels (follow `t()` + `src/i18n/translations.ts` patterns).
- The concrete `sessionStorage` key name and serialization format.
- Where the CRT clinical threshold value is sourced (locate existing CRT-implausibility threshold; `therapyBreakerDays: 365` and `therapyInterrupterDays: 120` are in `config/settings.yaml`).
- AND/OR combination semantics within the advanced dialog (default to AND, consistent with existing filters, unless research surfaces a reason otherwise).
- Visual layout of the advanced dialog (modal vs expandable panel) — defer to UI-SPEC.
- How preset predicates are typed/added to `CohortFilter` vs a parallel preset descriptor.

### Deferred Ideas (OUT OF SCOPE)
- Server-side / cross-device filter persistence.
- Full data-model field exposure in the advanced dialog (rejected D-10).
- A formal `/gsd-spike` artifact for COH-04.
- Auto-materializing presets as SavedSearch entries (rejected D-07).
- OR-logic / advanced boolean filter composition beyond default AND.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COH-01 | Cohort-builder plausibility checks — lower age ≤ upper; Visus 0–1; non-numeric/negative rejected on age/Visus/CRT | Inline validation pattern confirmed in existing `saveName` block (lines 84–138 CohortBuilderPage); silent-clamping code located at lines 440, 458, 530, 548 |
| COH-02 | Filter state persisted client-side for the session with a reset control | `sessionStorage` pattern; `performLogout` in AuthContext at line 144 is the insertion point; existing key naming convention documented |
| COH-03 | Four issue-based presets: Therapie-Abbrecher, Unplausible CRT-Werte, Flagged data-quality cases, Implausible Visus | `getTherapyStatus` confirmed in `QualityPage.tsx` lines 42–66; `CRITICAL_CRT_THRESHOLD = 400` confirmed in `src/config/clinicalThresholds.ts`; `qualityFlags` store confirmed in `DataContext.tsx` line 88; `applyFilters` extension architecture confirmed |
| COH-04 | Advanced filter dialog; spike outcome recorded | D-10/D-11 recorded in CONTEXT; curated attribute FHIR mapping verified |
| DASH-02 | Dashboard Review buttons route correctly | Bug confirmed: `LandingPage.tsx:302` calls `navigate('/quality?status=flagged')` for CRT button; correct target is `/quality?crt=implausible`; existing `landingPageAlerts.test.tsx` test at line 83 hardcodes old wrong target and must be updated |
</phase_requirements>

---

## Summary

Phase 33 extends the cohort builder along four axes. All required code is already in-tree; the work is surgical extension of existing modules rather than new infrastructure. The seven specific questions from the phase brief are fully resolved by code inspection — findings follow.

The most important architectural finding is that `getTherapyStatus` in `QualityPage.tsx` is a **module-private function (not exported)**, so it must be lifted to `shared/` before the Therapie-Abbrecher preset can call it without duplication. This is the single refactor the planner must schedule before implementing presets.

The CRT clinical threshold situation is nuanced: `CRITICAL_CRT_THRESHOLD = 400` (µm) exists in `src/config/clinicalThresholds.ts` and is the value used by `QualityCaseDetail` and `useCaseData` to flag individual CRT readings as critical. However, the word "implausible" in REQUIREMENTS.md §COH-03 ("`clinicalThresholds`") refers specifically to this same file, and a CRT value above 700 µm is also biologically implausible. The CONTEXT says to find or define the threshold in `config/settings.yaml` alongside the therapy thresholds. Because no CRT-implausibility threshold currently exists in `settings.yaml`, the planner must decide: either adopt `CRITICAL_CRT_THRESHOLD = 400` as the preset's cut-off (matching existing quality-flag logic), or add a new `crtImplausibleThreshold` to `settings.yaml`. Research recommendation: re-use `CRITICAL_CRT_THRESHOLD = 400` (already the accepted anomaly cut-off), and for the preset predicate import it from `src/config/clinicalThresholds.ts` into `shared/patientCases.ts` (which cannot import from `src/`, so the constant should be moved or re-exported via `shared/`).

**Primary recommendation:** Lift `getTherapyStatus` to `shared/qualityPredicates.ts`, move `CRITICAL_CRT_THRESHOLD` to `shared/clinicalThresholds.ts`, then extend `applyFilters` / `CohortFilter` with a `preset` discriminant field. All other changes are additive (sessionStorage layer, validation blocks, QualityPage CRT param, LandingPage routing fix).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Filter input validation (COH-01) | Browser / Client | — | UI-only; valid fields still filter live results |
| Filter persistence (COH-02) | Browser / Client | — | sessionStorage is browser-local; no server involvement |
| Preset predicate logic (COH-03) | Shared module | Browser consumer | Predicate logic belongs in `shared/patientCases.ts` so server aggregation path can also use it if needed |
| Advanced filter dialog (COH-04) | Browser / Client | Shared type extension | Dialog lives in `src/`; extended `CohortFilter` lives in `shared/types/fhir.ts` |
| Dashboard routing fix (DASH-02) | Browser / Client | — | `LandingPage` navigate call and `QualityPage` URL-param seeding |
| Logout filter clear (D-05) | Browser / Client | — | `sessionStorage.removeItem` in `AuthContext` `performLogout` |

---

## Investigation Results (High-Value Research Targets)

### 1. CRT Implausibility Threshold

**What was searched:** `config/settings.yaml`, `shared/`, `src/config/clinicalThresholds.ts`, `src/hooks/useCaseData.ts`, `src/components/quality/QualityCaseDetail.tsx`, `scripts/generate-center-bundle.ts`.

**Findings:**

| Source | Value | File:Line | Semantic |
|--------|-------|-----------|---------|
| `CRITICAL_CRT_THRESHOLD` | `400` µm | `src/config/clinicalThresholds.ts:7` | "CRT critical exceedance" — triggers quality flag in individual case view |
| `therapyBreakerDays` | `365` | `config/settings.yaml:3` | Therapy logic |
| `therapyInterrupterDays` | `120` | `config/settings.yaml:2` | Therapy logic |
| Synthetic data CRT range | `200–700` µm | `scripts/generate-center-bundle.ts:490-500` | Generated data never produces values outside this range |

**Critical finding:** There is **no CRT-implausibility threshold in `config/settings.yaml`**. [VERIFIED: direct read of `config/settings.yaml`]

The `REQUIREMENTS.md` line for COH-03 reads "Unplausible CRT-Werte (outside `clinicalThresholds`)". The identifier `clinicalThresholds` is a reference to the file `src/config/clinicalThresholds.ts`. `CRITICAL_CRT_THRESHOLD = 400 µm` is the only CRT threshold currently in the codebase.

**Problem:** `src/config/clinicalThresholds.ts` is in `src/`, not `shared/`. `shared/patientCases.ts` cannot import from `src/`. Options:

- **Option A (Recommended):** Add `crtImplausibleThresholdUm: 400` to `config/settings.yaml` (consistent with `therapyBreakerDays`/`therapyInterrupterDays` precedent). The `applyFilters` preset predicate reads it via `getSettings()`, the same way `QualityPage` reads therapy thresholds. `CRITICAL_CRT_THRESHOLD` in `src/config/clinicalThresholds.ts` is kept for UI-only display contexts.
- **Option B:** Move `CRITICAL_CRT_THRESHOLD` to `shared/clinicalThresholds.ts` and import in both `shared/patientCases.ts` and `src/`. This is a broader refactor.

Option A is the lowest-risk path and follows the project convention ("Config from `config/settings.yaml` only — no env vars, no hardcoded client constants").

**Visus "implausible" threshold:** The "Implausible Visus" preset finds cases where the latest Visus observation is outside 0–1. This needs no new constant — `0` and `1` are the bounds. [VERIFIED: `src/pages/CohortBuilderPage.tsx:486 — if (!isNaN(v) && v >= 0)` and D-02]

---

### 2. `applyFilters` Signature and `CohortFilter` Shape

**`applyFilters` signature** (`shared/patientCases.ts` line 111): [VERIFIED: direct read]

```typescript
export function applyFilters(cases: PatientCase[], filters: CohortFilter): PatientCase[]
```

**`CohortFilter` shape** (`shared/types/fhir.ts` lines 159–166): [VERIFIED: direct read]

```typescript
export interface CohortFilter {
  diagnosis?: string[];
  gender?: string[];
  ageRange?: [number, number];
  visusRange?: [number, number];
  crtRange?: [number, number];
  centers?: string[];
}
```

**All call sites of `applyFilters`:** [VERIFIED: grep]

| File | Line | How Called |
|------|------|------------|
| `src/pages/CohortBuilderPage.tsx` | 146 | `useMemo(() => applyFilters(activeCases, filters), ...)` |
| `src/pages/AnalysisPage.tsx` | 111 | `useMemo(() => applyFilters(activeCases, filters), ...)` |
| `src/components/outcomes/OutcomesView.tsx` | 150 | `applyFilters(activeCases, saved.filters)` |
| `src/components/outcomes/OutcomesView.tsx` | 155 | `applyFilters(activeCases, safePickFilter(parsed))` |
| `src/components/outcomes/OutcomesView.tsx` | 363 | `applyFilters(activeCases, saved.filters)` |
| `src/components/outcomes/OutcomesView.tsx` | 385 | `applyFilters(activeCases, s.filters).length` |

`applyFilters` is re-exported via `src/services/fhirLoader.ts:23`. All six call sites pass a `CohortFilter` object. The function is a simple filter-and-return with no side effects.

**Safe-pick pattern:** `AnalysisPage` (lines 96–108) and `OutcomesView` (`safePickFilter` function, lines 61–73) both implement explicit key picking when deserializing `CohortFilter` from URL params or `savedSearches.filters`. Any new keys added to `CohortFilter` (advanced attributes) must be added to both safe-pick implementations or those consumers will silently ignore the new fields.

**D-12 resolution — typing recommendation:**

Adding a `preset` discriminant to `CohortFilter` vs a parallel descriptor is the key open question. Research finding: **extend `CohortFilter` in place with an optional `preset` string field** is cleaner because:
1. `applyFilters` already receives `CohortFilter` — adding a `preset` branch there is one change.
2. `SavedSearch.filters` serializes `CohortFilter` — preset saves would round-trip cleanly.
3. The safe-pick functions need one new line each.

The alternative (parallel `PresetDescriptor` union) requires the planner to thread a second parameter through all six call sites and the persistence layer, or add a converter function.

**Recommended extension:**

```typescript
export interface CohortFilter {
  // existing fields...
  preset?: 'therapyBreaker' | 'implausibleCrt' | 'flaggedQuality' | 'implausibleVisus';
  // advanced dialog fields (D-11):
  diagnosisSubtype?: string[];
  comorbidities?: string[];
  hba1cRange?: [number, number];
  medicationCodes?: string[];
  laterality?: ('left' | 'right' | 'bilateral')[];
}
```

The `preset` field is cleared (set to `undefined`) when the user manually edits any filter field after clicking a preset — this prevents stale preset semantics from persisting alongside partial manual edits. The planner must specify this clearing behavior.

---

### 3. `computeTherapyStatus` / `getTherapyStatus` in `QualityPage.tsx`

**Finding:** The function is named `getTherapyStatus` (NOT `computeTherapyStatus` as CONTEXT suggests). [VERIFIED: direct read QualityPage.tsx line 42]

**Current signature** (`QualityPage.tsx` lines 42–66):

```typescript
function getTherapyStatus(
  pc: PatientCase,
  thresholds: { interrupterDays: number; breakerDays: number },
): { status: 'active' | 'interrupter' | 'breaker'; gapDays: number }
```

**Exportability:** The function is declared with `function` (not `export function`) — it is **module-private**. It CANNOT be imported into `shared/patientCases.ts` without:
1. Adding `export` to the declaration in `QualityPage.tsx` (possible but pollutes page module), OR
2. Moving it to `shared/` (cleanest approach).

**Recommendation:** Move `getTherapyStatus` to a new module `shared/qualityPredicates.ts` (or add it to `shared/patientCases.ts` directly). `QualityPage.tsx` then imports and re-uses it. This eliminates duplication and follows the project pattern where shared logic lives in `shared/`. The function's `thresholds` parameter is already parameterized (not reading globals), making it safe to move.

`QualityPage` reads thresholds at line 152–159 via `getSettings()` and passes them in. The same pattern should be used in `applyFilters` for the preset predicate.

---

### 4. QualityPage URL-Param Seeding

**Current implementation** (`QualityPage.tsx` lines 90–110): [VERIFIED: direct read]

Two filters are seeded from URL params via lazy `useState` initializers (no `useEffect` — per the RESEARCH comment "avoids double-render flash"):

```typescript
const [filterStatus, setFilterStatus] = useState<QualityStatus | 'all'>(() => {
  const v = searchParams.get('status');
  return v === 'flagged' ? 'in_progress' : 'all';
});
const [filterTherapy, setFilterTherapy] = useState<string>(() => {
  const v = searchParams.get('therapy');
  return v === 'breaker' || v === 'interrupter' ? v : 'all';
});
const [showFilters, setShowFilters] = useState<boolean>(() => {
  return searchParams.get('therapy') !== null || searchParams.get('status') !== null;
});
```

Note: `status=flagged` maps to `in_progress` (not a passthrough) — `QualityStatus` has no `'flagged'` member. This mapping is intentional and tested.

**Adding `crt=implausible`:**

A third lazy initializer must be added:

```typescript
const [filterCrt, setFilterCrt] = useState<'implausible' | 'all'>(() => {
  return searchParams.get('crt') === 'implausible' ? 'implausible' : 'all';
});
```

`showFilters` lazy initializer must also include `searchParams.get('crt') !== null`.

The `filteredCases` memo (lines 167–176) gains a new clause filtering by `filterCrt`. This requires access to `getSettings().crtImplausibleThresholdUm` (or `CRITICAL_CRT_THRESHOLD`) and the `getLatestObservation` helper.

`QualityCaseList.tsx` props interface (`QualityCaseListProps`, lines 19–40) gains a new `filterCrt` prop and `onFilterCrtChange` callback. The filter panel UI gains a new CRT select.

**LandingPage bug confirmed** (`LandingPage.tsx` line 302): [VERIFIED: direct read]

```tsx
<Button ... onClick={() => navigate('/quality?status=flagged')}>
```

The button's aria-label is `{t('reviewFlaggedCases')}` (key: `reviewFlaggedCases`). The label in `translations.ts:895` is "Review flagged cases" / "Markierte Fälle prüfen". This label is **wrong for the CRT context** — it should be a CRT-specific label like "reviewImplausibleCrt". The fix is:
1. Change `navigate` target to `/quality?crt=implausible`.
2. Change `aria-label` to a new i18n key `reviewImplausibleCrt`.

The existing test `tests/landingPageAlerts.test.tsx:83` currently asserts the old wrong target (`/quality?status=flagged`). This test MUST be updated to assert `/quality?crt=implausible` and the new aria-label.

---

### 5. sessionStorage Filter Persistence

**Existing sessionStorage key naming convention:** [VERIFIED: direct read of AuthContext.tsx and recentActivityStore.ts]

| Key | Store | Format | Cleared on logout |
|-----|-------|--------|-------------------|
| `emd-token` | `sessionStorage` | JWT string | Yes — `sessionStorage.removeItem('emd-token')` at AuthContext line 162 |
| `emd-recent:<username>` | `localStorage` | JSON array of `RecentActivityEntry` | Yes — `recentActivityStore.clearAll()` at AuthContext line 152 |
| `emd-theme` | `localStorage` | `'light' | 'dark' | 'system'` | No (intentional — theme is not PII) |

**Naming recommendation for COH-02:** `emd-cohort-filters` (per-tab, no username suffix because `sessionStorage` is already tab-isolated; there is no cross-user contamination risk unlike `localStorage`).

**AuthContext logout path** (`AuthContext.tsx:144`, `performLogout` function): [VERIFIED: direct read]

```typescript
const performLogout = useCallback((auto = false) => {
  recentActivityStore.clearAll();     // line 152
  void serverLogout();                // line 156
  broadcastLogout();                  // line 158
  setUser(null);                      // line 159
  setToken(null);                     // line 160
  setInactivityWarning(false);        // line 161
  sessionStorage.removeItem('emd-token'); // line 162
  invalidateBundleCache();            // line 163
}, []);
```

**Insertion point for D-05:** Add `sessionStorage.removeItem('emd-cohort-filters')` after line 162 (adjacent to `emd-token` removal). This is the only logout path — `performLogout` is called by both the interactive `logout` callback (line 322) and the auto-logout timer path.

**Serialization:** `JSON.stringify` / `JSON.parse` of `CohortFilter` is sufficient. The type contains only `string[]`, `[number, number]`, and optional primitives — no Date objects, no circular references. The same safe-pick pattern used in `AnalysisPage` should be applied when reading from sessionStorage to guard against corrupt/stale values.

---

### 6. Inline Validation Pattern and Silent-Clamping Locations

**Phase 31 inline-validation pattern** (established in `CohortBuilderPage.tsx`): [VERIFIED: direct read lines 84–138]

The existing `saveName` validation block computes `{ hasHardError, isHardError, validationMsg }` as a derived value inside the component render (no `useState` for validation messages — they derive from `saveName` state). Hard errors set `hasHardError: true`, which feeds `disabled={hasHardError || !saveName.trim()}` on the Save button. The error `<p>` element uses:
- `role="alert"` for hard errors
- `role="status"` for soft warnings
- Red styling for hard, amber for soft

**COH-01 must follow this exact pattern** for the numeric filter fields.

**Silent-clamping code locations** — the code that D-01 replaces: [VERIFIED: direct read CohortBuilderPage.tsx lines 425–555]

| Field | Clamping Code | Line(s) |
|-------|--------------|---------|
| Age min | `Math.max(0, Number(e.target.value) \|\| 0)` | ~440 |
| Age max | `Math.max(0, Number(e.target.value) \|\| 120)` | ~458 |
| CRT min | `Math.max(0, Number(e.target.value) \|\| 0)` | ~530 |
| CRT max | `Math.max(0, Number(e.target.value) \|\| 800)` | ~548 |

**Visus fields are already text inputs** (`type="text"`, `inputMode="decimal"`) with manual parse-on-change at lines 478–512. They do NOT silently clamp — they already skip `setFilters` if the parse result is `NaN`. However they do NOT validate the 0–1 range constraint required by D-02; a value of `1.5` would be accepted. This is also replaced by D-01/D-02 validation.

**Note on Visus text-input pattern:** The Visus fields use `[visusMinText, setVisusMinText]` as separate string-typed state for the display value (allows decimal-in-progress typing like `"0,"`) while the filter receives the parsed float. The validation message for Visus must read from `visusMinText` / `visusMaxText` state, not from `filters.visusRange`. This state management distinction matters when implementing validation.

**Age fields use `type="number"`** — D-01 can keep the `type="number"` input and add validation logic rather than converting to text inputs, since number inputs inherently reject non-numeric keyboard input on most browsers (though programmatic assignment of non-numeric strings is still possible, which the validation must guard via `isNaN` check).

---

### 7. DataContext `qualityFlags` Store

**Shape** (`DataContext.tsx` line 88): [VERIFIED: direct read]

```typescript
const [qualityFlags, setQualityFlags] = useState<QualityFlag[]>([]);
```

**`QualityFlag` type** (`shared/types/fhir.ts` lines 177–186): [VERIFIED: direct read]

```typescript
export interface QualityFlag {
  id?: string;
  caseId: string;
  parameter: string;
  errorType: string;
  flaggedAt: string;
  flaggedBy: string;
  status: 'open' | 'acknowledged' | 'resolved';
}
```

**"Flagged data-quality cases" preset predicate logic:** A case has a "flagged" data quality issue when `qualityFlags.some(f => f.caseId === c.id && f.status === 'open')`. This is exactly the `in_progress` mapping in `QualityPage` — the caseStatus useMemo sets `in_progress` when `flags.some(f => f.status === 'open')` (lines 134–135).

**Problem for `applyFilters`:** `applyFilters` in `shared/patientCases.ts` receives `cases: PatientCase[]` and `filters: CohortFilter`. It does NOT currently receive `qualityFlags`. To implement the "Flagged quality cases" preset predicate, one of:
- Pass `qualityFlags` as a third argument to `applyFilters` (changes all 6 call sites)
- Embed the flag check as a pre-built Set of `caseId`s in `CohortFilter` (e.g. `flaggedCaseIds?: Set<string>`) — caller builds the set, `applyFilters` just checks membership.

**Recommendation:** Add `flaggedCaseIds?: Set<string>` to `CohortFilter`. The `CohortBuilderPage` builds this set from `qualityFlags` when the preset is selected. This keeps `applyFilters` signature unchanged and avoids threading `qualityFlags` through the 4 OutcomesView call sites that don't need it. Note: `Set<string>` is not JSON-serializable; when the filter object is persisted to sessionStorage, `flaggedCaseIds` must be serialized as an array and re-constructed as a Set on load.

---

## Standard Stack

No new libraries are required for this phase.

| Existing Tool | Version | Purpose |
|---------------|---------|---------|
| Vitest | (existing) | Test framework; `@vitest-environment jsdom` per-file |
| React Testing Library | (existing) | Component tests; `queryByText().not.toBeNull()` assertions |
| `sessionStorage` (Web API) | — | COH-02 filter persistence |
| `src/config/clinicalThresholds.ts` | — | `CRITICAL_CRT_THRESHOLD = 400` |
| `config/settings.yaml` | — | Threshold source for new `crtImplausibleThresholdUm` |

---

## Architecture Patterns

### Filter Extension Pattern

The existing `applyFilters` follows a guard-clause chain — each filter property on `CohortFilter` has its own `if (filters.X) return false` block. Preset predicates follow the same pattern:

```typescript
// In shared/patientCases.ts applyFilters (to be added after existing range checks)
if (filters.preset === 'therapyBreaker') {
  const { status } = getTherapyStatus(c, { breakerDays, interrupterDays });
  if (status !== 'breaker') return false;
}
if (filters.preset === 'implausibleCrt') {
  const latest = getLatestObservation(c.observations, LOINC_CRT);
  const val = latest?.valueQuantity?.value;
  if (val == null || val <= crtImplausibleThreshold) return false;
}
if (filters.preset === 'flaggedQuality') {
  if (!filters.flaggedCaseIds?.has(c.id)) return false;
}
if (filters.preset === 'implausibleVisus') {
  const latest = getLatestObservation(c.observations, LOINC_VISUS);
  const val = latest?.valueQuantity?.value;
  if (val == null || (val >= 0 && val <= 1)) return false;
}
```

Threshold values for the predicates (`breakerDays`, `interrupterDays`, `crtImplausibleThreshold`) should be passed as parameters to `applyFilters` or read from a configuration object rather than imported as module-level constants, to remain testable without mocking `getSettings()`.

### sessionStorage Persistence Pattern

Mirror the `recentActivityStore.ts` pattern: try/catch-guarded reads/writes, silently swallow storage failures (private browsing / quota):

```typescript
// Read at component mount (lazy useState initializer)
const [filters, setFilters] = useState<CohortFilter>(() => {
  try {
    const raw = sessionStorage.getItem('emd-cohort-filters');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return safePickCohortFilter(parsed); // same safe-pick pattern as AnalysisPage
  } catch { return {}; }
});

// Write on every filter change (useEffect)
useEffect(() => {
  try {
    sessionStorage.setItem('emd-cohort-filters', JSON.stringify(filters));
  } catch { /* ignore */ }
}, [filters]);
```

### Inline Validation Pattern (established, Phase 31)

Error messages derive from current state in a render-time computed value (no separate `useState` for error messages). Render the error `<p>` element conditionally below the field:

```tsx
{ageError && (
  <p role="alert" className="mt-1 text-xs text-red-600 ...">
    {ageError}
  </p>
)}
```

Save button disabled when any `hasHardError` is true.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| sessionStorage persistence | Custom React context with complex serialization | Direct sessionStorage read/write in `CohortBuilderPage` with try/catch | Precedent in `recentActivityStore.ts`; simple, testable |
| Therapy gap calculation | Duplicate `getTherapyStatus` logic | Lift to `shared/qualityPredicates.ts` and import | Already handles the `injections < 2` edge case, `lastToNow` max-gap logic |
| CRT implausible check | New threshold constant | Re-use `CRITICAL_CRT_THRESHOLD = 400` or add to `settings.yaml` | Consistent with existing quality-flag behavior |
| JSON serialization | Custom binary format | `JSON.stringify` / `JSON.parse` with safe-pick validation | Already established in AnalysisPage URL params |

---

## Common Pitfalls

### Pitfall 1: Safe-Pick Must Cover New `CohortFilter` Fields
**What goes wrong:** Adding `diagnosisSubtype`, `comorbidities`, `hba1cRange`, `medicationCodes`, `laterality` to `CohortFilter` without updating `safePickFilter` in `OutcomesView.tsx` (line 62) and the inline safe-pick in `AnalysisPage.tsx` (line 100). Those consumers will silently drop the new fields.
**How to avoid:** Update both safe-pick implementations as part of the `CohortFilter` extension task.
**Warning signs:** Advanced filters work in `CohortBuilderPage` but not in `AnalysisPage` or `OutcomesView`.

### Pitfall 2: `flaggedCaseIds` Set Is Not JSON-Serializable
**What goes wrong:** `JSON.stringify({ flaggedCaseIds: new Set(['a','b']) })` produces `{}` — `Set` is not serializable.
**How to avoid:** When persisting to sessionStorage, spread the set to an array. When loading, wrap the array in `new Set(...)`.
**Warning signs:** "Flagged quality cases" preset appears to apply correctly on first click but is lost after page reload.

### Pitfall 3: `getTherapyStatus` Is Not Exported
**What goes wrong:** `shared/patientCases.ts` attempts to import `getTherapyStatus` from `src/pages/QualityPage.tsx`. TypeScript will fail to resolve the import (cross-boundary `src/ → shared/` import violation).
**How to avoid:** Move `getTherapyStatus` to `shared/` before implementing the Therapie-Abbrecher preset.
**Warning signs:** TypeScript error at import time.

### Pitfall 4: `landingPageAlerts.test.tsx` Hardcodes the Wrong Target
**What goes wrong:** The existing test at line 83 asserts `mockNavigate.toHaveBeenCalledWith('/quality?status=flagged')`. After fixing the routing bug, this test will FAIL.
**How to avoid:** Update the test to assert `/quality?crt=implausible` in the same plan/task that fixes `LandingPage.tsx`.
**Warning signs:** CI fails on `landingPageAlerts.test.tsx` after the routing fix is applied.

### Pitfall 5: Visus Validation Must Read From `visusMinText` / `visusMaxText`
**What goes wrong:** Implementing COH-01 Visus validation by reading `filters.visusRange` — but when the user types `"1.5"`, the filter may not have been set yet if the parse fails (see existing onChange at line 486: `if (!isNaN(v) && v >= 0)`). The current code will silently accept `"1.5"` and call `setFilters` with `1.5` in visusRange because `1.5 >= 0` is true.
**How to avoid:** Validate against `visusMinText` / `visusMaxText` strings directly. Parse the string and check `parsedValue > 1`.
**Warning signs:** Visus > 1 shows no error message despite D-02.

### Pitfall 6: `showFilters` Auto-Open Must Include `crt` Param
**What goes wrong:** QualityPage `showFilters` lazy initializer (line 108) auto-opens the filter panel when a URL param seeds a filter. Adding `crt=implausible` routing without updating this initializer means the filter panel stays closed after navigation from the dashboard.
**How to avoid:** Add `|| searchParams.get('crt') !== null` to the `showFilters` initializer and to the `qualityPageDeepLink.test.tsx` test.

---

## Advanced Filter Dialog — Attribute FHIR Mapping

The five curated attributes from D-11 and their FHIR representation: [VERIFIED: shared/types/fhir.ts and shared/fhirCodes.ts]

| Attribute | FHIR Source | Implementation Note |
|-----------|-------------|---------------------|
| **Diagnosis subtype** | `PatientCase.conditions[].code.coding` — multiple conditions per case; filter: "any condition matches the selected subtype codes" | Extends existing `diagnosis` filter; SNOMED codes: `SNOMED_AMD = '267718000'`, `SNOMED_DR = '312898008'` already in use |
| **Comorbidities** | `PatientCase.conditions[]` with `category` or multiple condition codes | No comorbidity-specific field exists in the current data model; Phase 26 added comorbidity generation (`generate-center-bundle.ts`) — comorbidities are stored as additional `Condition` resources. Filter: conditions beyond the primary ophthalmic diagnosis. LOINC/SNOMED codes for comorbidities are in the generated data; the planner must enumerate which codes count as comorbidities or add a `comorbidities` field to the extended `CohortFilter` taking SNOMED codes |
| **HbA1c** | `PatientCase.observations` filtered by `LOINC_HBA1C = '4548-4'` | Range filter pattern (same as `crtRange`); `getLatestObservation(c.observations, LOINC_HBA1C)` |
| **Drug/agent** | `PatientCase.medications[].medicationCodeableConcept.coding` | `MedicationStatement` resources; filter: any medication code in the selected set |
| **Laterality** | `PatientCase.conditions[].bodySite` (Condition) or `procedures[].bodySite` (Procedure) | `SNOMED_EYE_RIGHT = '362503005'`, `SNOMED_EYE_LEFT = '362502000'` (and alts); already used in `cohortTrajectory.ts` and `clinicalTerms.ts` for eye laterality |

**Note on comorbidities:** The synthetic data generation (`generate-center-bundle.ts`) creates comorbidity conditions (ICD-10/SNOMED codes for diabetic comorbidities, hypertension etc.) as separate `Condition` resources alongside the primary ophthalmic diagnosis. The primary conditions are identified by `SNOMED_AMD` or `SNOMED_DR` codes. Comorbidities are everything else. The planner needs to decide: filter by "has any comorbidity" (boolean) or by specific comorbidity codes (multi-select). A boolean flag is simpler and avoids exposing a long SNOMED code list in the UI.

---

## State of the Art

| Old Approach | Current Approach | Changed | Impact |
|--------------|------------------|---------|--------|
| Silent clamping on age/CRT inputs | Replace with inline validation errors (COH-01) | Phase 33 | UX improvement; users see errors instead of silently corrected values |
| Dashboard CRT button → `/quality?status=flagged` (wrong) | `/quality?crt=implausible` (correct) | Phase 33 | DASH-02 bug fix |
| Filter state lost on navigation | sessionStorage persistence (COH-02) | Phase 33 | Reload/navigation survival |

---

## Environment Availability

Step 2.6: SKIPPED — this is a pure frontend code/config phase; no new external dependencies. All tools (Node, npm, Vitest) are confirmed operational from Phase 32 execution on the same machine.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (version from package.json) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:ci` (runs all 828 tests) |
| Full suite command | `npm run test:ci` |
| Per-file JSdom | `// @vitest-environment jsdom` docblock in each TSX test file |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COH-01 | Age lower > upper shows inline error, blocks Save | unit/component | `npm run test:ci` | ❌ Wave 0 gap |
| COH-01 | Visus > 1 shows inline error, blocks Save | unit/component | `npm run test:ci` | ❌ Wave 0 gap |
| COH-01 | Negative/non-numeric on age/CRT shows inline error | unit/component | `npm run test:ci` | ❌ Wave 0 gap |
| COH-01 | Invalid field not applied to live results | unit/component | `npm run test:ci` | ❌ Wave 0 gap |
| COH-02 | Filters survive navigate-away and return | component | `npm run test:ci` | ❌ Wave 0 gap |
| COH-02 | Reset clears filters AND sessionStorage | component | `npm run test:ci` | ❌ Wave 0 gap |
| COH-02 | Logout clears persisted filters key | unit | `npm run test:ci` | ❌ Wave 0 gap |
| COH-03 | Each of 4 presets returns the expected case subset | unit (applyFilters) | `npm run test:ci` | ❌ Wave 0 gap |
| COH-04 | Advanced dialog renders 5 curated fields | component | `npm run test:ci` | ❌ Wave 0 gap |
| COH-04 | Advanced filter attributes narrow cohort via applyFilters | unit | `npm run test:ci` | ❌ Wave 0 gap |
| DASH-02 | Therapy-breaker button navigates to `/quality?therapy=breaker` | component | `npm run test:ci` | ✅ `tests/landingPageAlerts.test.tsx:69` |
| DASH-02 | CRT button navigates to `/quality?crt=implausible` (not `?status=flagged`) | component | `npm run test:ci` | ❌ Existing test (line 83) asserts WRONG target — must be updated |
| DASH-02 | QualityPage seeds `filterCrt=implausible` from `?crt=implausible` | component | `npm run test:ci` | ❌ Wave 0 gap (extend `qualityPageDeepLink.test.tsx`) |

### Sampling Rate
- **Per task commit:** `npm run test:ci`
- **Per wave merge:** `npm run test:ci`
- **Phase gate:** Full suite green (828+N / 828+N) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/cohortBuilderValidation.test.tsx` — COH-01: age/visus/CRT inline validation + Save blocking
- [ ] `tests/cohortFilterPersistence.test.tsx` — COH-02: sessionStorage round-trip + logout clear + Reset
- [ ] `tests/cohortPresets.test.ts` — COH-03: unit tests for 4 preset predicates in `applyFilters` (pure function, no JSdom needed)
- [ ] `tests/advancedFilterDialog.test.tsx` — COH-04: dialog renders, advanced fields filter correctly
- [ ] Update `tests/landingPageAlerts.test.tsx:83` — DASH-02: change assertion from `?status=flagged` to `?crt=implausible` and update aria-label assertion
- [ ] Extend `tests/qualityPageDeepLink.test.tsx` — DASH-02: add test for `?crt=implausible` seeding `filterCrt`

---

## Security Domain

`security_enforcement` is not explicitly set to false in `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes | Numeric range validation in COH-01; safe-pick on sessionStorage read |
| V6 Cryptography | No | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Corrupt/attacker-written sessionStorage value | Tampering | Safe-pick validation when reading `emd-cohort-filters` (mirrors `recentActivityStore` pattern) |
| Open-redirect via `CohortFilter.preset` stored string | Tampering | Preset is a union type — only known literal values accepted; whitelist at deserialization |
| Cross-user filter leak (shared browser) | Information Disclosure | `sessionStorage` is tab-isolated + cleared on logout (D-05) — lower risk than `localStorage` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `CRITICAL_CRT_THRESHOLD = 400 µm` is the right value for the "Unplausible CRT" preset (vs. a separate "biologically implausible > 700" threshold) | CRT threshold | Preset would incorrectly label clinically elevated-but-not-implausible CRT values as "implausible"; clinical team would reject the feature |
| A2 | Comorbidities are stored as additional `Condition` resources (non-AMD/DR codes) in the synthetic bundles, based on Phase 26 generation logic | Advanced filter — comorbidities | If comorbidities are stored differently (e.g. embedded in AMD/DR condition extensions), the filter predicate would need to be redesigned |
| A3 | `Set<string>` serialization workaround (spread to array for sessionStorage) for `flaggedCaseIds` is acceptable rather than changing `flaggedCaseIds` to `string[]` in `CohortFilter` | flaggedCaseIds serialization | If `string[]` is preferred, the membership check in `applyFilters` should use `Array.includes` (O(N)) or convert to a Set at use time |

---

## Open Questions

1. **CRT implausibility threshold value**
   - What we know: `CRITICAL_CRT_THRESHOLD = 400` exists for quality-flag UI display; synthetic data generates CRT in `[200, 700]`; `settings.yaml` has no CRT threshold.
   - What's unclear: Is 400 µm the right clinical threshold for the "Unplausible CRT" preset (which is about plausibility, not just clinical concern), or should it be a higher value like 700–800 µm?
   - Recommendation: Confirm with clinical stakeholder or use 400 for now (matches existing quality-flag logic); add `crtImplausibleThresholdUm: 400` to `settings.yaml` as a single source of truth. Flag as A1.

2. **Comorbidity representation in data model**
   - What we know: Phase 26 added comorbidity generation; the `Condition` resource has a `category` field.
   - What's unclear: Are comorbidities distinguished from primary diagnoses by `category` coding, or purely by having a non-AMD/non-DR SNOMED code?
   - Recommendation: Inspect one generated bundle to confirm before implementing the comorbidity filter. The planner should add a "read one generated bundle JSON" task in Wave 0.

3. **`landingPageAlerts.test.tsx` aria-label for CRT button**
   - What we know: Current button has `aria-label={t('reviewFlaggedCases')}`, which must change for the CRT-specific route.
   - What's unclear: Whether to rename the existing i18n key `reviewFlaggedCases` (breaking) or add a new key `reviewImplausibleCrt`.
   - Recommendation: Add a new key `reviewImplausibleCrt` and keep `reviewFlaggedCases` for any other consumers. Adding a new key avoids a string-search for all existing `reviewFlaggedCases` uses.

---

## Sources

### Primary (HIGH confidence)
- `src/config/clinicalThresholds.ts` — CRITICAL_CRT_THRESHOLD = 400 confirmed
- `src/pages/QualityPage.tsx` — getTherapyStatus function (module-private, line 42), URL-param seeding pattern (lines 93–110), showFilters lazy init (lines 108–110)
- `src/pages/LandingPage.tsx` — CRT button routing bug at line 302 confirmed
- `src/pages/CohortBuilderPage.tsx` — silent-clamping locations, existing validation pattern, filters state, Reset control
- `shared/patientCases.ts` — applyFilters signature and all 6 call sites verified
- `shared/types/fhir.ts:159-186` — CohortFilter and QualityFlag shapes verified
- `src/context/AuthContext.tsx:144-163` — performLogout insertion point for D-05
- `src/context/DataContext.tsx:88` — qualityFlags store shape verified
- `config/settings.yaml` — no CRT threshold present (confirmed by full read)
- `tests/landingPageAlerts.test.tsx` — wrong target assertion at line 83 confirmed
- `tests/qualityPageDeepLink.test.tsx` — existing test coverage for QualityPage seeding confirmed

### Secondary (MEDIUM confidence)
- `scripts/generate-center-bundle.ts` — CRT generated in [200, 700] µm; visus generated with clamp to [0.05, 1.0]; no implausible values generated intentionally
- `src/services/recentActivityStore.ts` — sessionStorage/localStorage key naming and guarded pattern (mirror for COH-02)
- `src/context/ThemeContext.tsx` — localStorage try/catch idiom (secondary reference)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in-tree, no new dependencies
- Architecture: HIGH — all 7 research targets resolved by direct code read
- Pitfalls: HIGH — all identified from code inspection, not speculation
- Advanced filter FHIR mapping: MEDIUM — comorbidity representation needs bundle inspection (see Open Question 2)

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable codebase; no fast-moving external dependencies)
