/**
 * scripts/generate-center-bundle.ts
 *
 * Library + CLI that emits a deterministic, structurally-valid FHIR R4 Bundle
 * for a single ophthalmology center. The bundle shape mirrors the reference
 * `public/data/center-aachen.json` file but is generated from a seeded PRNG so
 * the same `seed` always yields byte-identical JSON.
 *
 * Resource types covered: Organization, Patient, Condition,
 * Observation (visus / CRT / IOP), Procedure (IVOM), MedicationStatement.
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

import { addDays, mulberry32, seededPick, seededRandInt } from './prng.js';

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
// Code dictionaries (FHIR coding constants)
// ---------------------------------------------------------------------------

const SNOMED = 'http://snomed.info/sct';
const LOINC = 'http://loinc.org';
const ATC = 'http://www.whocc.no/atc';

const COHORT_CODES = {
  amd: { code: '267718000', display: 'Age-related macular degeneration' },
  dme: { code: '312903003', display: 'Diabetic macular edema' },
  rvo: { code: '362098006', display: 'Retinal vein occlusion' },
} as const;

const EYE_RIGHT = { system: SNOMED, code: '362503005', display: 'Right eye' };
const EYE_LEFT = { system: SNOMED, code: '362502000', display: 'Left eye' };

const VISUS_CODE = { system: LOINC, code: '79880-1', display: 'Visual acuity' };
const CRT_CODE = { system: LOINC, code: 'LP267955-5', display: 'Central retinal thickness' };
const IOP_CODE = { system: LOINC, code: '56844-4', display: 'Intraocular pressure' };

const IVOM_CODE = { system: SNOMED, code: '36189003', display: 'Intravitreal injection' };

const AFLIBERCEPT = { system: ATC, code: 'S01LA05', display: 'Aflibercept' };
const BEVACIZUMAB = { system: ATC, code: 'L01XC07', display: 'Bevacizumab' };

const BCVA_METHOD = { system: SNOMED, code: '252886007', display: 'Best corrected visual acuity' };

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

    // Demographics
    const birthOffset = seededRandInt(rand, 0, 36 * 365); // ~1935 → ~1970
    const birthDate = addDays('1935-01-01', birthOffset);
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

    // Cohort selection
    const r = rand();
    let cohortKey: 'amd' | 'dme' | 'rvo';
    if (r < cohortMix.amd) cohortKey = 'amd';
    else if (r < cohortMix.amd + cohortMix.dme) cohortKey = 'dme';
    else cohortKey = 'rvo';
    const cohort = COHORT_CODES[cohortKey];

    // Eye of interest
    const eye = rand() < 0.5 ? EYE_RIGHT : EYE_LEFT;

    // Baseline date
    const baselineOffset = seededRandInt(rand, 0, 880); // 2022-01-01 → ~2024-06-01
    const baselineDate = addDays('2022-01-01', baselineOffset);

    // Condition
    conditionEntries.push({
      resource: {
        resourceType: 'Condition',
        id: `cond-${sh}-${patNum}`,
        subject: { reference: ref },
        code: {
          coding: [{ system: SNOMED, code: cohort.code, display: cohort.display }],
        },
        clinicalStatus: { coding: [{ code: 'active' }] },
        onsetDateTime: baselineDate,
        bodySite: [{ coding: [eye] }],
      },
    });

    // IVOM count
    const ivomCount = seededRandInt(rand, 1, 20);

    // Build per-visit dates: visit 0 = baseline, visit k = baseline + cumulative offsets
    const visitDates: string[] = [baselineDate];
    let cursor = new Date(baselineDate);
    for (let k = 1; k <= ivomCount; k++) {
      cursor = new Date(cursor);
      cursor.setUTCDate(cursor.getUTCDate() + seededRandInt(rand, 28, 60));
      visitDates.push(cursor.toISOString().slice(0, 10));
    }

    // Visus observations: baseline + one per IVOM (so visitDates.length total)
    let visus = 0.1 + rand() * 0.35; // start somewhere between 0.10 and 0.45
    for (let k = 0; k < visitDates.length; k++) {
      // Trend slowly upward with noise, clamp to [0.1, 1.0] (valid decimal visus range)
      visus = Math.min(1.0, Math.max(0.1, visus + (rand() - 0.4) * 0.05));
      const value = Math.round(visus * 100) / 100;
      const obsId = `obs-${sh}-${patNum}-vis-${k + 1}`;
      const observation: Record<string, unknown> = {
        resourceType: 'Observation',
        id: obsId,
        status: 'final',
        subject: { reference: ref },
        code: { coding: [VISUS_CODE] },
        effectiveDateTime: visitDates[k],
        valueQuantity: { value, unit: 'decimal' },
        bodySite: { coding: [eye] },
        method: { coding: [BCVA_METHOD] },
      };
      observationEntries.push({ resource: observation });
    }

    // CRT observations: baseline + every 3rd visit, trending DOWN with noise, clamped [200, 600]
    let crt = 350 + Math.floor(rand() * 200);
    for (let k = 0; k < visitDates.length; k += 3) {
      crt = Math.min(600, Math.max(200, crt + Math.floor((rand() - 0.7) * 30)));
      const obsId = `obs-${sh}-${patNum}-crt-${Math.floor(k / 3) + 1}`;
      observationEntries.push({
        resource: {
          resourceType: 'Observation',
          id: obsId,
          status: 'final',
          subject: { reference: ref },
          code: { coding: [CRT_CODE] },
          effectiveDateTime: visitDates[k],
          valueQuantity: { value: crt, unit: 'µm' },
          bodySite: { coding: [eye] },
        },
      });
    }

    // IOP observations: baseline + every 4th visit
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

    // Procedures: one per IVOM (skipping baseline). performedDateTime in ascending order.
    for (let k = 1; k <= ivomCount; k++) {
      procedureEntries.push({
        resource: {
          resourceType: 'Procedure',
          id: `proc-${sh}-${patNum}-${String(k).padStart(2, '0')}`,
          status: 'completed',
          subject: { reference: ref },
          code: { coding: [IVOM_CODE] },
          performedDateTime: visitDates[k],
          bodySite: [{ coding: [eye] }],
          reasonCode: [{ coding: [{ system: SNOMED, code: cohort.code, display: cohort.display }] }],
        },
      });
    }

    // MedicationStatement: 80% Aflibercept, 20% Bevacizumab.
    const drug = rand() < 0.8 ? AFLIBERCEPT : BEVACIZUMAB;
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
