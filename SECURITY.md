# SECURITY.md — Phase 17: Audit Log Upgrade & Dark Mode

Generated: 2026-04-21
ASVS Level: L1
Phase: 17 — audit-log-upgrade-dark-mode

---

## Threat Verification Summary

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-17-W0-01 | Tampering | accept | CLOSED | In-memory SQLite in tests is isolated from production audit.db; no impl check needed |
| T-17-01 | Tampering | mitigate | CLOSED | server/auditApi.ts:53-59 — VALID_CATEGORIES allowlist + .includes() guard; server/auditDb.ts:272-287 — switch uses hardcoded SQL literals, no user string in SQL |
| T-17-02 | Tampering | mitigate | CLOSED | server/auditApi.ts:66-72 — Number() + Number.isNaN() + Number.isFinite() guards present; NaN/Infinity blocked before assignment |
| T-17-03 | Tampering | mitigate | CLOSED | src/context/ThemeContext.tsx:18 — strict === equality on 'light'/'dark'/'system'; index.html:11-12 — strict === before classList.add('dark') hardcoded literal |
| T-17-04 | Tampering | mitigate | CLOSED | server/auditApi.ts:61-64 — length > 0 guard; server/auditDb.ts:288-291 — named param @filterBodySearch, wildcards added server-side |
| T-17-05 | Elevation of Privilege | mitigate | CLOSED | server/auditApi.ts:76-78 — non-admin auto-scope applied AFTER param parsing, overwrites any ?user= value |
| T-17-06 | Information Disclosure | accept | CLOSED | Audit bodies admin-viewable PII; endpoint is admin-only via auth middleware; no new exposure surface |
| T-17-07 | Tampering | mitigate | CLOSED | index.html:10-15 — localStorage value never written to DOM or eval; only strict equality comparisons; classList.add('dark') is hardcoded literal |
| T-17-08 | Denial of Service | accept | CLOSED | index.html:10,15 — try/catch around all localStorage access; src/context/ThemeContext.tsx:16-19,51 — try/catch in readStored() and setTheme(); both fall back silently to light |
| T-17-09 | Tampering | mitigate | CLOSED | src/pages/AuditPage.tsx:107,185 — isAdmin guard hides user <select>; server/auditApi.ts:76-78 — server auto-scope overrides ?user= for non-admins |
| T-17-10 | Tampering | mitigate | CLOSED | server/auditApi.ts:53-72 — all new params validated server-side (enum allowlist, length check, NaN guard); client untrusted |
| T-17-11 | Information Disclosure | accept | CLOSED | Hex color constants are static; no user data path; no new surface |

---

## Accepted Risks Log

| Threat ID | Accepted Risk | Rationale |
|-----------|---------------|-----------|
| T-17-W0-01 | Test data seeding uses in-memory SQLite | Completely isolated from production audit.db; no shared state possible |
| T-17-06 | body_search can surface PII in audit record bodies | Admin-only endpoint; audit bodies are inherently admin-viewable; no new attack surface introduced |
| T-17-08 | localStorage unavailable in private browsing / sandboxed contexts | try/catch present in both FOUC script and ThemeContext; graceful silent fallback to light mode |
| T-17-11 | Chart hex colors delivered via useTheme hook | Values are static compile-time constants; zero user-data involvement |

---

## Unregistered Threat Flags

None. No threat flags were raised in SUMMARY.md for this phase.

---

## Threats Open

None. All 11 registered threats are CLOSED.

---

## Files Audited

- server/auditApi.ts
- server/auditDb.ts
- src/context/ThemeContext.tsx
- index.html
- src/pages/AuditPage.tsx
- src/components/ThemeToggle.tsx
