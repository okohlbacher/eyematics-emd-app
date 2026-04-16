# Project Roadmap

**Project:** EyeMatics Clinical Demonstrator (EMD) — Backend Redesign

## Shipped Milestones

| Version | Name | Shipped | Phases | Archive |
|---------|------|---------|--------|---------|
| v1.0 | Foundational Backend (auth, audit, center restriction, Keycloak prep) | (earlier) | 1–6 | [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md) |
| v1.1 | Frontend ↔ Backend Wiring | (earlier) | — | [`milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md) |
| v1.5 | Site Roster Correction & Cohort Analytics | 2026-04-15 | 7–9 | [`milestones/v1.5-ROADMAP.md`](milestones/v1.5-ROADMAP.md) |

> Note: v1.2–v1.4 shipped between v1.1 and v1.5 but were not tracked in GSD artifacts; git history is authoritative for those releases.

## Current Milestone

**v1.6 — Outcomes Polish & Scale** (opened 2026-04-16)

**Goal:** Close v1.5 visual/UX QA gaps, unlock large-cohort performance via server-side pre-aggregation, extend outcome metrics beyond visus (CRT, treatment interval, responder classification), and resolve Phase 9 code-review INFO findings.

**Regression surface (non-negotiable, each phase):** v1.5 shipped with 313/313 tests green — no phase may regress this count. Center-filtering from JWT (v1.0) and DE+EN i18n completeness (v1.5) are hard gates on every applicable phase.

### Phases

- [ ] **Phase 10: Visual/UX QA & Preview Stability** — Close v1.5 human-QA items (admin filter, chart palette, IQR band, tooltips, empty states) and stabilize OutcomesDataPreview row keys.
- [ ] **Phase 11: Audit Beacon PII Hardening** — Replace cohort id in audit-beacon querystring with hashed id in event payload; establish the hashing pattern AGG-05 will reuse.
- [ ] **Phase 12: Server-Side Outcomes Pre-Aggregation** — Ship `POST /api/outcomes/aggregate`, byte-parity with client aggregation, cacheable, auto-routed at >1000-patient threshold.
- [ ] **Phase 13: New Outcome Metrics (CRT / Interval / Responder)** — Add three metrics with metric selector, deep-link, metric-aware CSV, and full DE+EN i18n.

### Phase Details

#### Phase 10: Visual/UX QA & Preview Stability
**Goal**: Every v1.5 visual/UX QA flag is closed with a verifiable test, and OutcomesDataPreview rows survive reordering without React key collisions.
**Depends on**: Nothing (independent; lands first to retire v1.5 audit gaps before larger work)
**Requirements**: VQA-01, VQA-02, VQA-03, VQA-04, VQA-05, CRREV-02
**Success Criteria** (what must be TRUE):
  1. Admin filter UI on the user-management page renders exactly the 7 EyeMatics sites (Aachen, Chemnitz, Dresden, Greifswald, Leipzig, Mainz, Tübingen) and filter selection narrows the user list correctly — locked by a snapshot test pinned to the 7-site roster.
  2. Median / per-patient / scatter series on `/outcomes` panels pass WCAG AA contrast against the panel background in both light and dark mode, codified by a contrast-unit test or visual-regression snapshot.
  3. IQR band renders with palette-consistent fill + stroke at every zoom level and disappears cleanly (no 0-height artifact) when `n < 2` at a grid point.
  4. Outcomes tooltip shows localized patient id / eye / x-value / y-value for scatter + median; per-patient tooltip is suppressed when that layer is toggled off.
  5. `/outcomes` empty states (no cohort selected / cohort with zero eligible measurements / cohort with all-filtered eyes) show distinct copy localized in DE + EN.
  6. `OutcomesDataPreview` rows use a stable composite key (`patientId|eye|timestamp`) — a React-key-uniqueness test passes when identical rows render in different orders.
**Plans** (6): 
**UI hint**: yes

- [ ] 10-01-chart-palette-contrast-PLAN.md — Chart palette extraction + WCAG AA contrast test (VQA-02)
- [ ] 10-02a-iqr-band-guard-PLAN.md — IQR band n<2 guard at math + DOM layers (VQA-03)
- [ ] 10-02b-tooltip-PLAN.md — Tooltip D-05 format + D-06 per-patient suppression (VQA-04)
- [ ] 10-03-empty-state-i18n-PLAN.md — Third empty-state variant + DE/EN copy (VQA-05)
- [ ] 10-04a-admin-center-filter-PLAN.md — AdminPage 7-site center filter + snapshot test (VQA-01)
- [ ] 10-04b-preview-row-keys-PLAN.md — OutcomesDataPreview stable composite row key + D-11 duplicate resolver (CRREV-02)

#### Phase 11: Audit Beacon PII Hardening
**Goal**: Cohort identifiers stop leaking into audit URLs; the hashing primitive that AGG-05 will reuse is established and unit-tested.
**Depends on**: Phase 10 (not technically — but sequenced after to keep Phase 12 unblocked; no shared artifacts)
**Requirements**: CRREV-01
**Success Criteria** (what must be TRUE):
  1. `GET /api/audit/events/view-open` no longer accepts or records cohort id in the querystring; request carries no cohort-identifying parameter in the URL.
  2. The audit DB row for an outcomes view-open contains the cohort reference as a hashed id in the event payload — verified by a test that seeds a cohort, triggers the beacon, and asserts the DB row has the hash (not the raw id).
  3. A reusable `hashCohortId(id)` utility lives in server code with a deterministic test (same input → same hash; different input → different hash) so AGG-05 can reuse it without duplication.
**Plans**: TBD

#### Phase 12: Server-Side Outcomes Pre-Aggregation
**Goal**: Cohorts >1000 patients render `/outcomes` without client-side jank; server aggregation is byte-identical to the client path at the grid level, cacheable, and center-filtered from the JWT.
**Depends on**: Phase 11 (reuses `hashCohortId` utility for AGG-05 audit event)
**Requirements**: AGG-01, AGG-02, AGG-03, AGG-04, AGG-05
**Success Criteria** (what must be TRUE):
  1. `POST /api/outcomes/aggregate` accepts `{ cohortId, axisMode, yMetric, gridPoints, eye }`, enforces center-filtering from the JWT (never the request body), and returns `{ median, iqrLow, iqrHigh, perPatient?, scatter? }`.
  2. A round-trip parity test seeds a cohort, runs the v1.5 client `aggregate` useMemo and the new server endpoint, and asserts `median` + `iqrLow` + `iqrHigh` arrays are byte-identical.
  3. Client `/outcomes` auto-routes to the server endpoint when cohort size exceeds the configured threshold (default 1000, overridable via `settings.yaml`); below threshold keeps the v1.5 client path — observable by a test that seeds cohorts above and below and asserts the code path taken.
  4. Response is cacheable per `{ cohortId, axisMode, yMetric, gridPoints, eye }` key with an explicit invalidation trigger on cohort mutation; cache hit path measurably faster than cold path and verified by a test.
  5. Endpoint emits an `outcomes.aggregate` audit event with hashed cohort id (via Phase 11 utility), user, center set, and payload size — verified by DB row assertion; no raw cohort id anywhere in the audit record.
**Plans**: TBD
**UI hint**: yes

#### Phase 13: New Outcome Metrics (CRT / Interval / Responder)
**Goal**: `/outcomes` supports Visus + CRT + Treatment-Interval + Responder metrics behind a metric selector, all deep-linkable, CSV-exportable, and fully localized DE + EN.
**Depends on**: Phase 12 (CRT panel reuses `POST /api/outcomes/aggregate` at the >1000-patient threshold; Phase 10 tooltip/empty-state infrastructure is prerequisite polish)
**Requirements**: METRIC-01, METRIC-02, METRIC-03, METRIC-04, METRIC-05, METRIC-06
**Success Criteria** (what must be TRUE):
  1. CRT trajectory panel mirrors the visus contract — OD / OS / OD+OS sub-panels, absolute + Δ + Δ% y-metrics, median / per-patient / scatter / IQR layers — sharing the axis-mode + grid-points controls (no duplicated control state).
  2. Treatment-interval distribution view renders a histogram of per-patient injection gaps (days between consecutive IVOM events) with a median line and is filterable by eye (OD / OS / both).
  3. Responder classification bucketizes cohort eyes into `responder` / `partial` / `non-responder` by configurable threshold (default Δvisus ≥ 5 letters @ 12 months) and displays bucket counts + median trajectory per bucket.
  4. Metric selector on `/outcomes` switches between Visus / CRT / Interval / Responder without a navigation, and `?metric=` query param deep-links to the selection — round-trip test: set param → refresh → same metric shown.
  5. CSV export for every metric emits metric-appropriate columns (e.g., CRT replaces `va_logmar` with `crt_um`) and the filename carries the metric slug — verified per-metric by a test.
  6. All new strings (panel titles, metric names, tooltip labels, empty-state copy, CSV headers) exist in DE + EN with an i18n completeness test in the v1.5 pattern — zero untranslated keys.
**Plans**: TBD
**UI hint**: yes

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Visual/UX QA & Preview Stability | 0/6 | Not started | — |
| 11. Audit Beacon PII Hardening | 0/TBD | Not started | — |
| 12. Server-Side Outcomes Pre-Aggregation | 0/TBD | Not started | — |
| 13. New Outcome Metrics (CRT / Interval / Responder) | 0/TBD | Not started | — |

### Coverage

- v1.6 requirements: 18
- Mapped: 18 (100%)
- Orphaned: 0

---

*Last updated: 2026-04-16 — v1.6 roadmap created (Phases 10–13, 18/18 requirements mapped).*
