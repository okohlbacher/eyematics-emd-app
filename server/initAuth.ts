/**
 * Auth initialization: JWT secret management, users.json migration, auth config loading.
 *
 * CRITICAL: JWT secret is stored in data/jwt-secret.txt — NEVER in public/settings.yaml.
 * The public/ directory is served statically to clients by Express.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import bcrypt from 'bcryptjs';

import { initKeycloakAuth } from './keycloakAuth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserRecord {
  username: string;
  passwordHash?: string;
  role: string;
  centers: string[];
  firstName?: string;
  lastName?: string;
  createdAt: string;
  lastLogin?: string;
  /** Per-user TOTP secret (base32). Present after enrollment begins; ignored until totpEnabled=true. */
  totpSecret?: string;
  /** True once user confirms first valid OTP. Login then requires per-user TOTP (not shared otpCode). */
  totpEnabled?: boolean;
  /** Bcrypt hashes of one-time recovery codes. Each is burned on use. */
  recoveryCodeHashes?: string[];
  /**
   * Phase 20 / D-16 — monotonically increasing counter. Bumped on
   * logout, password change, TOTP change, admin password reset, admin TOTP reset.
   * Refresh tokens carry this value in `payload.ver`; on /api/auth/refresh, a
   * mismatch invalidates the token (logout-everywhere semantics for THIS user).
   */
  tokenVersion?: number;
  /** Phase 20 / D-16 — ISO timestamp of the last password mutation. */
  passwordChangedAt?: string;
  /** Phase 20 / D-16 — ISO timestamp of the last TOTP mutation (enroll/disable/reset). */
  totpChangedAt?: string;
  /**
   * UMGMT-03 — activation flag. Default true; an absent field means active (migration target).
   * Set to false by admin to prevent login without deleting the account.
   */
  active?: boolean;
}

interface AuthConfig {
  twoFactorEnabled: boolean;
  maxLoginAttempts: number;
  otpCode: string;
  /** Exponential-backoff cap in ms (AUTHCFG-04). lockout = min(2^failures * 1s, lockoutCapMs). */
  lockoutCapMs: number;
}

// ---------------------------------------------------------------------------
// Module-level state (populated by initAuth)
// ---------------------------------------------------------------------------

let _jwtSecret: string | null = null;
let _jwtSecretPrev: string | null = null;   // previous key during dual-key window
let _authConfig: AuthConfig | null = null;
let _usersFile: string | null = null;
let _dataDir: string | null = null;
let _refreshAbsoluteCapMs: number = 12 * 60 * 60 * 1000; // default 12h

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Called once at startup. Loads or generates JWT secret, migrates users.json,
 * and parses auth config from settings.
 *
 * JWT secret is stored in data/jwt-secret.txt (NOT in public/settings.yaml).
 */
