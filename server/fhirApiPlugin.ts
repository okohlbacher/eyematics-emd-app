/**
 * Vite dev server plugin for /api/fhir/* routes.
 *
 * Provides /api/fhir/bundles in Vite dev mode with the same center-based
 * access control as the production server/fhirApi.ts, but reads from local
 * public/data/ files only (no Blaze support needed for dev mode).
 *
 * This plugin is necessary because Vite dev mode does not run server/index.ts.
 * Without it, /api/fhir/bundles would 404 during `npm run dev`.
 *
 * Follows the exact pattern from issueApiPlugin and settingsApiPlugin.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { Plugin } from 'vite';

import { getFallbackCenterFiles,getValidCenterIds } from './constants.js';
import type { FhirBundle } from './fhirApi.js';
import { filterBundlesByCenters } from './fhirApi.js';
import { sendError,validateAuth } from './utils.js';

export function fhirApiPlugin(): Plugin {
  return {
    name: 'fhir-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // GET /api/fhir/bundles — return center-filtered FHIR bundles
        if (req.method === 'GET' && req.url === '/api/fhir/bundles') {
          const user = validateAuth(req);
          if (!user) {
            sendError(res, 401, 'Authentication required');
            return;
          }

          try {
            // Load bundles from public/data/ (local mode only in dev)
            const DATA_DIR = path.resolve(process.cwd(), 'public', 'data');
            const manifestPath = path.join(DATA_DIR, 'manifest.json');
            const files = fs.existsSync(manifestPath)
              ? (JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as string[])
              : getFallbackCenterFiles().filter((f) => fs.existsSync(path.join(DATA_DIR, f)));

            const allBundles: unknown[] = [];
            for (const file of files) {
              const filePath = path.resolve(DATA_DIR, file);
              // F-04: Prevent path traversal via crafted manifest entries (mirrors fhirApi.ts)
              if (!filePath.startsWith(DATA_DIR + path.sep) && filePath !== DATA_DIR) {
                console.warn(`[fhir-api-plugin] Skipping path-traversal attempt: ${file}`);
                continue;
              }
              if (fs.existsSync(filePath)) {
                allBundles.push(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
              }
            }

            // F-15: use shared filtering logic from fhirApi.ts (single source of truth)
            const userObj = user as { username: string; role: string; centers?: string[] };
            const { role } = userObj;
            const centers: string[] = userObj.centers ?? [];
            const validCenters = getValidCenterIds();
            const bypass = role === 'admin' || centers.filter(c => validCenters.has(c)).length >= validCenters.size;

            const resultBundles = bypass
              ? allBundles
              : filterBundlesByCenters(allBundles as FhirBundle[], centers);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ bundles: resultBundles }));
          } catch (err) {
            sendError(res, 502, 'Failed to load FHIR bundles', err);
          }
          return;
        }

        next();
      });
    },
  };
}
