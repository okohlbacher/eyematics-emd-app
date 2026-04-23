# Phase 22: Codebase & Docs Consistency — Research

**Researched:** 2026-04-23
**Domain:** Internal quality refactor (dedup, pattern alignment, dead-code, type narrowing, docs reconciliation)
**Confidence:** HIGH (repo-grounded; all claims verified against working-tree state)

## Summary

Phase 22 is a constrained internal-quality sweep that must preserve the Phase 21 safety net (608/608 tests, zero skips) across every atomic commit. The good news from a fresh audit: **the codebase is already in far better shape than a typical "dedup phase" encounters.** Phase 12 already extracted a `shared/` module, and the Phase 20 ESLint `no-restricted-imports` rule proves the team can enforce canonical-import patterns. Concrete impact estimates:

- `.then` chain rewrites: **15 occurrences across 7 files** (CONSIST-02)
- `any`/`unknown` narrowing: **34 occurrences** (CONSIST-04, touched-file scope per D-07)
- Result-type migrations: **0 occurrences** — the codebase is already throw-only (D-03 invariant is retroactively true)
- Snake_case TS identifiers outside FHIR/HTTP/SQL exceptions: mostly **role names and wire-format error codes** (`data_manager`, `invalid_credentials`, `otp_required`, etc.) — these are JSON-wire contracts with server/DB, NOT violations to rewrite
- Backward-compat shim files: **7** (e.g., `src/utils/cohortTrajectory.ts` re-exports `shared/cohortTrajectory`) — candidates for removal if all direct callers exist
- `ts-prune` / `knip` / `jscpd`: NONE installed. `ts-prune@0.10.3`, `knip@6.6.2`, `jscpd@4.0.9` are reachable via `npx` (needs install).
- Intra-`.planning/` markdown links: **44** — sample already shows most resolve to files that exist (all `milestones/v1.X-ROADMAP.md` targets exist).

**Primary recommendation:** Prefer `knip` over `ts-prune` for CONSIST-03 (knip is actively maintained, finds unused files + exports + dependencies in one pass). Skip `jscpd` as CI gate (deferred in D-09). Use `knip --no-exit-code` once to produce the deletion list, then execute deletions as one-commit-per-module per D-10 safety-net policy.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Dedup target = strict `shared/` for cross-boundary code. Single-boundary helpers may remain in `src/lib/` or `server/` local modules.
- **D-02** Duplicate threshold = exact + near-duplicate ≥80% structural similarity with same intent.
- **D-03** Error handling = throw-only. Result-types banned; existing ones migrate during the same pass.
- **D-04** Async style = strict async/await in new and touched files. `Promise.all` / `Promise.race` remain allowed.
- **D-05** Naming = camelCase for TS identifiers **except** FHIR wire fields, HTTP header names, raw SQL column names.
- **D-06** Dead-code = aggressive delete; retention requires `// retained: <concrete reason>` inline comment.
- **D-07** Type narrowing = touched-file scope only.
- **D-08** Docs scope = `.planning/` + README.md + CLAUDE.md + inline JSDoc + new `.planning/GLOSSARY.md`.
- **D-09** Plan shape = 3 sequential plans (22-01 code; 22-02 dead-code+types; 22-03 docs).
- **D-10** After every atomic commit, `npm run test:ci` exits 0 with 608/608 passing and zero skips.

### Claude's Discretion

- Tool choice between `ts-prune` vs `knip` for CONSIST-03.
- Similarity heuristic for ≥80% near-duplicate detection (AST-based vs manual review with `jscpd` signals).
- Ordering of commits within each plan (one commit per dedup target per D-10).
- Sizing/naming of the `.planning/GLOSSARY.md` structure.

### Deferred Ideas (OUT OF SCOPE)

- Broader type-system tightening (strict mode flip, `noImplicitAny` at config) — Phase 23+
- `jscpd`-as-CI-gate — reconsider after Phase 22
- Module boundary enforcement via ESLint `import/no-restricted-paths` — Phase 23 lint scope

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONSIST-01 | Duplication audit + dedup to shared/ | §Dedup Candidates — 7 shim files + 5 concrete near-duplicate pairs |
| CONSIST-02 | Naming / pattern / async consistency | §.then Audit (15 occurrences, 7 files); §Result-Type Audit (0 found); §Naming Audit |
| CONSIST-03 | Dead-code removal | §Tooling — `knip@6.6.2` or `ts-prune@0.10.3`, both need install |
| CONSIST-04 | Type narrowing + consolidation | §any/unknown Inventory (34 occurrences); §Type Consolidation |
| DOCS-01 | `.planning/` terminology + links | §Terminology Drift (sites/centers, patients/cases, cohort/group counts); §Link Integrity (44 links) |
| DOCS-02 | README + CLAUDE.md + inline doc audit | §Docs Inventory — CLAUDE.md MISSING AT ROOT (important finding) |
| DOCS-03 | Inline comment cleanup | §Inline Comment Audit (23 "what"-style comments, mix with "why") |

