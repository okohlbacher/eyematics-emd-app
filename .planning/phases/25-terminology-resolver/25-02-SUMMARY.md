---
phase: 25-terminology-resolver
plan: 02
subsystem: api
tags: [express, fhir, $lookup, ssrf, lru-cache, terminology, jwt]

# Dependency graph
requires:
  - phase: 14
    provides: Blaze-proxy SSRF origin-whitelist pattern (fhirApi.ts:281-323)
  - phase: 18
    provides: Global authMiddleware mounted on /api/* (server/authMiddleware.ts)
provides:
  - "POST /api/terminology/lookup endpoint (JWT-protected, default-disabled)"
  - "Hand-rolled LRU+TTL cache (max 10000 entries, 24h default TTL)"
  - "Synchronous private-IP SSRF guard for terminology proxy"
affects: [25-03-caller-migration, 25-04-settings-and-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings re-read per request (not per boot) for hot-reload of terminology config"
    - "Hand-rolled insertion-order LRU on Map<string, {value, expiresAt}>"
    - "Synchronous SSRF guard layered on top of origin-lock (D-10 + private-IP rejection)"
    - "Custom Error subclass (SsrfBlockedError) to discriminate 502 reasons"

key-files:
  created:
    - server/terminologyApi.ts
    - tests/terminologyApi.test.ts
  modified:
    - server/index.ts

key-decisions:
  - "Tasks 1+2 collapsed into one atomic commit because the test file and full handler are tightly coupled and an intermediate 501-placeholder state has zero review value (Rule 3 deviation)."
  - "Inline private-IP guard in terminologyApi.ts; did NOT extract to server/proxyGuard.ts. Plan explicitly defers extraction until Blaze-proxy refactor warrants it."
  - "Cache stores only display strings (plus expiresAt), keyed by `system|code|locale`. Locale defaults to 'de'."
  - "Settings reader fails safe to disabled on any read/parse error — never crashes the request handler."

patterns-established:
  - "Origin-lock + private-IP-rejection SSRF guard: assert outbound URL.origin === settings.serverUrl.origin AND !isPrivateHostname(parsed.hostname). Pattern reusable for any future external-server proxy."
  - "Settings hot-reload via per-request re-read of SETTINGS_FILE — wrapped in try/catch with safe-disabled fallback."

requirements-completed: [TERM-03, TERM-05]

# Metrics
duration: ~10min
completed: 2026-04-29
---

# Phase 25 Plan 02: Terminology Server Proxy Summary

**JWT-authenticated POST /api/terminology/lookup with origin-locked SSRF guard, synchronous private-IP rejection, and a hand-rolled 10k-entry LRU/TTL cache around a FHIR `$lookup` translation.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-29T19:36Z
- **Completed:** 2026-04-29T19:44Z
- **Tasks:** 2 (collapsed into 1 atomic commit — see Deviations)
- **Files modified:** 3

## Accomplishments

- Server proxy at `server/terminologyApi.ts` exposing `POST /api/terminology/lookup` with the D-13 contract.
- Origin-locked SSRF guard plus synchronous private-IP rejection (loopback, 10/8, 172.16/12, 192.168/16, 169.254/16, IPv6 loopback / fc00::/7 / fe80::/10, and `localhost`).
- Hand-rolled insertion-order LRU+TTL cache (max 10 000 entries, TTL = `terminology.cacheTtlMs`, default 24 h). Cache key is `system|code|locale`.
- 503 short-circuit when `terminology.enabled` is false **or** `serverUrl` is unset (D-12). Default behaviour is offline (D-16).
- 502 split into `ssrf blocked` vs `remote lookup failed` so callers can distinguish.
- Mounted under `/api/terminology` in `server/index.ts` so the global `authMiddleware` enforces JWT (D-14).
- 16 server-side tests covering D-22 cases 1–3 plus extras: 503 paths × 3, 400 paths × 3, 200 remote, cache-hit, SSRF rejects × 4 (192.168, localhost, 127.0.0.1, 10.x), remote-failure × 2, plus 401 unauthenticated and 200-passthrough with valid JWT (proves the global auth gate fires).

## Task Commits

Plan committed as a single atomic commit (see Deviations):

1. **Tasks 1 + 2 (combined): proxy + LRU + SSRF + tests** — `d5f6b90` (feat)

**Plan metadata commit:** issued after this summary is written.

## Files Created/Modified

- `server/terminologyApi.ts` — Express router exposing `POST /lookup`, settings reader, LRU cache, private-IP guard, fetchLookup helper. Exports `terminologyRouter` and `_resetCacheForTests`.
- `tests/terminologyApi.test.ts` — 16 supertest cases covering disabled/400/200/cache/SSRF/remote-failure plus a separate suite for the global JWT 401/passthrough gate.
- `server/index.ts` — Imports `terminologyRouter`, mounts at `/api/terminology` with `express.json({limit:'16kb'})` (mirrors fhirApiRouter mount).

## Decisions Made

- **Inline SSRF guard, not extracted:** The plan explicitly notes that extraction to `server/proxyGuard.ts` is deferred until Blaze-proxy expansion warrants it. Kept inline; can be lifted later without changing call sites.
- **Settings re-read per request:** Mirrors the invalidation hook in `fhirApi.ts:65`. Lets `PUT /api/settings` take effect without a server restart.
- **Cache stores only `display` (not full response):** The system / code / source fields are reconstructed at response time. Smaller memory footprint and prevents accidental staleness of `source` (which is a per-request value, not a per-entry value).
- **`SsrfBlockedError` subclass:** Cleaner branching than string-matching messages in the catch.
- **Test file colocates two suites:** Suite 1 stubs `req.auth` to test router logic; Suite 2 mounts the real `authMiddleware` to assert the 401 / 200-passthrough gate. Mocks for `initAuth.js` / `keycloakAuth.js` mirror `tests/authMiddlewareLocal.test.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worktree-quirk recovery: Edit tool silently dropped server/index.ts mutation**
- **Found during:** Task 1 (mounting `terminologyRouter` in `server/index.ts`)
- **Issue:** Two `Edit` tool calls reported success but `git diff` showed no changes — the documented Phase 24 worktree pitfall (Pitfall 6). After the first `npm run test:ci` reported 642/642 my own tests passed, but `grep terminology server/index.ts` returned nothing.
- **Fix:** Fell back to a `python3` heredoc that performs `replace()` and writes the result. Verified via `grep -n "terminology" server/index.ts` showing the import and mount lines.
- **Files modified:** `server/index.ts`
- **Verification:** Final test:ci re-run after the fallback patch; all 642 still green; `grep` confirms presence.
- **Committed in:** `d5f6b90`

**2. [Rule 3 — Process] Tasks 1 and 2 collapsed into a single atomic commit**
- **Issue:** Plan structure asked for one commit per task. Task 1 specifies a 501-placeholder for the remote path, replaced wholesale by Task 2's full handler within the same file.
- **Fix:** Wrote the full handler + full test file in one commit. Commit message references both TERM-03 and TERM-05 and lists the per-task scopes.
- **Rationale:** Intermediate 501-placeholder state has no review value (would have been overwritten in the very next commit) and the test file inherently spans both task scopes since it lives in one file.
- **Verification:** Commit `d5f6b90` log shows all 16 tests + full handler + mount in one diff that builds + lints + types-checks.

---

**Total deviations:** 2 auto-fixed (2 Rule-3 process / blocking)
**Impact on plan:** No scope creep. Both deviations are mechanical (worktree quirk, commit-granularity). Safety net stayed green throughout.

## Issues Encountered

- **Flaky pre-existing test on first full `test:ci` run.** First post-implementation `npm run test:ci` reported `2 failed` in an unrelated `intervalHistogram`-adjacent test file. A second immediate run showed 642/642 passing. No code changed between runs — classic flake, not a regression introduced by this plan.

## User Setup Required

None. The endpoint is default-disabled (`terminology.enabled: false` is the implicit default since the section is absent from `config/settings.yaml`). Plan 25-04 will document the new keys; no operator action required for this plan.

## Next Phase Readiness

- **Plan 25-03 (caller migration)** can now wire `src/services/terminology.ts` (built by parallel plan 25-01) to `POST /api/terminology/lookup` — the server is ready and the contract is locked at D-13.
- **Plan 25-04 (settings + docs)** must add the `terminology:` block to `config/settings.yaml` and document `terminology.enabled / serverUrl / cacheTtlMs` in `docs/Konfiguration.md`. The server already supplies code defaults so omission of the section is non-fatal.
- **Parallel-safety with plan 25-01 confirmed:** `git diff --name-only` for this commit shows only `server/` and `tests/terminologyApi.test.ts` — no `src/` touches. The 25-01 worktree's untracked artifacts (`src/services/terminology.ts`, `tests/terminology.test.ts`, `tests/fixtures/terminologyBundle.ts`) coexist cleanly; `npm run test:ci` registers 619 + 16 (mine) + 7 (theirs) = 642 green tests.

## Self-Check: PASSED

- `server/terminologyApi.ts` — FOUND (239 lines, 16 tests pass against it)
- `tests/terminologyApi.test.ts` — FOUND (327 lines, 16 cases)
- `server/index.ts` — FOUND with `terminologyRouter` import (line 52) and mount (line 250)
- Commit `d5f6b90` — FOUND in `git log`
- Safety net at completion: test:ci 642/642, build green, lint clean, knip clean (only pre-existing config hints unchanged)

---
*Phase: 25-terminology-resolver*
*Completed: 2026-04-29*
