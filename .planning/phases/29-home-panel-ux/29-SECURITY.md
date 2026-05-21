---
phase: 29
slug: home-panel-ux
status: verified
threats_open: 0
asvs_level: 2
created: 2026-05-21
---

# Phase 29 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Home-panel UX closure (UX-01 deep-link Review buttons; UX-02 client-side recent-activity
store + "Jump Back In"). The dominant security surface is a new shared-device localStorage
persistence layer that holds patient pseudonyms, plus URL-param-seeded filter state.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| signed-in user → browser localStorage | Recent-activity records persisted to a shared-device store | caseId, pseudonym label, app-internal route path (no clinical values/tokens) |
| user A ↔ user B on shared workstation | Two clinicians may use the same browser profile sequentially | prior user's pseudonym trail (must not survive logout/login) |
| tab A ↔ tab B (BroadcastChannel) | Logout in one tab must purge recents across all tabs | session/recent-activity residue |
| URL query string → QualityPage filter state | `?therapy=` / `?status=` read into component state on mount | untrusted attacker/stray-link param values |
| home-panel button → /quality | `canSeeDocQuality` gate removed; CRT Review button now reachable by all authenticated roles | navigation affordance (not data — center-restriction still enforced) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-29-01 | Tampering | tests/recentActivityStore.test.ts | mitigate | Per-username key isolation + silent-failure pinned by test (16/16 green) | closed |
| T-29-02 | Information Disclosure | src/i18n/translations.ts | accept | New keys are static aria-label strings; no patient data/tokens | closed |
| T-29-03 | Information Disclosure | recentActivityStore.ts (cross-user leakage) | mitigate | Per-username key `emd-recent:<username>` via `storageKey()` (recentActivityStore.ts:19); reads scoped per user | closed |
| T-29-04 | Information Disclosure | RecentActivityEntry contents | mitigate | Entry shape limited to id/label(pseudonym, already visible)/sub/path; no clinical values or tokens (recentActivityStore.ts:8-14) | closed |
| T-29-05 | Denial of Service | localStorage.setItem (quota/private mode throw) | mitigate | All localStorage calls try/catch-guarded; degrade to empty state (recentActivityStore.ts:49,62,71,78) | closed |
| T-29-06 | Information Disclosure | residual trail (wired in Plan 04) | transfer | `clearAll()`/`clear()` API provided in Plan 02; logout wiring delivered in Plan 04 — control now fully implemented (see T-29-09/T-29-10) | closed |
| T-29-07 | Tampering | QualityPage URL-param read (V5 Input Validation) | mitigate | Allow-list: therapy ∈ {breaker,interrupter}, status `flagged`→`in_progress`, else `'all'`; no raw param to type-unsafe slot (QualityPage.tsx:93-104) | closed |
| T-29-08 | Elevation of Privilege | data scoping via filter param | accept | Filter only narrows local list; `/quality` is ProtectedRoute and DataContext center-restriction applies before filter — param cannot widen visibility | closed |
| T-29-09 | Information Disclosure | residual patient trail after logout (V3 Session Mgmt) | mitigate | `performLogout` calls `recentActivityStore.clearAll()` before `setUser(null)` (AuthContext.tsx:141→148); also `clearAll()` on both login paths (208,238). **CR-01 upgraded `clear(username)`→`clearAll()`** for full cross-user purge | closed |
| T-29-10 | Information Disclosure | cross-tab logout leaves stale recents (V3) | mitigate | BroadcastChannel `'logout'` handler calls `clearAll()` before token removal (authHeaders.ts:35→36) | closed |
| T-29-11 | Elevation of Privilege | `canSeeDocQuality` gate removal (V4 Access Control) | accept | `/quality` is ProtectedRoute (all authenticated roles); distinct from `/doc-quality` (QualityRoute). QualityPage still enforces center-restriction — button exposes navigation, not new data. See Accepted Risks Log | closed |
| T-29-12 | Information Disclosure | recorded entry contents | mitigate | Recording surfaces store only id/label/sub/path (QualityPage.tsx:117-122, AnalysisPage.tsx:83-88, OutcomesView.tsx:166-171); no clinical values or tokens | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Related code-review fixes (verified present)

- **CR-01** (commit b4bbfa4) — real per-user isolation: `clearAll()` on every logout and login. Strengthens T-29-09.
- **CR-02** (commit 175e011) — `isValidEntry` type guard + same-origin app-relative path check (rejects `//` and `/\`) before `navigate(entry.path)` (recentActivityStore.ts:33-46,55). Hardens T-29-04/T-29-07 (untrusted localStorage → navigation).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-29-01 | T-29-02 | New i18n keys (`reviewTherapyBreakers`, `reviewFlaggedCases`) are static UI aria-label strings — no patient data, tokens, or runtime data flow. | Oliver | 2026-05-21 |
| AR-29-02 | T-29-08 | URL filter param only narrows the locally-rendered case list; `/quality` is ProtectedRoute and DataContext center-restriction is applied independently — a param cannot widen visibility beyond the role's existing access. | Oliver | 2026-05-21 |
| AR-29-03 | T-29-11 | `canSeeDocQuality` gate removed from the LandingPage CRT Review button. The button targets `/quality` (ProtectedRoute, all authenticated roles), which is distinct from `/doc-quality` (QualityRoute, QUALITY_ROLES-gated). QualityPage enforces center-restriction via DataContext, so the button exposes the navigation affordance but grants no data the authenticated role could not already reach. | Oliver | 2026-05-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-21 | 12 | 12 | 0 | gsd-security-auditor (verify) + accepted-risk documentation |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-21
