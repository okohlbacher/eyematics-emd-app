/**
 * Phase 20 / Plan 03 / SESSION-13: Pure unit tests for describeAction's new
 * mappings for the JWT refresh-flow auth endpoints.
 *
 * - audit_action_refresh is the new key added in this plan (DE 'Token erneuert' / EN 'Token refreshed')
 * - audit_action_logout was pre-existing in translations.ts (DE 'Abmeldung' / EN 'Logout')
 *   but was previously NOT wired in describeAction; this plan wires it.
 *
 * Phase 19 mappings (login, create_user, delete_user, etc.) MUST remain green —
 * Test 5 is the regression guard.
 */
import { describe, expect, it } from 'vitest';

import { type TranslationKey,translations } from '../src/i18n/translations';
import { describeAction } from '../src/pages/audit/auditFormatters';

const enT = (key: TranslationKey): string => translations[key].en;
const deT = (key: TranslationKey): string => translations[key].de;

describe('describeAction — Phase 20 SESSION-13 (refresh + logout wiring)', () => {
  it('maps POST /api/auth/refresh to audit_action_refresh (en)', () => {
    expect(describeAction('POST', '/api/auth/refresh', enT)).toBe('Token refreshed');
  });

  it('maps POST /api/auth/logout to audit_action_logout (en)', () => {
    expect(describeAction('POST', '/api/auth/logout', enT)).toBe('Logout');
  });

  it('maps POST /api/auth/refresh to audit_action_refresh (de)', () => {
    expect(describeAction('POST', '/api/auth/refresh', deT)).toBe('Token erneuert');
  });

  it('maps POST /api/auth/logout to audit_action_logout (de)', () => {
    expect(describeAction('POST', '/api/auth/logout', deT)).toBe('Abmeldung');
  });

  it('preserves Phase 19 mapping for /api/auth/login (regression)', () => {
    expect(describeAction('POST', '/api/auth/login', enT)).toBe('Login');
  });

  it('does NOT map GET /api/auth/refresh (POST-only) — falls through to unknown', () => {
    expect(describeAction('GET', '/api/auth/refresh', enT)).toBe(translations.audit_action_unknown.en);
  });
});
