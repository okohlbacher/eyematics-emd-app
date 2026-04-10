# Phase 1: Production Express Backend - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone Express server that serves the Vite production build (static files from dist/), mounts all existing API routes (issues, settings), proxies /fhir/* to the configured Blaze FHIR server, and provides SPA fallback. Must coexist with the Vite dev server — `npm run dev` behavior unchanged.

</domain>

<decisions>
## Implementation Decisions

### Handler API Strategy
- **D-01:** Wrap existing raw Node http handlers — do NOT rewrite as Express handlers. The current issueApi.ts and settingsApi.ts use `IncomingMessage`/`ServerResponse` which Express extends. Express routes call shared handlers directly. Vite dev plugins continue using the same handlers unchanged.

### Server Configuration
- **D-02:** All server configuration lives in settings.yaml — no environment variables, no CLI flags. This includes port, host, data directory path, FHIR/Blaze URL. The settings.yaml already exists at public/settings.yaml and is the single source of configuration truth.
- **D-03:** Extend settings.yaml schema with a `server:` section for port, host, and data directory. Example:
  ```yaml
  server:
    port: 3000
    host: "0.0.0.0"
    dataDir: "./data"
  ```

### Logging
- **D-04:** Minimal server logging — startup info, API errors, and FHIR proxy failures to stdout. No per-request access log (morgan-style). The audit log (Phase 2) handles detailed user action tracking separately.
- **D-05:** (Carried to Phase 2) The audit log must be very detailed: every new data access, every change to data/annotations at the case/patient level. This goes beyond current AuditAction types — Phase 2 must expand audit granularity.

### Data Directory
- **D-06:** Auto-create data/ directory on startup if it doesn't exist. Seed users.json with DEFAULT_MANAGED_USERS from AuthContext.tsx. Zero manual setup required for first run.

### Build & Deploy
- **D-07:** Claude's discretion on TypeScript compilation strategy (tsconfig.server.json), npm script naming, and output directory structure. Pragmatic approach — whatever works cleanly with the existing ESM (`"type": "module"`) setup.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Server Code (handler extraction sources)
- `server/issueApi.ts` — Issue CRUD handlers using raw Node http types + Vite plugin wrapper
- `server/settingsApi.ts` — Settings GET/PUT handlers using raw Node http types + Vite plugin wrapper
- `server/utils.ts` — Shared utilities: readBody(), validateAuth(), sendError(), KNOWN_USERS

### Configuration
- `public/settings.yaml` — Current settings file (to be extended with server section)
- `vite.config.ts` — Vite dev server config with /fhir proxy and plugin registration

### Data Model & Types
- `src/types/fhir.ts` — FHIR type definitions
- `src/services/dataSource.ts` — Data source abstraction (local files vs Blaze)

### Package Configuration
- `package.json` — Current deps and scripts; `"type": "module"` (ESM)
- `tsconfig.node.json` — Current Node/server TypeScript config

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/utils.ts`: readBody(), validateAuth(), sendError() — all raw Node http types, directly usable from Express
- `server/issueApi.ts`: Issue handlers with file-based storage pattern in feedback/ — template for other server-side stores
- `server/settingsApi.ts`: YAML read/write pattern with validation — reusable for extended settings

### Established Patterns
- Vite plugin pattern: `configureServer()` hook registers middleware on dev server
- File storage: JSON files in feedback/ directory with UUID naming
- Auth: Base64 Bearer token validated against KNOWN_USERS with role checking
- Settings: YAML parsed with js-yaml, schema validated before write

### Integration Points
- Express server must mount at same API paths: POST/GET /api/issues, GET/PUT /api/settings
- FHIR proxy must match Vite dev proxy behavior: /fhir/* → Blaze URL
- Static serving from dist/ after `npm run build`
- SPA fallback: all non-API, non-static GET routes serve dist/index.html

</code_context>

<specifics>
## Specific Ideas

- Settings should be the single source of truth for ALL configuration — port, host, data paths, FHIR URL, auth config. No env vars.
- Audit log detail requirement (Phase 2): must capture every data access and every annotation/change at the case/patient level — more granular than current AuditAction types.

</specifics>

<deferred>
## Deferred Ideas

- Detailed audit logging granularity — Phase 2 scope (AUDIT requirements)
- Keycloak JWT validation in auth middleware — Phase 5 scope (KC requirements)
- Server-side user management API — Phase 3 scope (USER requirements)

None beyond planned phases — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 01-production-express-backend*
*Context gathered: 2026-04-10*
