# Phase 35: V&V Backfill - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure/process phase — smart-discuss skipped per infrastructure detection)

<domain>
## Phase Boundary

Complete the formal verification and validation paper trail for the v1.10 milestone (Phases 27–31). This phase produces/updates planning artifacts only — it does NOT modify product code. All VERIFICATION code references cite the **`v1.10` git tag** (`b29e892`) so the paper trail is immune to the v1.11 UAT changes (Phases 32–34) and the upcoming Phase 36 compaction (H1).

Scope:
- VVBACK-01: create `.planning/phases/27-stateful-session-backend/27-VERIFICATION.md` (goal-backward analysis of SESS-02/03/04, references at the `v1.10` tag, passing tests).
- VVBACK-02: create `.planning/phases/28-admin-session-control-ui/28-VERIFICATION.md` (goal-backward analysis of SESS-01 + SESSUI-01/02/03, references at the `v1.10` tag, passing tests).
- VVBACK-03: bring Phases 27, 28, and 29 `VALIDATION.md` to `nyquist_compliant: true` and `wave_0_complete: true`; close any coverage gaps with passing tests.
- VVBACK-04: set Phase 31 `VALIDATION.md` `wave_0_complete: true`; set every v1.10 phase (27–31) `VALIDATION.md` to `status: final`.

</domain>

<decisions>
## Implementation Decisions

### Verification Anchoring (H1 — locked by ROADMAP)
- All code references in 27-VERIFICATION.md and 28-VERIFICATION.md cite the `v1.10` git tag (`b29e892`), not current HEAD. Use `git show v1.10:<path>` / `git grep <pattern> v1.10` to locate evidence at the tagged commit.
- This phase verifies v1.10 **as shipped** — it depends on Phase 31 (the v1.10 baseline), NOT on the v1.11 feature phases.

### Document Format
- 27/28-VERIFICATION.md follow the same structure as the existing 29/30/31-VERIFICATION.md files (goal-backward: each success criterion → concrete code reference + passing test).
- VALIDATION.md edits are frontmatter-only flips plus any gap-closure notes; do not restructure the existing bodies.

### Claude's Discretion
All other implementation choices are at Claude's discretion — this is a process/documentation phase fully specified by VVBACK-01..04 and the v1.10 ROADMAP success criteria. Mirror the conventions of the existing VERIFICATION/VALIDATION artifacts in the repo.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Existing VERIFICATION.md exemplars: `.planning/phases/29-home-panel-ux/29-VERIFICATION.md`, `.planning/phases/30-.../30-VERIFICATION.md`, `.planning/phases/31-subcohort-support/31-VERIFICATION.md` — copy their structure.
- Existing VALIDATION.md files for 27/28/29/30/31 already present — only frontmatter needs updating (status/nyquist_compliant/wave_0_complete).
- v1.10 archive: `.planning/milestones/v1.10-ROADMAP.md` documents SESS-01/02/03/04 and SESSUI-01/02/03 requirements and what shipped.

### Established Patterns
- Test suite: `npm run test:ci` (901/901 currently green); session backend tests cover the refresh_sessions table, jti rotation, dual-key signing.
- The `v1.10` tag (`b29e892`) is the authoritative source for code references.

### Integration Points
- `.planning/STATE.md` "Deferred Items" table tracks VVBACK-01..04 — should be marked closed when this phase completes.

</code_context>

<specifics>
## Specific Ideas

Phase 27 (Stateful Session Backend) requirements: SESS-02/03/04 — persistent SQLite `refresh_sessions` table, OAuth2-style jti rotation with RFC 6819 family revocation, dual-key signing-key rotation + `POST /api/auth/rotate-key`.
Phase 28 (Admin Session Control UI) requirements: SESS-01 + SESSUI-01/02/03 — per-user active-session listing, individual + sign-out-everywhere revocation, in-UI TTL config persisted to settings.yaml.

</specifics>

<deferred>
## Deferred Ideas

None — phase scope is fully bounded by VVBACK-01..04.

</deferred>
