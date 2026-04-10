import { describe, it, expect } from 'vitest';
import { validateSettingsSchema } from '../server/settingsApi.js';

// Valid settings matching public/settings.yaml canonical structure
const VALID_SETTINGS = {
  therapyInterrupterDays: 120,
  therapyBreakerDays: 365,
  dataSource: {
    type: 'local',
    blazeUrl: 'http://localhost:8080/fhir',
  },
  auth: {
    twoFactorEnabled: true,
    maxLoginAttempts: 5,
    otpCode: '123456',
  },
};

function validWith(overrides: Record<string, unknown>): unknown {
  return { ...VALID_SETTINGS, ...overrides };
}

describe('validateSettingsSchema (AUTH-05)', () => {
  it('accepts valid settings', () => {
    expect(validateSettingsSchema(VALID_SETTINGS)).toBeNull();
  });

  it('accepts settings without optional otpCode', () => {
    const settings = validWith({
      auth: { twoFactorEnabled: false, maxLoginAttempts: 5 },
    });
    expect(validateSettingsSchema(settings)).toBeNull();
  });

  it('rejects null input', () => {
    expect(validateSettingsSchema(null)).toBe('Settings must be a YAML object');
  });

  it('rejects non-object input', () => {
    expect(validateSettingsSchema('string')).toBe('Settings must be a YAML object');
  });

  it('rejects missing auth section', () => {
    const { auth: _, ...noAuth } = VALID_SETTINGS;
    const result = validateSettingsSchema({ ...noAuth });
    expect(result).toContain('auth must be an object');
  });

  it('rejects auth.twoFactorEnabled not boolean', () => {
    const settings = validWith({
      auth: { ...VALID_SETTINGS.auth, twoFactorEnabled: 'yes' },
    });
    expect(validateSettingsSchema(settings)).toContain('auth.twoFactorEnabled must be a boolean');
  });

  it('rejects auth.maxLoginAttempts not positive integer', () => {
    const settings = validWith({
      auth: { ...VALID_SETTINGS.auth, maxLoginAttempts: 0 },
    });
    expect(validateSettingsSchema(settings)).toContain('auth.maxLoginAttempts must be a positive integer');
  });

  it('rejects auth.maxLoginAttempts as float', () => {
    const settings = validWith({
      auth: { ...VALID_SETTINGS.auth, maxLoginAttempts: 3.5 },
    });
    expect(validateSettingsSchema(settings)).toContain('auth.maxLoginAttempts must be a positive integer');
  });

  it('rejects auth.otpCode as non-string', () => {
    const settings = validWith({
      auth: { ...VALID_SETTINGS.auth, otpCode: 123456 },
    });
    expect(validateSettingsSchema(settings)).toContain('auth.otpCode must be a string');
  });

  it('rejects top-level twoFactorEnabled without auth section', () => {
    const { auth: _, ...noAuth } = VALID_SETTINGS;
    const settings = { ...noAuth, twoFactorEnabled: true };
    expect(validateSettingsSchema(settings)).not.toBeNull();
  });

  it('rejects missing therapyInterrupterDays', () => {
    const { therapyInterrupterDays: _, ...rest } = VALID_SETTINGS;
    expect(validateSettingsSchema(rest)).toContain('therapyInterrupterDays must be a number');
  });

  it('rejects missing dataSource', () => {
    const { dataSource: _, ...rest } = VALID_SETTINGS;
    expect(validateSettingsSchema(rest)).toContain('dataSource must be an object');
  });
});
