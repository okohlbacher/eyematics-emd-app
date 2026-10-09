---
name: uat-round
description: Run one full iteration of the EMD user study — tester feedback docx → structured triage → implementation → compliance + regression verification on the deployed container → release → developer response. Use when the owner attaches a tester response docx, says "next round", "here is the new feedback", "next iteration", "hotfix", or asks to "run the UAT loop". Orchestrates the phase skills uat-triage, uat-implement, uat-verify and uat-release; read handoff/HANDOFF.md first if this is your first round.
---

# uat-round — one iteration of the EMD UI user study

The study loop: the tester (NF, Aachen) uses the deployed container, writes a Word docx replying to our last
developer response (plus, ideally, the in-app issues export), we triage it, implement, verify compliance with what was
asked **and** regression against the UI requirements registry, release a new container tag, and answer with a
developer-response docx. Rounds are numbered by the version they ship as (`v1.21`, `v1.22`, …).

Full background, conventions and pitfalls: `handoff/HANDOFF.md`. Read it once per session.

## Phases (each is its own skill — invoke them, do not improvise)

| # | Skill | Produces | Stops for the owner? |
|---|---|---|---|
| 0 | preflight (below) | clean main, green gates, registry valid | only if something is red |
| 1 | `/uat-triage` | `.planning/<vX.Y>-UAT-TRIAGE.md`, `handoff/rounds/<vX.Y>/items.yaml`, `.planning/<vX.Y>-ROADMAP.md`, registry promotions/amendments | **yes** — owner decisions, then approval of roadmap + acceptance + registry changes |
| 2 | `/uat-implement` | code + tests per item, commits per workstream, adversarial review folded | no (unless a finding needs a product decision) |
| 3 | `/uat-verify` (= the owner's word **"test"**) | container smoke 18/18, round line `FAIL 0 · UNVERIFIED 0`, `verification.yaml`, deviations fixed | no — report per item |
| 4 | `/uat-release` | version bump, tag, GHCR image, GitHub Release, pull-tests, release-only checks, dev-response md + docx, mail draft | **yes** — push/tag/release only when the owner says so |

**Hotfix path** (a mail-triggered report between rounds, like v1.20.1): same phases compressed into one session —
round folder `handoff/rounds/vX.Y.Z/`, item ids `H1…`, triage may be a few lines in the roadmap, verify and release as
usual, patch tag `vX.Y.Z`, mail instead of a docx.

## 0. Preflight (every round)

```bash
. scripts/useavibe/node22.sh   # better-sqlite3 is built for Node 22 — every npm/npx/node command in this repo
git status --short && git log --oneline -1 && git describe --tags
npm run test:ci 2>&1 | grep -E "Test Files|Tests |FAIL" ; npm run build >/dev/null && npm run lint >/dev/null && npm run knip
npm run requirements -- --no-run        # registry schema + static mappings valid (0 schema errors)
```
- Working tree clean, on `main`; `main` may be ahead of the last release tag by docs/tooling commits — code commits
  since the tag mean an unfinished round or hotfix: ask. knip prints 4 harmless "Remove redundant entry pattern" hints.
- Check `handoff/HANDOFF.md` §6 "Last full sweep": if none yet, ask the owner whether to run the baseline browser
  sweep now (in parallel with implement), or defer.
- Ponytail persona may be active (`handoff/HANDOFF.md` §9): shortest correct diff, no speculative abstractions, one
  runnable check per non-trivial change.

## Decision points you must not skip
1. After triage: present the triage summary and ask the `needs_decision`/`design` questions (AskUserQuestion, recommended
   option first, ≤ 4 per call; without the tool, end the turn with the numbered questions). Then approval of roadmap +
   acceptance criteria + registry changes. Do not implement before that.
2. Before any `git push`, tag or GitHub Release: explicit owner go-ahead ("push and tag", "release").
3. Never log in to the tester's real deployment with credentials from an email; verify on the local container
   (`127.0.0.1`) and, read-only, via public endpoints of the real host (`curl -sI`, `GET /healthz`).

## Done means
- `handoff/rounds/<vX.Y>/report-release.md`: round line `FAIL 0 · UNVERIFIED 0`, registry `FAIL 0`, against the
  **published** image (smoke 18/18 on amd64 + arm64, release-only requirements recorded).
- `.planning/<vX.Y>-DEV-RESPONSE-TO-UAT.md` + the root `EMD-<vX.Y>-UAT-Developer-Response_<YYYY-MM-DD>.docx` exist and
  omit items the tester already confirmed closed.
- The owner has the mail draft for the tester (their language; update = `podman auto-update` + hard reload; ask for the
  next docx + issues export).
