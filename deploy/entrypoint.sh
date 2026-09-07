#!/bin/sh
# EMD container entrypoint. /app/config/settings.yaml and /app/feedback are symlinks onto the
# /data volume — seed it before the server resolves them (a dangling symlink reads as "missing").
set -eu
if ! mkdir -p /data/feedback 2>/dev/null; then
  echo "EMD: /data is not writable by uid $(id -u)." >&2
  echo "     Rootless Podman: add 'UserNS=keep-id:uid=1000,gid=1000' to the unit (see docs/Deployment.md)." >&2
  echo "     Docker: run with --user \"\$(id -u):\$(id -g)\" or chown the host directory." >&2
  exit 1
fi
[ -f /data/settings.yaml ] || cp /app/deploy/settings.yaml /data/settings.yaml
exec node --import tsx server/index.ts
