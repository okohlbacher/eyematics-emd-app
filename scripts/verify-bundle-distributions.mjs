#!/usr/bin/env node
/**
 * Phase 26 / Plan 26-04 / SYNTH-04 (D-12): Distribution-prior verifier.
 *
 * Asserts aggregate priors across the 4 SYNTHETIC site bundles
 * (center-chemnitz, center-leipzig, center-greifswald, center-muenster).
 * Reference bundles (center-aachen, center-tuebingen) are deliberately
 * skipped — they are curated real-clinic baselines (D-06).
 *
 * Asserts:
 *   - AMD median age (at primary-diagnosis date) ≥ 70
 *   - Every DME patient has a diabetes Condition (E11.9 or E10.9)
 *   - AMD comorbidity rate ≥ 60% (≥1 of {I10, E78.0, I25.1})
 *   - Every DME patient has ≥2 HbA1c (LOINC 4548-4) Observations
 *
 * Override the bundle scan path with BUNDLE_GLOB (mirrors audit-bundle-codes.mjs).
 *
 * Exit code:
 *   0 — all assertions pass
 *   1 — one or more failed; offending counts/medians written to stderr
 *
 * Usage: `npm run verify:bundles` or chained via `npm run audit:bundles`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

// --- Constants ---------------------------------------------------------------

const SYNTHETIC_PATTERN = /center-(chemnitz|leipzig|greifswald|muenster)\.json$/;
const SNOMED_SYSTEM = 'http://snomed.info/sct';
const ICD10GM_SYSTEM = 'http://fhir.de/CodeSystem/bfarm/icd-10-gm';
const LOINC_SYSTEM = 'http://loinc.org';
const HBA1C_LOINC = '4548-4';

const PRIMARY_BY_SNOMED = {
  '267718000': 'amd', // Age-related macular degeneration
  '312898008': 'dme', // (legacy) Diabetic retinopathy → counted as dme cohort
  '312903003': 'dme', // Diabetic macular edema
  '362098006': 'rvo', // Retinal vein occlusion
};

const DIABETES_ICD = new Set(['E11.9', 'E10.9', 'E11', 'E10']);
const AMD_COMORBIDITY_ICD = new Set(['I10', 'E78.0', 'I25.1']);

const THRESHOLDS = {
  amdMedianAgeMin: 70,
  amdComorbidityRateMin: 0.6,
  dmeHba1cMin: 2,
  // Phase 34 / D-14: per-site stub count / consented count must be in [2, 8].
  // Values mirror config/settings.yaml stubs.factorMin / stubs.factorMax.
  stubFactorMin: 2,
  stubFactorMax: 8,
};

const BUNDLE_GLOB = process.env.BUNDLE_GLOB ?? 'public/data/center-*.json';

// --- Glob expansion (single * in basename, mirrors audit-bundle-codes.mjs) ---

function expandGlob(pattern) {
  const dir = dirname(pattern);
  const base = pattern.slice(dir.length + 1);
  const star = base.indexOf('*');
  if (star === -1) return [pattern];
  const prefix = base.slice(0, star);
  const suffix = base.slice(star + 1);
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    throw new Error(`verify:bundles — cannot read directory ${dir}: ${err.message}`);
  }
  return entries
    .filter((f) => f.startsWith(prefix) && f.endsWith(suffix))
    .map((f) => join(dir, f))
    .filter((p) => statSync(p).isFile())
    .sort();
}

// --- Helpers -----------------------------------------------------------------

function parseRefId(reference) {
  if (typeof reference !== 'string') return null;
  const slash = reference.lastIndexOf('/');
  return slash === -1 ? reference : reference.slice(slash + 1);
}

function ageAtDate(birthDate, onsetDate) {
  if (!birthDate || !onsetDate) return null;
  const b = new Date(birthDate);
  const o = new Date(onsetDate);
  if (Number.isNaN(b.getTime()) || Number.isNaN(o.getTime())) return null;
  let years = o.getFullYear() - b.getFullYear();
  const m = o.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && o.getDate() < b.getDate())) years--;
  return years;
}

function median(nums) {
  if (nums.length === 0) return NaN;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function classifyPrimary(condition) {
  const codings = condition?.code?.coding;
  if (!Array.isArray(codings)) return null;
  for (const c of codings) {
    if (c?.system === SNOMED_SYSTEM && PRIMARY_BY_SNOMED[c.code]) {
      return PRIMARY_BY_SNOMED[c.code];
    }
  }
  return null;
}

function comorbidityCode(condition) {
  const codings = condition?.code?.coding;
  if (!Array.isArray(codings)) return null;
  for (const c of codings) {
    if (c?.system === ICD10GM_SYSTEM && typeof c.code === 'string') return c.code;
  }
  return null;
}

function isHbA1c(observation) {
  const codings = observation?.code?.coding;
  if (!Array.isArray(codings)) return false;
  return codings.some((c) => c?.system === LOINC_SYSTEM && c.code === HBA1C_LOINC);
}

// --- Per-bundle aggregation --------------------------------------------------

/**
 * For each Patient, determine cohort + age-at-onset (using the FIRST primary
 * Condition encountered) and accumulate comorbidity codes + hba1c counts.
 * Returns array of patient records (one per Patient that has a primary).
 *
 * Also computes stub stats: { fullCount, stubCount } for D-14 stub-ratio assertion.
 * Stubs = Patient resources with zero Observations referencing them.
 */
