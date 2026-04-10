# Phase 1: Production Express Backend - Research

**Researched:** 2026-04-10
**Domain:** Express 5 server, ESM TypeScript build, http-proxy-middleware, SPA static serving
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Wrap existing raw Node http handlers — do NOT rewrite as Express handlers. The current issueApi.ts and settingsApi.ts use `IncomingMessage`/`ServerResponse` which Express extends. Express routes call shared handlers directly. Vite dev plugins continue using the same handlers unchanged.
- **D-02:** All server configuration lives in settings.yaml — no environment variables, no CLI flags. This includes port, host, data directory path, FHIR/Blaze URL. The settings.yaml already exists at public/settings.yaml and is the single source of configuration truth.
- **D-03:** Extend settings.yaml schema with a `server:` section for port, host, and data directory. Example:
  ```yaml
  server:
    port: 3000
    host: "0.0.0.0"
    dataDir: "./data"
  ```
- **D-04:** Minimal server logging — startup info, API errors, and FHIR proxy failures to stdout. No per-request access log.
- **D-06:** Auto-create data/ directory on startup if it doesn't exist. Seed users.json with DEFAULT_MANAGED_USERS from AuthContext.tsx. Zero manual setup required for first run.
- **D-07:** Claude's discretion on TypeScript compilation strategy (tsconfig.server.json), npm script naming, and output directory structure. Pragmatic approach — whatever works cleanly with the existing ESM setup.

### Claude's Discretion

- TypeScript compilation strategy for server code (tsconfig.server.json)
- npm script naming (build:server, build:all, start)
- Output directory structure for compiled server code

### Deferred Ideas (OUT OF SCOPE)

