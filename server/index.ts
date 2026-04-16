/**
 * Express production server entry point for the EyeMatics EDM application.
 *
 * Startup sequence:
 *   1. Read settings.yaml (fail fast if missing or invalid)
 *   2. Auto-create data directory
 *   3. initAuth() — load/generate JWT secret, migrate users.json
 *   4. initAuditDb() — open/create SQLite audit database
 *   5. startPurgeInterval() — run initial purge + daily interval
 *   6. Create Express app and mount middleware in correct order:
 *      a. express.json() on /api/auth/* routes (authApiRouter needs it)
 *      b. auditMiddleware — logs all /api/* requests (before auth, captures 401s)
 *      c. authMiddleware — validates JWT on /api/* (except public auth paths)
 *      d. authApiRouter — /api/auth/login, /api/auth/verify, /api/auth/config
 *      e. issueApiHandler — /api/issues (raw Node handler, auth guaranteed)
 *      f. settingsApiHandler — /api/settings (raw Node handler, auth guaranteed)
 *      g. auditApiRouter — /api/audit, /api/audit/export
 *      h. FHIR proxy — /api/fhir-proxy
 *      i. Static files — dist/
 *      j. SPA fallback — all unmatched GET routes
 *   7. Listen on configured host:port
 */

import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import path from 'node:path';

import compression from 'compression';
import type { NextFunction,Request, Response } from 'express';
import express from 'express';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import yaml from 'js-yaml';

import { auditApiRouter } from './auditApi.js';
import { initAuditDb, startPurgeInterval } from './auditDb.js';
import { auditMiddleware } from './auditMiddleware.js';
import { authApiRouter } from './authApi.js';
import { authMiddleware } from './authMiddleware.js';
import { initCenters, SETTINGS_FILE } from './constants.js';
import { dataApiRouter } from './dataApi.js';
import { initDataDb } from './dataDb.js';
import { fhirApiRouter } from './fhirApi.js';
import { initHashCohortId } from './hashCohortId.js';
import { initAuth } from './initAuth.js';
import { issueApiRouter } from './issueApi.js';
import { outcomesAggregateRouter } from './outcomesAggregateApi.js';
import { initOutcomesAggregateCache } from './outcomesAggregateCache.js';
import { settingsApiRouter } from './settingsApi.js';

// ---------------------------------------------------------------------------
// 1. Read settings.yaml at startup (fail fast)
// ---------------------------------------------------------------------------

if (!fs.existsSync(SETTINGS_FILE)) {
  console.error(`[server] FATAL: settings.yaml not found at ${SETTINGS_FILE}`);
  process.exit(1);
}

let settings: Record<string, unknown>;
try {
  const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
  const parsed = yaml.load(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('settings.yaml must be a YAML object');
  }
  settings = parsed as Record<string, unknown>;
} catch (err) {
  console.error('[server] FATAL: Failed to parse settings.yaml:', err);
  process.exit(1);
}

const serverSection = (settings.server ?? {}) as Record<string, unknown>;
const PORT: number = typeof serverSection.port === 'number' ? serverSection.port : 3000;
const HOST: string = typeof serverSection.host === 'string' ? serverSection.host : '0.0.0.0';
const dataDir: string = typeof serverSection.dataDir === 'string' ? serverSection.dataDir : './data';

const dataSource = (settings.dataSource ?? {}) as Record<string, unknown>;
const blazeUrl: string =
  typeof dataSource.blazeUrl === 'string' ? dataSource.blazeUrl : 'http://localhost:8080/fhir';

