# Phase 30: Terminology Configuration Docs — Cleanup Only — Research

**Researched:** 2026-05-21
**Domain:** Documentation + YAML-comment consistency (no runtime code changes)
**Confidence:** HIGH — all claims verified by direct file inspection in this session

## Summary

Phase 30 closes two documentation/config consistency gaps flagged by the 2026-05-21 adversarial review. No new code, no new doc sections, no behavioral changes.

The two edits are:

1. **`docs/Konfiguration.md` line 80 (parameter table row for `terminology.serverUrl`):** The Default column currently reads `https://r4.ontoserver.csiro.au/fhir`, which is the Ontoserver URL. The actual code default (confirmed in `server/terminologyApi.ts:57-59`) is `undefined` — an empty/missing value that causes the proxy to respond 503. The Default cell must be corrected to show `—` (or `(leer)`); the Ontoserver URL must be moved into the Beschreibung column, relabelled as an example placeholder ("Beispiel-Platzhalter, pro Deployment ersetzen"). The prose subsection `### terminology.serverUrl` at line 93-95 already describes the URL correctly as a "Standardplatzhalter" and must NOT be changed.

2. **`.planning/REQUIREMENTS.md` — TERM-02 wording + traceability status:** The current TERM-02 text says `config/settings.yaml` "ships with a commented `terminology.*` example block + inline comments." The file already has this (lines 15-20, confirmed). The requirement acceptance text needs only a small clarification that the block is kept commented (not active) per D-16/D-17 offline-by-default design. The traceability table status must be updated to "Complete (Phase 30)".

**Primary recommendation:** Execute as a single doc/config plan — two targeted text edits (one table cell in Konfiguration.md, one requirement status line in REQUIREMENTS.md), no file structure changes, no test authoring.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** In the `docs/Konfiguration.md` parameter table, the `terminology.serverUrl` row's Default column must reflect the true code default — empty / `undefined` (e.g. `—` or `(leer)`), NOT the Ontoserver URL. The Ontoserver URL (`https://r4.ontoserver.csiro.au/fhir`) is relabelled inside the Beschreibung column as an example placeholder ("Beispiel-Platzhalter, pro Deployment ersetzen").
- **D-02:** Do NOT change the prose `## Terminologie-Server` section or the `### terminology.serverUrl` subsection — they already correctly describe the URL as a placeholder. Only the parameter-table Default cell (and its description) changes.
- **D-03:** Keep the `terminology:` block in `config/settings.yaml` commented out (currently lines 15-20, with inline comments). An active block would change runtime behavior. The commented example with inline comments IS the deliverable for TERM-02.
- **D-04:** Reword TERM-02 in `.planning/REQUIREMENTS.md` so its acceptance text describes a "commented example block with inline comments" rather than an active `terminology` block. Update the traceability table status to satisfied/Phase 30. Verify the existing comment block's inline comments are adequate; lightly improve them only if needed for operator clarity (no uncommenting).

### Claude's Discretion

- Exact German wording of the relabelled Default cell and description, and the precise TERM-02 requirement phrasing, are at the planner/executor's discretion as long as D-01–D-04 hold.
- Whether this is one plan or two tasks within one plan — given the trivial size, a single small doc/config plan is expected.

### Deferred Ideas (OUT OF SCOPE)

- Any new terminology docs section
- Uncommenting the settings block
- Code changes of any kind
- Touching the (correct) prose "Terminologie-Server" section
- Any broader terminology-server productionization
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TERM-01 | `terminology.*` settings keys documented in `docs/Konfiguration.md` (enable/disable, proxy URL, cache TTL) — satisfied in Phase 25; Phase 30 only fixes the serverUrl default-vs-placeholder wording | Confirmed satisfied: table rows at lines 79-81 and prose section at lines 83-99 both exist. Fix is narrowly scoped to Default cell at line 80. |
| TERM-02 | `config/settings.yaml` ships with a commented `terminology.*` example block + inline comments (kept commented per D-16/D-17 offline-by-default design) | Confirmed: block exists at lines 15-20 of settings.yaml, already commented, with inline comments. Only REQUIREMENTS.md wording + traceability status needs updating. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Operator configuration docs | Documentation (static) | — | No runtime tier involved; Konfiguration.md is a static Markdown file |
| Terminology opt-in guidance | Documentation (static) | — | settings.yaml comment block is guidance text, not runtime config |
| Requirement traceability | Planning artifact | — | REQUIREMENTS.md is a planning file, not production code |

