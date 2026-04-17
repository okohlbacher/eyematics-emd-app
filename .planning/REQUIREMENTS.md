# Requirements: EyeMatics EMD v1.7

**Defined:** 2026-04-17
**Core Value:** Every user sees only authorized data, with tamper-proof audit trail — while `/outcomes` stays fast, visually polished, and useful beyond visus.

## v1.7 Requirements

### Security (SEC)

- [ ] **SEC-01**: JWT algorithm pinned to HS256 on all local token verification call sites (`authMiddleware.ts` verifyLocalToken + `authApi.ts` challenge verify)
- [ ] **SEC-02**: `cohortHashSecret` auto-generated into `data/cohort-hash-secret.txt` on first startup if absent (same pattern as `jwt-secret.txt`); settings fallback removed
- [ ] **SEC-03**: Users with the default migrated password (`changeme2025!`) are forced to change password on first login
- [ ] **SEC-04**: TOTP (RFC 6238) per-user secret replaces site-wide static OTP code; enrollment via QR code display; ±1 window tolerance for clock skew
- [ ] **SEC-05**: TOTP recovery codes generated at enrollment, bcrypt-hashed and stored per user, burned on use

### Performance (PERF)

- [ ] **PERF-01**: `extractPatientCases` in `shared/patientCases.ts` refactored from O(N×M) to O(N+M) via Map pre-grouping of observations/procedures/conditions by subject reference
- [ ] **PERF-02**: FHIR bundle cache (`_bundleCache`) warmed on server startup immediately after databases are initialized, not deferred to first request

### Accessibility (A11Y)

- [ ] **A11Y-01**: All Recharts trajectory chart containers have `aria-label` attributes describing the metric name, eye side, and cohort patient count

### Audit (AUDIT)

- [ ] **AUDIT-01**: Audit log page has filterable controls: user dropdown, action-category filter (Auth / Data / Admin / Outcomes), date-range picker, cohort-hash text search, failures-only toggle

### Cross-Cohort Analysis (XCOHORT)

- [ ] **XCOHORT-01**: User can select up to 4 saved cohorts for overlay comparison on a single trajectory chart
- [ ] **XCOHORT-02**: Cross-cohort view suppresses per-patient lines by default; renders median + IQR band per cohort with a distinct 4-color categorical palette (separate from OD/OS palette)
- [ ] **XCOHORT-03**: Each cohort's legend entry shows patient count `(N=X patients)`
- [ ] **XCOHORT-04**: `?cohorts=id1,id2` deep-link URL parameter encodes cross-cohort view state

### Authentication (KEYCLK)

- [ ] **KEYCLK-01**: Keycloak OIDC authorization-code + PKCE redirect flow; server-mediated callback at `/api/auth/keycloak/callback`; on success issues EMD HS256 JWT with same `AuthPayload` shape as local login (frontend unchanged post-redirect)

### Visual (VIS)

- [ ] **VIS-01**: Dark mode infrastructure: `ThemeContext` with Light / Dark / System options, sun/moon toggle in Layout header, `dark` HTML class applied to `<html>` element
- [ ] **VIS-02**: Outcomes chart palette extended with WCAG-compliant dark-mode color variants (`DARK_EYE_COLORS`) that pass 4.5:1 contrast against the dark background (`#111827`)
- [ ] **VIS-03**: Dark mode preference persisted in `localStorage` across page reloads; system preference respected when set to System
- [ ] **VIS-04**: Individual patient curves rendered at low opacity and desaturated color; median line overplotted with increased stroke weight and full saturation (spaghetti-plot visual hierarchy)

## Future Requirements

### Security

- **SEC-06**: In-memory rate limiter state persisted to SQLite across server restarts (currently resets on restart)
- **SEC-07**: Self-service TOTP disable/re-enrollment from user settings page (currently admin-only)

### Performance

- **PERF-03**: Server-side aggregation batch endpoint for cross-cohort requests (POST multiple cohortIds in one call)

### Visual

- **VIS-05**: Dark mode WCAG verification test for chart palette (automated contrast ratio assertion)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Federated cross-site DSF query (Pattern B) | Requires DSF infrastructure; EMD reads only local repo |
| Mobile app | Web-first; no mobile scope in this project |
| Real-time collaboration | On-premises, single-user session model |
| FHIR write-back | EMD is read-only by design |
| Sub-cohort parameter-level exclusion | Only case-level exclusion in scope |

## Traceability

*Populated by roadmapper — to be filled after roadmap creation.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | — | Pending |
| SEC-02 | — | Pending |
| SEC-03 | — | Pending |
| SEC-04 | — | Pending |
| SEC-05 | — | Pending |
| PERF-01 | — | Pending |
| PERF-02 | — | Pending |
| A11Y-01 | — | Pending |
| AUDIT-01 | — | Pending |
| XCOHORT-01 | — | Pending |
| XCOHORT-02 | — | Pending |
| XCOHORT-03 | — | Pending |
| XCOHORT-04 | — | Pending |
| KEYCLK-01 | — | Pending |
| VIS-01 | — | Pending |
| VIS-02 | — | Pending |
| VIS-03 | — | Pending |
| VIS-04 | — | Pending |

**Coverage:**
- v1.7 requirements: 19 total
- Mapped to phases: 0 (roadmapper pending)
- Unmapped: 19 ⚠️

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 after initial v1.7 definition*
