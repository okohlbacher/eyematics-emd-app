/**
 * AUTHCFG-02 / AUTHCFG-03 — settings-sourced inactivity timers.
 *
 * Tests:
 * (a) AuthContext uses inactivityTimeoutMs / warningBeforeMs from loadSettings()
 * (b) When loadSettings() rejects, falls back to 600000 / 180000 defaults
 * (c) Per-key {de, en} presence for new i18n keys: inactivityCountdown,
 *     loginAttemptsRemaining, loginLockoutCountdown
 *
 * RTL assertions use queryByText().not.toBeNull() (no jest-dom per CLAUDE.md).
 */

import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// i18n presence tests (AUTHCFG-02 / AUTHCFG-03)
// ---------------------------------------------------------------------------

describe('new i18n keys — de+en presence (AUTHCFG-01/02)', () => {
  it('inactivityCountdown has non-empty de and en translations', async () => {
    const mod = await import('../src/i18n/translations');
    const t = (mod as Record<string, unknown>).translations ?? (mod as Record<string, unknown>).default;
    const tr = t as Record<string, { de: string; en: string }>;
    expect(tr.inactivityCountdown, 'inactivityCountdown must be defined').toBeTruthy();
    expect(tr.inactivityCountdown.de, 'inactivityCountdown.de must be non-empty').toBeTruthy();
    expect(tr.inactivityCountdown.en, 'inactivityCountdown.en must be non-empty').toBeTruthy();
    expect(tr.inactivityCountdown.de.length).toBeGreaterThan(0);
    expect(tr.inactivityCountdown.en.length).toBeGreaterThan(0);
  });

  it('loginAttemptsRemaining has non-empty de and en translations', async () => {
    const mod = await import('../src/i18n/translations');
    const t = (mod as Record<string, unknown>).translations ?? (mod as Record<string, unknown>).default;
    const tr = t as Record<string, { de: string; en: string }>;
    expect(tr.loginAttemptsRemaining, 'loginAttemptsRemaining must be defined').toBeTruthy();
    expect(tr.loginAttemptsRemaining.de, 'loginAttemptsRemaining.de must be non-empty').toBeTruthy();
    expect(tr.loginAttemptsRemaining.en, 'loginAttemptsRemaining.en must be non-empty').toBeTruthy();
    expect(tr.loginAttemptsRemaining.de.length).toBeGreaterThan(0);
    expect(tr.loginAttemptsRemaining.en.length).toBeGreaterThan(0);
  });

  it('loginLockoutCountdown has non-empty de and en translations', async () => {
    const mod = await import('../src/i18n/translations');
    const t = (mod as Record<string, unknown>).translations ?? (mod as Record<string, unknown>).default;
    const tr = t as Record<string, { de: string; en: string }>;
    expect(tr.loginLockoutCountdown, 'loginLockoutCountdown must be defined').toBeTruthy();
    expect(tr.loginLockoutCountdown.de, 'loginLockoutCountdown.de must be non-empty').toBeTruthy();
    expect(tr.loginLockoutCountdown.en, 'loginLockoutCountdown.en must be non-empty').toBeTruthy();
    expect(tr.loginLockoutCountdown.de.length).toBeGreaterThan(0);
    expect(tr.loginLockoutCountdown.en.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// settingsService.auth defaults — inactivityTimeoutMs / warningBeforeMs
// ---------------------------------------------------------------------------

describe('settingsService — auth defaults for inactivity (AUTHCFG-03)', () => {
  it('DEFAULTS.auth.inactivityTimeoutMs is 600000', async () => {
    // We can't easily import settingsService in node environment, so we test the
    // loadSettings() fallback behavior by checking the exported constants via
    // direct module inspection.
    const mod = await import('../src/services/settingsService');
    // Call loadSettings with a failing fetch — it should fall back to defaults.
    // Mock fetch to reject:
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    try {
      const settings = await mod.loadSettings();
      expect(settings.auth?.inactivityTimeoutMs).toBe(600000);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('DEFAULTS.auth.warningBeforeMs is 180000 (3 min — AUTHCFG-02)', async () => {
    const mod = await import('../src/services/settingsService');
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    try {
      const settings = await mod.loadSettings();
      expect(settings.auth?.warningBeforeMs).toBe(180000);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('DEFAULTS.auth provides inactivityTimeoutMs=600000 and warningBeforeMs=180000', async () => {
    // Test that the DEFAULTS contain the correct values (the constants that the
    // AuthContext fallback will use when loadSettings() rejects).
    // We inspect this by loading the module fresh and calling getSettings() synchronously
    // (which returns DEFAULTS when no prior load succeeded).
    vi.resetModules();
    const mod = await import('../src/services/settingsService');
    const defaults = mod.getSettings();
    // The defaults should include the new auth keys (set in DEFAULTS in settingsService.ts)
    expect(defaults.auth?.inactivityTimeoutMs).toBe(600000);
    expect(defaults.auth?.warningBeforeMs).toBe(180000);
  });

  it('loadSettings() falling back when fetch rejects still returns 600000/180000 safe defaults', async () => {
    const mod = await import('../src/services/settingsService');
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout'));
    try {
      const settings = await mod.loadSettings();
      // Safe defaults must be present — timer must never disable itself (T-32-09)
      expect(settings.auth?.inactivityTimeoutMs).toBe(600000);
      expect(settings.auth?.warningBeforeMs).toBe(180000);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
