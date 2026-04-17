# Phase 12: Server-Side Outcomes Pre-Aggregation — Context

**Gathered:** 2026-04-16
**Status:** Ready for planning
**Mode:** `--auto` — recommended options auto-selected; all choices logged inline below and in `12-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

Ship a server-side aggregation endpoint so `/analysis?tab=trajectories` remains responsive for cohorts > 1000 patients.

- **New endpoint:** `POST /api/outcomes/aggregate` accepting `{ cohortId, axisMode, yMetric, gridPoints, eye }` and returning `{ median, iqrLow, iqrHigh, perPatient?, scatter? }`.
- **Byte-identical parity** with the client `computeCohortTrajectory` math — no algorithmic drift.
- **Center-filtered from the JWT** (`req.auth.centers`), never from the request body.
- **Cacheable** per `{ cohortId, axisMode, yMetric, gridPoints, eye }` with explicit invalidation on cohort mutation.
- **Auto-routed** by the client when cohort size exceeds a threshold (default 1000, overridable via `settings.yaml`); below threshold the existing client path remains.
- **Audit event** `outcomes.aggregate` emitted via the Phase 11 `hashCohortId` utility (AGG-05).

Out of scope: new metrics (Phase 13), UI chart changes, schema migrations.
</domain>

<decisions>
## Implementation Decisions

### Code Sharing (client ↔ server)
- **D-01:** Promote `src/utils/cohortTrajectory.ts` to a shared module both client and server import from — single source of truth for median / IQR / interpolation math.
  - Chosen location: `shared/cohortTrajectory.ts` (TS project root), with `src/utils/cohortTrajectory.ts` re-exporting from the shared module for backward compatibility.
  - Rationale: AGG-02 demands byte-identical aggregation; a shared module is the only option that enforces parity by construction (vs duplication + round-trip test alone).
  - Auto-selected vs alternatives: (A) server imports via tsconfig path alias — rejected, brittle at build time; (B) duplicate code + round-trip test — rejected, drift-prone.

### Endpoint Contract
- **D-02:** Endpoint path: `POST /api/outcomes/aggregate`. Body: `{ cohortId: string, axisMode: "days" | "treatments", yMetric: "absolute" | "delta" | "delta_percent", gridPoints: number, eye: "od" | "os" | "combined", spreadMode?: "iqr" | "sd1" | "sd2", includePerPatient?: boolean, includeScatter?: boolean }`.
- **D-03:** Response: `{ median: GridPoint[], iqrLow: number[], iqrHigh: number[], perPatient?: PatientSeries[], scatter?: ScatterPoint[], meta: { patientCount, excludedCount, measurementCount, cacheHit: boolean } }`. Types reuse the `shared/cohortTrajectory.ts` exports.
- **D-04:** `perPatient` and `scatter` arrays are **opt-in** via request flags (default `false`). Full per-patient payload for 1000+ patients is the very thing we're trying to avoid sending over the wire; include only when the client layer toggle is on.

### Authorization Gate
- **D-05:** Center filter is applied **inside the handler** from `req.auth.centers` (populated by `authMiddleware` on the Express stack). The request body's `centers` field — if any — is ignored.
- **D-06:** Cohort lookup uses the authenticated user's saved-search store; requests for cohort ids not owned by the caller return `403` with a generic message.
- Rationale: Mirrors security-first convention from MEMORY.md — server-side enforcement, no client trust.

### Cache Backend
- **D-07:** In-memory `Map<cacheKey, { result, expires }>` inside the handler module, with TTL safety net (default 30 min) plus explicit invalidation. No new dependency. Survives until process restart — acceptable for the demonstrator.
- **D-08:** `cacheKey = JSON.stringify({ cohortId, axisMode, yMetric, gridPoints, eye, spreadMode, includePerPatient, includeScatter, user })` — user-scoped so two users with the same cohort id (different center sets) don't share entries.
  - Auto-selected vs alternatives: (B) disk JSON cache — rejected, adds I/O overhead with no correctness win at demonstrator scale; (C) ETag + browser Cache-Control — rejected, invalidation on cohort mutation is opaque to the browser.

### Cache Invalidation
- **D-09:** Explicit invalidation hook — when `dataApi` saved-search update/delete fires for a cohort id, drop all cache entries whose key includes that cohort id.
- **D-10:** TTL (default 30 min, override via `settings.yaml` `outcomes.aggregateCacheTtlMs`) as safety net against missed invalidation paths.
- Rationale: Mirrors Phase 11's "fail-safe redundant check" pattern (SKIP_AUDIT_PATHS + handler field selection).

### Configuration
- **D-11:** Threshold and cache TTL live in `config/settings.yaml` under a new `outcomes:` section:
  ```yaml
  outcomes:
    serverAggregationThresholdPatients: 1000
    aggregateCacheTtlMs: 1800000   # 30 minutes
  ```
- **D-12:** Non-admin GET `/api/settings` exposes both fields (they are not sensitive — no strip needed). Admins can edit via PUT `/api/settings`.
- Rationale: MEMORY.md "Config in settings.yaml — no env vars".

### Client Routing
- **D-13:** `src/components/outcomes/OutcomesView.tsx` adds a size check against `settings.outcomes.serverAggregationThresholdPatients` (fetched once on mount via existing `settingsService`). If `cohort.cases.length > threshold`, use `fetch POST /api/outcomes/aggregate`; else compute client-side via `computeCohortTrajectory` unchanged.
- **D-14:** Loading state: show a subtle "Computing on server..." indicator while the POST is in flight. No full-page spinner — panels remain visible with their last-good grid (or empty state for first load).

### Response Compression
- **D-15:** Mount Express `compression()` middleware on `/api/outcomes/aggregate` (route-scoped, not global — keeps raw-stream consumers untouched per the Phase 11 scoped-middleware precedent). Default gzip/deflate.

### Audit Event (AGG-05)
- **D-16:** Handler writes an `outcomes.aggregate` audit row via the Phase 11 `SKIP_AUDIT_PATHS` + handler-own-row pattern. Row body: `{ name: "outcomes.aggregate", cohortHash: hashCohortId(cohortId), user, centers, payloadBytes, cacheHit }`. Never the raw `cohortId`.
- **D-17:** Add `/api/outcomes/aggregate` to `SKIP_AUDIT_PATHS` in `server/auditMiddleware.ts` so the generic middleware does not double-write.

### Claude's Discretion
- The specific Express compression library (`compression` npm package is ~6M downloads/week, already a peer dep of many Express apps we use) — planner picks if an alternative is meaningfully better.
- The `meta.cacheHit` plumbing: small detail, planner decides where this is set (handler vs cache wrapper).
- Order of handler operations: auth → cohort lookup → cache read → compute → cache write → audit → respond. Planner may reorder within the security envelope (auth first, audit last).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 12 scope (authoritative)
- `.planning/ROADMAP.md` §"Phase 12: Server-Side Outcomes Pre-Aggregation" — 5 success criteria + dependency note
- `.planning/REQUIREMENTS.md` §"Server-Side Pre-Aggregation (AGG)" — AGG-01 through AGG-05 full text

### Reusable primitives from prior phases
- `src/utils/cohortTrajectory.ts` — pure math to be promoted to `shared/cohortTrajectory.ts` (D-01)
- `server/hashCohortId.ts` — Phase 11 HMAC-SHA256 utility reused by AGG-05 audit event
- `server/auditMiddleware.ts` §`SKIP_AUDIT_PATHS` — Phase 11 skip-list pattern this phase extends (D-17)
- `server/authMiddleware.ts` — populates `req.auth.centers` used by D-05 center filter
- `server/auditApi.ts` §handler-own-row pattern — template for D-16 audit write
- `config/settings.yaml` — shape to extend with `outcomes.*` section (D-11)
- `server/settingsApi.ts` §`stripSensitiveAudit` — pattern for admin-only stripping (non-sensitive here, but follow same structure)

### Architectural guidance
- `.planning/phases/11-audit-beacon-pii-hardening/11-SECURITY.md` — trust boundaries + accepted risks that carry forward
- `.planning/phases/11-audit-beacon-pii-hardening/11-CONTEXT.md` — Phase 11 decisions on scoped vs global middleware
- `.planning/PROJECT.md` — core value "authorized data, tamper-proof audit trail" — AGG-05 is this value applied to the aggregation path

### Memory-file decisions
- [Security-first approach](~/.claude/projects/.../feedback_security_first.md) — audit immutability, server-side enforcement, no client trust
- [Config in settings.yaml](~/.claude/projects/.../feedback_config_settings_yaml.md) — Single config source, no env vars

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/utils/cohortTrajectory.ts` (504 lines, pure math, no I/O): `computeCohortTrajectory(cases, opts) -> TrajectoryResult`. Exports `AxisMode`, `YMetric`, `SpreadMode`, `Eye`, `Measurement`, `PatientSeries`, `GridPoint`, `PanelResult`, `TrajectoryResult`. **Directly importable server-side once promoted to `shared/`**.
- `server/hashCohortId.ts` — `hashCohortId(id) -> string` HMAC-SHA256, 16-hex digest. Direct reuse for AGG-05.
- `server/auditDb.ts` §`logAuditEntry(row)` — async write to `data/audit.db`. Template the `outcomes.aggregate` row on the existing `view-open` entry in `server/auditApi.ts:114-135`.
- `server/authMiddleware.ts` — validates JWT, populates `req.auth: { preferred_username, role, centers[] }`. Aggregation handler must be mounted behind this middleware.
- `server/dataApi.ts` — saved-search CRUD; subscribe invalidation on mutation (D-09).

