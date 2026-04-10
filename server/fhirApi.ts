/**
 * FHIR API router: server-side bundle loading, caching, and center-based filtering.
 *
 * Endpoints:
 *   GET /api/fhir/bundles — returns FHIR bundles filtered by the authenticated user's centers
 *
 * Security:
 *   - All routes are protected by authMiddleware (mounted globally on /api/*)
 *   - Bypass: admin users and users with all 5 org-* centers receive all bundles
 *   - All other users receive only bundles for their assigned centers
 *   - Local bundles are loaded from public/data/ on the server, never served as raw static assets
 *
 * Implements: CENTER-01, CENTER-02, CENTER-04, CENTER-05, CENTER-06
 * Mitigates: T-05-01 (information disclosure), T-05-04 (stale cache), T-05-06 (Blaze error detail)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { getValidCenterIds, getFallbackCenterFiles, BLAZE_RESOURCE_TYPES, SETTINGS_FILE } from './constants.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BundleEntry {
  resource: {
    resourceType: string;
    id?: string;
    meta?: { source?: string; lastUpdated?: string };
    subject?: { reference?: string };
    [key: string]: unknown;
  };
}

interface FhirBundle {
  resourceType: string;
  type: string;
  meta?: { lastUpdated?: string; source?: string };
  entry: BundleEntry[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Module-level cache (D-07)
// ---------------------------------------------------------------------------

let _bundleCache: FhirBundle[] | null = null;
let _caseIndex: Map<string, string> | null = null;

/**
 * Invalidate the in-memory FHIR bundle cache.
 * Must be called when settings are changed (data source or Blaze URL may differ).
 */
export function invalidateFhirCache(): void {
  _bundleCache = null;
  _caseIndex = null;
}

// ---------------------------------------------------------------------------
// Helper: bypass check
// ---------------------------------------------------------------------------

/**
 * Returns true if the user should bypass center filtering.
 * Admin users always bypass (D-12).
 * Non-admin users with all 5 org-* centers also bypass (D-13, D-14).
 */
export function isBypass(role: string, centers: string[]): boolean {
  if (role === 'admin') return true;
  // Verify actual set membership, not just count (prevents bypass with N arbitrary strings)
  const validCenters = getValidCenterIds();
  const validCount = centers.filter((c) => validCenters.has(c)).length;
  return validCount >= validCenters.size;
}

// ---------------------------------------------------------------------------
// Helper: extract Organization ID from bundle
// ---------------------------------------------------------------------------

/**
 * Returns the Organization resource's id from the bundle's entry list.
 * Returns null if no Organization entry is found.
 */
export function getOrgIdFromBundle(bundle: FhirBundle): string | null {
  const orgEntry = bundle.entry.find(
    (e) => e.resource.resourceType === 'Organization',
  );
  return orgEntry?.resource.id ?? null;
}

// ---------------------------------------------------------------------------
// Center filtering
// ---------------------------------------------------------------------------

/**
 * Filter bundles by user's permitted centers.
 *
 * Local bundles (with Organization entry): include if orgId is in userCenters, exclude entirely if not.
 * Blaze synthetic bundles (no per-bundle org): filter by Patient.meta.source, cascade to linked resources.
 */
