/**
 * Phase 26 / Plan 26-01 / SYNTH-01: Tests for the bundle-code audit script.
 *
 * Verifies:
 *   1. Audit exits 0 on shipped bundles and reports "0 unresolvable".
 *   2. Audit exits 1 on a fixture bundle injecting an unknown SNOMED code.
 *   3. EXPECTED_SEED_KEYS in the script mirrors `_seedMap` keys (drift guard).
 *
 * Per D-03 the script is a fast CI gate (<5s), invoked via `npm run audit:bundles`.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { _seedMap } from '../src/services/terminology';

const SCRIPT = 'scripts/audit-bundle-codes.mjs';
const SHIPPED_GLOB = 'public/data/center-*.json';

describe('Phase 26 SYNTH-01 audit-bundle-codes', () => {
  it('reports 0 unresolvable across shipped bundles', () => {
    const result = spawnSync('node', [SCRIPT], {
      encoding: 'utf-8',
      env: { ...process.env, BUNDLE_GLOB: SHIPPED_GLOB },
    });
    if (result.status !== 0) {
      // Surface stderr so failures are diagnosable
      throw new Error(`audit exited ${result.status}\nstderr:\n${result.stderr}\nstdout:\n${result.stdout}`);
    }
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/0 unresolvable/);
  });

  it('exits 1 on injected unknown code', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'audit-test-'));
    const src = readFileSync('public/data/center-aachen.json', 'utf-8');
    const bundle = JSON.parse(src);
    // Inject a fake SNOMED code into the first Condition
    let injected = false;
    for (const e of bundle.entry ?? []) {
      const r = e.resource;
      if (r?.resourceType === 'Condition' && Array.isArray(r.code?.coding) && r.code.coding[0]) {
        r.code.coding[0] = { system: 'http://snomed.info/sct', code: '999999999-fake' };
        injected = true;
        break;
      }
    }
    expect(injected).toBe(true);
    const fixture = join(tmp, 'center-fakefixture.json');
    writeFileSync(fixture, JSON.stringify(bundle));

    const result = spawnSync('node', [SCRIPT], {
      encoding: 'utf-8',
      env: { ...process.env, BUNDLE_GLOB: join(tmp, 'center-*.json') },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/999999999-fake/);
  });

  it('EXPECTED_SEED_KEYS in script mirrors _seedMap', () => {
    const scriptSrc = readFileSync(SCRIPT, 'utf-8');
    for (const key of _seedMap.keys()) {
      // Each key must appear verbatim somewhere in the EXPECTED_SEED_KEYS array literal
      expect(scriptSrc).toContain(key);
    }
  });
});
