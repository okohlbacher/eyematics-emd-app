# Feature Landscape: EyeMatics EMD v1.7

**Domain:** Clinical research dashboard — security hardening + analytics extension
**Researched:** 2026-04-17
**Scope:** NEW features only. Existing v1.6 infrastructure is baseline, not re-researched.

---

## Baseline (v1.6 — DO NOT re-implement)

Already shipped and in-production:
- JWT HS256 auth + bcrypt passwords + rate limiting with exponential backoff
- 2FA challenge token flow — but OTP is a **fixed static code** from `settings.yaml`
- Keycloak JWKS validation middleware (`keycloakAuth.ts`) — but **no browser redirect flow**
- Audit log: SQLite via better-sqlite3, auto-logged by middleware, immutable from UI
- Audit UI (`AuditPage.tsx`): time-range filter (today/7d/30d/all), CSV + JSON export, action semantic labeling
- Four outcome metrics (Visus, CRT, Interval, Responder) on Recharts ComposedChart
- OD/OS panels, metric tab strip, `?metric=` deep-link
- WCAG-verified `palette.ts` (light mode only — VQA-02 is explicitly deferred)

---

## Table Stakes

Features that v1.7 must ship. Missing = milestone incomplete.

### TS-1: TOTP 2FA (replaces static OTP)

**Why expected:** The static shared OTP code (`otpCode` in `settings.yaml`) is a known security gap — a single value leaked from config compromises all accounts simultaneously. Real TOTP (RFC 6238) generates per-user, per-30-second codes from a per-user secret. Any clinical system with 2FA should use real TOTP.

**How it works (standard UX flow):**

1. **Admin enables TOTP globally** (or per-user) — switches the `twoFactorEnabled` path in `authApi.ts` from static-OTP to TOTP mode.
2. **Enrollment (per user, first login or Settings page):**
   - Server calls `authenticator.generateSecret()` (otplib) and stores the **unactivated** secret on the user record.
   - Server returns an `otpauth://totp/<label>?secret=<base32>&issuer=EyeMatics` URI.
   - Client renders a QR code (client-side, e.g. `qrcode.react`) from that URI — **no image data round-trips the server**.
   - User scans with Google Authenticator / Aegis / Microsoft Authenticator.
   - User enters the 6-digit code currently shown in the app to **confirm enrollment**.
   - Server verifies with `authenticator.check(token, secret)` — only then persists the secret as active.
   - Server generates 8–10 single-use recovery codes (random hex, bcrypt-hashed server-side) and returns them once, plaintext, to the client.
   - Client shows recovery codes in a copy-able display with a "I have saved these" confirmation gate.
3. **Login (daily use):**
   - Step 1 unchanged: POST /login → `{ challengeToken }` (2-min JWT, same as today).
   - Step 2: POST /verify → accepts 6-digit TOTP (or 8-char recovery code) instead of static `otpCode`.
   - Server validates with `authenticator.check(token, userRecord.totpSecret)` + ±1 window tolerance (clock drift).
4. **Recovery code redemption:** burn used code from the list server-side. No re-use.

**Key UX rules for clinical context:**
- Display a manual-entry fallback (the base32 secret) below the QR code — scanners sometimes fail in clinical lighting.
- Never log the TOTP secret or recovery codes in the audit trail.
- Enrollment must be confirmed with a valid code before the secret is saved (prevents abandoned enrollments leaving the account in a broken state).
- Show remaining count of recovery codes in Settings ("3 recovery codes remaining").

**Complexity:** Medium. Server: add `totpSecret` + `recoveryCodes` fields to `UserRecord`, new `/api/auth/totp/setup` endpoint, modify `/verify`. Client: new TOTP enrollment modal, `qrcode.react` dependency, recovery code display.

**Dependencies on v1.6:** Extends existing challenge-token flow in `authApi.ts`. `twoFactorEnabled` config flag reused. Rate limiting already shared between `/login` and `/verify`.

**Library recommendation:** `otplib` (npm, actively maintained, RFC 6238 compliant). **Not** `speakeasy` (7 years unmaintained). QR display: `qrcode.react` (client-side rendering only, no server QR generation needed).

---

### TS-2: Keycloak OIDC Browser Redirect Flow

**Why expected:** `keycloakAuth.ts` already validates Keycloak-issued JWTs. But the browser redirect handoff — the part that actually gets a Keycloak token into the user's browser — is missing. In Keycloak mode, `/login` already returns 405. This leaves the system non-functional when `auth.provider=keycloak`. Completing the flow is required for Keycloak deployments.

**How authorization code + PKCE flow works (browser → Express → Keycloak):**

