# Phase 28: Admin Session Control UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 28-admin-session-control-ui
**Mode:** --auto (all gray areas auto-selected, recommended options chosen)
**Areas discussed:** Session Panel Placement, TTL Configuration UI, Session Listing & Columns, Revocation UX

---

## Session Panel Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline accordion per user row in AdminPage | Expand session list under the selected user — no new page, consistent with existing AdminPage user-centric pattern | ✓ |
| Dedicated sessions sub-page | New `/admin/sessions` route with user picker | |
| Modal dialog | Click user → modal shows sessions | |

**User's choice:** Inline accordion per user row in AdminPage (auto-selected — recommended)
**Notes:** Consistent with existing AdminPage structure. No new route needed. User already selected in the page.

---

## TTL Configuration UI

| Option | Description | Selected |
|--------|-------------|----------|
| In SettingsPage auth section | settingsService already wired; refreshTokenTtlMs + refreshAbsoluteCapMs already in settings.yaml | ✓ |
| In AdminPage auth settings card | Co-located with session management | |

**User's choice:** SettingsPage auth section (auto-selected — recommended)
**Notes:** settingsService.ts → PUT /api/settings → settingsApi.ts validation chain already complete. Display in hours for admin readability.

---

## Session Listing & Columns

| Option | Description | Selected |
|--------|-------------|----------|
| Active only (revoked=0, not expired) with key_id/issued_at/last_used_at/expires_at | Matches SESSUI-01 spec; no clutter from dead sessions | ✓ |
| All sessions including revoked/expired | Full audit view in admin panel | |

**User's choice:** Active-only with SESSUI-01 columns (auto-selected — matches requirement exactly)
**Notes:** Revoked/expired sessions have no actionable value in the admin panel. Audit trail for those is in audit.db.

---

## Revocation UX

| Option | Description | Selected |
|--------|-------------|----------|
| No confirmation dialog; row removed on success; sign-out-everywhere shows loading state | Consistent with AdminPage delete-user pattern (no modal); fast UX | ✓ |
| Confirmation dialog for each revoke | Safer for accidental clicks | |

**User's choice:** No confirmation dialog (auto-selected — recommended, consistent with codebase pattern)
**Notes:** Individual revoke: remove row from list immediately. Sign-out-everywhere: button loading state during DELETE call, then list empties.

---

## Claude's Discretion

- Lucide icons: `ChevronDown`/`ChevronUp` for session accordion toggle
- Loading pattern: reuse `Loader2` spinner (already in AdminPage imports)
- i18n key naming: camelCase convention, ~10 new keys
- Device column display: "Key: {last-8-chars-of-key_id}"

## Deferred Ideas

- Device fingerprinting (User-Agent) — out of v1.10 scope
- Key rotation UI — endpoint exists but not in Phase 28 requirements
- Session pagination — not needed for clinical demo scale
- USM-006/USM-008 feedback backlog items — deferred
