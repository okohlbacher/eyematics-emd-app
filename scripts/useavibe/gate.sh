#!/usr/bin/env bash
# Stop hook: per-attempt gate of a /useavibe-fix session (build prompt §2.1 item 6, §5.4). Installed by the UseAVibe harness.
# No-op without .planning/useavibe/ACTIVE. Runs under Node 22 (better-sqlite3 ABI).
root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$root" || exit 0
[ -f .planning/useavibe/ACTIVE ] || exit 0
. scripts/useavibe/node22.sh || { echo "UseAVibe gate: Node 22 not available" >&2; exit 2; }
exec node scripts/useavibe/gate.mjs