### Established Patterns
- Scoped body parser (Phase 11 precedent): `app.use('/api/outcomes/aggregate', express.json({ limit: '64kb' }))` before the handler — cohort id + flags are small, 64kb is generous.
- Scoped middleware (Phase 11): add `compression()` only on the aggregate route (D-15), not global.
- Handler-own audit row (Phase 11 Plan 02): skip-list + explicit `logAuditEntry` call — reused for D-16/D-17.
- Settings strip (Phase 11 Plan 01 `stripSensitiveAudit`): mirror the pattern for any future outcomes config that is admin-only (not needed for D-11/D-12 currently — both fields are non-sensitive).

### Integration Points
- **Client call site:** `src/components/outcomes/OutcomesView.tsx:124-128` — existing `computeCohortTrajectory` useMemo is where the server/client routing branch goes (D-13).
- **Server mount:** `server/index.ts` between `initHashCohortId(settings)` and `app.listen(...)` — register the new route alongside `auditApi`.
- **Cache-invalidation hook:** `server/dataApi.ts` saved-search mutation handlers emit an event; the aggregate module subscribes.
- **Settings read:** Client fetches `outcomes.serverAggregationThresholdPatients` via the existing `settingsService.getSettings()` on mount.

</code_context>

<specifics>
## Specific Ideas

