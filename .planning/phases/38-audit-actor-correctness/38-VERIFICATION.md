---
phase: 38-audit-actor-correctness
verified: 2026-05-25
status: passed
score: 1/1 must-haves verified
gaps: []
---

# Phase 38 Verification — Audit Actor Correctness

**Goal:** Audit log records unauthenticated/401 requests as `'unauthenticated'` (not `'anonymous'`), preserving immutable historical actors.

## AUDIT-01 — SATISFIED
- No `?? 'anonymous'` actor fallback remains in `server/` (grep: 0).
- `'unauthenticated'` present at 4 sites (auditMiddleware fallback, auditApi view-open, auditDb schema DEFAULT, + comment).
- `auditMiddleware.test.ts` asserts unauth request → actor `'unauthenticated'`; new regression test asserts authenticated request → real `preferred_username` (immutable historical actor preserved; no row rewrite).
- `npm run test:ci`: 902/902 green (+1 vs baseline).

Verified against actual code + live test run.
