/**
 * Tests for server/constants.ts — configurable centers and shared constants.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

import fs from 'node:fs';

import {
  BLAZE_RESOURCE_TYPES,
  getCenters,
  getCenterShorthands,
  getFallbackCenterFiles,
  getValidCenterIds,
  initCenters,
  SETTINGS_FILE,
} from '../server/constants';

const VALID_CENTERS_JSON = JSON.stringify([
  { id: 'org-uka', shorthand: 'UKA', name: 'UK Aachen', file: 'center-aachen.json' },
  { id: 'org-ukc', shorthand: 'UKC', name: 'UK Chemnitz', file: 'center-chemnitz.json' },
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
    expect(centers[1].shorthand).toBe('UKC');
  });

  it('getValidCenterIds returns a Set of IDs', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(VALID_CENTERS_JSON);

    initCenters('/data');
    const ids = getValidCenterIds();
    expect(ids).toBeInstanceOf(Set);
    expect(ids.has('org-uka')).toBe(true);
    expect(ids.has('org-ukc')).toBe(true);
    expect(ids.has('org-xyz')).toBe(false);
  });

  it('getCenterShorthands returns id→shorthand map', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(VALID_CENTERS_JSON);

    initCenters('/data');
    const map = getCenterShorthands();
    expect(map['org-uka']).toBe('UKA');
    expect(map['org-ukc']).toBe('UKC');
  });

  it('getFallbackCenterFiles returns file names from config', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue(VALID_CENTERS_JSON);

    initCenters('/data');
    const files = getFallbackCenterFiles();
    expect(files).toEqual(['center-aachen.json', 'center-chemnitz.json']);
  });

  it('falls back to defaults when centers.json is missing', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);

    initCenters('/data');
    const centers = getCenters();
    expect(centers.length).toBe(8); // 8 default centers
    expect(centers.map(c => c.id)).toContain('org-uka');
    expect(centers.map(c => c.id)).toContain('org-ukm');
    expect(centers.map(c => c.id)).toContain('org-ukmz');
  });

  it('falls back to defaults on malformed JSON', () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (fs.readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('not json');

    initCenters('/data');
    const centers = getCenters();
    expect(centers.length).toBe(8);
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
    // F-25: SETTINGS_FILE is now an absolute resolved path
    expect(SETTINGS_FILE).toMatch(/config[/\\]settings\.yaml$/);
  });
});