export function initAuth(dataDir: string, settings: Record<string, unknown>): void {
  const secretFile = path.join(dataDir, 'jwt-secret.txt');
  _usersFile = path.join(dataDir, 'users.json');
  _dataDir = dataDir;
  if (typeof settings.refreshAbsoluteCapMs === 'number') {
    _refreshAbsoluteCapMs = settings.refreshAbsoluteCapMs;
  }

  // Load or generate JWT secret
  if (fs.existsSync(secretFile)) {
    _jwtSecret = fs.readFileSync(secretFile, 'utf-8').trim();
    if (!_jwtSecret) {
      throw new Error('[initAuth] jwt-secret.txt exists but is empty — delete it to regenerate');
    }
    // L10: re-verify file mode on every boot. If a prior deployment wrote it
    // world-readable (or an operator loosened it), tighten back to 0o600 and
    // warn. We do not fail hard — tightening is always a strict improvement.
    if (process.platform !== 'win32') {
      try {
        const mode = fs.statSync(secretFile).mode & 0o777;
        if (mode !== 0o600) {
          fs.chmodSync(secretFile, 0o600);
          console.warn(`[initAuth] jwt-secret.txt had mode 0o${mode.toString(8)}; tightened to 0o600`);
        }
      } catch (err) {
        console.warn('[initAuth] could not verify jwt-secret.txt mode:', err instanceof Error ? err.message : err);
      }
    }
  } else {
    _jwtSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, _jwtSecret, { encoding: 'utf-8', mode: 0o600 });
    console.log(`[initAuth] Generated new JWT secret at ${secretFile}`);
  }

  // Load previous key if dual-key window is active (D-09)
  const prevSecretFile = path.join(dataDir, 'jwt-secret-prev.txt');
  if (fs.existsSync(prevSecretFile)) {
    _jwtSecretPrev = fs.readFileSync(prevSecretFile, 'utf-8').trim() || null;
    if (_jwtSecretPrev) {
      console.log('[initAuth] loaded previous JWT secret (dual-key window active)');
    }
  } else {
    _jwtSecretPrev = null;
  }

  // Parse auth config from settings. AUTHCFG-04: prefer settings.auth.maxLoginAttempts / lockoutCapMs
  // when present; fall back to top-level maxLoginAttempts (backward compat), then hard defaults.
  const authSub = (settings.auth ?? {}) as Record<string, unknown>;
  _authConfig = {
    twoFactorEnabled: typeof settings.twoFactorEnabled === 'boolean' ? settings.twoFactorEnabled : false,
    maxLoginAttempts: typeof authSub.maxLoginAttempts === 'number' ? authSub.maxLoginAttempts
      : typeof settings.maxLoginAttempts === 'number' ? settings.maxLoginAttempts : 5,
    otpCode: typeof settings.otpCode === 'string' ? settings.otpCode : '123456',
    lockoutCapMs: typeof authSub.lockoutCapMs === 'number' ? authSub.lockoutCapMs : 900_000,
  };

  // Parse auth provider and initialize Keycloak if needed
  const provider = typeof settings.provider === 'string' ? settings.provider : 'local';
  if (provider === 'keycloak') {
    // M7: reject provider=keycloak until the OIDC redirect/callback flow ships.
    // The JWKS verification path is wired (authMiddleware RS256 branch), but the
    // browser-side login flow that actually acquires a Keycloak-issued token is
    // not yet implemented. Enabling this mode today yields an app that accepts
    // tokens no client can obtain — leaving users locked out and /login returning
    // 405. Fail fast at startup instead of half-starting.
    throw new Error(
      '[initAuth] provider=keycloak is not yet supported: the OIDC redirect flow has not shipped. ' +
      'Set auth.provider=local in settings.yaml until the redirect flow is available.',
    );
     
    const kc = (settings.keycloak ?? {}) as Record<string, unknown>;
    if (typeof kc.issuer !== 'string' || !kc.issuer) {
      throw new Error('[initAuth] keycloak.issuer is required when provider=keycloak');
    }
    initKeycloakAuth(kc.issuer);
    console.log(`[initAuth] Keycloak mode enabled. JWKS: ${kc.issuer}/protocol/openid-connect/certs`);
  }

  // Migrate users.json: add bcrypt passwordHash for any user missing it
  if (fs.existsSync(_usersFile)) {
    _migrateUsersJson(_usersFile);
  }
}

/**
 * Returns the loaded JWT secret.
 * Throws if initAuth() has not been called.
 */
export function getJwtSecret(): string {
  if (_jwtSecret === null) {
    throw new Error('[initAuth] getJwtSecret() called before initAuth()');
  }
  return _jwtSecret;
}

/**
 * Returns current and (if dual-key window active) previous JWT secrets.
 * Only verifyRefreshToken uses both keys; access/challenge tokens use getJwtSecret() only (D-12).
 */
export function getJwtSecrets(): { current: string; prev?: string } {
  if (_jwtSecret === null) {
    throw new Error('[initAuth] getJwtSecrets() called before initAuth()');
  }
  return { current: _jwtSecret, prev: _jwtSecretPrev ?? undefined };
}

/** First 8 hex chars of SHA256(secret) — identifies which key signed a token (D-10). */
export function computeKeyId(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 8);
}

/**
 * Atomic key rotation: jwt-secret-next.txt → jwt-secret.txt; old current → jwt-secret-prev.txt.
 * Returns { rotatedAt, prevKeyExpiresBy } for the admin response.
 * Throws with code=NEXT_KEY_MISSING if jwt-secret-next.txt does not exist.
 */
