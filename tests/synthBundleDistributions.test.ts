/**
 * Phase 26 / Plan 26-04 / SYNTH-04: Tests for verify-bundle-distributions script.
 *
 * Verifies (D-12 thresholds):
 *   1. Verifier exits 0 against a synthesized fixture bundle that satisfies all priors.
 *   2. Verifier exits 1 when AMD median age <70.
 *   3. Verifier exits 1 when any DME patient lacks a diabetes Condition.
 *   4. Verifier exits 1 when any DME patient has <2 HbA1c Observations.
 *   5. Verifier exits 1 when AMD comorbidity rate <60%.
 *   6. `npm run audit:bundles` chain runs both audit-bundle-codes AND verify-bundle-distributions.
 *
 * Plus shipped-bundle assertions (added in 26-04 Task 2):
 *   7. Shipped synthetic bundles satisfy all D-12 priors.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const SCRIPT = 'scripts/verify-bundle-distributions.mjs';

// --- Fixture builder ---------------------------------------------------------

interface PatientSpec {
  cohort: 'amd' | 'dme' | 'rvo';
  age: number;
  comorbidities?: string[]; // ICD-10-GM codes (E11.9, E10.9, I10, E78.0, I25.1)
  hba1cCount?: number; // Observations of LOINC 4548-4 (defaults: dme=2, others=0)
}

const SNOMED_PRIMARY: Record<PatientSpec['cohort'], string> = {
  amd: '267718000',
  dme: '312903003',
  rvo: '362098006',
};

function buildFixtureBundle(patients: PatientSpec[]): unknown {
  const entries: unknown[] = [];
  // Anchor primary diagnosis date so we can derive age from birthDate.
  const onset = '2024-01-15';
  const onsetYear = 2024;
  patients.forEach((spec, idx) => {
    const id = `pat-fix-${String(idx + 1).padStart(4, '0')}`;
    const birthYear = onsetYear - spec.age;
    const birthDate = `${birthYear}-06-15`;
    entries.push({
      resource: {
        resourceType: 'Patient',
        id,
        gender: idx % 2 === 0 ? 'female' : 'male',
        birthDate,
        identifier: [{ system: 'urn:eyematics:pseudonym', value: `EM-FIX-${idx + 1}` }],
      },
    });
    // Primary Condition
    entries.push({
      resource: {
        resourceType: 'Condition',
        id: `cond-fix-${idx + 1}-primary`,
        subject: { reference: `Patient/${id}` },
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: SNOMED_PRIMARY[spec.cohort],
            },
          ],
        },
        clinicalStatus: { coding: [{ code: 'active' }] },
        onsetDateTime: onset,
      },
    });
    // Comorbidities (ICD-10-GM)
    for (const code of spec.comorbidities ?? []) {
      entries.push({
        resource: {
          resourceType: 'Condition',
          id: `cond-fix-${idx + 1}-${code.replace('.', '_')}`,
          subject: { reference: `Patient/${id}` },
          code: {
            coding: [
              { system: 'http://fhir.de/CodeSystem/bfarm/icd-10-gm', code },
            ],
          },
          clinicalStatus: { coding: [{ code: 'active' }] },
          onsetDateTime: '2018-01-01',
        },
      });
    }
    // HbA1c Observations (LOINC 4548-4) — default: dme=2, others=0
    const hba1cCount = spec.hba1cCount ?? (spec.cohort === 'dme' ? 2 : 0);
    for (let h = 0; h < hba1cCount; h++) {
      entries.push({
        resource: {
          resourceType: 'Observation',
          id: `obs-fix-${idx + 1}-hba1c-${h}`,
          subject: { reference: `Patient/${id}` },
          code: { coding: [{ system: 'http://loinc.org', code: '4548-4' }] },
          valueQuantity: { value: 7.5, unit: '%', system: 'http://unitsofmeasure.org', code: '%' },
          effectiveDateTime: `${onsetYear + h}-03-15`,
        },
      });
    }
  });
  return { resourceType: 'Bundle', type: 'collection', entry: entries };
}

function writeFixture(patients: PatientSpec[]): { dir: string; glob: string } {
  const dir = mkdtempSync(join(tmpdir(), 'verify-dist-'));
  const file = join(dir, 'center-chemnitz.json');
  writeFileSync(file, JSON.stringify(buildFixtureBundle(patients), null, 2), 'utf-8');
  // Use prefix glob so the script's expandGlob picks it up.
  return { dir, glob: join(dir, 'center-*.json') };
}

function runVerify(glob: string) {
  return spawnSync('node', [SCRIPT], {
    encoding: 'utf-8',
    env: { ...process.env, BUNDLE_GLOB: glob },
  });
}

// Build a satisfying patient roster:
// - 10 AMD patients ages 70..79 → median 74.5 ≥70
// - 7 of 10 AMD have I10 (70% comorbidity rate) ≥60%
// - 5 DME patients age 65, all with E11.9, all with 2 HbA1c
// - 3 RVO patients age 70 (don't affect thresholds)
function happyPathRoster(): PatientSpec[] {
  const amds: PatientSpec[] = [];
  for (let i = 0; i < 10; i++) {
    amds.push({
      cohort: 'amd',
      age: 70 + i,
      comorbidities: i < 7 ? ['I10'] : [],
    });
  }
  const dmes: PatientSpec[] = [];
  for (let i = 0; i < 5; i++) {
    dmes.push({ cohort: 'dme', age: 65, comorbidities: ['E11.9'], hba1cCount: 2 });
  }
  const rvos: PatientSpec[] = [];
  for (let i = 0; i < 3; i++) {
    rvos.push({ cohort: 'rvo', age: 70, comorbidities: ['I10'] });
  }
  return [...amds, ...dmes, ...rvos];
}

describe('Phase 26 SYNTH-04 verify-bundle-distributions', () => {
  it('exits 0 against a fixture satisfying all priors', () => {
    const { glob } = writeFixture(happyPathRoster());
    const r = runVerify(glob);
    if (r.status !== 0) {
      throw new Error(`verify exited ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    }
    expect(r.status).toBe(0);
  });

  it('exits 1 when AMD median age <70', () => {
    const roster = happyPathRoster();
    // Force all AMD ages to 65 → median 65
    for (const p of roster) if (p.cohort === 'amd') p.age = 65;
    const { glob } = writeFixture(roster);
    const r = runVerify(glob);
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/AMD median age/i);
  });

  it('exits 1 when any DME patient lacks a diabetes Condition', () => {
    const roster = happyPathRoster();
    // Strip diabetes from one DME patient
    const dme = roster.find((p) => p.cohort === 'dme');
    if (!dme) throw new Error('test setup');
    dme.comorbidities = [];
    const { glob } = writeFixture(roster);
    const r = runVerify(glob);
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/diabetes/i);
  });

  it('exits 1 when any DME patient has <2 HbA1c Observations', () => {
    const roster = happyPathRoster();
    const dme = roster.find((p) => p.cohort === 'dme');
    if (!dme) throw new Error('test setup');
    dme.hba1cCount = 1;
    const { glob } = writeFixture(roster);
    const r = runVerify(glob);
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/HbA1c/i);
  });

  it('exits 1 when AMD comorbidity rate <60%', () => {
    const roster = happyPathRoster();
    // Strip comorbidities from enough AMD patients to push rate below 0.60
    let stripped = 0;
    for (const p of roster) {
      if (p.cohort === 'amd' && stripped < 6) {
        p.comorbidities = [];
        stripped++;
      }
    }
    // 10 AMD patients, 6 stripped → only 4 with comorbidity = 40% < 60%
    const { glob } = writeFixture(roster);
    const r = runVerify(glob);
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/AMD comorbidity/i);
  });

  it('npm run audit:bundles chain runs both audit-bundle-codes and verify-bundle-distributions', () => {
    // Inspect package.json scripts to confirm chain.
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    expect(pkg.scripts['audit:bundles']).toMatch(/audit-bundle-codes\.mjs/);
    expect(pkg.scripts['audit:bundles']).toMatch(/verify-bundle-distributions\.mjs/);
  });

  // Task 2 (regenerate-and-verify) adds the shipped-bundle assertion below.
});
