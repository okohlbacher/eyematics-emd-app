#!/usr/bin/env node
// PreToolUse hook (Read|Grep|Glob|Bash|Edit|Write|...): blocks any access to the private study workspace (data/, study/)
// with exit 2 (build prompt §2.2 item 3). Best effort on Bash strings; the OS sandbox (denyRead) covers subprocesses.
import path from 'node:path';

import { deniedRoots, isInside, readStdinJson, repoRoot } from './lib.mjs';

const input = await readStdinJson();
const ti = input.tool_input ?? {};
const cwd = input.cwd || process.cwd();
const root = repoRoot(cwd);
const denied = deniedRoots(root);
if (!denied.length) process.exit(0);

const candidates = [ti.file_path, ti.notebook_path, ti.path, ti.pattern, ti.glob].filter((v) => typeof v === 'string');
let hit = candidates.map((c) => path.resolve(cwd, c)).find((p) => denied.some((d) => isInside(p, d)));
if (!hit && typeof ti.command === 'string') {
  // absolute paths, ~-paths and relative climbs that resolve into a denied directory
  const tokens = ti.command.match(/[^\s'"`;|&<>()=]+/g) ?? [];
  hit = tokens
    .map((t) => t.replace(/^~(?=\/)/, process.env.HOME ?? '~'))
    .filter((t) => t.includes('/') || t === '..')
    .map((t) => path.resolve(cwd, t))
    .find((p) => denied.some((d) => isInside(p, d)));
}
if (hit) {
  process.stderr.write('UseAVibe: access to the private study workspace (data/, study/) is not allowed in development sessions (§2.2).\n');
  process.exit(2);
}
