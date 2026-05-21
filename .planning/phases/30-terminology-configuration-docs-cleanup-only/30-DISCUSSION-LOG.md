# Phase 30: Terminology Configuration Docs — CLEANUP ONLY - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 30-terminology-configuration-docs-cleanup-only
**Areas discussed:** serverUrl Default labelling, TERM-02 satisfaction approach
**Mode:** --auto (recommended option auto-selected for each area; single pass)

---

## serverUrl Default labelling (Success Criterion 1)

| Option | Description | Selected |
|--------|-------------|----------|
| Default = empty/undefined; URL → example placeholder in description | Table Default cell reflects the true code default (`undefined`); Ontoserver URL relabelled as "Beispiel-Platzhalter" in the Beschreibung column | ✓ |
| Keep URL in Default but prefix "Beispiel:" | Leaves URL in the Default column, only annotates it | |

**Auto-selected:** Option 1 (recommended). Consistent with `server/terminologyApi.ts:57-59` (empty/undefined → `503`), the existing "Minimal vs. voll" note, and the YAML comment "Platzhalter".
**Notes:** Prose `## Terminologie-Server` section is already correct and stays untouched — only the parameter-table Default cell + its description change.

---

## TERM-02 satisfaction approach (Success Criterion 2)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep commented example + reword requirement | Leave the `terminology:` block commented in `config/settings.yaml` (already present, lines 15-20); reword TERM-02 in REQUIREMENTS.md to "commented example with inline comments" | ✓ |
| Uncomment/activate the block | Make the `terminology` block active in settings.yaml | |

**Auto-selected:** Option 1 (recommended). Preserves the D-16/D-17 offline-by-default design — an active block would change runtime behavior. The commented example with inline comments already exists and IS the deliverable.
**Notes:** Verify inline comments are adequate for an operator; light wording improvement allowed, no uncommenting.

---

## Claude's Discretion

- Exact German wording of the relabelled Default cell/description and the TERM-02 requirement phrasing.
- Single plan vs. two tasks — single small doc/config plan expected given trivial size.

## Deferred Ideas

None — discussion stayed within phase scope.
