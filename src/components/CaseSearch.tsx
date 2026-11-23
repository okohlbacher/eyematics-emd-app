// Z0-P18 — "Fall öffnen (Pseudonym)": case search in the sidebar navigation (combobox ARIA pattern).
// Suggestions come from DataContext `cases`, which the server already restricts to the user's sites (EMDREQ-USM-004).
// Matching: case-insensitive substring; all matches, sorted by match score descending (exact > prefix > substring),
// ties by pseudonym (Q15 b). Each settled search is written to the audit log via the view-open beacon (Q15 c); the
// beacon carries only the query length and the match count, no pseudonym (auditApi.ts IN-02: no identifiers).
import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { authFetch } from '../services/authHeaders';
import type { PatientCase } from '../types/fhir';

const AUDIT_DEBOUNCE_MS = 600;

function matchScore(pseudonym: string, query: string): number {
  const p = pseudonym.toLowerCase();
  if (p === query) return 3;
  if (p.startsWith(query)) return 2;
  return p.includes(query) ? 1 : 0;
}

function findCases(cases: PatientCase[], raw: string): PatientCase[] {
  const query = raw.trim().toLowerCase();
  if (!query) return [];
  return cases
    .map((c) => ({ c, score: matchScore(c.pseudonym, query) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.c.pseudonym.localeCompare(b.c.pseudonym))
    .map((m) => m.c);
}

async function auditSearch(queryLength: number, matchCount: number): Promise<void> {
  try {
    await authFetch('/api/audit/events/view-open', {
      method: 'POST',
      body: JSON.stringify({ name: 'case_search', filter: { queryLength, matchCount } }),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'include',
    });
  } catch {
    /* beacon is fire-and-forget (D-03) */
  }
}

export default function CaseSearch() {
  const { cases } = useData();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const auditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAudit = useRef<{ length: number; count: number } | null>(null);
  const { pathname } = useLocation();
  const [searchPath, setSearchPath] = useState(pathname);

  const matches = useMemo(() => findCases(cases, query), [cases, query]);
  const expanded = open && query.trim().length > 0;

  /** Writes the pending search row now (choosing a case or leaving the page ends the search). */
  const flushAudit = () => {
    if (auditTimer.current) clearTimeout(auditTimer.current);
    auditTimer.current = null;
    const pending = pendingAudit.current;
    pendingAudit.current = null;
    if (pending) void auditSearch(pending.length, pending.count);
  };

  // Leaving the page ends the search: flush its row. Declared before the effect below, so it runs before that effect
  // drops the pending row for the emptied field.
  useEffect(() => { flushAudit(); }, [pathname]);

  // Audit one row per search: written once typing settles, or earlier when the search ends (flushAudit). The timer
  // is cleared on every change and on unmount (logout), so nothing outlives the component.
  useEffect(() => {
    const length = query.trim().length;
    pendingAudit.current = length === 0 ? null : { length, count: matches.length };
    if (length === 0) return undefined;
    auditTimer.current = setTimeout(flushAudit, AUDIT_DEBOUNCE_MS);
    return () => {
      if (auditTimer.current) clearTimeout(auditTimer.current);
      auditTimer.current = null;
    };
  }, [query, matches.length]);

  // AT-FALL-002-01: no typed pseudonym survives navigation (any route change, not only choosing a suggestion).
  // Reset during render on a route change (React "adjusting state when a prop changes"); the search row is flushed
  // by the pathname effect above.
  if (searchPath !== pathname) {
    setSearchPath(pathname);
    setQuery('');
    setOpen(false);
    setActive(-1);
  }

  const choose = (c: PatientCase) => {
    flushAudit();
    // AT-FALL-002-01: the pseudonym must not remain in the field after navigation.
    setQuery('');
    setOpen(false);
    setActive(-1);
    navigate(`/case/${encodeURIComponent(c.id)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (matches.length === 0 ? -1 : Math.min(i + 1, matches.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const target = matches[active] ?? (matches.length === 1 ? matches[0] : undefined);
      if (expanded && target) {
        e.preventDefault();
        choose(target);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div className="relative px-0.5 pb-3">
      <label htmlFor={`${listId}-input`} className="sr-only">{t('caseSearchLabel')}</label>
      <div className="relative">
        <Search
          className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-ink-3)] pointer-events-none"
          aria-hidden="true"
        />
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && active >= 0 && active < matches.length ? optionId(active) : undefined}
          placeholder={t('caseSearchLabel')}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="w-full pl-7 pr-2 py-1.5 text-[12px] rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] focus:outline-none focus:ring-1 focus:ring-[var(--color-teal)]"
        />
      </div>
      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('caseSearchLabel')}
          className="absolute left-0.5 right-0.5 z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-lg py-1"
        >
          {matches.length === 0 ? (
            <li role="option" aria-selected={false} aria-disabled="true" className="px-2.5 py-1.5 text-[12px] text-[var(--color-ink-3)]">
              {t('caseSearchNoResult')}
            </li>
          ) : (
            matches.map((c, i) => (
              <li
                key={c.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                // mousedown: choose before the input's blur closes the list.
                onMouseDown={(e) => { e.preventDefault(); choose(c); }}
                className={`px-2.5 py-1.5 text-[12px] cursor-pointer text-[var(--color-ink)] ${i === active ? 'bg-[var(--color-surface-2)]' : 'hover:bg-[var(--color-surface-2)]'}`}
              >
                {c.pseudonym}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