1. User hits protected route → no session → React redirects to Express `/auth/login`.
2. Express generates `code_verifier` (32 random bytes, base64url), `code_challenge = SHA256(code_verifier)`, stores `code_verifier` in a server-side session (express-session + memory or file store).
3. Express redirects browser to Keycloak authorization endpoint:
   `GET {keycloak}/realms/{realm}/protocol/openid-connect/auth?response_type=code&client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=...`
4. Keycloak shows its own login page (no EMD login page shown to user).
5. After user authenticates on Keycloak → Keycloak redirects to Express callback URL with `?code=...&state=...`.
6. Express verifies `state` matches session, exchanges code for tokens:
   `POST {keycloak}/realms/{realm}/protocol/openid-connect/token` with `code_verifier`.
7. Keycloak returns `access_token` (JWT), `refresh_token`, `id_token`.
8. Express validates the `access_token` via existing JWKS client (already implemented in `keycloakAuth.ts`).
9. Express issues its own HS256 session JWT (same `AuthPayload` shape as local auth) → sets as HttpOnly cookie or redirects to frontend with token.
10. Frontend receives token — same React session flow as local login. No difference downstream.

**Session handoff options:**
- **Option A (recommended for this app):** Express issues its own short-lived JWT from the Keycloak claims, redirects browser to `/#token=<jwt>` or sets an HttpOnly cookie. Frontend picks up token and proceeds normally. Clean — frontend doesn't need the Keycloak SDK.
- **Option B:** Pass Keycloak `access_token` directly. Requires frontend to handle Keycloak token refresh, adds Keycloak SDK dependency. Overkill for this architecture.

**UX from user's perspective:** Click login → redirected to Keycloak → enter credentials there → redirected back to EMD dashboard. Seamless. No EMD login form shown in Keycloak mode.

**Complexity:** Medium-high. New Express routes: `GET /auth/login` (redirect generator), `GET /auth/callback` (code exchange). Requires `express-session` (or equivalent state storage) for `code_verifier` + `state`. Frontend: detect Keycloak mode from `/api/auth/config` and redirect to `/auth/login` instead of showing login form.

**Dependencies on v1.6:** `keycloakAuth.ts` (JWKS client) already handles token validation. `authApi.ts` already blocks local login in Keycloak mode. `AuthContext.tsx` needs minimal change — just redirect on `provider=keycloak`.

---

### TS-3: Cross-Cohort Comparison (XCOHORT-01)

**Why expected:** The single-cohort trajectory view is complete. The natural research question is "does cohort A respond better than cohort B?" — comparing AMD vs DME, Aachen vs Dresden, pre-2022 vs post-2022 injections. This is the primary analytical upgrade in v1.7.

**How users select cohorts for comparison:**

Three established patterns in clinical analytics:
1. **Saved search picker (recommended for EMD):** A multi-select dropdown or chip group pulls from `savedSearches`. User checks 2–4 cohorts to overlay. Most natural given EMD already has saved-search infrastructure.
2. **"Compare" button on saved search list:** User selects two saved searches and presses "Compare" → navigates to comparison view.
3. **URL-param driven:** `?cohorts=id1,id2,id3` — enables shareable comparison links.

**Recommended UX for EMD:** Saved-search picker with a maximum of 4 cohorts (beyond 4, lines become unreadable). Show a "Max 4 cohorts" message when the limit is hit.

**Chart overlapping patterns (Recharts ComposedChart):**

| Pattern | When to use | Verdict for EMD |
|---------|-------------|-----------------|
| Overlay on single chart | 2–4 cohorts, same y-axis scale | **Recommended** — direct comparison |
| Small multiples (N panels) | More than 4 cohorts, heterogeneous scales | Avoid for v1.7 — too many panels |
| Dual-axis overlay | Different y-scales (e.g. visus + CRT) | Not applicable — cross-cohort stays same metric |

**Color coding:** Each cohort gets a distinct color from a categorical palette. EMD already has `palette.ts` for OD/OS colors — add a 4-color cohort categorical palette (blue, orange, green, purple) that passes WCAG against both white and dark backgrounds. Do not reuse OD/OS colors.

**Legend:** Place a horizontal legend above the chart showing `[color swatch] [cohort name] (N=X patients)`. Use Recharts `<Legend>` with custom renderer. The `N=X` patient count is critical for clinical interpretation.

**Tooltip on hover:** Show all cohort values at the same x-position (same day-since-baseline or treatment index). Recharts shared `<Tooltip>` handles this automatically when all series are on the same ComposedChart.

**Layer controls:** For cross-cohort view, show median lines only by default (suppress per-patient and scatter — too cluttered with multiple cohorts). Allow toggling IQR bands per cohort via the existing settings drawer.

**URL pattern:** Extend existing `?cohort=id` to `?cohorts=id1,id2,id3` (pluralized, comma-separated). Single-cohort view retains `?cohort=id` for backward compatibility.

