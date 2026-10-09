#!/usr/bin/env node
/**
 * requirements-check — UI requirement + round-item compliance harness (handoff package, v1.21).
 *
 *   node scripts/requirements-check.mjs                        # regression: registry vs. the unit-test suite
 *   node scripts/requirements-check.mjs --round handoff/rounds/v1.21    # + the round's items + browser records
 *   node scripts/requirements-check.mjs --browser [--area TRAJ] [--changed v1.20.2] [--round …] [--release]
 *                                                              # print the browser procedures to execute
 *   node scripts/requirements-check.mjs --changed v1.20.2      # only requirements whose evidence/tests touch files
 *                                                              # changed since <git-ref> (plus round items)
 *   node scripts/requirements-check.mjs --results /tmp/vitest.json      # reuse a vitest JSON report (no test run)
 *   node scripts/requirements-check.mjs --no-run               # schema + static mapping check, no vitest
 *   node scripts/requirements-check.mjs --sweep handoff/sweeps/2026-10-20/verification.yaml   # extra browser records
 *   node scripts/requirements-check.mjs --report handoff/rounds/v1.21/report-local.md         # also write markdown
 *   node scripts/requirements-check.mjs --strict               # UNVERIFIED in scope (round items / --area / --changed) fails
 *
 * Inputs
 *   handoff/requirements/*.yaml      the registry (one file per UI area; see handoff/HANDOFF.md §4)
 *   <round>/items.yaml               the round's tester items (decision, acceptance, tests, browser)
 *   <round>/verification*.yaml       browser results recorded by the verify/release agents (PASS/FAIL/BLOCKED per id)
 *   --sweep <file>                   additional verification files (full baseline sweeps), repeatable
 *
 * Verdict per requirement / item
 *   unit     PASS | FAIL | MISSING (mapped test/title not found or only skipped) | NONE (no mapping)
 *            | SKIPPED (--no-run, statically resolved) | PLANNED (--no-run, test file does not exist yet)
 *   browser  PASS | FAIL | BLOCKED | NONE (no record)
 *   overall  FAIL        any unit FAIL/MISSING or browser FAIL on an implemented requirement / round item
 *            KNOWN_GAP   browser FAIL on a partial/not_implemented requirement (backlog, not a regression)
 *            PASS        requirement: unit or browser passed; round item: browser PASS (a unit test alone is not "verified")
 *            UNVERIFIED  nothing proved it
 *            N/A         round items that are not fix/by_design, retired requirements, `when: release` entries without --release
 * Exit 1 on schema errors or any FAIL (2 on bad flags); --strict also on UNVERIFIED within the scope.
 *
 * Run under Node 22 (better-sqlite3 ABI): . scripts/useavibe/node22.sh
 * Side effect of any vitest run: tests/issueApi.test.ts writes two throw-away files into feedback/ (gitignored).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REGISTRY_DIR = path.join(ROOT, 'handoff', 'requirements');
const STATUSES = new Set(['implemented', 'partial', 'not_implemented', 'retired']);
const DECISIONS = new Set(['fix', 'by_design', 'design', 'needs_decision', 'deferred', 'confirmed_closed']);
const VERIFIABLE = new Set(['fix', 'by_design']);
const RESULTS = new Set(['PASS', 'FAIL', 'BLOCKED']);

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const VALUED = new Set(['--round', '--area', '--id', '--results', '--report', '--changed', '--sweep']);
const KNOWN = new Set([...VALUED, '--strict', '--browser', '--no-run', '--release', '--help', '-h']);
if (argv.includes('--help') || argv.includes('-h')) {
  const src = readFileSync(new URL(import.meta.url), 'utf8');
  console.log(src.slice(src.indexOf('/**') + 3, src.indexOf('*/')).replace(/^ \* ?/gm, ''));
  process.exit(0);
}
const opts = { sweep: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!KNOWN.has(a)) { console.error(`unknown flag ${a} — see --help`); process.exit(2); }
  if (VALUED.has(a)) {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('-')) { console.error(`${a} needs a value — see --help`); process.exit(2); }
    if (a === '--sweep') opts.sweep.push(v); else opts[a.slice(2)] = v;
    i++;
  } else opts[a.slice(2)] = true;
}
const resolveUser = (p) => path.resolve(process.cwd(), p);
const roundDir = opts.round ? resolveUser(opts.round) : null;
const reportFile = opts.report ? resolveUser(opts.report) : null;

