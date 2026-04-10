import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Audit time filter params (AUDIT-02)', () => {
  // Static analysis: verify the source file uses correct param names.
  // auditService.ts is a client-side module that uses browser APIs (fetch),
  // so we read the source directly rather than importing it in Node.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const sourceCode = readFileSync(
    resolve(__dirname, '../src/services/auditService.ts'),
    'utf-8'
  );

  it('filter interface uses fromTime (not from)', () => {
    expect(sourceCode).toContain('fromTime?:');
    expect(sourceCode).not.toMatch(/\bfrom\?\s*:/);
  });

  it('filter interface uses toTime (not to)', () => {
    expect(sourceCode).toContain('toTime?:');
    expect(sourceCode).not.toMatch(/\bto\?\s*:/);
  });

  it('URLSearchParams uses fromTime key', () => {
    expect(sourceCode).toContain("params.set('fromTime'");
    expect(sourceCode).not.toContain("params.set('from'");
  });

  it('URLSearchParams uses toTime key', () => {
    expect(sourceCode).toContain("params.set('toTime'");
    expect(sourceCode).not.toContain("params.set('to'");
  });
});
