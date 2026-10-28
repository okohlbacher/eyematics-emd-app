#!/usr/bin/env node
// Scripted DEPLOY smoke check (decision O-19; installed by the UseAVibe harness): the HTTP-observable parts of the
// UIR-DEPLOY registry entries, run from a workstation against a deployed instance behind the real proxy — no browser,
// no login, no Claude Code on the server. Host-level entries (restart, SIGTERM, volume) stay with the operator, visual
// ones (009, 014) manual; the parts of an entry that need a browser or a login are named in the report.
//   node scripts/useavibe/deploy-smoke.mjs <base-url> [--version 1.21.2] [--out round-dir/deploy-smoke.md]
// Exit 1 if any check fails. Node builtins only (fetch, Node ≥ 18).
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const base = args.find((a, i) => !a.startsWith('--') && !['--version', '--out'].includes(args[i - 1]));
if (!base) {
  console.error('usage: deploy-smoke.mjs <base-url> [--version x.y.z] [--out file.md]');
  process.exit(2);
}
const url = (p) => new URL(p, base).toString();
const get = async (p) => {
  const r = await fetch(url(p), { redirect: 'manual' });
  return { status: r.status, type: r.headers.get('content-type') ?? '', headers: r.headers, body: await r.text() };
};
const results = [];
const check = async (id, what, fn, manual = '') => {
  try {
    const problems = (await fn()).filter(Boolean);
    results.push({ id, what, ok: problems.length === 0, detail: problems.join('; '), manual });
  } catch (e) {
    results.push({ id, what, ok: false, detail: `request failed: ${e.message}`, manual });
  }
};
const isHtml = (r) => r.type.includes('text/html') || /^\s*<!doctype html/i.test(r.body);

const index = await get('/').catch(() => null);
const csp = index?.headers.get('content-security-policy') ?? '';
const directive = (name) => (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '');

await check('UIR-DEPLOY-004', 'GET /healthz → 200 {"status":"ok"} without a token', async () => {
  const r = await get('/healthz');
  let j = {};
  try { j = JSON.parse(r.body); } catch { /* not JSON */ }
  return [r.status !== 200 && `status ${r.status}`, j.status !== 'ok' && `body ${r.body.slice(0, 80)}`];
}, 'no audit row for /healthz (Protokoll, needs login); container status healthy (host)');

await check('UIR-DEPLOY-006', 'plain HTTP: page not empty, relative asset URLs, no upgrade-insecure-requests', async () => [
  index.status !== 200 && `GET / status ${index.status}`,
  !/<script[^>]+src=/i.test(index.body) && 'no script bundle referenced',
  /(src|href)="https:\/\//i.test(index.body) && 'absolute https asset URL in index.html',
  /upgrade-insecure-requests/.test(csp) && 'CSP contains upgrade-insecure-requests',
], 'page renders and assets load over http (browser, Network tab)');

await check('UIR-DEPLOY-007', "CSP: script-src 'self', style-src + unsafe-inline, img-src data: blob:, frame-ancestors", async () => [
  !csp && 'no Content-Security-Policy header',
  directive('script-src').replace(/\s+/g, ' ') !== "script-src 'self'" &&
    `script-src is "${directive('script-src') || 'missing'}" (expected only 'self')`,
  !/'self'/.test(directive('style-src')) || !/'unsafe-inline'/.test(directive('style-src')) ? 'style-src not self + unsafe-inline' : '',
  !/'self'/.test(directive('img-src')) || !/data:/.test(directive('img-src')) || !/blob:/.test(directive('img-src'))
    ? 'img-src not self data: blob:' : '',
  !/frame-ancestors 'self'/.test(csp) && "frame-ancestors 'self' missing",
  /upgrade-insecure-requests/.test(csp) && 'upgrade-insecure-requests present',
], 'zero CSP violations in the console (browser)');

