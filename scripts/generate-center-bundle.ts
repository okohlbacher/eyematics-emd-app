/**
 * scripts/generate-center-bundle.ts
 *
 * Library + CLI that emits a deterministic, structurally-valid FHIR R4 Bundle
 * for a single ophthalmology center. The bundle shape mirrors the reference
 * `public/data/center-aachen.json` file but is generated from a seeded PRNG so
 * the same `seed` always yields byte-identical JSON.
 *
 * Resource types covered: Organization, Patient, Condition,
 * Observation (visus / CRT / IOP / HbA1c — DME only),
 * Procedure (IVOM), MedicationStatement.
 * Drug mix per cohort (D-09): Aflibercept + Bevacizumab everywhere;
 * Faricimab in DME; Dexamethasone (intravitreal implant) in RVO.
 * NO ImagingStudy is emitted — the OCT jpeg asset library only contains
 * images for the kept curated sites (Aachen, Tübingen). Adding ImagingStudy
 * references for synthetic sites would create broken links in the case
 * detail view.
 *
 * CLI usage (invoked via tsx):
 *   node --import tsx scripts/generate-center-bundle.ts \
 *     --center-id org-ukc --shorthand UKC --name "Universitätsklinikum Chemnitz" \
 *     --city Chemnitz --state SN --output public/data/center-chemnitz.json \
 *     --patients 45 --seed 70103
 *
 * Threat model anchors (see 07-02-PLAN.md):
 *   T-07-06 (Integrity): determinism is enforced by Mulberry32 PRNG +
 *           seed-derived meta.lastUpdated + JSON.stringify(_, null, 2).
 *   T-07-07 (DoS): patient count is hard-capped at 500.
 */

import fs from 'node:fs';

import { loadStubFactorBounds } from './loadStubConfig.js';
import { addDays, mulberry32, seededRandInt } from './prng.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CohortMix {
  amd: number;
  dme: number;
  rvo: number;
}

export interface GenerateCenterBundleInput {
  centerId: string;
  shorthand: string;
  name: string;
  city: string;
  state: string;
  patients: number;
  seed: number;
  cohortMix?: CohortMix;
}

// Hard cap mitigates threat T-07-07 (Denial of Service via runaway generation).
const MAX_PATIENTS = 500;

// ---------------------------------------------------------------------------
// Phase 26 / SYNTH-03 / D-08 — Truncated-normal sampling helpers.
// All randomness flows through `rand` (Mulberry32) — Box-Muller transform
// uses two rand() draws per Gaussian sample. Rejection-sampling outside
// [lo, hi]; on >50 rejections, clamp to nearest bound (defensive).
// ---------------------------------------------------------------------------