export function filterBundlesByCenters(bundles: FhirBundle[], userCenters: string[]): FhirBundle[] {
  const userCenterSet = new Set(userCenters);
  const filtered: FhirBundle[] = [];

  for (const bundle of bundles) {
    const orgId = getOrgIdFromBundle(bundle);

    if (orgId !== null) {
      // Local bundle: include or exclude the entire bundle based on org-ID
      if (userCenterSet.has(orgId)) {
        filtered.push(bundle);
      }
      // else: exclude entirely — do not push
    } else {
      // Synthetic Blaze bundle: filter at resource level by Patient.meta.source
      const permittedPatientIds = new Set<string>();

      for (const entry of bundle.entry) {
        if (entry.resource.resourceType === 'Patient') {
          const source = entry.resource.meta?.source;
          if (source && userCenterSet.has(source)) {
            if (entry.resource.id) {
              permittedPatientIds.add(entry.resource.id);
            }
          }
        }
      }

      // Keep entries where: Patient is permitted, or non-Patient resource points to permitted patient
      const filteredEntries = bundle.entry.filter((entry) => {
        const r = entry.resource;
        if (r.resourceType === 'Patient') {
          return r.id ? permittedPatientIds.has(r.id) : false;
        }
        // Resources with subject.reference — check if it points to a permitted patient
        if (r.subject?.reference) {
          const ref = r.subject.reference;
          // reference format: "Patient/ID"
          if (ref.startsWith('Patient/')) {
            const patientId = ref.slice('Patient/'.length);
            return permittedPatientIds.has(patientId);
          }
        }
        // Resources without subject reference (Organization, etc.) — keep them
        return true;
      });

      filtered.push({ ...bundle, entry: filteredEntries });
    }
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// Case index
// ---------------------------------------------------------------------------

/**
 * Build a map from patient ID to org-ID for use in center validation.
 * For local bundles: uses Organization entry ID as center.
 * For Blaze synthetic bundles: uses Patient.meta.source as center.
 */
export function buildCaseIndex(bundles: FhirBundle[]): Map<string, string> {
  const index = new Map<string, string>();

  for (const bundle of bundles) {
    const orgId = getOrgIdFromBundle(bundle);

    for (const entry of bundle.entry) {
      if (entry.resource.resourceType === 'Patient' && entry.resource.id) {
        if (orgId !== null) {
          // Local bundle: all patients belong to this org
          index.set(entry.resource.id, orgId);
        } else {
          // Blaze synthetic bundle: use Patient.meta.source
          const source = entry.resource.meta?.source;
          if (source) {
            index.set(entry.resource.id, source);
          }
        }
      }
    }
  }

  return index;
}

/**
 * Returns the current case-to-center index.
 * Returns an empty Map if the cache has not been populated yet.
 * Used by dataApi.ts for write-time case ID validation.
 */
export function getCaseToCenter(): Map<string, string> {
  return _caseIndex ?? new Map();
}

// ---------------------------------------------------------------------------
// Settings reader
// ---------------------------------------------------------------------------

function readDataSourceConfig(): { type: string; blazeUrl: string } {
  const settingsPath = path.resolve(process.cwd(), SETTINGS_FILE);
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = yaml.load(raw) as Record<string, unknown>;
    const ds = (parsed?.dataSource ?? {}) as Record<string, unknown>;
    return {
      type: typeof ds.type === 'string' ? ds.type : 'local',
      blazeUrl: typeof ds.blazeUrl === 'string' ? ds.blazeUrl : 'http://localhost:8080/fhir',
    };
  } catch {
    return { type: 'local', blazeUrl: 'http://localhost:8080/fhir' };
  }
}

// ---------------------------------------------------------------------------
// Bundle loading
// ---------------------------------------------------------------------------

/**
 * Load FHIR bundles from server.
 * - local: reads public/data/manifest.json for file list, falls back to hardcoded names.
 * - blaze: fetches from Blaze FHIR server with pagination, assembles into synthetic bundle.
 */
async function loadBundlesFromServer(): Promise<FhirBundle[]> {
  const { type, blazeUrl } = readDataSourceConfig();

  if (type === 'blaze') {
    return loadFromBlaze(blazeUrl);
  }

  return loadFromLocalFiles();
}

async function loadFromLocalFiles(): Promise<FhirBundle[]> {
  const dataDir = path.resolve(process.cwd(), 'public', 'data');
  const manifestPath = path.join(dataDir, 'manifest.json');

  let fileList: string[] = getFallbackCenterFiles();
  try {
    if (fs.existsSync(manifestPath)) {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      fileList = JSON.parse(raw) as string[];
    }
  } catch {
    fileList = getFallbackCenterFiles();
  }

  const bundles: FhirBundle[] = [];
  for (const filename of fileList) {
    const filePath = path.resolve(process.cwd(), 'public', 'data', filename);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      bundles.push(JSON.parse(raw) as FhirBundle);
    } catch (err) {
      console.warn(`[fhir-api] Could not load ${filename}:`, (err as Error).message);
    }
  }

  return bundles;
}

async function fetchAllPages(url: string): Promise<unknown[]> {
  const resources: unknown[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const resp = await fetch(nextUrl, {
      headers: { Accept: 'application/fhir+json' },
    });
    if (!resp.ok) {
      throw new Error(`FHIR request failed: ${resp.status} ${resp.statusText} — ${nextUrl}`);
    }
    const bundle = (await resp.json()) as {
      entry?: Array<{ resource: unknown }>;
      link?: Array<{ relation: string; url: string }>;
    };

    if (bundle.entry) {
      for (const entry of bundle.entry) {
        if (entry.resource) {
          resources.push(entry.resource);
        }
      }
    }

    const nextLink = bundle.link?.find((l) => l.relation === 'next');
    nextUrl = nextLink ? nextLink.url : null;
  }

  return resources;
}

async function loadFromBlaze(blazeUrl: string): Promise<FhirBundle[]> {
  const allResources: Array<{ resource: unknown }> = [];

  for (const { type, count } of BLAZE_RESOURCE_TYPES) {
    try {
      const url = `${blazeUrl}/${type}?_count=${count}`;
      const resources = await fetchAllPages(url);
      allResources.push(...resources.map((r) => ({ resource: r })));
    } catch (err) {
      console.warn(`[fhir-api] Could not load ${type} from Blaze:`, (err as Error).message);
    }
  }

  const syntheticBundle: FhirBundle = {
    resourceType: 'Bundle',
    type: 'searchset',
    meta: {
      lastUpdated: new Date().toISOString(),
      source: blazeUrl,
    },
    entry: allResources as BundleEntry[],
  };

  return [syntheticBundle];
}

// ---------------------------------------------------------------------------
// Cache access
// ---------------------------------------------------------------------------

async function getCachedBundles(): Promise<FhirBundle[]> {
  if (_bundleCache !== null) {
    return _bundleCache;
  }
  const bundles = await loadBundlesFromServer();
  _bundleCache = bundles;
  _caseIndex = buildCaseIndex(bundles);
  return bundles;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const fhirApiRouter = Router();

/**
 * GET /api/fhir/bundles
 *
 * Returns FHIR bundles filtered by req.auth.centers.
 * Admin users and all-centers users receive all bundles (bypass).
 * Other users receive only bundles for their assigned centers.
 *
 * Requires: valid JWT (authMiddleware on /api/*)
 * Mitigates: T-05-01 (information disclosure)
 */
fhirApiRouter.get('/bundles', async (req: Request, res: Response): Promise<void> => {
  const { role, centers } = req.auth!;
  try {
    const allBundles = await getCachedBundles();
    if (isBypass(role, centers)) {
      res.json({ bundles: allBundles });
      return;
    }
    const filtered = filterBundlesByCenters(allBundles, centers);
    res.json({ bundles: filtered });
  } catch (err) {
    console.error('[fhir-api] Error loading bundles:', (err as Error).message);
    res.status(502).json({ error: 'Failed to load FHIR bundles' });
  }
});