function aggregateBundle(bundle) {
  const patients = new Map(); // id -> { id, birthDate, cohort, primaryOnset, comorbidities:Set, hba1cCount }
  for (const entry of bundle.entry ?? []) {
    const r = entry?.resource;
    if (r?.resourceType !== 'Patient' || !r.id) continue;
    patients.set(r.id, {
      id: r.id,
      birthDate: r.birthDate ?? null,
      cohort: null,
      primaryOnset: null,
      comorbidities: new Set(),
      hba1cCount: 0,
    });
  }
  // Pass 1: classify primary conditions; collect comorbidity ICD codes.
  for (const entry of bundle.entry ?? []) {
    const r = entry?.resource;
    if (r?.resourceType !== 'Condition') continue;
    const subjectId = parseRefId(r.subject?.reference);
    if (!subjectId) continue;
    const rec = patients.get(subjectId);
    if (!rec) continue;
    const cohort = classifyPrimary(r);
    if (cohort && !rec.cohort) {
      rec.cohort = cohort;
      rec.primaryOnset = r.onsetDateTime ?? null;
      continue;
    }
    const icd = comorbidityCode(r);
    if (icd) rec.comorbidities.add(icd);
  }
  // Pass 2: count HbA1c Observations; also track which patients have any Observation.
  const patientsWithObs = new Set();
  for (const entry of bundle.entry ?? []) {
    const r = entry?.resource;
    if (r?.resourceType !== 'Observation') continue;
    const subjectId = parseRefId(r.subject?.reference);
    if (subjectId) patientsWithObs.add(subjectId);
    if (!isHbA1c(r)) continue;
    const rec = patients.get(subjectId);
    if (!rec) continue;
    rec.hba1cCount++;
  }

  // Phase 34 / D-14: Compute stub stats for per-bundle stub-ratio assertion.
  // Full patients = those with ≥1 Observation (same rule as D-03 extractPatientCases).
  // Stub patients = those with zero Observations.
  let fullCount = 0;
  let stubCount = 0;
  for (const patId of patients.keys()) {
    if (patientsWithObs.has(patId)) {
      fullCount++;
    } else {
      stubCount++;
    }
  }

  const patientRecords = [...patients.values()].filter((p) => p.cohort);
  // Attach stub stats as a non-enumerable property for the caller.
  return Object.assign(patientRecords, { stubStats: { fullCount, stubCount } });
}

// --- Verification ------------------------------------------------------------

/**
 * Verify per-bundle stub ratios (D-14 / Phase 34).
 * stubCount / fullCount must be in [stubFactorMin, stubFactorMax] (allowing Math.round boundary).
 */
function verifyStubRatios(perBundleStats) {
  const failures = [];
  for (const { file, fullCount, stubCount } of perBundleStats) {
    if (fullCount === 0) {
      failures.push(`${file}: no full patients found (cannot compute stub ratio)`);
      continue;
    }
    const ratio = stubCount / fullCount;
    // Allow a small rounding tolerance (Math.round can produce factor slightly outside range).
    const tolerance = 0.5 / fullCount;
    if (ratio < THRESHOLDS.stubFactorMin - tolerance || ratio > THRESHOLDS.stubFactorMax + tolerance) {
      failures.push(
        `${file}: stub ratio = ${ratio.toFixed(3)} (${stubCount}/${fullCount}); ` +
        `expected [${THRESHOLDS.stubFactorMin}, ${THRESHOLDS.stubFactorMax}]`,
      );
    }
  }
  return failures;
}