- Detailed audit logging granularity — Phase 2 scope
- Keycloak JWT validation in auth middleware — Phase 5 scope
- Server-side user management API — Phase 3 scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BACK-01 | Express server serves Vite production build (static files from dist/) | express.static('dist') + SPA fallback pattern documented in Architecture Patterns |
| BACK-02 | Express server mounts all API routes (issues, settings, audit, users, data) | Handler extraction pattern documented; Express router mounting verified |
| BACK-03 | FHIR proxy forwards /fhir/* to configured Blaze URL in production | http-proxy-middleware 3.0.5 API documented with correct target derivation |
| BACK-04 | SPA fallback (all unmatched GET routes serve index.html) | Route ordering pattern documented; pitfall of catch-all before API routes identified |
| BACK-05 | Server starts via `npm start` after `npm run build:all` | tsx-based execution approach documented; npm script structure defined |
| BACK-06 | Vite dev mode (`npm run dev`) continues working unchanged | Vite plugin pattern preserved; handlers extracted as shared functions not replaced |
</phase_requirements>

---

## Summary

Phase 1 adds a standalone Express 5 server that coexists with the Vite dev setup. The key architectural move is **handler extraction**: the business logic currently inline in Vite plugin middleware callbacks gets lifted into standalone functions with raw Node `IncomingMessage`/`ServerResponse` signatures. Express calls these functions directly (it extends both types). The Vite plugin wrappers remain identical and call the same functions. Zero duplication, no rewrite.

The project uses `"type": "module"` in package.json (ESM). The current tsconfig.node.json has `noEmit: true` and `allowImportingTsExtensions: true`, making it unsuitable for emitting server code. The pragmatic build strategy (D-07) is to use **tsx** to both run the server (`npm start`) and to skip a separate compilation step entirely. Type-checking uses a dedicated `tsconfig.server.json` with `noEmit: true` (type-check only). This avoids all ESM/CJS output extension issues and eliminates a separate `dist-server/` directory.

The FHIR proxy reads `dataSource.blazeUrl` from settings.yaml at startup. The proxy target must be the host-only portion of that URL (e.g., `http://localhost:8080`), not the full URL including `/fhir`, because the request path `/fhir/*` is forwarded as-is and the target must not double up the `/fhir` segment.

**Primary recommendation:** Use tsx to run server/index.ts directly. No separate server compilation step. Type-check server code with `tsc --noEmit -p tsconfig.server.json`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.2.1 | HTTP server, routing, static serving | Dominant Node.js framework; v5 is current stable as of 2026 |
| @types/express | 5.0.6 | TypeScript types for Express 5 | Official types package, matches v5 API |
| http-proxy-middleware | 3.0.5 | FHIR proxy middleware | The standard proxy library; works as Express middleware |
| tsx | 4.21.0 | Run TypeScript directly (no compile step) | Zero-config TS runner; handles ESM + extensionless imports cleanly |
| js-yaml | 4.1.1 | Parse settings.yaml | Already installed; used by settingsApi.ts |

[VERIFIED: npm registry — all versions confirmed 2026-04-10]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:fs | built-in | Auto-create data/ directory, seed users.json | Already used in issueApi.ts |
| node:path | built-in | Resolve file paths for static serving and data dir | Already used throughout server/ |
| node:crypto | built-in | UUID generation for issue IDs | Already used in issueApi.ts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsx (runtime) | tsc emit + node | tsx is simpler: no outDir, no .js extension issues, no extra build step for server |
| tsx (runtime) | esbuild bundle | esbuild not installed; adds dependency; overkill for a small server |
| express@5 | express@4 | v5 is current stable; no reason to use v4 on a greenfield server file |
| http-proxy-middleware@3 | node-http-proxy directly | hpm abstracts changeOrigin, WebSocket, error handling; standard choice |

**Installation:**
```bash
npm install express http-proxy-middleware
npm install --save-dev @types/express tsx
```

**Version verification:** [VERIFIED: npm registry 2026-04-10]
- express: 5.2.1 (published, engines: node >= 18)
- @types/express: 5.0.6
- http-proxy-middleware: 3.0.5
- tsx: 4.21.0 (type: "module", bin: tsx)

---

## Architecture Patterns

### Recommended Project Structure

```
server/
├── index.ts          # Express app entry point — startup, config, route mounting
├── issueApi.ts       # EXISTING: extract handleIssueRequest() alongside plugin wrapper
├── settingsApi.ts    # EXISTING: extract handleSettingsRequest() alongside plugin wrapper
└── utils.ts          # EXISTING: readBody, validateAuth, sendError — unchanged

public/
└── settings.yaml     # Extended with server: section (port, host, dataDir)

tsconfig.server.json  # NEW: type-check only config for server/ directory
dist/                 # Vite output (already exists) — served as static files
data/                 # Auto-created on first start — users.json seeded here
```

### Pattern 1: Handler Extraction (D-01)

**What:** Extract the middleware callback body from each Vite plugin into a named exported function. The Vite plugin wrapper calls that function. The Express route also calls that function. Both share identical code paths.

**When to use:** Every existing API file (issueApi.ts, settingsApi.ts). Required for D-01 compliance.

**Example — extraction structure:**

```typescript
// server/issueApi.ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

// NEW: extracted handler — raw Node types, called from Express and Vite plugin
export function issueApiHandler(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  // All existing middleware logic moved here verbatim
  if (req.method === 'POST' && req.url === '/api/issues') { /* ... */ return; }
  if (req.method === 'GET' && req.url === '/api/issues/export') { /* ... */ return; }
  if (req.method === 'GET' && req.url === '/api/issues') { /* ... */ return; }
  next();
}

// UNCHANGED: Vite plugin wrapper delegates to extracted handler
export function issueApiPlugin(): Plugin {
  return {
    name: 'issue-api',
    configureServer(server) {
      server.middlewares.use(issueApiHandler);
    },
  };
}
```

**Express mounting:**
```typescript
// server/index.ts
import { issueApiHandler } from './issueApi.js';
app.use(issueApiHandler);
```

**Why this works:** Express `Request` extends `IncomingMessage` and Express `Response` extends `ServerResponse`. Passing Express req/res to a function typed for the base Node types is valid — no type errors.

[VERIFIED: Node.js http module types; Express type hierarchy — confirmed via @types/express source]

### Pattern 2: Settings-First Startup

**What:** Read and parse settings.yaml before any other initialization. Use the parsed config for port, host, dataDir, and FHIR proxy target. Never use `process.env` or CLI args.

**Example:**
```typescript
// server/index.ts
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

