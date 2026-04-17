<!-- generated-by: gsd-doc-writer -->
# EyeMatics EMD — REST API Reference
<!-- GSD:GENERATED 2026-04-17 -->

This document is a complete reference for the EyeMatics EMD Express 5 REST API. Every endpoint listed here is verified against the actual route registrations in `server/index.ts` and the individual router files.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Request Format](#2-request-format)
3. [Audit Log](#3-audit-log)
4. [Center Filtering](#4-center-filtering)
5. [Auth Endpoints — `/api/auth/*`](#5-auth-endpoints--apiauthauth)
6. [Data Endpoints — `/api/data/*`](#6-data-endpoints--apidata)
7. [Outcomes Endpoints — `/api/outcomes/*`](#7-outcomes-endpoints--apioutcomes)
8. [FHIR Endpoints — `/api/fhir/*`](#8-fhir-endpoints--apifhir)
9. [Audit Endpoints — `/api/audit/*`](#9-audit-endpoints--apiaudit)
10. [Settings Endpoints — `/api/settings/*`](#10-settings-endpoints--apisettings)
11. [Issues Endpoints — `/api/issues/*`](#11-issues-endpoints--apiissues)
12. [FHIR Proxy — `/api/fhir-proxy`](#12-fhir-proxy--apifhir-proxy)
13. [Error Responses](#13-error-responses)

---

## 1. Authentication

### Local provider (default)

Authentication is a two-step process when two-factor authentication (2FA) is enabled.

**Step 1 — Password:** `POST /api/auth/login` with `username` and `password`. On success:
- If 2FA is **disabled**: the response contains a full session token (`token`). Login is complete.
- If 2FA is **enabled**: the response contains a short-lived challenge token (`challengeToken`, valid 2 minutes).

**Step 2 — OTP (only when 2FA is enabled):** `POST /api/auth/verify` with the `challengeToken` and the `otp` code. On success, the response contains the full session token (`token`).

**Session token properties:**
- Algorithm: `HS256`
- Expiry: **10 minutes**
- Claims: `sub` (username), `preferred_username`, `role`, `centers[]`

**Account lockout:** Failed password and OTP attempts share the same per-username counter. After exceeding `maxLoginAttempts` (configured in `settings.yaml`), the account is locked with exponential backoff. The response includes `retryAfterMs`.

### Keycloak provider

When `provider: keycloak` is configured in `settings.yaml`, local login is disabled. Tokens are issued by the Keycloak server and validated by the EMD server via RS256 JWKS. The `POST /api/auth/login` endpoint returns `405` in Keycloak mode. Obtain tokens through the Keycloak authorization flow directly.

The `GET /api/auth/config` endpoint always returns the active provider so clients know which login path to use.

---

## 2. Request Format

### Authorization header

All endpoints under `/api/*` require a valid JWT **except** the three public auth paths:

| Public path (no token required) |
|----------------------------------|
| `POST /api/auth/login`           |
| `POST /api/auth/verify`          |
| `GET  /api/auth/config`          |

For all other endpoints, include the session token in every request:

```
Authorization: Bearer <token>
```

A missing or invalid token returns `401 Unauthorized`:

```json
{ "error": "Authentication required" }
```

An expired token returns `401 Unauthorized`:

```json
{ "error": "Invalid or expired token" }
```

### Content-Type

Endpoints that accept a JSON body expect `Content-Type: application/json`. The `PUT /api/settings` endpoint expects `Content-Type: text/plain` (raw YAML).

---

## 3. Audit Log

Every request to `/api/*` is automatically logged to a SQLite database before the response is sent. The audit middleware is mounted **before** the auth middleware, so failed authentication attempts (401 responses) are also recorded with `user: "anonymous"`.

Each audit record captures:

| Field | Description |
|-------|-------------|
| `id` | UUID v4 |
| `timestamp` | ISO 8601 UTC |
| `method` | HTTP method |
| `path` | URL path (no query string) |
| `user` | `preferred_username` from JWT, or `"anonymous"` for 401s |
| `status` | HTTP response status code |
| `duration_ms` | Request processing time in milliseconds |
| `body` | Redacted request body for non-GET requests (JSON string or null) |
| `query` | Query parameters for GET requests (JSON string or null) |

**Sensitive field redaction:** The fields `password`, `otp`, `challengeToken`, and `generatedPassword` are replaced with `[REDACTED]` in the stored body for all `/api/auth/*` endpoints.

**Handler-written rows:** `POST /api/audit/events/view-open` and `POST /api/outcomes/aggregate` write their own audit rows with additional metadata (hashed cohort ID, payload bytes). The middleware does not write a duplicate row for these two paths.

**Retention:** Audit entries are purged after `audit.retentionDays` days (configured in `settings.yaml`, default 90). Purge runs once at startup and then daily.

---

## 4. Center Filtering

The EMD application enforces center-based access control on all data reads and writes. The user's permitted centers are embedded in the JWT as the `centers` claim. Clients cannot override this claim.

**Read filtering (`GET /api/fhir/bundles`):** The server returns only FHIR bundles belonging to the user's centers. Bundles are matched by the `Organization` resource ID (local data source) or by `Patient.meta.source` (Blaze FHIR server).

**Write validation (`/api/data/*`):** Before saving quality flags, excluded cases, or reviewed cases, the server validates that every submitted case ID belongs to a center in the user's `centers` claim. Unknown case IDs are also rejected. The error message is generic to prevent case ID enumeration:

```json
{ "error": "One or more case IDs are not accessible" }
```

**Bypass:** Admin users and users whose `centers` claim includes every configured center ID bypass filtering and receive all data.

---

## 5. Auth Endpoints — `/api/auth/*`

### `POST /api/auth/login`

Step 1 of the local login flow. Not available when `provider: keycloak`.

**Auth required:** No

**Request body:**

```json
{
  "username": "forscher1",
  "password": "secret"
}
```

**Response — 2FA disabled:**

```json
{ "token": "<jwt>" }
```

**Response — 2FA enabled:**

```json
{ "challengeToken": "<short-lived-jwt>" }
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "username and password are required" }` | Missing fields |
| 401 | `{ "error": "Invalid credentials" }` | Wrong username or password |
| 405 | `{ "error": "Local login is disabled..." }` | Keycloak mode active |
| 429 | `{ "error": "Account locked", "retryAfterMs": <number> }` | Too many failed attempts |

---

### `POST /api/auth/verify`

Step 2 of the local login flow (2FA). Validates the challenge token and OTP code.

**Auth required:** No

**Request body:**

```json
{
  "challengeToken": "<short-lived-jwt>",
  "otp": "123456"
}
```

**Response:**

```json
{ "token": "<jwt>" }
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "challengeToken and otp are required" }` | Missing fields |
| 401 | `{ "error": "Invalid or expired challenge token" }` | Token invalid or expired (2 min TTL) |
| 401 | `{ "error": "Invalid OTP" }` | Wrong OTP code |
| 429 | `{ "error": "Account locked", "retryAfterMs": <number> }` | Too many failed attempts |

---

### `GET /api/auth/config`

Returns the active auth configuration so the client can determine which login flow to render.

**Auth required:** No

**Response:**

```json
{
  "twoFactorEnabled": true,
  "provider": "local"
}
```

`provider` is either `"local"` or `"keycloak"`.

---

### `GET /api/auth/users/me`

Returns the authenticated user's own profile.

**Auth required:** Yes (any role)

**Response:**

```json
{
  "user": {
    "username": "forscher1",
    "role": "researcher",
    "centers": ["org-uka"],
    "firstName": "Anna",
    "lastName": "Müller"
  }
}
```

---

### `GET /api/auth/users`

Returns all users (without password hashes).

**Auth required:** Yes — **admin only**

**Response:**

```json
{
  "users": [
    {
      "username": "forscher1",
      "firstName": "Anna",
      "lastName": "Müller",
      "role": "researcher",
      "centers": ["org-uka"],
      "createdAt": "2025-01-15T00:00:00Z",
      "lastLogin": "2026-04-17T09:00:00Z"
    }
  ]
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 403 | `{ "error": "Admin access required" }` | Non-admin caller |

---

### `POST /api/auth/users`

Create a new user. The server generates a secure random password; no password is accepted in the request body.

**Auth required:** Yes — **admin only**

**Request body:**

```json
{
  "username": "newuser",
  "role": "researcher",
  "centers": ["org-uka", "org-ukc"],
  "firstName": "Max",
  "lastName": "Mustermann"
}
```

Valid roles: `admin`, `researcher`, `epidemiologist`, `clinician`, `data_manager`, `clinic_lead`.

If `role` is omitted it defaults to `"researcher"`. `firstName` and `lastName` are optional.

**Response — 201 Created:**

```json
{
  "user": {
    "username": "newuser",
    "role": "researcher",
    "centers": ["org-uka", "org-ukc"],
    "firstName": "Max",
    "lastName": "Mustermann",
    "createdAt": "2026-04-17T10:00:00Z"
  },
  "generatedPassword": "aB3kX9qZ2mN7pL0s"
}
```

The `generatedPassword` is returned only once and is not stored in plaintext. The response includes `Cache-Control: no-store`.

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "username is required" }` | Missing username |
| 400 | `{ "error": "Invalid role. Must be one of: ..." }` | Unknown role value |
| 400 | `{ "error": "Invalid center codes: ..." }` | Centers not in allowlist |
| 403 | `{ "error": "Admin access required" }` | Non-admin caller |
| 409 | `{ "error": "Username already exists" }` | Duplicate username |

---

### `DELETE /api/auth/users/:username`

Remove a user. Admins cannot delete their own account.

**Auth required:** Yes — **admin only**

**Path parameter:** `username` — the username to delete (case-insensitive match)

**Response:**

```json
{ "message": "User deleted" }
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 403 | `{ "error": "Admin access required" }` | Non-admin caller |
| 404 | `{ "error": "User not found" }` | Username does not exist |
| 409 | `{ "error": "Cannot delete your own account" }` | Self-delete attempt |

---

### `PUT /api/auth/users/:username/password`

Reset a user's password. The server generates a new secure random password; no password is supplied in the request body.

**Auth required:** Yes — **admin only**

**Path parameter:** `username` — the target username (case-insensitive match)

**Request body:** None required.

**Response:**

```json
{ "generatedPassword": "xR5tY8wQ1nM4kJ6p" }
```

The response includes `Cache-Control: no-store`.

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 403 | `{ "error": "Admin access required" }` | Non-admin caller |
| 404 | `{ "error": "User not found" }` | Username does not exist |

---

## 6. Data Endpoints — `/api/data/*`

All `/api/data/*` endpoints are per-user: data is scoped to `req.auth.preferred_username`. A user can only read and write their own data. Center-ownership validation applies to all write endpoints (see [Section 4](#4-center-filtering)).

---

### `GET /api/data/quality-flags`

Returns the authenticated user's quality flags.

**Auth required:** Yes (any role)

**Response:**

```json
{
  "qualityFlags": [
    {
      "id": "uuid",
      "caseId": "patient-id",
      "parameter": "VA_BCVA",
      "errorType": "outlier",
      "flaggedAt": "2026-04-01T08:00:00Z",
      "flaggedBy": "forscher1",
      "status": "open"
    }
  ]
}
```

---

### `PUT /api/data/quality-flags`

Bulk-replace the authenticated user's quality flags. The full list replaces the current store. Maximum 10,000 items per request.

**Auth required:** Yes (any role)

**Request body:**

```json
{
  "qualityFlags": [
    {
      "id": "optional-uuid",
      "caseId": "patient-id",
      "parameter": "VA_BCVA",
      "errorType": "outlier",
      "status": "open"
    }
  ]
}
```

`id` is optional; the server generates a UUID if absent. `flaggedBy` and `flaggedAt` in the request body are ignored — the server derives them server-side. For existing flags (matched by `id`), original `flaggedAt` and `flaggedBy` are preserved.

Valid `status` values: `open`, `acknowledged`, `resolved`. Unknown values default to `open`.

**Response:** Same shape as `GET /api/data/quality-flags`.

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "qualityFlags array is required" }` | Body missing or wrong type |
| 400 | `{ "error": "qualityFlags array exceeds maximum size of 10000" }` | Too many items |
| 400 | `{ "error": "Each quality flag must have caseId, parameter, and errorType" }` | Missing required fields |
| 403 | `{ "error": "One or more case IDs are not accessible" }` | Center violation |

---

### `GET /api/data/saved-searches`

Returns the authenticated user's saved searches.

**Auth required:** Yes (any role)

**Response:**

```json
{
  "savedSearches": [
    {
      "id": "search-uuid",
      "name": "My Cohort",
      "createdAt": "2026-03-15T12:00:00Z",
      "filters": { "centers": ["org-uka"], "minAge": 50 }
    }
  ]
}
```

---

### `POST /api/data/saved-searches`

Create a new saved search.

**Auth required:** Yes (any role)

**Request body:**

```json
{
  "id": "search-uuid",
  "name": "My Cohort",
  "createdAt": "2026-04-17T10:00:00Z",
  "filters": { "centers": ["org-uka"], "minAge": 50 }
}
```

`id` and `name` are required. `filters` must be a non-null object and must not exceed 50,000 characters when serialized. `createdAt` defaults to the current server time if omitted.

**Response — 201 Created:**

```json
{
  "savedSearch": {
    "id": "search-uuid",
    "name": "My Cohort",
    "createdAt": "2026-04-17T10:00:00Z",
    "filters": { "centers": ["org-uka"], "minAge": 50 }
  }
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "id is required" }` | Missing id |
| 400 | `{ "error": "name is required" }` | Missing name |
| 400 | `{ "error": "filters object is required" }` | Missing or null filters |
| 400 | `{ "error": "filters object is too large" }` | Filters exceed 50,000 chars serialized |
| 403 | `{ "error": "One or more case IDs are not accessible" }` | Center violation on embedded case IDs |

---

### `DELETE /api/data/saved-searches/:id`

Delete a saved search by ID.

**Auth required:** Yes (any role)

**Path parameter:** `id` — the saved search ID

**Response:**

```json
{ "message": "Saved search deleted" }
```

---

### `GET /api/data/excluded-cases`

Returns the authenticated user's excluded case IDs.

**Auth required:** Yes (any role)

**Response:**

```json
{ "excludedCases": ["patient-id-1", "patient-id-2"] }
```

---

### `PUT /api/data/excluded-cases`

Bulk-replace the authenticated user's excluded cases. Maximum 10,000 items.

**Auth required:** Yes (any role)

**Request body:**

```json
{ "excludedCases": ["patient-id-1", "patient-id-2"] }
```

**Response:** Same shape as `GET /api/data/excluded-cases`.

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "excludedCases array is required" }` | Body missing or wrong type |
| 400 | `{ "error": "excludedCases array exceeds maximum size of 10000" }` | Too many items |
| 403 | `{ "error": "One or more case IDs are not accessible" }` | Center violation |

---

### `GET /api/data/reviewed-cases`

Returns the authenticated user's reviewed case IDs.

**Auth required:** Yes (any role)

**Response:**

```json
{ "reviewedCases": ["patient-id-1", "patient-id-2"] }
```

---

### `PUT /api/data/reviewed-cases`

Bulk-replace the authenticated user's reviewed cases. Maximum 10,000 items.

**Auth required:** Yes (any role)

**Request body:**

```json
{ "reviewedCases": ["patient-id-1", "patient-id-2"] }
```

**Response:** Same shape as `GET /api/data/reviewed-cases`.

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "reviewedCases array is required" }` | Body missing or wrong type |
| 400 | `{ "error": "reviewedCases array exceeds maximum size of 10000" }` | Too many items |
| 403 | `{ "error": "One or more case IDs are not accessible" }` | Center violation |

---

## 7. Outcomes Endpoints — `/api/outcomes/*`

### `POST /api/outcomes/aggregate`

Server-side cohort trajectory aggregation. Computes statistical outcomes (mean, IQR/SD bands, optional per-patient series) over a saved-search cohort.

**Auth required:** Yes (any role)

**Body size limit:** 16 KiB

The user's `centers` claim from the JWT is used for FHIR data filtering; any center value in the request body is ignored.

**Request body:**

```json
{
  "cohortId": "search-uuid",
  "axisMode": "days",
  "yMetric": "absolute",
  "gridPoints": 50,
  "eye": "od",
  "spreadMode": "iqr",
  "includePerPatient": false,
  "includeScatter": false,
  "metric": "visus"
}
```

| Field | Type | Required | Valid values |
|-------|------|----------|--------------|
| `cohortId` | string | Yes | ID of the caller's own saved search (max 128 chars) |
| `axisMode` | string | Yes | `"days"`, `"treatments"` |
| `yMetric` | string | Yes | `"absolute"`, `"delta"`, `"delta_percent"` |
| `gridPoints` | number | Yes | Integer 2–2048 |
| `eye` | string | Yes | `"od"`, `"os"`, `"combined"` |
| `spreadMode` | string | No | `"iqr"` (default), `"sd1"`, `"sd2"` |
| `includePerPatient` | boolean | No | `false` (default) |
| `includeScatter` | boolean | No | `false` (default) |
| `metric` | string | No | `"visus"` (default), `"crt"` |

**Response — shape defined by `AggregateResponse` in `shared/outcomesProjection.ts`:**

The response envelope always includes a `meta` object:

```json
{
  "meta": {
    "cacheHit": false,
    "patientCount": 42
  },
  "trajectory": { ... }
}
```

`meta.cacheHit` is `true` when the result was served from the server-side aggregate cache (TTL configured by `outcomes.aggregateCacheTtlMs` in `settings.yaml`).

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Invalid request body" }` | Any validation failure (generic, no enumeration) |
| 403 | `{ "error": "Forbidden" }` | `cohortId` not found in caller's saved searches |
| 500 | `{ "error": "Cohort filters corrupt" }` | Saved search filters cannot be parsed |
| 502 | `{ "error": "Upstream data unavailable" }` | FHIR bundle loading failed |

The audit log records a row for every call including `403` responses. The `cohortId` is stored as an HMAC-SHA256 hash — the raw value never appears in the audit database.

---

## 8. FHIR Endpoints — `/api/fhir/*`

### `GET /api/fhir/bundles`

Returns center-filtered FHIR bundles for the authenticated user.

**Auth required:** Yes (any role)

Admin users and users whose `centers` claim covers all configured centers receive all bundles unfiltered. All other users receive only bundles belonging to their assigned centers.

**Response:**

```json
{
  "bundles": [
    {
      "resourceType": "Bundle",
      "type": "searchset",
      "entry": [ ... ]
    }
  ]
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 502 | `{ "error": "Failed to load FHIR bundles" }` | Data source unavailable |

---

### `GET /api/fhir/centers`

Returns the configured center list.

**Auth required:** Yes (any role)

**Response:**

```json
{
  "centers": [
    { "id": "org-uka", "shorthand": "UKA", "name": "Universitätsklinikum Aachen" }
  ]
}
```

---

### `GET /api/fhir/images/:filename`

Serves OCT images from `public/data/oct/` through an authenticated route. Path traversal is prevented by stripping directory separators from the filename parameter.

**Auth required:** Yes (any role)

**Path parameter:** `filename` — image filename (no directory components)

**Response:** Binary image file with appropriate `Content-Type`.

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Filename required" }` | Empty filename |
| 403 | `{ "error": "Access denied" }` | Path traversal detected |
| 404 | `{ "error": "Image not found" }` | File does not exist |

---

## 9. Audit Endpoints — `/api/audit/*`

The audit log is read-only via the API. No write, update, or delete endpoints exist for audit data. All writes are performed internally by the server.

### `GET /api/audit`

Returns paginated, filtered audit log entries.

**Auth required:** Yes (any role)

Non-admin users automatically see only their own entries (`user` filter is forced to the caller's username). Admin users can query across all users.

**Query parameters (all optional):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `user` | string | Exact username match (admin only; ignored for non-admins) |
| `method` | string | Exact HTTP method, e.g. `GET`, `POST` |
| `path` | string | Substring match on URL path |
| `fromTime` | string | ISO 8601 lower bound on timestamp |
| `toTime` | string | ISO 8601 upper bound on timestamp |
| `limit` | number | Max rows to return (default 50, max 500) |
| `offset` | number | Rows to skip for pagination (default 0) |

**Response:**

```json
{
  "entries": [
    {
      "id": "uuid",
      "timestamp": "2026-04-17T09:00:00Z",
      "method": "GET",
      "path": "/api/fhir/bundles",
      "user": "forscher1",
      "status": 200,
      "duration_ms": 42,
      "body": null,
      "query": null
    }
  ],
  "total": 1234,
  "limit": 50,
  "offset": 0
}
```

`total` is the full count matching the applied filters (before `limit`/`offset`), enabling correct pagination.

---

### `GET /api/audit/export`

Returns all audit entries as a downloadable JSON file.

**Auth required:** Yes — **admin only**

**Response:** JSON attachment with `Content-Disposition: attachment; filename="audit-export.json"`.

```json
{
  "entries": [ ... ]
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 403 | `{ "error": "Forbidden: admin role required" }` | Non-admin caller |

---

### `POST /api/audit/events/view-open`

Authenticated beacon for recording view-open events in the audit log. The cohort ID is stored as an HMAC-SHA256 hash and never in plaintext.

**Auth required:** Yes (any role)

**Body size limit:** 16 KiB

**Request body:**

```json
{
  "name": "open_outcomes_view",
  "cohortId": "search-uuid",
  "filter": { "eye": "od" }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | Yes | View identifier, e.g. `"open_outcomes_view"` |
| `cohortId` | string | No | Raw saved-search ID; max 128 chars; stored as HMAC-SHA256 hash |
| `filter` | object | No | Ad-hoc filter snapshot stored verbatim — do not include patient identifiers or PII |

**Response:** `204 No Content`

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "cohortId exceeds 128 characters" }` | cohortId too long |

---

## 10. Settings Endpoints — `/api/settings/*`

### `GET /api/settings`

Returns the current `settings.yaml` content.

**Auth required:** Yes (any role)

Non-admin users receive a sanitized version with the following fields removed: `otpCode`, `maxLoginAttempts`, `provider`, and `audit.cohortHashSecret`. All other fields are returned as-is.

Admin users receive the full YAML without any field removal.

**Response:** `Content-Type: text/yaml` — raw YAML text.

---

### `PUT /api/settings`

Replace the entire `settings.yaml` content. Triggers an in-memory FHIR cache invalidation and updates the live auth configuration (e.g. `twoFactorEnabled`) without restarting the server.

**Auth required:** Yes — **admin only**

**Request body:** Raw YAML text (`Content-Type: text/plain`).

Required YAML fields:

| Field | Type | Notes |
|-------|------|-------|
| `twoFactorEnabled` | boolean | |
| `therapyInterrupterDays` | number | |
| `therapyBreakerDays` | number | |
| `dataSource.type` | string | `"local"` or `"blaze"` |
| `dataSource.blazeUrl` | string | Non-empty |

Optional:
| Field | Type | Notes |
|-------|------|-------|
| `provider` | string | `"local"` or `"keycloak"` |
| `outcomes.serverAggregationThresholdPatients` | number | Positive integer |
| `outcomes.aggregateCacheTtlMs` | number | Non-negative |

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Empty request body" }` | No body sent |
| 400 | `{ "error": "Invalid YAML syntax" }` | YAML parse failure |
| 400 | `{ "error": "<field> must be ..." }` | Schema validation failure |
| 403 | `{ "error": "Forbidden: admin role required" }` | Non-admin caller |

---

### `GET /api/settings/fhir-connection-test`

Tests connectivity to the FHIR server configured in `settings.yaml` by probing the `/metadata` capability endpoint. Times out after 10 seconds.

**Auth required:** Yes — **admin only**

**Response — success:**

```json
{ "ok": true, "detail": "Blaze 0.30.0 (FHIR 4.0.1)" }
```

**Response — failure:**

```json
{ "error": "FHIR server returned 503 Service Unavailable" }
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 403 | `{ "error": "FHIR connection test is restricted to administrators" }` | Non-admin caller |
| 502 | `{ "error": "..." }` | FHIR server unreachable or returned a non-OK status |

---

## 11. Issues Endpoints — `/api/issues/*`

### `POST /api/issues`

Submit a new issue or feedback report. Issues are stored as JSON files in the `feedback/` directory.

**Auth required:** Yes (any role)

**Request body:**

```json
{
  "page": "/outcomes",
  "description": "The chart does not render after filtering by center.",
  "screenshot": "<optional-base64-data-url>"
}
```

`page` and `description` are required. All other fields are passed through and stored verbatim.

**Response — 201 Created:**

```json
{
  "id": "uuid",
  "filename": "issue-2026-04-17T10-00-00-000Z_abcd1234.json"
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400 | `{ "error": "Issue must include a non-empty \"page\" string" }` | Missing page |
| 400 | `{ "error": "Issue must include a non-empty \"description\" string" }` | Missing description |

---

### `GET /api/issues`

Returns all issues without screenshot data.

**Auth required:** Yes (any role)

**Response:**

```json
{
  "issues": [
    {
      "id": "uuid",
      "timestamp": "2026-04-17T10:00:00Z",
      "page": "/outcomes",
      "description": "...",
      "hasScreenshot": true
    }
  ],
  "total": 1
}
```

`hasScreenshot` is `true` if the original issue included a `screenshot` field.

---

### `GET /api/issues/export`

Returns all issues including screenshot data as a downloadable JSON file.

**Auth required:** Yes — **admin only**

**Response:** JSON attachment with `Content-Disposition: attachment; filename="emd-issues-<date>.json"`.

```json
{
  "issues": [ ... ]
}
```

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 403 | `{ "error": "Forbidden: admin role required" }` | Non-admin caller |

---

## 12. FHIR Proxy — `/api/fhir-proxy`

The FHIR proxy forwards requests directly to the configured Blaze FHIR server (`dataSource.blazeUrl` in `settings.yaml`).

**Auth required:** Yes — **admin only**

Non-admin users receive `403 Forbidden`. Non-admin users must use `/api/fhir/bundles` which enforces center filtering.

This endpoint is a transparent reverse proxy. Any HTTP method and path suffix supported by the Blaze server can be used. The proxy target is determined at server startup from `settings.yaml`.

**Error responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 403 | `{ "error": "FHIR proxy access restricted to administrators" }` | Non-admin caller |
| 502 | `{ "error": "FHIR proxy error" }` | Upstream connection failure |

---

## 13. Error Responses

All error responses use a consistent JSON envelope:

```json
{ "error": "<human-readable message>" }
```

**Common status codes:**

| Status | Meaning |
|--------|---------|
| 400 | Bad request — missing or invalid field in request body or query |
| 401 | Unauthenticated — missing, invalid, or expired Bearer token |
| 403 | Forbidden — authenticated but insufficient role or center access |
| 404 | Not found — resource or route does not exist |
| 409 | Conflict — e.g. duplicate username or self-delete attempt |
| 413 | Payload too large — request body exceeds the endpoint's size limit |
| 429 | Too many requests — account locked after repeated failed login attempts |
| 500 | Internal server error |
| 502 | Upstream error — FHIR server or proxy connection failed |
| 503 | Service unavailable — Keycloak JWKS endpoint unreachable (fail-closed) |

Unmatched `/api/*` routes return:

```json
{ "error": "Not found" }
```
