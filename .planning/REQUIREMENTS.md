# Requirements: EMD v1.10 — Session Hardening & UX Closure

**Defined:** 2026-05-01
**Core Value:** Every user sees only authorized data, with tamper-proof audit trail — while maintaining the zero-friction local development experience.

## v1.10 Requirements

### Session Management

- [x] **SESS-01**: Admin can trigger immediate sign-out of all active sessions for any user
- [ ] **SESS-02**: Server maintains a stateful refresh-sessions table (one row per issued refresh token, tracking user, device fingerprint, issued-at, expires-at, revoked flag)
- [ ] **SESS-03**: Server rotates refresh tokens on every use (OAuth2-style: previous token invalidated immediately on reuse)
- [ ] **SESS-04**: Admin can rotate the refresh-token signing key; existing sessions gracefully expire rather than hard-crashing

### Session UI

- [x] **SESSUI-01**: Admin can view all active sessions per user (device, issued-at, last-used, expires-at)
- [x] **SESSUI-02**: Admin can revoke individual sessions from the session listing UI
- [x] **SESSUI-03**: Admin can configure session TTL values (`refreshTokenTtlMs`, `refreshAbsoluteCapMs`) from the admin UI (writes to settings.yaml)

### UX Fixes

- [ ] **UX-01**: Home "Attention needed" panel — Review buttons navigate to the relevant case or review target (FB-02)
- [ ] **UX-02**: Home "Jump Back In" panel — arrows route to the last-visited view for the patient/case (FB-03)

### Terminology Docs

- [ ] **TERM-01**: `terminology.*` settings keys documented in `docs/Konfiguration.md` (enable/disable, proxy URL, cache TTL)
- [ ] **TERM-02**: `config/settings.yaml` ships with `terminology.*` keys and inline comments

## Backlog (not in v1.10)

### Keycloak

- **KEYCLK-01**: Real Keycloak OIDC redirect flow (needs live Keycloak instance to test; middleware prepared in Phase 6)

## Out of Scope

| Feature | Reason |
|---------|--------|
| KEYCLK-01 Keycloak OIDC redirect | Requires live Keycloak instance; pushed to backlog |
| Self-service password change/reset | Admin sets passwords; self-service deferred to Keycloak integration |
| Database storage | JSON files for v1; API designed for future DB swap |
| Parameter-level exclusion | Only case-level exclusion exists |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SESS-01 | Phase 28 | Complete |
| SESS-02 | Phase 27 | Pending |
| SESS-03 | Phase 27 | Pending |
| SESS-04 | Phase 27 | Pending |
| SESSUI-01 | Phase 28 | Complete |
| SESSUI-02 | Phase 28 | Complete |
| SESSUI-03 | Phase 28 | Complete |
| UX-01 | Phase 29 | Pending |
| UX-02 | Phase 29 | Pending |
| TERM-01 | Phase 30 | Pending |
| TERM-02 | Phase 30 | Pending |

**Coverage:**
- v1.10 requirements: 11 total
- Mapped to phases: 11 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-01*
*Last updated: 2026-05-01 — traceability filled (Phases 27–30)*
