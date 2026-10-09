# Source me (". scripts/useavibe/node22.sh"): puts a Node 22 runtime first on PATH.
# better-sqlite3 is built for the Node 22 ABI (handoff/HANDOFF.md §7). Tries, in order: the node already on PATH,
# nvm ("nvm use 22"), Homebrew node@22. Installed by the UseAVibe harness; replaces the owner-specific PATH line.
_useavibe_node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null; }
if [ "$(_useavibe_node_major)" != 22 ] && [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1
fi
for _useavibe_brew in /opt/homebrew/opt/node@22/bin /usr/local/opt/node@22/bin; do
  if [ "$(_useavibe_node_major)" != 22 ] && [ -x "$_useavibe_brew/node" ]; then PATH="$_useavibe_brew:$PATH"; export PATH; fi
done
unset _useavibe_brew
if [ "$(_useavibe_node_major)" != 22 ]; then
  unset -f _useavibe_node_major
  echo "node22.sh: Node 22 not found (install with 'nvm install 22' or 'brew install node@22')" >&2
  return 1 2>/dev/null || exit 1
fi
unset -f _useavibe_node_major