await check('UIR-DEPLOY-008', 'index.html without inline script; /theme-init.js served', async () => {
  const inline = [...index.body.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter((m) => m[1].trim());
  const t = await get('/theme-init.js');
  return [inline.length && `${inline.length} inline script(s)`, t.status !== 200 && `/theme-init.js status ${t.status}`];
}, 'theme menu shows "System" checked (browser)');

await check('UIR-DEPLOY-010', 'no Google Fonts or third-party font host in index.html and its stylesheets', async () => {
  const css = [...index.body.matchAll(/<link[^>]+href="([^"]+\.css)"/gi)].map((m) => m[1]);
  const texts = [index.body, ...(await Promise.all(css.map(async (h) => (await get(h)).body)))];
  const third = texts.flatMap((t) => [...t.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]))
    .filter((h) => /fonts\.(googleapis|gstatic)\.com/i.test(h));
  return [third.length && `third-party font host(s): ${[...new Set(third)].join(', ')}`];
}, 'all woff2 requests from /assets/ (browser, Network tab)');

await check('UIR-DEPLOY-013', 'deep links fall back to the SPA (200 text/html, built frontend)', async () => {
  const out = [];
  for (const p of ['/analysis?tab=trajectories', '/case/does-not-matter']) {
    const r = await get(p);
    if (r.status !== 200 || !isHtml(r)) out.push(`${p}: status ${r.status}, ${r.type}`);
    if (/No built frontend found/.test(r.body)) out.push(`${p}: no built frontend`);
  }
  return out;
}, 'the reloaded page renders the same view (browser)');

await check('UIR-DEPLOY-015', 'GET /data/centers.json → 403 JSON error', async () => {
  const r = await get('/data/centers.json');
  return [r.status !== 403 && `status ${r.status}`, !/"error"/.test(r.body) && 'no JSON error body', isHtml(r) && 'HTML'];
}, 'UI centre data from /api/fhir/centers (browser, needs login)');

await check('UIR-DEPLOY-016', 'GET /settings.yaml → SPA index (text/html), never YAML', async () => {
  const r = await get('/settings.yaml');
  return [!isHtml(r) && `content-type ${r.type}`, /^\s*[a-zA-Z_]+:\s/m.test(r.body) && !isHtml(r) && 'YAML-like body'];
});

await check('UIR-DEPLOY-017', 'unmatched /api/* → JSON 401/404, never the index page', async () => {
  const r = await get('/api/nope');
  return [![401, 404].includes(r.status) && `status ${r.status}`, isHtml(r) && 'HTML index page returned'];
}, 'with a token: exactly {"error":"Not found"} and 404 (needs login)');

await check('UIR-DEPLOY-021', 'running version matches the release', async () => {
  const want = opt('--version');
  if (!want) return ['--version not given'];
  const r = await get('/healthz');
  let v = '';
  try { v = JSON.parse(r.body).version ?? ''; } catch { /* not JSON */ }
  return [v !== want && `running "${v || '—'}", expected ${want}`];
}, '"Problem melden" dialog shows v<version>; image label org.opencontainers.image.version (host)');

const lines = [
  `# DEPLOY smoke check — ${base}`,
  '',
  `${new Date().toISOString()} · scripts/useavibe/deploy-smoke.mjs · ${results.filter((r) => r.ok).length}/` +
    `${results.length} passed. Covers only the HTTP-observable part of each entry; "still manual" must be checked ` +
    'in the round as before. Not covered: UIR-DEPLOY-011 cookies (needs a login), host-level entries (018–020, ' +
    '022–024; operator on the server), visual entries (009, 014).',
  '',
  '| Entry | Check | Result | Detail | Still manual |',
  '|---|---|---|---|---|',
  ...results.map((r) => `| ${r.id} | ${r.what} | ${r.ok ? 'PASS' : 'FAIL'} | ${r.detail || '—'} | ${r.manual || '—'} |`),
];
const text = lines.join('\n') + '\n';
if (opt('--out')) writeFileSync(opt('--out'), text);
process.stdout.write(text);
process.exit(results.every((r) => r.ok) ? 0 : 1);
