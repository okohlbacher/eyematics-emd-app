# Phase 34: Data Completeness (Consent + Stubs) - Research

**Researched:** 2026-05-24
**Domain:** FHIR bundle augmentation, stub isolation, dashboard completeness metric
**Confidence:** HIGH (all key claims verified directly in codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stub isolation (H2)**
- D-01: Stubs are real FHIR `Patient` resources in the same site bundles. Stub recognition = zero `Observation` resources per patient. No tag, profile, or extension as discriminator.
- D-02: Each stub carries only `gender` (m/f), year of birth (`birthDate`), and one minimal site-attributed FHIR `Encounter` resource. No Conditions, Procedures, MedicationStatements, ImagingStudies, or Observations.
- D-03: Stub exclusion enforced at the SINGLE chokepoint `extractPatientCases` (`shared/patientCases.ts:64`): drop zero-Observation patients. One edit, one guarantee. Regression test asserts no stub pseudonym ever appears in output.
- D-04: `extractCenters().patientCount` (`src/services/fhirLoader.ts:67`) ALSO excludes stubs. Stubs surface ONLY in the completeness denominator.

**Consent model & "consented" definition**
- D-05: Datenvollzähligkeit numerator (consented count) is computed structurally as patients-with-Observations (= non-stubs). Does NOT read Consent resources.
- D-06 (local): Every full (non-stub) patient gets one active research Consent (= 100% of non-stubs consented). <100% completeness fraction comes entirely from stubs in the denominator.
- D-07: Consent shape: `status: active`, research scope/category, patient + site reference, `policyRule`/`dateTime`, and `Consent.provision` detail (permit, purpose).

**Metric computation & dashboard display**
- D-08: Datenvollzähligkeit computed client-side from loaded bundles. No server endpoint.
- D-09: Denominator from a SEPARATE raw Patient count over bundles — NOT `cases.length` / `totalPatients` (line 45 of LandingPage.tsx). Numerator = non-stub count; denominator = raw total Patients.
- D-10: One Datenvollzähligkeit summary card on LandingPage: total patients (consented + stubs), consented count, fraction. Reflects current site filter and per-user site restriction. Stubs site-attributed via `meta.source`.

**Stub generation & reference-bundle handling**
- D-11: Per-site random factor in [2, 8] — each site's stub count ≈ `factor × consentedCount`, factor drawn from [2, 8] once at generation, deterministically seeded (Mulberry32 per-site seed). Fixed in output, not re-rolled per load.
- D-12: BOTH synthetic AND reference sites get stubs. Synthetic (Chemnitz, Greifswald, Leipzig, Münster) via generator. Reference (Aachen, Tübingen) via idempotent augmentation script.
- D-13: Reference augmentation is append-only: appends Consent + stub Patient + stub Encounter resources, leaves every pre-existing curated resource byte-for-byte identical (honors project D-06). Test asserts curated resource set is unchanged; script is idempotent/re-runnable.
- D-14: Existing CI byte-stability + distribution gates (verify-bundle-distributions.mjs, audit-bundle-codes.mjs) extended to cover stubs and Consent.

### Claude's Discretion
- `birthDate` representation for "year of birth" (e.g. `YYYY-01-01` vs jittered within the year).
- New TS types: a `Consent` and an `Encounter` interface in `shared/types/fhir.ts` + re-export via `src/types/fhir.ts`.
- Exact `config/settings.yaml` key names for stub config; whether the [2, 8] factor range is exposed as config.
- DE/EN i18n keys for the Datenvollzähligkeit card labels (follow `t()` + `src/i18n/translations.ts`).
- Exact card layout / placement on LandingPage — defer to UI-SPEC.
- Whether the generator and the reference-augmentation script share a common stub/Consent builder helper (DRY) or stay separate.
- Guarding that the new Encounter resources don't leak into any surface that enumerates Encounters.

### Deferred Ideas (OUT OF SCOPE)
- A server-side completeness endpoint — rejected, client count is cheap (D-08).
- Modeling a partial consent rate among full patients.
- Making the metric read Consent resources instead of clinical emptiness.
- Exposing stub demographics anywhere in the UI beyond the aggregate completeness count.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Patient-stub + consent model for Datenvollzähligkeit: add FHIR Consent resources for existing synthetic patients, generate patient stubs at configurable multiplier, dashboard shows total + consented + fraction, stub isolation enforced across all clinical surfaces | D-01 through D-14 decisions + verified chokepoints in codebase |
</phase_requirements>

---

## Summary

Phase 34 adds the Datenvollzähligkeit (data completeness) metric to the dashboard by introducing two new FHIR resource types into existing site bundles: `Consent` resources for every full patient (100% consent rate is the design choice — the <100% fraction arises entirely from patient stubs in the denominator), and minimal stub `Patient` + `Encounter` resources that represent patients who exist in the real-world registry but have not yet enrolled in the research study.

The architectural approach is deliberately conservative: stubs are identified purely by the absence of `Observation` resources (no tags, no profiles), exclusion is enforced at a single chokepoint (`extractPatientCases` in `shared/patientCases.ts`), and the completeness metric is computed client-side from raw bundle inspection without any new server endpoint. The existing 6-bundle data model, deterministic Mulberry32 PRNG discipline, and CI verification gates all extend naturally to cover stubs and Consent.

All consumer surfaces (cohort builder, outcomes, quality review, case detail, charts, server aggregation) are protected by the single-chokepoint pattern — they never see stubs because they all flow through `extractPatientCases`, which will filter zero-Observation patients. The dashboard card uses a separate raw Patient count to build the denominator independently of the clinical-case pipeline.

**Primary recommendation:** Implement in four parallel streams: (1) augment the FHIR type system, (2) update the generator for synthetic bundles + write the augmentation script for reference bundles, (3) add the stub-exclusion filter at the `extractPatientCases` chokepoint and the raw-count helper, (4) build the LandingPage completeness card.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| FHIR Consent + stub generation (synthetic) | Build script | — | `generate-center-bundle.ts` owns all synthetic data; no runtime component involved |
| FHIR Consent + stub augmentation (reference) | Build script | — | New idempotent script appends to curated JSON files |
| Stub exclusion from clinical surfaces | Shared lib (`shared/patientCases.ts`) | — | Single chokepoint D-03; all clinical consumers flow through it |
| Raw patient count (denominator) | Frontend service (`src/services/fhirLoader.ts`) | — | Belongs alongside `extractCenters`; no server round-trip needed (D-08) |
| `extractCenters().patientCount` exclusion of stubs | Frontend service | — | D-04: per-center clinical count must exclude stubs |
| Datenvollzähligkeit card rendering | Frontend (`src/pages/LandingPage.tsx`) | — | Client-side metric (D-08), reads `bundles` from DataContext |
| Site-filter application to denominator | Frontend (`src/pages/LandingPage.tsx`) | — | `meta.source` on stub Patients enables filtering same as full patients |
| CI gate extension for stubs/Consent | Build scripts (`.mjs` audit scripts) | — | D-14; extends existing `audit-bundle-codes.mjs` + `verify-bundle-distributions.mjs` |

---

## Standard Stack

No new libraries introduced. All work uses the project's existing stack.

### Core (already in project)
| Asset | Version / Location | Purpose in Phase 34 |
|-------|-------------------|----------------------|
| Mulberry32 PRNG | `scripts/prng.ts` | Seeded stub generation — `mulberry32(seed)` + `seededRandInt` |
| `generate-center-bundle.ts` | `scripts/generate-center-bundle.ts` | Extended to emit Consent + stub Patient + stub Encounter for synthetic sites |
| `generate-all-bundles.ts` | `scripts/generate-all-bundles.ts` | Drives 4-bundle atomic regen; unchanged but re-run after generator update |
| `verify-bundle-distributions.mjs` | `scripts/verify-bundle-distributions.mjs` | Extended to assert stub ratio per site falls in [2, 8]× consented |
| `audit-bundle-codes.mjs` | `scripts/audit-bundle-codes.mjs` | Extended to whitelist Consent-related coding systems |
| `shared/types/fhir.ts` | `shared/types/fhir.ts` | New `Consent` + `Encounter` interfaces added here |
| `shared/patientCases.ts` | line 65 (`extractPatientCases`) | Stub exclusion filter added here (D-03) |
| `src/services/fhirLoader.ts` | line 51 (`extractCenters`) | `patientCount` adjusted to exclude stubs (D-04) |
| `src/pages/LandingPage.tsx` | line 45 (`totalPatients`) | New completeness card reads raw bundle count separately |
| Vitest | project-wide | Tests follow existing `queryByText().not.toBeNull()` / `.toBeNull()` pattern |

### No new npm dependencies
[VERIFIED: codebase inspection] All required capabilities are available in the existing stack.

---

## Architecture Patterns

### FHIR Bundle Data Flow

```
public/data/center-*.json (6 bundles)
  │
  ├─ center-{aachen,tuebingen}.json     [reference / curated]
  │     ← idempotent augmentation script appends:
  │          Consent (1 per full patient)
  │          stub Patient + stub Encounter (factor × consented)
  │
  └─ center-{chemnitz,greifswald,leipzig,muenster}.json   [synthetic]
        ← generate-center-bundle.ts (extended) emits:
             Patient (full)  → Consent attached
             Patient (stub)  → Encounter (minimal), no Observations
        ← generate-all-bundles.ts regenerates all 4 atomically

loadAllBundles()              [src/services/fhirLoader.ts]
  │
  ├─ extractCenters(bundles)  [src/services/fhirLoader.ts:51]
  │     → patientCount = Patients with ≥1 Observation (excludes stubs — D-04)
  │
  ├─ extractPatientCases(bundles)  [shared/patientCases.ts:65]
  │     → FILTER: drop zero-Observation patients (stubs) ← D-03 chokepoint
  │     → PatientCase[] (clinical set only)
  │     → consumed by: cohort builder, outcomes, quality, case detail, charts,
  │                    server/outcomesAggregateApi.ts (>1000-patient routing)
  │
  └─ rawPatientCount(bundles, centreIds?)  [new helper in fhirLoader.ts]
        → count ALL Patient resources filtered by current site set
        → denominator for Datenvollzähligkeit

DataContext
  ├─ bundles (FhirBundle[])  ← now contains Consent + stub Patient + Encounter
  ├─ centers (CenterInfo[])  ← patientCount = clinical only (no stubs)
  └─ cases (PatientCase[])   ← stubs excluded by extractPatientCases

LandingPage
  ├─ cases.length            = consented (non-stub) count  ← numerator (D-05/D-09)
  ├─ rawPatientCount(bundles, userSiteFilter)  = total (consented + stubs)  ← denominator (D-09)
  └─ Datenvollzähligkeit card: fraction, count display, progress bar, site-filter reactive
```

### Recommended Project Structure Changes

```
scripts/
├── generate-center-bundle.ts   # MODIFIED: emit Consent + stubs for synthetic sites
├── generate-all-bundles.ts     # unchanged (re-run triggers regen)
├── augment-reference-bundles.ts  # NEW: idempotent append-only script for Aachen + Tübingen
├── verify-bundle-distributions.mjs  # MODIFIED: add stub-ratio assertions
└── audit-bundle-codes.mjs       # MODIFIED: whitelist Consent coding system

shared/types/fhir.ts            # MODIFIED: add Consent + Encounter interfaces
shared/patientCases.ts          # MODIFIED: stub filter at extractPatientCases line 65

src/
├── services/fhirLoader.ts       # MODIFIED: extractCenters stub exclusion + rawPatientCount helper
├── pages/LandingPage.tsx        # MODIFIED: add DatavollzähligkeitCard; separate raw count
└── i18n/translations.ts         # MODIFIED: 4 new i18n keys

config/settings.yaml             # MODIFIED: stub config keys (factor range, possibly)

tests/
├── stubIsolation.test.ts        # NEW: regression test D-03 (no stub in extractPatientCases)
├── datenvollstaendigkeitCard.test.tsx  # NEW: card renders correct counts + site-filter behavior
├── augmentReferenceBundles.test.ts  # NEW: curated resources unchanged after augmentation (D-13)
└── synthBundleDistributions.test.ts  # MODIFIED: extend for stub ratios (D-14)
```

### Pattern 1: Stub Exclusion at extractPatientCases (D-03)

**What:** Filter patients with zero Observations before building PatientCase objects.
**When to use:** This is the ONE place — no other surfaces need modification.

```typescript
// Source: shared/patientCases.ts — existing function, add filter at top of patients.map()
export function extractPatientCases(bundles: BundleLike[]): PatientCase[] {
  const patients = resourcesOfType<Patient>(bundles, 'Patient');
  const observations = resourcesOfType<Observation>(bundles, 'Observation');
  // ...groupBySubject setup...

  // D-03: exclude stub Patients (zero Observations) before building cases
  const clinicalPatients = patients.filter((pat) => {
    const ref = `Patient/${pat.id}`;
    return (observationsByRef.get(ref) ?? []).length > 0;
  });

  return clinicalPatients.map((pat) => { /* existing logic */ });
}
```

Note: `groupBySubject` must be called BEFORE the filter so `observationsByRef` is available.

### Pattern 2: Raw Patient Count Helper for Denominator (D-09)

**What:** Count ALL Patient resources across permitted bundles (stubs + clinical).
**When to use:** Called from LandingPage to build the denominator.

```typescript
// Source: [ASSUMED] — new helper in src/services/fhirLoader.ts alongside extractCenters
export function countRawPatients(bundles: FhirBundle[], centerIds?: string[]): number {
  return bundles.flatMap((b) =>
    b.entry.filter((e) => {
      if (e.resource.resourceType !== 'Patient') return false;
      if (centerIds?.length) return centerIds.includes(e.resource.meta?.source ?? '');
      return true;
    })
  ).length;
}
```

The `centerIds` parameter is optional — when the site filter is active, pass the filtered center IDs. When user sees all bundles (server already filters by user's permitted centers), pass undefined.

### Pattern 3: Deterministic Stub Generation (D-11)

**What:** Per-site seeded random factor in [2, 8] controls stub count.
**When to use:** Inside `generateCenterBundle` after all full patients are emitted.

```typescript
// Source: scripts/generate-center-bundle.ts — extend after existing patient loop
const stubFactor = seededRandInt(rand, 2, 8);  // one draw per site
const stubCount = Math.round(patients * stubFactor);  // patients = consented count

for (let s = 1; s <= stubCount; s++) {
  const stubId = `pat-${sh}-stub-${String(s).padStart(4, '0')}`;
  const stubRef = `Patient/${stubId}`;
  // gender: rand() < 0.55 ? 'female' : 'male'  (same convention as full patients)
  // birthDate: YYYY-01-01 or YYYY-MM-DD with jitter — Claude's Discretion
  // one Encounter with a single visit date from baselineOffset range
  // meta.source = centerId (site attribution for filter — D-10)
}
```

### Pattern 4: Consent Resource Shape (D-07)

**What:** FHIR R4 Consent with provisions for each full patient.
**When to use:** One per non-stub Patient, in the same bundle.

```typescript
// Source: [CITED: https://hl7.org/fhir/R4/consent.html] — shape per D-07
{
  resourceType: 'Consent',
  id: `consent-${sh}-${patNum}`,
  status: 'active',
  scope: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/consentscope',
      code: 'research',
      display: 'Research'
    }]
  },
  category: [{
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'INFOACCESS',
      display: 'Information Access'
    }]
  }],
  patient: { reference: `Patient/${patId}` },
  organization: [{ reference: `Organization/${centerId}` }],
  dateTime: consentDate,  // ISO date — e.g. baseline or a random date after baseline
  policyRule: {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'OPTIN'
    }]
  },
  provision: {
    type: 'permit',
    purpose: [{
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
      code: 'HRESCH',
      display: 'healthcare research'
    }]
  }
}
```

### Pattern 5: Reference Bundle Augmentation (D-13)

**What:** Idempotent script that reads existing curated JSON, appends new resources, writes back.
**Key invariant:** The curated resources (by resource ID) MUST be byte-for-byte unchanged.

```typescript
// Source: [ASSUMED] — new script scripts/augment-reference-bundles.ts
// Idempotency check: skip if `consent-uka-001` already exists in bundle.entry
const alreadyAugmented = bundle.entry.some(
  (e) => e.resource.resourceType === 'Consent'
);
if (alreadyAugmented) {
  console.log(`[augment] ${file} already augmented — skipping`);
  return;
}
// Append Consent entries (one per existing Patient with ≥1 Observation)
// Append stub Patient + Encounter entries
// Write back with JSON.stringify(bundle, null, 2) + '\n'
// DO NOT mutate any existing entry
```

### Pattern 6: LandingPage Datenvollzähligkeit Card

**What:** New completeness card inserted between the KPI tile row and the Centers + Right-rail row.
**When to use:** Rendered only when `!loading` (inherits existing load guard).

Key points from the UI-SPEC:
- Uses existing `Tile` primitive without modification
- `ShieldCheck` icon from lucide-react (already installed) in a `teal-soft` bg container
- 32px semibold mono fraction display (`font-data`), color is semantic (sage ≥ 50%, amber 25–49%, coral < 25%)
- Progress bar: `h-1.5 rounded-full` — replicate MetricCard pattern (`src/components/doc-quality/MetricCard.tsx:29-33`)
- Full-width row between KPI tiles and the Centers + Right-rail row

```typescript
// Fraction color follows the semantic convention in CONTEXT.md D-10 / UI-SPEC
function completenessColor(fraction: number): string {
  if (fraction >= 0.50) return 'var(--color-sage)';
  if (fraction >= 0.25) return 'var(--color-amber)';
  return 'var(--color-coral)';
}
```

### Anti-Patterns to Avoid

- **Reading Consent resources to determine numerator:** D-05 explicitly forbids this. The numerator is structural (patients with observations). Consent is for data-model fidelity only.
- **Adding a tag/extension/profile to identify stubs:** D-01 explicitly forbids this. The zero-Observation absence IS the discriminator.
- **Counting stubs in `cases.length`:** `cases` flows through `extractPatientCases` which filters them. Never use `cases.length` as the denominator — always use the separate raw count (D-09).
- **Filtering stubs at multiple call sites:** All clinical consumers flow through `extractPatientCases`. Filtering there covers everything. Do NOT add per-consumer exclusion logic.
- **Regenerating reference bundles:** Project D-06 + CONTEXT.md D-13 forbid this. Always use the append-only augmentation script for Aachen and Tübingen.
- **Letting stub Encounters surface in the `encounterTimeline`:** The timeline in `useCaseData.ts` is built from `patientCase.observations` and `patientCase.procedures` — stubs never reach `PatientCase`, so this is automatically safe (stub Encounters live in raw bundles only, never extracted into `PatientCase`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Seeded random number generation | Custom PRNG | `mulberry32` from `scripts/prng.ts` | Already deterministic, battle-tested, byte-identical regen guaranteed |
| Stub count jitter | Ad-hoc `Math.random()` | `seededRandInt(rand, 2, 8)` | Non-seeded calls break byte-identical regen across runs |
| Fraction color logic | New color function | Follow `scoreColor` pattern from `src/utils/qualityMetrics.ts:51` | Existing semantic convention; thresholds from UI-SPEC (0.50/0.25) |
| Progress bar component | New primitive | Replicate MetricCard.tsx:29-33 | Identical `h-1.5 rounded-full` pattern already exists |
| FHIR bundle loading | Custom fetch | Existing `loadAllBundles()` + `DataContext.bundles` | Already wired, cached, auth-filtered server-side |

---

## Key Code Locations (Verified)

### extractPatientCases — stub exclusion goes here

[VERIFIED: codebase] `shared/patientCases.ts:65`

The current implementation maps over ALL patients without any stub check:
```typescript
// line 65-99: patients.map((pat) => { ... })
```
The D-03 filter must be inserted AFTER `groupBySubject(observations)` builds `observationsByRef` but BEFORE `patients.map`. The filter: keep only patients where `observationsByRef.get(`Patient/${pat.id}`)?.length > 0`.

### extractCenters — stub exclusion from patientCount (D-04)

[VERIFIED: codebase] `src/services/fhirLoader.ts:51-70`

Current `patientCount` (line 67):
```typescript
patientCount: orgPatients.length,  // orgPatients = ALL patients with meta.source === org.id
```
Must change to: exclude patients that have zero Observations in the bundle. Requires loading observations alongside patients in `extractCenters`, or using a helper that counts non-stub patients per center.

### LandingPage — totalPatients already uses clinical-only set (line 45)

[VERIFIED: codebase] `src/pages/LandingPage.tsx:45`
```typescript
const totalPatients = cases.length;  // cases = extractPatientCases output = clinical only
```
This stays unchanged. The NEW raw-count variable must be computed separately from `bundles`.

### DataContext — bundles already exposed

[VERIFIED: codebase] `src/context/DataContext.tsx:84` — `bundles` is already in `DataContextType` and exposed via `useData()`. LandingPage can call `const { bundles, cases } = useData()` — bundles provides the raw data for the denominator, cases provides the numerator.

### Site filter in LandingPage

[VERIFIED: codebase] The site filter is applied server-side — `loadBundlesFromSource` calls `/api/fhir/bundles` which filters by `req.auth.centers`. The client receives only permitted bundles. So `rawPatientCount(bundles)` (with no extra filter) already respects the per-user site restriction. For the cohort-builder's ad-hoc center filter (when a researcher narrows to a subset of their permitted sites), the `activeCenters` filter from the LandingPage sidebar would need to be applied to the denominator — but LandingPage does NOT currently have an ad-hoc center sub-filter; it shows all authorized data. Therefore `rawPatientCount(bundles)` with no filter argument is correct for the full-page display.

### Current bundle patient counts

[VERIFIED: public/data] Reference bundles: Aachen 35 patients, Tübingen 30 patients. Synthetic: Chemnitz, Greifswald, Leipzig, Münster each 45 patients. Total full patients = 200. With factor ∈ [2, 8], total stubs per site ≈ 2×–8× consented, so system total = 600–1800 stubs. Total Patient resources in bundles = 800–2000. Well within memory budget.

---

## Common Pitfalls

### Pitfall 1: Stub Factor Applied to Wrong Count

**What goes wrong:** `seededRandInt(rand, 2, 8)` is called correctly but `stubCount = factor * totalPatients` uses all bundle entries instead of only the non-stub patients.
**Why it happens:** `patients` array contains both full and stub entries if the generator calls `seededRandInt` before all patients are fully generated (circular reference).
**How to avoid:** Draw the stub factor AFTER the full patient loop completes. Use `patients` (the input parameter count, not an array length) as the consented count — synthetic bundles always have 100% consent.
**Warning signs:** Stub count varies between regenerations despite same seed.

### Pitfall 2: byte-identical Regen Broken by New rand() Calls

**What goes wrong:** Inserting new `rand()` calls into the existing patient loop shifts the PRNG state for all subsequent patients, producing different values.
**Why it happens:** Mulberry32 is stateful; every `rand()` call advances the sequence.
**How to avoid:** ALL new `rand()` calls (for Consent dateTime, stub birthDate, stub visit date, stub factor) must come AFTER the existing full-patient loop. Never interleave new draws with existing draws.
**Warning signs:** `npm run generate-bundles` produces different JSON than committed files.

### Pitfall 3: Raw Patient Count Includes Non-Patient Resource Entries

**What goes wrong:** `bundle.entry.filter(e => e.resource.resourceType === 'Patient').length` miscounts because it doesn't filter by site when multiple-bundle loading is active.
**Why it happens:** The bundles array from `loadAllBundles` already contains only the user's permitted bundles (server-side filtering). No extra center filtering is needed for the denominator at the page level.
**How to avoid:** The raw count helper does NOT need extra filtering beyond `resourceType === 'Patient'`. Trust the server's bundle-level restriction.

### Pitfall 4: Consent resources surfacing in audit-bundle-codes check

**What goes wrong:** `audit-bundle-codes.mjs` scans all resource types. Consent uses `http://terminology.hl7.org/CodeSystem/consentscope` and similar HL7 terminology systems that are not in the current whitelist.
**Why it happens:** The audit script has an explicit whitelist of WHITELIST_SYSTEMS (LOINC, ATC) and WHITELIST_KEYS. Consent coding systems are neither.
**How to avoid:** Add the Consent-related coding systems to the whitelist, OR (preferably) add them to EXPECTED_SEED_KEYS mirroring pattern. Given Consent codes are structural (not diagnosis-related), a WHITELIST_SYSTEMS extension is cleaner.
**Warning signs:** `npm run audit:bundles` exits 1 after Consent resources are added.

### Pitfall 5: Reference Bundle Augmentation Leaves Trailing Newline or Formatting Differences

**What goes wrong:** The augmented reference bundle differs from the generator's output format, causing downstream tests to fail unexpectedly.
**Why it happens:** JSON.stringify formatting choice or trailing whitespace.
**How to avoid:** Use `JSON.stringify(bundle, null, 2) + '\n'` — consistent with how `generate-all-bundles.ts` writes files (line 54: `JSON.stringify(bundle, null, 2) + '\n'`).

### Pitfall 6: Stub Encounters surfacing in useCaseData encounterTimeline

**What goes wrong:** Stub Encounters appear in the case detail timeline.
**Why it happens:** If Encounter resources were ever added to the PatientCase type and the `useCaseData.ts` hook, they would enumerate them.
**How to avoid:** The current `encounterTimeline` is computed from `observations` + `procedures` (not from FHIR Encounter resources). Stub Patients never reach `extractPatientCases` output, so they never reach `PatientCase`, so their Encounters are never loaded into `useCaseData`. No additional guard is needed — but DO NOT add Encounter to PatientCase or to `extractPatientCases`. The `Encounter` interface in `shared/types/fhir.ts` is for bundle typing only.

---

## Runtime State Inventory

Step 2.5 assessment: this is a DATA AUGMENTATION phase, not a rename/refactor. However, the bundle files are runtime-committed data assets.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `public/data/center-*.json` — 6 JSON bundle files committed to git | Synthetic: full regen via `npm run generate-bundles`. Reference: augmentation script appends resources. |
| Live service config | None — bundles are static files served by Express | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new config secrets | None |
| Build artifacts | None beyond the bundle JSON files | None |

**Nothing found in category "secrets/env vars":** Verified — `config/settings.yaml` only needs new stub-config keys (no secrets).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / tsx | `generate-center-bundle.ts` execution | Yes | Existing project | — |
| Vitest | Test suite | Yes | Existing project | — |
| `public/data/` bundle files | Augmentation script + tests | Yes | 6 files present | — |

No missing dependencies identified.

---

## Validation Architecture

`workflow.nyquist_validation` key is absent from `.planning/config.json` — treating as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vite.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=verbose --run tests/stubIsolation.test.ts` |
| Full suite command | `npm run test:ci` (includes audit:bundles) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | `extractPatientCases` output contains no stub (zero-Obs) patient | unit | `npm test -- --run tests/stubIsolation.test.ts` | No — Wave 0 |
| DASH-01 | `extractCenters().patientCount` excludes stubs | unit | `npm test -- --run tests/stubIsolation.test.ts` | No — Wave 0 |
| DASH-01 | Datenvollzähligkeit card renders correct fraction/counts | unit (RTL) | `npm test -- --run tests/datenvollstaendigkeitCard.test.tsx` | No — Wave 0 |
| DASH-01 | Card updates when site filter changes | unit (RTL) | Same test file | No — Wave 0 |
| DASH-01 | Reference bundle curated resources unchanged after augmentation (D-13) | unit | `npm test -- --run tests/augmentReferenceBundles.test.ts` | No — Wave 0 |
| DASH-01 | Synthetic bundle stub ratio in [2, 8]× per site | integration | `node scripts/verify-bundle-distributions.mjs` | No — extend existing |
| DASH-01 | Consent coding systems pass audit gate | integration | `node scripts/audit-bundle-codes.mjs` | No — extend existing |

### Sampling Rate

- **Per task commit:** `npm test -- --run tests/stubIsolation.test.ts tests/datenvollstaendigkeitCard.test.tsx`
- **Per wave merge:** `npm run test:ci`
- **Phase gate:** Full suite green (`npm run test:ci`, 619+ tests passing) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/stubIsolation.test.ts` — covers D-03 (extractPatientCases regression) + D-04 (extractCenters patientCount)
- [ ] `tests/datenvollstaendigkeitCard.test.tsx` — covers card rendering, fraction display, site-filter reactivity
- [ ] `tests/augmentReferenceBundles.test.ts` — covers D-13 byte-identical curated resources assertion + idempotency

---

## Security Domain

Phase 34 adds FHIR data resources and a read-only dashboard card. No new auth surfaces, no new endpoints, no new cryptographic operations.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing JWT / session (unchanged) |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes — stubs must not bypass center restriction | `meta.source` on stub Patient → server `filterBundlesByCenters` already enforces this |
| V5 Input Validation | no | No new user inputs |
| V6 Cryptography | no | Mulberry32 is for data determinism, not security |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stub appearing in clinical cohort | Tampering | D-03 chokepoint filter at `extractPatientCases`; regression test |
| Completeness denominator inflated by non-permitted sites | Information Disclosure | Denominator uses `bundles` already filtered server-side by `req.auth.centers` |
| Reference bundle curated data mutated by augmentation | Tampering | D-13 append-only constraint + `augmentReferenceBundles.test.ts` byte-equality assertion |

---

## Open Questions

1. **birthDate representation for stubs (Claude's Discretion)**
   - What we know: CONTEXT.md flags this as Claude's Discretion; existing generator uses `YYYY-MM-DD` with age-derived day jitter.
   - What's unclear: Whether `YYYY-01-01` (year-only, minimal) or a jittered date (realistic but still year-constrained) is preferable.
   - Recommendation: Use `YYYY-01-01` for stubs. Stubs are intentionally minimal (D-02). The `01-01` form makes their year-of-birth origin obvious and distinguishable without requiring a discriminator field.

2. **settings.yaml stub config keys**
   - What we know: CONTEXT.md leaves key names as Claude's Discretion; the [2, 8] range is currently hardcoded in the decision.
   - Recommendation: Add a `stubs.factorMin: 2` and `stubs.factorMax: 8` key pair to `config/settings.yaml` under a new `stubs:` section. Keep the range exposed as config per D-11's spirit ("configurable multiplier" from REQUIREMENTS.md).

3. **Whether augmentation script shares a helper with generator**
   - What we know: Both need to emit Consent resources and stub Patient + Encounter. CONTEXT.md marks this as Claude's Discretion.
   - Recommendation: Extract a `buildConsentEntry(patId, centerId, date, rand)` and `buildStubEntries(centerId, rand, count, existingSeed)` into a shared `scripts/bundleBuilders.ts` helper imported by both `generate-center-bundle.ts` and `augment-reference-bundles.ts`. This avoids drift between Consent shapes across synthetic/reference bundles.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Stub Encounters do not currently surface in any app view (confirmed by code inspection that encounterTimeline is built from obs+procedures, not FHIR Encounter resources) | Anti-Patterns / Pitfall 6 | If Encounter is enumerated anywhere, stub Encounters could appear in case detail — need additional guard |
| A2 | `rawPatientCount(bundles)` requires no extra center-filter because server already filters bundles by user's permitted centers | Key Code Locations | If client-side center sub-filtering is added to LandingPage in a future phase, the denominator logic would need updating |
| A3 | The [2, 8] stub factor should be applied to the input `patients` count (= consented count for synthetic sites with 100% consent) | Pattern 3 | If the generator is later extended to model partial consent among full patients, the factor base must be revisited |

---

## Sources

### Primary (HIGH confidence — verified by direct code inspection)

- `shared/patientCases.ts` — `extractPatientCases` function, lines 65–99; stub exclusion point
- `src/services/fhirLoader.ts` — `extractCenters` lines 51–70; `patientCount` line 67
- `src/pages/LandingPage.tsx` — full file; `totalPatients = cases.length` line 45; KPI card pattern lines 136–158
- `src/context/DataContext.tsx` — `DataContextType` interface; `bundles` exposed in context
- `scripts/generate-center-bundle.ts` — complete generator; patient loop lines 352–581; seed/PRNG pattern
- `scripts/generate-all-bundles.ts` — atomic 4-bundle regen; per-site seeds
- `scripts/prng.ts` — Mulberry32; `seededRandInt`; `addDays`
- `scripts/verify-bundle-distributions.mjs` — distribution gate structure; SYNTHETIC_PATTERN regex
- `scripts/audit-bundle-codes.mjs` — WHITELIST_SYSTEMS; EXPECTED_SEED_KEYS
- `shared/types/fhir.ts` — `Patient`, `FhirBundle`, `FhirBundleEntry`; no Consent/Encounter yet
- `config/settings.yaml` — single config source; existing key structure
- `src/i18n/translations.ts` — key naming convention (`camelCase: { de: '…', en: '…' }`)
- `src/components/doc-quality/MetricCard.tsx` — progress bar pattern lines 31–36
- `server/fhirApi.ts` — `filterBundlesByCenters`; center restriction mechanics

### Secondary (MEDIUM confidence — official docs)

- [CITED: https://hl7.org/fhir/R4/consent.html] — FHIR R4 Consent resource shape; `status`, `scope`, `category`, `policyRule`, `provision` fields
- [CITED: https://terminology.hl7.org/CodeSystem/consentscope] — `research` code for Consent.scope
- [CITED: https://terminology.hl7.org/CodeSystem/v3-ActCode] — `OPTIN` policyRule code; `INFOACCESS` category

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing libraries verified in codebase
- Architecture: HIGH — all call sites, data flows, and chokepoints verified by direct file inspection
- Pitfalls: HIGH — code-derived; PRNG call-order risk derived from existing generator structure
- FHIR Consent shape: MEDIUM — referenced from official HL7 docs; exact fields per D-07 specification

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable stack; no fast-moving dependencies)
