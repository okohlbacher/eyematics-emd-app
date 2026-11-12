---
name: useavibe-accept
description: Run one team acceptance round of UseAVibe cycle Z<k> on the published release (by digest, under deployment constraints) — generate the checklist, then validate the team's RESULT.yaml and turn findings into follow-up fix iterations or the cycle close. The harness never judges results.
disable-model-invocation: true
argument-hint: <cycle number k>
---
Team acceptance round for cycle Z$ARGUMENTS (build prompt §5.12). The team checks only (1) that the fixes work and
(2) that nothing that worked before broke. You prepare and validate; you never fill or edit `RESULT.yaml`.

1. `useavibe round-open --app . --cycle $ARGUMENTS` — creates `acceptance-rounds/Z$ARGUMENTS/round-<r>/` with
   `CHECKLIST.md` (all scenarios of the implemented problems incl. `@visual`, the previous round's open findings,
   regression checks selected via the files changed in the cycle, Must requirements without automated coverage),
   `DEPLOYMENT.md` (acceptance container `EMD-accept` next to the study container, following `:dev`, own port and
   own fresh `/data` volume, decisions C-23, O-46; `podman auto-update`, then the running digest must equal the
   release's recorded digest — the team enters it under `deployment_check` in `RESULT.yaml`, round-validate refuses
   a mismatch; production settings with `auth.refreshCookieSecure: true`) and an empty `RESULT.yaml` template. Run the release-only checks of `/uat-release` §2 against the published image and attach
   their output to the round directory.
2. Hand over to the team. Stop here until the team says the round is recorded.
3. `useavibe round-validate --app . --cycle $ARGUMENTS` — checks completeness (every checklist item has a result,
   every finding has class A/B/C, steps, expected vs observed and attributed problem IDs), proposes attributions for
   class-B regressions (traceability; `git bisect` where an automated check reproduces them) for the team to confirm,
   writes `findings/<ID>.md` per attributed problem and closes the round (hash recorded; immutable afterwards).
4. Next step, as printed by round-validate: findings → for each attributed problem a fresh session
   `/useavibe-fix <ID>`, then `/useavibe-release`, then the next round; class C → the study team amends the `.feature`
   (deviation, re-freeze); no findings → `/useavibe-close`. From round 3 on, the team decides per open problem:
   continue or defer (PL06 = 2 with PL11; deferral of implemented work requires a trailered `git revert`).
5. A fix session that cannot reproduce a finding ends with `## Blocked` and proposes "not reproducible"; it changes
   no code. The operator then makes the disposition commit outside the sandbox, so the release check finds the finding
   addressed: `git commit --allow-empty` with the body "not reproducible — no code change" and the trailer
   `Round-Finding: <finding ID>` (O-29). The team decides in the next round on the re-test item
   (`disposition: confirmed | not reproducible | withdrawn`, reason unless confirmed); not reproducible or withdrawn
   findings do not count for PL09 and are reported separately.
