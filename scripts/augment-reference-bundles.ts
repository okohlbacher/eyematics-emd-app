/**
 * scripts/augment-reference-bundles.ts
 *
 * Phase 34 / D-12 / D-13: Idempotent, append-only augmentation of the two
 * curated reference bundles (Aachen, Tübingen) with:
 *   - One active research Consent per full patient (D-06)
 *   - Seeded [2,8]× stub Patient + Encounter entries (D-11)
 *
 * INVARIANTS (D-13):
 *   - Never mutates or reorders any pre-existing entry.
 *   - Idempotent: if Consent entries already present, logs skip and exits cleanly.
 *   - Write format: JSON.stringify(bundle, null, 2) + '\n' (matches generate-all-bundles.ts).
 *
 * Usage:
 *   node --import tsx scripts/augment-reference-bundles.ts
 *   node --import tsx scripts/augment-reference-bundles.ts --file path/to/center.json
 *
 * The --file flag is used by tests to operate on a temp copy.
 */

import fs from 'node:fs';
import path from 'node:path';

import { loadStubFactorBounds } from './loadStubConfig.js';
import { addDays, mulberry32, seededRandInt } from './prng.js';

// ---------------------------------------------------------------------------
// Reference site specs (D-12). Seeds distinct from synthetic sites.
// Synthetic seeds: Chemnitz=70103, Greifswald=70107, Leipzig=70112, Münster=70114
// ---------------------------------------------------------------------------
interface ReferenceSite {
  file: string;
  centerId: string;
  shorthand: string;
  seed: number;
}

const REFERENCE_SITES: ReferenceSite[] = [
  { file: 'public/data/center-aachen.json',    centerId: 'org-uka', shorthand: 'uka', seed: 70101 },
  { file: 'public/data/center-tuebingen.json', centerId: 'org-ukt', shorthand: 'ukt', seed: 70116 },
];

// ---------------------------------------------------------------------------
// Resource builders — identical shape to generate-center-bundle.ts (D-07)
// ---------------------------------------------------------------------------

function buildConsentEntry(
  patId: string,
  centerId: string,
  sh: string,
  patIdx: number,
  rand: () => number,
): object {
  const patNum = patId.replace(/^pat-[a-z]+-/, '');
  const consentOffset = seededRandInt(rand, 0, 60);
  const consentDate = addDays('2022-06-01', consentOffset + patIdx * 3);
  return {
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
  };
}

function buildStubEntries(
  centerId: string,
  sh: string,
  stubIndex: number,
  rand: () => number,
): [object, object] {
  const stubNum = String(stubIndex).padStart(4, '0');
  const stubId = `pat-${sh}-stub-${stubNum}`;
  const stubGender = rand() < 0.55 ? 'female' : 'male';
  const stubBirthYear = 1930 + seededRandInt(rand, 0, 65); // 1930–1995
  const stubBirthDate = `${stubBirthYear}-01-01`; // YYYY-01-01 per Claude's Discretion
  const visitOffset = seededRandInt(rand, 0, 880);
  const visitDate = addDays('2022-01-01', visitOffset);

  const stubPatient = {
    resource: {
      resourceType: 'Patient',
      id: stubId,
      meta: { source: centerId }, // D-10: site attribution for filter
      gender: stubGender,
      birthDate: stubBirthDate,
    },
  };
  const stubEncounter = {
    resource: {
      resourceType: 'Encounter',
      id: `enc-${sh}-stub-${stubNum}`,
      status: 'finished',
      subject: { reference: `Patient/${stubId}` },
      serviceProvider: { reference: `Organization/${centerId}` },
      period: { start: visitDate },
    },
  };
  return [stubPatient, stubEncounter];
}

// ---------------------------------------------------------------------------
// Core augmentation logic
// ---------------------------------------------------------------------------

interface BundleEntry {
  resource: {
    resourceType: string;
    id?: string;
    subject?: { reference?: string };
  };
}

interface Bundle {
  entry: BundleEntry[];
}

