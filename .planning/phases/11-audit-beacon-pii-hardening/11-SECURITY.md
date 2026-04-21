---
phase: 11
slug: audit-beacon-pii-hardening
status: verified
threats_open: 0
asvs_level: 2
created: 2026-04-16
---

# Phase 11 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

CRREV-01 closure — eliminate raw cohort identifiers from request URLs and the audit log; store only HMAC-SHA256 hashed cohort IDs; admin-only visibility of the HMAC secret.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `config/settings.yaml` → server process | Startup reads the file once; `audit.cohortHashSecret` lives in memory for the process lifetime. File is outside the webroot. | HMAC secret (64-char string) |
| Server process → `GET /api/settings` | Non-admin GETs receive a stripped projection (via `stripSensitiveAudit`); admin GETs receive the full YAML. | Secret → admin-only, stripped for others |
| Server process → log sinks (console, error stack) | Secret must NEVER be logged, stringified into error messages, or included in stack traces. | Secret (must not cross) |
| Browser → `POST /api/audit/events/view-open` | Untrusted JSON body; `cohortId`, `filter`, `name` originate from the browser. | Cohort id (saved-search id) + filter |
| Handler → `hashCohortId(id)` | Raw id crosses this boundary; the hashed result is what proceeds into persistent storage. | Raw cohort id → hex digest |
| Handler → `logAuditEntry(row)` | Only `{ name, cohortHash, filter }` is serialized into `body`; raw id is dropped here. | Hashed cohort id |
| `auditMiddleware` → `logAuditEntry` | For the beacon path, no crossing — `SKIP_AUDIT_PATHS` short-circuits before body capture. | (none — skip-listed) |
| Browser URL / history → network request | The raw cohort id USED to cross this boundary in the URL; it no longer does. | (none — body only) |
| Client → server auth (cookie via `credentials: 'include'`) | Beacon remains authenticated. | Session cookie |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-11-01 (server middleware) | Info Disclosure | `server/auditMiddleware.ts` + `server/auditApi.ts` POST | mitigate | `SKIP_AUDIT_PATHS` is first statement in `res.on('finish')` — no middleware row; handler serializes only `{name, cohortHash, filter}` | closed |
| T-11-01 (URL variant) | Info Disclosure | legacy `GET /api/audit/events/view-open` | mitigate | GET handler removed; `tests/auditApi.test.ts` asserts HTTP 404 | closed |
| T-11-01 (client) | Info Disclosure | `src/components/outcomes/OutcomesView.tsx` useEffect | mitigate | POST with JSON body + `keepalive: true`; URL literal `/api/audit/events/view-open` — no querystring | closed |
| T-11-02 | Tampering / Info Disclosure | `server/hashCohortId.ts` | mitigate | Deterministic HMAC-SHA256 with persisted secret (`tests/hashCohortId.test.ts` Tests 1 + 7) | closed |
| T-11-03 | DoS / Repudiation | `server/hashCohortId.ts`, `server/index.ts` | mitigate | `initHashCohortId` throws FATAL on missing / too-short secret before `app.listen` (Tests 4 + 5) | closed |
| T-11-04 | Info Disclosure | `server/settingsApi.ts` GET `/api/settings` | mitigate | Non-admin strip list includes `audit.cohortHashSecret`; tested in `tests/settingsApi.test.ts`; UAT Test 4 passed | closed |
| T-11-05 | Info Disclosure | secret value in logs / responses | mitigate | `grep -RE "console.*cohortHashSecret" server/` returns 0; secret bound to module-private `_secret` and never re-emitted; code-review invariant 2 | closed |
| T-11-06 | DoS | `POST /api/audit/events/view-open` oversized body | mitigate | `express.json({ limit: '16kb' })` scoped to the route; 413 on oversized (`tests/auditApi.test.ts`) | closed |
| T-11-07 | Availability | scoped vs. global `express.json()` | accept | Scoped mount preserves raw-stream consumers in `issueApi` / `settingsApi`; accepted risk — see log | closed |
| T-11-08 | Info Disclosure | client beacon `.catch(() => {})` | mitigate | Fire-and-forget swallow; no `console.log`, no rethrow; `tests/OutcomesPage.test.tsx` Test 6c exercises malformed-filter path | closed |
| T-11-09 | Info Disclosure | browser extensions with `webRequest` read | accept | CSP `connectSrc: 'self'` limits destinations; equivalent risk existed pre-phase on GET querystring — see log | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-11-01 | T-11-07 | A global `app.use(express.json())` would consume the raw stream used by `issueApi` and `settingsApi`, breaking those routes. A scoped mount on the beacon path preserves existing raw-stream consumers at the cost of cross-route consistency. Full-suite regression (358/358) verifies no knock-on breakage. | Project owner | 2026-04-16 |
| AR-11-02 | T-11-09 | Browser extensions holding `webRequest` read can observe fetch bodies. This is out of scope for a same-origin first-party analytics beacon; the equivalent exposure existed for the old GET querystring. CSP `connectSrc: 'self'` restricts the destinations a page can reach. | Project owner | 2026-04-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-16 | 11 | 11 | 0 | gsd-security-auditor (agent a7070d29) |

### Audit 2026-04-16 — Verification Result: SECURED

All threats closed with evidence verified in the codebase and test suite:

- **Middleware skip-list placement** — `server/auditMiddleware.ts:128-134` confirms `SKIP_AUDIT_PATHS.has(urlPath)` precedes body capture at line 148.
- **Handler field selection** — `server/auditApi.ts` writes `{ name, cohortHash, filter }` only; negative assertion `tests/auditApi.test.ts:134-159` that body does NOT contain the raw cohort id.
- **Legacy GET removed** — 404 asserted in `tests/auditApi.test.ts:184-188`.
- **Client URL clean** — `src/components/outcomes/OutcomesView.tsx:106-127` uses literal URL + keepalive POST; `tests/OutcomesPage.test.tsx` Test 6 asserts URL has no querystring.
- **HMAC determinism** — `server/hashCohortId.ts:40`; Tests 1 + 7 in `tests/hashCohortId.test.ts`.
- **Fail-fast startup** — `server/hashCohortId.ts:28-32` throws FATAL; wired before `app.listen` at `server/index.ts:264`.
- **Admin-only secret** — `stripSensitiveAudit` helper in `server/settingsApi.ts:38-42`; both admin and non-admin paths covered by `tests/settingsApi.test.ts:76-96`; UAT Test 4 passed.
- **No secret in logs** — grep verification 0 matches.
- **16 kB body cap** — scoped mount + 413 test.
- **Client catch swallow** — Test 6c malformed-filter path passes without throw.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-16
