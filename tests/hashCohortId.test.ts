/**
 * Tests for server/hashCohortId.ts — HMAC-SHA256 cohort-id hashing primitive.
 * Phase 11 / CRREV-01 / threats T-11-02, T-11-03, T-11-05.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  _resetForTesting,
  hashCohortId,
  initHashCohortId,
} from '../server/hashCohortId.js';

const VALID_SECRET = 'a'.repeat(64);
const OTHER_SECRET = 'b'.repeat(64);

beforeEach(() => {
  _resetForTesting();
});

describe('hashCohortId', () => {
  it('same input produces same hash (determinism / D-06 / T-11-02)', () => {
    initHashCohortId({ audit: { cohortHashSecret: VALID_SECRET } });
    expect(hashCohortId('saved-search-abc')).toBe(hashCohortId('saved-search-abc'));
  });

  it('different inputs produce different hashes', () => {
    initHashCohortId({ audit: { cohortHashSecret: VALID_SECRET } });
    expect(hashCohortId('abc')).not.toBe(hashCohortId('abd'));
  });

  it('produces exactly 16 hex chars (D-04)', () => {
    initHashCohortId({ audit: { cohortHashSecret: VALID_SECRET } });
    expect(hashCohortId('abc')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('throws if secret missing and no dataDir for auto-generation (T-11-03)', () => {
    expect(() => initHashCohortId({})).toThrow(/no cohort hash secret|cohortHashSecret/);
  });

  it('throws if secret shorter than 64 chars (C4 hardening)', () => {
    expect(() => initHashCohortId({ audit: { cohortHashSecret: 'short' } })).toThrow(
      /cohortHashSecret/,
    );
  });

  it('rejects the repo placeholder value (C4 denylist)', () => {
    expect(() =>
      initHashCohortId({
        audit: { cohortHashSecret: 'dev-cohort-hash-secret-please-replace-in-prod-xxxxxxxxxxxxxx' },
      }),
    ).toThrow(/placeholder/);
  });

  it('throws if hashCohortId called before initHashCohortId', () => {
    expect(() => hashCohortId('abc')).toThrow(/called before initHashCohortId/);
  });

  it('same (secret, id) produces same hash across re-init (cross-restart determinism / D-06)', () => {
    initHashCohortId({ audit: { cohortHashSecret: VALID_SECRET } });
    const first = hashCohortId('cohort-xyz');
    _resetForTesting();
    initHashCohortId({ audit: { cohortHashSecret: VALID_SECRET } });
    const second = hashCohortId('cohort-xyz');
    expect(first).toBe(second);
  });

  it('different secrets produce different hashes for the same id (rotation sanity)', () => {
    initHashCohortId({ audit: { cohortHashSecret: VALID_SECRET } });
    const withSecretA = hashCohortId('cohort-xyz');
    _resetForTesting();
    initHashCohortId({ audit: { cohortHashSecret: OTHER_SECRET } });
    const withSecretB = hashCohortId('cohort-xyz');
    expect(withSecretA).not.toBe(withSecretB);
  });
});