// ---------------------------------------------------------------- load
const errors = [];
const warnings = [];
const rel = (p) => path.relative(ROOT, p);
const loadYaml = (file) => {
  try { return yaml.load(readFileSync(file, 'utf8')); }
  catch (e) { errors.push(`${rel(file)}: ${e.message.split('\n')[0]}`); return null; }
};

function loadRegistry() {
  if (!existsSync(REGISTRY_DIR)) { errors.push(`registry dir missing: ${rel(REGISTRY_DIR)}`); return []; }
  const reqs = [];
  for (const f of readdirSync(REGISTRY_DIR).filter((f) => f.endsWith('.yaml')).sort()) {
    const doc = loadYaml(path.join(REGISTRY_DIR, f));
    if (!doc) continue;
    for (const r of doc.requirements ?? []) reqs.push({ ...r, area: r.area ?? doc.area, _file: f });
  }
  return reqs;
}

function loadVerification(file, results, source) {
  const doc = loadYaml(file);
  for (const v of doc?.results ?? []) {
    if (!v.id) { errors.push(`${rel(file)}: record without id`); continue; }
    if (!RESULTS.has(v.result)) errors.push(`${rel(file)}: ${v.id}: result must be PASS|FAIL|BLOCKED (got ${v.result})`);
    if (results.has(v.id) && results.get(v.id)._source === source) errors.push(`${rel(file)}: ${v.id}: duplicate record`);
    results.set(v.id, { ...v, _source: source, _file: rel(file) });   // later files (round) override earlier (sweep)
  }
}

function loadRound() {
  const results = new Map();
  for (const s of opts.sweep) {
    const f = resolveUser(s);
    if (!existsSync(f)) { errors.push(`--sweep file missing: ${s}`); continue; }
    loadVerification(f, results, 'sweep');
  }
  if (!roundDir) return { items: [], results, round: null };
  const itemsFile = path.join(roundDir, 'items.yaml');
  const itemsDoc = existsSync(itemsFile) ? loadYaml(itemsFile) : null;
  if (!itemsDoc) errors.push(`round items missing: ${rel(itemsFile)}`);
  if (existsSync(roundDir)) {
    for (const f of readdirSync(roundDir).filter((f) => /^verification.*\.yaml$/.test(f)).sort()) {
      loadVerification(path.join(roundDir, f), results, 'round');
    }
  }
  return { items: (itemsDoc?.items ?? []).map((i) => ({ ...i, _round: true })), results, round: itemsDoc?.round ?? path.basename(roundDir) };
}

function validate(entries) {
  const seen = new Set();
  for (const r of entries) {
    const where = r._round ? `round item ${r.id}` : `${r._file} ${r.id}`;
    if (!r.id) errors.push(`${where}: missing id`);
    if (seen.has(r.id)) errors.push(`${where}: duplicate id`);
    seen.add(r.id);
    if (r._round) {
      if (!DECISIONS.has(r.decision)) errors.push(`${where}: decision must be ${[...DECISIONS].join('|')} (got ${r.decision})`);
      if (r.decision === 'fix' && !(Array.isArray(r.acceptance) && r.acceptance.length)) errors.push(`${where}: fix item needs acceptance[]`);
      if (VERIFIABLE.has(r.decision) && !r.browser && !(r.tests ?? []).length) errors.push(`${where}: ${r.decision} item needs a browser procedure or tests`);
    } else {
      if (!STATUSES.has(r.status)) errors.push(`${where}: status must be ${[...STATUSES].join('|')}`);
      if (!r.statement) errors.push(`${where}: missing statement`);
    }
    for (const t of r.tests ?? []) {
      if (!t.file) { errors.push(`${where}: test mapping without file`); continue; }
      if (!existsSync(path.join(ROOT, t.file))) {
        if (opts['no-run'] && r._round) warnings.push(`${where}: planned test file ${t.file} does not exist yet`);
        else errors.push(`${where}: test file not found: ${t.file}`);
      }
    }
    if (r.browser && (!r.browser.route || !Array.isArray(r.browser.steps) || !r.browser.expect)) {
      errors.push(`${where}: browser needs route, steps[], expect`);
    }
  }
}

