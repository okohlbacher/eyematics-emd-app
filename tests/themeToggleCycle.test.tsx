// @vitest-environment jsdom
/**
 * M11 (v1.18): the theme cycle must never produce a step whose appearance
 * equals the current effective appearance — a click is never a visual no-op.
 *
 * From System-resolving-to-light the next step goes straight to Dark (skipping
 * the redundant explicit Light); from System-resolving-to-dark it goes straight
 * to Light. All three modes remain reachable via the appropriate states.
 */
import { describe, expect, it } from 'vitest';

import { nextTheme } from '../src/components/ThemeToggle';
import type { Theme } from '../src/context/ThemeContext';

/** Appearance a mode renders as, mirroring the toggle's own resolution. */
function appearance(theme: Theme, systemTheme: 'light' | 'dark'): 'light' | 'dark' {
  return theme === 'system' ? systemTheme : theme;
}

describe('M11 — nextTheme never produces a visually identical step', () => {
  const modes: Theme[] = ['light', 'dark', 'system'];
  const resolutions: Array<'light' | 'dark'> = ['light', 'dark'];

  it('the next step always changes the effective appearance', () => {
    for (const sys of resolutions) {
      for (const theme of modes) {
        const next = nextTheme(theme, sys);
        expect(appearance(next, sys)).not.toBe(appearance(theme, sys));
      }
    }
  });

  it('System resolving to light skips the redundant Light step → goes to Dark', () => {
    expect(nextTheme('system', 'light')).toBe('dark');
  });

  it('System resolving to dark skips the redundant Dark step → goes to Light', () => {
    expect(nextTheme('system', 'dark')).toBe('light');
  });

  it('Light always advances to Dark (different appearance under either OS resolution)', () => {
    expect(nextTheme('light', 'light')).toBe('dark');
    expect(nextTheme('light', 'dark')).toBe('dark');
  });

  it('Dark advances to System when System would look light, else to Light', () => {
    // OS light: System looks light ≠ dark → reachable as the next step.
    expect(nextTheme('dark', 'light')).toBe('system');
    // OS dark: System would look dark (no-op) → skip to explicit Light.
    expect(nextTheme('dark', 'dark')).toBe('light');
  });

  it('every mode is the next target from some (theme, OS) combination', () => {
    const targets = new Set<Theme>();
    for (const sys of resolutions) {
      for (const theme of modes) {
        targets.add(nextTheme(theme, sys));
      }
    }
    expect(targets.has('light')).toBe(true);
    expect(targets.has('dark')).toBe(true);
    expect(targets.has('system')).toBe(true);
  });

  it('never returns the same mode it was given', () => {
    for (const sys of resolutions) {
      for (const theme of modes) {
        expect(nextTheme(theme, sys)).not.toBe(theme);
      }
    }
  });
});
