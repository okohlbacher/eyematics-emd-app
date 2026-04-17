# Project Research Summary

**Project:** EyeMatics EMD v1.7 — Security Hardening, TOTP, OIDC, Cross-Cohort Analytics, Dark Mode
**Domain:** On-premises clinical research dashboard (security extension + analytics upgrade)
**Researched:** 2026-04-17
**Confidence:** HIGH

## Executive Summary

EMD v1.7 is a targeted hardening and analytics extension of a production clinical dashboard. The codebase is mature (Express 5, React 19, TypeScript, better-sqlite3, Recharts v3, Tailwind CSS v4), and research confirms that v1.7 requires only two net-new npm dependencies: `otplib` (RFC 6238 TOTP) and `openid-client` v6 (OIDC/PKCE redirect flow), plus optionally `express-session` for PKCE state storage and `qrcode.react` for enrollment QR display. Every other feature — cross-cohort charting, dark mode, JWT algorithm pinning, cohort hash secret auto-generation, and the O(N+M) patient case refactor — uses only existing dependencies reconfigured or extended.

The recommended build order is security-first: JWT algorithm pinning and cohort hash secret auto-generation are single-file changes with no dependencies and must land before any auth-adjacent work. TOTP follows (closes the most critical security gap), then cross-cohort comparison (highest user value), then audit log filter upgrades, then Keycloak OIDC redirect (needed only for Keycloak deployments, highest integration complexity), with dark mode as the lowest-risk item to defer under time pressure.

The dominant risks are auth-related: TOTP clock skew causing lockouts at hospital sites with poor NTP discipline, algorithm confusion between HS256 local tokens and RS256 Keycloak tokens if the algorithm pin ships late, CSRF in the OIDC redirect flow if state cookie strategy is not decided upfront, and TOTP backward-compatibility if a per-user enrollment flag is not added before the static OTP fallback is removed. All are known patterns with clear mitigations.

## Key Findings

### Stack Additions

Two net-new production dependencies. Everything else is configuration of what already exists.

**New dependencies to add:**
- `otplib@^13.4.0` — RFC 6238 TOTP. TypeScript-native, no native addons, security-audited internals (`@noble/hashes`). Only actively maintained TOTP library for Node (speakeasy abandoned 2019).
- `openid-client@^6.8.3` — OIDC authorization code + PKCE flow. ESM-only (matches project `"type": "module"`), uses Node 20 built-in `fetch` and WebCrypto. `keycloak-connect` is deprecated by Keycloak; manual PKCE is unnecessary complexity.
- `express-session` (optional) — PKCE `code_verifier` + `state` survival across redirect. Alternative: short-lived signed cookie with no new dep.
- `qrcode.react` (client, optional) — QR code rendering for TOTP enrollment. Client-side only; no server round-trip for image generation.

**Configuration-only (no new packages):**
- Cross-cohort chart: Recharts v3 `ComposedChart` child-level `data` prop natively handles multiple independent series. No additional Recharts packages exist.
- Dark mode: Tailwind CSS v4 uses `@custom-variant dark (&:where(.dark, .dark *))` in `src/index.css`. No `tailwind.config.js` exists in this project — the v3 `darkMode: 'class'` key does not apply.
- JWT algorithm pin: `jsonwebtoken@^9.0.3` already supports `{ algorithms: ['HS256'] }`. Missing from two call sites only.

**Critical correction on Tailwind:** The milestone context referenced "Tailwind CSS v3." The installed version is Tailwind CSS v4 (`tailwindcss@^4.2.2`). All dark mode setup uses the CSS-first v4 API.

### Expected Features

**Must have (table stakes):**
- TS-1: TOTP 2FA — replaces site-wide static `otpCode` in `settings.yaml`. Per-user secret, per-user enrollment flow with QR + manual fallback, recovery codes, ±1 window tolerance.
- TS-2: Keycloak OIDC browser redirect — completes the Keycloak auth path. Without it, `provider=keycloak` deployments are non-functional (login returns 405).
- TS-3: Cross-cohort comparison (XCOHORT-01) — overlay up to 4 saved-search cohorts on a single Recharts `ComposedChart`. Saved-search picker, `?cohorts=id1,id2` URL param, 4-color categorical palette, per-cohort N= count in legend.

