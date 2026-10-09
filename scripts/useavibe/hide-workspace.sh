# Source me: useavibe_hidden_exec <cmd…> runs <cmd> with the private study workspace (data/, study/) hidden behind
# empty tmpfs mounts (bubblewrap), so code written in a development session — unit, e2e, gate steps — cannot read it
# even though hooks run outside Claude Code's sandbox (decision O-12). Installed by the UseAVibe harness.
# Without bubblewrap the command runs unwrapped and a warning is printed (record as deviation).
useavibe_hidden_exec() {
  local root parent args=() d
  root="$(git rev-parse --show-toplevel)"; parent="$(dirname "$root")"
  for d in "${USEAVIBE_WORKSPACE:+$USEAVIBE_WORKSPACE/data}" "${USEAVIBE_WORKSPACE:+$USEAVIBE_WORKSPACE/study}" \
           "$parent/data" "$parent/study"; do
    [ -n "$d" ] && [ -d "$d" ] && args+=(--tmpfs "$(cd "$d" && pwd -P)")
  done
  if [ -n "${USEAVIBE_HIDDEN:-}" ] || [ ${#args[@]} -eq 0 ]; then exec "$@"; fi
  if ! command -v bwrap >/dev/null; then
    echo "UseAVibe: bubblewrap missing — workspace NOT hidden from this run (record a deviation)" >&2; exec "$@"
  fi
  USEAVIBE_HIDDEN=1 exec bwrap --dev-bind / / "${args[@]}" -- "$@"
}
