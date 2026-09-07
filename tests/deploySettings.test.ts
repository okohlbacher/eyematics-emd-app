/**
 * v1.20 — deploy/settings.yaml (seeded onto the container's /data volume on first start) must
 * stay a faithful copy of config/settings.yaml, differing ONLY in the four container values.
 * Guards against the two files drifting apart when settings keys are added or renamed.
 */
import { readFileSync } from 'node:fs';

import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

type Settings = Record<string, unknown> & { server: Record<string, unknown>; auth: Record<string, unknown> };

const load = (rel: string): Settings =>
  yaml.load(readFileSync(new URL(rel, import.meta.url), 'utf-8')) as Settings;

describe('deploy/settings.yaml parity with config/settings.yaml', () => {
  const repo = load('../config/settings.yaml');
  const container = load('../deploy/settings.yaml');

  it('carries exactly the container-specific values', () => {
    expect(container.server).toMatchObject({ host: '0.0.0.0', port: 3000, dataDir: '/data', serveFrontend: true });
    expect(container.auth.refreshCookieSecure).toBe(false);
  });

  it('matches the repo settings everywhere else', () => {
    for (const s of [repo, container]) {
      delete s.server.host;
      delete s.server.port;
      delete s.server.dataDir;
      delete s.auth.refreshCookieSecure;
    }
    expect(container).toEqual(repo);
  });
});
