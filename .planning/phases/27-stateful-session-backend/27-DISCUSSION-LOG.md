# Phase 27: Stateful Session Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 27-stateful-session-backend
**Mode:** --auto (all areas auto-resolved with recommended defaults)
**Areas discussed:** Sessions table storage, Reuse detection behavior, Signing-key rotation mechanism, Session cleanup strategy

---

## Sessions Table Storage

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite (new sessions.db) | New `data/sessions.db` via better-sqlite3, WAL mode, mirrors auditDb/dataDb pattern | ✓ |
| SQLite (in existing data.db) | Add sessions table to existing data.db | |
| JSON file | Flat JSON file like users.json | |

**Auto-selected:** SQLite in new `sessions.db`
**Rationale:** Concurrent-safe WAL mode, indexed revocation scans, consistent with existing better-sqlite3 modules. JSON file rejected: concurrent-write unsafe and O(n) revocation. STATE.md note "revisit SQLite at plan time" resolved — SQLite already used, not a new constraint.

---

## Reuse Detection Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Family revocation (RFC 6819) | Revoke all tokens sharing same `sid`, return 401 `token_reused` | ✓ |
| Silent rotation | Issue new token, silently invalidate old — no error on reuse | |
| Single-token revocation | Only revoke the specific reused token, not the family | |

**Auto-selected:** Family revocation (RFC 6819 §5.2.2.3)
**Rationale:** Detects theft — if an attacker replays a rotated token, the server knows the original was stolen. Revoking the entire session family (by `sid`) forces re-login of both parties. The `sid` field already exists in RefreshPayload for this exact purpose.

---

## Signing-Key Rotation Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Dual-key window | New key signs new tokens; old key verifies existing until they expire (max 12h); then old key removed | ✓ |
| Hard cut | Single key rotation; all existing sessions immediately invalid | |
| Grace-period countdown | Old key valid for configurable N hours after rotation trigger | |

**Auto-selected:** Dual-key window
**Rationale:** No forced sign-out — users with valid sessions naturally migrate to new key on next refresh. Hard cut would sign out all users immediately, which is disruptive. 12h absolute cap ensures old key is retired within the same day as rotation.

---

## Session Cleanup Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Startup sweep + periodic 24h | Clean on startup + setInterval every 24h (same as auditDb pattern) | ✓ |
| On-access lazy pruning | Clean expired rows only when they would be touched | |
| Manual / never (TTL-based) | Rely on expiry column, never delete | |

**Auto-selected:** Startup sweep + periodic 24h
**Rationale:** Mirrors `auditDb`'s existing purge lifecycle. Bounded table size. No background-timer complexity beyond what already exists.

---

## Claude's Discretion

- Key file naming (`jwt-secret-prev.txt`, `jwt-secret-next.txt`)
- `sessionsDb.ts` API style (plain functions, module-level singleton — mirrors auditDb)
- Error message text for token reuse (consistent with existing 401 patterns)

## Deferred Ideas

- Device fingerprinting in sessions table → backlog
- `GET/DELETE /api/auth/sessions` endpoints → Phase 28
- SESS-01 force sign-out → Phase 28
- Key rotation webhook → backlog