// ---------------------------------------------------------------- vitest
let tmpReport = null;
function runVitest() {
  const out = opts.results ? resolveUser(opts.results) : (tmpReport = path.join(tmpdir(), `emd-vitest-${process.pid}.json`));
  if (!opts['no-run'] && !(opts.results && existsSync(out))) {   // run unless --no-run or an existing --results file is given
    process.stderr.write('[requirements-check] running vitest (full suite, json reporter)…\n');
    const r = spawnSync('npx', ['vitest', 'run', '--reporter=json', '--outputFile', out], { cwd: ROOT, encoding: 'utf8' });
    if (!existsSync(out)) {
      const hint = /ERR_DLOPEN_FAILED|NODE_MODULE_VERSION/.test(r.stderr + r.stdout)
        ? ' — better-sqlite3 ABI mismatch: . scripts/useavibe/node22.sh' : '';
      errors.push(`vitest produced no JSON report${hint}\n${(r.stderr || r.stdout).slice(-800)}`);
      return null;
    }
  }
  return existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
}

const RANK = { FAIL: 3, MISSING: 2, PLANNED: 1, PASS: 0, SKIPPED: 0 };
const titleMatches = (title, name) => /^\[?[A-Z]+-?\d+[a-z]?\]?$/.test(name)
  ? new RegExp(`(^|[^A-Za-z0-9])${name.replace(/[[\]]/g, '')}(?![A-Za-z0-9])`).test(title)   // bare item id: whole token
  : title.toLowerCase().includes(name.toLowerCase());

function unitVerdict(entry, report) {
  const tests = entry.tests ?? [];
  if (!tests.length) return { verdict: 'NONE', detail: '' };
  let worst = report ? 'PASS' : 'SKIPPED';   // --no-run can only resolve mappings, never pass them
  const details = [];
  const bump = (v, d) => { if (RANK[v] > RANK[worst]) worst = v; if (d) details.push(d); };
  for (const t of tests) {
    const abs = path.join(ROOT, t.file);
    if (!report) {                                                   // --no-run: static check against the test source
      if (!existsSync(abs)) { bump('PLANNED', `${t.file}: not written yet`); continue; }
      if (t.name && !titleMatches(readFileSync(abs, 'utf8'), t.name)) bump('MISSING', `${t.file}: no test title contains "${t.name}"`);
      else bump('SKIPPED');
      continue;
    }
    const file = report.testResults.find((f) => f.name.endsWith('/' + t.file) || f.name === t.file);
    if (!file) { bump('MISSING', `${t.file}: not in run`); continue; }
    if (file.status === 'failed' && !file.assertionResults.length) {   // file failed to load/compile
      bump('FAIL', `${t.file}: file failed to run — ${(file.message || '').split('\n')[0]}`); continue;
    }
    const cases = t.name ? file.assertionResults.filter((a) => titleMatches(a.fullName, t.name)) : file.assertionResults;
    if (!cases.length) { bump('MISSING', `${t.file}: no test title contains "${t.name}"`); continue; }
    const failed = cases.filter((a) => a.status === 'failed');
    const passed = cases.filter((a) => a.status === 'passed');   // vitest statuses: passed|failed|skipped|todo|pending
    if (failed.length) bump('FAIL', `${t.file}: ${failed.map((a) => a.fullName).join('; ')}`);
    else if (!passed.length) bump('MISSING', `${t.file}: only skipped/todo tests match "${t.name ?? '*'}"`);
    else bump('PASS', `${t.file}: ${passed.length} passed`);
  }
  return { verdict: worst, detail: details.join(' | ') };
}