- Keep the client `computeCohortTrajectory` path UNCHANGED below threshold — this is a routing enhancement, not a rewrite. Regression protection for small cohorts is free.
- The parity test (AGG-02) is the correctness linchpin. Frame it as: seed a synthetic cohort of 50 cases, run `computeCohortTrajectory` client-side (via Node, since it's pure math), run the HTTP endpoint against the same seed, `JSON.stringify` both results, assert exact string equality. No tolerance, no fuzzy compare.
- Audit row payload size (D-16 `payloadBytes`) is measured BEFORE compression — it's the logical size for rate-limiting / abuse detection, not wire bytes.
- When cache hits, the audit event still fires with `cacheHit: true`. Every aggregation view is audit-logged exactly once per request.

</specifics>

<deferred>
## Deferred Ideas

- **Persistent cache** — disk-backed aggregate cache that survives restart. Out of scope; in-memory is sufficient for demonstrator. Revisit if cohort stability is observed to be high.
- **Streaming response** — NDJSON / chunked for very large cohorts. Out of scope; compression + opt-in `perPatient` should keep payloads manageable.
- **Client-side pre-warming** — e.g., warm the cache when a user opens Cohort Builder. Out of scope; reactive caching is simpler.
- **Per-metric aggregation support beyond visus** — belongs to Phase 13 (New Outcome Metrics). Noted in ROADMAP.
- **Rate limiting on the aggregate endpoint** — the existing `server/rateLimiting.ts` pattern is ready to apply but not in-scope for AGG-01..05. Revisit if abuse is observed.

</deferred>

---

*Phase: 12-server-side-outcomes-pre-aggregation*
*Context gathered: 2026-04-16*