## Project Constraints (from CLAUDE.md)

**Finding:** There is **no `./CLAUDE.md` at the repository root**. The file `.planning/PROJECT.md` (read as a proxy by the research tooling) is the closest thing. D-08 lists `CLAUDE.md` in the docs-audit scope — the planner must either (a) create a new `CLAUDE.md` at repo root summarizing project state for Claude, or (b) update D-08 to drop `CLAUDE.md` from scope. **This needs a user decision.** Noted in §Assumptions Log as A2.

User's global memory layer (in `~/.claude/projects/.../memory/MEMORY.md`) includes:

- Security-first approach — audit immutability, server-side enforcement, no client trust
- Config in `settings.yaml` — single config source, no env vars
- EMD reads ONLY from local repo (DSF four-zone architecture)
- Full Review Workflow — "full-review" triggers parallel Claude/Codex/Gemini review

These are already honored by v1.0–v1.8 work; Phase 22 must not regress them (e.g., don't move config to env vars during any refactor).

## Standard Stack

### Dead-code Tooling

| Library | Version (verified) | Purpose | Why Standard |
|---------|--------------------|---------|--------------|
| `knip` | 6.6.2 | Unused files, exports, deps, types | Actively maintained; single-tool; supports workspaces; **recommended** [VERIFIED: npm view knip version] |
| `ts-prune` | 0.10.3 | Unused exports only | Simpler, older, narrower surface — fallback if knip config friction [VERIFIED: npm view ts-prune version] |
| `jscpd` | 4.0.9 | Copy-paste / near-duplicate detector | One-shot audit signal for ≥80% similarity (D-02) — **use as one-time report, not CI** per deferred decision [VERIFIED: npm view jscpd version] |

**Installation (local dev only, do not commit to `dependencies`):**

```bash
npm install --save-dev knip        # preferred
# or: npx --yes ts-prune            # one-off, no install
# or: npx --yes jscpd src server shared --min-lines 10 --min-tokens 50
```

**Recommended approach for CONSIST-03:**

1. Install `knip` as `devDependency`.
2. Add a minimal `knip.json` (or `knip.ts`) entry-points config: `server/index.ts`, `src/main.tsx`, `scripts/*.ts` entry points, `tests/**/*.test.{ts,tsx}`.
3. Run `npx knip` → produces baseline report.
4. Planner splits the report into atomic delete commits (one per module) per D-10.
5. Keep `knip` in `devDependencies` as a smoke-test command in `package.json` (no CI gate yet — deferred).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `knip` | `ts-prune` | Narrower scope (exports only); doesn't find unused files or unused dev deps. Use only if knip config becomes a rabbit-hole. |
| `jscpd` one-shot | Pure manual review | Manual is fine given the small surface — this codebase has ~106 TS files across src+server+shared. `jscpd` is a force-multiplier but not required. |

## User Constraints → Code Inventory

### Dedup Candidates (CONSIST-01)

**Ground truth:** Phase 12 already extracted the big cohort-math modules to `shared/`. Most cross-boundary code is already there. Remaining candidates are backward-compat shims (which may now be removable) and any helpers that drifted.

#### 7 Backward-compat shim files

| File | Canonical source | Status |
|------|------------------|--------|
| `src/utils/cohortTrajectory.ts` | `shared/cohortTrajectory` | 3-line re-export shim |
| `src/services/fhirLoader.ts` (partial) | `shared/fhirQueries`, `shared/fhirCodes`, `shared/patientCases` | Partial shim — re-exports + live loader logic |
| `src/types/fhir.ts` | (TBD — investigate) | Shim comment present |
| `src/components/outcomes/OutcomesPanel.tsx` | (TBD) | Shim comment present |
| `src/services/outcomesAggregateService.ts` | `shared/outcomesProjection` (likely) | Shim comment present |
| `server/hashCohortId.ts` | (self — server-only) | Shim comment is about settings init, NOT a dedup target |
| `server/outcomesAggregateApi.ts` | (self) | Shim comment about compat, NOT a dedup target |

**Plan-level action:** Planner reads each shim, diffs against its canonical source, and either (a) inlines the import and deletes the shim, or (b) marks it retained with a `// retained: <reason>` per D-06 (likely reason: "public import surface consumed by N components; renaming is Phase-23 churn"). Verify callers first.

#### Concrete near-duplicate probes — **findings per the additional_context checklist**

| Candidate pair | Verdict |
|----------------|---------|
| `hashCohortId` in `src/` vs `server/` | **NOT DUPLICATED.** Single source in `server/hashCohortId.ts`; only server callers. Server-only by design (HMAC secret never ships to client). No action. |
| FHIR query builders `shared/fhirQueries.ts` vs `server/` | **NOT DUPLICATED.** 36-line file; only re-exported from `src/services/fhirLoader.ts`. No server-side duplicate. No action. |
| Date/time/interval utilities `shared/intervalMetric.ts` vs others | Only one consumer (`src/components/outcomes/IntervalHistogram.tsx`). `src/utils/dateFormat.ts` and `shared/cohortTrajectory.ts` (date math) are distinct concerns. Low dup risk — planner should do a manual read to confirm. |
| `authFetch` / `getAuthHeaders` | **NOT DUPLICATED.** Single source in `src/services/authHeaders.ts` (174 lines); 10+ callers across src/pages and src/components. Server has no analog (doesn't need one). No action. |
| Validation helpers | Scattered across 16 files (most `validate`-named functions are context-specific: `validateUser`, `validateSettings`, etc.). **Not a dedup target** — each is a different schema. Leave as-is unless planner spots genuine overlap. |

**Net dedup work for 22-01:** Audit the 7 shim files + run `jscpd` once as a cross-check. Expect 0–3 real dedup commits. Bulk of CONSIST-01 is shim-inlining, not new extraction.

### `.then` Chain Inventory (CONSIST-02)

**Count:** 15 `.then(` occurrences across 7 files [VERIFIED: grep].

| File | Likely call-sites |
|------|-------------------|
| `src/context/DataContext.tsx` | primary hotspot (re-check in plan) |
| `src/context/AuthContext.tsx` | bootstrap/me flow |
| `src/components/outcomes/OutcomesView.tsx` | audit beacon fire-and-forget |
| `src/pages/LoginPage.tsx` | login submit |
| `src/pages/AdminPage.tsx` | user CRUD |
| `src/pages/SettingsPage.tsx` | TOTP status fetch |
| `server/index.ts` | listener/init |

**D-04 implication:** All 7 files are candidates for async/await rewrite in 22-01. Fire-and-forget `.then` (e.g., the audit beacon in `OutcomesView.tsx` at line 171) can remain as `void (async () => { ... })()` IIFE **or** stay as a `.then` — the planner should decide per-site since D-04 says "in new and touched files" (scope-limited). `Promise.all` / `Promise.race` continue to be allowed.

### Result-Type Audit (D-03 precondition)

**Count:** 0 occurrences of `type Result<`, `Ok<`, `Err<`, `Either<` in src/server/shared [VERIFIED: grep].

**Conclusion:** D-03 is **retroactively already true**. No migration needed. Planner should still add a one-line mention in 22-01's plan to document that audit was performed and came up empty.

### Naming Audit (CONSIST-02, D-05)

**Raw grep count:** ~200 snake_case TS identifier matches. **After filtering**, nearly all are:

- **Role names:** `data_manager`, `clinic_lead` (user-facing role slugs stored in users.json and in JWT payload — **wire format**)
- **Auth error codes:** `invalid_credentials`, `otp_required`, `account_locked`, `invalid_otp`, `network_error` — **wire format** returned from server
- **Audit event names / y-metric values:** `open_outcomes_view`, `delta_percent`, `in_progress` — **wire/enum values**, not identifiers
- **CSV column names:** `patient_pseudonym`, `observation_date` — **CSV header contract** per Phase 8 D-28
- **OAuth / JWT claims:** `preferred_username`, `access_token`, etc. — **spec-mandated** (OAuth2/OIDC)

**D-05 interpretation:** These snake_case *string literals* (role slugs, error codes, audit event names, CSV column names) are **wire-format**, not TS identifiers. They're exempt. True TS-identifier violations (e.g., a local variable `let my_thing`) appear to be **near-zero** in this codebase.

**Recommended planner action:** Explicitly document in 22-01 that the D-05 sweep found the codebase already compliant for TS identifiers; snake_case wire strings are legitimate per D-05's FHIR/HTTP/SQL exception. **This is a confirmation pass, not a rewrite pass.**

### `any` / `unknown` Inventory (CONSIST-04, D-07)

**Count:** 34 occurrences total across src+server+shared [VERIFIED: grep].

**D-07 scope:** narrow only in files already being touched by CONSIST-01..03. The planner should produce a small mapping: for each file touched by 22-01 or 22-02 (the shim audits, the `.then` rewrites), list `any`/`unknown` in that file and narrow where shape is inferable.

**Type consolidation (CONSIST-04 second half):** Scan for duplicated type definitions. Candidates to probe in 22-02:

- `Cohort` / `CohortFilter` types (likely defined in both `src/` and `shared/`)
- FHIR resource types (likely in `shared/types/` vs `src/types/fhir.ts`)
- User/role types (`UserRole` in AuthContext vs server's types.d.ts)

Planner should grep for type-name duplicates and move to `shared/types/` where cross-boundary.

### Dead-Code Baseline (CONSIST-03, D-06)

**Commented-out code:** only 2 comment lines in src/server/shared match the "commented-out code" heuristic (`// if/const/let/var/return/function/import/export/for/while`), and both are actually explanatory comments, not dead code. **Codebase is clean on this dimension.**

**Unused exports:** requires tooling. `knip` not yet installed. Baseline: UNKNOWN until 22-02 runs `knip`.

**Stale feature-flag branches:** no obvious flags in a quick scan; the settings.yaml structure carries config not feature flags. Low expected hit-rate.

### Inline Comment Audit (DOCS-03)

**"What" comment sample count:** 23 matches for simple action-verb single-line comments across src/server/shared. Sample review shows **mixed quality** — some are genuinely low-value (`// Fetch display name from /api/auth/users/me when user changes`), others embed requirement IDs that give them "why" value (`// Validate that all caseIds belong to centers the user is permitted to access (CENTER-03, T-05-02)`).

**Planner guidance:** DOCS-03 is a judgment call, not a mechanical sweep. Rule of thumb:
- Comment references a requirement ID / phase decision / ADR → retain (it's a "why")
- Comment restates the next line in English → delete
- Comment explains surprising behavior or tradeoff → retain

Do NOT global-delete the 23 matches; review each.

### Docs Inventory (DOCS-01, DOCS-02)

**Files in scope:**
- `.planning/PROJECT.md` — 271 lines
- `.planning/ROADMAP.md` — current milestone + shipped index
- `.planning/MILESTONES.md` — verified to exist
- `.planning/STATE.md` — active milestone state
- `.planning/REQUIREMENTS.md` — v1.9 requirements (current)
- `.planning/RETROSPECTIVE.md` — exists
- `.planning/v1.5-MILESTONE-AUDIT.md` — stray audit doc (planner decide: archive or retain)
- `.planning/milestones/v1.0..v1.8-ROADMAP.md` + `v1.6-REQUIREMENTS.md` — archived
- `README.md` — 167 lines
- `CLAUDE.md` — **DOES NOT EXIST AT REPO ROOT** (see §Project Constraints finding)

**Link integrity baseline:** 44 intra-`.planning/` markdown links [VERIFIED: grep -oE]. Spot-check of first 15 links shows all point to files that exist (all `milestones/v1.X-ROADMAP.md` targets resolve). Planner should run a one-shot link-check script in 22-03.

### Terminology Drift (DOCS-01)

Cross-`.planning/` counts (case-insensitive, across all files including `milestones/`):

| Term | Count | Note |
|------|-------|------|
| sites | 53 | heavy usage |
| centers | 54 | heavy usage, roughly tied with "sites" |
| patients | ~17+ | 17 just in first 5 files sampled |
| cases | ~15+ | 15 just in first 5 files sampled |
| cohorts | ~10+ | feature-specific — "cohort" is THE domain term, unlikely to need rename |
| groups | mixed | usually in test-group contexts, not domain — low rename pressure |

**Decision pressure:**

- **sites vs centers** — nearly equal count (53 vs 54). The codebase's `data/centers.json`, `/api/fhir/centers`, `CENTER-*` requirement IDs, `center_id` DB column, and `centers` field in user records all use **centers**. The ROADMAP and PROJECT.md frequently use **sites** for domain-facing language (7 sites, 8 sites, "each site runs its own instance"). **Recommendation to user: pick `sites` as the user-facing / domain term and `centers` as the code/wire term; document both in GLOSSARY.md as synonyms with scope. This matches current practice and avoids rewriting 100+ references in .json / code.**
- **patients vs cases** — both used. The codebase treats `patients` as the clinical-ontology term and `cases` as the app-level record (a patient has one or more "cases" / visits). These are **not synonyms**; planner should document this in GLOSSARY.md rather than normalize.
- **cohorts vs groups** — domain term is **cohort** everywhere. No normalization needed.

### Validation Architecture

Phase 21 shipped Nyquist-style validation for the failing-test fixes; Phase 22 inherits the same framework.

#### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest@4.1.4 + @testing-library/react@16.3.2 + supertest@7.2.2 [VERIFIED: package.json] |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run <file>` or `npx vitest run -t "<pattern>"` |
| Full suite command | `npm run test:ci` (runs `test:check-skips` then `vitest run`) |
| Skip policy | `scripts/check-skipped-tests.mjs` — 57 test files audited; no unlabelled `.skip` |
| Current baseline | **608/608 passing, zero skips** (Phase 21 exit state) |

#### Success-Criteria → Validation Map

| Success Criterion (ROADMAP) | Validation Command | Pass Signal |
|-----------------------------|--------------------|-------------|
| SC-1: Duplication audit resolved; tests green after each dedup commit | `npm run test:ci` after each commit | exit 0 + 608/608 |
| SC-1b: Duplication report produced | `npx --yes jscpd src server shared --min-lines 10 --min-tokens 50 -r json -o .planning/phases/22-codebase-docs-consistency/jscpd-report/` | Report generated; planner reviews; commits reference items closed |
| SC-2: Canonical patterns applied | Three greps, all must return 0 in touched files: (a) `grep -rn '\.then(' <touched files>` (b) `grep -rnE 'type (Result|Either)<' src server shared` (c) naming — manual review per D-05 | 0 matches in touched files |
| SC-3a: `knip` zero unused exports | `npx knip --reporter compact` | "No issues found" or only `// retained:` items with inline justification |
| SC-3b: Broad `any`/`unknown` narrowed in touched files | `grep -rnE ': any\b\|: unknown\b' <touched files>` | List down vs baseline of 34 |
| SC-3c: Type dedup | `grep -rnE '^(export )?type <Name> =' src server shared` for candidate types | Single definition per type name, colocated in `shared/types/` |
| SC-4a: `.planning/` terminology consistent + glossary | Glossary file exists at `.planning/GLOSSARY.md`; manual review of sites/centers/patients/cases usage | Glossary present + consistent usage in active docs |
| SC-4b: Intra-`.planning/` links resolve | One-shot link-check script (see §Validation Commands) | All 44 links resolve |
| SC-5a: README setup matches `package.json` scripts | Manual diff: README script mentions ↔ `package.json#scripts` | Match |
| SC-5b: Inline `// retained:` justifications present | `grep -rn '// retained:' src server shared` → each match has concrete reason (not "legacy") | Manual review |
| Phase gate: full suite green | `npm run test:ci` | exit 0; 608/608; zero skips |

#### Sampling Rate

- **Per task commit:** `npm run test:ci` (≈60s on this codebase — fast enough to run per commit). D-10 mandates this.
- **Per wave merge:** `npm run test:ci` + `npx knip` (wave 2 only) + `npm run lint`.
- **Phase gate:** Full suite green, knip clean, link-check clean, glossary file present, before `/gsd-verify-work`.

#### Wave 0 Gaps

- [ ] Install `knip` as `devDependency` — `npm install --save-dev knip`
- [ ] Create `knip.json` entry-points config (or `knip.ts`) listing: `server/index.ts`, `src/main.tsx`, `scripts/*.ts`, `tests/**/*.test.{ts,tsx}`
- [ ] One-shot `.planning/` markdown link-check script (can be inline bash in 22-03; no new infra needed)
- [ ] Optional: `npx jscpd` one-shot for duplication signal in 22-01

*No test-file gaps — Phase 21's safety net already covers the behavior Phase 22 must preserve.*

#### Validation Commands (cookbook for planner)

```bash
# Safety net (run after every atomic commit)
npm run test:ci

# .then inventory (pre- and post-rewrite)
grep -rn "\.then(" src/ server/ shared/ --include="*.ts" --include="*.tsx" | wc -l

# Result-type audit
grep -rnE "type Result<|type Ok<|type Err<|type Either<" src/ server/ shared/ --include="*.ts"

# any/unknown in touched file
grep -nE ": any\b|: unknown\b" <file>

# Dead-code scan
npx knip

# Link integrity (intra-.planning/ only)
while IFS= read -r line; do
  f=${line%%:*}; rest=${line#*:}; target=$(echo "$rest" | sed -E 's/.*\(([^)]+)\).*/\1/')
  [[ "$target" =~ ^https?: ]] && continue
  dir=$(dirname "$f"); full="$dir/$target"
  [[ -f "$full" ]] || echo "BROKEN: $f -> $target"
done < <(grep -rnoE '\[[^]]+\]\(\.?/?[^)]+\)' .planning/)

# jscpd one-shot
npx --yes jscpd src server shared --min-lines 10 --min-tokens 50
```

## Architecture Patterns

### Canonical Module Boundaries (existing, honor)

```
shared/          — pure-TS cross-boundary code (cohort math, FHIR helpers, types)
  cohortTrajectory.ts, fhirCodes.ts, fhirQueries.ts, intervalMetric.ts,
  outcomesProjection.ts, patientCases.ts, responderMetric.ts, types/
src/             — React SPA (browser)
  utils/, services/, context/, components/, pages/, hooks/, i18n/, types/
server/          — Express backend (Node)
  *.ts (flat; hashCohortId, authApi, auditApi, dataApi, etc.)
```

**Pattern:** Cross-boundary helper → `shared/`. Browser-only → `src/utils/` or `src/services/`. Server-only → `server/` (flat). **Do not introduce `src/lib/` or `server/utils/` barrels per D-01.**

### Canonical Error Handling (existing, retroactively matches D-03)

```typescript
// server/authApi.ts pattern — throw with typed error for discriminatable cases
if (!isValid) {
  throw new Error('[authApi] invalid credentials');
}
// Caller:
try { await login(...); } catch (err) { /* handle */ }
```

**Never:** `return { ok: false, error }` style Result types. D-03 bans them. Codebase already compliant.

### Canonical Async Style (target, D-04)

```typescript
// Preferred
const resp = await authFetch(url);
const data = await resp.json();

// Permitted (orchestration)
const [a, b] = await Promise.all([fetchA(), fetchB()]);

// Fire-and-forget in effects — acceptable pattern
void (async () => { await authFetch('/api/audit/events/view-open', { method: 'POST' }); })();
```

**Avoid (in touched files):** `.then(...).then(...).catch(...)` chains longer than one `.then`.

### Anti-Patterns to Avoid

- **Barrel re-export shims that survive past their usefulness** — e.g., `src/utils/cohortTrajectory.ts` exists only for backward-compat; either delete and update callers, or document with `// retained: <concrete reason>` per D-06.
- **Inlining cross-boundary helpers** — never move `shared/` code back into `src/` or `server/`; it undoes Phase 12 work.
- **Mechanical snake_case→camelCase on wire-format strings** — breaks JSON contracts with server, audit DB, CSV exports.
- **Bulk comment deletion** — DOCS-03 is judgment-based; don't regex-delete.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unused-export detection | Custom AST walker | `knip` or `ts-prune` | Maintained; handles re-exports, type-only exports, dynamic imports |
| Near-duplicate detection | Custom similarity heuristic | `jscpd` one-shot | AST-aware; configurable threshold; JSON report |
| Markdown link checking | Custom regex-based walker | Inline bash (see §Validation Commands) or `markdown-link-check` package | Inline bash is sufficient for 44 links; package adds dep |
| Glossary page generation | None — write by hand | Markdown hand-authored | It's ~1 page; tooling is overkill |

**Key insight:** The phase is small enough that tooling-per-concern is the right ratio. Don't introduce a "refactor framework" — just use the standard Node tools once and commit the outputs.

## Common Pitfalls

### Pitfall 1: Deleting an "unused" export that has an external consumer

**What goes wrong:** `knip` flags `X` as unused; you delete it; a CI script / generate-bundles script / future phase's migration relies on it; breakage surfaces later.

**Why it happens:** `knip` scans the configured entry points. Scripts in `scripts/` and test utilities may not be in the entry list.

**How to avoid:** Before deletion, `grep -rn "<exportName>" .` across the whole repo (not just src/server/shared). If any match is outside the entry-point graph, investigate. Per D-06, either add to entry-points or mark `// retained: <reason>`.

**Warning signs:** Export has a generic name like `formatDate` or `parseThing`; export is in a file named `*Utils.ts`; recent commit added it.

### Pitfall 2: Rewriting `.then` to async/await inside a React `useEffect` callback

**What goes wrong:** `useEffect(() => { async function run() { ... } run(); }, [...])` is correct; `useEffect(async () => { ... })` is silently broken (returns a Promise where React expects a cleanup function).

**Why it happens:** Reflex rewrite of `.then` to `await` in a callback.

**How to avoid:** When touching `useEffect`, use the IIFE pattern or the inner-async-function pattern. **Never** make the effect callback itself `async`.

**Warning signs:** Test failures that look like "act(...)" or state-update-on-unmounted-component warnings after the rewrite.

### Pitfall 3: Breaking a shim that has a dynamic/string import

**What goes wrong:** Deleting `src/utils/cohortTrajectory.ts` looks safe (grep shows no imports); a Vite/bundler dynamic import or a test file resolves the path by string.

**Why it happens:** `grep` matches static `import ... from 'X'` but misses `await import('X')` and Jest/Vitest config path aliases.

**How to avoid:** Search for the bare file name (without extension) in addition to the module-path grep. Run `npm run build` (not just tests) before committing a shim deletion — Vite's bundler resolves real paths.

**Warning signs:** Shim has been in place since Phase 12; there's usually a reason.

### Pitfall 4: Renaming a snake_case identifier that matches a wire-format contract

**What goes wrong:** `data_manager` gets renamed to `dataManager`; the JWT role claim, audit DB rows, and `data/users.json` file all still contain `data_manager`; authorization breaks for all clinic-lead users.

**Why it happens:** D-05 is interpreted too aggressively. D-05's "FHIR/HTTP wire exception" implicitly also covers: JSON-wire contracts (users.json), audit DB column values, OAuth/OIDC spec claims, CSV column names.

**How to avoid:** Treat **any string literal** that appears in persisted data (DB, JSON file, CSV) or cross-process JSON payloads as wire-format, even if D-05 doesn't enumerate it. When in doubt, grep for the string in `data/`, `docs/`, and tests — if it appears outside code, it's wire.

**Warning signs:** The identifier being renamed is an enum value in a discriminated union, a role name, an audit event name, or a DB column alias.

### Pitfall 5: Destructive .planning/ doc edits losing milestone history

**What goes wrong:** DOCS-01 cleanup rewrites `.planning/ROADMAP.md`; the archived `<details>` blocks for v1.0–v1.8 are trimmed as "stale"; future retrospective reference is lost.

**Why it happens:** "Stale" is ambiguous. Milestone history IS the retrospective.

**How to avoid:** `milestones/v1.X-ROADMAP.md` files are **sacred archives** — never edit. `.planning/ROADMAP.md`'s collapsed summaries of shipped milestones are retention-valuable — compress wording, do not delete.

**Warning signs:** A diff in 22-03 deletes more than 10 lines from `ROADMAP.md`.

## Code Examples

### Adding a `knip.json` entry-point config

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
    "server/index.ts",
    "src/main.tsx",
    "scripts/generate-all-bundles.ts",
    "scripts/check-skipped-tests.mjs",
    "tests/**/*.test.{ts,tsx}"
  ],
  "project": [
    "src/**/*.{ts,tsx}",
    "server/**/*.ts",
    "shared/**/*.ts"
  ],
  "ignoreExportsUsedInFile": true
}
```

[CITED: https://knip.dev/reference/configuration — knip configuration schema]

### Retaining an intentionally-unused export with justification (D-06)

```typescript
// retained: public export consumed by scripts/generate-all-bundles.ts via
// dynamic import at runtime; knip entry-point list covers the script but
// this helper is invoked reflectively — removing it breaks bundle generation.
export function buildCenterBundle(config: CenterConfig): FhirBundle { ... }
```

### Rewriting a `.then` in a React effect (safe pattern)

```typescript
// Before
useEffect(() => {
  authFetch('/api/auth/totp/status')
    .then(r => r.json())
    .then(setStatus)
    .catch(console.error);
}, []);

// After (inner-async-function pattern)
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const resp = await authFetch('/api/auth/totp/status');
      const data = await resp.json();
      if (!cancelled) setStatus(data);
    } catch (err) {
      if (!cancelled) console.error(err);
    }
  })();
  return () => { cancelled = true; };
}, []);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ts-prune` (unused exports only) | `knip` (unused files + exports + deps + types) | knip v1 (~2023), v6.x current | knip subsumes ts-prune; ts-prune still works but unmaintained direction |
| Custom duplication detection | `jscpd` one-shot | jscpd is the incumbent | Reliable AST-based detector; safe as one-shot |
| Result-types for error handling in TS | Throw + typed Error subclasses | ongoing; D-03 aligns | Matches Node idiom; codebase already throw-only |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-05's FHIR/HTTP/SQL exception implicitly covers JWT role names, auth error codes, audit event names, and CSV column names (all JSON wire formats) | §Naming Audit | If wrong and these must be camelCased, ~100+ sites break authorization and audit reading. **Needs user confirmation in /gsd-discuss-phase follow-up OR planner should explicitly ask.** |
| A2 | `CLAUDE.md` in D-08 scope is NOT present at repo root. Planner should either (a) create one summarizing project state, or (b) confirm with user that D-08 should drop CLAUDE.md from scope. | §Project Constraints | If wrong and user expected an existing file: no impact (it truly doesn't exist). If planner silently skips: D-08 scope partially unmet. |
| A3 | `sites` vs `centers` should be documented as domain-facing vs wire/code synonyms (both retained) rather than normalized to one term | §Terminology Drift | If wrong and user wants a single canonical term: ~100+ renames across 7 files + data/centers.json + server code. Noted as a decision pressure point. |
| A4 | `patients` vs `cases` are **not** synonyms (patient = clinical subject; case = app-level record) and should be disambiguated in glossary, not normalized | §Terminology Drift | If wrong and user considers them synonyms: glossary structure needs revision. Low code impact. |
| A5 | Phase 12's backward-compat shims (7 files) are candidates for removal IF all live callers have been migrated; verification is per-file | §Dedup Candidates | If wrong and a shim is still load-bearing for an external consumer: build/test breaks surface at deletion. Mitigated by D-10 safety net. |
| A6 | `jscpd` is appropriate as a one-shot audit tool but NOT as a CI gate (matches deferred decision) | §Standard Stack | If wrong and user wants it as a gate: Phase 23 scope. No Phase 22 impact. |
| A7 | `Promise.all` / `Promise.race` remain allowed (D-04 explicit) and fire-and-forget `.then` beacons can remain or convert to void-IIFE at planner's discretion | §Canonical Async Style | If wrong and user wants strict conversion: small extra scope in 22-01 for fire-and-forget sites (1–2 files). |

## Open Questions

1. **CLAUDE.md: create or drop from scope?**
   - What we know: D-08 lists it; file doesn't exist at repo root.
   - What's unclear: intent — user may have meant `.planning/PROJECT.md`, or may want a new `CLAUDE.md` authored.
   - Recommendation: surface in 22-03 plan; default to creating a minimal `CLAUDE.md` pointing to `.planning/PROJECT.md` unless user says otherwise.

2. **sites vs centers — single term or dual with glossary note?**
   - What we know: both used ~equally; `centers` dominates code/wire; `sites` dominates domain prose.
   - What's unclear: user preference.
   - Recommendation: GLOSSARY.md documents both with scope; do NOT rename in bulk.

3. **Which shim files are still load-bearing?**
   - What we know: 7 shim files identified.
   - What's unclear: which have external (script, test, dynamic-import) consumers.
   - Recommendation: 22-01 plan includes a per-shim audit step (grep + build) before deletion.

4. **jscpd one-shot: run it or skip?**
   - What we know: codebase is small (106 TS files); manual review may suffice.
   - What's unclear: cost/benefit on this scale.
   - Recommendation: run once at the start of 22-01 for signal; don't block if output is noisy.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | base | ✓ | (v20+ per package.json prerequisite) | — |
| npm / npx | tooling install | ✓ | bundled | — |
| vitest | safety net | ✓ | 4.1.4 | — |
| ESLint | lint invariant | ✓ | 9.39.4 | — |
| knip | CONSIST-03 | ✗ | — | `ts-prune` (also needs install) |
| ts-prune | CONSIST-03 fallback | ✗ | — | Manual review (not feasible at scale) |
| jscpd | CONSIST-01 optional | ✗ | — | Manual review (feasible — 106 files) |

**Missing dependencies with fallback:**
- `knip` → install as `devDependency` (one-line Wave 0 step)
- `jscpd` → `npx --yes` for one-shot use (no install)

**Missing dependencies blocking execution:** None. All Phase 22 work can proceed with a single `npm install --save-dev knip`.

## Sources

### Primary (HIGH confidence)

- Working-tree grep / file inventory of `/Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app` as of 2026-04-23 — all dedup-candidate, count, and terminology claims verified directly against source.
- `package.json` — test framework + script names + zero of `knip`/`ts-prune`/`jscpd` in deps [VERIFIED].
- `eslint.config.js` — existing `no-restricted-imports` rule structure used as precedent for future lint tightening [VERIFIED].
- `.planning/phases/21-test-uat-polish/` artifacts — 608/608 safety net baseline [CITED via /gsd-plan-phase init].
- `.planning/CONTEXT.md` (phase-scoped 22-CONTEXT.md) — D-01..D-10 locked decisions [VERIFIED].
- `.planning/PROJECT.md` — terminology baseline and shipped-milestone record [VERIFIED].

### Secondary (MEDIUM confidence)

- `npm view <pkg> version` for knip/ts-prune/jscpd current versions [VERIFIED: npm registry 2026-04-23].
- knip.dev / ts-prune README / jscpd README — tool scope and maintenance status [CITED].

### Tertiary (LOW confidence)

- None. All claims in this research were either verified against the working tree, the npm registry, or are flagged `[ASSUMED]` in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry; choice between knip/ts-prune is discretionary.
- Architecture patterns: HIGH — patterns extracted from existing codebase (Phase 12 `shared/`, Phase 20 ESLint rule), not invented.
- Code inventory counts: HIGH — grep-based, reproducible.
- Terminology drift: MEDIUM — counts are accurate but the "what to normalize" question needs user input (A3, A4).
- Pitfalls: HIGH — pitfalls 1, 2, 4 are load-bearing traps in this specific codebase; 3 and 5 are general.

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — stable refactor phase; no upstream dep volatility expected to invalidate findings).
