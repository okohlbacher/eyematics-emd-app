# Requirements: EMD Backend Redesign — Milestone v1.11

**Defined:** 2026-05-21 (UAT batch 1 integrated)
**Core Value:** Every user sees only authorized data, with a tamper-proof audit trail — while maintaining the zero-friction local development experience.
**Milestone goal:** Deliver the v1.10 UAT-driven fixes and feature requests (batch 1 below), close all open gaps and accepted tech debt, and run an adversarial CODEX architecture review to compact the codebase.

> Source for the feature requirements below: `EMD-v1.10-Changelog-Feedback_discussion.docx` — "UAT Status/TODO" column of the USM / DAT / KOH tables (batch 1). Further UAT batches (incl. subcohort addenda) may extend this list later.

## v1.11 Requirements

### User Management (UMGMT)

- [x] **UMGMT-01**: The "at least one assigned center" requirement is enforced in the admin **edit-user** dialog, not only on create (source: USM-001)
- [x] **UMGMT-02**: All user fields are mandatory (non-empty) with inline validation errors in **both** the create and edit user dialogs (source: USM-001/USM-002)
- [x] **UMGMT-03**: Users have an activation status — an `active` flag (default `true`) on the user model; an admin can de/reactivate a user via a checkbox; an inactive user cannot authenticate; deactivating a user immediately revokes their active sessions (mirrors PROT-001 delete behavior) (source: USM-002, reject overturned — confirmed in requirements)

### Auth Feedback & Configuration (AUTHCFG)

- [x] **AUTHCFG-01**: After the first failed login the login page shows the number of attempts remaining, and when locked it shows the remaining lockout time (source: USM-006)
- [x] **AUTHCFG-02**: The inactivity warning banner shows a live countdown of time remaining; the warning lead time is 3 minutes before logout (source: USM-008)
- [x] **AUTHCFG-03**: `INACTIVITY_TIMEOUT` and `WARNING_BEFORE` are sourced from `config/settings.yaml` (no hardcoded client constants in `src/context/AuthContext.tsx`) (source: USM-008)
- [x] **AUTHCFG-04**: `maxLoginAttempts` and the lockout duration are sourced from `config/settings.yaml`, replacing the hardcoded values in `server/initAuth.ts` and any client equivalent (source: USM-008)

### Dashboard / Data Completeness (DASH)

- [x] **DASH-01**: Patient-stub + consent model for "Datenvollzähligkeit":
  - Add FHIR `Consent` resources with a research-use policy for the existing synthetic patients (the consented cohort)
  - Generate patient **stubs** at a configurable multiplier (default ~4–5× the consented count) carrying only encounter date, gender (m/f), and year of birth — nothing else
  - The dashboard shows the total patient count (consented + stubs) and the consented count, and surfaces **Datenvollzähligkeit** = consented ÷ total (fraction of patients amenable to research)
  - **Stub isolation (H2):** stubs are **excluded from all clinical surfaces** — cohort building, outcomes/trajectories, quality review, case detail, charts — and appear **only** in the Datenvollzähligkeit denominator. Stubs are **site-attributed** so the metric honors per-user site restriction. Adding stubs must not regress FHIR load performance or the >1000-patient server-aggregation routing.
  - (source: DAT-003 — corrects the earlier incorrect single-count fix)
- [x] **DASH-02**: The dashboard "Attention needed" Review buttons route correctly — 'Prüfen' / 'Therapie-Abbrecher' lands on the right patient or a pre-filtered issue cohort rather than the wrong place (source: DAT----; depends on COH-03)

### Cohort Builder (COH)

- [x] **COH-01**: Cohort-builder plausibility checks — the lower age bound cannot exceed the upper bound; Visus input is constrained to the 0–1 decimal range; non-numeric and negative inputs are rejected on age/Visus/CRT (source: KOH-002)
- [x] **COH-02**: Cohort filter state is persisted across the full navigation path for the session (client-side, not server-side), with a reset control to clear filters on demand (source: KOH-003, promoted from backlog)
- [x] **COH-03**: Issue-based cohort presets are available in cohort selection and wired to the dashboard Review buttons — **Therapie-Abbrecher** (existing IVI-gap > `therapyBreakerDays` rule), **Unplausible CRT-Werte** (outside `clinicalThresholds`), **Flagged data-quality cases**, and **Implausible Visus** (outside 0–1) (source: KOH-001 / DAT----)
- [x] **COH-04**: An advanced filter dialog exposes additional fields. A spike first evaluates rolling **all available data-model fields** into the dialog; the spike outcome (full-field vs a curated 5–10 attribute set such as diagnosis subtype, comorbidities, HbA1c, drug/agent, laterality) is **recorded as a decision**, then the chosen approach is implemented (source: KOH-001)

### Architecture Review & Compaction (ARCH)

Adversarial, in-depth review of the entire existing codebase conducted with CODEX, targeting a more compact, less bloated design. Sequenced **after** the UAT feature work and V&V backfill so it accounts for the new code.

