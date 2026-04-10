---
phase: 01-production-express-backend
plan: 01
subsystem: server
tags: [express, vite-plugin, handler-extraction, build-infrastructure, typescript]
dependency_graph:
  requires: []
  provides: [issueApiHandler, settingsApiHandler, tsconfig.server.json, build:all, build:server, start]
  affects: [server/issueApi.ts, server/settingsApi.ts, package.json]
tech_stack:
  added: [express@^5.2.1, http-proxy-middleware@^3.0.5, "@types/express@^5.0.6", tsx@^4.21.0]
  patterns: [raw-node-http-handler, vite-plugin-delegation, dual-tsconfig]
key_files:
  created: [tsconfig.server.json]
  modified: [server/issueApi.ts, server/settingsApi.ts, package.json, package-lock.json]
decisions:
  - "Extracted handlers use raw IncomingMessage/ServerResponse signatures (not Express types) per D-01, enabling zero-rewrite reuse in Express server"
  - "tsconfig.server.json is standalone (not referenced in tsconfig.json) per Pitfall 3 to avoid breaking Vite build"
  - "start script uses tsx directly (no compile step) per D-07 build strategy"
metrics:
  duration_minutes: ~15
  completed_date: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
  files_created: 1
---

# Phase 01 Plan 01: Handler Extraction and Build Infrastructure Summary

**One-liner:** Extracted `issueApiHandler` and `settingsApiHandler` as raw Node http standalone functions, with Vite plugins delegating to them, plus express/tsx dependencies and dual tsconfig build infrastructure.

## What Was Built

### Task 1: Extract handler functions from Vite plugins (commit a1f5f1f)

Both `server/issueApi.ts` and `server/settingsApi.ts` were refactored to separate the middleware logic from the Vite plugin wrapper:

- `issueApiHandler(req: IncomingMessage, res: ServerResponse, next: () => void): void` — contains the complete POST /api/issues, GET /api/issues/export, and GET /api/issues logic verbatim
- `settingsApiHandler(req: IncomingMessage, res: ServerResponse, next: () => void): void` — contains the complete GET /api/settings and PUT /api/settings logic verbatim
- Both Vite plugin functions simplified to `server.middlewares.use(handlerFn)`
- All business logic (auth, validation, file I/O) preserved without modification
- `import type { IncomingMessage, ServerResponse } from 'node:http'` added to both files

### Task 2: Install dependencies, tsconfig.server.json, npm scripts (commit e71b3bd)

- Installed `express` and `http-proxy-middleware` as production dependencies
- Installed `@types/express` and `tsx` as dev dependencies
- Created `tsconfig.server.json` — standalone type-check config for the `server/` directory (noEmit, not referenced in tsconfig.json)
- Added `build:server`, `build:all`, and `start` scripts to package.json

## Verification Results

- `npx tsc --noEmit -p tsconfig.node.json` — PASS (Vite plugin types valid)
- `npx tsc --noEmit -p tsconfig.server.json` — PASS (server handler types valid)
- All acceptance criteria checks passed

## Decisions Made

1. **Raw Node http types (not Express):** Handlers use `IncomingMessage`/`ServerResponse` per D-01. This means the Express server (Plan 02) can call them directly without any wrapper or type adaptation.
2. **Standalone tsconfig.server.json:** Not added as a reference in `tsconfig.json` to prevent Vite's build from picking up server files, per the plan's Pitfall 3 warning.
3. **tsx for start script:** No compile step at runtime — `tsx server/index.ts` runs TypeScript directly, consistent with D-07.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - this plan is infrastructure only; no UI-facing data paths introduced.

## Threat Flags

None — no new trust boundaries or network endpoints introduced. Handler extraction preserves existing auth checks verbatim.

## Self-Check: PASSED

Files verified:
- server/issueApi.ts — FOUND, exports issueApiHandler and issueApiPlugin
- server/settingsApi.ts — FOUND, exports settingsApiHandler and settingsApiPlugin
- tsconfig.server.json — FOUND, contains noEmit: true
- package.json — FOUND, contains build:all, build:server, start scripts and all required deps

Commits verified:
- a1f5f1f — FOUND (feat: extract handlers)
- e71b3bd — FOUND (chore: deps + tsconfig + scripts)