function verify(allPatients) {
  const failures = [];
  const amds = allPatients.filter((p) => p.cohort === 'amd');
  const dmes = allPatients.filter((p) => p.cohort === 'dme');

  // 1) AMD median age ≥70
  const amdAges = amds
    .map((p) => ageAtDate(p.birthDate, p.primaryOnset))
    .filter((n) => typeof n === 'number' && !Number.isNaN(n));
  const amdMedian = median(amdAges);
  if (!(amdMedian >= THRESHOLDS.amdMedianAgeMin)) {
    failures.push(
      `AMD median age = ${amdMedian.toFixed(1)} (n=${amdAges.length}); threshold ≥${THRESHOLDS.amdMedianAgeMin}`,
    );
  }

  // 2) Every DME patient has a diabetes Condition
  const dmeMissingDiabetes = dmes.filter(
    (p) => ![...p.comorbidities].some((c) => DIABETES_ICD.has(c)),
  );
  if (dmeMissingDiabetes.length > 0) {
    failures.push(
      `DME patients missing diabetes Condition: ${dmeMissingDiabetes.length}/${dmes.length} (e.g., ${dmeMissingDiabetes
        .slice(0, 3)
        .map((p) => p.id)
        .join(', ')})`,
    );
  }

  // 3) AMD comorbidity rate ≥60%
  const amdWithComorb = amds.filter((p) =>
    [...p.comorbidities].some((c) => AMD_COMORBIDITY_ICD.has(c)),
  );
  const amdRate = amds.length > 0 ? amdWithComorb.length / amds.length : 0;
  if (!(amdRate >= THRESHOLDS.amdComorbidityRateMin)) {
    failures.push(
      `AMD comorbidity rate = ${(amdRate * 100).toFixed(1)}% (${amdWithComorb.length}/${amds.length}); threshold ≥${(THRESHOLDS.amdComorbidityRateMin * 100).toFixed(0)}%`,
    );
  }

  // 4) Every DME patient has ≥2 HbA1c Observations
  const dmeUnderHba1c = dmes.filter((p) => p.hba1cCount < THRESHOLDS.dmeHba1cMin);
  if (dmeUnderHba1c.length > 0) {
    failures.push(
      `DME patients with <${THRESHOLDS.dmeHba1cMin} HbA1c Observations: ${dmeUnderHba1c.length}/${dmes.length} (e.g., ${dmeUnderHba1c
        .slice(0, 3)
        .map((p) => `${p.id}=${p.hba1cCount}`)
        .join(', ')})`,
    );
  }

  return {
    failures,
    summary: {
      bundles: 0, // filled by caller
      amdCount: amds.length,
      dmeCount: dmes.length,
      amdMedianAge: amdMedian,
      amdComorbidityRate: amdRate,
    },
  };
}

// --- Entry point -------------------------------------------------------------

function main() {
  const all = expandGlob(BUNDLE_GLOB).filter((f) => SYNTHETIC_PATTERN.test(f));
  if (all.length === 0) {
    process.stderr.write(
      `[verify:bundles] no synthetic bundles matched ${BUNDLE_GLOB} (pattern ${SYNTHETIC_PATTERN})\n`,
    );
    process.exit(1);
  }
  const allPatients = [];
  const perBundleStats = [];
  for (const f of all) {
    let bundle;
    try {
      bundle = JSON.parse(readFileSync(f, 'utf-8'));
    } catch (err) {
      throw new Error(`verify:bundles — failed to parse ${f}: ${err.message}`);
    }
    const bundlePatients = aggregateBundle(bundle);
    for (const p of bundlePatients) allPatients.push(p);
    // Phase 34 / D-14: collect per-bundle stub stats for ratio assertion.
    perBundleStats.push({ file: f, ...bundlePatients.stubStats });
  }
  const { failures, summary } = verify(allPatients);
  // Phase 34 / D-14: check stub ratios per bundle.
  const stubFailures = verifyStubRatios(perBundleStats);
  for (const sf of stubFailures) failures.push(sf);
  summary.bundles = all.length;
  if (failures.length > 0) {
    for (const fmsg of failures) {
      process.stderr.write(`[verify:bundles] FAIL ${fmsg}\n`);
    }
    process.stderr.write(
      `[verify:bundles] scanned ${summary.bundles} bundles, ${summary.amdCount} AMD, ${summary.dmeCount} DME — ${failures.length} assertion(s) failed\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `[verify:bundles] scanned ${summary.bundles} bundles, ${summary.amdCount} AMD (median age ${summary.amdMedianAge.toFixed(1)}, comorbidity rate ${(summary.amdComorbidityRate * 100).toFixed(1)}%), ${summary.dmeCount} DME — all priors pass\n`,
  );
  process.exit(0);
}

main();
