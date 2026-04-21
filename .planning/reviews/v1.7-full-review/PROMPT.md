# Full code-quality + security review of EMD app v1.7

You are reviewing the EyeMatics EMD app, a React + Express + SQLite clinical demonstrator.

Working directory: `/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app`
Scope: `src/**`, `server/**`, `.planning/**` (requirements + phase docs).

Review these dimensions. For each finding, give severity (Critical / High / Medium / Low), file:line, problem, and recommended fix:

1. **Consistency** — naming, patterns, conventions across files
2. **Code redundancy** — duplicated logic, copy-paste patterns, near-duplicates ripe for extraction
3. **Security audit** — OWASP Top 10, auth/authz, injection, XSS, CSRF, secrets, rate-limiting, session handling, input validation, audit integrity
4. **Code/doc consistency** — do `.planning/` docs and code comments match actual behavior? Stale claims? Outdated file:line refs?
5. **Comment sufficiency** — are complex sections explained? Are there unexplained invariants, magic numbers, subtle contracts?
6. **Coding style** — TypeScript best practices, error-handling patterns, type-safety gaps (any, unknown misuse, non-null assertions), async correctness
7. **Compactness** — unnecessary abstractions, dead code, bloat, premature generalization
8. **Requirements alignment** — consistency with `.planning/REQUIREMENTS.md` (EMDREQ-*) and `.planning/PROJECT.md` (K01-K11 Lastenheft)

## Output format

Write your findings to the output file as markdown:

```md
# Review: <your-name>

## Critical (N findings)
### F-01 <short title>
- **File:** path/to/file.ts:LINE
- **Problem:** ...
- **Fix:** ...

## High (N findings)
...

## Medium (N findings)
...

## Low (N findings)
...

## Summary
- Top 3 themes
- Most important fix
```

Be specific and cite file:line. Avoid vague platitudes. Focus on issues a future engineer could action.
