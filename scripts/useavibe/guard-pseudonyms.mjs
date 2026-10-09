#!/usr/bin/env node
// Git pre-commit / commit-msg guard (build prompt §2.2 item 3; installed by the UseAVibe harness):
// refuses a commit whose staged additions, file names or message contain a known study pseudonym. Compares
// six-character alphanumeric tokens against the salted SHA-256 list in the private workspace
// (`git config useavibe.pseudonymDir` → pseudonym-salt, pseudonym-hashes.txt); no pseudonym is stored in this repo.
//   node scripts/useavibe/guard-pseudonyms.mjs            (pre-commit: staged diff)
//   node scripts/useavibe/guard-pseudonyms.mjs --msg FILE (commit-msg)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
let dir = '';
try { dir = git('config', '--get', 'useavibe.pseudonymDir').trim(); } catch { /* unset */ }
if (!dir || !existsSync(path.join(dir, 'pseudonym-salt'))) {
  console.error('UseAVibe pseudonym guard: useavibe.pseudonymDir is not configured — refusing (run `useavibe install --workspace`).');
  process.exit(1);
}
const salt = readFileSync(path.join(dir, 'pseudonym-salt'), 'utf8').trim();
const listFile = path.join(dir, 'pseudonym-hashes.txt');
const known = new Set(existsSync(listFile) ? readFileSync(listFile, 'utf8').split(/\s+/).filter(Boolean) : []);
const i = process.argv.indexOf('--msg');
const text = i > 0
  ? readFileSync(process.argv[i + 1], 'utf8')
  : git('diff', '--cached', '-U0', '--no-color').split('\n').filter((l) => l.startsWith('+')).join('\n')
    + '\n' + git('diff', '--cached', '--name-only');
const hits = new Set();
for (const tok of text.match(/(?<![A-Za-z0-9])[A-Za-z0-9]{6}(?![A-Za-z0-9])/g) ?? []) {
  if (known.has(createHash('sha256').update(salt + tok.toUpperCase()).digest('hex'))) hits.add(tok.length);
}
if (hits.size) {
  console.error(`UseAVibe pseudonym guard: the ${i > 0 ? 'commit message' : 'staged change'} contains a study pseudonym — commit refused (value not shown).`);
  process.exit(1);
}
