# Phase 38: Audit Actor Correctness - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning
**Mode:** Auto (decision locked: PROT-001 → `unauthenticated`)

<domain>
## Phase Boundary
Small backend correctness fix (AUDIT-01 / PROT-001). The audit log currently writes actor `'anonymous'` for unauthenticated/401 requests. Relabel these to `'unauthenticated'`, while preserving immutable historical actor identity for entries written by users who were later deleted.
</domain>

<decisions>
## Implementation Decisions
- **Locked (PROT-001):** unauthenticated/401 requests → actor `'unauthenticated'`; NO source IP appended (D-decision 2026-05-25).
- Deleted users: their past audit entries keep the real historical username (audit immutability — do NOT retro-rewrite). Only the *unauthenticated* fallback label changes.
- Sites: `server/auditMiddleware.ts:186` (`?? 'anonymous'` → `?? 'unauthenticated'`) and the comment at :185; `server/auditDb.ts:85` column DEFAULT `'anonymous'` → `'unauthenticated'`.
- Audit immutability and append-only semantics are unchanged (no migration of existing rows; the DEFAULT change only affects future inserts that omit the column).
- ### Claude's Discretion: whether to migrate the SQLite column DEFAULT requires care — changing a column DEFAULT in SQLite needs table rebuild; prefer leaving existing rows untouched and only changing the application-level fallback string, plus the schema DEFAULT for fresh DBs. Confirm no test asserts the literal 'anonymous'.
</decisions>

<code_context>
## Existing Code Insights
- `server/auditMiddleware.ts` builds the audit entry; `req.auth?.preferred_username ?? 'anonymous'` is the only fallback.
- `server/auditDb.ts` schema column `user TEXT NOT NULL DEFAULT 'anonymous'`.
- Tests likely in `tests/` referencing audit; check for assertions on 'anonymous'.
</code_context>

<specifics>
## Specific Ideas
Keep it minimal and behavior-correct: one string change in middleware + schema DEFAULT for new databases; add/extend a test asserting a 401/unauth request produces actor `'unauthenticated'` and that an authenticated request is unaffected.
</specifics>

<deferred>
## Deferred Ideas
Source-IP attribution on unauthenticated entries — explicitly excluded by the locked decision.
</deferred>