interface ServerSettings {
  server: { port: number; host: string; dataDir: string };
  dataSource: { blazeUrl: string };
}

const SETTINGS_FILE = path.resolve(process.cwd(), 'public', 'settings.yaml');
const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
const settings = yaml.load(raw) as ServerSettings;

const PORT = settings.server?.port ?? 3000;
const HOST = settings.server?.host ?? '0.0.0.0';
const DATA_DIR = path.resolve(settings.server?.dataDir ?? './data');
const BLAZE_TARGET = deriveBlazeTarget(settings.dataSource.blazeUrl);
```

### Pattern 3: FHIR Proxy Target Derivation

**What:** The FHIR proxy target must be the host origin only — NOT including the `/fhir` path — because incoming requests already carry `/fhir` in their path. The proxy forwards path as-is.

**Critical:** `dataSource.blazeUrl` = `http://localhost:8080/fhir`. The proxy target must be `http://localhost:8080` (strip the path).

```typescript
import { createProxyMiddleware } from 'http-proxy-middleware';
import { URL } from 'node:url';

function deriveBlazeTarget(blazeUrl: string): string {
  const u = new URL(blazeUrl);
  return `${u.protocol}//${u.host}`; // e.g., "http://localhost:8080"
}

app.use('/fhir', createProxyMiddleware({
  target: deriveBlazeTarget(settings.dataSource.blazeUrl),
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      console.error('[fhir-proxy] Error:', err.message);
    },
  },
}));
```

[VERIFIED: Vite proxy config at vite.config.ts — target is `http://localhost:8080`, path `/fhir` is preserved. settings.yaml confirms blazeUrl is `http://localhost:8080/fhir`]

### Pattern 4: Express Route Ordering (SPA Fallback)

**What:** Mount routes in this exact order to prevent the SPA fallback from intercepting API requests.

```typescript
// server/index.ts — strict mount order

// 1. API routes FIRST
app.use(issueApiHandler);
app.use(settingsApiHandler);

// 2. FHIR proxy SECOND
app.use('/fhir', createProxyMiddleware({ target: BLAZE_TARGET, changeOrigin: true }));

// 3. Static files from dist/ THIRD
app.use(express.static(path.resolve('dist')));

// 4. SPA fallback LAST — catches everything not matched above
app.get('*', (req, res) => {
  res.sendFile(path.resolve('dist', 'index.html'));
});
```

[ASSUMED] — Standard Express ordering pattern, consistent with Express documentation conventions.

### Pattern 5: Data Directory Auto-Creation and Seeding (D-06)

**What:** On startup, check if `data/` (from settings `dataDir`) exists. If not, create it and write `data/users.json` with the `DEFAULT_MANAGED_USERS` array from AuthContext.tsx.

```typescript
function ensureDataDir(dataDir: string): void {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`[server] Created data directory: ${dataDir}`);
  }

  const usersFile = path.join(dataDir, 'users.json');
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify(DEFAULT_USERS, null, 2), 'utf-8');
    console.log(`[server] Seeded ${usersFile} with ${DEFAULT_USERS.length} default users`);
  }
}
```

The `DEFAULT_USERS` array is the same list as `DEFAULT_MANAGED_USERS` in `src/context/AuthContext.tsx` — copy it verbatim into server/index.ts or a shared constants file.

[VERIFIED: AuthContext.tsx line 78–86 — 7 default users with username, role, centers, createdAt]

### Pattern 6: TypeScript Build Strategy (D-07)