**Complexity:** High. New component: `CrossCohortView.tsx`. Recharts overlay of N median series. Cohort resolution for each ID. `?cohorts=` URL param parsing. New 4-color palette. Summary cards showing per-cohort counts. CSV export with cohort column. Potential server-side aggregation for large multi-cohort requests.

**Dependencies on v1.6:** `OutcomesView.tsx` pattern to follow. `computeCohortTrajectory` in `shared/` reused per cohort. `savedSearches` from DataContext. Existing `?metric=` tab strip — cross-cohort applies to all four metrics. `postAggregate` endpoint may need a `cohortIds[]` batch variant.

---

## Differentiators

Features that add value beyond table stakes. Prioritized but deferrable under time pressure.

### D-1: Audit Log Visual Dashboard (admin-only)

**Current state:** `AuditPage.tsx` exists and works — table with time filter, CSV/JSON export, semantic action labels. It already covers the core audit obligation.

**What's missing for v1.7 (upgrade, not replacement):**
- **User filter:** Currently all-users view. Add a `<select>` to filter by username. Clinical admins routinely ask "what did user X do?".
- **Action type filter:** Group the semantic action labels into categories (Auth, Data Access, Administration, Outcomes) and let admin filter by category.
- **Cohort hash filter:** Audit events for `POST /api/outcomes/aggregate` include the HMAC-SHA256 cohort hash (v1.6 CRREV-01). Expose a text-search field to find all audit events for a specific cohort hash.
- **Status code filter:** Currently shows all statuses. Add filter for failures only (4xx/5xx) — useful for security review.
- **Pagination:** Current implementation fetches 500 rows client-side. At scale (retention = 90 days, busy instance), this grows. Add server-side `limit`/`offset` with simple prev/next navigation.
- **Summary row counts:** Show "N events matching filters" prominently, updating reactively.

**Columns to keep (already present):** Timestamp, User, Action (semantic), Detail, HTTP Status.
**Columns to add:** None — keep the table lean. Action detail field already handles the narrative.

**Export behavior:** Export should respect currently active filters (currently it does for CSV on client-side filtered data; JSON export fetches full log from server regardless — document this distinction).

**Complexity:** Low-medium. Mostly adding filter `<select>` elements and wiring to the existing `filteredEntries` memo. Pagination requires a new server query parameter on `GET /api/audit?user=X&action=Y&status=4xx`.

**Dependencies on v1.6:** `AuditPage.tsx` and `GET /api/audit` endpoint are the base. The audit SQLite schema already has `user`, `method`, `path`, `status` columns — all filterable with simple SQL WHERE clauses.

---

### D-2: Dark Mode for Outcomes Charts (VQA-02)

**Current state:** The codebase is Tailwind CSS. There is no dark mode infrastructure — no `dark:` classes, no `prefers-color-scheme` handling, no `ThemeContext`. `palette.ts` was validated for WCAG against white backgrounds only.

