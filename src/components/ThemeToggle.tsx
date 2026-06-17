import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { useLanguage } from '../context/LanguageContext';
import { type Theme, useTheme } from '../context/ThemeContext';

const ICONS: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

// N7 (v1.19 WS-C): plain mode-name labels for the menu items (the older
// `themeLight`/`themeDark`/`themeSystem` keys read "switch to X", which is wrong
// wording for a directly-selectable list item).
const OPTION_LABEL_KEY: Record<Theme, 'themeLightOption' | 'themeDarkOption' | 'themeSystemOption'> = {
  light: 'themeLightOption',
  dark: 'themeDarkOption',
  system: 'themeSystemOption',
};

const OPTIONS: Theme[] = ['light', 'dark', 'system'];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const TriggerIcon = ICONS[theme];
  const triggerLabel = t(OPTION_LABEL_KEY[theme]);

  const select = (next: Theme) => {
    setTheme(next);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t('themeMenuLabel')}
        title={t('themeMenuLabel')}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[11px] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] rounded-md hover:bg-[var(--color-surface-2)] transition-colors"
      >
        <TriggerIcon className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="flex-1 text-left">{triggerLabel}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t('themeMenuLabel')}
          className="absolute bottom-full left-0 right-0 mb-1 z-10 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] py-1 shadow-lg"
        >
          {OPTIONS.map((option) => {
            const Icon = ICONS[option];
            const active = theme === option;
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => select(option)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 text-[11px] text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="flex-1 text-left">{t(OPTION_LABEL_KEY[option])}</span>
                {active && <Check className="w-3.5 h-3.5 text-[var(--color-ink)]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
