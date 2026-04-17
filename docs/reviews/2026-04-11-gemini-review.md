I will start by examining the core server-side files to understand the authentication, authorization, and data handling logic, beginning with `server/index.ts` to see the middleware setup and `server/authMiddleware.ts` to check JWT validation.
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 5s.. Retrying after 6710ms...
I will read `server/authApi.ts` to examine the login and 2FA implementation, and also check `server/auditMiddleware.ts` to see how it handles request bodies and if the middleware ordering I noticed is an issue.
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 2s.. Retrying after 5407ms...
I will check `server/fhirApi.ts` and `server/dataApi.ts` to evaluate the center-based filtering, and also look at `vite.config.ts` to investigate the code duplication mentioned.
I will check `vite.config.ts` and `server/settingsApi.ts` to investigate the code duplication in Vite dev plugins and the cache invalidation logic, while also keeping in mind the potential security risks with the FHIR proxy and the fixed OTP code.
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 3s.. Retrying after 5116ms...
I will examine `issueApi.ts` to see if it also contains code duplication between the production handler and the Vite dev plugin, similar to what I found in `settingsApi.ts`.
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 4s.. Retrying after 5001ms...
I will examine `server/auditDb.ts` to confirm if the audit trail is immutable as intended, and I'll also check `server/utils.ts` to see how `readBody` and `validateAuth` are implemented, as they are used in the duplicated handlers.
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 3s.. Retrying after 5717ms...
I will examine `server/initAuth.ts` to understand how users are loaded and if there's any discrepancy between the users in `users.json` and the `KNOWN_USERS` list in `utils.ts`.
I will search the codebase for `_capturedBody` to determine if it's being set anywhere and to confirm my suspicion that audit logging might be broken for issues and settings.
I'll re-read `server/utils.ts` to check if I missed where `_capturedBody` is set in the `readBody` implementation.
Attempt 1 failed: You have exhausted your capacity on this model. Your quota will reset after 6s.. Retrying after 7335ms...
I will read `src/context/AuthContext.tsx` to investigate how the token is stored on the frontend, which will help me understand the full authentication lifecycle and identify any potential security issues on the client side.
## Architecture & Security Review — EMD v1.1

This review identifies critical security vulnerabilities and architectural weaknesses in the EyeMatics Clinical Demonstrator (EMD) v1.1. While the application implements many advanced features like center-based filtering and audit logging, several implementation gaps undermine these controls.

---

### 1. CRITICAL — Must fix before production

#### [Security] Bypassable Authentication in Development Mode
- **File:** `server/utils.ts` (lines 35-70), `server/issueApi.ts`, `server/settingsApi.ts`
- **Description:** The `validateAuth` function used by Vite dev plugins does **not verify cryptographic signatures**. It simply base64-decodes the Bearer token and checks the username against a hardcoded list. An attacker can impersonate any user, including `admin`, by crafting a simple JSON token. While this is noted as "for the demonstrator," it allows complete bypass of all security controls in any environment running the Vite dev server.
- **Recommended Fix:** Use the same `jsonwebtoken` verification logic in `validateAuth` as used in `authMiddleware.ts`, ensuring the `jwt-secret.txt` is loaded and verified.

#### [Security] Fixed/Shared OTP Code (Pseudo-2FA)
- **File:** `server/initAuth.ts` (line 72), `server/authApi.ts` (line 173)
- **Description:** The 2FA implementation uses a single `otpCode` defined in `settings.yaml` (defaulting to `'123456'`) that is **shared by all users**. This is not a true Multi-Factor Authentication (MFA) mechanism; it is effectively a shared second password.
- **Recommended Fix:** Integrate a proper TOTP library (e.g., `otplib`) and store per-user TOTP secrets in `users.json` or the database.

---

### 2. HIGH — Should fix soon

