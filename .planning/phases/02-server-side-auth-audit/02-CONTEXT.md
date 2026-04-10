# Phase 2: Server-Side Auth + Audit - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side login with bcrypt-hashed passwords, JWT session tokens, tamper-proof audit log in SQLite. Remove hardcoded credentials from client bundle. Unified auth middleware for all /api/* routes. Audit is immutable from client — no write/delete API endpoints for audit data.

</domain>

<decisions>
## Implementation Decisions

### Login Flow
- **D-01:** Two-step server flow for 2FA. Step 1: POST /api/auth/login with { username, password } → server validates credentials (bcrypt), returns a challenge token if 2FA enabled. Step 2: POST /api/auth/verify with { challengeToken, otp } → server validates OTP, returns JWT. If 2FA disabled, Step 1 returns JWT directly.
- **D-02:** GET /api/auth/config is a public (no-auth) endpoint returning { twoFactorEnabled }. LoginPage calls this on mount to decide whether to show OTP field.
- **D-03:** Remove DEFAULT_CREDENTIALS from src/context/AuthContext.tsx entirely. Remove hardcoded KNOWN_USERS from server/utils.ts. All credential validation happens via data/users.json lookup.
- **D-04:** LoginPage posts credentials to server, receives JWT, stores in sessionStorage. No passwords ever in the client bundle.

### Token Lifecycle
- **D-05:** JWT expiry matches inactivity timeout (10 minutes). When any API call returns 401, AuthContext clears session and redirects to /login. No refresh token — keep it simple.
- **D-06:** JWT payload: { sub: username, preferred_username: username, role, centers, iat, exp }. Same format whether issued by local auth or (future) Keycloak.
- **D-07:** JWT secret stored in settings.yaml under auth.jwtSecret. Generated randomly on first startup if not present.

### Auth Middleware
- **D-08:** Express middleware validates JWT on all /api/* routes except /api/auth/login, /api/auth/verify, and /api/auth/config (public endpoints). Extracts { username, role, centers } from payload and attaches to request object for downstream handlers.
- **D-09:** Failed login limiting: server tracks consecutive failures per username in memory (Map). Lock account after 5 failures with exponential backoff. Reset on successful login. Configurable via settings.yaml auth.maxLoginAttempts.

### Audit Middleware
- **D-10:** Request-level audit logging — server middleware auto-logs EVERY API request: method, path, user (from JWT), timestamp, response status code, response time. One row per HTTP request.
- **D-11:** For mutation endpoints (POST/PUT/DELETE), also capture the request body in the audit entry. GET requests log query parameters only (not full response bodies).
- **D-12:** Delete ALL 15 client-side logAudit() calls from frontend code. Server middleware handles all audit logging. Zero audit responsibility in the React app.
- **D-13:** No POST, PUT, PATCH, or DELETE endpoints for audit. Only GET /api/audit (filtered list) and GET /api/audit/export (admin full dump). All writes are internal server function calls.
- **D-14:** SQLite database at data/audit.db. Schema: audit_log(id TEXT PK, timestamp TEXT, method TEXT, path TEXT, user TEXT, status INTEGER, duration_ms INTEGER, body TEXT NULL, query TEXT NULL). Indexed on timestamp, user, path.
- **D-15:** 90-day rolling retention: DELETE FROM audit_log WHERE timestamp < datetime('now', '-90 days'). Runs on startup and via setInterval every 24 hours.

### Shared Auth Headers
- **D-16:** Create src/services/authHeaders.ts as single shared utility. Reads JWT from sessionStorage, returns { Authorization: 'Bearer <jwt>' }. Replaces duplicate getAuthHeaders() in issueService.ts and settingsService.ts.

### Claude's Discretion
- Migration order of file changes (which files to modify first)
- Exact bcrypt salt rounds (10-12 is standard)
- Whether to use express-jwt middleware or custom JWT validation
- SQLite WAL mode configuration for concurrent reads during writes
- Exact error response format for 401/403

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth (files to modify)
- `src/context/AuthContext.tsx` — Current client-side auth with DEFAULT_CREDENTIALS (to be gutted)
- `src/pages/LoginPage.tsx` — Current two-step login form (to be rewired to server)
- `server/utils.ts` — Current validateAuth() and KNOWN_USERS (to be replaced)
- `src/services/issueService.ts` — Has duplicate getAuthHeaders() (to be replaced)
- `src/services/settingsService.ts` — Has duplicate getAuthHeaders() (to be replaced)

### Audit (files to modify/delete calls from)
- `src/services/auditService.ts` — Current localStorage audit (to be gutted)
- `src/pages/AuditPage.tsx` — Current sync loading + clear button (to become async read-only)
- `src/hooks/usePageAudit.ts` — Client-side audit hook (to be removed)
- `src/context/AuthContext.tsx` — Has logAudit calls for login/logout/user management
- `src/pages/QualityPage.tsx` — Has logAudit calls for flag/exclude actions
- `src/pages/CohortBuilderPage.tsx` — Has logAudit calls for export
- `src/pages/CaseDetailPage.tsx` — Has logAudit call for case view
- `src/pages/SettingsPage.tsx` — Has logAudit calls for setting changes

### Server (files to create/modify)
- `server/index.ts` — Mount auth + audit middleware, new auth routes
- `public/settings.yaml` — Add auth section (jwtSecret, maxLoginAttempts)

### Requirements
- `.planning/REQUIREMENTS.md` — AUDIT-01..10, AUTH-01..09, USER-07..13

### Prior phase decisions
- `.planning/phases/01-production-express-backend/01-CONTEXT.md` — D-01 (raw Node handlers), D-02 (settings.yaml config)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/utils.ts:readBody()` — Body parser with size limit, reuse for login/verify endpoints
- `server/utils.ts:sendError()` — JSON error response helper, reuse for auth errors
- `server/index.ts:ensureDataDir()` — Data directory creation pattern, reuse for audit.db init
- `src/utils/safeJson.ts:safeJsonParse()` — Safe JSON parsing, reuse in auth token handling

### Established Patterns
- Vite plugin + Express shared handler pattern (from Phase 1) — auth routes need the same pattern
- Settings-first startup (from Phase 1) — auth config read at startup from settings.yaml
- File-based storage in data/ (from Phase 1) — audit.db goes here

### Integration Points
- `server/index.ts` line ~98: API handler mounting — insert auth middleware BEFORE existing handlers
- `server/index.ts` line ~130: app.listen — insert audit purge interval setup
- LoginPage.tsx form submission — rewire from client-side validation to POST /api/auth/login
- AuthContext.tsx — strip credential validation, keep session state + inactivity timer

</code_context>

<specifics>
## Specific Ideas

- Two-step server flow for 2FA matches the existing LoginPage UX (credentials → OTP) but validates server-side
- Request-level audit captures everything automatically — no risk of missing an action because a developer forgot to add logAudit()
- Mutation body logging gives traceability for quality flags, case exclusions, and setting changes without capturing large FHIR response bodies
- JWT expiry = inactivity timeout keeps behavior consistent with current auto-logout at 10 minutes

</specifics>

<deferred>
## Deferred Ideas

- User CRUD API (POST/DELETE /api/users) — Phase 3 scope
- Center-based data filtering — Phase 4 scope
- Keycloak JWT validation (RS256 via JWKS) — Phase 5 scope
- Token refresh mechanism — deferred; redirect to login is sufficient for v1
- Password change endpoint — Phase 3 scope (USER-11)

None beyond planned phases — discussion stayed within Phase 2 scope.

</deferred>

---

*Phase: 02-server-side-auth-audit*
*Context gathered: 2026-04-10*
