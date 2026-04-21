---
phase: 17
slug: audit-log-upgrade-dark-mode
status: verified
threats_open: 0
asvs_level: L1
created: 2026-04-21
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| HTTP client → Express `/api/audit` | Untrusted query-string input crosses here; validated before reaching DB | Filter params (action_category, body_search, status_gte, user) |
| Express handler → better-sqlite3 | Named parameter binding is the SQL injection barrier | AuditFilters object with bound params |
| Non-admin user → audit scope | Must only see own entries regardless of query params | User-scoped audit rows |
| `localStorage` → FOUC script | User can write any string to `emd-theme` via DevTools | Theme preference string |
| `localStorage` → ThemeContext | readStored() consumers validate against enum | Theme preference string |
| System media query → ThemeContext | Browser-controlled — no user input | OS dark/light preference |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-17-W0-01 | Tampering | Test data seeding | accept | In-memory SQLite in tests — isolated from production audit.db by design | closed |
| T-17-01 | Tampering | `action_category` query param | mitigate | `VALID_CATEGORIES` allowlist in `server/auditApi.ts:53-59`; `buildWhereClause` switch emits hardcoded SQL path literals per branch — no user string reaches SQL (`server/auditDb.ts:272-287`) | closed |
| T-17-02 | Tampering | `status_gte` query param | mitigate | `Number()` + `Number.isNaN()` + `Number.isFinite()` guard at `server/auditApi.ts:66-72`; NaN/Infinity dropped silently | closed |
| T-17-03 | Tampering | `emd-theme` localStorage read | mitigate | Strict `===` on three allowed literals in `ThemeContext.tsx:18` and `index.html:11-12`; `classList.add('dark')` is a hardcoded literal never derived from storage value | closed |
| T-17-04 | Tampering | `body_search` query param | mitigate | Empty string rejected (`auditApi.ts:61-64`); named param `@filterBodySearch` bound in `auditDb.ts:288-291`; `%` wildcards added server-side, not in SQL template | closed |
| T-17-05 | Elevation of Privilege | Non-admin bypass via `?user=` | mitigate | Auto-scope at `auditApi.ts:76-78` overwrites `filters.user` with `req.auth!.preferred_username` unconditionally after all param parsing | closed |
| T-17-06 | Information Disclosure | `body_search` could reveal PII in audit bodies | accept | Audit bodies are admin-viewable PII by design; endpoint is admin-only; researchers auto-scoped to own entries; no new surface created | closed |
| T-17-07 | Tampering | FOUC inline script XSS surface | mitigate | `index.html:10-15` — localStorage value used only in `===` comparisons; never reaches `innerHTML`, `eval`, or any DOM sink; IIFE scope prevents global pollution | closed |
| T-17-08 | Denial of Service | localStorage unavailable (private mode) | accept | `try/catch` wraps FOUC block (`index.html:10,15`) and `readStored()` in `ThemeContext.tsx:16-19`; `setTheme` write also wrapped (`ThemeContext.tsx:51`); both paths fall back silently to light mode | closed |
| T-17-09 | Tampering | Non-admin accessing user dropdown | mitigate | `isAdmin` guard at `AuditPage.tsx:185` hides user `<select>` in UI; server auto-scope at `auditApi.ts:76-78` is authoritative regardless of UI state | closed |
| T-17-10 | Tampering | Debounced filter input fires request with arbitrary query string | mitigate | All three new params individually validated in `auditApi.ts:53-72` on every request; client is fully untrusted | closed |
| T-17-11 | Information Disclosure | Chart hex colors via useTheme | accept | Static compile-time constants; no user data path; hex values are public design tokens | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-17-01 | T-17-W0-01 | Test isolation by architecture (in-memory SQLite) | gsd-security-auditor | 2026-04-21 |
| AR-17-02 | T-17-06 | body_search on admin-only endpoint; audit bodies already admin-readable | gsd-security-auditor | 2026-04-21 |
| AR-17-03 | T-17-08 | Private-mode fallback to light is intentional UX; no data loss | gsd-security-auditor | 2026-04-21 |
| AR-17-04 | T-17-11 | Static hex design tokens expose no user data | gsd-security-auditor | 2026-04-21 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-21 | 11 | 11 | 0 | gsd-security-auditor (sonnet) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-21
