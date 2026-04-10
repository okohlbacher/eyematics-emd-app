# Phase 2: Server-Side Auth + Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 02-Server-Side Auth + Audit
**Areas discussed:** Login flow redesign, Audit middleware design

---

## Login Flow Redesign

### 2FA Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Single POST (Recommended) | Send { username, password, otp } in one POST. Server validates all three. | |
| Two-step server flow | Step 1: credentials → challenge token. Step 2: challenge+otp → JWT. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Two-step server flow
**Notes:** More secure — password validated before OTP prompt.

### Token Expiry

| Option | Description | Selected |
|--------|-------------|----------|
| Redirect to login | 401 → clear session → redirect. JWT expiry = inactivity timeout. | ✓ |
| Silent refresh | Short access token + refresh token. Background refresh. | |
| Long-lived token | 24h JWT, rely on inactivity timeout. | |

**User's choice:** Redirect to login
**Notes:** None — simple approach accepted.

### 2FA Config Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Public GET (Recommended) | GET /api/auth/config returns { twoFactorEnabled } without auth. | ✓ |
| Always show OTP | Always show field, server ignores if disabled. | |
| Two-step form | Show credentials first, then conditionally show OTP. | |

**User's choice:** Public GET
**Notes:** None — recommended approach accepted.

---

## Audit Middleware Design

### Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Request-level (Recommended) | Log every API request: method, path, user, timestamp, status. | ✓ |
| Semantic actions only | Only meaningful actions (view patient, flag error). | |
| Both levels | Request-level + semantic in two tables. | |

**User's choice:** Request-level
**Notes:** None — auto-captures everything.

### Client Call Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Delete all client calls | Remove all 15 logAudit() calls. Server middleware handles everything. | ✓ |
| Keep semantic client calls | Redirect logAudit() to server endpoint for richer context. | |
| Hybrid (Recommended) | Server auto-logs requests + handler adds domain context for mutations. | |

**User's choice:** Delete all client calls
**Notes:** Clean separation — zero audit responsibility in React app.

### Body Logging

| Option | Description | Selected |
|--------|-------------|----------|
| Route-specific | Capture body for POST/PUT/DELETE only. GET logs params only. | ✓ |
| Never log bodies | Only method, path, user, status, timestamp. | |
| Always log bodies | Full body for every request. | |

**User's choice:** Route-specific
**Notes:** Mutations need traceability; GET responses would bloat storage.

---

## Claude's Discretion

- Migration order, bcrypt salt rounds, JWT middleware choice, SQLite WAL mode, error response format

## Deferred Ideas

- Token refresh mechanism — redirect to login sufficient for v1
