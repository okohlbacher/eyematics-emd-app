<!-- generated-by: gsd-doc-writer -->
# Configuration Reference

This document describes all configuration options for the EyeMatics EMD application.

---

## 1. Config File Location

All runtime configuration lives in a single file:

```
config/settings.yaml
```

This path is resolved relative to the server's working directory (i.e., the project root). The file sits **outside the webroot** — `dist/` is the only directory served as static files, so `config/` is never directly accessible to browser clients.

The server reads `settings.yaml` at startup as step 1 of its startup sequence. If the file is missing or contains invalid YAML, the process exits immediately with a fatal error. There are no environment variable overrides; `config/settings.yaml` is the single source of truth.

Settings can be updated at runtime via `PUT /api/settings` (admin only). The server validates the new YAML before writing it, and the in-memory auth configuration is updated without a restart.

**Minimal valid `config/settings.yaml`:**

```yaml
twoFactorEnabled: false
therapyInterrupterDays: 120
therapyBreakerDays: 365
dataSource:
  type: blaze
  blazeUrl: http://localhost:8080/fhir
provider: local
maxLoginAttempts: 5
otpCode: '123456'
audit:
  cohortHashSecret: 'replace-with-a-secret-of-at-least-32-characters'
outcomes:
  serverAggregationThresholdPatients: 1000
  aggregateCacheTtlMs: 1800000
```

---

## 2. Authentication Settings

These fields control the login flow and account lockout behaviour. All three are read at startup by `server/initAuth.ts` and refreshed whenever an admin writes new settings via the API.

| Key | Type | Default | Description |
|---|---|---|---|
| `provider` | `string` | `local` | Auth provider. Either `local` (bcrypt password file) or `keycloak` (OIDC via JWKS). |
| `twoFactorEnabled` | `boolean` | `false` | When `true`, login requires a second step: the user must supply the OTP code after the password check. |
| `maxLoginAttempts` | `number` | `5` | Number of consecutive failed attempts (password or OTP) before an account is locked. The lock is in-memory and resets on server restart. |
| `otpCode` | `string` | `'123456'` | The fixed one-time password code checked in the 2FA verify step. This is a static shared code, not a TOTP. **Change this to a non-default value in production when 2FA is enabled.** |

**Impact of changing:**

- `provider`: Changing from `local` to `keycloak` disables local password login entirely. The `keycloak` sub-section (see below) becomes required.
- `twoFactorEnabled`: Toggling this takes effect immediately for new login sessions; active sessions (existing JWTs) are unaffected until they expire.
- `maxLoginAttempts`: Takes effect for lock decisions made after the settings update. The in-memory attempt counter for already-tracked usernames is not reset.
- `otpCode`: New value is used immediately for all subsequent `/api/auth/verify` calls.

**Read at:** startup (`initAuth`) and on every settings write (`updateAuthConfig`).

**Keycloak sub-section** (required when `provider: keycloak`):

```yaml
provider: keycloak
keycloak:
  issuer: https://auth.example.com/realms/emd
```

| Key | Type | Required | Description |
|---|---|---|---|
| `keycloak.issuer` | `string` | Yes (when provider=keycloak) | Keycloak realm base URL. The server derives the JWKS endpoint as `{issuer}/protocol/openid-connect/certs`. |

The JWKS client caches keys for 10 minutes and applies rate limiting to prevent key-enumeration DoS. The issuer origin is also added to the Content-Security-Policy `connect-src` directive automatically.

**Sensitive fields:** `otpCode` and `maxLoginAttempts` are stripped from `GET /api/settings` responses for non-admin users.

---

## 3. Data Source Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `dataSource.type` | `string` | `blaze` | Data backend type. `blaze` fetches live FHIR data from a Blaze server. `local` uses static JSON bundle files from the `data/` directory. |
| `dataSource.blazeUrl` | `string` | `http://localhost:8080/fhir` | Full base URL of the Blaze FHIR endpoint, including the `/fhir` path. Used by the FHIR proxy and the bundle loader. |

**Impact of changing:**

- `dataSource.blazeUrl`: The FHIR proxy target (`/api/fhir-proxy`) is derived from this URL at **startup only** — changing it via the settings API invalidates the FHIR bundle cache but does not update the proxy's target until the server is restarted. The FHIR connection test (`GET /api/settings/fhir-connection-test`) always re-reads the current file value, so it reflects the new URL immediately.
- `dataSource.type`: Switching to `local` makes the bundle loader serve static files; switching to `blaze` resumes live fetching.

**Read at:** startup (proxy target derivation) and at cache-invalidation time (bundle loader re-fetches on next request).

---

## 4. Therapy Threshold Settings

These thresholds drive clinical classification logic (therapy interruption vs. therapy break).

