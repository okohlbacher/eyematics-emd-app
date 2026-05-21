# Phase 30: Terminology Configuration Docs — CLEANUP ONLY - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Documentation/config cleanup so any operator can configure the terminology service from the shipped `config/settings.yaml` and `docs/Konfiguration.md` without reading source code. **No new code, no new doc sections.** TERM-01 is already satisfied (Phase 25); this phase reduces to two small consistency fixes flagged by the 2026-05-21 adversarial review.

Scoped to exactly two tasks:
1. **Fix the misleading `terminology.serverUrl` Default in the `docs/Konfiguration.md` parameter table** — it currently shows `https://r4.ontoserver.csiro.au/fhir` as the runtime *default*, but the code default is empty/`undefined` (`server/terminologyApi.ts:57-59`).
2. **Satisfy TERM-02 via the already-present commented example block in `config/settings.yaml`** (lines 15-20) and reword the requirement to reflect "commented example," not an active block.

Out of scope: any new terminology docs section, uncommenting the settings block, code changes, or touching the (correct) prose "Terminologie-Server" section.
</domain>

<decisions>
## Implementation Decisions

### serverUrl Default labelling (Success Criterion 1)
- **D-01:** In the `docs/Konfiguration.md` parameter table, the `terminology.serverUrl` row's **Default** column must reflect the true code default — empty / `undefined` (e.g. `—` or `(leer)`), NOT the Ontoserver URL. The Ontoserver URL (`https://r4.ontoserver.csiro.au/fhir`) is relabelled inside the **Beschreibung** column as an example placeholder ("Beispiel-Platzhalter, pro Deployment ersetzen"). This makes the table consistent with `server/terminologyApi.ts:57-59` (empty/undefined → `503`), the existing "Minimal vs. voll" note, and the YAML example comment that already says "Platzhalter".
- **D-02:** Do NOT change the prose `## Terminologie-Server` section or the `### terminology.serverUrl` subsection — they already correctly describe the URL as a placeholder. Only the parameter-table Default cell (and its description) changes.

### TERM-02 satisfaction (Success Criterion 2)
- **D-03:** Keep the `terminology:` block in `config/settings.yaml` **commented out** (currently lines 15-20, with inline comments). This preserves the D-16/D-17 offline-by-default design — an active block would change runtime behavior. The commented example with inline comments IS the deliverable for TERM-02.
- **D-04:** Reword TERM-02 in `.planning/REQUIREMENTS.md` so its acceptance text describes a "commented example block with inline comments" rather than an active `terminology` block. Update the traceability table status to satisfied/Phase 30. Verify the existing comment block's inline comments are adequate; lightly improve them only if needed for operator clarity (no uncommenting).

### Claude's Discretion
- Exact German wording of the relabelled Default cell and description, and the precise TERM-02 requirement phrasing, are at the planner/executor's discretion as long as D-01–D-04 hold.
- Whether this is one plan or two tasks within one plan — given the trivial size, a single small doc/config plan is expected.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files to edit
- `docs/Konfiguration.md` §"Parameter im Detail" (parameter table, `terminology.serverUrl` row ~line 86) — the Default-cell fix (D-01/D-02)
- `config/settings.yaml` (lines 15-20, commented `terminology` block) — verify/lightly improve inline comments only (D-03/D-04)
- `.planning/REQUIREMENTS.md` — TERM-02 wording + traceability status (D-04)

### Grounding references (read, do not edit)
- `server/terminologyApi.ts:48-66` — loadTerminologyConfig: confirms `serverUrl` code default is `undefined` (empty → `503`), `enabled` defaults `false`, `cacheTtlMs` defaults 24h
- `docs/Konfiguration.md` §"Terminologie-Server" (~lines 92-99) — the already-correct prose; the table must be made consistent with it
- ROADMAP.md §"Phase 30" — success criteria + scope note (the spec for this phase)

### Design decisions (terminology offline-by-default)
- D-16 / D-17 (referenced in `config/settings.yaml:15-16`) — omit/comment the terminology block to preserve offline behavior; opt-in only via `enabled: true` + real `serverUrl`
- D-10 (SSRF guard) and D-15 (no per-lookup audit) — context only; not changed this phase
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docs/Konfiguration.md` already has a complete, correct prose section for the terminology server — the fix only aligns the table to it.
- `config/settings.yaml` already ships the commented example block with inline comments — TERM-02 is effectively delivered; the work is wording/consistency, not authoring.

### Established Patterns
- Offline-by-default: code defaults (terminologyApi.ts) are authoritative; settings.yaml entries are opt-in overrides. Docs must present code defaults as the Default, examples as examples.
- Bilingual docs: `docs/Konfiguration.md` is in German — keep edits in German and consistent with surrounding tone.

### Integration Points
- None at runtime — documentation/config-comment only. No build, no API, no test behavior changes (existing terminology tests already pass and must remain green).
</code_context>

<specifics>
## Specific Ideas

The parameter table's Default column for `terminology.serverUrl` should show the same "empty/undefined" reality the code enforces; the Ontoserver URL stays visible but explicitly labelled as an example placeholder. Mirror the existing YAML comment "Platzhalter — pro Deployment ersetzen".
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Any broader terminology-server productionization belongs to deployment docs, not this cleanup phase.)
</deferred>

---

*Phase: 30-terminology-configuration-docs-cleanup-only*
*Context gathered: 2026-05-21*
