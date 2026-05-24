/**
 * scripts/loadStubConfig.ts
 *
 * Phase 34 / WR-03 / D-11: single source for the stub-generation factor bounds.
 *
 * CLAUDE.md mandates `config/settings.yaml` as the single config source. Both
 * bundle generators (generate-center-bundle.ts, augment-reference-bundles.ts)
 * draw the per-site stub factor from [factorMin, factorMax]; previously those
 * bounds were inlined as the magic numbers `2, 8` while a comment falsely
 * claimed they were "sourced from config/settings.yaml". This module makes the
 * coupling real: the YAML keys are now actually read at script start.
 *
 * The verifier (verify-bundle-distributions.mjs THRESHOLDS.stubFactorMin/Max)
 * still mirrors these values independently because it is a standalone .mjs with
 * no TS build step; keep the two in sync when editing config/settings.yaml.
 */

import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

export interface StubFactorBounds {
  factorMin: number;
  factorMax: number;
}

/**
 * Read `stubs.factorMin` / `stubs.factorMax` from config/settings.yaml.
 *
 * Throws (D-03 throw-only) if the file is missing, unparseable, or the keys are
 * absent / non-integer / inverted — a misconfigured stub factor would silently
 * corrupt every regenerated bundle, so failing loudly is the safe choice.
 */
export function loadStubFactorBounds(
  configPath = path.resolve(process.cwd(), 'config', 'settings.yaml'),
): StubFactorBounds {
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = yaml.load(raw) as { stubs?: { factorMin?: unknown; factorMax?: unknown } } | null;
  const stubs = parsed?.stubs;
  if (!stubs) {
    throw new Error(`loadStubFactorBounds: missing 'stubs' section in ${configPath}`);
  }
  const { factorMin, factorMax } = stubs;
  if (!Number.isInteger(factorMin) || !Number.isInteger(factorMax)) {
    throw new Error(
      `loadStubFactorBounds: stubs.factorMin / stubs.factorMax must be integers in ${configPath} (got ${String(factorMin)}, ${String(factorMax)})`,
    );
  }
  if ((factorMin as number) < 1 || (factorMax as number) < (factorMin as number)) {
    throw new Error(
      `loadStubFactorBounds: require 1 <= factorMin <= factorMax in ${configPath} (got ${String(factorMin)}, ${String(factorMax)})`,
    );
  }
  return { factorMin: factorMin as number, factorMax: factorMax as number };
}
