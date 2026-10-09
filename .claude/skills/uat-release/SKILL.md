---
name: uat-release
description: Phase 4 of the EMD user-study loop — bump the version, update SBOM and roadmap, commit, push and tag ("push and tag"), let CI publish the container image to GHCR, create the GitHub Release, pull-test the published image on both architectures, verify the release-only requirements, write the developer response (md + docx) and draft the mail to the tester. Use when the owner says "release", "push and tag", "commit, push, tag", "cut the release", "write the reply/response".
---

# uat-release — ship the round and answer the tester

Precondition: `/uat-verify` reported round line `FAIL 0 · UNVERIFIED 0` on a committed tree (`verification.yaml`
`deployment` names the commit). **Push, tag and release only on the owner's explicit go-ahead.**

## 1. Version + records (commit before pushing)
```bash
. scripts/useavibe/node22.sh
```
- `package.json` `version` → `X.Y.0` (hotfix: patch). Lockfile: `npm install --package-lock-only` with the **default**
  npm (12); a plain `npm install` under node@22 rewrites the lockfile (drops `libc` fields) and rebuilds better-sqlite3
  for the wrong ABI. The UI shows this version (`__APP_VERSION__`, Problem-melden dialog) and so does `GET /healthz`.
- `SBOM.md`: header (version, generated date + what changed); tables + counts whenever `package.json` dependencies
  changed — it is a release gate.
- `.planning/<vX.Y>-ROADMAP.md`: the verification record (gates, smoke, harness lines, browser results, certified commit).
- Commit `release(vX.Y): version X.Y.0, SBOM, roadmap` + the session's Co-Authored-By trailer. Only this commit may
  differ from the verified commit: `git diff --stat <verified-commit>..HEAD -- src server shared public deploy Containerfile`
  must be empty.

## 2. Tag → CI → Release → published-image tests
```bash
git push origin main
git tag -a vX.Y -F - <<'EOF'      # body = release notes: one line per item (id: behaviour), verification summary, update instruction
vX.Y <title> — <one line>
…
EOF
git push origin vX.Y
gh run list --workflow container.yml --limit 1          # then: gh run watch <id> --exit-status
gh release create vX.Y --verify-tag --notes-from-tag --title "vX.Y — <title>"
```
CI moves `latest` to the new image in the same push (the tester's nightly auto-update follows it). Verify GHCR
anonymously (the package is public) — tags list and `latest` digest = `X.Y` digest:
```bash
T=$(curl -s "https://ghcr.io/token?scope=repository:okohlbacher/eyematics-emd-app:pull" | jq -r .token)
curl -s -H "Authorization: Bearer $T" https://ghcr.io/v2/okohlbacher/eyematics-emd-app/tags/list
for t in latest X.Y; do curl -s -H "Authorization: Bearer $T" -H "Accept: application/vnd.oci.image.index.v1+json" -o /dev/null -w "$t %{http_code} %header{docker-content-digest}\n" https://ghcr.io/v2/okohlbacher/eyematics-emd-app/manifests/$t; done
```
Pull-test the published image (amd64 = the tester's host, emulated here; arm64 = native):
```bash
PLATFORM=linux/amd64 PORT=3301 IMAGE=ghcr.io/okohlbacher/eyematics-emd-app:X.Y bash scripts/container-smoke.sh
IMAGE=ghcr.io/okohlbacher/eyematics-emd-app:X.Y bash scripts/container-smoke.sh
```
Run the published image (`docker run -d --name emd-release -p 127.0.0.1:3312:3000 -v emd-release-vol:/data
ghcr.io/…:X.Y`), spot-check the round items and execute the release-only requirements
(`npm run requirements -- --browser --area DEPLOY --release > handoff/rounds/<vX.Y>/browser-procedures-release.md`),
record them in `handoff/rounds/<vX.Y>/verification-release.yaml` (`deployment: "ghcr.io/…:X.Y"`), then
`npm run requirements -- --round handoff/rounds/<vX.Y> --release --report handoff/rounds/<vX.Y>/report-release.md`.
Clean up the container and volume.

**Rollback** (a published image turns out broken): point `latest` back at the previous version —
`docker login ghcr.io` (PAT with `write:packages`, not in the repo) then
`docker buildx imagetools create -t ghcr.io/okohlbacher/eyematics-emd-app:latest ghcr.io/okohlbacher/eyematics-emd-app:<previous>`
— and tell the tester to run `podman auto-update`. Then fix forward as a hotfix (`vX.Y.1`).

## 3. Developer response (md + docx) — only what the tester has not confirmed
`.planning/<vX.Y>-DEV-RESPONSE-TO-UAT.md`, same shape as `.planning/v1.19-DEV-RESPONSE-TO-UAT.md`: title
`# EMD vX.Y — Developer Response to UAT (NF round R)`, intro naming the tester docx it answers, legend (✅ Fixed ·
🟡 Partially fixed · ⚪ Kept by design / Decision · ↪ Backlog · 🔧 Fixed this round (please re-test) · ❓ Open — needs
your input), one sentence listing what the tester confirmed closed (not repeated), then per UI area and item:
**You wrote:** (verbatim) · optional **Root cause:** in plain language (say plainly when we were at fault) ·
**What changed:** · **How to verify:** (a click path in German UI terms with arrows and the expected numbers, e.g.
"Dokumentationsqualität → Zeitraum → "Letztes Jahr": the count drops (245 → 71)") · **Status:**. Tone: second person,
no file names or code identifiers. Close with the verification paragraph (tests, gates, harness lines, smoke,
published-image pull-tests, what could not be reproduced here). Then the docx at the repo root —
`EMD-vX.Y-UAT-Developer-Response_<YYYY-MM-DD>.docx` (date = the commit day):
`pandoc .planning/vX.Y-DEV-RESPONSE-TO-UAT.md -o EMD-vX.Y-UAT-Developer-Response_<date>.docx`
(pandoc 3.x on PATH; `anthropic-skills:docx` is the alternative). md and docx are always
committed together and the docx regenerated whenever the md changes: `docs(vX.Y): developer response to NF UAT round
R (md + docx)`. Push when the owner asks.

## 4. Mail draft for the tester
Their language (NF writes German), concise: what was wrong in one sentence, what changed as a bullet list in user terms,
the update command (`podman auto-update`, or wait for the nightly timer; then hard reload), how to confirm the version
(`curl -s https://<host>/healthz` shows `"version"`, or the Problem-melden dialog), anything they must set (e.g.
`auth.refreshCookieSecure: true` behind TLS), a request to attach the next docx **and** the in-app issues export
(Einstellungen → "Issues exportieren"), the release-notes link. Save it under the scratchpad and print it; the owner
sends it. Never include credentials.

## 5. Memory + close
Write non-obvious lessons into `handoff/HANDOFF.md` §10 (the repo is the handoff — per-machine memory is a cache),
update conventions there if one changed, and leave the tree clean on the tag.
