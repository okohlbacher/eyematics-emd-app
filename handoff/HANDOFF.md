# EMD UI user study — handoff for the testing/implementation agent

> Distributed as `emd-uat-handoff_<date>.zip`, deliberately **not** tracked in the app repository. Install into a
> checkout of `okohlbacher/eyematics-emd-app` with `./install.sh <checkout>` — see `INSTALL.md` at the zip root.

**Status:** v1.20.2 shipped (2026-10-03); 8 tester rounds completed (v1.13 → v1.19.1), then the container deployment
(v1.20) and two production hotfixes. This document, the skills under `.claude/skills/uat-*`, the registry under
`handoff/requirements/`, the round folders under `handoff/rounds/` and `scripts/requirements-check.mjs` are the package a
coding agent needs to run the next rounds without this session's history.

Read order for a new agent: this file → `CLAUDE.md` → `.claude/skills/uat-round/SKILL.md` → the last round's
`.planning/v1.19-UAT-TRIAGE.md` and `.planning/v1.19-DEV-RESPONSE-TO-UAT.md` (the canonical shapes).

---

## 1. What the study is

The EyeMatics Clinical Demonstrator (EMD) is a React 19 + Vite SPA served with its Express API from one container
(`ghcr.io/okohlbacher/eyematics-emd-app`). The clinical tester (NF, Uniklinik Aachen — also co-author of the
Lastenheft) uses the deployed instance and sends, per round, **our previous developer-response docx annotated inline**
("Test results: …" / "Answer: …" under each item, an "Additional Points (NF)" section for new remarks, screenshots
embedded). We iterate:

```
tester docx ──► triage (decisions, acceptance criteria) ──► implement (worktree agents, tests, review)
      ▲                                                                   │
      │                                                                   ▼
 dev-response docx + mail ◄── release (tag → CI → GHCR → pull-tests) ◄── verify (container smoke + harness + browser)
```

Three roles: **tester** (feedback, confirmation), **owner** (Oliver — decisions, approvals, push/tag/release
go-ahead, sends the mail), **agent** (everything else). The owner's control words: **"test"** = `/uat-verify`;
**"adversarial review"** = internal reviewer + the three external CLIs (`/uat-implement` §4); **"push and tag" /
"release"** = `/uat-release` §2; **"ponytail"** = the lazy-senior-dev persona (§9).

## 2. The loop, phase by phase

| Phase | Skill | Input → output | Gate to pass |
|---|---|---|---|
| 1 Triage | `/uat-triage` | tester docx (+ issues export) → `.planning/<vX.Y>-UAT-TRIAGE.md`, `handoff/rounds/<vX.Y>/items.yaml`, `.planning/<vX.Y>-ROADMAP.md`, registry promotions/amendments | `requirements --round --no-run` 0 schema errors; owner answers `needs_decision`/`design` items, approves roadmap + acceptance + registry changes |
| 2 Implement | `/uat-implement` | roadmap → commits on main, tests tagged with item ids, registry-mapped tests untouched, review folded | `test:ci`, `build`, `lint`, `knip`, `requirements --round` (real run: every item unit PASS, registry 0 FAIL) |
| 3 Verify | `/uat-verify` | clean committed tree → container → `verification.yaml`, deviations fixed | smoke 18/18; `requirements --round` **round line** `FAIL 0 · UNVERIFIED 0`; `--changed <last-tag>` scope `FAIL 0` |
| 4 Release | `/uat-release` | tag → GHCR image (`latest` moves with it), GitHub Release, pull-tests, release-only checks (`--release`), dev-response md + docx, mail draft | published image smoke 18/18 on amd64 + arm64; `report-release.md` round line `FAIL 0 · UNVERIFIED 0`; rollback recipe known |