**UX recommendation for clinical dashboard:**
- Provide three modes: Light / Dark / System. Default to System. Store preference in `localStorage` (not server — it's a UI preference, not user data).
- Manual toggle placed in the top-right header (Layout.tsx) as an icon button — sun/moon icon. Secondary exposure in `SettingsPage.tsx`.
- Do **not** auto-switch during an active session based on time — sudden theme change during chart reading is disorienting in clinical use. Only change when user explicitly switches or system changes and the app is relaunched.
- Apply via `class="dark"` on `<html>` element (Tailwind dark mode via `darkMode: 'class'` in `tailwind.config.js`).

**WCAG requirements for dark mode outcomes palette:**
- Text on dark background: minimum 4.5:1 contrast ratio.
- Chart lines: minimum 3:1 against the chart background.
- The existing WCAG-validated `EYE_COLORS` in `palette.ts` need dark-mode variants validated separately. Orange and green typically pass; some blues need to be lightened on dark backgrounds.
- IQR bands (semi-transparent) need explicit dark-mode opacity adjustments — `rgba(r,g,b,0.15)` on dark backgrounds often disappears.

**Implementation approach:** Extend `palette.ts` with `EYE_COLORS_DARK` variants. OutcomesPanel and OutcomesView select the palette via a theme hook. All chart containers need `dark:bg-gray-900` equivalents in Tailwind.

**Complexity:** Medium. The Tailwind infrastructure addition (one config line + `ThemeContext`) is simple. The hard work is auditing all Tailwind classes in outcomes components for `dark:` variants and re-validating the chart color palette against dark backgrounds.

**Dependencies on v1.6:** `palette.ts` (must add dark variants without breaking existing light-mode tests). VQA-02 is explicitly called out as deferred from v1.6 precisely because no dark mode infrastructure exists.

---

## Anti-Features

Features to explicitly NOT build in v1.7.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Keycloak token refresh in the React frontend | Adds Keycloak JS SDK dependency; frontend should not know about Keycloak internals | Express handles token refresh server-side; issues fresh EMD JWT |
| TOTP for service/API accounts | API accounts authenticate via long-lived tokens or mTLS, not TOTP | Keep TOTP for human login flows only |
| Cross-cohort comparison with >4 cohorts | Chart becomes unreadable; cognitive overload for clinical users | Hard-cap at 4; direct users to filter further |
| Dark mode auto-switch based on time of day | Disorienting during active chart reading in clinical context | System preference + manual toggle only |
| Audit log edit or clear button | Audit immutability is a compliance requirement (established in v1.1) | Read-only always; export allows offline archival |
| Per-user TOTP management UI for non-admins | Out of scope; keep admin-centric user management | Admin enables/disables TOTP globally via settings.yaml; users enroll themselves but cannot disable |
| Real-time audit log auto-refresh | Complexity not justified; admins review retrospectively | Manual reload or "Refresh" button |

---

## Feature Dependencies

```
TS-1 (TOTP)
  → extends authApi.ts /verify endpoint (v1.6)
  → extends UserRecord type (adds totpSecret, recoveryCodes)
  → new /api/auth/totp/setup endpoint
  → adds qrcode.react to client deps
  → adds otplib to server deps

TS-2 (Keycloak redirect)
  → extends keycloakAuth.ts JWKS validation (v1.6)
  → requires express-session (new dep)
  → new GET /auth/login + GET /auth/callback routes
  → AuthContext.tsx minimal change (redirect on provider=keycloak)
  → NO change to downstream JWT consumer — same AuthPayload shape

TS-3 (Cross-cohort comparison)
  → requires savedSearches from DataContext (v1.6)
  → reuses computeCohortTrajectory from shared/ (v1.6)
  → extends ?metric= URL param pattern (v1.6)
  → extends OutcomesPanel component (new cohort-color prop)
  → may require new POST /api/outcomes/aggregate-batch endpoint
  → must add 4-color categorical palette to palette.ts

D-1 (Audit log upgrade)
  → extends AuditPage.tsx (v1.6)
  → extends GET /api/audit query params on server
  → no schema changes to audit.db (filter by existing columns)

D-2 (Dark mode)
  → requires ThemeContext (new)
  → requires tailwind.config.js darkMode: 'class'
  → extends palette.ts with dark variants
  → touches all outcomes component Tailwind classes
  → must not regress VQA light-mode palette tests
```

---

## MVP Recommendation

Ship in this order:

1. **TS-1 (TOTP)** — Direct security improvement. Self-contained. Does not depend on TS-2 or TS-3. Closes the most significant auth gap.
2. **TS-3 (Cross-cohort comparison)** — The core analytical feature of v1.7. Builds on the most mature part of the codebase (outcomes view). High user value.
3. **D-1 (Audit log upgrade)** — Low complexity. Extends existing page with filters. Completes the admin toolkit.
4. **TS-2 (Keycloak redirect)** — Medium-high complexity. Needed for Keycloak-mode deployments but most installations use local auth. Ship after TOTP and cross-cohort.
5. **D-2 (Dark mode)** — Most touch-points across the codebase. Lowest risk to defer to v1.8 if time runs short.

**Defer if time-constrained:**
- D-2 (Dark mode): VQA-02 is explicitly a deferred item since v1.5. Acceptable to defer again with a documented plan.
- Audit pagination: 500-row fetch is adequate for the current 7-site demo scale.

---

## Sources

Research verified against:
- RFC 6238: https://tools.ietf.org/html/rfc6238
- otplib (npm, active): https://www.npmjs.com/package/otplib
- speakeasy (not recommended — unmaintained): https://github.com/speakeasyjs/speakeasy
- Keycloak OIDC securing apps: https://www.keycloak.org/securing-apps/oidc-layers
- PKCE flow walkthrough: https://www.stefaanlippens.net/oauth-code-flow-pkce.html
- Keycloak + PKCE implementation: https://skycloak.io/blog/keycloak-how-to-create-a-pkce-authorization-flow-client/
- Dark mode WCAG: https://www.smashingmagazine.com/2025/04/inclusive-dark-mode-designing-accessible-dark-themes/
- Dark mode healthcare UX: https://www.influencers-time.com/dark-mode-ux-in-2025-design-tips-for-comfort-and-control/
- GDC cohort comparison UX (clinical reference): https://docs.gdc.cancer.gov/Data_Portal/Users_Guide/cohort_comparison/
- Adobe audit log reference: https://experienceleague.adobe.com/en/docs/analytics-platform/using/cja-privacy/audit-log
