#!/usr/bin/env node
// PreToolUse hook (Edit|Write|MultiEdit|NotebookEdit): blocks edits of protected files with exit 2 (build prompt §5.4).
// Installed by the UseAVibe harness. Bash-based writes are caught later by the gate's integrity step.
import path from 'node:path';

import { protectedReason, readStdinJson, repoRoot } from './lib.mjs';

const input = await readStdinJson();
const ti = input.tool_input ?? {};
const target = ti.file_path ?? ti.notebook_path ?? ti.path;
if (!target) process.exit(0);
const root = repoRoot(input.cwd || process.cwd());
const abs = path.resolve(input.cwd || root, target);
const rel = path.relative(root, abs).split(path.sep).join('/');
if (rel.startsWith('..') || path.isAbsolute(rel)) process.exit(0); // outside the repo: the data-deny hook decides
const why = await protectedReason(rel, root);
if (why) {
  process.stderr.write(`UseAVibe: ${rel} is protected — ${why}. Do not work around this; report it under ## Blocked.\n`);
  process.exit(2);
}
