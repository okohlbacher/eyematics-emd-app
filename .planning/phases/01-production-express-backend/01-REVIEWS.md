---
phase: 1
reviewers: [gpt]
reviewed_at: 2026-04-10
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md]
---

# Cross-AI Plan Review — Phase 1

## GPT Review

**Summary:** Reasonable demonstrator architecture with a clear path from Vite-dev prototype to production Express deployment, but still prototype-grade rather than security-hardened clinical software. Strongest parts are the explicit separation between frontend SPA, backend APIs, and external data sources; the reuse of shared raw Node handlers; and the clear system boundary (research-only, read-only, on-premises).

**Strengths:**
- Clean repo structure separation (components, pages, services, hooks, context, utils, types; backend under server/)
- Handler extraction pattern (issueApiHandler/settingsApiHandler) eliminates duplication between Vite dev and Express prod — lowers long-term maintenance cost
- Dedicated tsconfig.server.json, clear build:all/start scripts, explicit production entry point with route ordering
- System boundary explicitly read-only against repository, no write-back to clinical primary systems
- Proxy target derivation thought through to avoid path confusion
- Threat register identifies spoofing, info disclosure, tampering, DoS risks
- Audit writes server-side only — correct trust boundary

**Concerns:**
- **HIGH: Role model drift** — README describes 6 roles with admin guards, Pflichtenheft describes simplified model with effectively one user role. Architecture and product definition not aligned → source of churn, edge cases, authorization bugs.
- **HIGH: Persistence sprawl** — SQLite for audit, JSON for users/flags, YAML for settings, FHIR bundles or Blaze for clinical data. Pragmatic for MVP but raises migration, backup, validation, and transactional consistency problems over time.
- **HIGH: Compliance gap** — Lastenheft/Pflichtenheft require secure login with OTP, bounded attempts, inactivity logout, timestamped access documentation (all "Must"). Finer audit logging deferred to Phase 2, Keycloak/JWT to Phase 5. Growing gap between formal requirements and architecture maturity.
- **HIGH: Auth prototype in use** — Default login admin/admin2025!/OTP 123456 with Base64 Bearer token, no server-side sessions. Far below acceptable for any environment with real sensitive research data.
- **MEDIUM: Failed login limiting** — Required by Pflichtenheft but planning material doesn't show mature end-state control.
- **MEDIUM: Settings tampering** — "Accepted" in Phase 1, but settings file influences auth provider, data source, FHIR endpoints. Admin-only PUT is not enough.
- **LOW: FHIR proxy rate limiting** — Threat register accepts lack of rate limiting.

**Suggestions:**
1. Unify role and authorization model across README, Pflichtenheft, and implementation
2. Replace prototype auth with hardened identity model sooner than Phase 5
3. Move all mutable server-side state into one persistence strategy
4. Implement detailed server-side audit trail before expanding features further

**Risk Assessment:** MEDIUM-HIGH
- Architecture quality: good for MVP demonstrator, not yet good enough for long-lived multi-site product
- Maintainability: solid foundation, threatened by role-model drift and mixed persistence
- Security: acceptable only for tightly controlled demo/internal research settings

---

## Consensus Summary

### Agreed Strengths
- Handler extraction pattern is clean and avoids duplication
- System boundary (read-only, research-only) is clearly stated
- Server-side audit writes are the correct trust boundary

### Agreed Concerns (Priority Order)
1. Auth hardening (server-side login, JWT, password hashing) must come before feature expansion — addressed in Phase 2 requirements (AUTH-01..09, USER-07..12)
2. Role model inconsistency between docs and implementation — needs alignment
3. Persistence sprawl (SQLite + JSON + YAML) is manageable short-term but should consolidate
4. Compliance gap between Lastenheft/Pflichtenheft "Must" requirements and current implementation maturity

### Already Addressed in Updated Requirements
- Server-side login with bcrypt + JWT (USER-07..09, AUTH-01..09) — Phase 2
- Audit log immutable from UI, server-side only writes (AUDIT-01..10) — Phase 2
- SQLite for audit with 90-day retention (AUDIT-04, AUDIT-08, AUDIT-09) — Phase 2
- Center-based data restriction server-enforced (CENTER-01..09) — Phase 4
- Keycloak preparation with same JWT format (KC-01..05) — Phase 5

### Not Yet Addressed (Backlog Items)
- Role model unification across README, Pflichtenheft, implementation
- Persistence consolidation strategy (long-term: move JSON → SQLite or PostgreSQL)
- Settings file write protection beyond admin-only check
- FHIR proxy rate limiting
- Failed login attempt server-side limiting with lockout