export function rotateSigningKey(): { rotatedAt: string; prevKeyExpiresBy: string } {
  if (!_dataDir) throw new Error('[initAuth] rotateSigningKey() called before initAuth()');

  const currentPath = path.join(_dataDir, 'jwt-secret.txt');
  const nextPath    = path.join(_dataDir, 'jwt-secret-next.txt');
  const prevPath    = path.join(_dataDir, 'jwt-secret-prev.txt');

  if (!fs.existsSync(nextPath)) {
    const err = new Error('jwt-secret-next.txt not found in data directory');
    (err as Error & { code: string }).code = 'NEXT_KEY_MISSING';
    throw err;
  }

  if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);

  fs.renameSync(currentPath, prevPath);
  fs.renameSync(nextPath, currentPath);

  try { fs.chmodSync(currentPath, 0o600); } catch { /* best effort */ }
  try { fs.chmodSync(prevPath, 0o600); } catch { /* best effort */ }

  _jwtSecretPrev = fs.readFileSync(prevPath, 'utf-8').trim();
  _jwtSecret = fs.readFileSync(currentPath, 'utf-8').trim();

  const rotatedAt = new Date().toISOString();
  const prevKeyExpiresBy = new Date(Date.now() + _refreshAbsoluteCapMs).toISOString();
  console.log(`[initAuth] signing key rotated at ${rotatedAt}; prev key valid until ${prevKeyExpiresBy}`);
  return { rotatedAt, prevKeyExpiresBy };
}

/**
 * Returns the parsed auth configuration.
 * Throws if initAuth() has not been called.
 */
export function getAuthConfig(): AuthConfig {
  if (_authConfig === null) {
    throw new Error('[initAuth] getAuthConfig() called before initAuth()');
  }
  return _authConfig;
}

/**
 * Re-parse auth config from updated settings.
 * Called after settings.yaml is written so the in-memory config stays in sync.
 * AUTHCFG-04: prefers settings.auth.maxLoginAttempts / lockoutCapMs; falls back to
 * top-level maxLoginAttempts for backward compat, then hard defaults.
 */
export function updateAuthConfig(settings: Record<string, unknown>): void {
  const authSub = (settings.auth ?? {}) as Record<string, unknown>;
  _authConfig = {
    twoFactorEnabled: typeof settings.twoFactorEnabled === 'boolean' ? settings.twoFactorEnabled : false,
    maxLoginAttempts: typeof authSub.maxLoginAttempts === 'number' ? authSub.maxLoginAttempts
      : typeof settings.maxLoginAttempts === 'number' ? settings.maxLoginAttempts : 5,
    otpCode: typeof settings.otpCode === 'string' ? settings.otpCode : '123456',
    lockoutCapMs: typeof authSub.lockoutCapMs === 'number' ? authSub.lockoutCapMs : 900_000,
  };
}

/**
 * Reads and returns all users from data/users.json.
 * Throws if initAuth() has not been called or users file does not exist.
 */
export function loadUsers(): UserRecord[] {
  if (_usersFile === null) {
    throw new Error('[initAuth] loadUsers() called before initAuth()');
  }
  if (!fs.existsSync(_usersFile)) {
    return [];
  }
  const raw = fs.readFileSync(_usersFile, 'utf-8');
  return JSON.parse(raw) as UserRecord[];
}

// ---------------------------------------------------------------------------
// Write serialization
// ---------------------------------------------------------------------------

/**
 * In-process write lock to serialize user-write operations.
 * Prevents lost-update race when two admin requests overlap.
 * (Review concern #8: concurrent admin mutations)
 */
let _writeLock = false;
const _writeQueue: Array<() => void> = [];

function acquireWriteLock(): Promise<void> {
  return new Promise((resolve) => {
    if (!_writeLock) {
      _writeLock = true;
      resolve();
    } else {
      _writeQueue.push(resolve);
    }
  });
}

function releaseWriteLock(): void {
  const next = _writeQueue.shift();
  if (next) {
    next();
  } else {
    _writeLock = false;
  }
}

/**
 * Atomically write the full user list to data/users.json.
 * Uses temp-file + rename to prevent corruption on crash.
 * Write operations are serialized to prevent lost updates
 * from concurrent admin requests.
 */
export async function saveUsers(users: UserRecord[]): Promise<void> {
  if (_usersFile === null) {
    throw new Error('[initAuth] saveUsers() called before initAuth()');
  }
  await acquireWriteLock();
  try {
    _atomicWrite(_usersFile, JSON.stringify(users, null, 2));
  } finally {
    releaseWriteLock();
  }
}

