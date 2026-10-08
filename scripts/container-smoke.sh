#!/usr/bin/env bash
# v1.20 — build (or pull) the EMD container image and prove it works end-to-end:
# boot → login → API → SPA → /data guard → volume contents → clean SIGTERM stop → state
# survives a restart. Prints PASS/FAIL per check; exit 1 if anything failed.
#
#   bash scripts/container-smoke.sh                                   # build from this checkout
#   IMAGE=ghcr.io/okohlbacher/eyematics-emd-app:latest bash scripts/container-smoke.sh   # test a published image
#   PLATFORM=linux/amd64 IMAGE=... bash scripts/container-smoke.sh    # emulate another arch
#   CONTAINER_CLI=podman bash scripts/container-smoke.sh              # podman instead of docker
set -euo pipefail
cd "$(dirname "$0")/.."

CLI=${CONTAINER_CLI:-docker}
PORT=${PORT:-3300}
BASE="http://127.0.0.1:$PORT"
NAME="emd-smoke-$$"
VOL="emd-smoke-vol-$$"
PLATFORM_ARGS=(${PLATFORM:+--platform "$PLATFORM"})

pass=0; fail=0
ok() { local d=$1; shift; if "$@" >/dev/null 2>&1; then echo "PASS  $d"; pass=$((pass + 1)); else echo "FAIL  $d"; fail=$((fail + 1)); fi; }
cleanup() {
  if [ "$fail" -gt 0 ]; then echo "--- container logs:"; "$CLI" logs "$NAME" 2>&1 | tail -40 || true; fi
  "$CLI" rm -f "$NAME" >/dev/null 2>&1 || true
  "$CLI" volume rm "$VOL" >/dev/null 2>&1 || true
}
trap cleanup EXIT

start() { "$CLI" run -d --name "$NAME" "${PLATFORM_ARGS[@]}" -p "127.0.0.1:$PORT:3000" -v "$VOL:/data" "$IMAGE" >/dev/null; }
wait_healthy() { for _ in $(seq 1 120); do curl -fsS "$BASE/healthz" >/dev/null 2>&1 && return 0; sleep 0.5; done; return 1; }

if [ -z "${IMAGE:-}" ]; then
  IMAGE=emd-smoke
  echo "--- building $IMAGE (${PLATFORM:-native})"
  "$CLI" build "${PLATFORM_ARGS[@]}" -f Containerfile -t "$IMAGE" . >/dev/null
fi

echo "--- first start (empty volume)"
start
ok "/healthz answers within 60 s" wait_healthy
ok "/healthz reports the package.json version" \
  test "$(curl -fsS "$BASE/healthz" | jq -r .version)" = "$(node -p "require('./package.json').version")"
ok "runs as uid 1000 (node)" test "$("$CLI" exec "$NAME" id -u)" = 1000

TOKEN=$(curl -fsS -H 'content-type: application/json' \
  -d '{"username":"admin","password":"changeme2025!"}' "$BASE/api/auth/login" | jq -r '.token // empty')
ok "login admin/changeme2025! returns a token" test -n "$TOKEN"
ok "GET /api/fhir/centers lists 6 centers" \
  test "$(curl -fsS -H "authorization: Bearer $TOKEN" "$BASE/api/fhir/centers" | jq '.centers | length')" = 6
ok "GET / serves the SPA" sh -c "curl -fsS '$BASE/' | grep -q '<div id=\"root\"'"
# v1.20.1 — the production CSP (helmet, script-src 'self') is only active here, never in Vite dev:
ok "index.html has no inline <script> (CSP blocks them)" \
  sh -c "! curl -fsS '$BASE/' | grep -o '<script[^>]*>' | grep -qv 'src='"
ok "Plotly chunk is the CSP-safe strict build (dist-min needs 'unsafe-eval' for WebGL)" \
  "$CLI" exec "$NAME" sh -c 'ls /app/dist/assets/plotly-strict.min-*.js'
ok "CSP has no upgrade-insecure-requests (would blank plain-HTTP hosts)" \
  sh -c "curl -fsSI '$BASE/' | grep -i '^content-security-policy:' | grep -vqi 'upgrade-insecure-requests'"
ok "GET /data/manifest.json is 403 (raw bundles guarded)" \
  test "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/data/manifest.json")" = 403
ok "GET /api/data/quality-flags without token is 401" \
  test "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/data/quality-flags")" = 401
ok "volume seeded: settings.yaml, users.json, audit.db, feedback/, jwt secret mode 600" \
  "$CLI" exec "$NAME" sh -c 'test -f /data/settings.yaml && test -f /data/users.json && test -f /data/audit.db \
    && test -d /data/feedback && [ "$(stat -c %a /data/jwt-secret.txt)" = 600 ]'
ok "config/settings.yaml + feedback resolve onto /data" \
  "$CLI" exec "$NAME" sh -c 'test "$(readlink /app/config/settings.yaml)" = /data/settings.yaml && test "$(readlink /app/feedback)" = /data/feedback'

t0=$(date +%s); "$CLI" stop "$NAME" >/dev/null; dt=$(( $(date +%s) - t0 ))
ok "SIGTERM stop completes in ${dt}s (≤ 3 s)" test "$dt" -le 3
ok "exit code 0 on stop" test "$("$CLI" inspect -f '{{.State.ExitCode}}' "$NAME")" = 0
"$CLI" rm "$NAME" >/dev/null

echo "--- second start (same volume)"
start
ok "/healthz answers after restart" wait_healthy
ok "old token still valid → jwt secret + users persisted" \
  test "$(curl -s -o /dev/null -w '%{http_code}' -H "authorization: Bearer $TOKEN" "$BASE/api/fhir/centers")" = 200
if [ "$CLI" = docker ]; then
  ok "image carries a HEALTHCHECK" test -n "$("$CLI" image inspect -f '{{.Config.Healthcheck.Test}}' "$IMAGE")"
fi

echo "=== $pass passed, $fail failed ($IMAGE, ${PLATFORM:-native})"
[ "$fail" -eq 0 ]