function overall(e, unit, browser) {
  if (e._round ? !VERIFIABLE.has(e.decision) : e.status === 'retired') return 'N/A';
  if (!e._round && e.when === 'release' && !opts.release) return 'N/A';
  if (unit === 'FAIL' || unit === 'MISSING') return 'FAIL';
  if (browser === 'FAIL') return (!e._round && e.status !== 'implemented') ? 'KNOWN_GAP' : 'FAIL';
  if (e._round) return browser === 'PASS' ? 'PASS' : 'UNVERIFIED';   // HANDOFF §6: a round item needs a browser record
  if (unit === 'PASS' || browser === 'PASS') return 'PASS';
  return 'UNVERIFIED';
}

// ---------------------------------------------------------------- selection
const evidencePaths = (e) => [...(e.evidence ?? []), ...(e.tests ?? []).map((t) => t.file)]
  .map((s) => String(s).match(/^[\w./@-]+/)?.[0]).filter(Boolean);

function changedFiles(ref) {
  try {
    return new Set(execFileSync('git', ['diff', '--name-only', `${ref}..HEAD`, '--', 'src', 'server', 'shared', 'public', 'index.html'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean));
  } catch (e) { errors.push(`--changed ${ref}: ${e.message.split('\n')[0]}`); return new Set(); }
}

// ---------------------------------------------------------------- main
const registry = loadRegistry();
const round = loadRound();
let entries = [...registry, ...round.items];
validate(entries);
for (const id of round.results.keys()) if (!entries.some((e) => e.id === id)) errors.push(`verification record ${id} (${round.results.get(id)._file}) matches no requirement or round item`);
if (opts.area && !registry.some((e) => e.area === opts.area)) errors.push(`--area ${opts.area}: unknown area (${[...new Set(registry.map((e) => e.area))].join(' ')})`);
if (opts.id && !entries.some((e) => e.id === opts.id)) errors.push(`--id ${opts.id}: no such requirement or round item`);

let changed = null;
if (opts.changed) {
  changed = changedFiles(opts.changed);
  const translationsOnly = [...changed].every((f) => f === 'src/i18n/translations.ts');
  entries = entries.filter((e) => e._round || evidencePaths(e).some((p) => changed.has(p) && (p !== 'src/i18n/translations.ts' || translationsOnly)));
}
if (opts.area) entries = entries.filter((e) => e.area === opts.area || e._round);
if (opts.id) entries = entries.filter((e) => e.id === opts.id);
const inScope = (e) => e._round || Boolean(opts.area || opts.id || opts.changed);   // what --strict and the scope line count
const skipBrowser = (e) => (e._round ? !VERIFIABLE.has(e.decision) : e.status === 'retired') || (!e._round && e.when === 'release' && !opts.release);

if (opts.browser) {
  const lines = [];
  if (changed) lines.push(`<!-- changed since ${opts.changed}: ${[...changed].join(', ') || 'nothing'} -->`, '');
  for (const e of entries.filter((e) => e.browser && !skipBrowser(e))) {
    lines.push(`### ${e.id} — ${e.title ?? ''}`.trim());
    if (!e._round) lines.push(`status: ${e.status}${e.when ? ` · when: ${e.when}` : ''}`);
    if (e.statement) lines.push(e.statement);
    for (const a of e.acceptance ?? []) lines.push(`- acceptance: ${a}`);
    lines.push(`Route: \`${e.browser.route}\``);
    e.browser.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push(`**Expect:** ${e.browser.expect}`, '');
  }
  console.log(lines.join('\n'));
  if (errors.length) { console.error('\nSchema errors:\n- ' + errors.join('\n- ')); process.exitCode = 1; }
} else {
  const report = runVitest();   // schema errors are reported but do not suppress the unit layer
  const rows = entries.map((e) => {
    const unit = unitVerdict(e, report);
    const b = round.results.get(e.id);
    const browser = b ? b.result : 'NONE';
    return { id: e.id, kind: e._round ? 'round' : e.area, scope: inScope(e), title: e.title ?? e.statement ?? '', status: e.status ?? e.decision ?? '',
      unit: unit.verdict, unitDetail: unit.detail, browser, browserDetail: b ? `${b.evidence ?? ''}${b._source === 'sweep' ? ' [sweep]' : ''}` : '', overall: overall(e, unit.verdict, browser) };
  });
  const count = (v, pred = () => true) => rows.filter((r) => r.overall === v && pred(r)).length;
  const scoped = (r) => r.scope;
  const summary = `requirements ${rows.filter((r) => r.kind !== 'round').length} · PASS ${count('PASS')} · FAIL ${count('FAIL')} · KNOWN_GAP ${count('KNOWN_GAP')} · UNVERIFIED ${count('UNVERIFIED')} · N/A ${count('N/A')}` +
    (report ? ` · vitest ${report.numPassedTests}/${report.numTotalTests} passed` : ' · (no test run)');
  const scopeLabel = round.round ? `round ${round.round}` : opts.changed ? `changed since ${opts.changed}` : opts.area ? `area ${opts.area}` : null;
  const scopeLine = scopeLabel ? `${scopeLabel}: items ${rows.filter(scoped).length} · PASS ${count('PASS', scoped)} · FAIL ${count('FAIL', scoped)} · KNOWN_GAP ${count('KNOWN_GAP', scoped)} · UNVERIFIED ${count('UNVERIFIED', scoped)} · N/A ${count('N/A', scoped)}` : null;

  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log(pad('ID', 18), pad('AREA', 8), pad('UNIT', 8), pad('BROWSER', 8), pad('OVERALL', 10), 'TITLE');
  for (const r of rows) console.log(pad(r.id, 18), pad(r.kind, 8), pad(r.unit, 8), pad(r.browser, 8), pad(r.overall, 10), r.title.slice(0, 70));
  for (const r of rows.filter((r) => r.overall === 'FAIL' || r.overall === 'KNOWN_GAP')) console.log(`  ${r.overall === 'FAIL' ? '✗' : '○'} ${r.id}: ${r.unitDetail || r.browserDetail}`);
  console.log('\n' + summary);
  if (scopeLine) console.log(scopeLine);
  if (warnings.length) console.error('\nWarnings:\n- ' + warnings.join('\n- '));
  if (errors.length) console.error('\nSchema errors:\n- ' + errors.join('\n- '));

  if (reportFile) {
    const md = [
      `# Requirements check — ${round.round ?? scopeLabel ?? 'registry'} — ${new Date().toISOString().slice(0, 10)}`, '', summary, scopeLine ?? '', '',
      '| ID | Area | Status | Unit | Browser | Overall | Title |', '|---|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.id} | ${r.kind} | ${r.status} | ${r.unit} | ${r.browser} | **${r.overall}** | ${r.title.replace(/\|/g, '\\|')} |`),
      '', '## Details', '',
      ...rows.filter((r) => r.unitDetail || r.browserDetail).map((r) => `- **${r.id}** — unit: ${r.unitDetail || '—'}; browser: ${r.browserDetail || '—'}`),
      ...(warnings.length ? ['', '## Warnings', '', ...warnings.map((w) => `- ${w}`)] : []),
      ...(errors.length ? ['', '## Schema errors', '', ...errors.map((e) => `- ${e}`)] : []), '',
    ];
    mkdirSync(path.dirname(reportFile), { recursive: true });
    writeFileSync(reportFile, md.join('\n'));
    console.log(`report: ${rel(reportFile)}`);
  }
  if (tmpReport && existsSync(tmpReport)) unlinkSync(tmpReport);
  const failed = errors.length || count('FAIL') || (opts.strict && count('UNVERIFIED', scoped));
  process.exitCode = failed ? 1 : 0;
}