function truncNormal(rand: () => number, mean: number, sd: number, lo: number, hi: number): number {
  for (let i = 0; i < 50; i++) {
    // Box-Muller: two uniform → one standard normal.
    const u1 = Math.max(rand(), 1e-12); // avoid log(0)
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const x = mean + sd * z;
    if (x >= lo && x <= hi) return x;
  }
  // Defensive clamp after retry budget. We re-derive one final sample and clamp.
  const u1 = Math.max(rand(), 1e-12);
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const x = mean + sd * z;
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Phase 26 / SYNTH-03 / D-08 — Age sampling per primary disease.
 * - amd: truncNormal(75, 8, 60, 95)  — Pham 2024 AOK PLUS prevalence shape
 * - dme: truncNormal(65, 8, 50, 80)
 * - rvo: truncNormal(68, 10, 55, 85)
 * Returns floored integer years.
 */
function sampleAge(primary: 'amd' | 'dme' | 'rvo', rand: () => number): number {
  switch (primary) {
    case 'amd':
      return Math.floor(truncNormal(rand, 75, 8, 60, 95));
    case 'dme':
      return Math.floor(truncNormal(rand, 65, 8, 50, 80));
    case 'rvo':
      return Math.floor(truncNormal(rand, 68, 10, 55, 85));
  }
}

// ---------------------------------------------------------------------------
// Code dictionaries (FHIR coding constants)
// ---------------------------------------------------------------------------

const SNOMED = 'http://snomed.info/sct';
const LOINC = 'http://loinc.org';
const ATC = 'http://www.whocc.no/atc';
// Phase 26 / SYNTH-02 / D-05: BfArM ICD-10-GM system URL for comorbidities.
const ICD10_GM = 'http://fhir.de/CodeSystem/bfarm/icd-10-gm';

const COHORT_CODES = {
  amd: { code: '267718000', display: 'Age-related macular degeneration' },
  dme: { code: '312903003', display: 'Diabetic macular edema' },
  rvo: { code: '362098006', display: 'Retinal vein occlusion' },
} as const;

// Phase 26 / SYNTH-02 / D-04: Comorbidity ICD-10-GM dictionary.
// NOTE: D-04 mentions DR (E11/E10 primary) AND DME both getting diabetes.
// This generator only emits AMD/DME/RVO cohorts (no 'dr' key — see COHORT_CODES);
// DR-style E11-as-primary cases exist only in the curated Aachen/Tübingen
// reference bundles (D-06 — NOT regenerated here). DME→diabetes rule below
// is the only diabetes-comorbidity path in synthetic bundles.
const COMORBIDITY_CODES = {
  I10: { system: ICD10_GM, code: 'I10', display: 'Essential hypertension' },
  E78_0: { system: ICD10_GM, code: 'E78.0', display: 'Hypercholesterolemia' },
  I25_1: { system: ICD10_GM, code: 'I25.1', display: 'Coronary artery disease' },
  E11_9: { system: ICD10_GM, code: 'E11.9', display: 'Type 2 diabetes mellitus' },
  E10_9: { system: ICD10_GM, code: 'E10.9', display: 'Type 1 diabetes mellitus' },
} as const;
const NON_OPHTHALMIC = { code: 'non-ophthalmic', display: 'Non-ophthalmic' };

interface ComorbidityPick {
  codeKey: keyof typeof COMORBIDITY_CODES;
}

/**
 * Phase 26 / SYNTH-02 — Disease-conditional comorbidity sampling.
 * Deterministic: all randomness flows through `rand` (Mulberry32).
 * Probability table from D-04 (AOK PLUS / Pham 2024 calibration).
 */
function sampleComorbidities(
  primary: 'amd' | 'dme' | 'rvo',
  ageAtBaseline: number,
  rand: () => number,
): ComorbidityPick[] {
  const picks: ComorbidityPick[] = [];
  if (primary === 'amd') {
    // Phase 26 / SYNTH-04 calibration: bumped <70 bracket from 0.30 → 0.50
    // and 70–80 bracket from 0.60 → 0.70 so the aggregate AMD comorbidity
    // rate across all 4 synthetic sites clears the binding D-12 ≥60%
    // threshold. Age correlation (older > younger) is preserved.
    const probAny = ageAtBaseline < 70 ? 0.55 : ageAtBaseline <= 80 ? 0.75 : 0.9;
    const targetCount = ageAtBaseline > 80 ? (rand() < 0.5 ? 2 : 1) : 1;
    if (rand() < probAny) {
      const pool: Array<keyof typeof COMORBIDITY_CODES> = ['I10', 'E78_0', 'I25_1'];
      const chosen = new Set<keyof typeof COMORBIDITY_CODES>();
      while (chosen.size < targetCount && chosen.size < pool.length) {
        chosen.add(pool[Math.floor(rand() * pool.length)]!);
      }
      for (const k of chosen) picks.push({ codeKey: k });
    }
  } else if (primary === 'dme') {
    picks.push({ codeKey: rand() < 0.8 ? 'E11_9' : 'E10_9' });
    if (rand() < 0.4) picks.push({ codeKey: 'I10' });
  } else if (primary === 'rvo') {
    if (rand() < 0.5) picks.push({ codeKey: 'I10' });
    if (rand() < 0.3) picks.push({ codeKey: 'E78_0' });
  }
  return picks;
}

const EYE_RIGHT = { system: SNOMED, code: '362503005', display: 'Right eye' };
const EYE_LEFT = { system: SNOMED, code: '362502000', display: 'Left eye' };

const VISUS_CODE = { system: LOINC, code: '79880-1', display: 'Visual acuity' };
const CRT_CODE = { system: LOINC, code: 'LP267955-5', display: 'Central retinal thickness' };
const IOP_CODE = { system: LOINC, code: '56844-4', display: 'Intraocular pressure' };
// Phase 26 / SYNTH-03 / D-07 — HbA1c (LOINC 4548-4) for DME patients.
const HBA1C_CODE = { system: LOINC, code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total' };
const UCUM = 'http://unitsofmeasure.org';

const IVOM_CODE = { system: SNOMED, code: '36189003', display: 'Intravitreal injection' };

const AFLIBERCEPT = { system: ATC, code: 'S01LA05', display: 'Aflibercept' };
const BEVACIZUMAB = { system: ATC, code: 'L01XC07', display: 'Bevacizumab' };
// Phase 26 / SYNTH-03 / D-09 — additional anti-VEGF agents in the drug mix.
// Faricimab: ATC S01LA09 (anti-VEGF/Ang2 bispecific).
// Dexamethasone intravitreal implant: defaulting to ATC S01BA01 (ophthalmic
// dexamethasone) to keep the existing ATC-only pattern; SNOMED 424425001 is
// the alternative coding for the Ozurdex implant but introduces a coding-
// system mix. Documented in D-09.
const FARICIMAB = { system: ATC, code: 'S01LA09', display: 'Faricimab' };
const DEXAMETHASONE = { system: ATC, code: 'S01BA01', display: 'Dexamethasone (intravitreal implant)' };

// Phase 26 / SYNTH-03 / D-09 — per-cohort template constants.
// `drugs` is a CDF: pick first entry where rand() ≤ p.
type DrugCdfEntry = { p: number; drug: { system: string; code: string; display: string } };
interface CohortTemplate {
  ivi: readonly [number, number];
  crtBase: readonly [number, number];
  drugs: readonly DrugCdfEntry[];
  bilateralProb: number;
  visusBase: readonly [number, number];
}
const TEMPLATES: Record<'amd' | 'dme' | 'rvo', CohortTemplate> = {
  amd: {
    ivi: [1, 22],
    crtBase: [280, 500],
    drugs: [
      { p: 0.80, drug: AFLIBERCEPT },
      { p: 1.00, drug: BEVACIZUMAB },
    ],
    bilateralProb: 0.30,
    visusBase: [0.05, 0.45],
  },
  dme: {
    ivi: [1, 12],
    crtBase: [350, 600],
    drugs: [
      { p: 0.60, drug: AFLIBERCEPT },
      { p: 0.95, drug: BEVACIZUMAB },
      { p: 1.00, drug: FARICIMAB },
    ],
    bilateralProb: 0.60,
    visusBase: [0.10, 0.50],
  },
  rvo: {
    ivi: [1, 8],
    crtBase: [350, 650],
    drugs: [
      { p: 0.70, drug: AFLIBERCEPT },
      { p: 0.90, drug: BEVACIZUMAB },
      { p: 1.00, drug: DEXAMETHASONE },
    ],
    bilateralProb: 0.05,
    visusBase: [0.05, 0.35],
  },
} as const;

function pickDrugFromCdf(cdf: readonly DrugCdfEntry[], rand: () => number): DrugCdfEntry['drug'] {
  const r = rand();
  for (const entry of cdf) {
    if (r <= entry.p) return entry.drug;
  }
  return cdf[cdf.length - 1]!.drug;
}

const BCVA_METHOD = { system: SNOMED, code: '252886007', display: 'Best corrected visual acuity' };

/**
 * Phase 26 / SYNTH-03 / D-07 — HbA1c emission for DME patients.
 *
 * Emits 2–5 Observations per patient (LOINC 4548-4):
 *   - First value sampled in [7.5, 10.5]
 *   - Subsequent values: prev + (rand() − 0.6) * 1.5  (drift toward ~7%)
 *     clamped to [5.0, 13.0]; step magnitude clipped to ±1.5
 *   - Rounded to 1 decimal place
 *   - effectiveDateTime drawn from `visitDates` (distinct ascending indices)
 *   - valueQuantity carries unit/code "%" + UCUM system per D-07
 */
function emitHbA1c(args: {
  ref: string;
  patIdSuffix: string; // e.g. `<sh>-<patNum>`
  visitDates: string[];
  rand: () => number;
}): unknown[] {
  const { ref, patIdSuffix, visitDates, rand } = args;
  if (visitDates.length === 0) return [];
  const target = seededRandInt(rand, 2, 5);
  const readingCount = Math.min(target, visitDates.length);

  // Pick `readingCount` distinct visit indices, then sort ascending so dates
  // appear in chronological order.
  const indices = new Set<number>();
  let guard = 0;
  while (indices.size < readingCount && guard < 200) {
    indices.add(Math.floor(rand() * visitDates.length));
    guard++;
  }
  const sortedIdx = [...indices].sort((a, b) => a - b);

  const out: unknown[] = [];
  let prev = 7.5 + rand() * 3.0; // [7.5, 10.5]
  for (let k = 0; k < sortedIdx.length; k++) {
    let value: number;
    if (k === 0) {
      value = prev;
    } else {
      let step = (rand() - 0.6) * 1.5;
      if (step > 1.5) step = 1.5;
      if (step < -1.5) step = -1.5;
      value = Math.min(13.0, Math.max(5.0, prev + step));
    }
    const rounded = Math.round(value * 10) / 10;
    prev = rounded;
    out.push({
      resource: {
        resourceType: 'Observation',
        id: `obs-${patIdSuffix}-hba1c-${k + 1}`,
        status: 'final',
        subject: { reference: ref },
        code: { coding: [HBA1C_CODE] },
        effectiveDateTime: visitDates[sortedIdx[k]!],
        valueQuantity: { value: rounded, unit: '%', code: '%', system: UCUM },
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Library entry point
// ---------------------------------------------------------------------------

export function generateCenterBundle(input: GenerateCenterBundleInput): unknown {
  const {
    centerId,
    shorthand,
    name,
    city,
    state,
    patients,
    seed,
    cohortMix = { amd: 0.55, dme: 0.3, rvo: 0.15 },
  } = input;

  if (patients > MAX_PATIENTS) {
    throw new Error(`generateCenterBundle: patients ${patients} exceeds hard cap ${MAX_PATIENTS} (T-07-07)`);
  }
  const mixSum = cohortMix.amd + cohortMix.dme + cohortMix.rvo;
  if (Math.abs(mixSum - 1) > 1e-6) {
    throw new Error(`generateCenterBundle: cohortMix must sum to 1.0 (got ${mixSum})`);
  }

  // WR-04: assert each cohort's drug CDF terminates at p=1.0, mirroring the
  // cohortMix sum guard above. pickDrugFromCdf falls back to the last bucket if
  // no entry matches; without this guard a future authoring typo (e.g. a final
  // p=0.99) would let draws in (0.99, 1.0] silently fall through, distorting the
  // intended drug mix with no error. Consumes no rand() — byte-identical regen.
  for (const [k, t] of Object.entries(TEMPLATES)) {
    const lastP = t.drugs[t.drugs.length - 1]!.p;
    if (Math.abs(lastP - 1) > 1e-9) {
      throw new Error(`generateCenterBundle: TEMPLATES.${k}.drugs CDF must end at p=1.0 (got ${lastP})`);
    }
  }

  // WR-03 / D-11: load the stub factor bounds from config/settings.yaml (the
  // single config source per CLAUDE.md) BEFORE constructing `rand`, so this read
  // consumes no PRNG draws and existing bundles regenerate byte-identically.
  const { factorMin: stubFactorMin, factorMax: stubFactorMax } = loadStubFactorBounds();

  const rand = mulberry32(seed);

  const orgEntry = {
    resource: {
      resourceType: 'Organization',
      id: centerId,
      name,
      address: [{ city, state }],
    },
  };

  const patientEntries: unknown[] = [];
  const conditionEntries: unknown[] = [];
  const observationEntries: unknown[] = [];
  const procedureEntries: unknown[] = [];
  const medicationEntries: unknown[] = [];

  for (let i = 1; i <= patients; i++) {
    const sh = shorthand.toLowerCase();
    const patNum = String(i).padStart(4, '0');
    const patId = `pat-${sh}-${patNum}`;
    const pseudo = `EM-${shorthand}-${patNum}`;
    const ref = `Patient/${patId}`;

    // Phase 26 SYNTH-03: rand() call order intentionally changed; bundles
    // regenerated atomically in plan 26-04. Cohort + baselineDate now come
    // BEFORE demographics so birthDate can be derived from sampled age.

    // Cohort selection
    const r = rand();
    let cohortKey: 'amd' | 'dme' | 'rvo';
    if (r < cohortMix.amd) cohortKey = 'amd';
    else if (r < cohortMix.amd + cohortMix.dme) cohortKey = 'dme';
    else cohortKey = 'rvo';
    const cohort = COHORT_CODES[cohortKey];

    // Baseline date
    const baselineOffset = seededRandInt(rand, 0, 880); // 2022-01-01 → ~2024-06-01
    const baselineDate = addDays('2022-01-01', baselineOffset);

    // Demographics — age-disease coupled (D-08).
    const sampledAge = sampleAge(cohortKey, rand);
    const dayJitter = seededRandInt(rand, 0, 364);
    // Use 365.25-day years to keep computed age ≥ sampledAge after Date arithmetic.
    const birthDate = addDays(baselineDate, -Math.round(sampledAge * 365.25) - dayJitter);
    const gender = rand() < 0.55 ? 'female' : 'male';

    patientEntries.push({
      resource: {
        resourceType: 'Patient',
        id: patId,
        meta: { source: centerId },
        gender,
        birthDate,
        identifier: [{ system: 'urn:eyematics:pseudonym', value: pseudo }],
      },
    });

    // Phase 26 / SYNTH-02 — Disease-conditional comorbidity emission (D-04, D-05).
    // Comorbidities are systemic (no bodySite) and emitted ONCE per patient,
    // independent of bilateral status.
    const ageAtBaseline = Math.floor(
      (new Date(baselineDate).getTime() - new Date(birthDate).getTime()) /
        (365.25 * 24 * 3600 * 1000),
    );
    const comorbidityPicks = sampleComorbidities(cohortKey, ageAtBaseline, rand);
    comorbidityPicks.forEach((pick, idx) => {
      const yearsBefore = seededRandInt(rand, 1, 10);
      const onsetDate = addDays(baselineDate, -yearsBefore * 365);
      const c = COMORBIDITY_CODES[pick.codeKey];
      conditionEntries.push({
        resource: {
          resourceType: 'Condition',
          id: `cond-${sh}-${patNum}-como-${idx + 1}`,
          subject: { reference: ref },
          code: { coding: [{ system: c.system, code: c.code, display: c.display }] },
          clinicalStatus: { coding: [{ code: 'active' }] },
          onsetDateTime: onsetDate,
          category: [{ coding: [NON_OPHTHALMIC] }],
        },
      });
    });

    // Phase 26 / SYNTH-03 / D-09 — Eye selection + bilateral support.
    const tmpl = TEMPLATES[cohortKey];
    const primaryEye = rand() < 0.5 ? EYE_RIGHT : EYE_LEFT;
    const secondEye = primaryEye === EYE_RIGHT ? EYE_LEFT : EYE_RIGHT;
    const isBilateral = rand() < tmpl.bilateralProb;

    // Per-cohort IVI count (D-09 ranges).
    const ivomCount = seededRandInt(rand, tmpl.ivi[0], tmpl.ivi[1]);

    // Visit timeline (shared across eyes — bilateral patients receive synchronous
    // ophthalmology visits; that's a deliberate simplification per D-10).
    const visitDates: string[] = [baselineDate];
    {
      let cursor = new Date(baselineDate);
      for (let k = 1; k <= ivomCount; k++) {
        cursor = new Date(cursor);
        cursor.setUTCDate(cursor.getUTCDate() + seededRandInt(rand, 28, 60));
        visitDates.push(cursor.toISOString().slice(0, 10));
      }
    }

    // Per-eye emitter — encapsulates Condition + visus/CRT obs + procedures.
    // `eyeSuffix` distinguishes second-eye resource ids (`-bilat`).
    const emitEye = (
      eyeCoding: typeof primaryEye,
      eyeSuffix: '' | '-bilat',
    ): void => {
      const condId = eyeSuffix ? `cond-${sh}-${patNum}-bilat` : `cond-${sh}-${patNum}`;
      conditionEntries.push({
        resource: {
          resourceType: 'Condition',
          id: condId,
          subject: { reference: ref },
          code: {
            coding: [{ system: SNOMED, code: cohort.code, display: cohort.display }],
          },
          clinicalStatus: { coding: [{ code: 'active' }] },
          onsetDateTime: baselineDate,
          bodySite: [{ coding: [eyeCoding] }],
        },
      });

      // Visus baseline per template; asymmetric independent draw per eye.
      let visus = tmpl.visusBase[0] + rand() * (tmpl.visusBase[1] - tmpl.visusBase[0]);
      for (let k = 0; k < visitDates.length; k++) {
        visus = Math.min(1.0, Math.max(0.05, visus + (rand() - 0.4) * 0.05));
        // Round, but ensure baseline (k=0) stays inside the configured base range
        // so test assertions that read baseline as `visusBase` hold.
        let value: number;
        if (k === 0) {
          const clampedBase = Math.min(tmpl.visusBase[1], Math.max(tmpl.visusBase[0], visus));
          value = Math.round(clampedBase * 100) / 100;
          visus = value;
        } else {
          value = Math.round(visus * 100) / 100;
        }
        const obsId = `obs-${sh}-${patNum}${eyeSuffix}-vis-${k + 1}`;
        observationEntries.push({
          resource: {
            resourceType: 'Observation',
            id: obsId,
            status: 'final',
            subject: { reference: ref },
            code: { coding: [VISUS_CODE] },
            effectiveDateTime: visitDates[k],
            valueQuantity: { value, unit: 'decimal' },
            bodySite: { coding: [eyeCoding] },
            method: { coding: [BCVA_METHOD] },
          },
        });
      }

      // CRT baseline per template; trend down with noise, clamped to [200, 700]
      // (upper bound widened to accommodate RVO 350–650 base).
      let crt = tmpl.crtBase[0] + Math.floor(rand() * (tmpl.crtBase[1] - tmpl.crtBase[0] + 1));
      for (let k = 0; k < visitDates.length; k += 3) {
        let value: number;
        if (k === 0) {
          // Hold baseline inside cohort range.
          value = Math.min(tmpl.crtBase[1], Math.max(tmpl.crtBase[0], crt));
          crt = value;
        } else {
          crt = Math.min(700, Math.max(200, crt + Math.floor((rand() - 0.7) * 30)));
          value = crt;
        }
        const obsId = `obs-${sh}-${patNum}${eyeSuffix}-crt-${Math.floor(k / 3) + 1}`;
        observationEntries.push({
          resource: {
            resourceType: 'Observation',
            id: obsId,
            status: 'final',
            subject: { reference: ref },
            code: { coding: [CRT_CODE] },
            effectiveDateTime: visitDates[k],
            valueQuantity: { value, unit: 'µm' },
            bodySite: { coding: [eyeCoding] },
          },
        });
      }

      // Procedures: one per IVOM visit (k=1..ivomCount).
      for (let k = 1; k <= ivomCount; k++) {
        const procId = eyeSuffix
          ? `proc-${sh}-${patNum}-bilat-${String(k).padStart(2, '0')}`
          : `proc-${sh}-${patNum}-${String(k).padStart(2, '0')}`;
        procedureEntries.push({
          resource: {
            resourceType: 'Procedure',
            id: procId,
            status: 'completed',
            subject: { reference: ref },
            code: { coding: [IVOM_CODE] },
            performedDateTime: visitDates[k],
            bodySite: [{ coding: [eyeCoding] }],
            reasonCode: [{ coding: [{ system: SNOMED, code: cohort.code, display: cohort.display }] }],
          },
        });
      }
    };

    emitEye(primaryEye, '');
    if (isBilateral) emitEye(secondEye, '-bilat');

    // IOP observations: baseline + every 4th visit. Patient-level (no bodySite).
    for (let k = 0; k < visitDates.length; k += 4) {
      const iop = seededRandInt(rand, 10, 28);
      const obsId = `obs-${sh}-${patNum}-iop-${Math.floor(k / 4) + 1}`;
      observationEntries.push({
        resource: {
          resourceType: 'Observation',
          id: obsId,
          status: 'final',
          subject: { reference: ref },
          code: { coding: [IOP_CODE] },
          effectiveDateTime: visitDates[k],
          valueQuantity: { value: iop, unit: 'mmHg' },
        },
      });
    }

    // Phase 26 / SYNTH-03 / D-07 — HbA1c emission for DME patients only.
    if (cohortKey === 'dme') {
      const hba1cEntries = emitHbA1c({
        ref,
        patIdSuffix: `${sh}-${patNum}`,
        visitDates,
        rand,
      });
      for (const e of hba1cEntries) observationEntries.push(e);
    }

    // MedicationStatement: per-cohort drug mix (D-09 CDF).
    const drug = pickDrugFromCdf(tmpl.drugs, rand);
    medicationEntries.push({
      resource: {
        resourceType: 'MedicationStatement',
        id: `med-${sh}-${patNum}`,
        status: 'active',
        subject: { reference: ref },
        medicationCodeableConcept: { coding: [drug] },
        effectivePeriod: { start: baselineDate },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // D-12 / D-11: Consent resources (one per full patient) + stub generation.
  // ALL rand() calls for these come AFTER the full-patient loop to preserve
  // byte-identical regen of existing patients (Pitfall 2 guard).
  // ---------------------------------------------------------------------------

  const sh = shorthand.toLowerCase();
  const consentEntries: unknown[] = [];

  // Consent: one active research Consent per full patient (D-06, 100% consent).
  for (let i = 1; i <= patients; i++) {
    const patNum = String(i).padStart(4, '0');
    const patId = `pat-${sh}-${patNum}`;
    // Consent dateTime: random offset [0, 60] days after a fixed reference date.
    // One rand() call per patient — after the full-patient loop.
    const consentOffset = seededRandInt(rand, 0, 60);
    const consentDate = addDays('2022-06-01', consentOffset + i * 3);
    consentEntries.push({
      resource: {
        resourceType: 'Consent',
        id: `consent-${sh}-${patNum}`,
        status: 'active',
        scope: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'research',
            display: 'Research',
          }],
        },
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'INFOACCESS',
            display: 'Information Access',
          }],
        }],
        patient: { reference: `Patient/${patId}` },
        organization: [{ reference: `Organization/${centerId}` }],
        dateTime: consentDate,
        policyRule: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'OPTIN',
          }],
        },
        provision: {
          type: 'permit',
          purpose: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
            code: 'HRESCH',
            display: 'healthcare research',
          }],
        },
      },
    });
  }

  // Stubs: D-11 per-site factor drawn once from seeded PRNG. Bounds are
  // sourced from config/settings.yaml stubs.factorMin / stubs.factorMax
  // (loaded above into stubFactorMin/stubFactorMax) — WR-03 makes this coupling
  // real instead of a stale comment over inlined magic numbers.
  const stubFactor = seededRandInt(rand, stubFactorMin, stubFactorMax);
  const stubCount = Math.round(patients * stubFactor);
  const stubEntries: unknown[] = [];
  const stubEncounterEntries: unknown[] = [];

  for (let s = 1; s <= stubCount; s++) {
    const stubNum = String(s).padStart(4, '0');
    const stubId = `pat-${sh}-stub-${stubNum}`;
    // D-02: only gender + year-of-birth + one Encounter. No Observations.
    const stubGender = rand() < 0.55 ? 'female' : 'male';
    const stubBirthYear = 1930 + seededRandInt(rand, 0, 65); // 1930–1995
    const stubBirthDate = `${stubBirthYear}-01-01`; // YYYY-01-01 per Claude's Discretion
    // One minimal Encounter — visit date within the baseline range used by full patients.
    const visitOffset = seededRandInt(rand, 0, 880);
    const visitDate = addDays('2022-01-01', visitOffset);
    stubEntries.push({
      resource: {
        resourceType: 'Patient',
        id: stubId,
        meta: { source: centerId }, // D-10: site attribution for filter
        gender: stubGender,
        birthDate: stubBirthDate,
        // No identifier (no pseudonym system) — stubs are not enrollees.
      },
    });
    stubEncounterEntries.push({
      resource: {
        resourceType: 'Encounter',
        id: `enc-${sh}-stub-${stubNum}`,
        status: 'finished',
        subject: { reference: `Patient/${stubId}` },
        serviceProvider: { reference: `Organization/${centerId}` },
        period: { start: visitDate },
      },
    });
  }

  // Seed-derived meta.lastUpdated for byte-identical regeneration (T-07-06).
  const lastUpdatedDate = addDays('2026-04-01', seed % 30);
  const lastUpdated = `${lastUpdatedDate}T06:00:00Z`;

  const bundle = {
    resourceType: 'Bundle',
    type: 'collection',
    meta: { lastUpdated, source: name },
    entry: [
      orgEntry,
      ...patientEntries,
      ...consentEntries,
      ...stubEntries,
      ...stubEncounterEntries,
      ...conditionEntries,
      ...observationEntries,
      ...procedureEntries,
      ...medicationEntries,
    ],
  };

  return bundle;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a && a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = 'true';
      }
    }
  }
  return out;
}

function isCliEntry(): boolean {
  // tsx maps import.meta.url to the .ts source URL; process.argv[1] is the .ts path.
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  try {
    const argvUrl = `file://${process.argv[1]}`;
    return import.meta.url === argvUrl;
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  const args = parseArgs(process.argv.slice(2));
  const required = ['center-id', 'shorthand', 'name', 'output'];
  for (const r of required) {
    if (!args[r]) {
      console.error(`generate-center-bundle: missing required --${r}`);
      process.exit(2);
    }
  }
  const bundle = generateCenterBundle({
    centerId: args['center-id']!,
    shorthand: args['shorthand']!,
    name: args['name']!,
    city: args['city'] ?? '',
    state: args['state'] ?? '',
    patients: Number(args['patients'] ?? '45'),
    seed: Number(args['seed'] ?? '42'),
  });
  fs.writeFileSync(args['output']!, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
  console.log(`[generate-center-bundle] wrote ${args['output']}`);
}
