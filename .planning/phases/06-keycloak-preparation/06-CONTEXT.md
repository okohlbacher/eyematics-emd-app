# Phase 6: Keycloak Preparation - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare auth middleware for Keycloak JWKS validation, settings.yaml config block with auth.provider toggle, Keycloak claim mapping to existing JWT fields, LoginPage UI conditional on provider, and step-by-step Keycloak realm/client setup documentation. No full OIDC redirect flow (v2 scope).

</domain>

<decisions>
## Implementation Decisions

### Auth Provider Switching
- **D-01:** settings.yaml gains `auth.provider` field (`local` | `keycloak`) and `auth.keycloak` config block with `issuer` and `clientId`. Default: `local`.
- **D-02:** Restart required to switch providers — server reads `auth.provider` once at startup. No runtime switching. Old sessions invalidated naturally on restart.
- **D-03:** Fail closed — if `auth.provider: keycloak` but Keycloak/JWKS is unreachable, all auth fails with 503/401. No silent fallback to local auth. Operator must fix Keycloak or switch back to `local` + restart.
- **D-04:** POST /api/auth/login returns 405 when `provider=keycloak` — local login endpoint is disabled entirely in Keycloak mode. Prevents confusion about which auth path is active.

### LoginPage UI Toggle
- **D-05:** LoginPage shows Keycloak button only when `provider=keycloak` — username/password form is replaced entirely with a single "Login with Keycloak" button. No local form visible.
- **D-06:** In v1, Keycloak button click shows an info message: "Keycloak SSO is configured but the redirect flow is not yet implemented. Contact your administrator." Full OIDC redirect is v2 scope.
- **D-07:** Extend existing GET /api/auth/config response with `provider` field — LoginPage already calls this endpoint for 2FA config. Add `provider: 'local' | 'keycloak'` to the response.

### Documentation
- **D-08:** Keycloak setup docs live in `docs/keycloak-setup.md` — standalone markdown file, version-controlled with the codebase.
- **D-09:** Step-by-step admin guide level of detail — detailed enough for a system admin to configure Keycloak from scratch. Covers: prerequisites, realm configuration, client setup (emd-app), role mapping to 6 EMD roles, custom 'centers' claim configuration, settings.yaml example, verification steps.

### Claude's Discretion
- JWKS caching strategy (jwks-rsa library configuration, cache TTL)
- Keycloak claim mapping implementation details (how preferred_username, role, centers are extracted from Keycloak JWT)
- authMiddleware branching implementation (how to switch between HS256 local verification and RS256 JWKS verification)
- Error message wording for 503/405 responses in Keycloak mode
- i18n keys for Keycloak-related UI strings

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth middleware (to be extended)
- `server/authMiddleware.ts` — Current HS256-only JWT validation; needs branching for Keycloak RS256/JWKS validation (AUTH-03)
- `server/initAuth.ts` — JWT secret management, auth config parsing from settings; needs auth.provider + keycloak block parsing (KC-01)
- `server/authApi.ts` — Login/verify/config endpoints; /login must return 405 in Keycloak mode (D-04), /config must include provider (D-07)

### LoginPage (to be modified)
- `src/pages/LoginPage.tsx` — Current username/password form + OTP; conditional swap to Keycloak button (KC-04, D-05, D-06)
- `src/context/AuthContext.tsx` — Auth state management; may need provider-awareness

### Configuration
- `public/settings.yaml` — Current config; add auth.provider and auth.keycloak block (KC-01)

### Requirements
- `.planning/REQUIREMENTS.md` — KC-01..05, AUTH-03

### Prior phase decisions
- `.planning/phases/05-center-based-data-restriction/05-CONTEXT.md` — D-11 (req.auth.centers from middleware), D-12 (admin bypass)
- `.planning/phases/04-user-management-data-persistence/04-CONTEXT.md` — D-03 (auth API endpoints)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/authMiddleware.ts:AuthPayload` — Already uses Keycloak-compatible fields (sub, preferred_username, role, centers). No payload schema change needed.
- `server/authApi.ts:signSessionToken()` — Signs JWTs with HS256; stays unchanged for local mode.
- `server/authApi.ts:VALID_CENTERS` — Center validation set; reusable for Keycloak claim validation.
- `server/authApi.ts:VALID_ROLES` — Role validation set; reusable for Keycloak role mapping validation.
- `server/initAuth.ts:initAuth()` — Settings parsing pattern; extend for auth.provider + keycloak block.

### Established Patterns
- Settings parsed from public/settings.yaml via js-yaml at startup (server/index.ts)
- Auth config exposed via GET /api/auth/config (public endpoint, no JWT required)
- LoginPage conditionally renders form steps based on config (credentials vs OTP step)
- jsonwebtoken library already installed; jwks-rsa needs to be added as dependency

### Integration Points
- `server/index.ts` — initAuth() call at startup; needs to pass provider config
- `server/authMiddleware.ts` — jwt.verify() call; needs branching: HS256 local secret vs RS256 JWKS
- `src/pages/LoginPage.tsx` — Form rendering; needs conditional based on provider from /api/auth/config
- `package.json` — Add jwks-rsa dependency

</code_context>

<specifics>
## Specific Ideas

- JWT payload fields already Keycloak-compatible: { sub, preferred_username, role, centers } — this was a deliberate design choice from Phase 2
- jwksUri can be derived from issuer: `${issuer}/protocol/openid-connect/certs` (standard Keycloak URL pattern)
- Keycloak client mappers needed: "role" (realm role to token claim) and "centers" (user attribute to multivalued token claim)
- The 6 EMD roles (admin, researcher, epidemiologist, clinician, data_manager, clinic_lead) should map 1:1 to Keycloak realm roles

</specifics>

<deferred>
## Deferred Ideas

- Full OIDC authorization code flow with PKCE — v2 scope (KC-V2-01)
- Token refresh and session management — v2 scope (KC-V2-02)
- docker-compose.yml with pre-configured Keycloak — v2 scope (KC-V2-03)
- Automatic role mapping from Keycloak realm roles — v2 scope (KC-V2-04)

None beyond planned v2 requirements — discussion stayed within Phase 6 scope.

</deferred>

---

*Phase: 06-keycloak-preparation*
*Context gathered: 2026-04-10*
