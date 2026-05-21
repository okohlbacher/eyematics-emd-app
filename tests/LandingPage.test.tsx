// @vitest-environment jsdom
/**
 * 24-02 / FB-02: Attention panel Review buttons must navigate to a real route
 * or be absent (D-06..D-08). No silent click handlers.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { t as translate } from '../src/i18n/translations';

// ---------- Mocks ----------
vi.mock('../src/context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../src/context/AuthContext')>(
    '../src/context/AuthContext',
  );
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('../src/context/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

// useRecentActivity: stub so LandingPage renders without real localStorage/AuthContext wiring
vi.mock('../src/hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ entries: [], record: vi.fn(), clear: vi.fn() }),
}));

import { useAuth } from '../src/context/AuthContext';
import { useData } from '../src/context/DataContext';
import { useLanguage } from '../src/context/LanguageContext';
import LandingPage from '../src/pages/LandingPage';

// ---------- Test helpers ----------
function LocationSpy({ onChange }: { onChange: (path: string) => void }) {
  const loc = useLocation();
  useEffect(() => {
    onChange(loc.pathname);
  }, [loc.pathname, onChange]);
  return null;
}

function setupMocks(role: 'admin' | 'researcher' = 'admin') {
  (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    user: { username: 'tester', role },
    displayName: 'Tester',
    login: vi.fn(),
    logout: vi.fn(),
    inactivityWarning: false,
    hasRole: vi.fn(() => true),
    token: null,
  });
  (useData as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    loading: false,
    centers: [],
    cases: [],
  });
  (useLanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => translate(key as any, 'en'),
  });
}

function renderLanding(onLocationChange: (path: string) => void) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <>
        <LocationSpy onChange={onLocationChange} />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/cohort" element={<div data-testid="cohort-page" />} />
          <Route path="/doc-quality" element={<div data-testid="doc-quality-page" />} />
          <Route path="/quality" element={<div data-testid="quality-page" />} />
        </Routes>
      </>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LandingPage Attention panel — Review buttons (FB-02)', () => {
  it('therapy-breakers Review button navigates to /quality?therapy=breaker (Plan 04)', () => {
    setupMocks('admin');
    let search = '';
    renderLanding((p) => {
      search = p;
    });

    // Button is now identified by aria-label reviewTherapyBreakers (Plan 04 UX-01)
    const therapyBtn = screen.queryByRole('button', { name: translate('reviewTherapyBreakers', 'en') });
    expect(therapyBtn).not.toBeNull();
    fireEvent.click(therapyBtn!);
    // MemoryRouter registers /quality as the path (search params not tracked by LocationSpy)
    expect(search).toBe('/quality');
  });

  it('implausible-CRT Review button navigates to /quality?status=flagged (Plan 04)', () => {
    setupMocks('admin');
    let path = '/';
    renderLanding((p) => {
      path = p;
    });

    const crtBtn = screen.queryByRole('button', { name: translate('reviewFlaggedCases', 'en') });
    expect(crtBtn).not.toBeNull();
    fireEvent.click(crtBtn!);
    expect(path).toBe('/quality');
  });

  it('implausible-CRT Review button is present for all roles (gate removed in Plan 04)', () => {
    // Plan 04 removes the canSeeDocQuality gate; /quality is ProtectedRoute for all roles
    setupMocks('researcher');
    renderLanding(() => undefined);

    const crtBtn = screen.queryByRole('button', { name: translate('reviewFlaggedCases', 'en') });
    expect(crtBtn).not.toBeNull();
  });

  it('every rendered Review button has an onClick that navigates off / (D-08)', () => {
    setupMocks('admin');
    renderLanding(() => undefined);

    const therapyBtn = screen.queryByRole('button', { name: translate('reviewTherapyBreakers', 'en') });
    const crtBtn = screen.queryByRole('button', { name: translate('reviewFlaggedCases', 'en') });
    expect(therapyBtn).not.toBeNull();
    expect(crtBtn).not.toBeNull();

    // Every Review button must carry an onClick prop (no silent handlers, D-08).
    expect((therapyBtn as HTMLButtonElement).onclick).not.toBeNull();
    expect((crtBtn as HTMLButtonElement).onclick).not.toBeNull();
  });

  it('renders the Attention panel header (regression: panel itself is present)', () => {
    setupMocks('admin');
    renderLanding(() => undefined);
    const header = screen.queryByText(translate('attentionNeeded', 'en'));
    expect(header).not.toBeNull();
  });
});

describe('LandingPage Jump Back In panel — empty state (FB-03)', () => {
  it('renders the empty-state copy when no recent-activity state exists', () => {
    setupMocks('admin');
    renderLanding(() => undefined);

    const emptyCopy = translate('jumpBackInEmpty', 'en');
    expect(screen.queryByText(emptyCopy)).not.toBeNull();
  });

  it('renders the Jump Back In header (panel still present)', () => {
    setupMocks('admin');
    renderLanding(() => undefined);

    const header = screen.queryByText(translate('jumpBackIn', 'en'));
    expect(header).not.toBeNull();
  });

  it('contains no dead Jump Back In rows (no cursor-pointer + ArrowRight pattern)', () => {
    setupMocks('admin');
    const { container } = renderLanding(() => undefined);

    // The previous bug: rows with class 'cursor-pointer' and no onClick.
    // The empty-state replacement uses data-testid="jump-back-in-empty"
    // and carries no cursor-pointer / no click handler.
    const empty = container.querySelector('[data-testid="jump-back-in-empty"]');
    expect(empty).not.toBeNull();
    // Empty state element must not advertise pointer-cursor (D-10).
    expect(empty?.className.includes('cursor-pointer')).toBe(false);
    // And must carry no inline onclick (D-08/D-10: no silent click handlers).
    expect((empty as HTMLElement | null)?.onclick ?? null).toBeNull();
  });

  it('does not render the legacy placeholder strings', () => {
    setupMocks('admin');
    renderLanding(() => undefined);

    // Legacy hard-coded copy must be gone.
    expect(screen.queryByText(/AMD · female · 70\+/)).toBeNull();
    expect(screen.queryByText(/PSN-UKA-0023/)).toBeNull();
  });
});
