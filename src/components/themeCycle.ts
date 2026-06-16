/** M11 (v1.18): pure theme-cycle logic, split out of ThemeToggle so the
 *  component file only exports a component (react-refresh/only-export-components)
 *  and the cycle rule stays unit-testable in isolation. */
import type { Theme } from '../context/ThemeContext';

// Base cycle order; the toggle visits Light → Dark → System and wraps.
const ORDER: Theme[] = ['light', 'dark', 'system'];

/** Effective appearance a mode renders as, given the OS resolution. */
function appearance(theme: Theme, systemTheme: 'light' | 'dark'): 'light' | 'dark' {
  return theme === 'system' ? systemTheme : theme;
}

/**
 * Pick the next mode in the cycle whose APPEARANCE differs from the current
 * effective appearance, so a click is never a visual no-op.
 *
 * On System-resolving-to-light the plain next step (Light) would look identical,
 * so we skip straight to Dark; on System-resolving-to-dark we skip straight to
 * Light. All three modes stay reachable (Light→Dark, Dark→System or Light when
 * System==dark, System→the opposite explicit mode).
 */
export function nextTheme(theme: Theme, systemTheme: 'light' | 'dark'): Theme {
  const current = appearance(theme, systemTheme);
  const start = ORDER.indexOf(theme);
  for (let step = 1; step <= ORDER.length; step++) {
    const candidate = ORDER[(start + step) % ORDER.length]!;
    if (candidate !== theme && appearance(candidate, systemTheme) !== current) {
      return candidate;
    }
  }
  // Fallback (only when every candidate matches the current appearance): plain next.
  return ORDER[(start + 1) % ORDER.length]!;
}
