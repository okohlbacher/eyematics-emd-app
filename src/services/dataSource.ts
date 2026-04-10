import type { FhirBundle, FhirResource } from '../types/fhir';

export type DataSourceType = 'local' | 'blaze';

export interface DataSourceConfig {
  type: DataSourceType;
  blazeUrl?: string;
}

import { getSettings } from './settingsService';

const DEFAULT_BLAZE_URL = 'http://localhost:8080/fhir';
const DATA_DIR = '/data/';

/**
 * Rewrite absolute localhost FHIR URLs to a same-origin proxy path
 * to avoid CORS issues. The Vite dev server proxy is configured in
 * vite.config.ts (/fhir → http://localhost:PORT).
 * E.g. "http://localhost:8080/fhir" → "/fhir"
 *
 * For production deployments a reverse-proxy (e.g. nginx) should map
 * the same /fhir prefix to the actual FHIR server.
 */
function proxyUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return u.pathname + u.search;
    }
  } catch {
    // Not a valid URL — return as-is (might already be a relative path)
  }
  return url;
}

// ---------------------------------------------------------------------------
// Config – delegates to the central settings service
// ---------------------------------------------------------------------------

export function getDataSourceConfig(): DataSourceConfig {
  const s = getSettings();
  return {
    type: s.dataSource.type,
    blazeUrl: s.dataSource.blazeUrl || DEFAULT_BLAZE_URL,
  };
}

// ---------------------------------------------------------------------------
// Local file loader (mirrors original fhirLoader logic)
// ---------------------------------------------------------------------------

async function discoverLocalFiles(): Promise<string[]> {
  try {
    const resp = await fetch(DATA_DIR + 'manifest.json');
    if (resp.ok) {
      return (await resp.json()) as string[];
    }
  } catch {
    // ignore
  }
  // Fallback: probe well-known center filenames
  const candidates = [
    'center-aachen.json',
    'center-bonn.json',
    'center-muenchen.json',
    'center-tuebingen.json',
    'center-muenster.json',
  ];
  const found: string[] = [];
  for (const c of candidates) {
    try {
      const r = await fetch(DATA_DIR + c, { method: 'HEAD' });
      if (r.ok) found.push(c);
    } catch {
      // skip
    }
  }
  return found;
}

async function loadFromLocalFiles(): Promise<FhirBundle[]> {
  const files = await discoverLocalFiles();
  const bundles: FhirBundle[] = [];
  for (const file of files) {
    try {
      const resp = await fetch(DATA_DIR + file);
      if (resp.ok) {
        bundles.push((await resp.json()) as FhirBundle);
      }
    } catch {
      // skip unreadable files
    }
  }
  return bundles;
}

// ---------------------------------------------------------------------------
// Blaze / FHIR-server loader
// ---------------------------------------------------------------------------

// Resource types to fetch and their recommended page sizes
const BLAZE_RESOURCE_TYPES: ReadonlyArray<{ type: string; count: number }> = [
  { type: 'Patient', count: 500 },
  { type: 'Condition', count: 1000 },
  { type: 'Observation', count: 5000 },
  { type: 'Procedure', count: 2000 },
  { type: 'MedicationStatement', count: 1000 },
  { type: 'ImagingStudy', count: 500 },
  { type: 'Organization', count: 50 },
];

/**
 * Fetch all pages of a FHIR search result set.
 * Follows the `next` link in the Bundle until there are no more pages.
 */
async function fetchAllPages(url: string): Promise<FhirResource[]> {
  const resources: FhirResource[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const resp = await fetch(proxyUrl(nextUrl), {
      headers: { Accept: 'application/fhir+json' },
    });
    if (!resp.ok) {
      throw new Error(`FHIR request failed: ${resp.status} ${resp.statusText} — ${nextUrl}`);
    }
    const bundle = (await resp.json()) as FhirBundle & {
      link?: Array<{ relation: string; url: string }>;
    };

    if (bundle.entry) {
      for (const entry of bundle.entry) {
        if (entry.resource) {
          resources.push(entry.resource);
        }
      }
    }

    // Follow pagination
    const nextLink = bundle.link?.find((l) => l.relation === 'next');
    nextUrl = nextLink ? nextLink.url : null;
  }

  return resources;
}

/**
 * Load all relevant resources from a Blaze FHIR server and combine them into
 * a single synthetic FhirBundle so the rest of the app can process them
 * without modification.
 */
async function loadFromBlaze(blazeUrl: string): Promise<FhirBundle[]> {
  const allResources: FhirResource[] = [];

  for (const { type, count } of BLAZE_RESOURCE_TYPES) {
    try {
      const url = proxyUrl(`${blazeUrl}/${type}?_count=${count}`);
      const resources = await fetchAllPages(url);
      allResources.push(...resources);
    } catch (err) {
      // Log but continue — a missing resource type should not abort loading
      console.warn(`[dataSource] Could not load ${type} from Blaze:`, err);
    }
  }

  // Wrap everything in a single synthetic bundle
  const syntheticBundle: FhirBundle = {
    resourceType: 'Bundle',
    type: 'searchset',
    meta: {
      lastUpdated: new Date().toISOString(),
      source: blazeUrl,
    },
    entry: allResources.map((resource) => ({ resource })),
  };

  return [syntheticBundle];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function loadBundlesFromSource(
  config: DataSourceConfig
): Promise<FhirBundle[]> {
  if (config.type === 'blaze') {
    const url = config.blazeUrl ?? DEFAULT_BLAZE_URL;
    return loadFromBlaze(url);
  }
  return loadFromLocalFiles();
}

/**
 * Test connectivity to a FHIR server by fetching its capability statement.
 * Returns the server software name/version string on success, or throws.
 */
export async function testBlazeConnection(blazeUrl: string): Promise<string> {
  const url = proxyUrl(`${blazeUrl}/metadata`);
  const resp = await fetch(url, {
    headers: { Accept: 'application/fhir+json' },
  });
  if (!resp.ok) {
    throw new Error(`${resp.status} ${resp.statusText}`);
  }
  const capability = (await resp.json()) as {
    software?: { name?: string; version?: string };
    fhirVersion?: string;
  };
  const name = capability.software?.name ?? 'FHIR Server';
  const version = capability.software?.version ?? '';
  const fhir = capability.fhirVersion ? ` (FHIR ${capability.fhirVersion})` : '';
  return `${name}${version ? ' ' + version : ''}${fhir}`;
}