- [ ] **ARCH-01**: A full-codebase adversarial review is conducted with CODEX covering architecture, separation of concerns, and overall design, producing a severity-classified findings report (e.g. `.planning/reviews/v1.11-arch-review/`)
- [ ] **ARCH-02**: Review findings are distilled into a prioritized compaction / de-bloat plan with concrete file references — dead code, redundant or premature abstractions, duplicated logic, oversized modules, and separation-of-concerns violations
- [ ] **ARCH-03**: Approved compaction remediations are applied with no behavior regressions: `npm run test:ci` stays green, `npm run knip` reports no new dead code, and `npm run lint` passes

### Tech-Debt / Verification & Validation Closure (VVBACK)

> **H1 (anchor to git tag):** the VVBACK-01/02 verification documents the v1.10 phases **as shipped**. All code references cite the **`v1.10`** git tag (tags `v1.10` / `v1.10-phase28` exist), so the paper trail is immune to the UAT code changes in Phases 32–34 and the Phase 36 compaction. This removes the false ordering dependency — V&V backfill does not depend on the feature phases.

- [ ] **VVBACK-01**: Phase 27 (stateful session backend) has a `VERIFICATION.md` produced by goal-backward analysis (SESS-02/03/04), each criterion mapped to code refs **at the `v1.10` tag** + passing tests
- [ ] **VVBACK-02**: Phase 28 (admin session control UI) has a `VERIFICATION.md` produced by goal-backward analysis (SESS-01 + SESSUI-01/02/03), each criterion mapped to code refs **at the `v1.10` tag** + passing tests
- [ ] **VVBACK-03**: Phases 27, 28, and 29 each have a `VALIDATION.md` at `nyquist_compliant: true` / `wave_0_complete: true`, with any coverage gaps filled by passing tests
- [ ] **VVBACK-04**: Phase 31's `VALIDATION.md` `wave_0_complete` is resolved to `true`, and every v1.10 phase `VALIDATION.md` (27–31) `status: draft` is flipped to final
- [ ] **VVBACK-05**: `npm run test:ci` passes (zero failures) after all feature, backfill, review, and compaction work; STATE.md / PROJECT.md / MILESTONES.md deferred-debt entries are updated to reflect closure

## Future Requirements

Deferred to a later milestone. Tracked but not in this roadmap.

### Authentication

- **KEYCLK-01**: Real Keycloak OIDC redirect flow — blocked at `initAuth` until the redirect flow ships (M7); needs a live Keycloak instance

### Backlog carried from v1.10 UAT (not in batch 1)

- **ANL-002**: Interval histogram in cohort-comparison mode; aggregated-vs-trajectory visus calc indicator
- **ANL-003**: Cohort comparison in the aggregated tab
- **ANL-004**: UI configuration of critical clinical thresholds
- **FALL-001**: Direct chart→case-detail navigation; **FALL-006**: extended case↔cohort comparison
- **QUAL-001**: Cohort-based quality checks; **QUAL-004**: imputation auto-suggest
- **A-06**: Missing axis ticks (needs screenshot to reproduce); **A-09**: period badge in QualityPage population

## Out of Scope

| Feature | Reason |
|---------|--------|
| KEYCLK-01 (Keycloak OIDC redirect flow) | Blocked on a live Keycloak instance; remains in backlog |
| Regenerating the curated reference bundles (Aachen, Tübingen) | D-06 — reference bundles are curated and must not be regenerated; DASH-01 consent/stubs apply to the synthetic bundles (and any reference-bundle consent is added without regenerating curated data) |
| ANL / FALL / QUAL backlog items above | Not part of UAT batch 1; revisit in a later batch |
| QUAL multi-select center, configurable check parameters | Rejected in v1.10 UAT (not in EMDREQ) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| UMGMT-01 | Phase 32 | Done ✅ |
| UMGMT-02 | Phase 32 | Done ✅ |
| UMGMT-03 | Phase 32 | Done ✅ |
| AUTHCFG-01 | Phase 32 | Done ✅ |
| AUTHCFG-02 | Phase 32 | Done ✅ |
| AUTHCFG-03 | Phase 32 | Done ✅ |
| AUTHCFG-04 | Phase 32 | Done ✅ |
| DASH-01 | Phase 34 | Complete |
| DASH-02 | Phase 33 | Complete |
| COH-01 | Phase 33 | Complete |
| COH-02 | Phase 33 | Complete |
| COH-03 | Phase 33 | Complete |
| COH-04 | Phase 33 | Complete |
| ARCH-01 | Phase 36 | Pending |
| ARCH-02 | Phase 36 | Pending |
| ARCH-03 | Phase 36 | Pending |
| VVBACK-01 | Phase 35 | Pending |
| VVBACK-02 | Phase 35 | Pending |
| VVBACK-03 | Phase 35 | Pending |
| VVBACK-04 | Phase 35 | Pending |
| VVBACK-05 | Phase 36 | Pending |