function augmentBundle(filePath: string, site: ReferenceSite): void {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const bundle = JSON.parse(raw) as Bundle;

  // Idempotency guard (D-13): skip if the bundle carries EITHER augmentation
  // marker. WR-02: keying solely on Consent presence is not robust — a bundle
  // that somehow reaches a stubs-without-Consent state (hand-edited fixture, or
  // a future two-pass writer interrupted mid-write) would look "fresh" and a
  // re-run would append a SECOND full set of stubs, silently doubling stub
  // Patients/Encounters and corrupting the documented stub ratio. Guard on the
  // union of markers: any Consent OR any stub Patient (id contains '-stub-').
  const alreadyAugmented = bundle.entry.some(
    (e) =>
      e.resource.resourceType === 'Consent' ||
      (e.resource.resourceType === 'Patient' && (e.resource.id?.includes('-stub-') ?? false)),
  );
  if (alreadyAugmented) {
    console.log(`[augment] ${filePath} already augmented — skipping`);
    return;
  }

  const { centerId, shorthand, seed } = site;
  const sh = shorthand.toLowerCase();
  const rand = mulberry32(seed);

  // Identify full patients: those with ≥1 Observation referencing them (same
  // structural rule as D-03 / extractPatientCases).
  const obsByPatient = new Map<string, number>();
  for (const e of bundle.entry) {
    if (e.resource.resourceType === 'Observation') {
      const ref = (e.resource as { subject?: { reference?: string } }).subject?.reference;
      if (ref) obsByPatient.set(ref, (obsByPatient.get(ref) ?? 0) + 1);
    }
  }

  const fullPatientIds = bundle.entry
    .filter(
      (e) =>
        e.resource.resourceType === 'Patient' &&
        e.resource.id != null &&
        (obsByPatient.get(`Patient/${e.resource.id}`) ?? 0) > 0,
    )
    .map((e) => e.resource.id as string);

  // Append Consent entries (one per full patient) — PUSH ONLY, never mutate.
  for (let i = 0; i < fullPatientIds.length; i++) {
    const patId = fullPatientIds[i]!;
    bundle.entry.push(buildConsentEntry(patId, centerId, sh, i + 1, rand) as BundleEntry);
  }

  // Append stub Patient + Encounter entries.
  // WR-03 / D-11: stub factor bounds come from config/settings.yaml
  // (stubs.factorMin / stubs.factorMax) — the single config source per
  // CLAUDE.md. loadStubFactorBounds() consumes no PRNG draws, so curated
  // bundles stay byte-stable. Keep verify-bundle-distributions.mjs THRESHOLDS
  // in sync with the same YAML keys.
  const { factorMin: stubFactorMin, factorMax: stubFactorMax } = loadStubFactorBounds();
  const stubFactor = seededRandInt(rand, stubFactorMin, stubFactorMax);
  const stubCount = Math.round(fullPatientIds.length * stubFactor);

  for (let s = 1; s <= stubCount; s++) {
    const [stubPatient, stubEncounter] = buildStubEntries(centerId, sh, s, rand);
    bundle.entry.push(stubPatient as BundleEntry);
    bundle.entry.push(stubEncounter as BundleEntry);
  }

  // Write back with exact format matching generate-all-bundles.ts (Pitfall 5).
  fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
  console.log(
    `[augment] ${filePath} augmented — ${fullPatientIds.length} Consents, ${stubCount} stubs (factor=${stubFactor})`,
  );
}

// ---------------------------------------------------------------------------
// Entry point
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

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  if (args['file']) {
    // Test mode: augment a single file specified by --file (used by tests operating
    // on a temp copy). Find which reference site spec matches by centerId suffix or
    // use first matching shorthand from filename.
    const filePath = path.resolve(args['file']);
    // Determine which site spec to use: match by filename pattern
    const basename = path.basename(filePath);
    const site =
      REFERENCE_SITES.find((s) => basename.includes(s.shorthand.toLowerCase())) ??
      REFERENCE_SITES[0]!;
    augmentBundle(filePath, { ...site, file: filePath });
  } else {
    // Normal mode: augment all reference sites in place
    for (const site of REFERENCE_SITES) {
      const filePath = path.resolve(cwd, site.file);
      augmentBundle(filePath, site);
    }
  }
}

main();
