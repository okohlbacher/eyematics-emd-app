/**
 * Express production server entry point for the EyeMatics EDM application.
 *
 * Startup sequence:
 *   1. Read settings.yaml (fail fast if missing or invalid)
 *   2. Auto-create data directory and seed users.json if absent
 *   3. Mount API handlers (issue, settings)
 *   4. Mount FHIR proxy
 *   5. Serve static files from dist/
 *   6. SPA fallback — all unmatched GET routes return dist/index.html
 *   7. Listen on configured host:port
 */

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { issueApiHandler } from './issueApi.js';
import { settingsApiHandler } from './settingsApi.js';

// ---------------------------------------------------------------------------
// 1. Read settings.yaml at startup (fail fast)
// ---------------------------------------------------------------------------

const SETTINGS_FILE = path.resolve(process.cwd(), 'public', 'settings.yaml');

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
// 2. Auto-create data directory and seed users.json if absent
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), dataDir);

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[server] Created data directory: ${DATA_DIR}`);
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(USERS_FILE)) {
  const defaultUsers = [
    { username: 'admin', firstName: 'System', lastName: 'Administrator', role: 'admin', centers: ['UKA', 'UKB', 'LMU', 'UKT', 'UKM'], createdAt: '2025-01-01T00:00:00Z' },
    { username: 'forscher1', firstName: 'Anna', lastName: 'Müller', role: 'researcher', centers: ['UKA'], createdAt: '2025-01-15T00:00:00Z' },
    { username: 'forscher2', firstName: 'Thomas', lastName: 'Weber', role: 'researcher', centers: ['UKB'], createdAt: '2025-02-01T00:00:00Z' },
    { username: 'epidemiologe', firstName: 'Julia', lastName: 'Schmidt', role: 'epidemiologist', centers: ['UKA', 'UKB', 'LMU'], createdAt: '2025-03-01T00:00:00Z' },
    { username: 'kliniker', firstName: 'Markus', lastName: 'Fischer', role: 'clinician', centers: ['UKT'], createdAt: '2025-03-15T00:00:00Z' },
    { username: 'diz_manager', firstName: 'Sabine', lastName: 'Braun', role: 'data_manager', centers: ['UKM'], createdAt: '2025-04-01T00:00:00Z' },
    { username: 'klinikleitung', firstName: 'Prof. Klaus', lastName: 'Hoffmann', role: 'clinic_lead', centers: ['UKA', 'UKB', 'LMU', 'UKT', 'UKM'], createdAt: '2025-04-15T00:00:00Z' },
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf-8');
  console.log(`[server] Seeded users.json with ${defaultUsers.length} default users`);
}

// ---------------------------------------------------------------------------
// 3. Derive FHIR proxy target (host only — no path)
// ---------------------------------------------------------------------------

function deriveBlazeTarget(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}`;
}

const blazeTarget = deriveBlazeTarget(blazeUrl);

// ---------------------------------------------------------------------------
// 4. Create Express app and mount routes in correct order
// ---------------------------------------------------------------------------

const app = express();

// API handlers FIRST (before static/fallback)
app.use(issueApiHandler);
app.use(settingsApiHandler);

// FHIR proxy SECOND
app.use('/fhir', createProxyMiddleware({
  target: blazeTarget,
  changeOrigin: true,
  on: {
    error: (err, _req, res) => {
      console.error('[fhir-proxy] Error:', (err as Error).message);
      if (res && 'writeHead' in res) {
        (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' });
        (res as import('http').ServerResponse).end(JSON.stringify({ error: 'FHIR proxy error' }));
      }
    },
  },
}));

// Static file serving THIRD (built Vite output)
app.use(express.static(path.resolve(process.cwd(), 'dist')));

// SPA fallback LAST — all unmatched GET routes return index.html
// Express 5 uses path-to-regexp v8+ which requires named parameters; use /{*path} instead of bare *
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
});

// ---------------------------------------------------------------------------
// 5. Start server
// ---------------------------------------------------------------------------

app.listen(PORT, HOST, () => {
  console.log(`[server] EMD app running at http://${HOST}:${PORT}`);
  console.log(`[server] FHIR proxy target: ${blazeTarget}`);
  console.log(`[server] Data directory: ${DATA_DIR}`);
});
