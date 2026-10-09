#!/usr/bin/env node
// Start or end the gated fix session of one problem (called by /useavibe-fix; installed by the UseAVibe harness).
//   node scripts/useavibe/activate.mjs Z1-P03          → writes .planning/useavibe/ACTIVE (base = HEAD)
//   node scripts/useavibe/activate.mjs AT-M-004 --at   → acceptance-test defect session (cycle from CURRENT.json)
//   node scripts/useavibe/activate.mjs --review pass|findings → logs the ac-reviewer verdict (PL09 auxiliary count)
//   node scripts/useavibe/activate.mjs --clear         → only after a passed gate attempt or a "## Blocked" stop
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { STATE_DIR, appendJsonl, cycleConfig, git, readActive, readJson, readJsonl, repoRoot } from './lib.mjs';

const root = repoRoot();
const activeFile = path.join(root, STATE_DIR, 'ACTIVE');
const die = (m) => { console.error(`activate: ${m}`); process.exit(1); };
const args = process.argv.slice(2);

if (args.includes('--review')) {
  const a = readActive(root);
  const verdict = args[args.indexOf('--review') + 1];
  if (!a || !['pass', 'findings'].includes(verdict)) die('usage: --review pass|findings (inside an active session)');
  appendJsonl(path.join(root, STATE_DIR, `Z${a.cycle}`, 'attempts.jsonl'), {
    id: a.id, ts: new Date().toISOString(), head: git(root, 'rev-parse', 'HEAD'), result: 'review', verdict,
  });
  process.exit(0);
}

if (args.includes('--clear')) {
  const a = readActive(root);
  if (!a) process.exit(0);
  const last = readJsonl(path.join(root, STATE_DIR, `Z${a.cycle}`, 'attempts.jsonl')).filter((r) => r.id === a.id).at(-1);
  if (!last || !['pass', 'blocked'].includes(last.result)) die(`${a.id}: no passed gate attempt or Blocked report yet`);
  if (last.result === 'pass' && git(root, 'status', '--porcelain', '--', '.', ':(exclude).planning/useavibe')) {
    die('uncommitted changes — commit with the trailers first');
  }
  unlinkSync(activeFile);
  console.log(`activate: ${a.id} closed (${last.result})`);
  process.exit(0);
}

const id = args.find((x) => !x.startsWith('--'));
const at = args.includes('--at');
if (!id || !(at ? /^AT-M-\d{3}$/ : /^Z\d+-P\d+$/).test(id)) die('usage: activate.mjs <Z<k>-P<nn>> | <AT-M-nnn> --at | --clear');
if (existsSync(activeFile)) die(`another session is active: ${readActive(root)?.id} (one problem per session)`);
const k = at ? readJson(path.join(root, STATE_DIR, 'CURRENT.json'))?.cycle : Number(id.match(/^Z(\d+)/)[1]);
if (k === undefined || k === null) die('no current cycle (.planning/useavibe/CURRENT.json) — run the cycle open first');
const cfg = cycleConfig(root, k);
if (cfg.final) die(`Z${k} is the final evaluation cycle: no implementation (protocol)`);
if (!at) {
  const problems = path.join(root, STATE_DIR, `Z${k}`, 'PROBLEMS.md');
  if (!existsSync(problems)) die(`${path.relative(root, problems)} missing (freeze first)`);
  const row = readFileSync(problems, 'utf8').split('\n').find((l) => l.startsWith(`| ${id} |`));
  if (!row || !/\|\s*1 umgesetzt\s*\|\s*$/.test(row)) die(`${id} is not in the frozen list with PL06 = 1`);
  if (!existsSync(path.join(root, 'acceptance', `Z${k}`, `${id}.feature`))) die(`acceptance/Z${k}/${id}.feature missing`);
  const planRel = `${STATE_DIR}/Z${k}/PLAN.md`;
  const frozen = readJson(path.join(root, STATE_DIR, `Z${k}`, 'frozen.json'), {});
  if (!frozen.files?.[planRel]) die('PLAN.md is not approved — the study team runs `useavibe plan-approve` (R3, ZA05)');
  if (!frozen.files?.[`acceptance/Z${k}/${id}.feature`]) die(`acceptance/Z${k}/${id}.feature is not frozen (\`useavibe criteria-freeze\`)`);
}
const rec = {
  id, cycle: k, kind: at ? 'at' : 'usability', base: git(root, 'rev-parse', 'HEAD'),
  started: new Date().toISOString(), attempt_cap: cfg.attempt_cap ?? 3,
};
writeFileSync(activeFile, JSON.stringify(rec, null, 2) + '\n');
console.log(`activate: ${id} active (base ${rec.base.slice(0, 10)}, attempt cap ${rec.attempt_cap})`);
