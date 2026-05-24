# Phase 33: Cohort Builder UX & Advanced Filters - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 33-cohort-builder-ux-advanced-filters
**Areas discussed:** Input validation (COH-01), Filter persistence (COH-02), Presets + dashboard routing (COH-03/DASH-02), Advanced dialog + spike (COH-04)

---

## Input validation (COH-01)

### Q1 — Manual Visus filter bound vs the Implausible-Visus preset

| Option | Description | Selected |
|--------|-------------|----------|
| Manual filter 0–1; presets bypass | Visus fields reject >1 with inline error; Implausible-Visus preset uses a separate 'outside 0–1' predicate | ✓ |
| Keep 0–2, only block negative/non-numeric | Don't enforce 0–1 ceiling; only reject negatives/non-numbers | |
| Constrain 0–1 everywhere | Field + preset both clamp 0–1; implausible logic lives elsewhere | |

**User's choice:** Manual filter 0–1; presets bypass.

### Q2 — Result behaviour when a field is invalid

| Option | Description | Selected |
|--------|-------------|----------|
| Keep results live from valid filters | Inline error + Save disabled, but invalid field not applied; result count still reflects other filters | ✓ |
| Freeze results until fixed | Stop updating the list while any field is invalid | |

**User's choice:** Keep results live from valid filters.

---

## Filter persistence (COH-02)

### Q1 — Persistence mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory React context | Survives in-app navigation; lost on reload/tab close | |
| sessionStorage | Survives navigation AND full reload within tab; cleared on tab close | ✓ |
| URL query params | Shareable/reload-proof but clutters URLs; awkward for advanced fields | |

**User's choice:** sessionStorage.

### Q2 — Clear persisted filters on logout?

| Option | Description | Selected |
|--------|-------------|----------|
| Clear on logout | Wipe persisted filters at logout (security-first) | ✓ |
| Keep across logout | Treat as non-sensitive UI preference | |

**User's choice:** Clear on logout.

---

## Presets + dashboard routing (COH-03/DASH-02)

### Q1 — Preset home & representation

| Option | Description | Selected |
|--------|-------------|----------|
| All as cohort-builder presets | One-click preset buttons; extend filter engine with predicate presets | ✓ |
| Route by nature (hybrid) | Clinical presets in builder; Flagged routes to Quality view | |
| All route to Quality/issue views | Presets are shortcuts into QualityPage filters | |

**User's choice:** All as cohort-builder presets.

### Q2 — Ephemeral vs auto-created SavedSearch

| Option | Description | Selected |
|--------|-------------|----------|
| Ephemeral applied filter | Preset applies filter live; user Saves manually if desired | ✓ |
| Auto-created SavedSearch | Each preset materialises as a SavedSearch entry | |

**User's choice:** Ephemeral applied filter.

### Q3 — DASH-02 'Implausible CRT' button destination

| Option | Description | Selected |
|--------|-------------|----------|
| Its matching preset destination | Each Attention button → its corresponding cohort-builder preset | |
| A CRT-filtered Quality view | Keep CRT review on the Quality page, fixed to a CRT-specific filter | ✓ |

**User's choice:** A CRT-filtered Quality view.
**Notes:** Deliberate split — presets live in the cohort builder (COH-03, analysis intent) while dashboard Review buttons route to the Quality review surface (review intent). QualityPage needs a new CRT filter param to replace the wrong `status=flagged`.

---

## Advanced dialog + spike (COH-04)

### Q1 — Spike vs decide now

| Option | Description | Selected |
|--------|-------------|----------|
| Decide now: curated set | Skip the formal spike; commit to a curated 5–10 attribute set | ✓ |
| Run the recorded spike first | Spike evaluates full-field exposure, record outcome, then implement | |
| Decide now: full data-model fields | Expose all available fields dynamically | |

**User's choice:** Decide now: curated set. (Decision recorded in CONTEXT D-12 to satisfy COH-04's "recorded as a decision" criterion.)

### Q2 — Candidate attributes (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| Diagnosis subtype | Finer-grained condition codes beyond AMD/DR | ✓ |
| Comorbidities | Presence of additional conditions | ✓ |
| HbA1c | Lab observation value range | ✓ |
| Drug / agent + laterality | Anti-VEGF agent + eye laterality | ✓ |

**User's choice:** All four (diagnosis subtype, comorbidities, HbA1c, drug/agent + laterality).

---

## Claude's Discretion

- DE/EN i18n strings for preset labels, validation messages, advanced-dialog labels.
- sessionStorage key name + serialization format.
- Source/location of the CRT clinical threshold value.
- Advanced-dialog AND/OR combination semantics (default AND).
- Advanced-dialog layout (modal vs panel) — defer to UI-SPEC.
- Whether preset predicates are typed into `CohortFilter` or a parallel descriptor.

## Deferred Ideas

- Server-side / cross-device filter persistence.
- Full data-model field exposure in the advanced dialog.
- A formal `/gsd-spike` artifact for COH-04 (short-circuited by D-12).
- Auto-materializing presets as SavedSearch entries.
- OR-logic / boolean filter composition beyond default AND.
