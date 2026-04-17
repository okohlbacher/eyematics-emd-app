---
reviewers: [gemini, codex]
reviewed_at: 2026-04-17T10:30:00Z
scope: full-codebase
version: v1.6
---

# Cross-AI Codebase Review — EyeMatics EMD (v1.6)

## Gemini Review

### 1. Security Findings

**[CRITICAL]** Weak 2FA Implementation (Static Shared Secret)
- File: `config/settings.yaml`, `server/authApi.ts`
- Description: The "Two-Factor Authentication" uses a fixed `otpCode` (default: '123456') defined in `settings.yaml`. This code is shared by all users and remains static unless manually changed in the server configuration. This effectively acts as a second static password rather than a dynamic second factor, providing negligible security improvement over single-factor authentication.
- Recommendation: Replace the static OTP with a standard TOTP (Time-based One-Time Password) implementation (e.g., using `otplib`).

**[HIGH]** Default Sensitive Secrets in Configuration
- File: `config/settings.yaml`
- Description: The `cohortHashSecret` used to anonymize cohort IDs in the audit log has a default "please-replace-in-prod" value in the repository. If not changed in production, the HMAC-SHA256 "anonymization" can be trivially reversed by an attacker with access to the audit log.
- Recommendation: Generate a unique 32-byte hex secret during installation and store it in `data/` (similar to `jwt-secret.txt`) instead of `settings.yaml`.

**[HIGH]** Weak Default Credentials for Migrated Users
- File: `server/initAuth.ts`
- Description: The `_migrateUsersJson` function automatically assigns the default password `changeme2025!` to any user record missing a `passwordHash`. If production users are seeded without explicit password sets, this creates a significant risk.
- Recommendation: Require a password change on first login for any user with the default migrated hash.

**[MEDIUM]** JWT Algorithm Confusion Risk
- File: `server/authMiddleware.ts`
- Description: `verifyLocalToken` calls `jwt.verify(token, getJwtSecret())` without specifying the expected algorithm. While signing uses `HS256`, the verification side should explicitly restrict allowed algorithms to prevent potential "alg: none" or RSA/HMAC confusion attacks.
- Recommendation: Update call to `jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] })`.

**[LOW]** In-Memory Rate Limiting
- File: `server/rateLimiting.ts`
- Description: Rate limiting for login attempts is stored in an in-memory Map. Restarting the server resets all attempt counters, allowing an attacker to bypass lockouts by inducing or waiting for a server restart.
- Recommendation: Persist rate limit state to SQLite `data.db` if survivability against restarts is required.

---

### 2. Architecture Concerns

**[HIGH]** O(N×M) Performance Bottleneck in Data Extraction
- File: `shared/patientCases.ts`
- Description: `extractPatientCases` iterates over all patients and, for each patient, filters the entire list of observations, procedures, and conditions. For 1,000 patients and 20,000 observations this results in 20 million operations, blocking the server for several seconds during cohort resolution.
- Recommendation: Pre-group resources by `subject.reference` into a Map before mapping patients to reduce complexity to O(N + M).

**[MEDIUM]** Cold Cache on Startup
- File: `server/fhirApi.ts`, `server/index.ts`
- Description: The FHIR bundle cache (`_bundleCache`) is only populated on the first request to `/api/fhir/bundles` or `/api/outcomes/aggregate`. The first user after a server restart will experience significant delay (up to 30s if loading from Blaze).
- Recommendation: Trigger `getCachedBundles()` during server startup in `index.ts` after databases are initialized.

---

### 3. Code Quality Issues

**[MEDIUM]** Inconsistent Error Handling in Aggregation
- File: `server/outcomesAggregateApi.ts`
- Description: Several points in the aggregation pipeline return generic 500/502/403 errors. While good for security, it makes debugging in production difficult without access to server logs.
- Recommendation: Ensure all caught errors are logged with high detail (including `cohortId`) to the server console while keeping client responses generic.

