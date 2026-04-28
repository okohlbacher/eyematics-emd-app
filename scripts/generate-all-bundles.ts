/**
 * scripts/generate-all-bundles.ts
 *
 * Regenerate the synthetic-site FHIR bundles (Chemnitz, Greifswald, Leipzig,
 * Münster) by calling generateCenterBundle() with fixed per-site seeds so the
 * output is reproducible across machines.
 *
 * The two curated reference bundles — center-aachen.json and center-tuebingen.json —
 * are deliberately NOT in the SITES list (mitigates threat T-07-04: Tampering of
 * kept bundles). Plan 07-03 deleted the legacy center-bonn / center-muenchen
 * files. center-muenster was re-added per post-v1.8 roster feedback.
 * Plan 24-01 removed Dresden (UKD) and Mainz (UKMZ) per FB-01 site-roster
 * cleanup ("will not participate").
 *
 * Invoked via `npm run generate-bundles`.
 */

import fs from 'node:fs';
import path from 'node:path';

import { generateCenterBundle } from './generate-center-bundle.js';

interface SiteSpec {
  centerId: string;
  shorthand: string;
  name: string;
  city: string;
  state: string;
  file: string;
  seed: number;
  patients: number;
}

const SITES: SiteSpec[] = [
  { centerId: 'org-ukc',  shorthand: 'UKC',  name: 'Universitätsklinikum Chemnitz',   city: 'Chemnitz',   state: 'SN', file: 'center-chemnitz.json',   seed: 70103, patients: 45 },
  { centerId: 'org-ukg',  shorthand: 'UKG',  name: 'Universitätsklinikum Greifswald', city: 'Greifswald', state: 'MV', file: 'center-greifswald.json', seed: 70107, patients: 45 },
  { centerId: 'org-ukl',  shorthand: 'UKL',  name: 'Universitätsklinikum Leipzig',    city: 'Leipzig',    state: 'SN', file: 'center-leipzig.json',    seed: 70112, patients: 45 },
  { centerId: 'org-ukm',  shorthand: 'UKM',  name: 'Universitätsklinikum Münster',    city: 'Münster',    state: 'NRW', file: 'center-muenster.json',  seed: 70114, patients: 45 },
];

const OUT_DIR = path.resolve(process.cwd(), 'public', 'data');

for (const s of SITES) {
  const bundle = generateCenterBundle({
    centerId: s.centerId,
    shorthand: s.shorthand,
    name: s.name,
    city: s.city,
    state: s.state,
    patients: s.patients,
    seed: s.seed,
  });
  const outPath = path.join(OUT_DIR, s.file);
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
  console.log(`[generate-all-bundles] wrote ${outPath} (${s.patients} patients, seed=${s.seed})`);
}
