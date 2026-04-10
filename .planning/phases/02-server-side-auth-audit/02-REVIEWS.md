---
phase: 2
reviewers: [gemini, codex-gpt5.4]
reviewed_at: 2026-04-10
plans_reviewed: [02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md, 02-04-PLAN.md]
---

# Cross-AI Plan Review — Phase 2

## Gemini Review

### Summary
The proposed plans are exceptionally thorough and demonstrate a high level of architectural awareness, particularly regarding the transition from a client-side "demonstrator" model to a more robust "production-lite" server-side architecture. The strategy for JWT-based authentication, two-step 2FA, and tamper-proof SQLite auditing is well-aligned with the project's core value of authorized data access. The plans correctly identify and mitigate several critical pitfalls, such as the express.json() vs. readBody() stream consumption conflict and the potential for challenge token misuse.

### Strengths
- Robust middleware strategy: response-wrapping audit (`res.on('finish')`) captures all API interactions without manual calls
- Secure 2FA: `purpose: 'challenge'` claim prevents challenge token misuse as session token
- Graceful migration: `initAuth` auto-hashes existing users.json records without passwordHash
- Type safety: consistent tsc verification, clear interfaces (AuthPayload, AuditDbRow)
- Strategic cleanup: Plan 04's exhaustive file list ensures no logAudit tech debt remains

### Concerns
- **MEDIUM: 401s might not be audited** — Audit middleware mounted after auth middleware. If authMiddleware sends 401 without calling next(), the audit middleware never fires. Failed authentication attempts could be missing from the audit log.
- **LOW: JWT secret in public/settings.yaml** — Accepted for demonstrator but risky. public/ is typically served to clients.
- **LOW: Sync SQLite performance** — better-sqlite3 is synchronous; audit on every request could add latency. Likely negligible (~0.1ms per write with WAL mode) at expected concurrency.
- **LOW: 10-minute token expiry UX** — Short expiry may cause frequent redirects for active users since no silent refresh is planned.

### Suggestions
1. **Log 401s**: Mount audit middleware BEFORE auth middleware, read `req.auth` at `finish` time (it will be populated by then for authenticated requests, null for 401s). This captures failed auth attempts in the audit log.
2. **Sensitive data masking**: Redact `password` field from req.body before saving to audit when path is `/api/auth/login`.
3. **JWT secret location**: Write jwtSecret to `data/` directory (next to audit.db) instead of `public/settings.yaml` to prevent frontend exposure.
4. **Atomic users.json write**: Use temp file + rename during migration to prevent corruption on crash.

### Risk Assessment: LOW
Plans are highly detailed, address locked decisions accurately, include rigorous verification. Transition broken into logical waves respecting dependencies. Most significant risk (401 logging gap) is easily addressable.

---

---

## Codex (GPT-5.4) Review

### Per-Plan Assessments

**02-01 (Auth Middleware + API): HIGH risk**
- Strengths: Clear separation, bcrypt migration, generic credential errors, challenge token purpose claim, JWT payload Keycloak-compatible
- HIGH: jwtSecret in public/settings.yaml = key disclosure, allows JWT forging
- HIGH: Challenge tokens not explicitly rejected by auth middleware (missing `purpose !== 'challenge'` check)
- HIGH: Public-path matching may fail — `req.path` inside mounted middleware is relative to mount point
- MEDIUM: Failed-login backoff logic underspecified, off-by-one risk
- MEDIUM: OTP verification has no brute-force throttling (only password step is rate-limited)
- MEDIUM: otplib installed but not used — scope creep

**02-02 (Audit SQLite): HIGH risk**
- Strengths: Good separation (DB/middleware/API), WAL mode, indexed schema, res.finish pattern
- HIGH: Body capture will store plaintext passwords and OTPs from auth endpoints unless explicitly redacted
- MEDIUM: GET /api/audit available to any authenticated user — may expose sensitive bodies
- MEDIUM: Pagination total is wrong when limit/offset used
- MEDIUM: Timestamp purge comparison fragile across ISO string formats
- MEDIUM: req.body may not be populated (no global express.json()) — body capture silently fails