**Should have (differentiators):**
- D-1: Audit log filter upgrades — user filter, action-type filter, cohort hash filter, status code filter, server-side pagination. Low complexity; extends existing `AuditPage.tsx` and `GET /api/audit`.
- D-2: Dark mode for outcomes charts (VQA-02) — three modes (Light/Dark/System), `ThemeContext`, WCAG-validated `DARK_EYE_COLORS` palette, inline script in `index.html` to prevent FOUC.

**Defer to v1.8+:**
- Keycloak frontend token refresh / Keycloak JS SDK (keep all token handling server-side)
- Cross-cohort with more than 4 cohorts (hard-cap at 4; chart becomes unreadable)
- Dark mode auto-switch by time of day (disorienting during active chart reading)
- Audit log edit or clear (immutability is a compliance requirement)

### Architecture Integration Points and Build Order

All v1.7 changes extend existing module boundaries without introducing new architectural layers. The `AuthPayload` JWT shape is unchanged — the React frontend receives the same token format regardless of auth provider. Cross-cohort comparison is additive: `OutcomesView` gains a second cohort state and `OutcomesPanel` gains optional `overlay` props; no existing code path is broken.

**Strict dependency order within auth:**

```
Phase 1: JWT algorithms pin (authMiddleware.ts + authApi.ts)
         cohortHashSecret auto-generation (hashCohortId.ts)
         O(N+M) patientCases.ts refactor
         -- no dependencies on anything; must precede all auth work --

Phase 2: UserRecord schema (totpSecret, totpEnabled fields)
         → TOTP endpoints (setup, confirm, disable)
         → POST /verify modification (per-user TOTP with static OTP fallback)

Phase 3: OutcomesView second-cohort state (?compare= param)
         → OutcomesPanel overlay prop
         → COHORT_PALETTES in palette.ts

Phase 4: ThemeContext (new)
         → @custom-variant dark in index.css
         → DARK_EYE_COLORS / DARK_SERIES_STYLES in palette.ts
         → OutcomesPanel theme-aware SVG props
         + AuditPage filter upgrades (independent, same phase)

Phase 5: keycloakAuth.ts additions (buildAuthorizationUrl, exchangeCode)
         → keycloakCallbackRouter.ts (new Express routes)
         → LoginPage.tsx Keycloak button
```

**Key component changes:**

| Component | Change Type |
|-----------|-------------|
| `server/authMiddleware.ts` | Add `{ algorithms: ['HS256'] }` to `verifyLocalToken` |
| `server/authApi.ts` | Algorithm pin on challenge-token verify; per-user TOTP check; 3 new TOTP endpoints |
| `server/initAuth.ts` (UserRecord) | Add `totpSecret?: string`, `totpEnabled?: boolean` |
| `server/hashCohortId.ts` | Auto-generate secret to `data/cohort-hash-secret.txt` |
| `server/keycloakCallbackRouter.ts` (new) | `GET /keycloak/login`, `GET /keycloak/callback`, `POST /keycloak/logout` |
| `shared/patientCases.ts` | Replace 5 O(N×M) `.filter()` calls with O(N+M) Map pre-grouping |
| `src/context/ThemeContext.tsx` (new) | Dark/light toggle, localStorage persistence |
| `src/components/outcomes/palette.ts` | Add `DARK_EYE_COLORS`, `DARK_SERIES_STYLES`, `COHORT_PALETTES` |
| `src/components/outcomes/OutcomesPanel.tsx` | Add `overlay?`, `overlayColor?`, `overlayLabel?` props |
| `src/components/outcomes/OutcomesView.tsx` | Add `cohort2`, `aggregate2` state; `?compare=` URL param |
| `src/pages/LoginPage.tsx` | Add "Login with Keycloak" button when `provider === 'keycloak'` |
| `src/index.css` | Add `@custom-variant dark` directive (Tailwind v4) |
| `index.html` | Add inline `<script>` to prevent FOUC on theme load |

### Top 5 Pitfalls

All verified against actual code paths, not generic domain risks.

1. **JWT algorithm pin missing from two call sites** — `verifyLocalToken` in `authMiddleware.ts` and the challenge-token verify in `authApi.ts` both call `jwt.verify()` without `{ algorithms: ['HS256'] }`. This enables algorithm confusion attacks (the Keycloak path is already correctly pinned). One-line fix each; must ship in Phase 1 before any other auth work.

