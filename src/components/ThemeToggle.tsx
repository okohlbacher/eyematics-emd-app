import { Monitor, Moon, Sun } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import { type Theme, useTheme } from '../context/ThemeContext';
import { nextTheme } from './themeCycle';

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

// aria-label / icon describe the mode the click will switch TO (UI-SPEC D-09).
const LABEL_KEY: Record<Theme, 'themeLight' | 'themeDark' | 'themeSystem'> = {
  light: 'themeLight',
  dark: 'themeDark',
  system: 'themeSystem',
};

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
