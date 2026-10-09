#!/usr/bin/env node
// SessionStart hook: logs model, Claude Code version, HEAD, permission mode and operator initials to
// .planning/useavibe/sessions.jsonl (git-ignored) and warns (stdout → session context) on a mismatch with the
// cycle configuration .planning/useavibe/Z<k>/cycle.json (build prompt §5.4; workflow plan §8).
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { STATE_DIR, appendJsonl, currentCycle, cycleConfig, git, readActive, readStdinJson, repoRoot } from './lib.mjs';

const input = await readStdinJson();
const root = repoRoot(input.cwd || process.cwd());
let version = 'unknown';
try { version = execFileSync('claude', ['--version'], { encoding: 'utf8', timeout: 5000 }).trim(); } catch { /* not on PATH */ }
let head = 'unknown';
try { head = git(root, 'rev-parse', 'HEAD'); } catch { /* no commits */ }
const k = currentCycle(root);
const cfg = k === null ? {} : cycleConfig(root, k);
const active = readActive(root);
const rec = {
  ts: new Date().toISOString(),
  session_id: input.session_id ?? null,
  source: input.source ?? null,
  model: input.model ?? process.env.ANTHROPIC_MODEL ?? 'unknown',
  claude_code: version,
  head,
  permission_mode: input.permission_mode ?? 'unknown',
  operator: process.env.USEAVIBE_OPERATOR ?? null,
  cycle: k,
  active: active?.id ?? null,
};
appendJsonl(path.join(root, STATE_DIR, 'sessions.jsonl'), rec);

const warn = [];
const modelId = typeof rec.model === 'object' ? rec.model?.id : rec.model;
if (cfg.model && modelId !== 'unknown' && modelId !== cfg.model) warn.push(`model ${modelId} ≠ cycle pin ${cfg.model}`);
if (cfg.claude_code && version !== 'unknown' && !version.startsWith(cfg.claude_code)) warn.push(`Claude Code ${version} ≠ cycle ${cfg.claude_code}`);
if (!rec.operator) warn.push('USEAVIBE_OPERATOR (initials) is not set');
if (cfg.final) warn.push(`Z${k} is the final evaluation cycle: implementation skills refuse to run`);
if (warn.length) console.log(`UseAVibe session check — ${warn.join('; ')}. Record any deviation in deviations.md.`);