2. **TOTP clock skew causes silent lockouts at hospital sites** — The existing `POST /verify` does a string comparison with zero window tolerance. RFC 6238 requires checking T-1, T, and T+1 (±30 s tolerance). On-premises hospital servers with poor NTP will produce silent lockouts that exhaust the 5-attempt rate limiter. Use `otplib` with `window: 1`; log when T±1 matches but T does not.

3. **OIDC PKCE code_verifier must stay server-side** — Storing the `code_verifier` in `localStorage` exposes it to XSS. The correct approach: browser hits `/api/auth/keycloak/login` → server generates state + verifier → stores in signed HttpOnly cookie → redirects to Keycloak → callback lands at Express → server completes code exchange → issues local JWT. Verifier never touches client JS. Decide this at Phase 5 kickoff, not mid-implementation.

4. **TOTP transition breaks existing 2FA users without backward-compat flag** — Replacing the static `otpCode` check with `authenticator.verify()` without a per-user `totpEnrolled` flag immediately locks out any user who hasn't completed TOTP enrollment. Add `totpEnrolled?: boolean` to `UserRecord` and maintain the static OTP fallback during the transition window.

5. **Recharts SVG elements ignore Tailwind `dark:` classes** — Axis labels, tick text, and grid lines are generated as inline SVG by Recharts. Tailwind class utilities do not apply. Implement a `useTheme()` hook returning explicit color values (`axisTextColor`, `gridColor`) passed as Recharts props, not class strings. Tailwind `dark:` works correctly for the Tooltip container div but not for chart internals.

**Additional pitfalls (Nos. 6–9):**
6. TOTP admin lockout — no recovery path without bcrypt-hashed recovery codes and admin reset endpoint.
7. Recharts legend name collisions in cross-cohort view — prefix all series names with cohort identifier.
8. Dark mode FOUC — add synchronous inline `<script>` in `index.html` before the React bundle.
9. Color exhaustion at 2 cohorts × 3 eyes = 6 series — define `COHORT_PALETTES` array (Cohort B: teal `#0f766e`, orange `#c2410c`, indigo; all verified WCAG 3.0:1+).

## Implications for Roadmap

### Phase 1: Security Quick Wins
**Rationale:** Three independent changes, no dependencies, high confidence, fast. Must land before any auth-adjacent work to close the JWT algorithm confusion window.
**Delivers:** JWT algorithm pinning, cohort hash secret auto-generation, O(N+M) patient case extraction.
**Avoids:** Pitfall 1 (algorithm confusion — prerequisite for Phases 2 and 5).

### Phase 2: TOTP 2FA
**Rationale:** Highest-priority security feature. Self-contained server change. Strict internal dependency order: UserRecord schema → endpoints → /verify modification.
**Delivers:** Per-user TOTP enrollment, QR display, recovery codes, ±1 window tolerance, admin TOTP reset endpoint.
**Uses:** `otplib@^13.4.0` (new dep), existing challenge-token flow.
**Avoids:** Pitfalls 2 (clock skew), 3 (admin lockout), 4 (transition backward compat).

### Phase 3: Cross-Cohort Comparison
**Rationale:** Highest user value in v1.7. Purely additive to outcomes view. No auth dependencies.
**Delivers:** Second-cohort state in `OutcomesView`, `OutcomesPanel` overlay prop, `?cohorts=` URL param, `COHORT_PALETTES`, per-cohort N= legend, CSV export with cohort column.
**Uses:** Recharts `ComposedChart` child-level `data` prop (no new packages).
**Avoids:** Pitfalls 7 (legend collisions), 9 (memory spike — sequential aggregation), cross-cohort color exhaustion.

### Phase 4: Audit Log Upgrades + Dark Mode
**Rationale:** Both bounded to existing components. Audit upgrades (D-1) are low complexity. Dark mode (D-2) is cross-cutting frontend but self-contained. Dark mode is the lowest-risk item to cut if time runs short.
**Delivers:** Audit user/action/status filters + pagination, `ThemeContext`, `DARK_EYE_COLORS`, `@custom-variant dark`, FOUC prevention script.
**Avoids:** Pitfalls 5 (Recharts SVG styling), 11 (WCAG palette failures), 13 (FOUC).

