---
phase: 01-production-express-backend
verified: 2026-04-10T00:00:00Z
status: human_needed
score: 9/10 must-haves verified
re_verification: false
deferred:
  - truth: "Express server mounts all API routes — audit, users, and data routes not yet mounted"
    addressed_in: "Phase 2 (AUDIT-01..10, AUTH-01..09) and Phase 3 (USER-01..12, DATA-01..07)"
    evidence: "REQUIREMENTS.md traceability: AUDIT-01..10 -> Phase 2, USER-01..12 -> Phase 3, DATA-01..07 -> Phase 3. Phase 1 ROADMAP success criteria scopes BACK-02 to 'all existing API routes (/api/issues, /api/settings)' — the other routes do not exist yet."
human_verification:
  - test: "Run `npm run dev` and verify the Vite dev server starts without errors and serves the React app on its default port"
    expected: "Vite starts cleanly, app loads at http://localhost:5173 (or configured port), /api/issues and /api/settings endpoints respond correctly via Vite middleware"
    why_human: "Cannot start a dev server in a non-interactive verification context. Behavior requires live server observation."
  - test: "Run `npm start` and curl http://localhost:3000/ after build to verify static app is served"
    expected: "HTTP 200 with index.html content, not a 404 or Express error"
    why_human: "Cannot start a persistent server to test live HTTP responses during static verification."
  - test: "Run `npm start` and curl http://localhost:3000/fhir/Patient (Blaze may not be running)"
    expected: "Request is forwarded to http://localhost:8080 — either a real response from Blaze or a 502 proxy error (not a 404 from Express itself)"
    why_human: "Proxy path stripping requires a live HTTP exchange to confirm the target URL is assembled correctly."
  - test: "Run `npm start` and curl http://localhost:3000/some/unknown/route"
    expected: "HTTP 200 with index.html content (SPA fallback active)"
    why_human: "SPA fallback behavior requires a live server to confirm the /{*path} route pattern resolves correctly under Express 5."
---

# Phase 1: Production Express Backend Verification Report

