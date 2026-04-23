// TEST-04 CI gate: forbid describe.skip/it.skip/test.skip in tests/** without a
// SKIP_REASON: comment on the prior line. Known limitation: alternative constructs
// like it['skip']() or aliased variables are not detected — ESLint-based enforcement
// deferred to v1.9 Phase 23 (D-11).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const SKIP_RE = /\b(describe|it|test)\.skip\s*\(/;
const REASON_RE = /^\s*\/\/\s*SKIP_REASON:/;
const files = walk('tests');
const violations = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf-8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (SKIP_RE.test(lines[i])) {
      const prev = i > 0 ? lines[i - 1] : '';
      if (!REASON_RE.test(prev)) {
        violations.push(`${file}:${i + 1}  ${lines[i].trim()}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Skipped tests without SKIP_REASON comment:');
  for (const v of violations) console.error('  ' + v);
  process.exit(1);
}
console.log(`OK: ${files.length} test files, no unlabelled .skip`);
