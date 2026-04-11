/**
 * Tests for the center bypass logic fix in fhirApi.ts.
 * Verifies that bypass uses set membership, not just count.
 */

import { describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing
vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('dataSource:\n  type: local\n'),
    writeFileSync: vi.fn(),
  },
}));

vi.mock('../server/constants.js', () => ({
  getValidCenterIds: () => new Set(['org-uka', 'org-ukb', 'org-lmu', 'org-ukt', 'org-ukm']),
  getFallbackCenterFiles: () => ['center-aachen.json'],
  BLAZE_RESOURCE_TYPES: [],
  SETTINGS_FILE: 'config/settings.yaml',
}));

import { isBypass } from '../server/fhirApi';

describe('isBypass — center filtering bypass logic', () => {
  it('admin always bypasses', () => {
    expect(isBypass('admin', [])).toBe(true);
    expect(isBypass('admin', ['org-uka'])).toBe(true);
  });

  it('user with all 5 valid centers bypasses', () => {
    expect(isBypass('researcher', ['org-uka', 'org-ukb', 'org-lmu', 'org-ukt', 'org-ukm'])).toBe(true);
  });

  it('user with fewer than 5 valid centers does NOT bypass', () => {
    expect(isBypass('researcher', ['org-uka', 'org-ukb'])).toBe(false);
    expect(isBypass('researcher', ['org-uka', 'org-ukb', 'org-lmu', 'org-ukt'])).toBe(false);
  });

  it('user with 5 INVALID center strings does NOT bypass (set membership check)', () => {
    // This was the old bug: centers.length >= 5 would bypass with any 5 strings
    expect(isBypass('researcher', ['fake-1', 'fake-2', 'fake-3', 'fake-4', 'fake-5'])).toBe(false);
  });

  it('user with mix of valid and invalid centers does NOT bypass if under threshold', () => {
    expect(isBypass('researcher', ['org-uka', 'org-ukb', 'fake-1', 'fake-2', 'fake-3'])).toBe(false);
  });

  it('empty centers array does NOT bypass', () => {
    expect(isBypass('researcher', [])).toBe(false);
  });
});
