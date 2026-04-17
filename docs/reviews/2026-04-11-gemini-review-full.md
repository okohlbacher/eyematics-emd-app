# Implementation Plan - EyeMatics Clinical Demonstrator (EMD) Code Review

This document summarizes the findings of a deep code review of the EMD codebase, covering 8 key areas: Consistency, Code Redundancy, Security, Docs/Code Alignment, Comments, Coding Style, Compactness, and Requirements.

## Findings Summary

### CRITICAL

| ID | File | Line(s) | Description | Suggested Fix |
|:---|:---|:---|:---|:---|
| C-01 | `server/utils.ts` | 35-71 | **Insecure Auth in Development**: The `validateAuth` function used by Vite plugins accepts base64-encoded JSON as a "token" with NO SIGNATURE or cryptographic validation. This allows anyone to impersonate any user in development by simply encoding `{ "username": "admin", "role": "admin" }` into base64. | Use the same JWT verification logic (HS256 with local secret) in both production and development. Shared utilities should use `jsonwebtoken` with the secret loaded from `data/jwt-secret.txt`. |
| C-02 | `server/fhirApiPlugin.ts` | 32-37 | **Insecure Auth Usage**: Relies on the flawed `validateAuth` to enforce center-based access control during development, making it trivial to bypass. | Update to use robust JWT validation. |

### HIGH

| ID | File | Line(s) | Description | Suggested Fix |
|:---|:---|:---|:---|:---|
| H-01 | `server/authApi.ts` | 45, 146 | **Weak 2FA Implementation**: The "2FA" step uses a fixed, static `otpCode` from `settings.yaml`. This is not true multi-factor authentication; it's effectively just a second shared password. This contradicts the "Must" requirement EMDREQ-USM-005. | Integrate a proper TOTP library (e.g., `otplib`) and generate per-user secrets. |
| H-02 | `server/fhirApi.ts` / `server/fhirApiPlugin.ts` | Multiple | **Duplicate Bypass Logic**: The logic to determine if a user bypasses center filtering (admin or all-center access) is duplicated and slightly inconsistent. | Export `isBypass` from `fhirApi.ts` and use it as the single source of truth in the Vite plugin. |
| H-03 | `server/authApi.ts` | 185 | **Loose Typing in User Creation**: The `role` validation and default assignment are loose, potentially allowing unexpected states if `VALID_ROLES` isn't strictly checked before assignment. | Use stricter TypeScript guards for role validation. |

### MEDIUM

| ID | File | Line(s) | Description | Suggested Fix |
|:---|:---|:---|:---|:---|
| M-01 | `server/index.ts` | 142-159 | **Redundant Body Parsing**: `express.json()` is mounted multiple times with different limits for different route prefixes. This is inefficient and complicates the middleware stack. | Consolidate `express.json()` mounting or use a unified body-parsing strategy. |
| M-02 | `server/utils.ts` | 73-81 | **Redundant User Logic**: `KNOWN_USERS` duplicates information that should be managed exclusively in `users.json`. | Remove `KNOWN_USERS` and load user roles from `users.json` if needed in dev utilities. |
| M-03 | `src/services/fhirLoader.ts` | 55-75 | **Aggressive Mapping in extractCenters**: The function maps patients to organizations based on `meta.source`. If `meta.source` is missing or inconsistent in Blaze bundles, center attribution may fail. | Add defensive checks for `meta.source` and provide clear error states for unattributed data. |
| M-04 | `AuthContext.tsx` | 134-170 | **Lack of Server-Side Session Invalidation on Logout**: The `logout` function only clears the client-side token. While the JWT will eventually expire (10m), there is no way to immediately revoke a compromised token. | Implement a token blocklist (e.g., in SQLite) for immediate revocation on logout. |

### LOW

| ID | File | Line(s) | Description | Suggested Fix |
|:---|:---|:---|:---|:---|
| L-01 | `server/fhirApi.ts` | 277 | **Data Freshness Ambiguity**: `EMDREQ-DAT-004` (Actualitätsstand) uses `meta.lastUpdated`. For synthetic bundles, this is the time of bundle creation, not necessarily the freshness of the clinical data in the source system. | Clearly label the date as "Last fetched from source" vs "Last update in clinical system". |
| L-02 | `src/services/fhirLoader.ts` | Multiple | **Hardcoded Clinical Codes**: LOINC and SNOMED codes are hardcoded across multiple files. | Move all clinical codes to a central configuration or constant file (`src/config/clinicalCodes.ts`). |
| L-03 | `server/index.ts` | 181-184 | **Static Data Access Block**: Access to `/data` is blocked via middleware, but the files still reside in the `public/` directory which might be served by other processes or incorrectly configured proxies. | Move clinical data out of the `public/` directory entirely and serve only via authorized API endpoints. |

## Verification Plan

### Automated Tests
-   **Security Test**: Create a script that attempts to access `/api/fhir/bundles` in dev mode using a forged base64 token. This should fail after the fix.
-   **Auth Test**: Verify that providing an incorrect OTP (even if it's the fixed code) correctly triggers rate limiting and lockout.
-   **Integration Test**: Verify that the `isBypass` logic correctly handles users with 4/5 centers (should NOT bypass) vs 5/5 centers (should bypass).

### Manual Verification
-   **Login Flow**: Test the 2FA flow with both correct and incorrect inputs.
-   **Center Restriction**: Log in as a clinician and verify that only data from the assigned center is visible in the dashboard.
-   **Audit Log**: Verify that `PUT /api/auth/users` (password reset) correctly redacts the `generatedPassword` in the audit database.
-   **Inactivity**: Set `INACTIVITY_TIMEOUT` to 10 seconds and verify the warning and automatic logout.
