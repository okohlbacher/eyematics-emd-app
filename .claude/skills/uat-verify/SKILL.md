---
name: uat-verify
description: Phase 3 of the EMD user-study loop and the owner's word "test" — build the production container from a clean tree, run the smoke test and the requirements harness (registry regression + round items), then adversarially verify every round item and every regression-selected registry requirement in the browser against the container, record verification.yaml, fix deviations and report per item. Use on "test", "verify", "check the round", "does it work in the container", "full regression".
---

# uat-verify — prove the round on the deployed container, adversarially

"Verified" means: the behaviour the tester **asked for** is observable on the **production container** (not only on the
Vite dev server — the CSP, cookies, fonts and serveFrontend exist only there), and nothing in the UI requirements
registry regressed. The v1.16 canvas scatter shipped broken because checks confirmed elements existed, not that they
behaved; the v1.20 WebGL outage shipped because dev had no CSP. Both are what this phase prevents.

Needs the Claude Code **desktop app** (Browser pane tools `mcp__Claude_Browser__*`). Fallback order: the Chrome
extension tools `mcp__claude-in-chrome__*` with the same procedure; otherwise stop and tell the owner — there is no
scripted browser fallback yet (`handoff/HANDOFF.md` §12).

## 1. Clean tree → build + smoke → run the container
```bash
. scripts/useavibe/node22.sh
git status --short                      # must be empty — commit (or `wip`) first; verification certifies a commit
docker info >/dev/null 2>&1 || { open -a Docker; until docker info >/dev/null 2>&1; do sleep 2; done; }
bash scripts/container-smoke.sh 2>&1 | grep -E "PASS|FAIL|==="    # builds image `emd-smoke`; expect 18/18
docker rm -f emd-verify >/dev/null 2>&1; docker volume rm emd-verify-vol >/dev/null 2>&1
docker run -d --name emd-verify -p 127.0.0.1:3311:3000 -v emd-verify-vol:/data emd-smoke
until curl -fsS http://127.0.0.1:3311/healthz >/dev/null; do sleep 0.5; done; curl -s http://127.0.0.1:3311/healthz
```
The fresh volume seeds the 7 demo users (`admin` / the password in `docs/Konfiguration.md` → Standardbenutzer); use
them only on `127.0.0.1`. Record `deployment: "emd-smoke built from $(git rev-parse --short HEAD)"` in `verification.yaml`.

## 2. Harness: regression + round items
```bash
npm run requirements -- --round handoff/rounds/<vX.Y> --report handoff/rounds/<vX.Y>/report-local.md
```
Read the **round line** (`round vX.Y: items n · PASS … · FAIL … · UNVERIFIED …`) — that is the gate; the registry line
above it normally shows ~190 UNVERIFIED (browser-only requirements) and that is expected. `FAIL` = a mapped unit test
failed, a file failed to load, or a mapping does not resolve — fix the code or the mapping, re-run. `KNOWN_GAP` = a
browser FAIL on a `partial`/`not_implemented` requirement: backlog, not a regression. Never "fix" a failure by loosening a
registry requirement; a requirement changes only through a tester/owner decision recorded in a triage.
`npm run requirements` without `--round` is the plain registry regression (unit layer only).

## 3. Browser pass — think like a skeptic
Select what to execute (write the listing to a file — never read it from a pipe, the output is large):
```bash
npm run requirements -- --browser --round handoff/rounds/<vX.Y> --changed <last-tag> > handoff/rounds/<vX.Y>/browser-procedures.md
```
`--changed <last-tag>` selects the registry requirements whose evidence/tests cite files changed since the tag (the
mechanical definition of "touched"); add `--area <AREA>` listings for the items' own areas. The file contains every
`fix`/`by_design` round item plus those requirements; `when: release` entries are excluded until `/uat-release`. A
**full sweep** of all browser-only requirements (`--browser` with no filter, ~190 procedures, several hours) is done on
"full regression", after a library upgrade, or at least every third round, and recorded under
`handoff/sweeps/<date>/verification.yaml` (`handoff/HANDOFF.md` §6).

For each procedure: follow the steps on `http://127.0.0.1:3311`, then try to refute — different data (another centre,
patient, cohort, metric tab), toggles on/off/on, reload, dark mode, English UI, narrow viewport where layout matters.
Confirm the tester's intent, not element presence: read values from the DOM/JS (`javascript_tool`), not from pixels
alone. Record each id as PASS / FAIL / BLOCKED with concrete evidence in `handoff/rounds/<vX.Y>/verification.yaml`
(template in `handoff/rounds/TEMPLATE/`; a `by_design` item is PASS when it behaves as designed; BLOCKED only with the
reason — it stays UNVERIFIED and the owner decides whether to accept it). Then re-run step 2 → round line `FAIL 0 ·
UNVERIFIED 0`, and the `--changed`/`--area` scope lines `FAIL 0`.

Browser pane procedure (`mcp__Claude_Browser__*`): `preview_start {url}` → `resize_window 1440×900` (the pane can
start at 0×0; screenshots then report an 800×500 coordinate frame — click by `ref`, not by 1440-scale coordinates) →
`find "Benutzername"` → `form_input` username, `find "Passwort"` → `form_input`, `find "Weiter"` → `left_click` by ref
→ `navigate` to the route. Prefer `read_page` (`filter: "interactive"`) / `find` / `javascript_tool` over screenshots
for facts; screenshots for proof. Refs are renumbered after panels open — `read_page` again before clicking; coordinate
clicks need a prior screenshot; ≤ 25 actions per `browser_batch`; console messages persist across reloads —
`console.log('MARKER-…')` before measuring; hostnames other than localhost/127.0.0.1 are blocked by the pane; hover
tooltips need `hover` + 1 s wait; dialogs (e.g. "Problem melden") open asynchronously — wait ≥ 2 s or until
`[role=dialog]` exists; Plotly: count `canvas.gl-canvas` and `.no-webgl` elements, trace counts via
`document.querySelectorAll('.js-plotly-plot')[i].data.length`. Persisted toggles live in sessionStorage and reset on
login. The Vite dev server (`preview_start {name: "dev-5100"}` + `backend`) is fine for *reproducing*, never for closing.

Optional parallel design: `Workflow({scriptPath: ".claude/workflows/uat-verify.js", args: {round: "vX.Y", date:
"YYYY-MM-DD"}})` designs the refutation attempts per item in parallel and executes them sequentially — use it when the
round has ≥ 6 items.

## 4. Deviations → fix → loop
A deviation is anything where the live behaviour differs from the acceptance criteria or the tester's quote. Fix it
(same rules as `/uat-implement`, including a test), commit (`fix(vX.Y round-N): <ids> live-verification deviations`),
rebuild (step 1), re-run steps 2–3 for the affected ids. Record the deviation and fix in the roadmap.

## 5. Report
Per item: verified / deviated-and-fixed / still-open (with the reason and what you need from the owner or tester); the
registry scope result; the commit the records certify. Clean up: `docker rm -f emd-verify; docker volume rm emd-verify-vol`;
`resize_window preset desktop`.
