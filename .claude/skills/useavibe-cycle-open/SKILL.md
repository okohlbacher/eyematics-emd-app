---
name: useavibe-cycle-open
description: Open UseAVibe iteration cycle Z<k> — verify that the version to deploy passed its last team acceptance round without findings, record version and image digest, pin the study instance, and generate the session checklist for the test leads.
disable-model-invocation: true
argument-hint: <cycle number k> <version> <sha256 image digest>
---
Open cycle Z$0 for version $1 (digest $2). You prepare and check; deployment and every tag/push stay with the operator.

1. Run `useavibe cycle-open --app . --cycle $0 --version $1 --digest $2`. It refuses unless the version is the one
   whose last acceptance round (`acceptance-rounds/Z<k-1>/`, or the Z0 release and AT gate for Z1, decision C-25)
   ended without findings, and it writes `.planning/useavibe/CURRENT.json`, `.planning/useavibe/Z$0/cycle.json`
   (model pin, Claude Code version, harness version, prompt hashes, attempt cap, version, digest),
   `audit-baseline.json` and `acceptance-rounds/Z$0/SESSION-CHECKLIST.md` plus the digest-pinned unit
   `deploy/useavibe/EMD-study.container`. Report its output verbatim (summarised if long).
2. Read the generated session checklist back to the operator: before every participant session a fresh `/data`
   volume seeded with the same study accounts (decision C-9); `GET /healthz` version equals VL02; record the session
   date (oracle, decision C-8); auto-update off.
3. List what the operator must do by hand: install the pinned unit on the study host, disable `AutoUpdate`, confirm
   the running digest. Do not run deployment commands yourself.
