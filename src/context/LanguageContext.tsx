import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo,useState } from 'react';

import { type Locale, t as translate, type TranslationKey } from '../i18n/translations';

interface LanguageContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem('emd-locale');
    return (saved === 'en' || saved === 'de') ? saved : 'de';
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('emd-locale', l);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(key, locale),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
