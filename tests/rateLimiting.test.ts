/**
 * T-03: Tests for rateLimiting.ts — lockout, backoff cap, cleanup.
 */

import { describe, expect, it, vi } from 'vitest';

import { createRateLimiter } from '../server/rateLimiting';

describe('rateLimiting', () => {
  describe('basic lockout', () => {
    it('does not lock before maxLoginAttempts', () => {
      const limiter = createRateLimiter(3);
      const s1 = limiter.recordFailure('user1');
      expect(limiter.isLocked(s1)).toBe(false);
      const s2 = limiter.recordFailure('user1');
      expect(limiter.isLocked(s2)).toBe(false);
    });

    it('locks at maxLoginAttempts', () => {
      const limiter = createRateLimiter(3);
      limiter.recordFailure('user1');
      limiter.recordFailure('user1');
      const s3 = limiter.recordFailure('user1');
      expect(limiter.isLocked(s3)).toBe(true);
      expect(s3.lockedUntil).toBeGreaterThan(Date.now());
    });

    it('locks at maxLoginAttempts=1', () => {
      const limiter = createRateLimiter(1);
      const s = limiter.recordFailure('user1');
      expect(limiter.isLocked(s)).toBe(true);
    });

    it('tracks users independently', () => {
      const limiter = createRateLimiter(2);
      limiter.recordFailure('user1');
      const s = limiter.recordFailure('user2');
      expect(s.count).toBe(1);
      expect(limiter.isLocked(s)).toBe(false);
    });
  });

  describe('resetAttempts', () => {
    it('clears state for a user', () => {
      const limiter = createRateLimiter(2);
      limiter.recordFailure('user1');
      limiter.recordFailure('user1');
      limiter.resetAttempts('user1');
      const state = limiter.getLockState('user1');
      expect(state.count).toBe(0);
      expect(state.lockedUntil).toBe(0);
    });

    it('does not affect other users', () => {
      const limiter = createRateLimiter(2);
      limiter.recordFailure('user1');
      limiter.recordFailure('user2');
      limiter.resetAttempts('user1');
      expect(limiter.getLockState('user2').count).toBe(1);
    });
  });

  describe('backoff cap', () => {
    it('caps lockout at 1 hour regardless of failure count', () => {
      const limiter = createRateLimiter(1);
      let state = limiter.recordFailure('user1');
      for (let i = 0; i < 50; i++) {
        state = limiter.recordFailure('user1');
      }
      const duration = state.lockedUntil - Date.now();
      expect(duration).toBeLessThanOrEqual(3_600_000);
      expect(duration).toBeGreaterThan(0);
    });

    it('lockout increases with each failure up to cap', () => {
      const limiter = createRateLimiter(1);
      const s1 = limiter.recordFailure('a');
      const d1 = s1.lockedUntil - Date.now();

      const limiter2 = createRateLimiter(1);
      limiter2.recordFailure('b');
      limiter2.recordFailure('b');
      const s2 = limiter2.recordFailure('b');
      const d2 = s2.lockedUntil - Date.now();

      // More failures should mean longer lockout (up to cap)
      expect(d2).toBeGreaterThanOrEqual(d1);
    });
  });

  describe('lastActivity tracking', () => {
    it('sets lastActivity on recordFailure', () => {
      const limiter = createRateLimiter(5);
      const before = Date.now();
      const state = limiter.recordFailure('user1');
      expect(state.lastActivity).toBeGreaterThanOrEqual(before);
      expect(state.lastActivity).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('getLockState', () => {
    it('returns default for unknown user', () => {
      const limiter = createRateLimiter(5);
      const state = limiter.getLockState('unknown');
      expect(state.count).toBe(0);
      expect(state.lockedUntil).toBe(0);
      expect(state.lastActivity).toBe(0);
    });
  });

  describe('isLocked', () => {
    it('returns false when lockedUntil is in the past', () => {
      const limiter = createRateLimiter(5);
      expect(limiter.isLocked({ count: 5, lockedUntil: Date.now() - 1000, lastActivity: 0 })).toBe(false);
    });

    it('returns true when lockedUntil is in the future', () => {
      const limiter = createRateLimiter(5);
      expect(limiter.isLocked({ count: 5, lockedUntil: Date.now() + 60000, lastActivity: 0 })).toBe(true);
    });
  });
});
