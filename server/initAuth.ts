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
  const authSection = (settings.auth ?? {}) as Record<string, unknown>;
  _authConfig = {
    twoFactorEnabled: typeof authSection.twoFactorEnabled === 'boolean' ? authSection.twoFactorEnabled : false,
    maxLoginAttempts: typeof authSection.maxLoginAttempts === 'number' ? authSection.maxLoginAttempts : 5,
    otpCode: typeof authSection.otpCode === 'string' ? authSection.otpCode : '123456',
  };

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

/**
 * Migrate users.json: add passwordHash for any user missing it.
 * Uses bcrypt with 12 rounds and the default password 'changeme2025!'.
 */
function _migrateUsersJson(filePath: string): void {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const users = JSON.parse(raw) as UserRecord[];

  let needsMigration = false;
  const migrated = users.map((user) => {
    if (!user.passwordHash) {
      needsMigration = true;
      const hash = bcrypt.hashSync('changeme2025!', 12);
      return { ...user, passwordHash: hash };
    }
    return user;
  });

  if (needsMigration) {
    _atomicWrite(filePath, JSON.stringify(migrated, null, 2));
    console.log('[initAuth] Migrated users.json: added bcrypt passwordHash for users without one');
  }
}
