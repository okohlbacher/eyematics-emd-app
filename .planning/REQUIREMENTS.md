# Requirements: EMD v1.10 — Session Hardening & UX Closure

**Defined:** 2026-05-01
**Core Value:** Every user sees only authorized data, with tamper-proof audit trail — while maintaining the zero-friction local development experience.

## v1.10 Requirements

### Session Management

- [x] **SESS-01**: Admin can trigger immediate sign-out of all active sessions for any user
- [x] **SESS-02**: Server maintains a stateful refresh-sessions table (one row per issued refresh token, tracking user, device fingerprint, issued-at, expires-at, revoked flag)
- [x] **SESS-03**: Server rotates refresh tokens on every use (OAuth2-style: previous token invalidated immediately on reuse)
- [x] **SESS-04**: Admin can rotate the refresh-token signing key; existing sessions gracefully expire rather than hard-crashing

### Session UI

- [x] **SESSUI-01**: Admin can view all active sessions per user (device, issued-at, last-used, expires-at)
- [x] **SESSUI-02**: Admin can revoke individual sessions from the session listing UI
- [x] **SESSUI-03**: Admin can configure session TTL values (`refreshTokenTtlMs`, `refreshAbsoluteCapMs`) from the admin UI (writes to settings.yaml)

### UX Fixes

- [x] **UX-01**: Home "Attention needed" panel — Review buttons route to the appropriate pre-filtered review area via a defined query contract (FB-02). *Reworded 2026-05-21: alerts are static, not data-driven; route to review area, not a specific case.*
- [x] **UX-02**: Home "Jump Back In" panel — arrows route to the last-visited view for the patient/case (FB-03). *Requires new client-side recent-activity tracking — none exists today.*

### Terminology Docs

- [x] **TERM-01**: `terminology.*` settings keys documented in `docs/Konfiguration.md` (enable/disable, proxy URL, cache TTL) — satisfied in Phase 25; Phase 30 only fixes the serverUrl default-vs-placeholder wording
- [x] **TERM-02**: `config/settings.yaml` ships with a commented `terminology.*` example block + inline comments (kept commented per D-16/D-17 offline-by-default design)

### Cohort

- [x] **KOH-003**: Users can split any saved cohort into named subcohorts (one level deep) via a `ParentName:SubcohortName` naming convention. A subcohort is an ordinary `SavedSearch` whose name contains exactly one `:`; the name is validated (exactly one colon, non-empty parent and sub identifiers, no duplicate names) and orphan subcohorts (parent name matching no existing cohort) are allowed with a non-blocking warning. *Added 2026-05-21 for Phase 31.*
- [x] **KOH-004**: Subcohorts appear in a tree-grouped picker wherever cohorts are selectable for comparison (`CohortCompareDrawer`): parent rows with indented subcohort rows. Selecting a parent applies the parent's own saved filter (not a union); each parent/subcohort entry is independently selectable and counts individually toward the existing max-4 comparison limit. *Added 2026-05-21 for Phase 31.*

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
| SESS-02 | Phase 27 | Complete |
| SESS-03 | Phase 27 | Complete |
| SESS-04 | Phase 27 | Complete |
| SESSUI-01 | Phase 28 | Complete |
| SESSUI-02 | Phase 28 | Complete |
| SESSUI-03 | Phase 28 | Complete |
| UX-01 | Phase 29 | Complete |
| UX-02 | Phase 29 | Complete |
| TERM-01 | Phase 25 / 30 | Complete (docs shipped in Phase 25) |
| TERM-02 | Phase 30 | Complete (Phase 30) |
| KOH-003 | Phase 31 | Complete |
| KOH-004 | Phase 31 | Complete |

**Coverage:**
- v1.10 requirements: 11 total
- Mapped to phases: 11 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-01*
*Last updated: 2026-05-21 — adversarial review: SESS-02/03/04 marked complete (Phase 27 shipped); UX-01/UX-02/TERM-01/TERM-02 re-scoped per Phases 29 & 30 review.*
