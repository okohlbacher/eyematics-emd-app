import { Monitor, Moon, Sun } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import { type Theme, useTheme } from '../context/ThemeContext';

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

// aria-label / icon describe the mode the click will switch TO (UI-SPEC D-09).
const LABEL_KEY: Record<Theme, 'themeLight' | 'themeDark' | 'themeSystem'> = {
  light: 'themeLight',
  dark: 'themeDark',
  system: 'themeSystem',
};

// Base cycle order; the toggle visits Light → Dark → System and wraps.
const ORDER: Theme[] = ['light', 'dark', 'system'];

/** Effective appearance a mode renders as, given the OS resolution. */
function appearance(theme: Theme, systemTheme: 'light' | 'dark'): 'light' | 'dark' {
  return theme === 'system' ? systemTheme : theme;
}

/**
 * M11 (v1.18): pick the next mode in the cycle whose APPEARANCE differs from the
 * current effective appearance, so a click is never a visual no-op.
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

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const { t } = useLanguage();
  const next = nextTheme(theme, systemTheme);
  const Icon = ICONS[next];
  const label = t(LABEL_KEY[next]);
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={label}
      aria-label={label}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-slate-400 hover:text-white transition-colors rounded hover:bg-slate-700/50"
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
