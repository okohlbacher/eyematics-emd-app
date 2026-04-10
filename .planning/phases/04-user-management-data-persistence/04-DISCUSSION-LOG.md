# Phase 4: User Management & Data Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 04-user-management-data-persistence
**Areas discussed:** User CRUD API design, Data persistence scope, DataContext migration

---

## User CRUD API Design

| Option | Description | Selected |
|--------|-------------|----------|
| Admin sets password | Add password field to AdminPage create form | |
| Auto-generated password | Server generates random password, returns once in response | ✓ |
| Default password for all | All new users get same default password | |

**User's choice:** Auto-generated password
**Notes:** Server generates and returns password once. More secure than shared defaults.

| Option | Description | Selected |
|--------|-------------|----------|
| Extend authApi.ts | Add CRUD to existing auth router alongside GET /users | ✓ |
| New userApi.ts file | Separate user management from auth in a new file | |

**User's choice:** Extend authApi.ts
**Notes:** Users are part of auth domain. GET /users already lives here.

| Option | Description | Selected |
|--------|-------------|----------|
| Wait for server | POST to server, on success refresh user list | ✓ |
| Optimistic update | Update UI immediately, roll back on error | |

**User's choice:** Wait for server
**Notes:** Simple, always consistent with server state.

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog | Show modal with generated password + copy button | ✓ |
| Inline in success toast | Show password in persistent toast/banner | |
| Download as text file | Auto-download text file with credentials | |

**User's choice:** Modal dialog
**Notes:** Admin must explicitly dismiss. Password never retrievable again.

---

## Data Persistence Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-user | Each user has isolated quality flags, searches, exclusions | ✓ |
| Global shared | All users share same data | |
| Mixed | Some per-user, some global | |

**User's choice:** Per-user
**Notes:** Natural isolation, no conflicts between users.

| Option | Description | Selected |
|--------|-------------|----------|
| One JSON file per resource | Separate .json files, matches existing pattern | |
| Single data.json file | All resources in one file | |
| SQLite (data.db) | Tables in better-sqlite3, already a dependency | ✓ |

**User's choice:** SQLite
**Notes:** User chose SQLite over the recommended JSON files. better-sqlite3 already present, better concurrent write handling.

| Option | Description | Selected |
|--------|-------------|----------|
| Separate data.db | New file alongside audit.db | ✓ |
| Add tables to audit.db | Reuse existing database file | |

**User's choice:** Separate data.db
**Notes:** Clean separation — audit is immutable, user data is mutable CRUD.

---

## DataContext Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch all on mount | Parallel fetch of all 4 resources on mount | ✓ |
| Lazy load per resource | Load each resource when first accessed | |
| Fetch with FHIR data | Bundle data fetch into loadAllBundles() | |

**User's choice:** Fetch all on mount
**Notes:** Simple, consistent, always in sync with server.

| Option | Description | Selected |
|--------|-------------|----------|
| Fire-and-sync | POST to server, update local state from response | ✓ |
| Optimistic with rollback | Update immediately, roll back on failure | |
| Full refetch after mutation | Re-fetch entire resource after any change | |

**User's choice:** Fire-and-sync
**Notes:** Consistent with AdminPage wait-for-server pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Show error, block data views | Error state with retry button, FHIR data independent | ✓ |
| Fall back to empty state | Start with empty arrays if server fails | |
| Fall back to localStorage cache | Read-only localStorage fallback | |

**User's choice:** Show error, block data views
**Notes:** FHIR data still loads independently.

| Option | Description | Selected |
|--------|-------------|----------|
| Remove completely | Delete useLocalStorageState.ts, remove all localStorage refs | ✓ |
| Keep as fallback | Read-only migration path from localStorage | |

**User's choice:** Remove completely
**Notes:** Clean break, no fallback. Server is single source of truth.

---

## Claude's Discretion

- SQLite schema design (column types, indexes, constraints)
- Data API endpoint naming and HTTP methods
- Error toast implementation
- Random password generation strategy
- Whether to create new dataApi.ts or extend existing files
- AdminPage component structure changes

## Deferred Ideas

- Center-based data restriction — Phase 5
- Full DB migration API boundaries — v2
- Self-service password change — deferred to Keycloak
