---
phase: 11-audit-beacon-pii-hardening
plan: 03
subsystem: src/pages/outcomes
tags: [security, pii, audit-beacon, client-transport]
dependency_graph:
  requires:
    - src/pages/OutcomesPage.tsx useEffect (OUTCOME-11 / D-32 audit beacon site)
    - Plan 11-02 server POST /api/audit/events/view-open (sibling wave-2 contract)
  provides:
    - src/pages/OutcomesPage.tsx :: POST beacon useEffect with keepalive + JSON body
    - tests/OutcomesPage.test.tsx :: migrated test 6 + new 6b/6c/6d covering URL shape, body shape, filter decode, malformed drop, no-params baseline
  affects:
    - CRREV-01 (closed end-to-end with Plans 01 + 02 + 03)
tech_stack:
  added: []
  patterns:
    - fetch + keepalive as fire-and-forget beacon transport (not navigator.sendBeacon, preserves Content-Type JSON + jsdom testability)
    - URL-clean request (no querystring) — all mutable data in JSON body per D-01
    - Fire-and-forget `.catch(() => {})` — no retries, no logging, no user-visible errors (D-03)
key_files:
  created: []
  modified:
    - src/pages/OutcomesPage.tsx
    - tests/OutcomesPage.test.tsx
decisions:
  - D-01 honored: cohort id + filter travel in JSON body, never URL
  - D-02 honored: fetch + keepalive: true, credentials: 'include', Content-Type: application/json
  - D-03 honored: fire-and-forget — any error silently discarded
  - D-08 honored: filter is decoded + parsed from querystring JSON into body.filter verbatim (no client hashing)
metrics:
  tasks_completed: 1
  tests_added: 3   # 6b, 6c, 6d (test 6 migrated in-place)
  tests_migrated: 1  # test 6 — GET/querystring → POST/body
  files_created: 0
  files_modified: 2
  completed_date: 2026-04-16
requirements: [CRREV-01]
---

# Phase 11 Plan 03: Client Beacon Transport Migration Summary

Migrated the OutcomesPage audit beacon from `GET /api/audit/events/view-open?cohort=...&filter=...` to `POST /api/audit/events/view-open` with JSON body + `keepalive: true`. Closes the client half of CRREV-01.

## Files Modified

| Change   | Path                              | Purpose                                                                                     |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| modified | `src/pages/OutcomesPage.tsx`      | Beacon useEffect replaced — POST with JSON body, no querystring, keepalive fire-and-forget  |
| modified | `tests/OutcomesPage.test.tsx`     | Test 6 migrated from URL-shape to init-shape assertions; added 6b/6c/6d for filter coverage |

## Before / After — Beacon useEffect

### Before (lines 85-94)

