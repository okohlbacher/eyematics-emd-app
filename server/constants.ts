/**
 * Shared constants used across server modules.
 * Single source of truth — no more duplicated center lists.
 *
 * Centers are loaded from data/centers.json (configurable per deployment).
 * All other modules import from here instead of hardcoding center IDs.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Center configuration (loaded from data/centers.json)
// ---------------------------------------------------------------------------

export interface CenterConfig {
  id: string;
  shorthand: string;
  name: string;
  file: string;
}

let _centers: CenterConfig[] | null = null;

/**
 * Initialize center configuration from data/centers.json.
 * Must be called once at startup (after data dir is resolved).
 * Falls back to built-in defaults if the file is missing.
 */
export function initCenters(dataDir: string): void {
  const centersPath = path.join(dataDir, 'centers.json');
  try {
    if (fs.existsSync(centersPath)) {
      const raw = fs.readFileSync(centersPath, 'utf-8');
      const parsed = JSON.parse(raw) as CenterConfig[];
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(c => c.id && c.shorthand)) {
        _centers = parsed;
        console.log(`[server] Loaded ${_centers.length} centers from ${centersPath}`);
        return;
      }
    }
  } catch (err) {
    console.warn(`[server] Failed to load centers.json, using defaults:`, (err as Error).message);
  }
  // Fallback: seed the file with defaults
  _centers = DEFAULT_CENTERS;
  try {
    fs.writeFileSync(centersPath, JSON.stringify(DEFAULT_CENTERS, null, 2), 'utf-8');
    console.log(`[server] Seeded ${centersPath} with ${DEFAULT_CENTERS.length} default centers`);
  } catch {
    console.warn(`[server] Could not write default centers.json`);
  }
}

const DEFAULT_CENTERS: CenterConfig[] = [
  { id: 'org-uka',  shorthand: 'UKA',  name: 'Universitätsklinikum Aachen',     file: 'center-aachen.json' },
  { id: 'org-ukc',  shorthand: 'UKC',  name: 'Universitätsklinikum Chemnitz',   file: 'center-chemnitz.json' },
  { id: 'org-ukd',  shorthand: 'UKD',  name: 'Universitätsklinikum Dresden',    file: 'center-dresden.json' },
  { id: 'org-ukg',  shorthand: 'UKG',  name: 'Universitätsklinikum Greifswald', file: 'center-greifswald.json' },
  { id: 'org-ukl',  shorthand: 'UKL',  name: 'Universitätsklinikum Leipzig',    file: 'center-leipzig.json' },
  { id: 'org-ukmz', shorthand: 'UKMZ', name: 'Universitätsmedizin Mainz',       file: 'center-mainz.json' },
  { id: 'org-ukt',  shorthand: 'UKT',  name: 'Universitätsklinikum Tübingen',   file: 'center-tuebingen.json' },
];

/** Get all loaded center configs. */
export function getCenters(): CenterConfig[] {
  return _centers ?? DEFAULT_CENTERS;
}

/** Get valid center IDs as a Set (for membership checks). */
export function getValidCenterIds(): Set<string> {
  return new Set(getCenters().map(c => c.id));
}

/** Get center shorthand map: org-id → shorthand (e.g., 'org-uka' → 'UKA'). */
export function getCenterShorthands(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of getCenters()) {
    map[c.id] = c.shorthand;
  }
  return map;
}

/** Get fallback FHIR bundle filenames from center configs. */
export function getFallbackCenterFiles(): string[] {
  return getCenters().map(c => c.file);
}

// ---------------------------------------------------------------------------
// Non-center constants
// ---------------------------------------------------------------------------

/** Resource types to fetch from Blaze FHIR server with recommended page sizes. */
export const BLAZE_RESOURCE_TYPES: ReadonlyArray<{ type: string; count: number }> = [
  { type: 'Patient', count: 500 },
  { type: 'Condition', count: 1000 },
  { type: 'Observation', count: 5000 },
  { type: 'Procedure', count: 2000 },
  { type: 'MedicationStatement', count: 1000 },
  { type: 'ImagingStudy', count: 500 },
  { type: 'Organization', count: 50 },
];

/** Path to settings.yaml (outside webroot for security). F-25: single resolved path. */
export const SETTINGS_FILE = path.resolve(process.cwd(), 'config', 'settings.yaml');
