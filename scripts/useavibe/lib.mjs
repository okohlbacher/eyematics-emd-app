// Shared helpers of the UseAVibe hooks and gate (installed by the UseAVibe harness; do not edit in the app repo).
// Node builtins only, so the hooks also run under a non-22 Node; js-yaml is loaded lazily from the app's node_modules.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const STATE_DIR = '.planning/useavibe';

export function repoRoot(cwd = process.cwd()) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return process.env.CLAUDE_PROJECT_DIR || cwd;
  }
}

export async function readStdinJson() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try { return raw.trim() ? JSON.parse(raw) : {}; } catch { return {}; }
}

export const readJson = (p, fallback = null) => {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; }
};

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** Active fix session written by /useavibe-fix: {id, cycle, kind: "usability"|"at", base, started, attempt_cap}. */
export const readActive = (root) => readJson(path.join(root, STATE_DIR, 'ACTIVE'));

/** Current cycle config written at cycle open (public-safe): {cycle, version, model, attempt_cap, final, ...}. */
export function currentCycle(root) {
  const active = readActive(root);
  if (active?.cycle !== undefined) return Number(active.cycle);
  const cur = readJson(path.join(root, STATE_DIR, 'CURRENT.json'));
  return cur?.cycle !== undefined ? Number(cur.cycle) : null;
}

export const cycleConfig = (root, k) => readJson(path.join(root, STATE_DIR, `Z${k}`, 'cycle.json'), {});

/** Test files mapped by the requirements registry (handoff/requirements/*.yaml tests[].file), cached by mtime. */
export async function registryTestFiles(root) {
  const dir = path.join(root, 'handoff', 'requirements');
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort();
  const key = sha256(files.map((f) => `${f}:${statSync(path.join(dir, f)).mtimeMs}`).join('|'));
  const cacheFile = path.join(root, STATE_DIR, '.cache', 'registry-tests.json');
  const cached = readJson(cacheFile);
  if (cached?.key === key) return cached.files;
  let yaml;
  try {
    yaml = (await import(path.join(root, 'node_modules', 'js-yaml', 'dist', 'js-yaml.mjs'))).default;
  } catch {
    return null; // unknown → callers fail closed
  }
  const out = new Set();
  for (const f of files) {
    const doc = yaml.load(readFileSync(path.join(dir, f), 'utf8'));
    for (const r of doc?.requirements ?? []) for (const t of r.tests ?? []) if (t.file) out.add(t.file);
  }
  const list = [...out].sort();
  mkdirSync(path.dirname(cacheFile), { recursive: true });
  writeFileSync(cacheFile, JSON.stringify({ key, files: list }));
  return list;
}

const STATIC_PROTECTED = [
  [/^docs\/(Pflichtenheft|Lastenheft)\.md$/, 'Pflichtenheft/Lastenheft are the acceptance basis (decision C-19)'],
  [/^acceptance\//, 'acceptance criteria are written by the study team and read-only (R2)'],
  [/^handoff\/requirements\//, 'requirements registry is read-only for development sessions'],
  [/^\.planning\/useavibe\/[^/]+\/PROBLEMS\.md$/, 'frozen problem list (R1)'],
  [/^\.planning\/useavibe\/[^/]+\/(attempts\.jsonl|cycle\.json|frozen\.json|audit-baseline\.json)$/, 'harness record'],
  [/^\.planning\/useavibe\/(ACTIVE|CURRENT\.json)$/, 'harness state'],
  [/^acceptance-rounds\/.*\/RESULT\.yaml$/, 'team acceptance results are written by the team only (§5.12)'],
  [/^(scripts\/useavibe\/|\.claude\/settings\.json$|\.claude\/agents\/|\.claude\/skills\/useavibe-)/, 'harness configuration'],
  [/^\.useavibe-harness\.json$/, 'harness install manifest'],
  [/^(playwright\.config\.ts|tests\/acceptance\/(fixtures\.ts|harness\.spec\.ts)|deploy\/useavibe\/)/, 'harness test infrastructure'],
];

/**
 * Why `rel` (repo-relative, posix) must not be edited in the current session, or null.
 * Earlier cycles' tests/acceptance/Z<j>/ are frozen; tests/acceptance-at/ only in AT-fix sessions.
 */
export async function protectedReason(rel, root) {
  for (const [re, why] of STATIC_PROTECTED) if (re.test(rel)) return why;
  const active = readActive(root);
  const k = currentCycle(root);
  const m = rel.match(/^tests\/acceptance\/Z(\d+)\//);
  if (m && (k === null || Number(m[1]) < k || (active && active.kind === 'at'))) {
    return `acceptance tests of cycle Z${m[1]} are frozen (current cycle: ${k === null ? 'unknown' : `Z${k}`})`;
  }
  if (m && active?.kind === 'usability' && !path.posix.basename(rel).startsWith(`${active.id}.`)) {
    return `only the tests of ${active.id} are editable in this session (one problem per session, R4)`;
  }
  if (/^tests\/acceptance-at\//.test(rel) && !(active && active.kind === 'at')) {
    return 'automated AT suite is editable only in acceptance-test fix sessions';
  }
  const mapped = await registryTestFiles(root);
  if (mapped === null && /^tests\//.test(rel)) return 'registry not readable (node_modules missing?) — failing closed';
  if (mapped?.includes(rel)) return 'registry-mapped test: keeps its title and assertions (handoff rule); stop and report';
  return null;
}

/** Directories of the private study workspace that development sessions must never read. */
export function deniedRoots(root) {
  const roots = [];
  const add = (p) => { if (p) roots.push(path.resolve(p)); };
  if (process.env.USEAVIBE_WORKSPACE) {
    add(path.join(process.env.USEAVIBE_WORKSPACE, 'data'));
    add(path.join(process.env.USEAVIBE_WORKSPACE, 'study'));
  }
  const parent = path.dirname(root);
  for (const d of ['data', 'study']) if (existsSync(path.join(parent, d))) add(path.join(parent, d));
  return [...new Set(roots)];
}

export const isInside = (p, dir) => {
  const r = path.relative(dir, p);
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};

export function appendJsonl(file, obj) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(obj) + '\n', { flag: 'a' });
}

export const readJsonl = (file) => (existsSync(file)
  ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean)
  : []);

export const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
