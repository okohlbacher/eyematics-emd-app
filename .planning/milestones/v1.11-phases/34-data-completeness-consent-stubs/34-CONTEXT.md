# Phase 34: Data Completeness (Consent + Stubs) - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

> **Decision IDs (`D-NN`) below are phase-local.** Carried-forward project
> decisions are referenced by descriptive name (e.g. "project D-06 — curated
> reference bundles must not be regenerated") to avoid collision with the
> global decision log.

<domain>
## Phase Boundary

Add a FHIR Consent + patient-stub model so the dashboard can surface
**Datenvollzähligkeit** = consented ÷ total patients (the fraction of patients
amenable to research), with patient stubs **strictly isolated** from every
clinical surface (DASH-01 / source DAT-003).

**In scope:**
- FHIR `Consent` resources (research-use, with provisions) added to every full
  (non-stub) patient across all 6 sites.
- Patient **stubs** — demographically-only FHIR `Patient` resources (gender,
  year of birth, one encounter date as a minimal `Encounter`) carrying **no**
  Observations or other clinical resources — generated for **all** sites.
- A single **Datenvollzähligkeit summary card** on `LandingPage` (total =
  consented + stubs, consented count, and the fraction), respecting the site
  filter and per-user site restriction.
- Stub isolation enforced at the single extraction chokepoint so stubs never
  reach cohort building, outcomes/trajectories, quality review, case detail, or
  charts — and never inflate the >1000-patient server-aggregation routing.

**Out of scope:**
- Any change to the clinical analytics surfaces beyond excluding stubs.
- A server endpoint for the metric (computed client-side — D-08).
- Self-service or real-consent capture flows (synthetic/curated data only).
- Multi-level consent modeling beyond a single active research Consent per full
  patient.
- Regenerating curated reference clinical data (project D-06 forbids it — stubs
  and Consent are *appended* to reference bundles, never a regeneration).
</domain>

<decisions>
## Implementation Decisions

### Stub isolation (H2)
- **D-01:** Stubs are **real FHIR `Patient` resources** living in the same
  site bundles, distinguished **structurally**: a stub Patient has **zero
  `Observation` resources**. Recognition is by that absence at import — **no
  tag, profile, or extension** is used as the discriminator (chosen by the
  user over tag/separate-record/separate-bundle approaches).
- **D-02:** Each stub carries **only** `gender` (m/f), **year of birth**
  (`birthDate`), and **one encounter date** modeled as a **minimal,
  site-attributed FHIR `Encounter` resource**. No Conditions, Procedures,
  MedicationStatements, ImagingStudies, or Observations.
- **D-03:** Stub exclusion is enforced at the **single chokepoint
  `extractPatientCases`** (`shared/patientCases.ts:64`): it drops
  zero-Observation patients, so every clinical consumer (cohort builder,
  outcomes/trajectories, quality, case detail, charts, server aggregation) is
  clean **by construction** — one edit, one guarantee. A **regression test**
  asserts no stub pseudonym ever appears in `extractPatientCases` output.
- **D-04:** `extractCenters().patientCount` (`src/services/fhirLoader.ts:67`)
  **also excludes stubs**, so the per-center count keeps meaning
  clinically-real (consented) patients and existing per-center displays stay
  unchanged in value. Stubs surface **only** in the new completeness
  denominator.

### Consent model & "consented" definition
- **D-05:** The Datenvollzähligkeit **numerator (consented count) is computed
  structurally** as patients-with-Observations (= non-stubs). The metric does
  **not** read `Consent` resources. (Consent resources are added for
  data-model fidelity, but counting keys off clinical emptiness — same rule as
  stub recognition, D-01.)
- **D-06 (local):** **Every full (non-stub) patient gets one active research
  `Consent`** (= 100% of non-stubs consented). The <100% completeness fraction
  comes **entirely from stubs** in the denominator. Stubs have no Consent.
- **D-07:** Consent shape is a **richer FHIR `Consent` with provisions**:
  `status: active`, a research scope/category, patient + site reference, a
  `policyRule`/`dateTime`, and `Consent.provision` detail (permit, purpose).

### Metric computation & dashboard display
- **D-08:** Datenvollzähligkeit is computed **client-side from the loaded
  bundles**, reusing the existing client bundle load (no server endpoint).
  Because `extractPatientCases` excludes stubs (D-03), the >1000-patient
  outcomes-aggregation patient set is unchanged — **no routing regression**.
- **D-09:** The denominator MUST come from a **separate raw Patient count over
  the bundles** — NOT `cases.length` / `totalPatients`
  (`src/pages/LandingPage.tsx:45`), which is already the non-stub clinical set.
  Numerator = non-stub count (D-05); denominator = raw total Patients
  (consented + stubs).
- **D-10:** The dashboard shows **one Datenvollzähligkeit summary card** on
  `LandingPage`: total patients (consented + stubs), consented count, and the
  fraction. It reflects the **current site filter and per-user site
  restriction** — stubs are **site-attributed** via `meta.source`, so filtering
  works.

### Stub generation & reference-bundle handling
- **D-11:** **Per-site random factor in [2, 8]** — each site's stub count ≈
  `factor × consentedCount`, with `factor` drawn from [2, 8] **once at
  generation**, **deterministically seeded** (Mulberry32 per-site seed, same
  discipline as the generator) so bundles stay **byte-identical across
  reruns**. The factor is fixed in output, not re-rolled per load. Per-site
  Datenvollzähligkeit therefore varies (~11%–33%).
- **D-12:** **Both synthetic AND reference sites get stubs.** Synthetic sites
  (Chemnitz, Greifswald, Leipzig, Münster) get Consent + stubs via the
  generator (`scripts/generate-center-bundle.ts`), with all 4 synthetic bundles
  regenerated **atomically** (project D-11 atomic-commit pattern). Reference
  sites (Aachen, Tübingen) get Consent + stubs via an **idempotent augmentation
  script**.
- **D-13:** Reference augmentation is **append-only**: the script appends
  `Consent` + stub `Patient` + stub `Encounter` resources and leaves **every
  pre-existing curated resource byte-for-byte identical** (honors project D-06).
  A **test asserts the curated resource set is unchanged**; the script is
  **idempotent / re-runnable** (skips already-augmented patients/sites).
- **D-14:** Existing CI byte-stability + distribution gates
  (`scripts/verify-bundle-distributions.mjs`, `scripts/audit-bundle-codes.mjs`)
  are **extended to cover stubs and Consent** so the new resources stay
  reproducible and don't break the 0-unresolvable-codes gate.

### Claude's Discretion
- `birthDate` representation for "year of birth" (e.g. `YYYY-01-01` vs jittered
  within the year) — keep consistent with the generator's existing demographic
  conventions.
- New TS types: a `Consent` and an `Encounter` interface in
  `shared/types/fhir.ts` (neither exists today) + re-export via
  `src/types/fhir.ts`.
- Exact `config/settings.yaml` key names for stub config; whether the [2, 8]
  factor *range* itself is exposed as config.
- DE/EN i18n keys for the Datenvollzähligkeit card labels (follow `t()` +
  `src/i18n/translations.ts`).
- Exact card layout / placement on `LandingPage` — defer to UI-SPEC.
- Whether the generator and the reference-augmentation script share a common
  stub/Consent builder helper (DRY) or stay separate.
- Guarding that the new `Encounter` resources don't leak into any surface that
  enumerates Encounters (none does today, but verify).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec
- `.planning/ROADMAP.md` §"Phase 34: Data Completeness (Consent + Stubs)" —
  goal + 4 success criteria incl. the H2 stub-isolation criterion (authoritative).
- `.planning/REQUIREMENTS.md` §"Dashboard / Data Completeness (DASH)" lines
  24–31 (DASH-01 full text, incl. the stub-isolation clause and the
  reference-bundle constraint).

### Isolation chokepoints (edit / guard)
- `shared/patientCases.ts:64` — `extractPatientCases`: the single extraction
  point all clinical surfaces flow through; drop zero-Observation patients here
  (D-03). `applyFilters` (line 111) consumes its output.
- `src/services/fhirLoader.ts:51-69` — `extractCenters` / `patientCount`
  (line 67): exclude stubs from the per-center clinical count (D-04).
- `src/pages/LandingPage.tsx:45` — `totalPatients = cases.length` (already the
  non-stub set); :82 summary tile; :213 per-center `patientCount`. The new
  completeness card needs a **separate raw count** (D-09).

### Generation / data
- `scripts/generate-center-bundle.ts` — synthetic Patient build (~lines
  357–389), Organization (~338), seed-derived `meta.lastUpdated` for
  byte-identical regen (~586). Add Consent + stubs here for the 4 synthetic
  sites (D-12); per-site [2,8] seeded factor (D-11).
- `public/data/center-{aachen,chemnitz,greifswald,leipzig,muenster,tuebingen}.json`
  + `public/data/manifest.json` — the 6 site bundles. Aachen + Tübingen are the
  curated reference bundles (append-only augmentation — D-13).
- `scripts/verify-bundle-distributions.mjs`, `scripts/audit-bundle-codes.mjs` —
  CI gates wired into `test:ci`; extend for stubs/Consent (D-14).
- `config/settings.yaml` — single config source (no env vars); any stub config
  lives here.

### Types
- `shared/types/fhir.ts` — `Patient` (line 47), `PatientCase` (145),
  `CenterInfo` (136), `FhirBundle` (124). No `Consent`/`Encounter` yet — add
  them. Re-exported to `src/` via `src/types/fhir.ts`.

### Carried-forward decision sources
- `.planning/PROJECT.md` §"Key Decisions" — project D-06 (reference bundles
  curated, must not regenerate), project D-11 (atomic 4-bundle commit),
  Mulberry32 determinism + two-layer distribution verifier pattern (v1.9.5).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `extractPatientCases` (`shared/patientCases.ts:64`) — single FHIR→PatientCase
  extraction consumed by cohort builder, AnalysisPage, OutcomesView, quality,
  and `server/outcomesAggregateApi.ts`. Filtering stubs here covers them all.
- `extractCenters` (`src/services/fhirLoader.ts:51`) — per-center counts; the
  natural home for the raw vs consented split (D-04/D-09).
- `scripts/generate-center-bundle.ts` — deterministic Mulberry32 generator
  (`addDays`, seeded RNG, byte-identical output) — the model for seeded stub
  generation (D-11).
- v1.9.5 distribution-verifier pattern (`verify-bundle-distributions.mjs`) —
  two-layer "unit test asserts loose bound, verifier asserts shipped-bundle
  bound" approach to extend for stub ratios (D-14).

### Established Patterns
- Deterministic synthetic data: Mulberry32 seed → byte-identical regen;
  4 synthetic bundles committed atomically (project D-11).
- Curated reference bundles (Aachen, Tübingen) are never regenerated
  (project D-06) — only append-only augmentation is allowed (D-13).
- Config from `config/settings.yaml` only; camelCase TS, wire/FHIR strings
  unchanged (project D-05); throw-only error handling (project D-03).
- Tests: Vitest, no jest-dom, `queryByText().not.toBeNull()` / `.toBeNull()`;
  ESM `.mjs` audit scripts hand-mirror TS constants with a drift-guard test.
  Baseline must stay green (783/783 at v1.10; ~828 after Phase 32).

### Integration Points
- Bundle load: `loadAllBundles` → `extractPatientCases` (stubs filtered, D-03)
  → all clinical surfaces; **and** a parallel raw count → completeness metric
  (D-08/D-09).
- Dashboard: `LandingPage` renders the new Datenvollzähligkeit card from the raw
  + non-stub counts, honoring the site filter (D-10).
- Site attribution: stub `Patient.meta.source` = site id, so site filtering and
  per-user restriction apply to the denominator.
</code_context>

<specifics>
## Specific Ideas

- Stub = FHIR Patient with **zero Observations** + a minimal `Encounter`; that
  emptiness IS the recognition signal at import (user's explicit framing).
- The completeness numerator counts **patients with observations**, not Consent
  resources — Consent is for fidelity, recognition is structural.
- Per-site stub multiplier is a **seeded random factor in [2, 8]**, fixed once
  at generation — sites should look different (~11%–33% completeness), not
  uniform.
- Reference sites (Aachen, Tübingen) get **both** Consent and stubs, via
  append-only augmentation that leaves curated resources byte-untouched.
- All full patients are consented (100%); the gap is the stub population.
</specifics>

<deferred>
## Deferred Ideas

- A server-side completeness endpoint — rejected for now (client count is cheap,
  D-08); revisit only if the count must be authoritative server-side.
- Modeling a partial consent rate among full patients (some full patients
  declining research consent) — deferred; all full patients consented (D-06
  local).
- Making the metric read Consent resources instead of clinical emptiness —
  deferred; would matter only when real data carries non-consented full
  patients.
- Exposing stub demographics (gender/birth-year) anywhere in the UI beyond the
  aggregate completeness count — out of scope (stubs are denominator-only).

</deferred>

---

*Phase: 34-data-completeness-consent-stubs*
*Context gathered: 2026-05-22*
