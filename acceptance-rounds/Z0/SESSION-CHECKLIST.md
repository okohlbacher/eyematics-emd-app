# Session checklist — cycle Z0 (test leads)

Version under test: **1.20.3** · image `ghcr.io/okohlbacher/eyematics-emd-app@sha256:06f1c85606d58e5c93503187d995807ef84f40bd1716b756fd8ee9bbdebd5631`
Deployment (O-46): the study container `EMD` follows `:latest` with `AutoUpdate=registry` (the app's
`deploy/EMD.container`); `:latest` must have been promoted to this version (`/useavibe-close`). The digest-pinned unit
`deploy/useavibe/EMD-study.container` is the reference only and is not deployed.
Generated 2026-11-18T11:55:06Z by useavibe 0.1.0. Before **every** participant session:

1. [ ] Stop the study container; remove its `/data` volume; start with a **fresh volume** seeded with the same study
       accounts (same user names, roles and passwords — decision C-9). No saved searches, exclusions, quality flags or
       reviewed cases from earlier sessions may remain.
2. [ ] `GET /healthz` reports version **1.20.3**; enter exactly this version as VL02 in FB-V.
3. [ ] Run `podman auto-update` (or `systemctl --user restart EMD`) — the default timer runs only daily. Then the
       running image digest equals `sha256:06f1c85606d58e5c93503187d995807ef84f40bd1716b756fd8ee9bbdebd5631`, the recorded digest of 1.20.3
       (`podman inspect --format '{{.ImageDigest}}' EMD`). Record it: digest ________ checked (date, time) ________.
       A mismatch stops the session (no session on another version).
4. [ ] Record the **session date** (PS03); task answers that depend on the calendar date are evaluated per session
       date and synthetic data set (decision C-8).
5. [ ] Access as in every session: HTTPS through the reverse proxy, `auth.refreshCookieSecure: true`, the browser
       used by participants.
6. [ ] No harness, acceptance round or development work touches this container while the cycle runs (C-6, C-7, C-23);
       no `v*` tag is pushed and `:latest` is not promoted while a session runs (O-46).