**[LOW]** Type Safety: Shared `Measurement` Interface
- File: `shared/cohortTrajectory.ts`
- Description: The `Measurement` interface is visus-centric (`logmar`, `snellenNum`). When computing CRT trajectories, these fields are reused to store µm values or set to 0, which is counter-intuitive for future maintainers.
- Recommendation: Use a Discriminated Union for `Measurement` or separate types for Visus and CRT measurements.

---

### 4. Clinical Correctness

**[MEDIUM]** Deliberate Clamping of Delta Percent
- File: `shared/cohortTrajectory.ts`
- Description: Delta percent changes are clamped to `[-200, 200]`. While this prevents extreme outliers from distorting the interpolation grid, it is an arbitrary threshold that might hide clinically relevant extreme responses.
- Recommendation: Document the clinical rationale for the 200% threshold in architecture.md.

**[LOW]** Treatment Index vs. Baseline Date
- File: `shared/cohortTrajectory.ts`
- Description: `treatmentIndexAt` uses all IVI procedures on or before the observation date. If an IVI occurred before the first visus measurement, the baseline measurement itself might have a non-zero treatment index.
- Recommendation: Verify if the treatment index should be relative to the baseline observation date.

---

### 5. UX / Accessibility

**[MEDIUM]** Missing Accessible Chart Descriptions
- File: `src/components/outcomes/OutcomesPanel.tsx`
- Description: The Recharts `ComposedChart` components lack high-level ARIA labels or descriptions. Screen reader users cannot discern the purpose or content of the charts.
- Recommendation: Add `aria-label` or `aria-describedby` to the chart container, summarizing the cohort size and metric.

**[LOW]** i18n: Hardcoded Credentials in Hint
- File: `src/i18n/translations.ts`
- Description: `loginDemoHint` contains hardcoded credentials. If these change in `settings.yaml`, the hint will be misleading.

---

### Gemini Overall Assessment

**Risk level: HIGH**

The system is architecturally sound and very well-tested (430 passing tests), but the 2FA implementation and default secrets represent significant security risks for a production clinical environment. The O(N×M) performance bottleneck will cause UX issues as the dataset grows.

**Top 3 immediate issues:**
1. Fix 2FA: Move from static `otpCode` to TOTP
2. Optimize data resolution: Refactor `shared/patientCases.ts` to use Maps for O(N+M) complexity
3. Secure secrets: Move `cohortHashSecret` out of repo-tracked `settings.yaml`

**Top 3 next-milestone improvements:**
1. Cache warming on server startup
2. Chart ARIA accessibility
3. Audit log visual dashboard for administrators

---

## Codex Review

> Codex performed a full live codebase exploration (read-only sandbox, gpt-5.4). Reviewed Apr 17, 2026. Session ID: 019d9a7e-99b8-7ed0-b5fd-81b48e0e25ff.

Codex explored the full repository and focused its review on the most recent changes: the Y-axis domain rework in `OutcomesPanel.tsx`. It validated the changes against the shipped synthetic FHIR bundles and the trajectory math in `shared/cohortTrajectory.ts`.

### Clinical Visualization Findings

**[P2]** Absolute visus domain `[0, 1]` clips valid low-acuity data
- File: `src/components/outcomes/OutcomesPanel.tsx` (lines 45–46)
- Description: The new `[0, 1]` absolute visus y-domain clips observations that the existing codebase already generates and supports. The bundle generator (`scripts/generate-center-bundle.ts`) emits visus values down to `0.05` decimal, which converts to logMAR ≈ 1.30. Any patient in this low-vision range — plus their median/IQR aggregate points — will render off-chart in absolute mode.
  - Verified: `center-chemnitz.json` contains `val: 0.05` → `logMAR: 1.301`
- Recommendation: Extend absolute visus domain to `[0, 1.4]` to cover the full supported data range, or make it data-driven with a `[0, 1]` minimum floor. If the admin's intent is to restrict the display to standard IVOM patient range, document this as an intentional clinical scope decision.