| Key | Type | Default | Description |
|---|---|---|---|
| `therapyInterrupterDays` | `number` | `120` | Number of days without a treatment injection after which a patient is classified as a therapy interrupter. |
| `therapyBreakerDays` | `number` | `365` | Number of days without a treatment injection after which a patient is classified as a therapy breaker. |

**Validation:** Both fields are required and must be finite numbers. The settings API rejects a write if either is absent or non-numeric.

**Impact of changing:** Clinical classification is recomputed on each data load; no cached patient-level data needs to be invalidated. The new thresholds take effect for all requests after the settings file is written.

**Read at:** runtime, on each request that performs patient classification.

---

## 5. Outcomes Settings

These settings control the server-side cohort aggregation feature.

| Key | Type | Default | Description |
|---|---|---|---|
| `outcomes.serverAggregationThresholdPatients` | `number` | `1000` | Minimum cohort size (in number of patients) required before the server performs cohort trajectory aggregation. Cohorts below this threshold are handled client-side. Must be a positive integer. |
| `outcomes.aggregateCacheTtlMs` | `number` | `1800000` (30 min) | Time-to-live in milliseconds for in-memory aggregate results. The cache is keyed per user and cohort. Set to `0` to disable caching (every request recomputes). Must be a non-negative number. |

**Impact of changing:**

- `serverAggregationThresholdPatients`: Determines the routing decision for each aggregation request. Raising this value pushes more cohorts to client-side processing; lowering it increases server-side computation load.
- `aggregateCacheTtlMs`: Lower values increase FHIR load and CPU usage. The cache is in-memory only and does not survive process restarts. Explicit cache invalidation also occurs when a user's saved searches are modified.

**Read at:** startup (`initOutcomesAggregateCache`). The cache TTL is fixed for the lifetime of the process; changing `aggregateCacheTtlMs` via the settings API requires a server restart to take effect. The threshold is read per-request from the parsed settings.

---

## 6. Audit Settings

| Key | Type | Default | Required | Description |
|---|---|---|---|---|
| `audit.cohortHashSecret` | `string` | — | **Yes** | Secret key used to compute HMAC-SHA256 hashes of cohort IDs in audit log entries. Must be at least 32 characters. The server exits at startup if this value is missing or shorter than 32 characters. |
| `audit.retentionDays` | `number` | `90` | No | Number of days to retain audit log entries. Entries older than this are purged at startup and then every 24 hours. |

**Impact of changing:**

- `audit.cohortHashSecret`: **Changing this secret makes all previously hashed cohort IDs in the audit log irreconcilable with new hashes.** Do not rotate this secret unless you understand the audit trail implications. The secret is never logged and is stripped from non-admin `GET /api/settings` responses entirely.
- `audit.retentionDays`: The next purge cycle (startup or 24-hour interval) will apply the new retention window. Existing entries are not back-filled.

**Read at:** startup only. The cohort hash secret and retention period cannot be changed at runtime without a server restart.

**Security note:** `audit.cohortHashSecret` is stripped from `GET /api/settings` for all users, including admins, to prevent exposure via the API. It can only be read from the file system directly.

---

## 7. Center Configuration (`data/centers.json`)

Centers are not configured in `settings.yaml`. They are defined in:

```
data/centers.json
```

This file is loaded at startup by `server/constants.ts`. If the file is missing, the server seeds it with the built-in defaults. If the file exists but fails to parse or is empty, the server falls back to defaults and logs a warning.

**Format:** A JSON array of center objects.

```json
[
  { "id": "org-uka",  "shorthand": "UKA",  "name": "Universitätsklinikum Aachen",     "file": "center-aachen.json" },
  { "id": "org-ukc",  "shorthand": "UKC",  "name": "Universitätsklinikum Chemnitz",   "file": "center-chemnitz.json" },
  { "id": "org-ukd",  "shorthand": "UKD",  "name": "Universitätsklinikum Dresden",    "file": "center-dresden.json" },
  { "id": "org-ukg",  "shorthand": "UKG",  "name": "Universitätsklinikum Greifswald", "file": "center-greifswald.json" },
  { "id": "org-ukl",  "shorthand": "UKL",  "name": "Universitätsklinikum Leipzig",    "file": "center-leipzig.json" },
  { "id": "org-ukmz", "shorthand": "UKMZ", "name": "Universitätsmedizin Mainz",       "file": "center-mainz.json" },
  { "id": "org-ukt",  "shorthand": "UKT",  "name": "Universitätsklinikum Tübingen",   "file": "center-tuebingen.json" }
]
```