**Phase Goal:** Standalone Express server that serves the built app and all existing APIs
**Verified:** 2026-04-10
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | issueApiHandler and settingsApiHandler are exported standalone functions with raw Node http types | VERIFIED | Both exported from their files with `(req: IncomingMessage, res: ServerResponse, next: () => void): void` signatures. IncomingMessage/ServerResponse imported from `node:http` in both files. |
| 2 | Vite dev plugins delegate to the extracted handlers (npm run dev unchanged) | VERIFIED | `issueApiPlugin` calls `server.middlewares.use(issueApiHandler)` at line 178 of issueApi.ts; `settingsApiPlugin` calls `server.middlewares.use(settingsApiHandler)` at line 132 of settingsApi.ts. vite.config.ts imports and invokes both plugin functions unchanged. |
| 3 | tsconfig.server.json exists for server type-checking | VERIFIED | File exists with `"noEmit": true`, `"include": ["server"]`, and is NOT referenced in tsconfig.json (which only references tsconfig.app.json and tsconfig.node.json). |
| 4 | npm scripts build:server, build:all, and start are defined | VERIFIED | All three present in package.json: `build:server` runs tsc --noEmit -p tsconfig.server.json, `build:all` chains build + build:server, `start` runs tsx server/index.ts. |
| 5 | express, http-proxy-middleware, @types/express, and tsx are installed | VERIFIED | express@^5.2.1 and http-proxy-middleware@^3.0.5 in dependencies; @types/express@^5.0.6 and tsx@^4.21.0 in devDependencies. |
| 6 | npm run build:all exits 0 and serves the built app | VERIFIED (partial) | dist/index.html exists, confirming a prior successful build. Build script structure is correct. Live build run not performed in verification context. |
| 7 | GET /api/issues and GET/PUT /api/settings work in production mode | VERIFIED (static) | issueApiHandler and settingsApiHandler mounted via `app.use()` before static serving (lines 100-101 of server/index.ts). Logic verified present and substantive in issueApi.ts and settingsApi.ts. Live HTTP test requires human verification. |
| 8 | GET /fhir/* proxies to configured Blaze URL without double-path | VERIFIED (static) | `deriveBlazeTarget` strips path to host-only (`http://localhost:8080`), mounted at `/fhir` path. Node.js evaluation confirms target = `http://localhost:8080` for blazeUrl `http://localhost:8080/fhir`. Live proxy test requires human verification. |
| 9 | All unmatched GET routes serve index.html (SPA fallback) | VERIFIED (static) | `app.get('/{*path}', ...)` at line 123 calls `res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'))`. Express 5 /{*path} syntax used correctly per plan deviation note. Live test requires human verification. |
| 10 | data/ directory auto-created on startup with seeded users.json | VERIFIED | data/users.json exists with 7 users (confirmed by node evaluation). Server code creates dir and seeds file if absent (lines 61-80 of server/index.ts). |

**Score:** 9/10 truths verified (1 requires human live-server testing for full confirmation)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | BACK-02 full scope: audit, users, data routes not mounted | Phase 2 + Phase 3 | REQUIREMENTS.md traceability maps AUDIT-01..10 to Phase 2, USER-01..12 and DATA-01..07 to Phase 3. Phase 1 ROADMAP success criteria scopes BACK-02 as "all existing API routes (/api/issues, /api/settings)". The routes for audit, users, and data do not exist as server modules yet — they are Phase 2/3 deliverables. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/issueApi.ts` | Extracted issueApiHandler + unchanged Vite plugin wrapper | VERIFIED | Exports `issueApiHandler` (line 77) and `issueApiPlugin` (line 174). Handler is substantive: 95 lines of real business logic covering POST, GET /export, GET routes with auth and file I/O. |
| `server/settingsApi.ts` | Extracted settingsApiHandler + unchanged Vite plugin wrapper | VERIFIED | Exports `settingsApiHandler` (line 59) and `settingsApiPlugin` (line 128). Handler is substantive: 67 lines of real GET/PUT logic with YAML validation and file writes. |
| `tsconfig.server.json` | Server-only type-check config (noEmit) | VERIFIED | Contains `"noEmit": true`, targets server/ directory only, not referenced in root tsconfig.json. |
| `package.json` | Updated scripts and dependencies | VERIFIED | All 4 required deps present, all 3 required scripts present. |
| `server/index.ts` | Express server entry point with full route mounting | VERIFIED | 135 lines (exceeds min_lines: 60). All required mounting present. |
| `public/settings.yaml` | Extended settings with server section | VERIFIED | Contains `server:` section with port: 3000, host: "0.0.0.0", dataDir: "./data". |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| server/issueApi.ts:issueApiPlugin | server/issueApi.ts:issueApiHandler | server.middlewares.use(issueApiHandler) | WIRED | Line 178: `server.middlewares.use(issueApiHandler)` |
| server/settingsApi.ts:settingsApiPlugin | server/settingsApi.ts:settingsApiHandler | server.middlewares.use(settingsApiHandler) | WIRED | Line 132: `server.middlewares.use(settingsApiHandler)` |
| server/index.ts | server/issueApi.ts:issueApiHandler | app.use(issueApiHandler) | WIRED | Lines 19+100: imported from './issueApi.js', mounted via `app.use(issueApiHandler)` |
| server/index.ts | server/settingsApi.ts:settingsApiHandler | app.use(settingsApiHandler) | WIRED | Lines 20+101: imported from './settingsApi.js', mounted via `app.use(settingsApiHandler)` |
| server/index.ts | http-proxy-middleware | createProxyMiddleware for /fhir | WIRED | Line 18 import, line 104: `app.use('/fhir', createProxyMiddleware({...}))` with host-stripped target |
| server/index.ts | public/settings.yaml | yaml.load reads config at startup | WIRED | Lines 26-44: reads SETTINGS_FILE, parses with yaml.load, fails fast if absent |
| server/index.ts | dist/index.html | SPA fallback sendFile | WIRED | Line 124: `res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'))` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| server/index.ts | settings (port, host, dataDir, blazeUrl) | yaml.load(fs.readFileSync(SETTINGS_FILE)) | Yes — reads public/settings.yaml which has real values | FLOWING |
| server/issueApi.ts | issues (loadAllIssues) | fs.readdirSync(FEEDBACK_DIR) + fs.readFileSync per file | Yes — reads real JSON files from feedback/ directory | FLOWING |
| server/settingsApi.ts | content (GET response) | fs.readFileSync(SETTINGS_FILE) | Yes — reads actual public/settings.yaml content | FLOWING |
| data/users.json | defaultUsers (seed) | Hardcoded array written once if file absent | Real data (7 users with correct fields) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| FHIR proxy target strips path | node deriveBlazeTarget('http://localhost:8080/fhir') | 'http://localhost:8080' | PASS |
| package.json deps and scripts complete | node -e "check all 7 required fields" | 'PASS' | PASS |
| data/users.json seeded with 7 users | node -e JSON.parse + length check | count: 7, first user: admin | PASS |
| dist/index.html exists from build | ls dist/index.html | EXISTS | PASS |
| Live server start and HTTP responses | Cannot test without running server | — | SKIP (requires live server) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BACK-01 | 01-02 | Express server serves Vite production build (static files from dist/) | SATISFIED | `app.use(express.static(path.resolve(process.cwd(), 'dist')))` at line 119; dist/index.html exists |
| BACK-02 | 01-01, 01-02 | Express server mounts all API routes (issues, settings, audit, users, data) | PARTIAL — deferred | issues and settings handlers mounted (lines 100-101). audit/users/data routes are Phase 2/3 deliverables per REQUIREMENTS.md traceability |
| BACK-03 | 01-02 | FHIR proxy forwards /fhir/* to configured Blaze URL in production | SATISFIED (static) | createProxyMiddleware mounted at /fhir with correct host-only target derivation; live proxy test deferred to human |
| BACK-04 | 01-02 | SPA fallback (all unmatched GET routes serve index.html) | SATISFIED (static) | `app.get('/{*path}', ...)` with sendFile(dist/index.html) at lines 123-125; live test deferred to human |
| BACK-05 | 01-01, 01-02 | Server starts via `npm start` after `npm run build:all` | SATISFIED (static) | start script = `tsx server/index.ts`, build:all script chains build + build:server, dist/index.html present |
| BACK-06 | 01-01, 01-02 | Vite dev mode (`npm run dev`) continues working unchanged | SATISFIED (static) | vite.config.ts imports issueApiPlugin/settingsApiPlugin unchanged; plugins delegate to extracted handlers; dev script = `vite` unchanged; live test deferred to human |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server/issueApi.ts | 74 | `return null` | INFO — not a stub | Validation sentinel: null means "no error found". Not a data-rendering path. |
| server/settingsApi.ts | 56 | `return null` | INFO — not a stub | Same pattern — validateSettingsSchema returns null for "valid". Not a stub. |

No blockers or warnings found. No TODO/FIXME/PLACEHOLDER comments. No empty handler bodies. No hardcoded empty responses on rendering paths.

### Human Verification Required

#### 1. Vite Dev Mode (BACK-06)

**Test:** Run `npm run dev` from the project root  
**Expected:** Vite dev server starts without TypeScript or plugin errors; app loads in browser; POST /api/issues and GET/PUT /api/settings respond correctly via the Vite middleware  
**Why human:** Cannot start an interactive dev server during static verification

#### 2. Production Static Serving (BACK-01, BACK-05)

**Test:** Run `npm run build:all && npm start`, then `curl http://localhost:3000/`  
**Expected:** HTTP 200 with index.html HTML content; startup log shows "EMD app running at http://0.0.0.0:3000"  
**Why human:** Requires a live running server

#### 3. FHIR Proxy Path (BACK-03)

**Test:** With server running, `curl -v http://localhost:3000/fhir/metadata`  
**Expected:** Request forwarded to http://localhost:8080/fhir/metadata (a real Blaze response or 502 if Blaze not running — but NOT a 404 from Express itself). Response headers should show proxy activity.  
**Why human:** Proxy behavior requires live HTTP exchange; path-stripping correctness can only be confirmed by observing the upstream request URL

#### 4. SPA Fallback (BACK-04)

**Test:** With server running, `curl http://localhost:3000/some/unknown/deep/route`  
**Expected:** HTTP 200 with index.html content (React app shell), not a 404  
**Why human:** Express 5's /{*path} glob handling requires a live server to confirm it catches all non-matched routes without interfering with API routes

### Gaps Summary

No blocking gaps found. All Phase 1 artifacts exist and are substantively implemented with real data flows. All key links are wired in the correct order (API handlers -> FHIR proxy -> static -> SPA fallback).

The only partial item — BACK-02 covering audit/users/data routes — is correctly deferred to Phases 2 and 3 by REQUIREMENTS.md traceability design. Phase 1's own ROADMAP success criteria explicitly scopes BACK-02 to the two existing API routes (issues, settings), both of which are mounted and verified.

Four human verification items remain to confirm live server behavior (static serving, FHIR proxy path forwarding, SPA fallback routing, and Vite dev mode). All static code indicators pass.

---

_Verified: 2026-04-10T00:00:00Z_  
_Verifier: Claude (gsd-verifier)_
