---
phase: 22-codebase-docs-consistency
plan: 03
type: execute
wave: 3
depends_on: ["22-01", "22-02"]
files_modified:
  - .planning/GLOSSARY.md
  - .planning/PROJECT.md
  - .planning/ROADMAP.md
  - .planning/MILESTONES.md
  - .planning/STATE.md
  - .planning/REQUIREMENTS.md
  - .planning/RETROSPECTIVE.md
  - README.md
  - CLAUDE.md
  - .planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md
autonomous: true
requirements: [DOCS-01, DOCS-02, DOCS-03]
must_haves:
  truths:
    - "`.planning/GLOSSARY.md` exists with entries for sites/centers, patients/cases, cohort/group (D-08, D-12, D-13)"
    - "`.planning/` prose consistently uses `sites` for domain-facing terminology; `centers` retained only in wire/DB/column references (D-05, D-12)"
    - "All 44 intra-`.planning/` markdown links resolve to existing files"
    - "`README.md` setup instructions match current `package.json` scripts"
    - "`CLAUDE.md` exists at repo root, ≤60 lines, summarizing test/build/naming/error conventions (D-11)"
    - "`// what` comments in files touched by Plans 22-01 and 22-02 are removed or converted to `why` comments (DOCS-03, judgment-based per RESEARCH)"
  artifacts:
    - path: ".planning/GLOSSARY.md"
      provides: "Terminology reference with scope (prose vs wire)"
      contains: "sites, centers, patients, cases, cohort"
    - path: "CLAUDE.md"
      provides: "Minimal project convention pointer for Claude (≤60 lines)"
      contains: "test command, naming, error-handling, .planning link"
  key_links:
    - from: ".planning/PROJECT.md / ROADMAP.md / MILESTONES.md / STATE.md prose"
      to: "`.planning/GLOSSARY.md`"
      via: "normalized term usage (sites in prose)"
      pattern: "sites"
    - from: "CLAUDE.md"
      to: ".planning/PROJECT.md"
      via: "explicit link"
      pattern: "\\.planning/PROJECT\\.md"
---

<objective>
Plan 22-03 (Wave 3): Docs reconciliation + glossary + CLAUDE.md.

Scope:
1. Create `.planning/GLOSSARY.md` (D-08, D-12, D-13) — define sites/centers, patients/cases, cohort/group with scope annotations
2. Bulk-normalize `.planning/` PROSE from "centers" → "sites" where the context is domain-facing (D-12). Leave wire/DB/column references ("center_id", "data/centers.json", "/api/fhir/centers", CENTER-* requirement IDs) UNTOUCHED per D-05
3. Audit `README.md` against current `package.json` scripts; fix stale instructions (DOCS-02)
4. Audit inline JSDoc and "what" comments in files touched by Plans 22-01 and 22-02 (DOCS-03 — judgment-based per RESEARCH §Inline Comment Audit)
5. Create minimal `CLAUDE.md` at repo root, ≤60 lines (D-11)
6. Link-check all 44 intra-`.planning/` markdown links

Depends on Plan 22-02 (docs must describe the post-dedup, post-prune code surface).

Purpose: Make the documentation match the shipped codebase so future phases and Claude sessions start from a single source of truth.

Output: Glossary + CLAUDE.md + normalized `.planning/` prose + audited README + cleaned inline comments + SUMMARY.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/22-codebase-docs-consistency/22-CONTEXT.md
@.planning/phases/22-codebase-docs-consistency/22-RESEARCH.md
@.planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md
@.planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md
@README.md
@package.json

<interfaces>
GLOSSARY structure (per D-12, D-13, RESEARCH §Terminology Drift):

```markdown
# Glossary

## sites
Canonical domain term for participating clinical research locations.
Used in: prose across .planning/, user-facing copy, ROADMAP/PROJECT narratives.
Wire/DB form may appear as "center" (legacy external naming, kept for schema compatibility):
do not rename wire payloads (D-05).

## centers
Wire/DB synonym of "sites". Appears in: `data/centers.json`, `/api/fhir/centers`
endpoint, `center_id` DB column, `CENTER-*` requirement IDs, `centers` field in
user records. Do NOT rename these — they are external contracts (D-05).

## patients
Clinical subjects. NOT a synonym of "cases".

## cases
App-level records of patient encounters/episodes. A patient has one or more cases
(visits). Do NOT normalize to "patients".

## cohort
Domain term; single canonical usage. "Groups" is used only in test contexts
(test-group), not as a domain synonym.
```