### Phase 5: Keycloak OIDC Redirect Flow
**Rationale:** Required only for Keycloak-mode deployments. Highest integration complexity. Cannot be E2E tested without a live Keycloak realm. Schedule last to avoid blocking on external infrastructure.
**Delivers:** `server/keycloakCallbackRouter.ts`, PKCE state via signed cookie, local JWT from Keycloak claims, "Login with Keycloak" button.
**Uses:** `openid-client@^6.8.3` (new dep), existing `keycloakAuth.ts` JWKS validation.
**Avoids:** Pitfalls 5 (OIDC CSRF), 6 (PKCE client-side storage), 7 (session fixation), 8 (algorithm confusion — already closed in Phase 1).
**Flag:** E2E testing deferred pending live Keycloak instance.

### Research Flags

Needs deeper investigation during planning:
- **Phase 5 (Keycloak OIDC):** Cannot E2E test without live Keycloak realm. Clarify exact `redirect_uri` registration format and confirm `express-session` vs signed cookie decision before implementation starts.
- **Phase 4 (Dark mode palette):** WCAG AA verification of `DARK_EYE_COLORS` against `#111827` is a required manual QA step. Wire the existing `computeContrastRatio` function in `palette.ts` into a test fixture at phase start.

Standard patterns (skip research-phase):
- **Phase 1:** All three changes are single-file with no ambiguity. JWT option is in jsonwebtoken v9 docs. Hash secret auto-generation follows the exact `jwt-secret.txt` pattern already in `initAuth.ts`.
- **Phase 2:** `otplib` API is straightforward. Enrollment flow follows standard TOTP UX. Recovery codes use bcrypt already in use for passwords.
- **Phase 3:** Recharts child-level `data` prop verified against v3 docs. Architecture file has exact code patterns for `OutcomesView` and `OutcomesPanel`.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against npm registries, official docs, and actual installed package.json versions. Tailwind v4 confirmed from `src/index.css`. |
| Features | HIGH | Derived from production v1.6 code gaps (405 on Keycloak login, static `otpCode`, single-cohort only). No speculation. |
| Architecture | HIGH | Researchers read actual source files with exact line numbers: `authMiddleware.ts`, `authApi.ts`, `initAuth.ts`, `patientCases.ts`, `palette.ts`, `OutcomesPanel.tsx`. |
| Pitfalls | HIGH | All pitfalls verified against actual code paths. CVE class, WCAG ratios, and Recharts SVG behavior confirmed from primary sources. |

**Overall confidence:** HIGH

### Gaps to Address

- **Keycloak E2E testing:** Plan for Phase 5 should include a staging Keycloak instance or explicitly mark integration tests as deferred to a post-merge verification step.
- **Dark mode palette sign-off:** `DARK_EYE_COLORS` values need manual contrast verification before Phase 4 ships. Add contrast ratio test using existing `computeContrastRatio` at phase start.
- **PKCE state storage decision:** `express-session` vs signed cookie. Both work for single-instance deployments. Decide at Phase 5 kickoff; document in phase context.
- **Cross-cohort server aggregation:** Confirm that two sequential (not `Promise.all`) server aggregate POSTs are acceptable for typical 7-site dataset sizes, or determine whether a combined batch endpoint is needed.

## Sources

### Primary (HIGH confidence — source code read directly)
- `server/authMiddleware.ts`, `server/authApi.ts`, `server/initAuth.ts`, `server/keycloakAuth.ts`
- `shared/patientCases.ts`
- `src/components/outcomes/palette.ts`, `OutcomesPanel.tsx`, `OutcomesView.tsx`
- `config/settings.yaml`, `src/index.css`

### Primary (HIGH confidence — official documentation)
- https://otplib.yeojz.dev/guide/getting-started.html — otplib v13 API
- https://github.com/panva/openid-client — openid-client v6 ESM API and breaking changes
- https://tailwindcss.com/docs/dark-mode — Tailwind CSS v4 `@custom-variant` dark mode
- RFC 6238 — TOTP clock window tolerance specification
- WCAG 2.1 SC 1.4.11 — 3.0:1 graphical contrast threshold

### Secondary (MEDIUM confidence)
- https://www.sourcery.ai/vulnerabilities/jwt-algorithm-confusion — JWT algorithm confusion CVE class
- https://www.stefaanlippens.net/oauth-code-flow-pkce.html — PKCE flow walkthrough
- https://docs.gdc.cancer.gov/Data_Portal/Users_Guide/cohort_comparison/ — Clinical cohort comparison UX reference
- https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/ — Dark mode WCAG

---
*Research completed: 2026-04-17*
*Ready for roadmap: yes*
