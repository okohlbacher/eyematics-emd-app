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

describe('isBypass — center filtering bypass logic (H1 / F-05)', () => {
  it('admin always bypasses regardless of centers', () => {
    expect(isBypass('admin', [])).toBe(true);
    expect(isBypass('admin', ['org-uka'])).toBe(true);
    expect(isBypass('admin', ['org-uka', 'org-ukc', 'org-ukd', 'org-ukg', 'org-ukl', 'org-ukmz', 'org-ukt'])).toBe(true);
  });

  it('non-admin never bypasses, even with all valid centers (superset heuristic removed)', () => {
    expect(isBypass('researcher', ['org-uka', 'org-ukc', 'org-ukd', 'org-ukg', 'org-ukl', 'org-ukmz', 'org-ukt'])).toBe(false);
    expect(isBypass('clinic_lead', ['org-uka', 'org-ukc', 'org-ukd', 'org-ukg', 'org-ukl', 'org-ukmz', 'org-ukt'])).toBe(false);
  });

  it('non-admin with fewer centers does not bypass', () => {
    expect(isBypass('researcher', ['org-uka', 'org-ukc'])).toBe(false);
    expect(isBypass('clinician', ['org-uka'])).toBe(false);
  });

  it('non-admin with forged/invalid center ids does not bypass', () => {
    expect(isBypass('researcher', ['fake-1', 'fake-2', 'fake-3', 'fake-4', 'fake-5', 'fake-6', 'fake-7'])).toBe(false);
  });

  it('empty centers array does not bypass for non-admin', () => {
    expect(isBypass('researcher', [])).toBe(false);
  });
});