**02-03 (Integration): HIGH risk**
- Strengths: Shared authHeaders, async login, backward compat preserved
- HIGH: issueApi.ts and settingsApi.ts not in files_modified but plan says to update them
- HIGH: No global express.json() conflicts with locked decision to capture mutation bodies
- HIGH: 401 redirect behavior deferred, not implemented — phase goal partially unmet
- HIGH: Secrets still in public/settings.yaml
- MEDIUM: Missing bootstrap for absent users.json (only migration described)

**02-04 (Frontend Cleanup): MEDIUM risk**
- Strengths: Concrete file list, read-only auditService, immutability enforced in UI
- MEDIUM: Request-level audit ≠ page-view audit — page navigation without API call produces no audit entry
- MEDIUM: Non-admin users may see sensitive audit bodies if earlier plans don't redact
- LOW: Category filters need validation against actual API route patterns

### Cross-Plan Assessment: HIGH overall

Top cross-plan risks:
1. **HIGH: jwtSecret in public/ config** — breaks JWT trust entirely
2. **HIGH: Audit stores plaintext passwords/OTPs** from auth endpoints
3. **HIGH: Challenge tokens accepted as auth tokens** — missing purpose check
4. **HIGH: Mutation body capture conflicts with no-global-body-parsing** strategy
5. **MEDIUM: Audit read access broader than "authorized data only" principle**

Recommendation: **Do not execute unchanged.** Fix secret storage, add audit redaction rules, resolve body-parsing strategy, tighten auth middleware contract.

---

## Consensus Summary (Gemini + Codex)

### Agreed Strengths (both reviewers)
- Auth middleware architecture with challenge token purpose claim is well-designed
- Audit middleware using res.on('finish') is the correct auto-logging pattern
- users.json migration handles Phase 1 → Phase 2 transition
- Exhaustive logAudit cleanup list prevents leftover tech debt
- Clear separation of concerns across plans

### Agreed Concerns (both reviewers flagged, priority order)
1. **HIGH: jwtSecret in public/settings.yaml** — Both reviewers flagged this as the #1 risk. Fix: write to data/jwt-secret.txt or data/ directory, never to public/.
2. **HIGH: Audit stores plaintext passwords/OTPs** — Both flagged auth body logging. Fix: explicit redaction rules for /api/auth/* paths before audit storage.
3. **HIGH: Challenge tokens accepted as auth tokens** — Codex flagged missing `purpose !== 'challenge'` check in auth middleware. Fix: explicitly reject challenge-purpose JWTs on protected routes.
4. **HIGH: Body capture vs no-global-body-parsing conflict** — Codex flagged that without express.json(), req.body is empty for legacy handlers. Fix: either add global express.json() or implement raw-body capture in audit middleware.
5. **MEDIUM: 401 audit gap** — Gemini flagged failed auth attempts not logged. Fix: mount audit middleware before auth middleware.
6. **MEDIUM: Public-path matching fragility** — Codex flagged req.path is relative when middleware is mounted at prefix. Fix: use req.originalUrl or mount auth routes before middleware.

### Actionable Items for Replanning
1. Move jwtSecret storage to data/jwt-secret.txt (read at startup, auto-generate if absent)
2. Add explicit audit redaction for /api/auth/login (password) and /api/auth/verify (otp, challengeToken) paths
3. Add `purpose !== 'challenge'` check in auth middleware JWT validation
4. Resolve body-parsing: either global express.json() with raw-body passthrough for legacy handlers, or audit middleware captures raw body before parsing
5. Mount audit middleware BEFORE auth middleware
6. Use req.originalUrl for public-path matching in auth middleware
7. Add issueApi.ts and settingsApi.ts to Plan 03 files_modified
8. Implement 401 → redirect in AuthContext (don't defer)
9. Add OTP brute-force throttling (tie to same lockout state as password attempts)
10. Remove otplib dependency (use fixed configurable OTP code per demonstrator decision)
