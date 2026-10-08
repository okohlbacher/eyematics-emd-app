/**
 * v1.21 — resetSettings() resets the UI-managed keys only. Sections the UI does not manage
 * (server, stubs, audit, …) came from the server's settings.yaml and must stay in the YAML the
 * client persists — the reset used to send `{...DEFAULTS}` and drop `server:` (container bricked
 * on the next restart: serveFrontend off, dataDir back to ./data).
 */
import yaml from 'js-yaml';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/authHeaders', () => ({ authFetch: vi.fn(), getAuthHeaders: vi.fn(() => ({})) }));

import { authFetch } from '../src/services/authHeaders';
import { loadSettings, resetSettings } from '../src/services/settingsService';

const fetchMock = authFetch as unknown as ReturnType<typeof vi.fn>;
const SERVER_YAML = 'twoFactorEnabled: true\ntherapyInterrupterDays: 90\nserver:\n  host: 0.0.0.0\n  dataDir: /data\n  serveFrontend: true\nstubs:\n  factorMin: 2\naudit:\n  retentionDays: 30\n';

beforeEach(() => fetchMock.mockReset());

describe('resetSettings keeps the sections the UI does not manage', () => {
  it('persists DEFAULTS for UI keys but carries server/stubs/audit from the loaded YAML', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => SERVER_YAML });   // GET /api/settings
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 });                      // PUT /api/settings
    await loadSettings();
    await resetSettings();
    const put = fetchMock.mock.calls.find((c) => c[1]?.method === 'PUT');
    expect(put).not.toBeUndefined();
    const body = yaml.load(put![1].body as string) as Record<string, unknown>;
    expect(body.twoFactorEnabled).toBe(false);          // UI key back to its default
    expect(body.therapyInterrupterDays).toBe(120);
    expect(body.server).toEqual({ host: '0.0.0.0', dataDir: '/data', serveFrontend: true });
    expect(body.stubs).toEqual({ factorMin: 2 });
    expect(body.audit).toEqual({ retentionDays: 30 });
  });
});
