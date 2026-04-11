/**
 * Tests for server/constants.ts — configurable centers and shared constants.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

import fs from 'node:fs';
import {
  initCenters,
  getCenters,
  getValidCenterIds,
  getCenterShorthands,
  getFallbackCenterFiles,
  BLAZE_RESOURCE_TYPES,
  SETTINGS_FILE,
} from '../server/constants';

const VALID_CENTERS_JSON = JSON.stringify([
  { id: 'org-uka', shorthand: 'UKA', name: 'UK Aachen', file: 'center-aachen.json' },
  { id: 'org-ukb', shorthand: 'UKB', name: 'UK Bonn', file: 'center-bonn.json' },
]);

describe('constants — center configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads centers from data/centers.json', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(VALID_CENTERS_JSON);

    initCenters('/data');
    const centers = getCenters();
    expect(centers).toHaveLength(2);
    expect(centers[0].id).toBe('org-uka');
    expect(centers[1].shorthand).toBe('UKB');
  });

  it('getValidCenterIds returns a Set of IDs', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(VALID_CENTERS_JSON);

    initCenters('/data');
    const ids = getValidCenterIds();
    expect(ids).toBeInstanceOf(Set);
    expect(ids.has('org-uka')).toBe(true);
    expect(ids.has('org-ukb')).toBe(true);
    expect(ids.has('org-xyz')).toBe(false);
  });

  it('getCenterShorthands returns id→shorthand map', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(VALID_CENTERS_JSON);

    initCenters('/data');
    const map = getCenterShorthands();
    expect(map['org-uka']).toBe('UKA');
    expect(map['org-ukb']).toBe('UKB');
  });

  it('getFallbackCenterFiles returns file names from config', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(VALID_CENTERS_JSON);

    initCenters('/data');
    const files = getFallbackCenterFiles();
    expect(files).toEqual(['center-aachen.json', 'center-bonn.json']);
  });

  it('falls back to defaults when centers.json is missing', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    initCenters('/data');
    const centers = getCenters();
    expect(centers.length).toBe(5); // 5 default centers
    expect(centers.map(c => c.id)).toContain('org-uka');
    expect(centers.map(c => c.id)).toContain('org-ukm');
  });

  it('falls back to defaults on malformed JSON', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('not json');

    initCenters('/data');
    const centers = getCenters();
    expect(centers.length).toBe(5);
  });
});

describe('constants — static values', () => {
  it('BLAZE_RESOURCE_TYPES has expected resource types', () => {
    expect(BLAZE_RESOURCE_TYPES.length).toBe(7);
    const types = BLAZE_RESOURCE_TYPES.map(r => r.type);
    expect(types).toContain('Patient');
    expect(types).toContain('Observation');
    expect(types).toContain('Organization');
  });

  it('SETTINGS_FILE points to config/', () => {
    expect(SETTINGS_FILE).toBe('config/settings.yaml');
  });
});
