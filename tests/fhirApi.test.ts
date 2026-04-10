/**
 * Tests for server/fhirApi.ts — FHIR bundle loading, caching, and center filtering.
 *
 * TDD: Written BEFORE production code (RED phase).
 * All 8 behavior specs from 05-01-PLAN.md Task 1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock fs — so we don't read actual files during tests
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn((filePath: string) => {
      if (String(filePath).includes('manifest.json')) {
        return JSON.stringify(['center-aachen.json', 'center-bonn.json']);
      }
      if (String(filePath).includes('settings.yaml') || String(filePath).includes('public/settings.yaml')) {
        return 'dataSource:\n  type: local\n  blazeUrl: http://localhost:8080/fhir\n';
      }
      if (String(filePath).includes('center-aachen.json')) {
        return JSON.stringify(AACHEN_BUNDLE);
      }
      if (String(filePath).includes('center-bonn.json')) {
        return JSON.stringify(BONN_BUNDLE);
      }
      return '{}';
    }),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
  },
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn((filePath: string) => {
    if (String(filePath).includes('manifest.json')) {
      return JSON.stringify(['center-aachen.json', 'center-bonn.json']);
    }
    if (String(filePath).includes('settings.yaml') || String(filePath).includes('public/settings.yaml')) {
      return 'dataSource:\n  type: local\n  blazeUrl: http://localhost:8080/fhir\n';
    }
    if (String(filePath).includes('center-aachen.json')) {
      return JSON.stringify(AACHEN_BUNDLE);
    }
    if (String(filePath).includes('center-bonn.json')) {
      return JSON.stringify(BONN_BUNDLE);
    }
    return '{}';
  }),
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock js-yaml for settings parsing
// ---------------------------------------------------------------------------

vi.mock('js-yaml', () => ({
  default: {
    load: vi.fn((str: string) => {
      if (String(str).includes('dataSource')) {
        return {
          dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
        };
      }
      return {};
    }),
  },
  load: vi.fn((str: string) => {
    if (String(str).includes('dataSource')) {
      return {
        dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
      };
    }
    return {};
  }),
}));

// ---------------------------------------------------------------------------
// Test fixtures — FHIR bundles
// ---------------------------------------------------------------------------

const AACHEN_BUNDLE = {
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    {
      resource: {
        resourceType: 'Organization',
        id: 'org-uka',
        name: 'Universitätsklinikum Aachen',
      },
    },
    {
      resource: {
        resourceType: 'Patient',
        id: 'pat-uka-001',
        meta: { source: 'org-uka' },
        gender: 'female',
        birthDate: '1956-11-19',
      },
    },
    {
      resource: {
        resourceType: 'Condition',
        id: 'cond-uka-001',
        subject: { reference: 'Patient/pat-uka-001' },
      },
    },
  ],
};

const BONN_BUNDLE = {
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    {
      resource: {
        resourceType: 'Organization',
        id: 'org-ukb',
        name: 'Universitätsklinikum Bonn',
      },
    },
    {
      resource: {
        resourceType: 'Patient',
        id: 'pat-ukb-001',
        meta: { source: 'org-ukb' },
        gender: 'male',
        birthDate: '1960-05-10',
      },
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-ukb-001',
        subject: { reference: 'Patient/pat-ukb-001' },
      },
    },
  ],
};

// Synthetic Blaze bundle — no Organization entry (distinguishes it from local per-center bundles),
// multiple patients from different centers, linked resources cascade by Patient.meta.source
const BLAZE_SYNTHETIC_BUNDLE = {
  resourceType: 'Bundle',
  type: 'searchset',
  meta: {
    lastUpdated: new Date().toISOString(),
    source: 'http://localhost:8080/fhir',
  },
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        id: 'blaze-pat-001',
        meta: { source: 'org-uka' },
      },
    },
    {
      resource: {
        resourceType: 'Patient',
        id: 'blaze-pat-002',
        meta: { source: 'org-ukb' },
      },
    },
    {
      resource: {
        resourceType: 'Condition',
        id: 'blaze-cond-001',
        subject: { reference: 'Patient/blaze-pat-001' },
      },
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'blaze-obs-001',
        subject: { reference: 'Patient/blaze-pat-002' },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Import module under test (after mocks)
// ---------------------------------------------------------------------------

const {
  filterBundlesByCenters,
  isBypass,
  getOrgIdFromBundle,
  getCaseToCenter,
  invalidateFhirCache,
} = await import('../server/fhirApi.js');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fhirApi — filtering and bypass logic', () => {
  beforeEach(() => {
    // Reset cache between tests
    invalidateFhirCache();
  });

  // Test 1: filterBundlesByCenters() with local bundles — user with ['org-uka'] only gets aachen bundle
  it('Test 1: filterBundlesByCenters() with local bundles filters to user centers only', () => {
    const bundles = [AACHEN_BUNDLE, BONN_BUNDLE];
    const result = filterBundlesByCenters(bundles, ['org-uka']);
    expect(result).toHaveLength(1);
    // The returned bundle should be the Aachen bundle (has Organization org-uka)
    const orgEntry = result[0].entry.find(
      (e: { resource: { resourceType: string; id?: string } }) => e.resource.resourceType === 'Organization',
    );
    expect(orgEntry?.resource.id).toBe('org-uka');
  });

  // Test 2: filterBundlesByCenters() with Blaze synthetic bundle — filters by Patient.meta.source, cascades
  it('Test 2: filterBundlesByCenters() with Blaze synthetic bundle filters by Patient.meta.source and cascades', () => {
    const result = filterBundlesByCenters([BLAZE_SYNTHETIC_BUNDLE], ['org-uka']);
    expect(result).toHaveLength(1);
    const filteredBundle = result[0];

    // Patient from org-uka should be present
    const patients = filteredBundle.entry.filter(
      (e: { resource: { resourceType: string; meta?: { source?: string } } }) =>
        e.resource.resourceType === 'Patient',
    );
    expect(patients.some((p: { resource: { id?: string } }) => p.resource.id === 'blaze-pat-001')).toBe(true);

    // Patient from org-ukb should be excluded
    expect(patients.some((p: { resource: { id?: string } }) => p.resource.id === 'blaze-pat-002')).toBe(false);

    // Condition referencing permitted patient should be kept
    const conditions = filteredBundle.entry.filter(
      (e: { resource: { resourceType: string } }) => e.resource.resourceType === 'Condition',
    );
    expect(conditions.some((c: { resource: { id?: string } }) => c.resource.id === 'blaze-cond-001')).toBe(true);

    // Observation referencing excluded patient should be removed
    const observations = filteredBundle.entry.filter(
      (e: { resource: { resourceType: string } }) => e.resource.resourceType === 'Observation',
    );
    expect(observations.some((o: { resource: { id?: string } }) => o.resource.id === 'blaze-obs-001')).toBe(false);
  });

  // Test 3: isBypass() returns true for admin regardless of centers
  it('Test 3: isBypass() returns true for role=admin regardless of centers', () => {
    expect(isBypass('admin', [])).toBe(true);
    expect(isBypass('admin', ['org-uka'])).toBe(true);
    expect(isBypass('admin', ['org-uka', 'org-ukb', 'org-lmu', 'org-ukt', 'org-ukm'])).toBe(true);
  });

  // Test 4: isBypass() returns true for non-admin with all 5 org-* centers
  it('Test 4: isBypass() returns true for non-admin with all 5 org-* centers', () => {
    const allCenters = ['org-uka', 'org-ukb', 'org-lmu', 'org-ukt', 'org-ukm'];
    expect(isBypass('researcher', allCenters)).toBe(true);
    expect(isBypass('clinic_lead', allCenters)).toBe(true);
  });

  // Test 5: isBypass() returns false for non-admin with 3 centers
  it('Test 5: isBypass() returns false for non-admin with fewer than 5 centers', () => {
    expect(isBypass('researcher', ['org-uka', 'org-ukb', 'org-lmu'])).toBe(false);
    expect(isBypass('clinician', ['org-uka'])).toBe(false);
    expect(isBypass('epidemiologist', [])).toBe(false);
  });

  // Test 6: getOrgIdFromBundle() extracts Organization.resource.id from bundle
  it('Test 6: getOrgIdFromBundle() extracts Organization id from bundle', () => {
    expect(getOrgIdFromBundle(AACHEN_BUNDLE)).toBe('org-uka');
    expect(getOrgIdFromBundle(BONN_BUNDLE)).toBe('org-ukb');
  });

  it('Test 6b: getOrgIdFromBundle() returns null if no Organization entry', () => {
    const bundleNoOrg = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        { resource: { resourceType: 'Patient', id: 'pat-001', meta: { source: 'org-uka' } } },
      ],
    };
    expect(getOrgIdFromBundle(bundleNoOrg)).toBeNull();
  });

  // Test 7: getCaseToCenter() returns Map mapping patient ID to org-ID from cached bundles
  it('Test 7: getCaseToCenter() returns patient-to-center mapping', () => {
    // Pre-populate cache by resetting and checking empty state first
    const map = getCaseToCenter();
    // When cache is empty, should return empty Map (not throw)
    expect(map).toBeInstanceOf(Map);
  });

  // Test 8: Center ID migration converts shorthand to org-* format
  it('Test 8: _migrateCenterIds converts shorthand center IDs to org-* format', async () => {
    // Import the migration function (exported for testing via initAuth)
    const { _migrateCenterIds } = await import('../server/initAuth.js');
    const users = [
      { username: 'test1', role: 'researcher', centers: ['UKA', 'UKB'], createdAt: '2025-01-01T00:00:00Z' },
      { username: 'test2', role: 'admin', centers: ['org-uka', 'org-ukb'], createdAt: '2025-01-01T00:00:00Z' },
      { username: 'test3', role: 'clinician', centers: ['LMU', 'UKT', 'UKM'], createdAt: '2025-01-01T00:00:00Z' },
    ];
    const result = _migrateCenterIds(users as Parameters<typeof _migrateCenterIds>[0]);
    expect(result.changed).toBe(true);
    expect(result.users[0].centers).toEqual(['org-uka', 'org-ukb']);
    // Already-migrated values are unchanged
    expect(result.users[1].centers).toEqual(['org-uka', 'org-ukb']);
    expect(result.users[2].centers).toEqual(['org-lmu', 'org-ukt', 'org-ukm']);
  });

  it('Test 8b: _migrateCenterIds returns changed=false when no migration needed', async () => {
    const { _migrateCenterIds } = await import('../server/initAuth.js');
    const users = [
      { username: 'admin', role: 'admin', centers: ['org-uka', 'org-ukb', 'org-lmu', 'org-ukt', 'org-ukm'], createdAt: '2025-01-01T00:00:00Z' },
    ];
    const result = _migrateCenterIds(users as Parameters<typeof _migrateCenterIds>[0]);
    expect(result.changed).toBe(false);
  });
});