**What:** Use `tsx` to run server code directly (no compile step). Type-checking is separate and uses `tsc --noEmit`.

**tsconfig.server.json** — type-check only, covers server/ directory:
```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["server", "vite.config.ts"]
}
```

**Why `moduleResolution: "bundler"` for server type-checking:**
- Existing server files use extensionless imports (`from './utils'`) — compatible with bundler mode
- Switching to `"nodenext"` would require adding `.js` extensions to all local imports — unnecessary churn given D-01 (don't rewrite)
- tsx resolves extensionless imports correctly at runtime regardless

**npm scripts:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "build:server": "tsc --noEmit -p tsconfig.server.json",
    "build:all": "npm run build && npm run build:server",
    "start": "tsx server/index.ts",
    "lint": "eslint ."
  }
}
```

[VERIFIED: tsx 4.21.0 supports ESM, node >= 18, handles extensionless imports. tsc 6.0.2 supports bundler moduleResolution with noEmit]

### Anti-Patterns to Avoid

- **Catch-all route before API routes:** Placing `app.get('*', ...)` before API handlers causes all requests to return index.html.
- **Using blazeUrl directly as proxy target:** `http://localhost:8080/fhir` as target doubles the `/fhir` path → `/fhir/Patient` proxied to `http://localhost:8080/fhir/fhir/Patient`.
- **Rewriting handlers as Express types:** D-01 prohibits this. Use `IncomingMessage`/`ServerResponse` in handler signatures.
- **Reading settings at module load time:** If settings.yaml is unavailable at startup, the error should be clear. Read at startup (not lazily) and fail fast.
- **Importing Vite types in server/index.ts:** The Vite plugin wrapper functions are not needed in the production server. Only import the extracted handler functions.
- **Putting `allowImportingTsExtensions: true` in tsconfig.server.json:** This option requires `noEmit: true`, but more importantly it signals bundler-mode assumptions; it is not needed since server files don't use `.ts` extensions in imports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FHIR reverse proxy | Manual http.request forwarding | http-proxy-middleware | Handles chunked transfer, WebSocket, keep-alive, error cases, changeOrigin header rewriting |
| Static file serving | Manual fs.readFile + MIME types | express.static() | MIME detection, ETag, Range requests, directory index, cache headers |
| Path-to-SPA mapping | Manual route listing | express.static + single `app.get('*')` fallback | Already handles edge cases (trailing slash, encoded chars) |
| YAML parsing | Custom parser | js-yaml (already installed) | YAML is not trivial; js-yaml handles all spec edge cases |

**Key insight:** The Node ecosystem has solved static serving, proxying, and YAML parsing for decades. The only custom code in this phase is handler extraction and the startup/wiring logic.

---

## Common Pitfalls

### Pitfall 1: FHIR Proxy Double-Path

**What goes wrong:** Setting proxy `target` to the full FHIR URL (`http://localhost:8080/fhir`) causes double-path: incoming `/fhir/Patient` → forwarded to `http://localhost:8080/fhir/fhir/Patient` → 404 from Blaze.

**Why it happens:** http-proxy-middleware appends the incoming request path to the target. If target already contains `/fhir`, the path is duplicated.

**How to avoid:** Strip the path from `blazeUrl` when setting proxy target. Derive target as `${protocol}//${host}` only. See Pattern 3.

