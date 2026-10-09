#!/usr/bin/env node
// Per-attempt gate (Stop hook). Steps: integrity → unit (skip guard, vitest, bundle audits) → build → lint → knip →
// audit delta → Playwright (if configured) → requirements --changed. Appends one record per attempt to
// .planning/useavibe/Z<k>/attempts.jsonl; failure → exit 2 with the failing step (the turn continues).
// At the attempt cap the session must end with a "## Blocked" report (workflow plan step 7).
// USEAVIBE_GATE_STEPS='[["name","shell command"],…]' replaces the default steps (harness level-2 tests only).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  STATE_DIR, appendJsonl, cycleConfig, git, protectedReason, readActive, readJsonl, readStdinJson, repoRoot, sha256,
} from './lib.mjs';

const input = await readStdinJson();
const root = repoRoot(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const active = readActive(root);
if (!active) process.exit(0);
const k = Number(active.cycle);
const cdir = path.join(root, STATE_DIR, `Z${k}`);
const attemptsFile = path.join(cdir, 'attempts.jsonl');
const logDir = path.join(cdir, 'gate-logs');
mkdirSync(logDir, { recursive: true });
const cap = Number(active.attempt_cap ?? cycleConfig(root, k).attempt_cap ?? 3);
const session = input.session_id ?? 'unknown';
const mine = readJsonl(attemptsFile).filter((a) => a.id === active.id && a.session_id === session);
const runs = mine.filter((a) => a.result === 'pass' || a.result === 'fail');
const msg = String(input.last_assistant_message ?? '');

const OWN = ':(exclude).planning/useavibe';   // the gate's and hooks' own records do not count as a change
const fingerprint = () => {
  const untracked = git(root, 'ls-files', '--others', '--exclude-standard', '--', '.', OWN).split('\n').filter(Boolean);
  return sha256(git(root, 'rev-parse', 'HEAD') + git(root, 'diff', 'HEAD', '--', '.', OWN) +
    untracked.map((f) => `${f}\0${sha256(readFileSync(path.join(root, f)))}`).join('\n'));
};
const record = (extra) => appendJsonl(attemptsFile, {
  id: active.id, ts: new Date().toISOString(), session_id: session, head: git(root, 'rev-parse', 'HEAD'), ...extra,
});
const fail = (text) => { process.stderr.write(`UseAVibe gate: ${text}\n`); process.exit(2); };

if (/^#{1,3}\s*Blocked\b/m.test(msg)) { record({ result: 'blocked', attempt: runs.length }); process.exit(0); }
if (runs.length >= cap) {
  if (input.stop_hook_active) process.exit(0); // already told once; never loop past the cap
  fail(`attempt cap ${cap} reached for ${active.id}. Do not change code any more: end with a "## Blocked" report ` +
    '(what fails, why, which criterion or plan item the study team must refine).');
}
const fp = fingerprint();
const last = runs.at(-1);
if (last?.result === 'fail' && last.fingerprint === fp) {
  fail(`no change since the failed attempt ${last.attempt} (${last.failing_step}). Fix the cause, or end with "## Blocked".`);
}

// ---------------------------------------------------------------- steps
const vitestJson = path.join(logDir, 'vitest.json');
const pwJson = path.join(logDir, 'playwright.json');
const hasPlaywright = ['playwright.config.ts', 'playwright.config.mjs', 'playwright.config.js'].some((f) => existsSync(path.join(root, f)));
const DEFAULT = [
  ['integrity', '@integrity'],
  ['skip-guard', 'npm run test:check-skips'],
  ['unit', `npx vitest run --reporter=json --outputFile=${JSON.stringify(vitestJson)}`],
  ['bundle-audit', 'npm run audit:bundles'],
  ['build', 'npm run build'],
  ['lint', 'npm run lint'],
  ['knip', 'npm run knip'],
  ['audit-delta', '@audit-delta'],
  ...(cycleConfig(root, k).semgrep ? [['semgrep', '@semgrep']] : []),
  ...(hasPlaywright ? [['e2e', `PLAYWRIGHT_JSON_OUTPUT_NAME=${JSON.stringify(pwJson)} bash scripts/useavibe/e2e-container.sh --reporter=list,json`]] : []),
  ['requirements', `node scripts/requirements-check.mjs --changed ${active.base} --results ${JSON.stringify(vitestJson)}` +
    (hasPlaywright ? ` --e2e ${JSON.stringify(pwJson)}` : '')],
];
const steps = process.env.USEAVIBE_GATE_STEPS ? JSON.parse(process.env.USEAVIBE_GATE_STEPS) : DEFAULT;

async function integrity() {
  const problems = [];
  const frozen = JSON.parse(readFileSync(path.join(cdir, 'frozen.json'), 'utf8'));   // written by the harness at freeze
  for (const [rel, want] of Object.entries(frozen.files ?? {})) {
    const p = path.join(root, rel);
    if (!existsSync(p)) problems.push(`${rel} missing`);
    else if (sha256(readFileSync(p)) !== want) problems.push(`${rel} changed since freeze`);
  }
  const changed = new Set([
    ...git(root, 'diff', '--name-only', active.base).split('\n'),
    ...git(root, 'ls-files', '--others', '--exclude-standard').split('\n'),
  ].filter(Boolean));
  for (const rel of changed) {
    if (/^\.planning\/useavibe\/Z\d+\/(attempts\.jsonl|gate-logs\/)/.test(rel)) continue; // the gate's own records
    const why = await protectedReason(rel, root);
    if (why) problems.push(`${rel}: ${why}`);
  }
  return problems;
}

function auditDelta() {
  const base = JSON.parse(readFileSync(path.join(cdir, 'audit-baseline.json'), 'utf8')); // written at cycle open
  const r = spawnSync('npm', ['audit', '--json'], { cwd: root, encoding: 'utf8' });
  let doc;
  try { doc = JSON.parse(r.stdout); } catch { return [`npm audit produced no JSON (offline?): ${(r.stderr || '').slice(-200)}`]; }
  const now = new Set();
  for (const v of Object.values(doc.vulnerabilities ?? {})) {
    for (const via of v.via ?? []) {
      if (typeof via === 'object' && ['high', 'critical'].includes(via.severity)) now.add(String(via.source ?? via.url));
    }
  }
  const known = new Set((base.advisories ?? []).map(String));
  return [...now].filter((a) => !known.has(a)).map((a) => `new high/critical advisory ${a}`);
}

// Static security (decision C-12): pinned Semgrep on the files changed in this session, delta against the cycle
// baseline (fingerprint = rule | file | hash of the matched text, as in the harness's semgrep_fingerprints).
function semgrepDelta() {
  const cfg = cycleConfig(root, k).semgrep;
  const scan = new RegExp(`^(${cfg.scan.join('|')})/.*\\.(ts|tsx|js|mjs)$`);
  const files = [...new Set([
    ...git(root, 'diff', '--name-only', '--diff-filter=d', active.base).split('\n'),
    ...git(root, 'ls-files', '--others', '--exclude-standard').split('\n'),
  ])].filter((f) => scan.test(f));
  if (!files.length) return [];
  const configs = Object.values(cfg.packs).flatMap((p) => ['--config', p.file]);
  for (const p of Object.values(cfg.packs)) {
    if (!existsSync(path.join(root, p.file)) || sha256(readFileSync(path.join(root, p.file))) !== p.sha256) {
      return [`Semgrep rule pack ${p.file} missing or changed since cycle open`];
    }
  }
  const r = spawnSync('uvx', ['--quiet', `semgrep==${cfg.version}`, 'scan', '--metrics=off', '--disable-version-check',
    '--json', '-q', ...configs, ...files], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let doc;
  try { doc = JSON.parse(r.stdout); } catch { return [`semgrep failed: ${(r.stderr || '').slice(-300)}`]; }
  const base = new Set(JSON.parse(readFileSync(path.join(cdir, 'semgrep-baseline.json'), 'utf8')).findings);
  return (doc.results ?? [])
    .map((x) => ({ x, fp: `${x.check_id}|${x.path}|${sha256(String(x.extra?.lines ?? '').split(/\s+/).filter(Boolean).join(' ')).slice(0, 16)}` }))
    .filter(({ fp }) => !base.has(fp))
    .map(({ x }) => `${x.path}:${x.start?.line}: ${x.check_id.split('.').at(-1)} — ${String(x.extra?.message ?? '').split('\n')[0]}`);
}

// Red check (test first, workflow plan §5.3 step 2): while only this problem's own acceptance tests have changed,
// the e2e run must FAIL. It is recorded as "red"/"green-before-fix" and does not count as an attempt.
const changedNow = [...new Set([
  ...git(root, 'diff', '--name-only', active.base, '--', '.', OWN).split('\n'),
  ...git(root, 'ls-files', '--others', '--exclude-standard', '--', '.', OWN).split('\n'),
])].filter(Boolean);
const ownTests = new RegExp(`^tests/acceptance/Z${k}/${active.id}\\.`);
if (active.kind === 'usability' && changedNow.length && changedNow.every((f) => ownTests.test(f))) {
  const specs = changedNow.filter((f) => f.endsWith('.spec.ts')).join(' ');
  const units = changedNow.filter((f) => f.endsWith('.test.ts')).join(' ');
  const redCmd = process.env.USEAVIBE_RED_CMD   // harness level-2 tests only
    ?? (specs ? `PLAYWRIGHT_JSON_OUTPUT_NAME=${JSON.stringify(pwJson)} bash scripts/useavibe/e2e-container.sh ${specs}`
      : `npx vitest run ${units}`);
  const r = spawnSync('bash', ['-c', redCmd], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-25).join('\n');
  writeFileSync(path.join(logDir, `${active.id}-red.log`), out);
  if (r.status === 0) {
    record({ result: 'green-before-fix', attempt: runs.length, fingerprint: fp });
    fail(`the new acceptance tests PASS before any fix — stop and report (problem fixed already or misdescribed):\n${out}`);
  }
  record({ result: 'red', attempt: runs.length, fingerprint: fp });
  fail(`red check confirmed — the new acceptance tests fail before the fix (not counted as an attempt):\n${out}\n` +
    'Quote this failing output in your report, then implement the fix.');
}

const attempt = runs.length + 1;
const durations = {};
let failing = null;
let detail = '';
for (const [name, cmd] of steps) {
  const t0 = Date.now();
  let problems = [];
  if (cmd === '@integrity') problems = await integrity();
  else if (cmd === '@audit-delta') problems = auditDelta();
  else if (cmd === '@semgrep') problems = semgrepDelta();
  else {
    const r = spawnSync('bash', ['-c', cmd], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    writeFileSync(path.join(logDir, `${active.id}-a${attempt}-${name}.log`), `$ ${cmd}\n${r.stdout ?? ''}${r.stderr ?? ''}`);
    if (r.status !== 0) problems = [`exit ${r.status}: ${`${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-15).join('\n')}`];
  }
  durations[name] = Math.round((Date.now() - t0) / 100) / 10;
  if (problems.length) { failing = name; detail = problems.join('\n'); break; }
}
record({ attempt, result: failing ? 'fail' : 'pass', failing_step: failing, durations, fingerprint: fp });
if (failing) {
  fail(`attempt ${attempt}/${cap} failed at step "${failing}":\n${detail}\n` +
    `Logs: ${path.relative(root, logDir)}/${active.id}-a${attempt}-*.log. Fix the root cause; never weaken a test.`);
}
console.log(`UseAVibe gate: attempt ${attempt} passed (${Object.entries(durations).map(([n, s]) => `${n} ${s}s`).join(', ')})`);
