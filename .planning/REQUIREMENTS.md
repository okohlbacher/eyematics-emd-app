# Requirements — v1.12 Quality, Configurability & Analysis Depth

**Milestone:** v1.12 · **Defined:** 2026-05-25
**Source:** v1.10 UAT feedback reconciled against shipped v1.11 + CODEX Tier-C deferrals. See `.planning/v1.12-roadmap-PROPOSAL.md` (CODEX-converged; decisions D1/D1b/D2/D3 + PROT-001 locked 2026-05-25).

## v1.12 Requirements

### AUDIT — Audit / Protocol correctness
- [x] **AUDIT-01**: Unauthenticated/401 requests are recorded in the audit log with actor `unauthenticated` (not `anonymous`); deleted users retain their immutable historical actor on past entries. (PROT-001)

### CFG — Configurable clinical thresholds
- [x] **CFG-01**: Admins can view and edit the critical/action clinical thresholds (CRT critical, Visus critical, IOP critical, Visus-jump, therapy interrupter/breaker days) in the Settings UI; values persist to `config/settings.yaml`. (ANL-004, F-02)
- [x] **CFG-02**: Plausibility ranges (Visus, CRT, IOP min/max) are centralized to `config/settings.yaml` and admin-editable in the Settings UI. (D1b)
- [x] **CFG-03**: Server-side outcome aggregation applies the same settings-derived thresholds as the client (no client/server divergence for preset cohorts); aggregate cache is keyed/invalidated on threshold change. (F-01)

### QUAL — Data-quality module
- [x] **QUAL-020**: A user can run the quality review scoped to a selected cohort/subcohort (not only the global set). (QUAL-001)
- [x] **QUAL-021**: A user can select which parameters are checked for a selected subcohort; the selection persists with the saved cohort. (EMDREQ-QUAL-001, D2)
- [x] **QUAL-022**: The Grundgesamtheit (population denominator) on the quality page reflects the active time-range filter. (QUAL-011)
- [x] **QUAL-023**: Absolute counts (not only percentages) are clearly discoverable on the quality overview. (QUAL-011)
- [x] **QUAL-024**: A user can filter quality (and analysis) by multiple centers at once; the server still restricts results to the user's authorized centers. (QUAL-011, D3)
- [x] **QUAL-025**: The approve/flag-status control in quality case detail is reachable without scrolling past all patient data. (QUAL-006)

### ANL — Analysis comparison & labeling
- [x] **ANL-010**: When comparing cohorts, each plot (incl. the interval histogram) clearly labels which cohort each series represents. (ANL-002)
- [x] **ANL-011**: The Aggregated tab supports comparison between cohorts (e.g. diagnosis distribution, age-vs-Visus). (ANL-003)
- [x] **ANL-012**: The active cohort/filter name is shown in Analysis when a filter is loaded directly (`?filters=`), not only via the saved-search path. (KOH-005)

### FALL — Case view
- [x] **FALL-010**: A user can drill from a chart data point in the trajectory plots to the corresponding case detail. (FALL-001)
- [x] **FALL-011**: The case view can show cohort reference values for comparison against the single case. (FALL-006)
- [x] **FALL-012**: Case-detail chart labels are self-explanatory — CRT legend label, Visus measurement-type (axis/legend), and the interpolation ("open circle") legend wording. (FALL-003)
- [x] **CHART-01**: Trajectory/analysis chart polish — missing axis ticks rendered (A-06); responder "(i)" tooltip placed adjacent to the plot. (A-06, ANL-002)

### SEC — Saved-search hardening
- [x] **SEC-06**: SavedSearch `id`/`createdAt` are generated server-side and incoming `filters` are sanitized at the API boundary; existing saved searches migrate cleanly. (F-13)

### TECH — Tech-debt compaction (behavior-preserving)
- [x] **TECH-01**: `server/authApi.ts` is split into cohesive routers (login / user-admin / totp / session) with no behavior change; tests green. (F-09)
- [x] **TECH-02**: `src/components/outcomes/OutcomesView.tsx` is decomposed into hooks + metric containers with no behavior change; tests green. (F-10)

## Future Requirements (deferred)
- Per-site / per-cohort clinical thresholds (threshold-snapshot provenance) — deferred from D1.
- QUAL-004 imputation / auto-suggest missing values.

## Out of Scope
- **F-03** Keycloak dead-path removal — blocked by KEYCLK-01 / M7 (no live Keycloak instance).
- Real Keycloak OIDC redirect flow (KEYCLK-01) — blocked by M7.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUDIT-01 | Phase 38 | Complete |
| CFG-01 | Phase 39 | Complete |
| CFG-02 | Phase 39 | Complete |
| CFG-03 | Phase 39 | Complete |
| SEC-06 | Phase 40 | Complete |
| QUAL-020 | Phase 40 | Complete |
| QUAL-021 | Phase 40 | Complete |
| QUAL-022 | Phase 41 | Complete |
| QUAL-023 | Phase 41 | Complete |
| QUAL-024 | Phase 41 | Complete |
| QUAL-025 | Phase 41 | Complete |
| ANL-010 | Phase 42 | Complete |
| ANL-011 | Phase 42 | Complete |
| ANL-012 | Phase 42 | Complete |
| FALL-010 | Phase 43 | Complete |
| FALL-011 | Phase 43 | Complete |
| FALL-012 | Phase 43 | Complete |
| CHART-01 | Phase 43 | Complete |
| TECH-01 | Phase 44 | Complete |
| TECH-02 | Phase 44 | Complete |

*Phases 37 (UAT re-test & spec lock) and 45 (UAT validation & close) are process/feedback phases with no feature REQ-IDs; their work is captured as phase success criteria.*