---

## Exact Current State of Target Files

### docs/Konfiguration.md — line 80 (the broken row)

**[VERIFIED: direct file read]**

```
Line 80:
| `terminology.serverUrl` | `string` | `https://r4.ontoserver.csiro.au/fhir` | FHIR-Endpunkt mit `$lookup`-Unterstützung. Produktiv durch nationalen oder institutionellen Server ersetzen. |
```

**What is wrong:** The Default column shows the Ontoserver URL as if it were the runtime default. The code (terminologyApi.ts:57-59) returns `undefined` when no value is present — the Ontoserver URL is only the value in the Vollständiges-Beispiel YAML block, not a code default.

**Target after fix:** Default cell becomes `—` (or `(leer)`); Beschreibung cell gains "Beispiel-Platzhalter: `https://r4.ontoserver.csiro.au/fhir` — pro Deployment ersetzen" language consistent with the existing prose at line 95.

**Lines to leave untouched (already correct):**
- Line 56-60: Vollständiges Beispiel YAML block — the Ontoserver URL here is clearly an example value with the comment "Platzhalter — pro Deployment ersetzen". No change needed.
- Lines 83-99: Prose `## Terminologie-Server` section and all three `###` subsections — already correct, not to be touched (D-02).

### config/settings.yaml — lines 15-20 (the commented terminology block)

**[VERIFIED: direct file read]**

```yaml
# Phase 25 / D-16, D-17 — terminology resolver. Code-defaulted; omit to keep
# offline behavior. Set enabled: true + a real serverUrl to opt in.
# terminology:
#   enabled: false                                          # default OFF — preserves offline behavior
#   serverUrl: 'https://r4.ontoserver.csiro.au/fhir'        # placeholder default; real server set per-deployment
#   cacheTtlMs: 86400000                                    # 24h
```

**Assessment:** The block is fully commented out (D-03 preserved). The inline comments are operator-adequate. The only potential micro-improvement: the `enabled: false` line comment says "default OFF" which could be slightly clearer ("Standard OFF — beim Einkommentieren auf `true` setzen"). This is Claude's Discretion — the planner/executor may leave the comments as-is.

**Status:** TERM-02 is effectively delivered as-is. No file change is required here unless the executor judges the inline comments need a minor German-language polish pass.

### server/terminologyApi.ts — lines 57-59 (the code default)

**[VERIFIED: direct file read]**

```typescript
const serverUrl = typeof term.serverUrl === 'string' && term.serverUrl.length > 0
  ? term.serverUrl
  : undefined;
```

**Confirms:** Code default for `serverUrl` is `undefined` (falsy check, empty string also becomes undefined). This is the authoritative source that makes the Konfiguration.md table row incorrect. No change to this file — it is a grounding reference only.

### .planning/REQUIREMENTS.md — TERM-02 rows

**[VERIFIED: direct file read]**

Current state (line 29):
```
- [ ] **TERM-02**: `config/settings.yaml` ships with a commented `terminology.*` example block + inline comments (kept commented per D-16/D-17 offline-by-default design)
```

The checkbox is `[ ]` (open). The wording already reflects the Phase 30 intent. The traceability table at line 60:
```
| TERM-02 | Phase 30 | Pending (reworded — commented example) |
```