#### [Security] FHIR Proxy Bypasses Center-Based Filtering
- **File:** `server/index.ts` (line 166)
- **Description:** The `/api/fhir-proxy` endpoint is protected by `authMiddleware` for authentication but **lacks authorization logic** to enforce center-based filtering. Any authenticated user can query the Blaze FHIR server for patients/data belonging to any center if they know the resource ID or use broad search parameters.
- **Recommended Fix:** Implement a proxy-intercept middleware that parses FHIR queries and results to enforce `Patient.meta.source` or `Organization` ID filtering, similar to the logic in `fhirApi.ts`.

#### [Security] Broken Audit Logging for Mutation Routes
- **File:** `server/utils.ts` (`readBody`), `server/auditMiddleware.ts` (line 146)
- **Description:** `auditMiddleware` relies on `req._capturedBody` to log request bodies for routes that do not use `express.json()`. However, the `readBody` utility used by `issueApiHandler` and `settingsApiHandler` **fails to populate** `req._capturedBody`.
- **Impact:** All mutations to settings and all reported issues are logged with a `null` body in the audit trail, making it impossible to audit *what* was changed or reported.
- **Recommended Fix:** Update `readBody` in `server/utils.ts` to set `(req as any)._capturedBody = data` before resolving.

#### [Architecture] Significant Code Duplication
- **File:** `server/settingsApi.ts`, `server/issueApi.ts`
- **Description:** The entire logic for handling settings and issues is **duplicated** between the Express production handlers and the Vite development plugins. This violates DRY principles and creates a high risk of "security drift," where a fix is applied to one environment but forgotten in the other.
- **Recommended Fix:** Refactor the core logic into shared controller functions that both the Express handler and the Vite plugin invoke.

---

### 3. MEDIUM — Improvement recommended

#### [Security] Bypassable Center Validation in Data API
- **File:** `server/dataApi.ts` (lines 38-41)
- **Description:** `validateCaseCenters` returns success if a `caseId` is not found in the server-side cache. If the cache is cold or incomplete, a user could potentially set quality flags or exclude cases belonging to other centers.
- **Recommended Fix:** Require that `caseId` must exist in the index for validation to pass, or ensure the cache is fully warmed before allowing mutations.

#### [Architecture] Inconsistent Middleware Ordering
- **File:** `server/index.ts` (lines 144-154)
- **Description:** `auditMiddleware` is mounted for `/api`, while `express.json()` is mounted for specific sub-paths. For `/api/fhir`, the audit middleware runs *before* the body parser. While the audit listener triggers on `res.on('finish')`, this inconsistency makes the flow harder to reason about and led to the `_capturedBody` bug.
- **Recommended Fix:** Move `express.json()` to a global `/api` level before `auditMiddleware`.

#### [Architecture] Secondary Source of Truth for Users
- **File:** `server/utils.ts` (`KNOWN_USERS`)
- **Description:** `validateAuth` relies on a hardcoded user list which may drift from the actual `data/users.json`.
- **Recommended Fix:** Update `validateAuth` to load users via `loadUsers()` from `initAuth.ts`.

---

### 4. LOW — Minor/cosmetic

#### [Security] Missing HTTP Security Headers
- **File:** `server/index.ts`
- **Description:** The production server does not set standard security headers (HSTS, CSP, X-Frame-Options, etc.).
- **Recommended Fix:** Use the `helmet` middleware.

#### [Security] Synchronous Password Hashing
- **File:** `server/authApi.ts`
- **Description:** Uses `bcrypt.compareSync` and `bcrypt.hashSync`. While acceptable for a low-traffic demonstrator, synchronous hashing blocks the Node.js event loop.
- **Recommended Fix:** Switch to the asynchronous `bcrypt.compare()` and `bcrypt.hash()`.

#### [Security] Missing Rate Limiting in Dev Mode
- **File:** `server/utils.ts`
- **Description:** The Vite dev plugins lack the rate limiting implemented in the production `authApi`.
- **Recommended Fix:** Apply a similar rate-limiting strategy to the dev plugins if the dev server is exposed to a network.
