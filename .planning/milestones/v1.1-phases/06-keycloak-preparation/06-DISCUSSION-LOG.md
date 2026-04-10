# Phase 6: Keycloak Preparation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 06-keycloak-preparation
**Areas discussed:** Auth provider switching, LoginPage UI toggle, Documentation scope

---

## Auth Provider Switching

### Provider switch mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Restart required | Server reads auth.provider once at startup. Simple, no runtime complexity. | ✓ |
| Runtime switch | Server watches settings.yaml and switches without restart. More complex. | |
| You decide | Claude picks best approach. | |

**User's choice:** Restart required
**Notes:** None

### Keycloak unreachable fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Fail closed | All auth fails with 503. No silent fallback to local. Secure default. | ✓ |
| Fallback to local | Silently fall back to local HS256 validation. Convenient but risky. | |
| You decide | Claude picks based on security-first principle. | |

**User's choice:** Fail closed
**Notes:** None

### Login endpoint in Keycloak mode

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled (405) | POST /api/auth/login returns 405 in Keycloak mode. | ✓ |
| Keep as emergency fallback | Local login stays active. Convenient but contradicts fail-closed. | |
| You decide | Claude picks based on fail-closed decision. | |

**User's choice:** Disabled in Keycloak mode
**Notes:** None

---

## LoginPage UI Toggle

### Login page display in Keycloak mode

| Option | Description | Selected |
|--------|-------------|----------|
| Keycloak button only | Replace form entirely with single Keycloak button. Clean. | ✓ |
| Both side by side | Show local form AND Keycloak button together. | |
| Conditional swap | Config-driven swap between forms. | |

**User's choice:** Keycloak button only
**Notes:** None

### V1 Keycloak button behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Show info message | Button shows message that redirect flow is not yet implemented. | ✓ |
| Disabled button with tooltip | Grayed out button with hover tooltip. | |
| You decide | Claude picks UX approach. | |

**User's choice:** Show info message
**Notes:** None

### Config delivery to LoginPage

| Option | Description | Selected |
|--------|-------------|----------|
| Extend /api/auth/config | Add provider field to existing config endpoint. Minimal change. | ✓ |
| Separate config endpoint | New GET /api/auth/provider endpoint. | |
| You decide | Claude picks simplest integration. | |

**User's choice:** Extend /api/auth/config
**Notes:** None

---

## Documentation Scope

### Documentation location

| Option | Description | Selected |
|--------|-------------|----------|
| docs/keycloak-setup.md | Standalone markdown in docs/ directory. | ✓ |
| README section | Add section to main README. | |
| You decide | Claude picks location. | |

**User's choice:** docs/keycloak-setup.md
**Notes:** None

### Documentation detail level

| Option | Description | Selected |
|--------|-------------|----------|
| Step-by-step admin guide | Detailed enough for admin to configure from scratch. | ✓ |
| Reference overview | High-level overview with links to Keycloak docs. | |
| You decide | Claude picks appropriate depth. | |

**User's choice:** Step-by-step admin guide
**Notes:** None

---

## Claude's Discretion

- JWKS caching strategy (jwks-rsa configuration)
- Keycloak claim mapping implementation details
- authMiddleware branching implementation (HS256 vs RS256)
- Error message wording for Keycloak-mode responses
- i18n keys for Keycloak UI strings

## Deferred Ideas

- Full OIDC authorization code flow with PKCE — v2 scope
- Token refresh and session management — v2 scope
- docker-compose.yml with pre-configured Keycloak — v2 scope
- Automatic role mapping from Keycloak realm roles — v2 scope