**Target after fix:** Checkbox becomes `[x]`; traceability status becomes "Complete (Phase 30)". Wording is already adequate per D-04.

---

## Standard Stack

No libraries or new packages are involved. This is a text-editing task on three files using:

| Tool | Purpose |
|------|---------|
| Text editor / Write tool | Edit Konfiguration.md table row, REQUIREMENTS.md checkbox + traceability row |
| `grep` / `npm run test:ci` | Verification (see Validation Architecture below) |

---

## Architecture Patterns

No architectural patterns apply — this is a documentation consistency fix. The principle governing the edit is:

**Code defaults are authoritative; docs must present code defaults as Default, and example values as examples.** (Established pattern in this codebase: see `server.serveFrontend` row in the same table, which correctly shows `false` as the code default even though the Vollständiges-Beispiel shows `true`.)

---

## Don't Hand-Roll

Not applicable — no code is written.

---

## Common Pitfalls

### Pitfall 1: Accidentally editing the prose subsection
**What goes wrong:** Editing `### terminology.serverUrl` (line 93-95) which is already correct.
**Why it happens:** The prose subsection and the table row both mention the Ontoserver URL; it is easy to confuse the two targets.
**How to avoid:** Only edit line 80 (parameter table row). Lines 83-99 are untouchable (D-02).
**Warning signs:** Any change to lines 83-99 in Konfiguration.md.

### Pitfall 2: Uncommenting the settings.yaml block
**What goes wrong:** Removing the `#` comment markers from the `terminology:` block.
**Why it happens:** Wanting to "show" the example more prominently.
**How to avoid:** D-03 is locked. An active block changes runtime behavior (the server would read and apply the values). The commented form is the intentional deliverable.
**Warning signs:** Any line in settings.yaml lines 15-20 missing its leading `#`.

### Pitfall 3: Wrong table cell edited in Konfiguration.md
**What goes wrong:** Editing the Beschreibung column only, leaving the Default column unchanged.
**Why it happens:** The Default column is the third pipe-delimited field; it is easy to miscounting columns.
**How to avoid:** The Default column for `terminology.serverUrl` must change from `https://r4.ontoserver.csiro.au/fhir` to `—` (or `(leer)`). The Ontoserver URL must appear in the Beschreibung column, explicitly labelled as a placeholder.
**Warning signs:** grep for `| \`terminology.serverUrl\` | \`string\` | https://` — if this matches after the edit, the Default cell was not changed.

### Pitfall 4: Forgetting to tick the TERM-02 checkbox
**What goes wrong:** Rewording the traceability row but leaving the `[ ]` checkbox open.
**Why it happens:** Two separate changes to REQUIREMENTS.md (inline requirement text + traceability table).
**How to avoid:** The planner should list both as explicit steps: (a) checkbox, (b) traceability table cell.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (via `npm run test:ci`) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test:ci` |
| Full suite command | `npm run test:ci` |

Phase 30 makes no behavioral changes. Validation is verification-style: grep/file-content assertions confirm the edits are correct, and the existing test suite confirms no regression.

### Phase Requirements → Validation Map

| Req ID | Success Criterion | Validation Type | Command / Check |
|--------|------------------|-----------------|-----------------|
| TERM-01 | Already satisfied in Phase 25; line 80 default cell corrected | grep assertion | `grep -n 'terminology.serverUrl' docs/Konfiguration.md` — Default cell must NOT contain `https://r4.ontoserver.csiro.au/fhir`; Beschreibung cell must contain "Platzhalter" or "Beispiel" |
| TERM-02 | settings.yaml block stays commented; REQUIREMENTS.md checkbox ticked | grep assertion | `grep -c '^# ' config/settings.yaml` must include the terminology lines; `grep 'TERM-02' .planning/REQUIREMENTS.md` must show `[x]` |
| Both | No terminology test regressions | Automated test suite | `npm run test:ci` — all 619 tests green |

### Verification Steps (per success criterion)

