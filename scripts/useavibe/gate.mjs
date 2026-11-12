#!/usr/bin/env node
// Per-attempt gate (Stop hook). Steps: integrity → unit (skip guard, vitest, bundle audits) → build → lint → knip →
// audit delta → Playwright (if configured) → requirements --changed. Appends one record per attempt to
// .planning/useavibe/Z<k>/attempts.jsonl; failure → exit 2 with the failing step (the turn continues); a pass also exits 2
// and continues the turn with review and staging; an unchanged tree after a pass is a re-check, not an attempt (O-26 a).
// At the attempt cap the session must end with a "## Blocked" report (workflow plan step 7).
// USEAVIBE_GATE_STEPS='[["name","shell command"],…]' replaces the default steps (harness level-2 tests only).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
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
// Content of every path that differs from HEAD, independent of the index: staging (`git add`) is not a change (O-42 f).
const fingerprint = () => {
  const changed = [...new Set([
    ...git(root, 'diff', 'HEAD', '--name-only', '--', '.', OWN).split('\n'),
    ...git(root, 'ls-files', '--others', '--exclude-standard', '--', '.', OWN).split('\n'),
  ])].filter(Boolean).sort();
  return sha256(git(root, 'rev-parse', 'HEAD') + changed.map((f) => {
    const p = path.join(root, f);
    return `${f}\0${existsSync(p) ? sha256(readFileSync(p)) : 'deleted'}`;
  }).join('\n'));
};
const record = (extra) => appendJsonl(attemptsFile, {
  id: active.id, ts: new Date().toISOString(), session_id: session, head: git(root, 'rev-parse', 'HEAD'), ...extra,
});
const fail = (text) => { process.stderr.write(`UseAVibe gate: ${text}\n`); process.exit(2); };

// After a passing attempt the turn continues with review and staging (steps 5–6); the session is done when COMMIT_MSG
// exists (O-25 a). This chains a headless session through to the commit hand-over without a resume (O-26 a).
const NEXT = 'Not done yet: run the ac-reviewer and log its verdict (step 5), then stage the fix and write ' +
  '.planning/useavibe/COMMIT_MSG (step 6) and end the turn. The next gate run on an unchanged tree is a re-check ' +
  'and does not count as an attempt; changes after review findings do.';
const commitMsgReady = () => existsSync(path.join(root, STATE_DIR, 'COMMIT_MSG'));