/**
 * F-11: Execute a read-modify-write cycle under the write lock.
 * Prevents TOCTOU races where concurrent admin requests read stale data.
 * The callback receives the current users array and must return the updated array.
 */
export async function modifyUsers(fn: (users: UserRecord[]) => UserRecord[]): Promise<UserRecord[]> {
  if (_usersFile === null) {
    throw new Error('[initAuth] modifyUsers() called before initAuth()');
  }
  await acquireWriteLock();
  try {
    const users = loadUsers();
    const updated = fn(users);
    _atomicWrite(_usersFile, JSON.stringify(updated, null, 2));
    return updated;
  } finally {
    releaseWriteLock();
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Atomic write: write to temp file then rename.
 */
function _atomicWrite(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp.${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Center ID migration
// ---------------------------------------------------------------------------

/**
 * Mapping from shorthand center names to org-* format.
 * Shorthand values are legacy and must be migrated at startup.
 */
const SHORTHAND_TO_ORG: Record<string, string> = {
  'UKA':  'org-uka',
  'UKC':  'org-ukc',
  'UKD':  'org-ukd',
  'UKG':  'org-ukg',
  'UKL':  'org-ukl',
  'UKM':  'org-ukm',
  'UKMZ': 'org-ukmz',
  'UKT':  'org-ukt',
};

/**
 * Migrate center IDs from shorthand (e.g. "UKA") to org-* format (e.g. "org-uka").
 * Already-migrated values (org-*) are left unchanged.
 *
 * Exported for testing.
 */
export function _migrateCenterIds(users: UserRecord[]): { users: UserRecord[]; changed: boolean } {
  let changed = false;
  const migrated = users.map((u) => {
    const newCenters = u.centers.map((c) => SHORTHAND_TO_ORG[c] ?? c);
    if (newCenters.some((nc, i) => nc !== u.centers[i])) changed = true;
    return { ...u, centers: newCenters };
  });
  return { users: migrated, changed };
}

/**
 * Set of removed center IDs (historical roster cleanup).
 * v1.5 roster correction removed Bonn (org-ukb) and München (org-lmu).
 * Münster (org-ukm) was also removed in v1.5 but re-added post-v1.8 per roster feedback.
 * Phase 24 / FB-01 removed Dresden (org-ukd) and Mainz (org-ukmz) — sites
 * declined to participate.
 * Users holding only removed centers are reassigned to ['org-uka'] (default fallback)
 * so they remain functional after the roster switch.
 *
 * Exported indirectly via _migrateRemovedCenters for testing.
 */
// Migration-only fallback: existing deployments may have users assigned to removed
// centres. After stripping, users with an empty centres list are reassigned to
// ['org-uka']. This is INTENTIONALLY different from the fresh-seed defaults in
// `server/index.ts` (which assign role-appropriate centres) — the migration path
// only sees orphaned records, not freshly-created ones (FB-01 / Phase 24).
const REMOVED_CENTER_IDS = new Set<string>(['org-ukb', 'org-lmu', 'org-ukd', 'org-ukmz']);

/**
 * Strip removed-roster center IDs from each user's centers array.
 * Users whose centers array becomes empty after stripping are reassigned to ['org-uka'].
 *
 * Exported for testing.
 */
export function _migrateRemovedCenters(
  users: UserRecord[],
): { users: UserRecord[]; changed: boolean } {
  let changed = false;
  const migrated = users.map((u) => {
    const filtered = u.centers.filter((c) => !REMOVED_CENTER_IDS.has(c));
    const dropped = filtered.length !== u.centers.length;
    if (filtered.length === 0) {
      changed = true;
      return { ...u, centers: ['org-uka'] };
    }
    if (dropped) {
      changed = true;
      return { ...u, centers: filtered };
    }
    return u;
  });
  return { users: migrated, changed };
}

/**
 * Phase 20 / D-16, D-17 — Add session-resilience fields to user records.
 * Pure helper, exported for testing. Idempotent: re-running on already-migrated
 * users yields `changed=false` and identical output.
 *
 * Defaults:
 * - `tokenVersion: 0`
 * - `passwordChangedAt`: `user.createdAt` if present, else `now`
 * - `totpChangedAt`:     `user.createdAt` if present, else `now`
 */
export function _migrateSessionFields(
  users: UserRecord[],
  now: string = new Date().toISOString(),
): { users: UserRecord[]; changed: boolean } {
  let changed = false;
  const migrated = users.map((u) => {
    const next: UserRecord = { ...u };
    let userChanged = false;
    if (typeof next.tokenVersion !== 'number') {
      next.tokenVersion = 0;
      userChanged = true;
    }
    if (typeof next.passwordChangedAt !== 'string') {
      next.passwordChangedAt = next.createdAt ?? now;
      userChanged = true;
    }
    if (typeof next.totpChangedAt !== 'string') {
      next.totpChangedAt = next.createdAt ?? now;
      userChanged = true;
    }
    if (userChanged) changed = true;
    return next;
  });
  return { users: migrated, changed };
}

/**
 * UMGMT-03 / Phase 32 — Add the `active` flag to user records missing it.
 * Pure helper, exported for testing. Idempotent: re-running on already-migrated
 * users yields `changed=false` and identical output.
 *
 * Absent `active` → set to `true` (migration target; absent === active).
 * Explicit `false` → preserved unchanged (deactivated users stay deactivated).
 * Explicit `true`  → preserved unchanged (already migrated).
 */
export function _migrateActiveFlag(
  users: UserRecord[],
): { users: UserRecord[]; changed: boolean } {
  let changed = false;
  const migrated = users.map((u) => {
    // absent `active` means active — set to true (migration target)
    if (typeof u.active !== 'boolean') {
      changed = true;
      return { ...u, active: true };
    }
    return u;
  });
  return { users: migrated, changed };
}

/**
 * Migrate users.json: add passwordHash for any user missing it,
 * and convert center IDs from shorthand to org-* format.
 * Uses bcrypt with 12 rounds and the default password 'changeme2025!'.
 */
function _migrateUsersJson(filePath: string): void {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const users = JSON.parse(raw) as UserRecord[];

  let needsWrite = false;
  let workingUsers = users;

  // Migrate password hashes
  const withHashes = workingUsers.map((user) => {
    if (!user.passwordHash) {
      needsWrite = true;
      const hash = bcrypt.hashSync('changeme2025!', 12); // sync OK at startup (one-time migration)
      return { ...user, passwordHash: hash };
    }
    return user;
  });

  if (needsWrite) {
    console.log('[initAuth] Migrated users.json: added bcrypt passwordHash for users without one');
  }

  workingUsers = withHashes;

  // Migrate center IDs from shorthand to org-* format
  const { users: withOrgCenters, changed } = _migrateCenterIds(workingUsers);
  if (changed) {
    needsWrite = true;
    workingUsers = withOrgCenters;
    console.log('[initAuth] Migrated users.json: converted center IDs to org-* format');
  }

  // Migrate removed center IDs (v1.5 roster correction)
  // Must run AFTER _migrateCenterIds so legacy shorthand-form centers have
  // already been promoted to org-* before we check for removed IDs.
  const { users: withoutRemoved, changed: removedChanged } = _migrateRemovedCenters(workingUsers);
  if (removedChanged) {
    needsWrite = true;
    workingUsers = withoutRemoved;
    console.log('[initAuth] Migrated users.json: stripped removed center IDs (org-ukb/org-lmu/org-ukd/org-ukmz)');
  }

  // Phase 20 / D-17 — add tokenVersion / passwordChangedAt / totpChangedAt for
  // refresh-token invalidation. Idempotent (no-op once fields are present).
  const { users: withSessionFields, changed: sessionChanged } = _migrateSessionFields(workingUsers);
  if (sessionChanged) {
    needsWrite = true;
    workingUsers = withSessionFields;
    console.log('[initAuth] Migrated users.json: added tokenVersion / *ChangedAt for Phase 20');
  }

  // Phase 32 / UMGMT-03 — add `active: true` for any user without the field.
  // Absent active means active; explicit false (deactivated) is preserved.
  const { users: withActiveFlag, changed: activeChanged } = _migrateActiveFlag(workingUsers);
  if (activeChanged) {
    needsWrite = true;
    workingUsers = withActiveFlag;
    console.log('[initAuth] Migrated users.json: added active flag (default true)');
  }

  if (needsWrite) {
    _atomicWrite(filePath, JSON.stringify(workingUsers, null, 2));
  }
}
