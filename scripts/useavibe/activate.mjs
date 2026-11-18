#!/usr/bin/env node
// Start or end the gated fix session of one problem (called by /useavibe-fix; installed by the UseAVibe harness).
//   node scripts/useavibe/activate.mjs Z1-P03          → writes .planning/useavibe/ACTIVE (base = HEAD)
//   node scripts/useavibe/activate.mjs AT-M-004 --at   → acceptance-test defect session (cycle from CURRENT.json)
//   node scripts/useavibe/activate.mjs --review pass|findings-fixed|findings-open → logs the ac-reviewer verdict (PL09 auxiliary count)
//   node scripts/useavibe/activate.mjs --commit        → operator, outside the session sandbox: commits the staged fix
//                                                         with .planning/useavibe/COMMIT_MSG, then clears (O-25 a)
//   node scripts/useavibe/activate.mjs --clear         → only after a passed gate attempt or a "## Blocked" stop
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { STATE_DIR, appendJsonl, cycleConfig, git, readActive, readJson, readJsonl, repoRoot } from './lib.mjs';

const root = repoRoot();
const activeFile = path.join(root, STATE_DIR, 'ACTIVE');
const msgFile = path.join(root, STATE_DIR, 'COMMIT_MSG');
const die = (m) => { console.error(`activate: ${m}`); process.exit(1); };
const args = process.argv.slice(2);

if (args.includes('--review')) {
  const a = readActive(root);
  const verdict = args[args.indexOf('--review') + 1];
  if (!a || !['pass', 'findings-fixed', 'findings-open'].includes(verdict)) die('usage: --review pass|findings-fixed|findings-open (inside an active session)');
  appendJsonl(path.join(root, STATE_DIR, `Z${a.cycle}`, 'attempts.jsonl'), {
    id: a.id, ts: new Date().toISOString(), head: git(root, 'rev-parse', 'HEAD'), result: 'review', verdict,
  });
  process.exit(0);
}

// Last gate entry of the active problem; review verdicts (step 5) and re-checks (O-26 a: unchanged tree after a pass,
// so they only confirm it) come after the passing gate and do not count.
const lastGate = (a) => readJsonl(path.join(root, STATE_DIR, `Z${a.cycle}`, 'attempts.jsonl'))
  .filter((r) => r.id === a.id && !['review', 'recheck'].includes(r.result)).at(-1);

if (args.includes('--commit')) {
  // The session's sandbox hides the workspace, so the pseudonym pre-commit guard cannot run there (O-25): the session
  // stages its change and writes COMMIT_MSG; the operator commits here, where the git hooks see study/meta.
  const a = readActive(root);
  if (!a) die('no active session');
  if (lastGate(a)?.result !== 'pass') die(`${a.id}: no passed gate attempt — nothing to commit`);
  if (!existsSync(msgFile)) die(`${path.relative(root, msgFile)} missing — the session writes it in step 6`);
  const msg = readFileSync(msgFile, 'utf8');
  const idTrailer = a.kind === 'at' ? 'Acceptance-Defect' : 'Usability-Problem';
  const regressionOf = a.cause?.match(/^(?:latent|defect-fix) (\S+)/)?.[1]; // O-38: link to the causing fix
  const missing = [`${idTrailer}: ${a.id}`, 'Attempts:', 'Reviewer:', ...(regressionOf ? [`Regression-Of: ${regressionOf}`] : [])]
    .filter((t) => !new RegExp(`^${t}`, 'm').test(msg));
  if (missing.length) die(`commit message lacks trailer(s): ${missing.join(', ')}`);
  // Porcelain lines keep their leading status column, so not via the trimming git() helper.
  const loose = execFileSync('git', ['status', '--porcelain', '--', '.', ':(exclude).planning/useavibe'], {
    cwd: root, encoding: 'utf8',
  }).split('\n').filter((l) => l && (l[1] !== ' ' || l.startsWith('??')));
  if (loose.length) die(`unstaged or untracked changes — the session stages the whole fix:\n${loose.join('\n')}`);
  if (!git(root, 'diff', '--cached', '--name-only')) die('nothing staged');
  try {
    execFileSync('git', ['commit', '-F', msgFile], { cwd: root, stdio: 'inherit' });
  } catch {
    die('git commit failed (message kept; see the hook output above)');
  }
  unlinkSync(msgFile);
  unlinkSync(activeFile);
  console.log(`activate: ${a.id} committed (${git(root, 'rev-parse', '--short', 'HEAD')}) and closed`);
  process.exit(0);
}

if (args.includes('--clear')) {
  const a = readActive(root);
  if (!a) process.exit(0);
  const last = lastGate(a);
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
if (!id || !(at ? /^AT-M-\d{3}$/ : /^Z\d+-P\d+$/).test(id)) die('usage: activate.mjs <Z<k>-P<nn>> | <AT-M-nnn> --at | --commit | --clear');
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
let cause;
if (at) {
  // Routing by cause (O-38): only defects not caused by a usability fix of the current cycle belong to this track.
  const feat = path.join(root, 'acceptance', 'AT', `${id}.feature`);
  if (!existsSync(feat)) die(`acceptance/AT/${id}.feature missing — the test lead writes the criterion first`);
  cause = readFileSync(feat, 'utf8').split('\n').filter((l) => l.startsWith('#'))
    .flatMap((l) => l.slice(1).split('|')).map((p) => p.match(/^\s*Cause\s*:\s*(.*)$/)?.[1]?.trim()).find(Boolean);
  if (!cause || /^open\b/i.test(cause)) {
    die(`${id}: Cause missing or open in the .feature header — the team determines it first ` +
      '(O-38: re-test on the recorded release digests, bisect)');
  }
  const byFix = cause.match(/^fix (Z\d+-P\d+)\b/);
  if (byFix) {
    die(`${id} was caused by the usability fix ${byFix[1]}: a class-B regression in the official rounds — ` +
      `fix it with /useavibe-fix ${byFix[1]} (O-38)`);
  }
  if (!/^(pre-existing|latent Z\d+-P\d+|defect-fix AT-M-\d{3})\b/.test(cause)) {
    die(`${id}: Cause must be pre-existing | latent Z<j>-P<nn> | defect-fix AT-M-<nnn> | fix Z<k>-P<nn> | open`);
  }
}
const rec = {
  id, cycle: k, kind: at ? 'at' : 'usability', base: git(root, 'rev-parse', 'HEAD'),
  started: new Date().toISOString(), attempt_cap: cfg.attempt_cap ?? 3, ...(cause ? { cause } : {}),
};
writeFileSync(activeFile, JSON.stringify(rec, null, 2) + '\n');
console.log(`activate: ${id} active (base ${rec.base.slice(0, 10)}, attempt cap ${rec.attempt_cap})`);
