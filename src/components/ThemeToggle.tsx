import { Monitor, Moon, Sun } from 'lucide-react';

import { useLanguage } from '../context/LanguageContext';
import { type Theme, useTheme } from '../context/ThemeContext';

const CYCLE: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

// aria-label is set to the i18n string for the NEXT mode (UI-SPEC D-09)
// When current is Light, next = Dark, label = t('themeDark') = 'Switch to dark mode'
const NEXT_LABEL_KEY: Record<Theme, 'themeLight' | 'themeDark' | 'themeSystem'> = {
  light: 'themeDark',    // next is dark
  dark: 'themeSystem',   // next is system
  system: 'themeLight',  // next is light
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const Icon = ICONS[theme];
  const nextTheme = CYCLE[theme];
  const label = t(NEXT_LABEL_KEY[theme]);
  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      title={label}
      aria-label={label}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-slate-400 hover:text-white transition-colors rounded hover:bg-slate-700/50"
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
