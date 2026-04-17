/**
 * Tests for server/hashCohortId.ts — HMAC-SHA256 cohort-id hashing primitive.
 * Phase 11 / CRREV-01 / threats T-11-02, T-11-03, T-11-05.
 * Phase 14 / SEC-02 — auto-generate cohort-hash-secret.txt on fresh startup.
 */

import fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import {
  _resetForTesting,
  hashCohortId,
  initHashCohortId,
} from '../server/hashCohortId.js';

const VALID_SECRET = 'deterministic-test-secret-32-chars-minimum-xxxxx';
const OTHER_SECRET = 'different-test-secret-32-chars-minimum-abcdefgh';

beforeEach(() => {
  _resetForTesting();
});

describe('hashCohortId', () => {
  it('same input produces same hash (determinism / D-06 / T-11-02)', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
    try {
      initHashCohortId(tmpDir, { audit: { cohortHashSecret: VALID_SECRET } });
      expect(hashCohortId('saved-search-abc')).toBe(hashCohortId('saved-search-abc'));
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('different inputs produce different hashes', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
    try {
      initHashCohortId(tmpDir, { audit: { cohortHashSecret: VALID_SECRET } });
      expect(hashCohortId('abc')).not.toBe(hashCohortId('abd'));
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('produces exactly 16 hex chars (D-04)', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
    try {
      initHashCohortId(tmpDir, { audit: { cohortHashSecret: VALID_SECRET } });
      expect(hashCohortId('abc')).toMatch(/^[0-9a-f]{16}$/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('auto-generates and writes file when neither file nor settings secret exist (SEC-02)', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
    try {
      initHashCohortId(tmpDir, {});
      const secretFile = path.join(tmpDir, 'cohort-hash-secret.txt');
      expect(fs.existsSync(secretFile)).toBe(true);
      const content = fs.readFileSync(secretFile, 'utf-8').trim();
      expect(content).toMatch(/^[0-9a-f]{64}$/);
      // Verify file mode is 0o600
      const mode = fs.statSync(secretFile).mode & 0o777;
      expect(mode).toBe(0o600);
      // hashCohortId works after auto-generation
      expect(hashCohortId('test-id')).toMatch(/^[0-9a-f]{16}$/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('file-first priority: uses file secret, ignores settings value (SEC-02)', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
    try {
      const secretFile = path.join(tmpDir, 'cohort-hash-secret.txt');
      fs.writeFileSync(secretFile, VALID_SECRET, { encoding: 'utf-8', mode: 0o600 });
      initHashCohortId(tmpDir, { audit: { cohortHashSecret: OTHER_SECRET } });
      const hashWithFile = hashCohortId('cohort-xyz');
      _resetForTesting();
      // Now init with only the settings value (no file)
      const tmpDir2 = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
      try {
        initHashCohortId(tmpDir2, { audit: { cohortHashSecret: VALID_SECRET } });
        const hashWithSettings = hashCohortId('cohort-xyz');
        // File value (VALID_SECRET) matches settings-only VALID_SECRET → same hash
        expect(hashWithFile).toBe(hashWithSettings);
      } finally {
        rmSync(tmpDir2, { recursive: true, force: true });
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('settings fallback: uses settings secret when file does not exist (SEC-02)', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
    try {
      initHashCohortId(tmpDir, { audit: { cohortHashSecret: VALID_SECRET } });
      // No file should have been created (settings fallback path does not create a file)
      const secretFile = path.join(tmpDir, 'cohort-hash-secret.txt');
      expect(fs.existsSync(secretFile)).toBe(false);
      // hashCohortId still works via settings value
      expect(hashCohortId('test-id')).toMatch(/^[0-9a-f]{16}$/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws if secret file is too short (T-11-03)', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
    try {
      const secretFile = path.join(tmpDir, 'cohort-hash-secret.txt');
      fs.writeFileSync(secretFile, 'short', { encoding: 'utf-8', mode: 0o600 });
      expect(() => initHashCohortId(tmpDir, {})).toThrow(/too short/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws if hashCohortId called before initHashCohortId', () => {
    expect(() => hashCohortId('abc')).toThrow(/called before initHashCohortId/);
  });

  it('same (secret, id) produces same hash across re-init (cross-restart determinism / D-06)', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
    try {
      initHashCohortId(tmpDir, { audit: { cohortHashSecret: VALID_SECRET } });
      const first = hashCohortId('cohort-xyz');
      _resetForTesting();
      initHashCohortId(tmpDir, { audit: { cohortHashSecret: VALID_SECRET } });
      const second = hashCohortId('cohort-xyz');
      expect(first).toBe(second);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('different secrets produce different hashes for the same id (rotation sanity)', () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
    const tmpDir2 = mkdtempSync(path.join(os.tmpdir(), 'emd-test-'));
    try {
      initHashCohortId(tmpDir, { audit: { cohortHashSecret: VALID_SECRET } });
      const withSecretA = hashCohortId('cohort-xyz');
      _resetForTesting();
      initHashCohortId(tmpDir2, { audit: { cohortHashSecret: OTHER_SECRET } });
      const withSecretB = hashCohortId('cohort-xyz');
      expect(withSecretA).not.toBe(withSecretB);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
      rmSync(tmpDir2, { recursive: true, force: true });
    }
  });
});
