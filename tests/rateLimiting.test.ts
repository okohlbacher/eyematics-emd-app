import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRateLimiter } from '../server/rateLimiting.js';

describe('Rate Limiting (USER-13)', () => {
  const DEFAULT_MAX = 5;

  describe('with maxLoginAttempts=5', () => {
    let limiter: ReturnType<typeof createRateLimiter>;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      limiter = createRateLimiter(DEFAULT_MAX);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns zero state for unknown user', () => {
      const state = limiter.getLockState('alice');
      expect(state.count).toBe(0);
      expect(state.lockedUntil).toBe(0);
    });

    it('increments count on failure', () => {
      const state = limiter.recordFailure('alice');
      expect(state.count).toBe(1);
    });

    it('does not lock before reaching maxLoginAttempts', () => {
      for (let i = 0; i < DEFAULT_MAX - 1; i++) {
        limiter.recordFailure('alice');
      }
      const state = limiter.getLockState('alice');
      expect(state.count).toBe(DEFAULT_MAX - 1);
      expect(limiter.isLocked(state)).toBe(false);
    });

    it('locks account after maxLoginAttempts consecutive failures', () => {
      let state;
      for (let i = 0; i < DEFAULT_MAX; i++) {
        state = limiter.recordFailure('alice');
      }
      expect(state!.count).toBe(DEFAULT_MAX);
      expect(limiter.isLocked(state!)).toBe(true);
      expect(state!.lockedUntil).toBeGreaterThan(Date.now());
    });

    it('applies exponential backoff on lock (deterministic with fake timers)', () => {
      // Addresses Codex review: use vi.useFakeTimers() for deterministic backoff
      const now = Date.now();
      let state;
      for (let i = 0; i < DEFAULT_MAX; i++) {
        state = limiter.recordFailure('alice');
      }
      // After 5 failures: lockedUntil = now + 2^5 * 1000 = now + 32000
      const expectedBackoff = Math.pow(2, DEFAULT_MAX) * 1000;
      expect(state!.lockedUntil).toBe(now + expectedBackoff);
    });

    it('resets attempts on successful login', () => {
      for (let i = 0; i < 3; i++) {
        limiter.recordFailure('alice');
      }
      limiter.resetAttempts('alice');
      const state = limiter.getLockState('alice');
      expect(state.count).toBe(0);
      expect(state.lockedUntil).toBe(0);
    });

    it('isLocked returns false when lockedUntil is in the past', () => {
      const pastState = { count: 5, lockedUntil: Date.now() - 1000 };
      expect(limiter.isLocked(pastState)).toBe(false);
    });

    it('unlocks after backoff period elapses', () => {
      for (let i = 0; i < DEFAULT_MAX; i++) {
        limiter.recordFailure('alice');
      }
      const state = limiter.getLockState('alice');
      expect(limiter.isLocked(state)).toBe(true);

      // Advance time past the backoff period
      vi.advanceTimersByTime(Math.pow(2, DEFAULT_MAX) * 1000 + 1);
      expect(limiter.isLocked(state)).toBe(false);
    });
  });

  describe('configurable maxLoginAttempts', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('locks after 3 failures when maxLoginAttempts=3', () => {
      const limiter = createRateLimiter(3);
      for (let i = 0; i < 3; i++) {
        limiter.recordFailure('bob');
      }
      const state = limiter.getLockState('bob');
      expect(limiter.isLocked(state)).toBe(true);
    });

    it('does not lock after 3 failures when maxLoginAttempts=10', () => {
      const limiter = createRateLimiter(10);
      for (let i = 0; i < 3; i++) {
        limiter.recordFailure('bob');
      }
      const state = limiter.getLockState('bob');
      expect(limiter.isLocked(state)).toBe(false);
    });
  });
});
