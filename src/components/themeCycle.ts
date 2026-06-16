/** M11 (v1.18): pure theme-cycle logic, split out of ThemeToggle so the
 *  component file only exports a component (react-refresh/only-export-components)
 *  and the cycle rule stays unit-testable in isolation. */
import type { Theme } from '../context/ThemeContext';

// Canonical cycle order: Light → Dark → System → (Light). Every mode is reachable
// from every state by clicking.
const ORDER: Theme[] = ['light', 'dark', 'system'];

/**
 * The next mode in the canonical Light → Dark → System cycle.
 *
 * Round-6 decision: a 3-mode toggle cannot both "never produce a visually-identical
 * step" AND keep all three modes reachable from a single forward cycle — System is
 * always adjacent to whichever explicit mode matches the current OS appearance, so one
 * adjacency per OS is unavoidably a visual no-op. We choose ALL-REACHABLE over
 * no-op-free: every mode (Light, Dark, System) is reachable by clicking under both OS
 * resolutions. (The earlier "skip the redundant step" rule stranded System under a dark
 * OS — a worse defect than a single semantic-only step.) `systemTheme` is accepted for
 * signature stability but no longer affects the order.
 */
export function nextTheme(theme: Theme, _systemTheme?: 'light' | 'dark'): Theme {
  const start = ORDER.indexOf(theme);
  // Unknown theme → start the cycle at Light.
  if (start === -1) return 'light';
  return ORDER[(start + 1) % ORDER.length]!;
}
