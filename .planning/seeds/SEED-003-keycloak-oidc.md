---
id: SEED-003
status: blocked
planted: 2026-05-28
planted_during: v1.12 (Phase 45 close)
trigger_when: when a live Keycloak instance is available OR Milestone 7 (DSF/inter-site auth) is started
scope: large
---

# SEED-003: Real Keycloak OIDC redirect flow (KEYCLK-01) + remove dead Keycloak path (F-03)

## Why This Matters

The app has Keycloak scaffolding but no working OIDC redirect flow — `initAuth` throws for `provider === 'keycloak'`, making the Keycloak runtime branch (`server/keycloakAuth.ts`, `keycloakJwt.ts`, the middleware branch) **unreachable dead code** (CODEX F-03). Both the real flow (KEYCLK-01) and the dead-path cleanup (F-03) are blocked: implementing OIDC needs a live Keycloak instance (gated on M7 / the DSF four-zone inter-site architecture), and removing the scaffolding prematurely would have to be re-added.

## When to Surface

**Trigger:** a live Keycloak/OIDC instance becomes available, or M7 (inter-site auth) kicks off. Until then, leave the scaffolding in place.

## Scope Estimate

**Large.** Full OIDC redirect/callback flow, token exchange, role/center mapping from Keycloak claims, session integration with the existing refresh_sessions table, and then F-03 cleanup of the now-live path. Security-critical.

## Breadcrumbs

- Block point: `server/initAuth.ts` (throws on provider === 'keycloak')
- Dead path: `server/keycloakAuth.ts`, `server/keycloakJwt.ts`, `server/authMiddleware.ts` (keycloak branch)
- KEYCLK-01 history: Out of Scope in REQUIREMENTS.md; STATE.md Open Items (blocked by M7)
- F-03: CODEX v1.11 review, deferred Tier C

## Notes

Two coupled items (KEYCLK-01 build + F-03 cleanup). Status `blocked` — do not start until the M7 dependency clears.
