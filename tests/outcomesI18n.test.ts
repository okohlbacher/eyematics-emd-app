/** OUTCOME-12: i18n completeness for the outcomes* namespace. */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('outcomes* i18n bundle', () => {
  // Enumerate every outcomes* key and check both locales
  it('every outcomes* key has a non-empty de and en translation', async () => {
    const mod = await import('../src/i18n/translations');
    // Access the underlying flat object via named export or default
    const t = (mod as any).translations ?? (mod as any).default;
    const outcomesKeys = Object.keys(t).filter((k) => k.startsWith('outcomes'));
    expect(outcomesKeys.length).toBeGreaterThan(40); // we expect ~55+ keys
    for (const k of outcomesKeys) {
      expect(t[k].de, `${k} has no DE translation`).toBeTruthy();
      expect(t[k].en, `${k} has no EN translation`).toBeTruthy();
      expect(t[k].de.length, `${k} DE is empty`).toBeGreaterThan(0);
      expect(t[k].en.length, `${k} EN is empty`).toBeGreaterThan(0);
    }
  });

  it('placeholder tokens match between DE and EN', async () => {
    const mod = await import('../src/i18n/translations');
    const t = (mod as any).translations ?? (mod as any).default;
    const outcomesKeys = Object.keys(t).filter((k) => k.startsWith('outcomes'));
    for (const k of outcomesKeys) {
      const dePlaceholders = (t[k].de.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
      const enPlaceholders = (t[k].en.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
      expect(enPlaceholders, `${k} placeholders differ`).toEqual(dePlaceholders);
    }
  });

  it('every t("outcomes*") reference in src/ resolves to a defined key', async () => {
    const mod = await import('../src/i18n/translations');
    const t = (mod as any).translations ?? (mod as any).default;
    const defined = new Set(Object.keys(t).filter((k) => k.startsWith('outcomes')));

    // Walk src/ recursively, collect t('outcomes*') string literals
    const srcDir = path.resolve(__dirname, '../src');
    const usedKeys = new Set<string>();
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
          const src = fs.readFileSync(full, 'utf8');
          const matches = src.matchAll(/\bt\(\s*['"`](outcomes[A-Za-z0-9_]+)['"`]\s*\)/g);
          for (const m of matches) usedKeys.add(m[1]);
        }
      }
    }
    walk(srcDir);

    const missing = [...usedKeys].filter((k) => !defined.has(k));
    expect(missing, `missing keys referenced in src/: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('Phase 17 i18n keys (theme + audit filters)', () => {
  const PHASE_17_KEYS = [
    'themeLight', 'themeDark', 'themeSystem',
    'auditFilterUser', 'auditFilterAllUsers',
    'auditFilterCategory', 'auditFilterAllCategories',
    'auditCategoryAuth', 'auditCategoryData', 'auditCategoryAdmin', 'auditCategoryOutcomes',
    'auditFilterFrom', 'auditFilterTo',
    'auditFilterCohortHash', 'auditFilterFailuresOnly',
    'auditEmptyFiltered',
  ] as const;

  for (const key of PHASE_17_KEYS) {
    it(`translations.en.${key} is a non-empty string`, async () => {
      const mod = await import('../src/i18n/translations');
      const t = (mod as any).translations ?? (mod as any).default;
      expect(t[key]).toBeDefined();
      expect(typeof t[key].en).toBe('string');
      expect((t[key].en as string).length).toBeGreaterThan(0);
    });
    it(`translations.de.${key} is a non-empty string`, async () => {
      const mod = await import('../src/i18n/translations');
      const t = (mod as any).translations ?? (mod as any).default;
      expect(t[key]).toBeDefined();
      expect(typeof t[key].de).toBe('string');
      expect((t[key].de as string).length).toBeGreaterThan(0);
    });
  }
});

describe('metrics* i18n bundle', () => {
  // METRIC-06: enforce completeness of metrics* namespace seeded by Phase 13-01
  it('every metrics* key has a non-empty de and en translation', async () => {
    const mod = await import('../src/i18n/translations');
    const t = (mod as any).translations ?? (mod as any).default;
    const metricsKeys = Object.keys(t).filter((k) => k.startsWith('metrics'));
    expect(metricsKeys.length).toBeGreaterThan(40); // Plan 13-01 seeds ~50 keys per 13-UI-SPEC.md
    for (const k of metricsKeys) {
      expect(t[k].de, `${k} has no DE translation`).toBeTruthy();
      expect(t[k].en, `${k} has no EN translation`).toBeTruthy();
      expect(t[k].de.length, `${k} DE is empty`).toBeGreaterThan(0);
      expect(t[k].en.length, `${k} EN is empty`).toBeGreaterThan(0);
    }
  });

  it('placeholder tokens match between DE and EN', async () => {
    const mod = await import('../src/i18n/translations');
    const t = (mod as any).translations ?? (mod as any).default;
    const metricsKeys = Object.keys(t).filter((k) => k.startsWith('metrics'));
    for (const k of metricsKeys) {
      const dePlaceholders = (t[k].de.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
      const enPlaceholders = (t[k].en.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
      expect(enPlaceholders, `${k} placeholders differ`).toEqual(dePlaceholders);
    }
  });

  it('every t("metrics*") reference in src/ resolves to a defined key', async () => {
    const mod = await import('../src/i18n/translations');
    const t = (mod as any).translations ?? (mod as any).default;
    const defined = new Set(Object.keys(t).filter((k) => k.startsWith('metrics')));

    const srcDir = path.resolve(__dirname, '../src');
    const usedKeys = new Set<string>();
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
          const src = fs.readFileSync(full, 'utf8');
          const matches = src.matchAll(/\bt\(\s*['"`](metrics[A-Za-z0-9_]+)['"`]\s*\)/g);
          for (const m of matches) usedKeys.add(m[1]);
        }
      }
    }
    walk(srcDir);

    const missing = [...usedKeys].filter((k) => !defined.has(k));
    expect(missing, `missing keys referenced in src/: ${missing.join(', ')}`).toEqual([]);
  });
});
