/**
 * Rate limiting module -- extracted from authApi.ts for testability (D-05).
 *
 * Provides a factory function that creates a rate limiter instance
 * with configurable maxLoginAttempts. The limiter tracks failed login
 * attempts per username with exponential backoff lockout.
 */

export interface LockState {
  count: number;
  lockedUntil: number;
}

export function createRateLimiter(maxLoginAttempts: number) {
  const loginAttempts = new Map<string, LockState>();

  function getLockState(username: string): LockState {
    return loginAttempts.get(username) ?? { count: 0, lockedUntil: 0 };
  }

  function isLocked(state: LockState): boolean {
    return state.lockedUntil > Date.now();
  }

  function recordFailure(username: string): LockState {
    const state = getLockState(username);
    const newCount = state.count + 1;
    const lockedUntil = newCount >= maxLoginAttempts
      ? Date.now() + Math.pow(2, newCount) * 1000
      : 0;
    const newState: LockState = { count: newCount, lockedUntil };
    loginAttempts.set(username, newState);
    return newState;
  }

  function resetAttempts(username: string): void {
    loginAttempts.delete(username);
  }

  // L-09: periodic cleanup of stale entries to prevent unbounded memory growth
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
  setInterval(() => {
    const cutoff = Date.now() - STALE_THRESHOLD;
    for (const [username, state] of loginAttempts) {
      if (state.lockedUntil < cutoff && state.lockedUntil > 0) {
        loginAttempts.delete(username);
      }
    }
  }, CLEANUP_INTERVAL).unref();

  return { getLockState, isLocked, recordFailure, resetAttempts };
}
