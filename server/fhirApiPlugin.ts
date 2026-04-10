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

import type { Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { validateAuth, sendError } from './utils';
import { getValidCenterIds, getFallbackCenterFiles } from './constants.js';

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
              const filePath = path.join(DATA_DIR, file);
              if (fs.existsSync(filePath)) {
                allBundles.push(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
              }
            }

            // Apply center filtering (same bypass logic as server/fhirApi.ts)
            const userObj = user as { username: string; role: string; centers?: string[] };
            const { role } = userObj;
            const centers: string[] = userObj.centers ?? [];
            const validCenters = getValidCenterIds();
            const bypass = role === 'admin' || centers.filter(c => validCenters.has(c)).length >= validCenters.size;

            let resultBundles: unknown[];
            if (bypass) {
              resultBundles = allBundles;
            } else {
              // Filter: keep bundles whose Organization.resource.id is in user's centers
              resultBundles = allBundles.filter((bundle: unknown) => {
                const b = bundle as { entry?: Array<{ resource?: { resourceType?: string; id?: string } }> };
                const orgEntry = b?.entry?.find(
                  (e) => e?.resource?.resourceType === 'Organization',
                );
                if (!orgEntry) return true; // keep bundles without Organization entry
                return orgEntry.resource?.id ? centers.includes(orgEntry.resource.id) : true;
              });
            }

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