`/uat-round` chains them and names the owner stop points. Each round is one version (`v1.21`, …); hotfixes within a
round are patch tags (`v1.20.1`, `v1.20.2`) with the four phases compressed. Historically three rounds fit in one
day (v1.16–v1.18 on 2026-06-16); a typical round is 8–14 items, 2–3 workstreams, 1–2 owner decisions, 1–2 deviations
caught in verify.

## 3. Artifacts and where they live

| Artifact | Path | Notes |
|---|---|---|
| Tester input | `~/Downloads/EMD-<tested>-UAT-User-Response[-N]_<date>.docx` | not committed (only round 1's `EMD-v1.12-UAT-Response_NF.docx` is); read with `unzip -p … word/document.xml \| sed 's/<\/w:p>/\n/g; s/<[^>]*>//g'` |
| Triage (prose) | `.planning/<vX.Y>-UAT-TRIAGE.md` | first commit of a round: `docs(vX.Y): round-N triage` |
| Round items (machine) | `handoff/rounds/<vX.Y>/items.yaml` | acceptance, test + browser mappings; read by the harness |
| Roadmap | `.planning/<vX.Y>-ROADMAP.md` | phases/workstreams, sequencing, what shipped, verification record (v1.16–v1.19 kept this inside the triage as "## Grouping / workstreams" — a separate file is the rule from now on) |
| Owner decisions | inside the triage (`## Owner decisions (locked <date>)`) or the roadmap's `## Locked decisions`; one-off `.planning/v1.13-DECISIONS.md`, `.planning/v1.16-CLARIFICATION-K3c.md` | |
| Browser results | `handoff/rounds/<vX.Y>/verification.yaml` | PASS/FAIL/BLOCKED with evidence, per item and per registry id |
| Harness reports | `handoff/rounds/<vX.Y>/report-local.md`, `report-release.md` | produced by `requirements-check --report` |
| Developer response | `.planning/<vX.Y>-DEV-RESPONSE-TO-UAT.md` + root `EMD-<vX.Y>-UAT-Developer-Response_<date>.docx` | always committed together (`docs(vX.Y): developer response to NF UAT round R (md + docx)`); docx = `pandoc md -o docx`; only items the tester has not confirmed |
| Registry | `handoff/requirements/<AREA>.yaml` | the regression contract (§4) |
| Release record | annotated tag message (= changelog), GitHub Release, `SBOM.md` header | no CHANGELOG file — `git tag -n30` is the history; 26 tags v1.0 → v1.20.2 |
| Browser-procedure precedents | `.planning/milestones/*/NN-HUMAN-UAT.md` / `NN-UAT.md` (8 files), `*-VALIDATION.md` (13), `*-UI-SPEC.md` (10) | GSD-era checklists: numbered `### N. <title>` with `expected:` / `result:` / `note:` — the ancestor of the registry's `browser.steps/expect` |
| Older history | `FEEDBACK-TRACKING.md` (formative analysis, v1.10, German, ✅/❌/💬), `.planning/v1.12-UAT-FEEDBACK.md`, `.planning/milestones/` (GSD archive ≤ v1.12) | the formal GSD chain (`ROADMAP.md`, `STATE.md`, `MILESTONES.md`) stopped at v1.12; rounds since use the lightweight files above |

## 4. The UI requirements registry (regression contract)

`handoff/requirements/<AREA>.yaml` — one file per UI area, generated 2026-10-08 by a multi-source sweep (Pflichtenheft
EMDREQ-* and Lastenheft N-ids via `docs/Anforderungsabgleich.md`, every accepted or by-design UAT item v1.12–v1.20.2,
the UI code, the Benutzerhandbuch/Deployment docs), merged per area, then **verified against the current code and the
test suite** by one agent and re-checked by an adversarial second agent. The verified `status` is what counts; a
`sources:` entry from a frozen document (`docs/Benutzerhandbuch.md` and the two specs are frozen at v1.4,
2026-04-11/28, and describe none of the post-v1.13 UI) is provenance, not truth.

```yaml
area: TRAJ
requirements:
  - id: UIR-TRAJ-001            # UIR-<AREA>-<nnn>, never reused
    title: "…"                  # ≤ 70 chars
    statement: "…"              # one testable sentence; German control labels in quotes
    status: implemented         # implemented | partial | not_implemented | retired (as of the current tree)
    when: release               # optional: only checkable on the PUBLISHED image (harness skips it unless --release)
    sources: ["EMDREQ-ANL-004", "UAT v1.19 N9"]
    evidence: ["src/components/outcomes/OutcomesPanel.tsx"]
    tests:                      # unit tests whose it() title contains `name` (case-insensitive substring)
      - file: tests/OutcomesPanel.test.tsx
        name: "y-axis"
    browser:                    # the procedure the verify agent executes on the container
      route: "/analysis?tab=trajectories"
      steps: ["…"]
      expect: "…"
    notes: "…"
```

Areas: `AUTH` login/2FA/lockout/inactivity · `NAV` layout, navigation, role gating, language · `LAND` Startseite ·
`COH` Kohortenbildung · `AGG` Analyse → Aggregiert · `TRAJ` Analyse → Verläufe · `CASE` Fallansicht · `QUAL`
Datenqualität · `DOCQ` Dokumentationsqualität · `ADMIN` Verwaltung · `AUDIT` Protokoll · `SET` Einstellungen · `THEME`
theme/i18n/fonts · `FEEDBACK` Problem melden · `DEPLOY` production-only behaviours (CSP, fonts, /healthz, cookies).

**Requirement-id namespaces you will meet** (oldest first): Lastenheft `N01.01…` (107 ids, RE-EM-K01…K11, authored
with the tester) → Pflichtenheft `EMDREQ-<AREA>-nnn` (41) → `docs/Anforderungsabgleich.md` (N-id ↔ EMDREQ ↔ code,
status Umgesetzt/Teilweise/Abweichend, v1.4) → GSD milestone ids in `.planning/milestones/v1.N-REQUIREMENTS.md`
(`QUAL-023`, `FALL-010`, `SESS-02`… — these appear in test titles) → UAT item ids (§9) → **`UIR-<AREA>-nnn`** (this
registry — the only layer kept current from here on). `.planning/REQUIREMENTS.md`, which the milestone files point to,
does not exist.

Lifecycle rules:
- **Grows by promotion only.** A round item becomes a requirement when the tester confirms it in the next docx
  (`/uat-triage` §5). `by_design` outcomes are promoted too — they are decisions the UI must keep.
- **Changes only by decision.** A statement changes only through a tester request + owner decision recorded in a
  triage (precedents: I5 reversed B2's Vollzähligkeit definition in v1.14, N8 reversed the round-6 denominator in
  v1.19, K3c partially reverted J3c). Never loosen one to make a check pass.
- **`status: partial` / `not_implemented`** entries are known gaps (mostly Anforderungsabgleich "Teilweise" /
  "Abweichend"); they are backlog, not regressions — a browser FAIL on them scores `KNOWN_GAP`, not `FAIL`.
- **Amend / retire** (`/uat-triage` §5): an accepted reversal rewrites the statement under the same id with the old
  text in `notes`; removed behaviour becomes `status: retired` (ignored by the harness, id never reused).
- A requirement with `tests: []` is browser-only: it needs a `verification.yaml` record in every verify pass of its
  area (185 of 408 after the review — Plotly and Recharts internals are never exercised in jsdom).
- Size after generation + review (2026-10-08): 408 requirements (384 implemented, 18 partial, 6 not implemented);
  220 pass via mapped unit tests, 0 fail, 0 mapping drift, 3 release-only (`when: release`)
  (`handoff/reports/registry-2026-10-08.md`).

## 5. The test harness

| Layer | Command | Catches |
|---|---|---|
| Unit/integration | `npm run test:ci` = skipped-test guard (`.skip` needs a `// SKIP_REASON:` line) + vitest (120 files / 1 327 tests, ~10 s) + bundle audits | logic, components in jsdom, API routes via supertest. **Runs locally only — there is no CI test workflow** (CI only builds the image on tags) |
| Static | `npm run build` (tsc -b + vite), `npm run lint`, `npm run knip` | types, lint, dead code (4 harmless "Remove redundant entry pattern" hints are expected) |
| Requirements | `npm run requirements [-- --round handoff/rounds/<vX.Y>] [--report …] [--browser] [--area X] [--id X] [--results f] [--no-run] [--strict] [--help]` | registry + round items vs the unit run and the browser records; mapping drift (`MISSING`) |
| Container | `bash scripts/container-smoke.sh` (18 checks; `IMAGE=`/`PLATFORM=`/`PORT=`/`CONTAINER_CLI=` overrides) | boot, login, API, SPA, CSP canaries (no inline script, strict Plotly chunk, no upgrade-insecure-requests), volume seeding, SIGTERM, persistence, HEALTHCHECK |
| Browser | `/uat-verify` §3 with the Claude browser pane on `http://127.0.0.1:3311` | tester intent, production-only behaviour, regressions in touched areas |

`requirements-check` verdicts: `unit` PASS / FAIL / MISSING (incl. only-skipped tests, load failures) / NONE /
SKIPPED+PLANNED (`--no-run`, static title check) × `browser` PASS / FAIL / BLOCKED / NONE → `overall` FAIL /
KNOWN_GAP (browser FAIL on a known-gap entry) / PASS (requirement: unit or browser; **round item: browser PASS only**)
/ UNVERIFIED / N/A (non-fix/by_design round items, retired, `when: release` without `--release`). Two summary lines:
the registry and the **scope** (round items, or `--area`/`--changed` selection) — the scope line is the gate; `--strict`
applies to it. `--changed <git-ref>` selects requirements whose evidence/tests cite files changed since the ref;
`--sweep <file>` merges baseline-sweep records; every `verification*.yaml` in the round folder is loaded. Exit 1 on
FAIL or schema errors, 2 on bad flags. `--browser` output is large — redirect it to a file, never read it from a pipe. Every vitest run (including via the harness) writes two throw-away
`feedback/issue-*.json` files (`tests/issueApi.test.ts` writes into the real `FEEDBACK_DIR`); they are gitignored.

Test conventions the harness depends on: item ids in it()/describe titles (`it('[O3] …')`; historically
`describe('I5 (v1.14) — …')`, `it('L9: …')`), round files named by surface + round (`tests/CaseDetailRound7.test.tsx`
with a header listing the items), `// @vitest-environment jsdom` per UI test file, no jest-dom
(`queryByText(…).not.toBeNull()`), recharts mocked to expose props, Plotly never runs in jsdom (`tests/setup.ts` stubs
`getContext`; components render a caller-supplied fallback with data-testids), translations stubbed (`tDE`). Known
flaky: `tests/authMiddlewareLocal.test.ts` "none"-algorithm case under full parallel load — rerun in isolation before
blaming a change. Test counts per round: v1.13 1 201 → v1.19 1 323 → v1.20.2 1 327.

## 6. Verification policy (why the browser pass is not optional)

- **Production-only truths.** helmet's CSP (`script-src 'self'`, no `unsafe-eval`), secure cookies, self-hosted
  fonts and `serveFrontend` exist only in the container/production server; Vite dev has none of them. v1.20's
  "WebGL is not supported" (Plotly's regl `new Function` blocked by the CSP) and the dark-mode flash (inline script
  blocked) were invisible in dev. Verify on the container built by `scripts/container-smoke.sh`. (Rounds 1–8 verified
  on the Vite preview via `.claude/launch.json` `dev-5100` + `backend`; that is still fine for *reproducing* a report.)
- **Intent, not presence.** v1.16's canvas scatter shipped drawing 0 pixels because the check confirmed the canvas
  existed. The rule "every UI-affecting change gets live verification before it is closed" dates from v1.13
  (`.planning/v1.13-DECISIONS.md`); the procedure is now `/uat-verify` §3: follow the tester's own words, then try to
  refute the fix (other data, toggles, reload, dark mode, English, narrow viewport). Evidence = DOM/JS facts + a
  screenshot, recorded per id.
- **Regression scope (tiered).** Unit layer: the whole registry on every run (seconds). Browser layer: every round
  item + the requirements selected by `--changed <last-tag>` (files the round touched) + the items' own areas +
  `DEPLOY` (`--release`, on the published image); a **full sweep** of all browser-only requirements (~190, several
  hours via the pane) when the owner says "full regression", after a framework/library upgrade, or at least once per
  three rounds, recorded in `handoff/sweeps/<date>/verification.yaml` and merged with `--sweep`.
- **Last full sweep: none.** The registry was generated from code and spot-checked (24 entries re-verified against code and tests, 3
  executed live) on 2026-10-08; the first baseline sweep is pending the owner's decision (`/uat-round` §0).
- **What a PASS certifies.** `verification.yaml` names the commit the container was built from; the release commit may
  only differ in version/SBOM/roadmap (`/uat-release` §1 asserts it).

## 7. Environment facts (this Mac; adapt paths elsewhere)

- Node: run every npm/npx/node command with `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` (better-sqlite3 is
  built for Node 22's ABI; the default shell Node is 26). Lockfile edits: `npm install --package-lock-only` under the
  **default** npm 12 (node@22's npm rewrites the lockfile format); then `npm ci` under node@22.
- Docker Desktop (`open -a Docker`) builds and runs the image; Podman is not installed — the Quadlet unit is validated
  with the generator dry-run (`docs/Deployment.md`). Ports used here: 3311 verify container, 3301 amd64 pull-test,
  3312 published-image spot-check, 5173/5100 Vite, 3000 `npm start`. `pandoc` 3.x is at `/opt/homebrew/bin/pandoc`.
- `gh` is authenticated (repo + workflow scopes). GHCR package is public; CI builds amd64 + arm64 on every `v*` tag
  and moves `latest` in the same push (`.github/workflows/container.yml`, ~4 min); rollback = re-point `latest` with
  `docker buildx imagetools create` (needs a PAT with `write:packages`, `/uat-release` §2). `.claude/launch.json` has
  `dev`, `dev-5100`, `backend` for `preview_start`. Port 3300 is used by `scripts/container-smoke.sh` itself.
- **The browser pass depends on the Claude Code desktop app** (Browser pane tools `mcp__Claude_Browser__*`). Fallback
  order: the Chrome-extension tools `mcp__claude-in-chrome__*` with the same procedure; otherwise stop and tell the
  owner — a scripted (Playwright) fallback does not exist yet (§12).
- The owner's "adversarial review" relies on user-level tooling outside the repo: `~/.claude/skills/adversarial-review/`
  and the CLIs `codex` (`/opt/homebrew/bin`), `vibe` (`~/.local/bin`), `kimi` (`~/.kimi-code/bin`). Without them the
  mandatory part is the internal `code-reviewer` pass (`/uat-implement` §4).
- Browser pane quirks: viewport may init 0×0 (`resize_window 1440×900`), refs renumber after panels open, ≤ 25 actions
  per batch, coordinate clicks need a prior screenshot, console messages persist across reloads (log a marker),
  non-localhost hostnames are blocked, `preview_start` reuses the pane, software WebGL overstates Plotly cost.
- UI facts for procedures: seeded users `admin` (all centres), `forscher1` (UKA), `forscher2` (UKC), `epidemiologe`
  (UKA/UKC/UKG), `kliniker` (UKT), `diz_manager` (UKM), `klinikleitung` (all) — password in `docs/Konfiguration.md`
  → Standardbenutzer, 2FA off by default (OTP `123456` when on); the case URL is the FHIR Patient id, not the pseudonym
  (`EM-UKT-0027` → `/case/pat-ukt-027`, the N4/N5 repro case); persisted keys `emd-locale`, `emd-theme`,
  `emd-recent:<user>` (localStorage), `emd-token`, `emd-cohort-filters` and the Verläufe view state (sessionStorage —
  cleared on login/logout, so a fresh login resets layer toggles).

## 8. Deployment facts the agent needs when talking to the tester

Container runs as uid 1000 on port 3000; all state on `/data` (`~/EMD` via `deploy/EMD.container`): `settings.yaml`
(seeded from `deploy/settings.yaml` on first start — the 4 container deltas vs `config/settings.yaml` are enforced by
`tests/deploySettings.test.ts`), `users.json` (7 seeded accounts with the documented default password — tell the
tester to change them), secrets, SQLite DBs, `feedback/`. Updates: `podman auto-update` or the nightly timer, then a
hard reload. Behind TLS the tester sets `auth.refreshCookieSecure: true`. The tester's host is x86 (verify amd64
under emulation). Full text: `docs/Deployment.md`, `deploy/EMD.container`. The tester's live instance is reachable only
over HTTPS with their own credentials — read its public headers if you must (`curl -sI`), never log in there.

## 9. Conventions

- **Item ids:** one capital letter per round + number, lowercase sub-letter for independently shippable sub-points
  (`N6a`); rounds 2–8 used I…N, **the next round is O**; backlog remarks `O-bl1`, in-app issue-export items `O-ia1`,
  hotfix items `H1`. Round 1 (v1.13) used category letters A/B/C/D — history only.
  Ids are carried verbatim into commit subjects, test titles, tag messages and response headings.
- **Status legend** (dev response): ✅ Fixed · 🟡 Partially fixed · ⚪ Confirmed earlier / Kept by design / Decision ·
  ↪ Backlog · 🔧 Fixed this round (please re-test) · ❓ Open — needs your input. Triage headings: 🔵 area, 🔴 reversal /
  open, 💡 enhancement, 🟢 closed by tester.
- **Commits:** `type(scope): summary` with `type ∈ feat fix perf test docs chore refactor revert merge deploy ci release
  wip` and `scope` = version + locus (`v1.19 WS-B/N5`, `v1.21-p2`, `v1.21 round-9`, `v1.21.1 hotfix`); the summary names
  the item ids. Stereotyped subjects: `docs(vX.Y): round-N triage` · `merge(vX.Y): WS-A <surface> — <ids>` ·
  `fix(vX.Y): fold adversarial-review findings (both reviews)` · `fix(vX.Y round-N): <ids> live-verification deviations`
  · `docs(vX.Y): developer response to NF UAT round N (md + docx)` · `release(vX.Y): version X.Y.0, SBOM, roadmap`.
  Bodies explain cause, what was tried, measured numbers, and end with a `Verified: test:ci n/n, build, lint, knip;
  smoke 18/18; …` line plus the Co-Authored-By trailer the session's system reminder specifies.
- **Tags** are annotated: title line `vX.Y <title> — <one line>`, body = one line per item id, the verification
  summary, the update instruction. Version = round (`1.21.0`); `package.json` version feeds the UI's `__APP_VERSION__`;
  `SBOM.md` must be updated with any dependency change and at every release.
- Wire/DB/FHIR strings never change (D-05: `center`, `center_id`, `/api/fhir/centers`, …); config only in
  `config/settings.yaml` (no env vars); errors throw (D-03); shared helpers in `shared/` (D-01) — `CLAUDE.md`.
- Docs: `docs/*.md` are German (Benutzerhandbuch, Konfiguration, Deployment); triage/roadmap/dev-response are English
  with German UI labels in quotes; the tester mail is in the tester's language (German).
- Ponytail persona (when the owner has it on): YAGNI ladder, stdlib/native first, shortest diff, `// ponytail:` marks
  deliberate shortcuts, explanations ≤ 3 lines unless the owner asked for a report. It never trims validation,
  security, a11y or requested features.
- Decisions go to the owner via AskUserQuestion with the recommended option first; approvals are per action (one
  "push" does not cover the next tag). The owner is the only gate for push/tag/release.

## 10. Lessons that cost time (do not relearn)

| Lesson | Where it bit | Rule |
|---|---|---|
| CSP exists only in production | v1.20 WebGL outage, dark-mode flash, Google Fonts blocked, `upgrade-insecure-requests` blanking plain-HTTP hosts | container-smoke CSP canaries; verify on the container |
| RTL with mocked Recharts cannot validate chart interactivity | v1.13 A1 drill-down, v1.16 zero-pixel canvas scatter | live verification is part of "done"; tests assert data/props, the browser pass asserts behaviour |
| Recharts 3.8.1 renders some grouped `<Bar>`s at height 0 (value/width correct, healthy scale) | v1.19 N5 | overlay-on histogram is a CSS grouped-bar chart. Ruled out (do not retry): version pin 3.7.0, NaN offsets, `yAxisId`/domain, `barSize`/`barGap`, `isAnimationActive`, `key` remount, custom `shape`, `stackId`, `ResponsiveContainer` sizing, data-key renames, `Cell` wrappers, `minPointSize`, layout `vertical`, mock-vs-real render. Revert to `<Bar>` only if a Recharts upgrade fixes it. |
| Plotly hover fires only at data points (no mid-line hover) | v1.19 N1 kept by design | densifying lines = fake values + perf loss; offer click-to-select instead |
| Plotly re-creates WebGL contexts on purge/replot | v1.20.2 "Too many active WebGL contexts" | `PlotlyChart` purges only on unmount, releases detached `canvas.gl-canvas` contexts; `plotlyRenderable()` probes once |
| Dev-server flakiness | Vite dep cache after `npm install`, backend on :3000 reaped, cross-origin `location.href` wedging the pane | `rm -rf node_modules/.vite` + restart; same-origin navigation; `curl /healthz` before logging in |
| External review CLIs over-explore | vibe/kimi/codex 20–30 min without output | background them, read stderr, kill and synthesize |
| Worktree agents | an agent died with uncommitted work; blanket-merging stale worktrees | commit `wip` + continuation agent; merge only returned branches |
| Docs drift | CLAUDE.md said 901 tests, README 619; Benutzerhandbuch frozen at v1.4; Konfiguration contradicted the serveFrontend gate | the gate is "all pass"; treat frozen docs as provenance only; fix drift when you touch a doc |
| Tester reversals | I5 (v1.14), K3c (v1.16), N8 (v1.19) | a reversal is a `needs_decision`, cited against the prior decision, and the registry entry is amended with it (`/uat-triage` §5) |
| The harness can be green while the goal fails | handoff review 2026-10-08 | round items need a browser PASS (a unit test alone is not "verified"); registry-mapped tests are immutable for implementers; `--no-run` is a schema check, not a gate |
| Browser procedures written from code are not executed procedures | 3 of 3 executed live needed a correction (metric-tab keyboard focus, async dialog, label wording) | treat untested procedures as drafts; the first full sweep is the real baseline |

## 11. Round history (for calibration)

| Round | Ships as | Tester docx (reply to) | Items | Themes |
|---|---|---|---|---|
| formative | v1.10 | changelog discussion 2025-05-25 | 26 ACCEPT / 9 in-app tickets | first structured feedback (`FEEDBACK-TRACKING.md`) |
| GSD UAT | v1.12 | `45-HUMAN-UAT.md` checklist | #1–#9, Q1–Q3 | multi-select centres, saved searches, quality config |
| 1 | v1.13 | v1.12 response | A1–A6, B1–B2, C1–C3, D1 (+ F1–F8 hotfix review) | chart drill-down, theme default, plausibility tables |
| 2 | v1.14 | v1.13 response | I1–I6 | trajectory hover, Verläufe responsiveness, Vollzähligkeit reversal |
| 3 | v1.15 | v1.14 response (-2) | J1–J7 | IQR legend, split/compare, line drill-down, Verläufe perf (worker, progressive) |
| 4 | v1.16 | v1.15 response | K1–K7, K-bl1/2 | cohort overlay (legend, axis, tooltips, IOD), annotation header |
| 5 | v1.17 | v1.16 response | L1–L12 | Plotly rebuild of Verläufe (scattergl), IOD line plot, follow-OS dark mode |
| 6 | v1.18 | v1.17 response | M1–M14 | highlight, cohort-reference toggle, unified legend, dark theme on charts |
| 7 | v1.19 | v1.18 response | N1–N11 | hover/scatter highlight, header order, IOD axis, distribution %-bars, dark-mode completion, theme menu, overlay cohort selector |
| 8 | v1.19.1 | v1.19 response | N5 (re-raised) | styled tooltips on the CSS bars |
| container | v1.20 | mail | — | Containerfile, Quadlet, GHCR CI, smoke test |
| hotfix | v1.20.1 / v1.20.2 | mail (1 report) | — | CSP-safe Plotly, FOUC script, fonts, WebGL context churn |

## 12. Open backlog (owner can pull into a round)

- Registry entries with `status: partial` / `not_implemented` (spec gaps from `docs/Anforderungsabgleich.md`).
- No CI test gate — a `.github/workflows/test.yml` running `test:ci` + `requirements --no-run` on push would catch
  what today only the agent's local gates catch.
- `tests/issueApi.test.ts` writes into the real `feedback/` directory (2 files per run); point it at a temp dir.
- `docs/Benutzerhandbuch.md`, Pflichtenheft and Anforderungsabgleich are frozen at v1.4 — regenerate from the registry.
- Deviations found while reviewing the handoff (2026-10-08): metric-tab ArrowLeft/ArrowRight navigates relative to the
  focused tab, not the active one (`useOutcomesRouteState.ts` handleMetricKeyDown; UIR-TRAJ-001 note); the "Problem
  melden" dialog is white in dark mode (`FeedbackButton.tsx`; registry THEME entry with `status: partial`). Fixed the
  same day: the settings reset dropped `server:`/`stubs:`/`audit:` from settings.yaml (client reset + server guard,
  tests `settingsResetKeepsSections` / `settingsApi` "keeps top-level sections").
- `tsconfig.server.json` is not in the `tsc -b` references, so `server/` is never type-checked as a unit; `npx tsc -p
  tsconfig.server.json --noEmit` currently reports one pre-existing error (`server/initAuth.ts:156`). Fix and add it to
  the build.
- `CenterComparisonChart` tiny bars (7 px) — pre-existing, task chip filed in v1.19.
- Frontend-only deps in `dependencies` (~40 MB in the runtime image); health probe port hard-coded to 3000.
- N1 alternatives (click-to-select a trajectory line, patient picker).
- Playwright smoke (login + DEPLOY canaries + round-item routes) — becomes mandatory the first time a round runs
  without the desktop app's browser pane (§7).

## 13. Quick start for a new agent

```bash
cd /Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app && export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm ci && npm run test:ci && npm run build && npm run lint && npm run knip
npm run requirements                 # registry vs unit tests (expect 0 FAIL; ~190 UNVERIFIED browser-only is normal)
bash scripts/container-smoke.sh      # 18/18
npm run requirements -- --round handoff/rounds/v1.19   # the worked example: round line PASS 11 · FAIL 0
# then: /uat-round with the tester's docx
```
