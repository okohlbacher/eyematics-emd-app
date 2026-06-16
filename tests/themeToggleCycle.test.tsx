// @vitest-environment jsdom
/**
 * M11 (v1.18, round-6 decision): the theme toggle uses the CANONICAL cycle
 * Light → Dark → System → Light. Chosen over a "skip-the-redundant-step" rule
 * because the latter stranded a mode (System became unreachable under a dark OS).
 * Every mode must be reachable by clicking from any state, under either OS
 * resolution. One adjacency per OS is a visual no-op (System next to the matching
 * explicit mode); that is the accepted trade-off for guaranteed reachability.
 */
import { describe, expect, it } from 'vitest';

import { nextTheme } from '../src/components/themeCycle';
import type { Theme } from '../src/context/ThemeContext';

describe('M11 — canonical theme cycle (all modes reachable)', () => {
  const modes: Theme[] = ['light', 'dark', 'system'];
  const resolutions: Array<'light' | 'dark'> = ['light', 'dark'];

  it('cycles Light → Dark → System → Light', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
    expect(nextTheme('system')).toBe('light');
  });

  it('is independent of the OS resolution (canonical order)', () => {
    for (const sys of resolutions) {
      expect(nextTheme('light', sys)).toBe('dark');
      expect(nextTheme('dark', sys)).toBe('system');
      expect(nextTheme('system', sys)).toBe('light');
    }
  });

  it('reaches ALL three modes by repeated clicking from EVERY start, under EITHER OS', () => {
    for (const sys of resolutions) {
      for (const start of modes) {
        const seen = new Set<Theme>();
        let cur = start;
        for (let i = 0; i < 3; i++) {
          cur = nextTheme(cur, sys);
          seen.add(cur);
        }
        // Three clicks from any start must visit all three modes (no trap state).
        expect(seen.has('light')).toBe(true);
        expect(seen.has('dark')).toBe(true);
        expect(seen.has('system')).toBe(true);
      }
    }
  });

  it('never returns the same mode it was given', () => {
    for (const theme of modes) {
      expect(nextTheme(theme)).not.toBe(theme);
    }
  });
});
