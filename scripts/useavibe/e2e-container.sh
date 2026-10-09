#!/usr/bin/env bash
# UseAVibe acceptance tests against the production container (installed by the UseAVibe harness).
# Builds the image from the working tree (Containerfile, layer cache), runs it with a fresh /data volume on a free
# local port, runs Playwright against it and removes container and volume. Arguments go to `playwright test`.
#   bash scripts/useavibe/e2e-container.sh [tests/acceptance/Z1/Z1-P03.spec.ts] [--reporter=…]
# PLAYWRIGHT_BASE_URL already set → no container (e.g. a published image started by the operator).
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/useavibe/node22.sh
if [ -n "${PLAYWRIGHT_BASE_URL:-}" ]; then exec npx playwright test "$@"; fi
CLI=${CONTAINER_CLI:-docker}
IMAGE=${USEAVIBE_E2E_IMAGE:-emd-useavibe-e2e}
PORT=${USEAVIBE_E2E_PORT:-$(node -e "const s=require('net').createServer().listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")}
NAME="emd-e2e-$$"; VOL="emd-e2e-vol-$$"
cleanup() { "$CLI" rm -f "$NAME" >/dev/null 2>&1 || true; "$CLI" volume rm "$VOL" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$CLI" build -q -f Containerfile -t "$IMAGE" . >/dev/null
"$CLI" run -d --name "$NAME" -p "127.0.0.1:$PORT:3000" -v "$VOL:/data" "$IMAGE" >/dev/null
for _ in $(seq 1 120); do curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1 && break; sleep 0.5; done
curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null || { echo "e2e: container not healthy" >&2; "$CLI" logs "$NAME" | tail -30 >&2; exit 1; }
PLAYWRIGHT_BASE_URL="http://127.0.0.1:$PORT" npx playwright test "$@"
