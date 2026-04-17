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
  getValidCenterIds: () => new Set(['org-uka', 'org-ukc', 'org-ukd', 'org-ukg', 'org-ukl', 'org-ukmz', 'org-ukt']),
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

  it('user with all 7 valid centers bypasses', () => {
    expect(isBypass('researcher', ['org-uka', 'org-ukc', 'org-ukd', 'org-ukg', 'org-ukl', 'org-ukmz', 'org-ukt'])).toBe(true);
  });

  it('user with fewer than 7 valid centers does NOT bypass', () => {
    expect(isBypass('researcher', ['org-uka', 'org-ukc'])).toBe(false);
    expect(isBypass('researcher', ['org-uka', 'org-ukc', 'org-ukd', 'org-ukg', 'org-ukl', 'org-ukmz'])).toBe(false);
  });

  it('user with 7 INVALID center strings does NOT bypass (set membership check)', () => {
    // This was the old bug: centers.length >= N would bypass with any N strings
    expect(isBypass('researcher', ['fake-1', 'fake-2', 'fake-3', 'fake-4', 'fake-5', 'fake-6', 'fake-7'])).toBe(false);
  });

  it('user with mix of valid and invalid centers does NOT bypass if under threshold', () => {
    expect(isBypass('researcher', ['org-uka', 'org-ukc', 'fake-1', 'fake-2', 'fake-3', 'fake-4', 'fake-5'])).toBe(false);
  });

  it('empty centers array does NOT bypass', () => {
    expect(isBypass('researcher', [])).toBe(false);
  });
});
