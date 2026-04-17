import { describe, it } from 'vitest';

describe('Phase 15 — TOTP enrollment (SEC-04)', () => {
  it.todo('POST /login returns requiresTotpEnrollment + enrollToken when unenrolled and twoFactorEnabled=true');
  it.todo('POST /api/auth/totp/enroll requires valid enrollToken purpose');
  it.todo('POST /api/auth/totp/enroll returns qrDataUrl, manualKey, enrollToken');
  it.todo('POST /api/auth/totp/confirm verifies TOTP code against embedded secret and activates totpEnabled');
  it.todo('POST /verify with enrolled user accepts a valid RFC 6238 TOTP code (window=1)');
  it.todo('POST /verify with enrolled user rejects an invalid TOTP code with 401');
  it.todo('POST /verify with non-enrolled user still accepts the static otpCode fallback');
});

describe('Phase 15 — TOTP recovery codes (SEC-05)', () => {
  it.todo('Enrollment returns 10 plaintext recovery codes exactly once');
  it.todo('Recovery codes persist as bcrypt hashes in users.json (not plaintext)');
  it.todo('POST /verify accepts a valid recovery code and burns it (removed from array)');
  it.todo('A burned recovery code cannot be reused (second attempt 401)');
  it.todo('POST /verify response includes recoveryCodeUsed: true when recovery path taken');
});