```typescript
// Audit beacon (OUTCOME-11 / D-32) — fire-and-forget, once per mount.
useEffect(() => {
  const params = new URLSearchParams({ name: 'open_outcomes_view' });
  const cid = searchParams.get('cohort');
  const fp = searchParams.get('filter');
  if (cid) params.set('cohort', cid);
  if (fp) params.set('filter', fp);
  fetch(`/api/audit/events/view-open?${params.toString()}`, { credentials: 'include' })
    .catch(() => { /* beacon is fire-and-forget */ });
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

### After

```typescript
// Audit beacon (Phase 11 / CRREV-01) — fire-and-forget POST, once per mount.
// D-01: cohort id + filter travel in the JSON body, NEVER the URL.
// D-02: fetch + keepalive (not sendBeacon) — survives unload, standard JSON headers, testable.
// D-03: fire-and-forget — silently discard any network/transport error.
// D-08: filter is preserved as-is in the body (no client-side hashing).
useEffect(() => {
  const cid = searchParams.get('cohort');
  const fp = searchParams.get('filter');
  const body: Record<string, unknown> = { name: 'open_outcomes_view' };
  if (cid) body.cohortId = cid;
  if (fp) {
    try {
      body.filter = JSON.parse(decodeURIComponent(fp));
    } catch {
      // Malformed filter param — drop from the beacon payload.
    }
  }
  fetch('/api/audit/events/view-open', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    credentials: 'include',
  }).catch(() => {
    /* beacon is fire-and-forget (D-03) */
  });
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

Shape locks honored:
- URL argument to `fetch` is the literal string `'/api/audit/events/view-open'` — no template literal, no interpolation, no `?`.
- `method: 'POST'`, `keepalive: true`, `credentials: 'include'`, `'Content-Type': 'application/json'`.
- Body baseline `{ name: 'open_outcomes_view' }`; conditionally adds `cohortId` (when `?cohort=` present) and `filter` (when `?filter=` decodes + parses as JSON). Malformed filter → `filter` absent.
- `name: 'open_outcomes_view'` literal unchanged from the legacy beacon — matches the server handler default and any existing analytics queries.

## Before / After — Test 6 Migration

### Before — single test, URL-shape assertions (lines 279-301)

```typescript
it('6. fires audit beacon exactly once on mount with correct URL and credentials', async () => {
  // ... renderWith({ activeCases: cases, savedSearches, initialEntries: ['/outcomes?cohort=abc'] });
  await new Promise((r) => setTimeout(r, 0));
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
  expect(url).toContain('name=open_outcomes_view');
  expect(url).toContain('cohort=abc');
  expect(init?.credentials).toBe('include');
});
```

### After — four tests, init-shape + body-shape assertions

1. **Test 6** (`?cohort=abc` → `{name, cohortId}` body, all transport flags asserted)
   ```typescript
   expect(url).toBe('/api/audit/events/view-open');
   expect(url).not.toContain('?');
   expect(url).not.toContain('cohort');
   expect(init?.method).toBe('POST');
   expect(init?.keepalive).toBe(true);
   expect(init?.credentials).toBe('include');
   expect((init?.headers as Record<string, string>)?.['Content-Type']).toBe('application/json');
   const parsed = JSON.parse(init!.body as string);
   expect(parsed).toEqual({ name: 'open_outcomes_view', cohortId: 'abc' });
   ```

2. **Test 6b** (`?filter=<urlencoded-json>` → body.filter is the DECODED + PARSED object)
   ```typescript
   const filterObj = { diagnosis: ['AMD'], centers: ['org-uka'] };
   // ... mount at `/outcomes?filter=${encodeURIComponent(JSON.stringify(filterObj))}`
   expect(parsed.filter).toEqual(filterObj);
   expect(parsed).not.toHaveProperty('cohortId');
   ```

3. **Test 6c** (`?filter=%7Binvalid` → malformed filter dropped, no throw)
   ```typescript
   expect(parsed.name).toBe('open_outcomes_view');
   expect(parsed).not.toHaveProperty('filter');
   expect(parsed).not.toHaveProperty('cohortId');
   ```

4. **Test 6d** (no params → minimal body)
   ```typescript
   expect(parsed).toEqual({ name: 'open_outcomes_view' });
   ```

## CRREV-01 End-to-End Closure

| Layer   | Plan  | Responsibility                                                                                       | Status |
| ------- | ----- | ---------------------------------------------------------------------------------------------------- | ------ |
| Primitive | 11-01 | `hashCohortId(id)` HMAC-SHA256 utility + `audit.cohortHashSecret` + non-admin strip for GET /api/settings | done |
| Server  | 11-02 | POST /api/audit/events/view-open handler hashes cohortId, writes single audit row with `{name, cohortHash, filter}`; auditMiddleware skip-list; scoped express.json() | done (parallel wave-2 executor) |
| Client  | 11-03 | OutcomesPage fires POST with JSON body + keepalive; no cohort id in URL                             | done (this plan) |

After these three plans, the client never places a raw cohort identifier on the URL, the server never records a raw cohort identifier in `audit_log.body` or `audit_log.query`, and existing append-only audit rows (D-12) are left untouched. CRREV-01 is closed end-to-end.

## Test Count Delta

| Metric                                     | Before   | After    | Delta |
| ------------------------------------------ | -------- | -------- | ----- |
| OutcomesPage.test.tsx tests                | 17       | 20       | +3    |
| Full suite tests                           | 350      | 353      | +3    |
| Full suite test files                      | 34       | 34       | 0     |

All 353 tests across 34 files pass. Baseline preserved; the +3 count is the three new granular beacon tests (6b/6c/6d); test 6 was migrated in-place (no net change to its slot).

## Threat Model Outcomes

| Threat   | Disposition | Outcome                                                                                                                                                    |
| -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-11-01 (client half) | mitigated | Raw `cohortId` moves from URL to JSON body. URL is now the literal `'/api/audit/events/view-open'` — test 6 proves it with `expect(url).toBe(...)` + `expect(url).not.toContain('?')`. |
| T-11-08 (client spew of raw id via console / error) | mitigated | `.catch(() => { /* fire-and-forget (D-03) */ })` — no console.log, no console.error, no rethrow. Raw id never serialized to a debug sink.                   |
| T-11-09 (body fetched by third-party extensions) | accepted | Browser extensions with `webRequest` read access could observe the body. Out of scope for a same-origin first-party beacon; CSP `connectSrc: 'self'` restricts reach. Parity with legacy GET risk. |

## Deviations from Plan

None — plan executed exactly as written. TDD flow:
- RED commit added 4 failing beacon tests (migrated test 6 + new 6b/6c/6d) — all 4 failed against the GET/querystring implementation as designed.
- GREEN commit replaced the useEffect with POST+JSON+keepalive — all 4 newly failing tests passed, existing 16 OutcomesPage tests remained green, full suite stayed at 353 passing.
- No REFACTOR commit — the GREEN implementation is already minimal (no duplication, no cleanup debt).

## Commits

| Phase | Hash    | Message                                                                                |
| ----- | ------- | -------------------------------------------------------------------------------------- |
| RED   | 281678b | `test(11-03): migrate test 6 to POST/JSON body + add 6b/6c/6d (RED)`                   |
| GREEN | 9c5b042 | `feat(11-03): migrate beacon to POST with JSON body + keepalive (GREEN)`               |

Two commits atop base `7dd8165` (post-11-01). Pairs with 11-02 (parallel wave-2 sibling) to complete CRREV-01.

## Manual Smoke (from VALIDATION.md — not part of automated gate)

Once Plans 11-02 and 11-03 are both merged into the integration branch:
1. Open DevTools Network on `/outcomes?cohort=<saved-search-id>`.
2. Observe the `view-open` request.
3. Verify: method `POST`, URL has no querystring, request payload (Preview / Request tab) contains JSON with `cohortId`, response `204`.
4. Confirm `audit.db` row for that request has `body` containing `cohortHash` (16 hex), no raw `cohortId`, and `query` is NULL.

## Deferred Issues

**Out-of-scope observation (not caused by this plan):** Running the test suite produced two new untracked files under `feedback/` (`issue-2026-04-16T14-28-54-242Z_e08a11bd.json`, `issue-2026-04-16T14-28-54-256Z_c83db10b.json`). These are artifacts of `tests/issueApi.test.ts` writing into the real `feedback/` directory. The directory is tracked and has previously received manual `chore(feedback)` commits. Not related to any OutcomesPage or audit-beacon change. Flagged for future test-hygiene work — likely needs a test-time fixture directory or a post-test cleanup hook.

## Self-Check: PASSED

- `src/pages/OutcomesPage.tsx` — FOUND (modified)
- `tests/OutcomesPage.test.tsx` — FOUND (modified)
- Commit `281678b` — FOUND
- Commit `9c5b042` — FOUND
- `grep -q "fetch('/api/audit/events/view-open'," src/pages/OutcomesPage.tsx` — PASS
- `grep -q "method: 'POST'" src/pages/OutcomesPage.tsx` — PASS
- `grep -q "keepalive: true" src/pages/OutcomesPage.tsx` — PASS
- `grep -q "credentials: 'include'" src/pages/OutcomesPage.tsx` — PASS
- `grep -q "'Content-Type': 'application/json'" src/pages/OutcomesPage.tsx` — PASS
- `! grep -E "fetch\(.+/api/audit/events/view-open\?" src/pages/OutcomesPage.tsx` — PASS (no template literal with `?`)
- `URLSearchParams` occurrences in `src/pages/OutcomesPage.tsx` — 0 (beacon no longer uses it)
- Legacy test 6 `url.toContain('cohort=abc')` assertion — REMOVED
- Legacy test 6 `url.toContain('name=open_outcomes_view')` assertion — REMOVED
- Test 6/6b/6c/6d count in `tests/OutcomesPage.test.tsx` — 4 (grep match)
- `npm test -- tests/OutcomesPage.test.tsx --run` — 20/20 green
- `npm test -- --run` — 353/353 green across 34 files (baseline 350/34, +3 new beacon tests)