if (/^#{1,3}\s*Blocked\b/m.test(msg)) { record({ result: 'blocked', attempt: runs.length }); process.exit(0); }
const fp = fingerprint();
// Re-check (O-26 a): the tree is unchanged since this problem's last gate run, in any session, and that run passed.
// The steps are not re-run and nothing is counted — so a continuation for review/commit does not inflate PL09's
// auxiliary count, and a pass at the cap does not turn into a cap refusal.
const ofProblem = readJsonl(attemptsFile).filter((a) => a.id === active.id);
const lastRun = ofProblem.filter((a) => a.result === 'pass' || a.result === 'fail').at(-1);
if (lastRun?.result === 'pass' && lastRun.fingerprint === fp) {
  const remindedBefore = ofProblem.at(-1)?.result === 'recheck';
  record({ result: 'recheck', attempt: lastRun.attempt, fingerprint: fp });
  if (commitMsgReady() || remindedBefore) {
    console.log(`UseAVibe gate: unchanged since the passed attempt ${lastRun.attempt} — re-check, not counted`);
    process.exit(0);
  }
  fail(`unchanged since the passed attempt ${lastRun.attempt} (re-check, not counted). ${NEXT}`);
}
if (runs.length >= cap) {
  if (input.stop_hook_active) process.exit(0); // already told once; never loop past the cap
  fail(`attempt cap ${cap} reached for ${active.id}. Do not change code any more: end with a "## Blocked" report ` +
    '(what fails, why, which criterion or plan item the study team must refine).');
}
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

// High/critical advisory ids of a lockfile (npm audit against the registry, no install), or an error string.
function advisories(cwd) {
  const r = spawnSync('npm', ['audit', '--json', '--package-lock-only'], { cwd, encoding: 'utf8' });
  let doc;
  try { doc = JSON.parse(r.stdout); } catch { return `npm audit produced no JSON (offline?): ${(r.stderr || '').slice(-200)}`; }
  const ids = new Set();
  for (const v of Object.values(doc.vulnerabilities ?? {})) {
    for (const via of v.via ?? []) {
      if (typeof via === 'object' && ['high', 'critical'].includes(via.severity)) ids.add(String(via.source ?? via.url));
    }
  }
  return ids;
}

// Delta against the base lockfile audited now (decision O-33 a): only advisories the session's dependency change
// brings in fail; advisories published after the cycle baseline on unchanged dependencies are logged as warnings.
function auditDelta() {
  const now = advisories(root);
  if (typeof now === 'string') return [now];
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'useavibe-audit-'));
  let atBase;
  try {
    for (const f of ['package.json', 'package-lock.json']) {
      writeFileSync(path.join(tmp, f), git(root, 'show', `${active.base}:${f}`));
    }
    atBase = advisories(tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (typeof atBase === 'string') return [atBase];
  const known = new Set((JSON.parse(readFileSync(path.join(cdir, 'audit-baseline.json'), 'utf8')).advisories ?? []).map(String));
  const late = [...now].filter((a) => atBase.has(a) && !known.has(a));
  writeFileSync(path.join(logDir, `${active.id}-a${attempt}-audit-delta.log`), late.length
    ? `WARNING: published after the cycle baseline, dependencies unchanged (owner/release): ${late.join(', ')}\n`
    : 'no advisories beyond the cycle baseline\n');
  return [...now].filter((a) => !atBase.has(a)).map((a) => `new high/critical advisory ${a} (introduced by this change)`);
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
const ownTests = active.kind === 'at'   // AT defects: red evidence too (O-34)
  ? new RegExp(`^tests/acceptance-at/${active.id}\\.`)
  : new RegExp(`^tests/acceptance/Z${k}/${active.id}\\.`);

// Failed tests of the given files in the red run's JSON report (Playwright or Vitest), or null if there is none.
// Red needs at least one: a non-zero exit alone may be a failed image build or an unhealthy container (O-41 a).
function failedOwnTests(report, files) {
  let doc;
  try { doc = JSON.parse(readFileSync(report, 'utf8')); } catch { return null; }
  const own = (file) => files.some((f) => f.endsWith(file) || String(file).endsWith(f));
  if (Array.isArray(doc.testResults)) {   // Vitest
    return doc.testResults.filter((t) => own(t.name))
      .flatMap((t) => (t.assertionResults ?? []).filter((a) => a.status === 'failed').map((a) => a.fullName ?? a.title));
  }
  const failed = [];
  const walk = (s, file) => {
    for (const c of s.suites ?? []) walk(c, c.file ?? file);
    for (const sp of s.specs ?? []) {
      if (own(sp.file ?? file) && (sp.tests ?? []).some((t) => t.status === 'unexpected')) failed.push(sp.title);
    }
  };
  for (const s of doc.suites ?? []) walk(s, s.file);
  return failed;
}

if (changedNow.length && changedNow.every((f) => ownTests.test(f))) {
  const specList = changedNow.filter((f) => f.endsWith('.spec.ts'));
  const unitList = changedNow.filter((f) => /\.test\.tsx?$/.test(f));   // Vitest includes .test.ts and .test.tsx
  const priorErrors = mine.filter((a) => a.result === 'red-error' && a.fingerprint === fp).length;
  if (priorErrors >= 2) {
    if (input.stop_hook_active) process.exit(0);   // told already; never loop
    fail('red check could not run twice on this unchanged tree — end with "## Blocked" (red check not possible) ' +
      `and quote ${path.relative(root, logDir)}/${active.id}-red.log.`);
  }
  const redJson = path.join(logDir, `${active.id}-red.json`);   // own file: never a stale report of an earlier run
  rmSync(redJson, { force: true });
  const redCmd = process.env.USEAVIBE_RED_CMD   // harness level-2 tests only
    ?? (specList.length
      ? `PLAYWRIGHT_JSON_OUTPUT_NAME=${JSON.stringify(redJson)} bash scripts/useavibe/e2e-container.sh ${specList.join(' ')} --reporter=list,json`
      : `npx vitest run ${unitList.join(' ')} --reporter=default --reporter=json --outputFile.json=${JSON.stringify(redJson)}`);
  const r = spawnSync('bash', ['-c', redCmd], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, USEAVIBE_RED_JSON: redJson },
  });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-25).join('\n');
  writeFileSync(path.join(logDir, `${active.id}-red.log`), out);
  if (r.status === 0) {
    record({ result: 'green-before-fix', attempt: runs.length, fingerprint: fp });
    fail(`the new acceptance tests PASS before any fix — stop and report (problem fixed already or misdescribed):\n${out}`);
  }
  const failedTests = failedOwnTests(redJson, [...specList, ...unitList]);
  if (!failedTests?.length) {
    record({ result: 'red-error', attempt: runs.length, fingerprint: fp });
    fail(`red check could not run — ${failedTests ? 'no test of the new files failed or ran' : 'no test report'} ` +
      `(exit ${r.status}; infrastructure such as the image build or container, or the test files do not load). ` +
      'Not counted as an attempt and not red evidence.\n' + `${out}\n` +
      (priorErrors ? 'Second time on the unchanged tree: end with "## Blocked" (red check not possible) and quote this output.'
        : 'If the test files are at fault, fix them; otherwise end the turn once more to retry.'));
  }
  record({ result: 'red', attempt: runs.length, fingerprint: fp, failed_tests: failedTests });
  fail(`red check confirmed — ${failedTests.length} new test(s) fail before the fix (not counted as an attempt): ` +
    `${failedTests.join('; ')}\n${out}\nQuote this failing output in your report, then implement the fix.`);
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
fail(`attempt ${attempt} passed (${Object.entries(durations).map(([n, s]) => `${n} ${s}s`).join(', ')}). ${NEXT}`);
