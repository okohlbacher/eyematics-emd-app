/**
 * Phase 34 Plan 01 / Wave 0 scaffold: D-13 byte-equality + idempotency for
 * scripts/augment-reference-bundles.ts.
 *
 * These tests are SKIPPED until Plan 03 creates the augmentation script.
 * Full assertion bodies are written here so Plan 03 only needs to remove .skip.
 *
 * Assertions:
 *   1. Every pre-existing resource (matched by resource.id) is byte-identical after augmentation.
 *   2. At least one new entry (Consent or stub) was appended.
 *   3. Running the script twice does not change bundle.entry.length (idempotency).
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const SCRIPT = resolve('scripts/augment-reference-bundles.ts');
const REFERENCE_BUNDLE = 'public/data/center-aachen.json';

// SKIP_REASON: scripts/augment-reference-bundles.ts does not exist until Plan 03.
it.skip('augment-reference-bundles: pre-existing resources are byte-identical after augmentation (D-13)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'augment-test-'));
  const src = readFileSync(REFERENCE_BUNDLE, 'utf-8');
  const bundleBefore = JSON.parse(src) as {
    entry: Array<{ resource: { resourceType: string; id: string } }>;
  };

  // Snapshot all pre-existing entry ids and their serialized form
  const curatedMap = new Map<string, string>();
  for (const e of bundleBefore.entry) {
    curatedMap.set(e.resource.id, JSON.stringify(e));
  }

  // Write a copy to temp dir for augmentation
  const outPath = join(tmp, 'center-aachen.json');
  writeFileSync(outPath, src, 'utf-8');

  // Run the augmentation script against the temp copy
  const result = spawnSync(
    'node',
    ['--import', 'tsx', SCRIPT, '--file', outPath],
    { encoding: 'utf-8', cwd: resolve('.') },
  );
  if (result.status !== 0) {
    throw new Error(
      `augment script exited ${result.status}\nstderr:\n${result.stderr}\nstdout:\n${result.stdout}`,
    );
  }

  const bundleAfter = JSON.parse(readFileSync(outPath, 'utf-8')) as {
    entry: Array<{ resource: { resourceType: string; id: string } }>;
  };

  // 1. All pre-existing resources must be byte-identical (D-13 append-only invariant)
  for (const [id, beforeJson] of curatedMap) {
    const afterEntry = bundleAfter.entry.find((a) => a.resource.id === id);
    expect(afterEntry).not.toBeUndefined();
    expect(JSON.stringify(afterEntry)).toBe(beforeJson);
  }
});

// SKIP_REASON: scripts/augment-reference-bundles.ts does not exist until Plan 03.
it.skip('augment-reference-bundles: at least one new Consent or stub entry is appended', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'augment-new-test-'));
  const src = readFileSync(REFERENCE_BUNDLE, 'utf-8');
  const bundleBefore = JSON.parse(src) as {
    entry: Array<{ resource: { resourceType: string; id: string } }>;
  };

  const curatedIds = new Set(bundleBefore.entry.map((e) => e.resource.id));

  const outPath = join(tmp, 'center-aachen.json');
  writeFileSync(outPath, src, 'utf-8');

  const result = spawnSync(
    'node',
    ['--import', 'tsx', SCRIPT, '--file', outPath],
    { encoding: 'utf-8', cwd: resolve('.') },
  );
  if (result.status !== 0) {
    throw new Error(
      `augment script exited ${result.status}\nstderr:\n${result.stderr}\nstdout:\n${result.stdout}`,
    );
  }

  const bundleAfter = JSON.parse(readFileSync(outPath, 'utf-8')) as {
    entry: Array<{ resource: { resourceType: string; id: string } }>;
  };

  // 2. At least one new entry (Consent or stub Patient/Encounter) was appended
  const newEntries = bundleAfter.entry.filter((e) => !curatedIds.has(e.resource.id));
  expect(newEntries.length).toBeGreaterThan(0);
  // Verify the new entries are of the expected types
  const newTypes = new Set(newEntries.map((e) => e.resource.resourceType));
  const hasConsentOrStub =
    newTypes.has('Consent') || newTypes.has('Patient') || newTypes.has('Encounter');
  expect(hasConsentOrStub).toBe(true);
});

describe('augment-reference-bundles: idempotency (D-13)', () => {
  // SKIP_REASON: scripts/augment-reference-bundles.ts does not exist until Plan 03.
  it.skip('running the script twice does not change bundle.entry.length', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'augment-idempotent-test-'));
    const src = readFileSync(REFERENCE_BUNDLE, 'utf-8');
    const outPath = join(tmp, 'center-aachen.json');
    writeFileSync(outPath, src, 'utf-8');

    // First run
    const firstRun = spawnSync(
      'node',
      ['--import', 'tsx', SCRIPT, '--file', outPath],
      { encoding: 'utf-8', cwd: resolve('.') },
    );
    if (firstRun.status !== 0) {
      throw new Error(
        `first run exited ${firstRun.status}\nstderr:\n${firstRun.stderr}`,
      );
    }

    const bundleAfterFirst = JSON.parse(readFileSync(outPath, 'utf-8')) as {
      entry: unknown[];
    };
    const countAfterFirst = bundleAfterFirst.entry.length;

    // Second run on the already-augmented file
    const secondRun = spawnSync(
      'node',
      ['--import', 'tsx', SCRIPT, '--file', outPath],
      { encoding: 'utf-8', cwd: resolve('.') },
    );
    if (secondRun.status !== 0) {
      throw new Error(
        `second run exited ${secondRun.status}\nstderr:\n${secondRun.stderr}`,
      );
    }

    const bundleAfterSecond = JSON.parse(readFileSync(outPath, 'utf-8')) as {
      entry: unknown[];
    };

    // 3. Idempotency: entry count must be identical after the second run
    expect(bundleAfterSecond.entry.length).toBe(countAfterFirst);
  });
});