**[P2]** Fixed delta visus domain `[-1, 1]` clips legitimate low-baseline trajectories
- File: `src/components/outcomes/OutcomesPanel.tsx` (lines 56–59)
- Description: `buildPatientSeries()` computes raw `logmar - baselineLogmar` deltas without clamping. A patient with baseline decimal acuity `0.05` who improves to `0.5` already has a delta of ≈ 1.0 logMAR, touching the domain edge. Further improvement or worse baselines produce deltas beyond `±1`. Per-patient lines and IQR bands will be truncated in these cases.
  - Verified: `maxDelta` in `center-aachen.json` is 0.627 logMAR (patient `pat-uka-032`, `0.21 → 0.89`), well within `[-1, 1]`. Low-vision outliers (baseline ≤ 0.05) are the risk cases.
- Recommendation: Use data-driven symmetric domain with a minimum of `[-1, 1]`, matching the CRT delta approach. This preserves the admin's intent while not clipping extreme cases.

### Other Findings

No additional security, architecture, or code quality issues were identified beyond those already noted by Gemini. Codex confirmed:
- JWT secret storage in `data/jwt-secret.txt` is correctly isolated from the web root
- Center filtering via JWT `centers` claim is correctly enforced server-side
- Audit log append-only pattern is sound
- The `shared/` module boundary (no imports from `server/` or `src/`) is respected
- 430 passing tests, i18n completeness test in place

### Codex Overall Assessment

**Risk level: MEDIUM** (for the specific Y-axis changes reviewed)

The core security and clinical math are well-implemented. The Y-axis domain change introduces a correctness risk for low-vision patient cohorts in the bundled demo data and any real deployment with patients below 20/200. This should be validated against the admin's clinical intent before shipping.

**Top issue:** Determine whether `[0, 1]` / `[-1, 1]` visus domains are an intentional clinical scope restriction (document it) or an oversight (extend to `[0, 1.4]` / data-driven min `[-1, 1]`).

---

## Consensus Summary

Both reviewers examined the full codebase independently. Key consensus findings:

### Agreed Strengths
- **Excellent test coverage:** 430 tests across 47 files — server auth, middleware, trajectory math, CRT, interval, responder all covered
- **Sound security architecture:** JWT-center-filtered data APIs, append-only SQLite audit, helmet headers, bcrypt 12 rounds, no client trust
- **Clinical math is correct:** logMAR conversion, baseline delta, IQR band, minN guard, interpolation with no extrapolation all reviewed as sound
- **i18n completeness:** 130+ keys with automated completeness test (outcomesI18n.test.ts)

### Agreed Concerns (High Priority)
1. **Static OTP is not real 2FA** — both reviewers flagged this as the top security risk. Shared fixed code offers minimal protection.
2. **Default `cohortHashSecret` in settings.yaml** — if not changed in production, cohort HMAC anonymization is reversible.
3. **O(N×M) in patientCases extraction** — will become a blocking bottleneck at scale.
4. **No cache warming on startup** — first-user cold start penalty after server restart.
5. **JWT verification missing `algorithms` pin** — algorithm confusion attack vector.

### Additional Finding (Codex Only)
- **Visus y-axis domain too narrow for low-vision data**: `[0, 1]` clips logMAR up to 1.30 present in bundled data; `[-1, 1]` delta clips extreme trajectories. Codex recommends data-driven domains with `[0, 1]` / `[-1, 1]` minimums, or explicit documentation that low-vision (<20/200) patients are out of scope for this chart.

### Action Items for v1.7
- [ ] Add `algorithms: ['HS256']` to `jwt.verify()` call in `authMiddleware.ts` ← quick win
- [ ] Auto-generate `cohortHashSecret` into `data/` like `jwt-secret.txt` ← quick win
- [ ] Pre-group resources by subject reference in `patientCases.ts` ← performance
- [ ] Call `getCachedBundles()` at startup ← UX
- [ ] Add ARIA labels to `OutcomesPanel` chart containers ← accessibility
- [ ] TOTP (RFC 6238) to replace static OTP ← security milestone (KEYCLK-01 adjacent)
- [ ] Clarify/document visus y-axis clinical scope (Codex P2) ← clinical correctness