**Success Criterion 1 — Default cell corrected (D-01)**

```bash
# Must NOT match (Ontoserver URL still in Default column):
grep 'terminology.serverUrl.*string.*https://r4.ontoserver' docs/Konfiguration.md
# Expected: no output (empty)

# Must match (Beschreibung column now contains the example URL):
grep 'Platzhalter\|Beispiel' docs/Konfiguration.md | grep 'terminology.serverUrl'
# Expected: one line (the table row)

# Must match (prose subsection still intact, untouched):
grep -n 'Standardplatzhalter' docs/Konfiguration.md
# Expected: line 95 (unchanged)
```

**Success Criterion 2 — TERM-02 satisfied (D-03, D-04)**

```bash
# settings.yaml block must remain commented:
grep -E '^# +(terminology|enabled|serverUrl|cacheTtlMs)' config/settings.yaml | wc -l
# Expected: >= 4 (the four commented lines inside the block)

# REQUIREMENTS.md checkbox must be ticked:
grep 'TERM-02' .planning/REQUIREMENTS.md
# Expected: [x] TERM-02 ...

# Traceability status must be updated:
grep 'TERM-02.*Phase 30' .planning/REQUIREMENTS.md
# Expected: a line with "Complete" (not "Pending")
```

**Regression gate**

```bash
npm run test:ci
# Expected: 619/619 pass (Phase 24 baseline)
```

### Wave 0 Gaps

None — existing test infrastructure covers all phase requirements. No new test files are needed. This phase requires no Wave 0 setup.

---

## Runtime State Inventory

Not applicable — this is a documentation/config-comment-only phase. No runtime state (databases, services, OS registrations, secrets, build artifacts) is affected by the two text edits.

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. The two edits are text changes to Markdown and YAML files. Only `npm run test:ci` (already available: Vitest, Node.js) is needed for verification.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 30 |
|-----------|-------------------|
| `npm run test:ci` must remain 619/619 green | Regression gate — run after edits |
| Naming: camelCase for TS identifiers; wire/DB strings stay as-is | Not applicable (no code changes) |
| Config: `config/settings.yaml` is single source of truth | Confirms settings.yaml is the canonical file; edits must not activate the commented block |
| Docs in `docs/Konfiguration.md` are German | All edits must stay in German and match surrounding tone |
| Error handling: throw-only, no Result types | Not applicable (no code changes) |

---

## Assumptions Log

No assumptions. All claims in this research were verified by direct file inspection in this session.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims verified.** No user confirmation needed before execution.

---

## Open Questions

None. The two edits are fully specified by D-01–D-04, and the exact current state of all three target files is confirmed above.

---

## Sources

### Primary (HIGH confidence — direct file inspection)

- `docs/Konfiguration.md` lines 56-99 — complete Vollständiges Beispiel YAML block and all terminology parameter rows and prose subsections, read verbatim in this session
- `config/settings.yaml` lines 1-20 — full file read; commented terminology block at lines 15-20 confirmed
- `server/terminologyApi.ts` lines 48-68 — `loadTerminologyConfig` function; `serverUrl` code default of `undefined` confirmed at lines 57-59
- `.planning/REQUIREMENTS.md` lines 1-70 — TERM-01 and TERM-02 status confirmed; traceability table read verbatim
- `.planning/phases/30-terminology-configuration-docs-cleanup-only/30-CONTEXT.md` — all locked decisions D-01–D-04 read verbatim

---

## Metadata

**Confidence breakdown:**
- Current file state: HIGH — all files read directly in this session
- Edit targets (line numbers): HIGH — grep-confirmed line 80 for table row, lines 15-20 for YAML block, lines 29 and 60 for REQUIREMENTS.md
- Validation commands: HIGH — derived from verified file content and project test baseline (619/619)

**Research date:** 2026-05-21
**Valid until:** Stable (no external dependencies; files change only when edited by this phase)
