#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# load-blaze.sh
# Start a Blaze FHIR server, clear all data, and load the
# EyeMatics example bundles.
#
# Usage:
#   ./scripts/load-blaze.sh              # defaults: localhost:8080
#   ./scripts/load-blaze.sh --port 9090  # custom port
#   ./scripts/load-blaze.sh --no-start   # skip Docker start (server already running)
#
# Prerequisites: Docker, curl, python3 (for bundle conversion)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

BLAZE_PORT="${BLAZE_PORT:-8080}"
BLAZE_CONTAINER="eyematics-blaze"
SKIP_START=false
DATA_DIR="$(cd "$(dirname "$0")/../public/data" && pwd)"
BLAZE_URL="http://localhost:${BLAZE_PORT}/fhir"

# ── Parse arguments ──────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)    BLAZE_PORT="$2"; BLAZE_URL="http://localhost:${BLAZE_PORT}/fhir"; shift 2 ;;
    --no-start) SKIP_START=true; shift ;;
    *)         echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "═══════════════════════════════════════════════════════"
echo "  EyeMatics — Blaze FHIR Server Loader"
echo "  Server:  ${BLAZE_URL}"
echo "  Data:    ${DATA_DIR}"
echo "═══════════════════════════════════════════════════════"

# ── 1. Start Blaze ───────────────────────────────────────────
if [ "$SKIP_START" = false ]; then
  echo ""

  # Check Docker daemon is running
  if ! docker info > /dev/null 2>&1; then
    echo "  ✗ Docker daemon is not running."
    echo "    Please start Docker Desktop and try again."
    exit 1
  fi

  echo "▸ Ensuring Blaze image is available..."
  if ! docker image inspect samply/blaze:latest > /dev/null 2>&1; then
    echo "  Pulling samply/blaze:latest (this may take a few minutes)..."
    docker pull samply/blaze:latest
  else
    echo "  ✓ Image already present"
  fi

  echo ""
  echo "▸ Starting Blaze Docker container..."

  # Stop & remove existing container (if any)
  if docker ps -a --format '{{.Names}}' | grep -q "^${BLAZE_CONTAINER}$"; then
    echo "  Removing existing container '${BLAZE_CONTAINER}'..."
    docker rm -f "${BLAZE_CONTAINER}" > /dev/null 2>&1
  fi

  docker run -d \
    --name "${BLAZE_CONTAINER}" \
    -p "${BLAZE_PORT}:8080" \
    -e JAVA_TOOL_OPTIONS="-Xmx2g" \
    samply/blaze:latest \
    > /dev/null

  echo "  Container started. Waiting for Blaze to become ready..."

  # Wait up to 120 seconds for Blaze to be ready
  MAX_WAIT=120
  ELAPSED=0
  while [ $ELAPSED -lt $MAX_WAIT ]; do
    if curl -sf "${BLAZE_URL}/metadata" > /dev/null 2>&1; then
      echo "  ✓ Blaze is ready (took ${ELAPSED}s)"
      break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done

  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "  ✗ Blaze did not start within ${MAX_WAIT}s. Check Docker logs:"
    echo "    docker logs ${BLAZE_CONTAINER}"
    exit 1
  fi
else
  echo ""
  echo "▸ Skipping Docker start (--no-start). Verifying server..."
  if ! curl -sf "${BLAZE_URL}/metadata" > /dev/null 2>&1; then
    echo "  ✗ Blaze is not reachable at ${BLAZE_URL}"
    exit 1
  fi
  echo "  ✓ Blaze is reachable"
fi

# ── 2. Clear all data ───────────────────────────────────────
echo ""
echo "▸ Clearing existing data..."

RESOURCE_TYPES=("Patient" "Condition" "Observation" "Procedure" "MedicationStatement" "ImagingStudy" "Organization")
for RT in "${RESOURCE_TYPES[@]}"; do
  # Count existing resources
  COUNT=$(curl -sf "${BLAZE_URL}/${RT}?_summary=count" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
  if [ "$COUNT" -gt 0 ]; then
    echo "  Deleting ${COUNT} ${RT} resources..."
    # Fetch all IDs and delete one by one (Blaze doesn't support conditional delete of all)
    curl -sf "${BLAZE_URL}/${RT}?_count=1000&_elements=id" | \
      python3 -c "
import sys, json
bundle = json.load(sys.stdin)
for entry in bundle.get('entry', []):
    rid = entry.get('resource', {}).get('id', '')
    if rid:
        print(rid)
" | while read -r RID; do
      curl -sf -X DELETE "${BLAZE_URL}/${RT}/${RID}" > /dev/null 2>&1 || true
    done
  fi
done
echo "  ✓ Data cleared"

# ── 3. Load example bundles ─────────────────────────────────
echo ""
echo "▸ Loading example data bundles..."

# Convert collection bundles to transaction bundles and POST them
for BUNDLE_FILE in "${DATA_DIR}"/center-*.json; do
  FILENAME=$(basename "$BUNDLE_FILE")
  echo "  Loading ${FILENAME}..."

  # Convert collection → transaction bundle using Python
  python3 -c "
import json, sys

with open('${BUNDLE_FILE}') as f:
    bundle = json.load(f)

tx = {
    'resourceType': 'Bundle',
    'type': 'transaction',
    'entry': []
}

for entry in bundle.get('entry', []):
    resource = entry['resource']
    rt = resource['resourceType']
    rid = resource.get('id', '')
    tx['entry'].append({
        'resource': resource,
        'request': {
            'method': 'PUT',
            'url': f'{rt}/{rid}' if rid else rt
        }
    })

json.dump(tx, sys.stdout)
" | curl -sf -X POST "${BLAZE_URL}" \
    -H "Content-Type: application/fhir+json" \
    -d @- \
    -o /dev/null -w "    → HTTP %{http_code}, %{size_upload} bytes sent\n"

done

# ── 4. Verify ───────────────────────────────────────────────
echo ""
echo "▸ Verifying loaded data..."
echo ""
printf "  %-25s %s\n" "Resource Type" "Count"
printf "  %-25s %s\n" "─────────────────────────" "─────"
TOTAL=0
for RT in "${RESOURCE_TYPES[@]}"; do
  COUNT=$(curl -sf "${BLAZE_URL}/${RT}?_summary=count" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "?")
  printf "  %-25s %s\n" "$RT" "$COUNT"
  if [[ "$COUNT" =~ ^[0-9]+$ ]]; then
    TOTAL=$((TOTAL + COUNT))
  fi
done
echo ""
echo "  Total resources: ${TOTAL}"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✓ Done! Blaze is running at ${BLAZE_URL}"
echo ""
echo "  To use in the app:"
echo "    1. Open Settings > Data Source"
echo "    2. Select 'FHIR Server'"
echo "    3. Enter URL: ${BLAZE_URL}"
echo ""
echo "  To stop Blaze:"
echo "    docker stop ${BLAZE_CONTAINER}"
echo "═══════════════════════════════════════════════════════"
