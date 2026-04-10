# Phase 5: Center-Based Data Restriction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 05-center-based-data-restriction
**Areas discussed:** FHIR data filtering strategy, Data API center enforcement, Admin/bypass behavior, Client-side defense-in-depth

---

## FHIR Data Filtering Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side FHIR proxy | New /api/fhir/* endpoint. Server loads/proxies and filters by JWT centers. Client never sees unauthorized data. | ✓ |
| Server loads + filters, new /api/cases endpoint | Server extracts PatientCases, filters, returns structured JSON. Bigger change. | |
| Client loads, server validates | Client loads as now, server provides permitted-centers endpoint. Unauthorized data on wire. | |

**User's choice:** Server-side FHIR proxy
**Notes:** Clear preference for server-side filtering — unauthorized data should never leave the server.

### Local bundles approach

| Option | Description | Selected |
|--------|-------------|----------|
| Server loads from disk | Server reads center-*.json, filters to user's centers, serves via API | ✓ |
| Auth-gated static serving | Keep /data/*.json as static with auth gate | |
| You decide | Claude picks | |

**User's choice:** Server loads from disk

### Blaze proxy filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Filter by Patient.meta.source after fetch | Server fetches all, filters by meta.source matching center IDs | ✓ |
| Pass center filter to Blaze query params | Add filter params to Blaze queries | |
| You decide | Claude picks | |

**User's choice:** Filter by Patient.meta.source after fetch

### Client-side change

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with server API calls | DataContext fetches from /api/fhir/* | ✓ |
| Minimal change — point to new URLs | Change dataSource.ts URLs only | |

**User's choice:** Replace with server API calls

### API response format

| Option | Description | Selected |
|--------|-------------|----------|
| Filtered FHIR bundles | Standard FHIR format, client extracts PatientCases | ✓ |
| Pre-extracted PatientCases | Server extracts, returns structured JSON | |

**User's choice:** Filtered FHIR bundles

### API endpoint shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single /api/fhir/bundles | One endpoint returns all filtered bundles | ✓ |
| Split: /api/fhir/bundles + /api/fhir/centers | Separate center metadata endpoint | |
| You decide | Claude picks | |

**User's choice:** Single /api/fhir/bundles endpoint

### Server caching

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, cache in memory | Load once, serve filtered subsets, invalidate on settings change | ✓ |
| No cache, load per request | Load from disk/Blaze every request | |
| You decide | Claude picks | |

**User's choice:** Yes, cache in memory

### Dev proxy handling

| Option | Description | Selected |
|--------|-------------|----------|
| Server handles everything | Remove Vite dev proxy, all FHIR through Express | ✓ |
| Keep dev proxy for direct Blaze access | Vite proxy stays for dev | |

**User's choice:** Server handles everything — consistent behavior in dev and prod

---

## Data API Center Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Per-user scoping is sufficient | Already per-user via username. No additional center scoping. | ✓ |
| Add center scoping too | Validate case IDs belong to user's centers | |
| You decide | Claude picks | |

**User's choice:** Per-user scoping is sufficient

### 403 logic for CENTER-03

| Option | Description | Selected |
|--------|-------------|----------|
| Validate case IDs on write operations | Server checks case belongs to user's centers on write. 403 if not. | ✓ |
| No additional validation needed | FHIR filtering upstream prevents invalid case references | |
| Middleware-level center check | Validates every request body for center identifiers | |

**User's choice:** Validate case IDs on write operations

### CENTER-09 API layer implementation

| Option | Description | Selected |
|--------|-------------|----------|
| req.auth.centers already available | Handlers read req.auth.centers directly. No new middleware. | ✓ |
| Add centerEnforcement middleware | Dedicated middleware: requireCenters() | |

**User's choice:** req.auth.centers already available

---

## Admin/Bypass Behavior

### Bypass condition

| Option | Description | Selected |
|--------|-------------|----------|
| role === 'admin' OR centers includes all valid | Two paths to full access | ✓ |
| role === 'admin' only | Only admin role bypasses | |
| Explicit 'all' center value | centers: ['*'] in JWT | |

**User's choice:** role === 'admin' OR centers includes all valid centers

### Bypass implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Skip filtering entirely | Return everything without running filter logic | ✓ |
| Filter with full center list | Always run filter, admin has full list | |

**User's choice:** Skip filtering entirely

### Role-based bypass

| Option | Description | Selected |
|--------|-------------|----------|
| Admin only | Only admin role gets automatic bypass | ✓ |
| Admin + clinic_lead | Both roles bypass | |
| You decide | Claude picks | |

**User's choice:** Admin only — principle of least privilege

---

## Client-Side Defense-in-Depth

### CohortBuilder center filter

| Option | Description | Selected |
|--------|-------------|----------|
| Only show permitted centers | Dropdown lists only accessible centers | ✓ |
| Show all, disable non-permitted | All visible, non-permitted grayed out | |
| You decide | Claude picks | |

**User's choice:** Only show permitted centers

### Client-side filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Trust server, remove client filtering | Server returns only permitted data, no redundant client filter | ✓ |
| Keep client filter as defense-in-depth | DataContext applies center filter after server response | |
| You decide | Claude picks | |

**User's choice:** Trust server completely

### How client knows permitted centers

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from server response data | extractCenters() from filtered bundles = permitted centers | ✓ |
| Explicit /api/auth/me endpoint | Call user info API for centers array | |
| Read from JWT payload | Decode JWT on client for centers | |

**User's choice:** Derive from server response data

---

## Claude's Discretion

- Server-side FHIR loading implementation details
- Cache invalidation strategy
- Error handling for Blaze failures
- Mapping center filenames to org-* IDs
- Module structure for new FHIR proxy code

## Deferred Ideas

- Blaze query-param filtering (push filter to server) — optimize if needed later
- Per-center data.db isolation — per-user is sufficient for v1
- Full resource-level center scoping on /api/data/* — unnecessary given per-user isolation