CLAUDE.md structure (per D-11, ≤60 lines):

```markdown
# CLAUDE.md

Minimal project conventions for Claude sessions.

## Commands
- Test (safety net): `npm run test:ci` (608/608 must pass — Phase 21 baseline)
- Build: `npm run build`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Dead-code scan: `npm run knip`

## Conventions
- Naming: camelCase for TS identifiers; wire/DB/FHIR/HTTP strings stay as-is (D-05)
- Error handling: throw-only (D-03). No Result types.
- Async: async/await in new/touched files; `Promise.all` allowed (D-04)
- Cross-boundary helpers live in `shared/` (D-01)
- Config: `settings.yaml` is the single source — NO env vars

## Entry points
- .planning/PROJECT.md — domain + architecture
- .planning/ROADMAP.md — milestones + current phase
- .planning/STATE.md — active position
- .planning/GLOSSARY.md — terminology
```

Link-check script (inline bash from RESEARCH §Validation Commands — adapted):

```bash
while IFS= read -r line; do
  f=${line%%:*}; rest=${line#*:}
  target=$(echo "$rest" | sed -E 's/.*\(([^)]+)\).*/\1/')
  [[ "$target" =~ ^https?: ]] && continue
  dir=$(dirname "$f"); full="$dir/$target"
  [[ -f "$full" ]] || echo "BROKEN: $f -> $target"
done < <(grep -rnoE '\[[^]]+\]\(\.?/?[^)]+\)' .planning/)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create GLOSSARY.md and normalize .planning/ prose (centers → sites)</name>
  <files>
    .planning/GLOSSARY.md,
    .planning/PROJECT.md,
    .planning/ROADMAP.md,
    .planning/MILESTONES.md,
    .planning/STATE.md,
    .planning/REQUIREMENTS.md,
    .planning/RETROSPECTIVE.md
  </files>
  <read_first>
    .planning/PROJECT.md,
    .planning/ROADMAP.md,
    .planning/MILESTONES.md,
    .planning/STATE.md,
    .planning/REQUIREMENTS.md,
    .planning/RETROSPECTIVE.md,
    .planning/phases/22-codebase-docs-consistency/22-RESEARCH.md
  </read_first>
  <action>
**Part A — GLOSSARY.md (D-08, D-12, D-13):**

Create `.planning/GLOSSARY.md` with exactly the structure shown in `<interfaces>`. Include entries for: sites, centers, patients, cases, cohort, group. Each entry must explicitly state scope (prose vs wire/DB).

Commit: `docs(22-03): add .planning/GLOSSARY.md per D-08/D-12/D-13`.

**Part B — Bulk rename `centers` → `sites` in `.planning/` PROSE ONLY (D-12):**

For each file in `files_modified` (the `.planning/*.md` list above):

1. `grep -n "centers\|center" <file>` to list every occurrence.
2. Classify each match:
   - **Rename to "sites"/"site":** narrative prose ("8 centers", "each center runs", "participating centers").
   - **LEAVE AS-IS:**
     - `CENTER-*` requirement IDs (exact token `CENTER-` followed by digits)
     - `center_id`, `centers` (JSON field), `data/centers.json`
     - `/api/fhir/centers` or similar URL paths
     - `centers.json` file references
     - any string inside a fenced code block (```...```) that represents wire/DB/code
     - Phase-archive references (e.g., "Phase 7 Site Roster Correction" is a PROPER NOUN — leave title intact)
3. Apply the renames. Use targeted `sed` on verified matches, NOT a blanket `s/centers/sites/g`.
4. After ALL prose edits: run the link-check script (from `<interfaces>`) to ensure no link target was broken by renames.
5. DO NOT touch the archived `.planning/milestones/v1.X-ROADMAP.md` files — those are sacred archives per Pitfall 5.

Commit per file or as one docs-prose commit: `docs(22-03): normalize .planning/ prose centers→sites per D-12`.

**Part C — Guard:**

After Part B, sanity-check that code-adjacent references are untouched:
- `grep -n "center_id\|centers\.json\|CENTER-\|/api/fhir/centers" .planning/**/*.md` — must still find all original occurrences.
- `grep -c "^#.* Site Roster\| Site Roster Correction" .planning/milestones/*.md` — must still find the Phase 7 proper-noun reference.
  </action>
  <verify>
    <automated>test -f .planning/GLOSSARY.md &amp;&amp; grep -q "^## sites" .planning/GLOSSARY.md &amp;&amp; grep -q "^## centers" .planning/GLOSSARY.md &amp;&amp; grep -q "^## patients" .planning/GLOSSARY.md &amp;&amp; grep -q "^## cases" .planning/GLOSSARY.md</automated>
  </verify>
  <acceptance_criteria>
    - `.planning/GLOSSARY.md` exists with `sites`, `centers`, `patients`, `cases`, `cohort` headings
    - `grep -c "CENTER-" .planning/**/*.md` count unchanged vs pre-Part-B baseline (requirement IDs untouched)
    - `grep -c "center_id\|centers\.json\|/api/fhir/centers" .planning/**/*.md` count unchanged vs baseline (wire strings untouched)
    - `.planning/milestones/*.md` files are IDENTICAL to pre-plan state (`git diff --name-only HEAD~N -- .planning/milestones/` returns 0 files) — Pitfall 5 guard
    - Link-check script returns zero `BROKEN:` lines
  </acceptance_criteria>
  <done>
    Glossary exists; .planning/ prose normalized to "sites" where domain-facing; wire/DB/archive references untouched; all intra-.planning/ links resolve.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Audit README.md, create CLAUDE.md, clean inline comments in touched files</name>
  <files>
    README.md,
    CLAUDE.md,
    (files touched by Plan 22-01 and Plan 22-02 — see action for enumeration)
  </files>
  <read_first>
    README.md,
    package.json,
    .planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md,
    .planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md,
    .planning/phases/22-codebase-docs-consistency/22-RESEARCH.md
  </read_first>
  <action>
**Part A — README.md audit (DOCS-02):**

1. Read `package.json` `scripts` block; list every script name.
2. `grep -n "npm run\|npm test\|npm install" README.md` — verify every script reference in README matches an actual script.
3. Fix mismatches:
   - Remove references to scripts that no longer exist in `package.json`.
   - Update script names if they were renamed.
   - Keep content; just fix factual drift.
4. Trim verbosity: delete redundant "what" prose; keep setup/run/test instructions only.
5. Commit: `docs(22-03): audit README.md against package.json scripts (DOCS-02)`.

**Part B — Create CLAUDE.md at repo root (D-11, ≤60 lines):**

1. Confirm `CLAUDE.md` does NOT exist at `./CLAUDE.md`: `test ! -f CLAUDE.md` (RESEARCH §Project Constraints).
2. Create `./CLAUDE.md` with exactly the structure shown in `<interfaces>`. Size budget: ≤60 lines.
3. Verify length: `wc -l CLAUDE.md` → ≤60.
4. Commit: `docs(22-03): add minimal CLAUDE.md per D-11`.

**Part C — Inline comment cleanup in touched files (DOCS-03, judgment-based):**

Enumerate the touched-file set = union of Plan 22-01 `files_modified` and Plan 22-02 deletion/narrowing commits (from 22-02-SUMMARY).

For each file in that set:

1. `grep -n "^\s*//" <file>` to list every single-line comment.
2. Apply the RESEARCH §Inline Comment Audit rule of thumb:
   - Comment references a requirement ID / phase decision / ADR (e.g., `CENTER-03`, `T-05-02`, `D-04`, `Phase 11`) → RETAIN (it's a "why")
   - Comment restates the next line in English (e.g., `// Fetch display name from /api/auth/users/me when user changes`) → DELETE
   - Comment explains surprising behavior, tradeoff, or pitfall → RETAIN
3. Do NOT global-delete. Edit each file with targeted deletions.
4. After all edits, run `npm run test:ci` → must be 608/608.
5. Commit per file OR one grouped commit: `docs(22-03): trim 'what' comments in touched files per DOCS-03`.

**Part D — Link-check re-run:**

Run the link-check script from Task 1 again (now that all docs have been edited). Report any BROKEN lines; fix or explain.
  </action>
  <verify>
    <automated>test -f CLAUDE.md &amp;&amp; [ "$(wc -l &lt; CLAUDE.md)" -le 60 ] &amp;&amp; npm run test:ci</automated>
  </verify>
  <acceptance_criteria>
    - `CLAUDE.md` exists at repo root and is ≤60 lines (`wc -l CLAUDE.md`)
    - `CLAUDE.md` contains sections: Commands, Conventions, Entry points (grep-verified)
    - Every `npm run <x>` reference in `README.md` maps to an actual script in `package.json` (no dangling references)
    - `npm run test:ci` exits 0 with 608/608 passing tests
    - Link-check script returns zero `BROKEN:` lines across `.planning/`
  </acceptance_criteria>
  <done>
    README accurate; CLAUDE.md created and minimal; inline "what" comments removed from touched files; test suite green; no broken intra-.planning/ links.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Write 22-03 SUMMARY + phase closeout audits</name>
  <files>
    .planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md
  </files>
  <read_first>
    .planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md,
    .planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md,
    $HOME/.claude/get-shit-done/templates/summary.md
  </read_first>
  <action>
Create `.planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md`. It MUST include:

1. **Glossary delivered:** Confirmation that `.planning/GLOSSARY.md` exists with the 5+ required headings.
2. **Prose normalization counts:** For each `.planning/*.md` file touched, `centers→sites` rename count + list of wire/DB tokens left untouched (CENTER-*, center_id, centers.json, /api/fhir/centers).
3. **Archive untouched guarantee:** `git diff HEAD~N -- .planning/milestones/` shows no changes (Pitfall 5 guard).
4. **README audit diff:** List of README edits made, keyed to which `package.json` script mismatch they fixed.
5. **CLAUDE.md delivered:** Final `wc -l CLAUDE.md` value (≤60).
6. **Inline comment cleanup:** Per-file count of comments deleted vs retained (with reason-type tallies: "references requirement ID", "explains tradeoff", etc.).
7. **Link-check final result:** "0 broken links across 44 intra-.planning/ markdown links" (or exact failure count + fix trail).
8. **Phase-gate evidence (Phase 22 overall):**
   - Final `npm run test:ci` → 608/608
   - Final `npx knip --reporter compact` → clean OR justified
   - `grep -rn "\.then(" src/ server/ shared/` → 0 or all retained-with-reason
   - `grep -rnE "type Result<|Either<" src/ server/ shared/` → 0 (D-03 invariant)
   - Glossary file present; link-check clean
  </action>
  <verify>
    <automated>test -f .planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md &amp;&amp; grep -q "Glossary delivered" .planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md &amp;&amp; grep -q "CLAUDE.md" .planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md &amp;&amp; grep -q "Link-check" .planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - SUMMARY exists at `.planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md`
    - SUMMARY includes all 8 required sections listed in action
    - SUMMARY cites final `npm run test:ci` → 608/608
    - SUMMARY confirms `.planning/milestones/` untouched (Pitfall 5 guard)
    - SUMMARY documents link-check result
  </acceptance_criteria>
  <done>
    Plan 22-03 SUMMARY written with all sections; phase-gate evidence present.
  </done>
</task>

</tasks>

<verification>
Final verification for Plan 22-03 and Phase 22 overall:

```bash
# Artifacts present
test -f .planning/GLOSSARY.md
test -f CLAUDE.md && [ "$(wc -l < CLAUDE.md)" -le 60 ]
test -f .planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md

# Glossary structure
grep -c "^## \(sites\|centers\|patients\|cases\|cohort\)" .planning/GLOSSARY.md  # 5

# Archive untouched (Pitfall 5)
git log --since="Phase 22 start" --name-only -- .planning/milestones/ | grep -v '^$' | head
# should be empty

# Link integrity
while IFS= read -r line; do
  f=${line%%:*}; rest=${line#*:}
  target=$(echo "$rest" | sed -E 's/.*\(([^)]+)\).*/\1/')
  [[ "$target" =~ ^https?: ]] && continue
  dir=$(dirname "$f"); full="$dir/$target"
  [[ -f "$full" ]] || echo "BROKEN: $f -> $target"
done < <(grep -rnoE '\[[^]]+\]\(\.?/?[^)]+\)' .planning/)
# no output

# Safety net final
npm run test:ci                   # exits 0, 608/608
npm run build                     # exits 0
```
</verification>

<success_criteria>
- `.planning/GLOSSARY.md` exists with 5+ terminology entries including scope annotations
- `.planning/` prose normalized: domain-facing "centers" → "sites"; wire/DB/archive references untouched
- `.planning/milestones/*.md` archive files untouched (Pitfall 5)
- `README.md` script references match current `package.json`
- `CLAUDE.md` exists at repo root, ≤60 lines, with Commands + Conventions + Entry points sections
- Inline "what" comments in touched files converted/removed per DOCS-03 judgment rule
- All 44 intra-`.planning/` markdown links resolve
- `npm run test:ci` exits 0 with 608/608 passing tests
</success_criteria>

<output>
After completion, create `.planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md` (see Task 3 for required content).
</output>
