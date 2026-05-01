#!/usr/bin/env node
/**
 * Phase 26 / Plan 26-01 / SYNTH-01: Bundle code-resolvability audit.
 *
 * Scans `public/data/center-*.json` (override via BUNDLE_GLOB env var),
 * walks every (system, code) pair on Condition / Observation / Procedure /
 * MedicationStatement resources (code, reasonCode, bodySite,
 * medicationCodeableConcept), and asserts every distinct pair is either:
 *
 *   - Whitelisted by system (LOINC, ATC) or by structural-code allow-list
 *     (SNOMED bodySite codes, IVOM procedure code, BCVA method, segment
 *     observation codes), OR
 *   - Present in `EXPECTED_SEED_KEYS` (kept in sync with `_seedMap` in
 *     `src/services/terminology.ts`; drift guard test in
 *     `tests/audit-bundle-codes.test.ts`).
 *
 * Exit code:
 *   0 — all codes resolvable
 *   1 — one or more unresolvable; tuples written to stderr
 *
 * Usage: `npm run audit:bundles` (wired in package.json)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// --- Seed key mirror (kept in sync with _seedMap; enforced by drift-guard test) ---
const EXPECTED_SEED_KEYS = [
  // SNOMED CT
  'http://snomed.info/sct|267718000',  // AMD
  'http://snomed.info/sct|312898008',  // Diabetic retinopathy
  'http://snomed.info/sct|312903003',  // Diabetic macular edema
  'http://snomed.info/sct|362098006',  // Retinal vein occlusion
  // ICD-10-GM
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|E11.9',
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|E10.9',
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|H40.1',
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|H25.1',
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|H33.0',
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|I10',
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|E78.0',
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|I25.1',
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|E11',
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|H43.1',
  'http://fhir.de/CodeSystem/bfarm/icd-10-gm|T85.8',
];

// --- Whitelist (D-03) ---
// Systems whose codes never need a seed (resolved locally or out of diagnosis scope):
const WHITELIST_SYSTEMS = new Set([
  'http://loinc.org',          // LOINC — local resolution
  'http://www.whocc.no/atc',   // ATC — medications, not diagnoses
]);
// Structural / non-diagnostic SNOMED codes used in bodySite / procedure / method slots:
const WHITELIST_KEYS = new Set([
  'http://snomed.info/sct|362502000',          // left eye structure
  'http://snomed.info/sct|362503005',          // right eye structure
  'http://snomed.info/sct|36189003',           // intravitreal injection (procedure)
  'http://snomed.info/sct|252886007',          // BCVA method
  'http://snomed.info/sct|anterior-segment',   // local segment marker
  'http://snomed.info/sct|posterior-segment',  // local segment marker
]);

const SEED_KEYS = new Set(EXPECTED_SEED_KEYS);

const BUNDLE_GLOB = process.env.BUNDLE_GLOB ?? 'public/data/center-*.json';

function expandGlob(pattern) {
  // Minimal glob: support a single `*` in the basename, anchored to a literal dir.
  const dir = dirname(pattern);
  const base = pattern.slice(dir.length + 1);
  const star = base.indexOf('*');
  if (star === -1) {
    return [pattern];
  }
  const prefix = base.slice(0, star);
  const suffix = base.slice(star + 1);
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    throw new Error(`audit:bundles — cannot read directory ${dir}: ${err.message}`);
  }
  return entries
    .filter((f) => f.startsWith(prefix) && f.endsWith(suffix))
    .map((f) => join(dir, f))
    .filter((p) => statSync(p).isFile())
    .sort();
}

function visitCoding(coding, ctx, unresolvable) {
  if (!coding || typeof coding !== 'object') return;
  const system = coding.system;
  const code = coding.code;
  if (!system || !code) return;
  const key = `${system}|${code}`;
  if (WHITELIST_SYSTEMS.has(system)) return;
  if (WHITELIST_KEYS.has(key)) return;
  if (SEED_KEYS.has(key)) return;
  unresolvable.push({ system, code, ...ctx });
}

function visitCodings(codings, ctx, unresolvable) {
  if (!Array.isArray(codings)) return;
  for (const c of codings) visitCoding(c, ctx, unresolvable);
}

function auditBundle(file) {
  const raw = readFileSync(file, 'utf-8');
  const bundle = JSON.parse(raw);
  const unresolvable = [];
  const seen = new Set();
  const interesting = new Set(['Condition', 'Observation', 'Procedure', 'MedicationStatement']);
  for (const entry of bundle.entry ?? []) {
    const r = entry?.resource;
    if (!r || !interesting.has(r.resourceType)) continue;
    const ctx = { file, resourceType: r.resourceType };
    if (r.code?.coding) visitCodings(r.code.coding, { ...ctx, field: 'code' }, unresolvable);
    if (Array.isArray(r.reasonCode)) {
      for (const rc of r.reasonCode) visitCodings(rc?.coding, { ...ctx, field: 'reasonCode' }, unresolvable);
    }
    if (Array.isArray(r.bodySite)) {
      for (const bs of r.bodySite) visitCodings(bs?.coding, { ...ctx, field: 'bodySite' }, unresolvable);
    } else if (r.bodySite?.coding) {
      visitCodings(r.bodySite.coding, { ...ctx, field: 'bodySite' }, unresolvable);
    }
    if (r.medicationCodeableConcept?.coding) {
      visitCodings(r.medicationCodeableConcept.coding, { ...ctx, field: 'medicationCodeableConcept' }, unresolvable);
    }
    // Track distinct (system|code) for the summary count
    const collect = (codings) => {
      if (!Array.isArray(codings)) return;
      for (const c of codings) if (c?.system && c?.code) seen.add(`${c.system}|${c.code}`);
    };
    collect(r.code?.coding);
    if (Array.isArray(r.reasonCode)) for (const rc of r.reasonCode) collect(rc?.coding);
    if (Array.isArray(r.bodySite)) for (const bs of r.bodySite) collect(bs?.coding);
    else if (r.bodySite?.coding) collect(r.bodySite.coding);
    if (r.medicationCodeableConcept?.coding) collect(r.medicationCodeableConcept.coding);
  }
  return { unresolvable, distinct: seen };
}

function main() {
  const root = resolve(process.cwd());
  const files = expandGlob(BUNDLE_GLOB);
  if (files.length === 0) {
    process.stderr.write(`[audit:bundles] no bundles matched ${BUNDLE_GLOB}\n`);
    process.exit(1);
  }
  const allUnresolvable = [];
  const allDistinct = new Set();
  for (const f of files) {
    const { unresolvable, distinct } = auditBundle(f);
    for (const u of unresolvable) allUnresolvable.push(u);
    for (const d of distinct) allDistinct.add(d);
  }
  if (allUnresolvable.length > 0) {
    for (const u of allUnresolvable) {
      process.stderr.write(`[audit:bundles] UNRESOLVABLE ${u.system}|${u.code} in ${u.file} (${u.resourceType}.${u.field})\n`);
    }
  }
  process.stdout.write(
    `[audit:bundles] scanned ${files.length} bundles, ${allDistinct.size} distinct codes, ${allUnresolvable.length} unresolvable\n`,
  );
  process.exit(allUnresolvable.length === 0 ? 0 : 1);
  // Silence unused root in stricter linters
  void root;
}

main();