**Field descriptions:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Canonical center identifier in `org-*` format. Used in user records and FHIR bundle routing. Must be unique. |
| `shorthand` | `string` | Human-readable abbreviation. Displayed in the UI and used as the legacy migration key. Must be present. |
| `name` | `string` | Full institutional name. Displayed in the UI. |
| `file` | `string` | Filename of the static FHIR bundle JSON file for this center (used when `dataSource.type: local`). |

**Impact of changing:** Center IDs in `data/centers.json` are the authoritative allowlist for user center assignments. Adding a center makes it available for user assignment. Removing a center does not automatically update existing user records — users holding the removed ID retain it, but it will no longer match any loaded bundle. The startup migration in `initAuth.ts` automatically strips the historically removed center IDs `org-ukb`, `org-lmu`, and `org-ukm` from user records.

**Read at:** startup only. Changes to `centers.json` require a server restart.

---

## 8. JWT Secret (`data/jwt-secret.txt`)

The JWT signing secret is stored separately from `settings.yaml` for security:

```
data/jwt-secret.txt
```

**Auto-generation:** If this file does not exist at startup, the server generates a 32-byte cryptographically random hex string and writes it to the file with mode `0600` (owner read/write only). The file is created inside the configured data directory.

**Do not store in `config/settings.yaml`.** The `config/` directory may be readable by processes with access to the project root; `data/jwt-secret.txt` relies on file-system permissions to restrict access.

**Rotation:** To rotate the JWT secret, delete `data/jwt-secret.txt` and restart the server. All existing sessions will be immediately invalidated because their tokens will fail signature verification. Users will need to log in again.

**Token properties:**

| Token type | Algorithm | Expiry |
|---|---|---|
| Session JWT | HS256 | 10 minutes |
| 2FA challenge token | HS256 | 2 minutes |

---

## 9. User Management (`data/users.json`)

User accounts are stored in:

```
data/users.json
```

This file is managed by the admin API (`POST /api/auth/users`, `DELETE /api/auth/users/:username`, `PUT /api/auth/users/:username/password`) and must not be edited manually while the server is running. Writes are serialized using an in-process lock and use an atomic temp-file rename to prevent corruption.

**Seeding:** If `data/users.json` does not exist at startup, the server creates it with a set of default users (admin, forscher1, forscher2, epidemiologe, kliniker, diz_manager, klinikleitung). All users without a `passwordHash` are migrated at startup: they receive a bcrypt hash (12 rounds) of the default password `changeme2025!`.

**User record format:**

```json
{
  "username": "example",
  "passwordHash": "$2b$12$...",
  "role": "researcher",
  "centers": ["org-uka", "org-ukd"],
  "firstName": "Anna",
  "lastName": "Müller",
  "createdAt": "2025-01-15T00:00:00Z",
  "lastLogin": "2025-04-10T08:30:00Z"
}
```

**Field descriptions:**

| Field | Type | Description |
|---|---|---|
| `username` | `string` | Unique login name. Case-insensitive for authentication. |
| `passwordHash` | `string` | bcrypt hash (12 rounds). Never returned by the API. |
| `role` | `string` | One of: `admin`, `researcher`, `epidemiologist`, `clinician`, `data_manager`, `clinic_lead`. |
| `centers` | `string[]` | List of center IDs (`org-*` format) the user may access. |
| `firstName` | `string` (optional) | Display name. |
| `lastName` | `string` (optional) | Display name. |
| `createdAt` | ISO 8601 string | Account creation timestamp. |
| `lastLogin` | ISO 8601 string (optional) | Timestamp of the most recent successful login. |

**Password management:** Passwords are always server-generated (16-character base64url, ~96 bits entropy). The generated password is returned once in the creation or reset response and is not stored anywhere. Admins cannot set an arbitrary password via the API.

---

## 10. Server Settings

Server network binding is configured via an optional `server` section in `config/settings.yaml`. All fields have defaults and the section may be omitted entirely.

| Key | Type | Default | Description |
|---|---|---|---|
| `server.port` | `number` | `3000` | TCP port the Express server listens on. |
| `server.host` | `string` | `0.0.0.0` | Bind address. Use `127.0.0.1` to restrict to localhost only. |
| `server.dataDir` | `string` | `./data` | Path to the data directory (resolved relative to the working directory). Contains `users.json`, `jwt-secret.txt`, `centers.json`, `audit.db`, and FHIR bundle files. |

**Example:**

```yaml
server:
  port: 3000
  host: 0.0.0.0
  dataDir: ./data
```

**Impact of changing:**

- `server.port` / `server.host`: Take effect only on server restart.
- `server.dataDir`: Changing this path causes the server to look for (or create) all data files in the new location on the next restart. Existing data files must be moved manually.

**Read at:** startup only. These values cannot be changed at runtime.