// ---------------------------------------------------------------------------
// 2. Auto-create data directory
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), dataDir);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[server] Created data directory: ${DATA_DIR}`);
}

// ---------------------------------------------------------------------------
// 3. initAuth — load/generate JWT secret, migrate users.json
//    Seed a default users.json if absent, so initAuth has users to migrate.
//    initAuth() then adds bcrypt passwordHash for any user missing one.
// ---------------------------------------------------------------------------

const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(USERS_FILE)) {
  const defaultUsers = [
    { username: 'admin',         firstName: 'System',     lastName: 'Administrator',  role: 'admin',         centers: ['org-uka', 'org-ukc', 'org-ukd', 'org-ukg', 'org-ukl', 'org-ukmz', 'org-ukt'], createdAt: '2025-01-01T00:00:00Z' },
    { username: 'forscher1',     firstName: 'Anna',       lastName: 'Müller',         role: 'researcher',    centers: ['org-uka'],   createdAt: '2025-01-15T00:00:00Z' },
    { username: 'forscher2',     firstName: 'Thomas',     lastName: 'Weber',          role: 'researcher',    centers: ['org-ukc'],   createdAt: '2025-02-01T00:00:00Z' },
    { username: 'epidemiologe',  firstName: 'Julia',      lastName: 'Schmidt',        role: 'epidemiologist',centers: ['org-uka', 'org-ukc', 'org-ukd'], createdAt: '2025-03-01T00:00:00Z' },
    { username: 'kliniker',      firstName: 'Markus',     lastName: 'Fischer',        role: 'clinician',     centers: ['org-ukt'],   createdAt: '2025-03-15T00:00:00Z' },
    { username: 'diz_manager',   firstName: 'Sabine',     lastName: 'Braun',          role: 'data_manager',  centers: ['org-ukmz'],  createdAt: '2025-04-01T00:00:00Z' },
    { username: 'klinikleitung', firstName: 'Prof. Klaus',lastName: 'Hoffmann',       role: 'clinic_lead',   centers: ['org-uka', 'org-ukc', 'org-ukd', 'org-ukg', 'org-ukl', 'org-ukmz', 'org-ukt'], createdAt: '2025-04-15T00:00:00Z' },
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf-8');
  console.log(`[server] Seeded users.json with ${defaultUsers.length} default users`);
}

// initCenters: load center configuration from data/centers.json
initCenters(DATA_DIR);

// initAuth: loads/generates JWT secret, migrates users.json to add bcrypt hashes
initAuth(DATA_DIR, settings);

// Phase 11 / D-05 / D-06 — initialize cohort-id hash secret (fail-fast if missing)
initHashCohortId(settings);

// Phase 12 — load aggregate cache TTL from outcomes section (defaults to 30 min)
initOutcomesAggregateCache(settings);

// ---------------------------------------------------------------------------
// 4. initAuditDb — open/create SQLite audit database
// ---------------------------------------------------------------------------

const auditSection = (settings.audit ?? {}) as Record<string, unknown>;
const retentionDays = typeof auditSection.retentionDays === 'number' ? auditSection.retentionDays : 90;

initAuditDb(DATA_DIR, retentionDays);
initDataDb(DATA_DIR);

// ---------------------------------------------------------------------------
// 5. startPurgeInterval — run initial purge + daily interval
// ---------------------------------------------------------------------------

startPurgeInterval();

// ---------------------------------------------------------------------------
// 6. Derive FHIR proxy target (host only — no path)
// ---------------------------------------------------------------------------

function deriveBlazeTarget(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

const blazeTarget = deriveBlazeTarget(blazeUrl);

// ---------------------------------------------------------------------------
// 7. Create Express app and mount middleware in correct order
// ---------------------------------------------------------------------------

const app = express();

// F-29: dynamically add Keycloak issuer to connectSrc when provider=keycloak
const connectSrc: string[] = ["'self'"];
const keycloakSection = (settings.keycloak ?? {}) as Record<string, unknown>;
if (settings.provider === 'keycloak' && typeof keycloakSection.issuer === 'string') {
  try {
    const issuerOrigin = new URL(keycloakSection.issuer as string).origin;
    connectSrc.push(issuerOrigin);
  } catch { /* invalid URL — skip */ }
}

// Security headers (HSTS, CSP, X-Frame-Options, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc,
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // allow loading FHIR data
}));

// Body parsers — MUST be before auditMiddleware so req.body is populated for body capture
// express.json() is scoped (NOT global) — issueApiHandler and settingsApiHandler use readBody()
// on the raw stream and a global express.json() would consume the stream before them.
app.use('/api/auth', express.json({ limit: '1mb' }));
app.use('/api/data', express.json({ limit: '1mb' })); // before auditMiddleware (review concern #9)

// Body parser scoped to the Phase 11 view-open beacon — MUST be before auditMiddleware
// so req.body is populated when the handler runs. 16 KiB cap is a cheap DoS guard for
// ad-hoc filter payloads.
app.use('/api/audit/events/view-open', express.json({ limit: '16kb' }));

// Phase 12 / D-15 / D-17 — Body parser + compression for aggregate route.
// BEFORE auditMiddleware so req.body is populated (even though the middleware
// skip-list short-circuits — defense in depth; see server/auditMiddleware.ts SKIP_AUDIT_PATHS).
// Limit '16kb' matches Phase 11 precedent on /api/audit/events/view-open (CONTEXT §Established Patterns).
app.use('/api/outcomes/aggregate', express.json({ limit: '16kb' }));
app.use('/api/outcomes/aggregate', compression());

// auditMiddleware BEFORE authMiddleware — captures 401 responses with user='anonymous'
// (req.auth is read at res.finish time, so it resolves correctly for both 200 and 401)
app.use('/api', auditMiddleware);

// authMiddleware validates JWT on /api/* except public auth paths
app.use('/api', authMiddleware);

// Auth routes — login, verify, config (express.json already mounted above)
app.use('/api/auth', authApiRouter);

// Issue and settings routers (H-01: refactored from raw handlers to Express Router)
app.use('/api/issues', express.json({ limit: '10mb' }), issueApiRouter);
app.use('/api/settings', express.text({ limit: '1mb', type: '*/*' }), settingsApiRouter);

// Audit query routes — /api/audit and /api/audit/export (admin-only export)
app.use('/api/audit', auditApiRouter);

// Phase 12 / AGG-01 — server-side cohort aggregation
app.use('/api/outcomes', outcomesAggregateRouter);

// Data persistence routes — per-user quality flags, saved searches, excluded/reviewed cases
// Mounted AFTER authMiddleware so all /api/data/* routes require authentication (DATA-05)
app.use('/api/data', dataApiRouter);

// FHIR API routes — center-filtered bundle loading (CENTER-01, CENTER-02)
// Mounted with express.json() for consistency; GET /bundles does not use body but pattern is future-proof
app.use('/api/fhir', express.json({ limit: '1mb' }), fhirApiRouter);

// Block unauthenticated access to FHIR data files served via express.static
// The files live in public/data/ for Vite dev convenience, but must not be
// served without auth in production. Use /api/fhir/bundles instead.
app.use('/data', (_req: Request, res: Response) => {
  res.status(403).json({ error: 'Use /api/fhir/bundles for authenticated FHIR data access' });
});

// FHIR proxy — admin-only (H-06: prevents center-bypass via direct Blaze queries)
// Non-admin users must use /api/fhir/bundles which enforces center filtering.
app.use('/api/fhir-proxy', (req: Request, res: Response, next: NextFunction) => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'FHIR proxy access restricted to administrators' });
    return;
  }
  next();
}, createProxyMiddleware({
  target: blazeTarget,
  changeOrigin: true,
  on: {
    error: (err: Error, _req: IncomingMessage, res: ServerResponse | Socket) => {
      console.error('[fhir-proxy] Error:', err.message);
      if (res && 'writeHead' in res) {
        (res as ServerResponse).writeHead(502, { 'Content-Type': 'application/json' });
        (res as ServerResponse).end(JSON.stringify({ error: 'FHIR proxy error' }));
      }
    },
  },
}));

// L-10: JSON 404 for unmatched /api/* routes (before SPA fallback)
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Static file serving (built Vite output)
app.use(express.static(path.resolve(process.cwd(), 'dist')));

// SPA fallback — all unmatched GET routes return index.html
// Express 5 uses path-to-regexp v8+ which requires named parameters
app.get('/{*path}', (_req: Request, res: Response) => {
  res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
});

// ---------------------------------------------------------------------------
// 8. Start server
// ---------------------------------------------------------------------------

app.listen(PORT, HOST, () => {
  console.log(`[server] EMD app running at http://${HOST}:${PORT}`);
  console.log(`[server] FHIR proxy target: ${blazeTarget} (at /api/fhir-proxy)`);
  console.log(`[server] Data directory: ${DATA_DIR}`);
});
