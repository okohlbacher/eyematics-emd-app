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

import fs from 'node:fs';
import path from 'node:path';

import type { Request, Response } from 'express';
import { Router } from 'express';
import yaml from 'js-yaml';

import type {} from './authMiddleware.js'; // triggers Request.auth augmentation
import { BLAZE_RESOURCE_TYPES, getCenters, getFallbackCenterFiles, getValidCenterIds, SETTINGS_FILE } from './constants.js';

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

export interface FhirBundle {
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
 * Non-admin users with all configured centers also bypass (D-13, D-14).
 */
export function isBypass(role: string, centers: string[]): boolean {
  if (role === 'admin') return true;
  const valid = getValidCenterIds();
  if (valid.size === 0) return false;
  for (const id of valid) {
    if (!centers.includes(id)) return false;
  }
  return true;
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
  try {
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
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
  const fhirDataDir = path.resolve(process.cwd(), 'public', 'data');
  const manifestPath = path.join(fhirDataDir, 'manifest.json');

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
    const filePath = path.resolve(fhirDataDir, filename);
    // F-12: Prevent path traversal via crafted manifest entries
    if (!filePath.startsWith(fhirDataDir + path.sep) && filePath !== fhirDataDir) {
      console.warn(`[fhir-api] Skipping path-traversal attempt: ${filename}`);
      continue;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      bundles.push(JSON.parse(raw) as FhirBundle);
    } catch (err) {
      console.warn(`[fhir-api] Could not load ${filename}:`, (err as Error).message);
    }
  }

  return bundles;
}

// F-26: safety limits to prevent unbounded pagination from misconfigured FHIR servers
const MAX_PAGES = 100;
const PAGE_TIMEOUT_MS = 30_000;

async function fetchAllPages(url: string): Promise<unknown[]> {
  // SSRF guard: only follow pagination links that share the initial URL's origin
  const allowedOrigin = new URL(url).origin;

  const resources: unknown[] = [];
  let nextUrl: string | null = url;
  let pageCount = 0;

  while (nextUrl) {
    if (++pageCount > MAX_PAGES) {
      console.warn(`[fhir-api] fetchAllPages: reached max ${MAX_PAGES} pages, stopping`);
      break;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    try {
      const resp = await fetch(nextUrl, {
        headers: { Accept: 'application/fhir+json' },
        signal: controller.signal,
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
      if (nextLink) {
        try {
          const nextOrigin = new URL(nextLink.url).origin;
          nextUrl = nextOrigin === allowedOrigin ? nextLink.url : null;
          if (!nextUrl) {
            console.warn(`[fhir-api] Blocked pagination link to foreign origin: ${nextOrigin}`);
          }
        } catch {
          nextUrl = null; // malformed URL
        }
      } else {
        nextUrl = null;
      }
    } finally {
      clearTimeout(timeout);
    }
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

/**
 * GET /api/fhir/centers
 *
 * Returns the configured center list with id, shorthand, and name.
 * Used by the frontend to avoid hardcoded center mappings (M-03).
 */
/**
 * GET /api/fhir/images/:filename
 *
 * Serves OCT images from public/data/oct/ through an authenticated route.
 * Prevents unauthenticated access to clinical images (H-07).
 * Path traversal mitigated by stripping directory separators from filename.
 */
fhirApiRouter.get('/images/:filename', (req: Request, res: Response): void => {
  const filename = String(req.params.filename ?? '').replace(/[/\\]/g, '');
  if (!filename) {
    res.status(400).json({ error: 'Filename required' });
    return;
  }
  const filePath = path.resolve(process.cwd(), 'public', 'data', 'oct', filename);
  // Ensure resolved path stays within the oct directory
  const octDir = path.resolve(process.cwd(), 'public', 'data', 'oct');
  if (!filePath.startsWith(octDir)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  res.sendFile(filePath);
});

fhirApiRouter.get('/centers', (_req: Request, res: Response): void => {
  const centers = getCenters().map((c) => ({
    id: c.id,
    shorthand: c.shorthand,
    name: c.name,
  }));
  res.json({ centers });
});
