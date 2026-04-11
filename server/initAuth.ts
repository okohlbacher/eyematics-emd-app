/**
 * Auth initialization: JWT secret management, users.json migration, auth config loading.
 *
 * CRITICAL: JWT secret is stored in data/jwt-secret.txt — NEVER in public/settings.yaml.
 * The public/ directory is served statically to clients by Express.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
}

interface AuthConfig {
  twoFactorEnabled: boolean;
  maxLoginAttempts: number;
  otpCode: string;
}

// ---------------------------------------------------------------------------
// Module-level state (populated by initAuth)
// ---------------------------------------------------------------------------

let _jwtSecret: string | null = null;
let _authConfig: AuthConfig | null = null;
let _usersFile: string | null = null;

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

  // Load or generate JWT secret
  if (fs.existsSync(secretFile)) {
    _jwtSecret = fs.readFileSync(secretFile, 'utf-8').trim();
    if (!_jwtSecret) {
      throw new Error('[initAuth] jwt-secret.txt exists but is empty — delete it to regenerate');
    }
  } else {
    _jwtSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, _jwtSecret, { encoding: 'utf-8', mode: 0o600 });
    console.log(`[initAuth] Generated new JWT secret at ${secretFile}`);
  }

  // Parse auth config from settings
  // auth.twoFactorEnabled takes precedence; fall back to top-level twoFactorEnabled
  const authSection = (settings.auth ?? {}) as Record<string, unknown>;
  const twoFa = typeof authSection.twoFactorEnabled === 'boolean'
    ? authSection.twoFactorEnabled
    : (typeof settings.twoFactorEnabled === 'boolean' ? settings.twoFactorEnabled : false);
  _authConfig = {
    twoFactorEnabled: twoFa,
    maxLoginAttempts: typeof authSection.maxLoginAttempts === 'number' ? authSection.maxLoginAttempts : 5,
    otpCode: typeof authSection.otpCode === 'string' ? authSection.otpCode : '123456',
  };

  // Parse auth provider and initialize Keycloak if needed
  const provider = typeof authSection.provider === 'string' ? authSection.provider : 'local';
  if (provider === 'keycloak') {
    const kc = (authSection.keycloak ?? {}) as Record<string, unknown>;
    if (typeof kc.issuer !== 'string' || !kc.issuer) {
      throw new Error('[initAuth] auth.keycloak.issuer is required when auth.provider=keycloak');
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
  'UKA': 'org-uka',
  'UKB': 'org-ukb',
  'LMU': 'org-lmu',
  'UKT': 'org-ukt',
  'UKM': 'org-ukm',
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

  if (needsWrite) {
    _atomicWrite(filePath, JSON.stringify(workingUsers, null, 2));
  }
}
