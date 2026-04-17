# Phase 11: Audit Beacon PII Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 11-audit-beacon-pii-hardening
**Areas discussed:** Transport mechanism, Hash primitive & salt, filter param treatment, Existing audit rows, Beacon style, Hash length, Audit write path

---

## Gray Area Selection

User was presented all four core gray areas (Transport, Hash primitive, filter treatment, Existing rows) and signaled "No preference" — interpreted as "drive forward with your recommendations" rather than "skip the phase." Proceeded to single-batch question set covering all four, then a follow-up batch covering three implementation ambiguities.

---

## Transport mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| POST with JSON body | Switch to POST, body carries `{name, cohortId?, filter?}`, server hashes before writing. Middleware body-redaction applies per D-11. | ✓ |
| GET with X-Audit-Cohort header | Custom header route; header still in access logs unless filtered. More middleware surgery. | |
| GET with client-computed hash | Client fetches salt, hashes client-side. Leaks salt to browser bundle. | |

**User's choice:** POST with JSON body (recommended)
**Notes:** Aligns with security-first rule — no client trust, no client-held secret.

---

## Hash primitive & salt

| Option | Description | Selected |
|--------|-------------|----------|
| HMAC-SHA256 with settings.yaml secret | Strongest primitive, secret server-side only, reusable for AGG-05. | ✓ |
| Plain SHA-256 (no salt) | Stateless, no secret to manage; weaker against targeted attacks. | |
| SHA-256 with per-project salt | Middle ground — not true HMAC construction. | |

**User's choice:** HMAC-SHA256 with settings.yaml secret (recommended)
**Notes:** settings.yaml is the project's single config source per the "Config in settings.yaml" rule.

---

## filter param treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Move to body + keep raw | `filter` is ad-hoc criteria, not identifier. Body redaction by middleware per D-11. | ✓ |
| Hash the filter too | Symmetric with cohortId — but destroys analytical value. | |
| Omit filter entirely | Removes signal analysts use; may violate OUTCOME-11. | |

**User's choice:** Move to body + keep raw (recommended)

---

## Existing audit rows

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is | Append-only audit log (D-13/AUDIT-05) — historical data untouched. | ✓ |
| One-shot migration script | Hash raw cohort ids in place — violates append-only principle. | |
| Redact (null-out raw ids) | Loses fidelity, still mutates audit log. | |

**User's choice:** Leave as-is (recommended)
**Notes:** ROADMAP does not require backfill; append-only preserved.

---

## Beacon style (client)

| Option | Description | Selected |
|--------|-------------|----------|
| fetch with keepalive: true | Works inline in useEffect, testable with MSW/vitest, survives unload. | ✓ |
| navigator.sendBeacon | Purpose-built, takes Blob; harder to test in jsdom. | |

**User's choice:** fetch with keepalive: true (recommended)

---

## Hash length stored in audit_log

| Option | Description | Selected |
|--------|-------------|----------|
| 16 hex chars / 64 bits | Standard audit-hash length, collision-resistant for cohort space, compact. | ✓ |
| Full 64 hex / 256 bits | Overkill for this dataset. | |
| 32 hex chars / 128 bits | Middle ground with no meaningful benefit. | |

**User's choice:** 16 hex chars / 64 bits (recommended)
**Notes:** Reusable unchanged for AGG-05.

---

## Audit write path

| Option | Description | Selected |
|--------|-------------|----------|
| Handler writes its own audit row | Beacon handler computes hash, calls logAuditEntry directly, 204s. Middleware skip-listed. | ✓ |
| Handler mutates req.body pre-middleware | Fragile; depends on middleware ordering. | |
| REDACT_PATHS with [REDACTED] | Loses the hashed reference — breaks Phase 12 reuse. | |

**User's choice:** Handler writes its own audit row (recommended)

---

## Claude's Discretion

Areas the planner decides:
- Exact settings.yaml key name for the HMAC secret
- Exact file path for the hash utility module
- Skip-list mechanism shape in middleware (path constant vs config list)
- Whether to expose a request-level convenience wrapper (`hashCohortIdFromRequest`) for AGG-05 reuse

## Deferred Ideas

- Retroactive migration of existing audit_log rows
- Client-side hashing
- Hashing the filter payload
- sendBeacon adoption
- Full 256-bit hash storage