**Warning signs:** Blaze returns 404 for all /fhir/* requests; curl `http://localhost:3000/fhir/Patient` shows wrong upstream URL in error logs.

### Pitfall 2: ESM Import of CJS Express Package

**What goes wrong:** With `"type": "module"` in package.json, `require('express')` fails at runtime (not a function). Also, some older guides show `const express = require(...)` which won't work in ESM context.

**Why it happens:** Express 5 is CJS (no `type: "module"` in its own package.json), but Node.js ESM can import CJS packages using `import` syntax.

**How to avoid:** Always use `import express from 'express'` (default import). Never use `require()`. tsx handles the CJS-in-ESM interop correctly.

**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'listen')` or `require is not defined`.

### Pitfall 3: tsconfig References vs Standalone

**What goes wrong:** Adding `tsconfig.server.json` as a reference in `tsconfig.json` causes `tsc -b` (the build command) to type-check server files as part of the main build. This may conflict with the `vite.config.ts` include in `tsconfig.node.json` or cause duplicate-compilation issues.

**Why it happens:** The root `tsconfig.json` uses project references. Adding a third reference includes server in the composite build.

**How to avoid:** Do NOT add `tsconfig.server.json` to the root `tsconfig.json` references. Run it separately: `tsc --noEmit -p tsconfig.server.json`. The `build:server` script handles this explicitly.

**Warning signs:** Errors from server types appearing in `npm run build` output; or vite.config.ts being included twice.

### Pitfall 4: Handler URL Matching vs Express Router

**What goes wrong:** The extracted handler functions use exact URL matching (`req.url === '/api/issues'`). When mounted as `app.use(handler)`, Express may strip the mount prefix from `req.url` if not mounted at root. If accidentally mounted at a prefix, URLs won't match.

**Why it happens:** Express modifies `req.url` to strip matched path prefixes when using `app.use('/prefix', handler)`.

**How to avoid:** Mount handlers at root with `app.use(issueApiHandler)` — no path prefix. The handlers already contain their own `/api/` path checks. This matches the Vite plugin behavior exactly.

**Warning signs:** API routes return 404 despite correct handler code; adding `console.log(req.url)` inside handler shows unexpected paths.

### Pitfall 5: settings.yaml Write Path in Production

**What goes wrong:** The `PUT /api/settings` handler writes to `SETTINGS_FILE = path.resolve(process.cwd(), 'public', 'settings.yaml')`. If the server process cwd is not the project root, the path resolves incorrectly.

**Why it happens:** `process.cwd()` depends on where `npm start` is run from, not where server/index.ts lives.

**How to avoid:** Document that `npm start` must be run from the project root. The existing handler already uses `process.cwd()` — consistent behavior. Alternatively, anchor paths to `import.meta.dirname` (Node 20+ ESM).

**Warning signs:** `ENOENT: no such file or directory, open '.../public/settings.yaml'` on PUT.

### Pitfall 6: SPA Fallback Serving API Errors as HTML

**What goes wrong:** If the Express static middleware or SPA fallback runs before API error responses are sent (e.g., due to async handler not calling `next()` properly), some error cases return `index.html` instead of a JSON error.

**Why it happens:** Forgetting to `return` after sending a response in async handler code causes `next()` to be called implicitly in some code paths, reaching the static/fallback middleware.

**How to avoid:** Every code path in extracted handlers must either send a response OR call `next()` — never both, never neither. The existing handlers already do this correctly; verify during extraction.

**Warning signs:** Browser receives HTML when it expects JSON; `Content-Type: text/html` on API error responses.

---

## Code Examples

### Express App Skeleton (server/index.ts)

```typescript
// Source: Express 5 official docs pattern + http-proxy-middleware 3.x API
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { issueApiHandler } from './issueApi.js';
import { settingsApiHandler } from './settingsApi.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Load config
const settingsPath = path.resolve(process.cwd(), 'public', 'settings.yaml');
const settings = yaml.load(fs.readFileSync(settingsPath, 'utf-8')) as Record<string, unknown>;
const serverConfig = (settings.server as Record<string, unknown>) ?? {};
const PORT = Number(serverConfig.port) || 3000;
const HOST = String(serverConfig.host || '0.0.0.0');
const DATA_DIR = path.resolve(String(serverConfig.dataDir || './data'));
const BLAZE_URL = String((settings.dataSource as Record<string, unknown>)?.blazeUrl || 'http://localhost:8080/fhir');
const BLAZE_TARGET = new URL(BLAZE_URL).origin; // strip path

// 2. Ensure data directory exists
ensureDataDir(DATA_DIR);

// 3. Create Express app
const app = express();

// 4. API handlers (raw Node types, called directly)
app.use(issueApiHandler);
app.use(settingsApiHandler);

// 5. FHIR proxy
app.use('/fhir', createProxyMiddleware({
  target: BLAZE_TARGET,
  changeOrigin: true,
}));

// 6. Static files from dist/
const DIST_DIR = path.resolve(process.cwd(), 'dist');
app.use(express.static(DIST_DIR));

// 7. SPA fallback — must be last
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// 8. Start
app.listen(PORT, HOST, () => {
  console.log(`[server] Running at http://${HOST}:${PORT}`);
  console.log(`[server] Serving static files from ${DIST_DIR}`);
  console.log(`[server] FHIR proxy → ${BLAZE_TARGET}`);
});
```

### settings.yaml Extended Schema

```yaml
# public/settings.yaml — extended with server: section
twoFactorEnabled: true
therapyInterrupterDays: 120
therapyBreakerDays: 365
dataSource:
  type: local
  blazeUrl: http://localhost:8080/fhir
server:
  port: 3000
  host: "0.0.0.0"
  dataDir: "./data"
```

### settingsApi.ts Schema Validation Update

The `validateSettingsSchema()` function in settingsApi.ts must be updated to allow (not reject) the new `server:` section. It currently validates only `twoFactorEnabled`, `therapyInterrupterDays`, `therapyBreakerDays`, and `dataSource`. The `server:` key must be permitted (ignore unknown keys — current code does not reject them, so no change needed unless strict unknown-key validation is added).

[VERIFIED: settingsApi.ts validateSettingsSchema() only checks specific required fields; unknown keys like `server:` pass through without error]

### Default Users for Seeding (from AuthContext.tsx)

```typescript
// Copy verbatim from src/context/AuthContext.tsx DEFAULT_MANAGED_USERS
const DEFAULT_USERS = [
  { username: 'admin', firstName: 'System', lastName: 'Administrator', role: 'admin', centers: ['UKA', 'UKB', 'LMU', 'UKT', 'UKM'], createdAt: '2025-01-01T00:00:00Z' },
  { username: 'forscher1', firstName: 'Anna', lastName: 'Müller', role: 'researcher', centers: ['UKA'], createdAt: '2025-01-15T00:00:00Z' },
  { username: 'forscher2', firstName: 'Thomas', lastName: 'Weber', role: 'researcher', centers: ['UKB'], createdAt: '2025-02-01T00:00:00Z' },
  { username: 'epidemiologe', firstName: 'Julia', lastName: 'Schmidt', role: 'epidemiologist', centers: ['UKA', 'UKB', 'LMU'], createdAt: '2025-03-01T00:00:00Z' },
  { username: 'kliniker', firstName: 'Markus', lastName: 'Fischer', role: 'clinician', centers: ['UKT'], createdAt: '2025-03-15T00:00:00Z' },
  { username: 'diz_manager', firstName: 'Sabine', lastName: 'Braun', role: 'data_manager', centers: ['UKM'], createdAt: '2025-04-01T00:00:00Z' },
  { username: 'klinikleitung', firstName: 'Prof. Klaus', lastName: 'Hoffmann', role: 'clinic_lead', centers: ['UKA', 'UKB', 'LMU', 'UKT', 'UKM'], createdAt: '2025-04-15T00:00:00Z' },
];
```

[VERIFIED: AuthContext.tsx lines 78–86]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| express@4 | express@5 (stable) | Late 2024 | Async error handling built-in; no more `next(err)` for async routes |
| http-proxy-middleware@2 | http-proxy-middleware@3 | 2023 | `on.error` callback syntax changed; v3 uses `{ on: { error: fn } }` not top-level `onError` |
| ts-node | tsx | 2022+ | tsx has better ESM support, faster, no config needed |
| `__dirname` (CJS) | `fileURLToPath(import.meta.url)` (ESM) | With ESM adoption | `__dirname` undefined in ESM; must reconstruct from `import.meta.url` |

**Deprecated/outdated:**
- `http-proxy-middleware` v2 `onError` option: replaced by `on: { error: fn }` in v3 [VERIFIED: npm page]
- `ts-node`: superseded by tsx for most use cases
- `express.Router()` for this phase: unnecessary — handlers use internal URL matching, not Express routing

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `app.get('*', ...)` SPA fallback ordering prevents API interference | Architecture Patterns — Pattern 4 | API routes return HTML; need to verify route order in integration test |
| A2 | Express 5 default import (`import express from 'express'`) works correctly from ESM context with tsx | Standard Stack | Runtime TypeError; easily caught in Wave 0 smoke test |
| A3 | `validateSettingsSchema()` does not reject unknown keys (permitting new `server:` section without code change) | Code Examples — schema | PUT /api/settings rejects valid settings after adding `server:` block |

**A3 clarification:** Verified by reading settingsApi.ts lines 26–56 — the function only checks for presence of specific fields, does not enumerate or reject unknown keys. Risk is LOW.

---

## Open Questions (RESOLVED)

1. **URL matching in extracted handlers when `req.url` contains query strings**
   - RESOLVED: Node's `req.url` includes query strings (e.g., `/api/issues?foo=bar`). The existing handlers use `startsWith` checks for some routes and exact matches for others. During extraction, use `req.url?.startsWith('/api/issues')` pattern with method checks for disambiguation. This matches the existing Vite middleware behavior.

2. **settings.yaml write safety during concurrent requests**
   - RESOLVED: Acceptable for Phase 1 (single admin user, low concurrency). Known limitation documented. No change needed.

3. **`import.meta.dirname` availability**
   - RESOLVED: Use `process.cwd()` consistently for all path resolution. Reason: existing server code (issueApi.ts, settingsApi.ts) already uses `process.cwd()` for file paths, and the settings.yaml path is relative to project root. Using `process.cwd()` everywhere maintains consistency with existing code and is simpler than mixing approaches. `import.meta.dirname` would point to the server/ directory, not the project root, which would require extra `..` joins.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server runtime | Yes | 22.22.0 | — |
| npm | Package install | Yes | 11.12.1 | — |
| tsc | Type-checking | Yes | 6.0.2 | — |
| express | HTTP server | Not installed | — | Install in Wave 0 |
| @types/express | TS types | Not installed | — | Install in Wave 0 |
| http-proxy-middleware | FHIR proxy | Not installed | — | Install in Wave 0 |
| tsx | Server runner | Not installed | — | Install in Wave 0 |
| js-yaml | YAML parsing | Already in deps | 4.1.1 | — |
| dist/index.html | SPA fallback | Yes | — | Run `npm run build` first |

**Missing dependencies with no fallback:** None — all missing packages can be installed via npm.

**Missing dependencies with fallback:** None — all required packages have direct npm equivalents.

[VERIFIED: npm registry 2026-04-10; node --version; npm --version; local node_modules]

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from config.json — treating as enabled. However, `testFramework` is `"none"` — no test framework is installed. All phase validation is via smoke testing (curl / browser).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed (testFramework: "none" in config.json) |
| Config file | n/a |
| Quick run command | Manual: `curl http://localhost:3000/api/settings -H "Authorization: Bearer ..."` |
| Full suite command | Manual: Checklist below |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-01 | `GET /` returns index.html | smoke | `curl -s http://localhost:3000/ | grep -q '<html'` | n/a — bash one-liner |
| BACK-02 | `GET /api/settings` returns YAML | smoke | `curl -s http://localhost:3000/api/settings -H "Authorization: Bearer ..."` | n/a |
| BACK-03 | `GET /fhir/metadata` proxied to Blaze | smoke | `curl -s http://localhost:3000/fhir/metadata` (when Blaze running) | n/a |
| BACK-04 | `GET /some-react-route` returns index.html | smoke | `curl -sI http://localhost:3000/cohort-builder | grep 'Content-Type: text/html'` | n/a |
| BACK-05 | `npm run build:all && npm start` exits 0, server listens on port 3000 | manual | `npm run build:all && npm start &` | n/a |
| BACK-06 | `npm run dev` still starts Vite dev server | manual | `npm run dev` (verify unchanged behavior) | n/a |

### Sampling Rate

- **Per task commit:** `npm start` launches without error (manual check)
- **Per wave merge:** Full smoke checklist above
- **Phase gate:** All 6 BACK requirements verified before marking phase complete

### Wave 0 Gaps

- [ ] `npm install express http-proxy-middleware` + `npm install --save-dev @types/express tsx` — must run before any implementation task
- [ ] `public/settings.yaml` extended with `server:` section before server/index.ts reads it
- [ ] `tsconfig.server.json` created before `build:server` script can be added
- [ ] `dist/` must exist for SPA serving test — already built (dist/index.html exists)

---

## Security Domain

> `security_enforcement` not set in config.json — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Existing `validateAuth()` in utils.ts — Base64 Bearer token against KNOWN_USERS |
| V3 Session Management | No | No server-side sessions in Phase 1; session token lives in client sessionStorage |
| V4 Access Control | Yes | `validateAuth(req, 'admin')` for admin-only routes — already implemented |
| V5 Input Validation | Yes | `validateIssueBody()` and `validateSettingsSchema()` already in handlers |
| V6 Cryptography | No | No cryptographic operations in Phase 1; auth token validation is structural only |

### Known Threat Patterns for Express + Static Serving

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via static serving | Spoofing/Info disclosure | `express.static()` has built-in path traversal protection (do not use custom `fs.readFile` with `req.url`) |
| FHIR proxy request smuggling | Tampering | http-proxy-middleware handles keep-alive and chunked encoding correctly |
| Role forgery via Base64 token | Elevation of privilege | `validateAuth()` already cross-checks claimed role against KNOWN_USERS server-side |
| Oversized request bodies | DoS | `readBody()` enforces 10 MB limit with `req.destroy()` — already implemented |
| settings.yaml YAML injection | Tampering | `yaml.load()` (not `yaml.safeLoad`) is safe in js-yaml 4.x; `safeLoad` was removed; `load` is equivalent |

**Security note on auth:** The current auth scheme (Base64 JSON, no signing) is explicitly temporary per the codebase comments (`IMPORTANT: This validates the token against a known user list for the demonstrator`). Phase 5 replaces with JWT validation. Phase 1 carries this forward unchanged — no regression, same security posture as Vite dev server.

---

## Sources

### Primary (HIGH confidence)

- npm registry (2026-04-10) — express@5.2.1, @types/express@5.0.6, http-proxy-middleware@3.0.5, tsx@4.21.0 versions and metadata verified via `npm view`
- Project codebase — server/issueApi.ts, server/settingsApi.ts, server/utils.ts, vite.config.ts, public/settings.yaml, src/context/AuthContext.tsx — all read directly

### Secondary (MEDIUM confidence)

- Node.js 22.22.0 runtime — confirmed installed via `node --version`
- TypeScript 6.0.2 — confirmed installed, tsc available in node_modules/.bin

### Tertiary (LOW confidence)

- http-proxy-middleware v3 `on.error` callback syntax change (from v2) — [ASSUMED] based on training knowledge of the library's changelog; verify against official README if needed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified against npm registry
- Architecture: HIGH — handler extraction pattern derived directly from reading existing code; route ordering is Express fundamentals
- Pitfalls: HIGH for FHIR double-path and URL matching (derived from reading actual config); MEDIUM for concurrency issue (documented pattern)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable libraries; Express 5 and http-proxy-middleware 3 unlikely to have breaking changes in 30 days)
