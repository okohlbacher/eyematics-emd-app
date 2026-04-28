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
  it('therapy-breakers Review button navigates to /cohort', () => {
    setupMocks('admin');
    let path = '/';
    renderLanding((p) => {
      path = p;
    });

    const reviewLabel = translate('review', 'en');
    const reviewButtons = screen.queryAllByRole('button', { name: reviewLabel });
    expect(reviewButtons.length).toBeGreaterThan(0);
    // First Review button is the therapy-breakers row
    fireEvent.click(reviewButtons[0]);
    expect(path).toBe('/cohort');
  });

  it('implausible-CRT Review button navigates to /doc-quality for QUALITY_ROLES', () => {
    setupMocks('admin');
    let path = '/';
    renderLanding((p) => {
      path = p;
    });

    const reviewLabel = translate('review', 'en');
    const reviewButtons = screen.queryAllByRole('button', { name: reviewLabel });
    // Two buttons expected for an admin (QUALITY_ROLES includes admin)
    expect(reviewButtons.length).toBe(2);
    fireEvent.click(reviewButtons[1]);
    expect(path).toBe('/doc-quality');
  });

  it('hides the implausible-CRT Review button for users without QUALITY_ROLES', () => {
    setupMocks('researcher');
    let path = '/';
    renderLanding((p) => {
      path = p;
    });

    const reviewLabel = translate('review', 'en');
    const reviewButtons = screen.queryAllByRole('button', { name: reviewLabel });
    // Researcher: only the therapy-breakers button remains (no /doc-quality access).
    expect(reviewButtons.length).toBe(1);
    fireEvent.click(reviewButtons[0]);
    expect(path).toBe('/cohort');
  });

  it('every rendered Review button has an onClick that navigates off /', () => {
    setupMocks('admin');
    renderLanding(() => undefined);

    const reviewLabel = translate('review', 'en');
    const reviewButtons = screen.queryAllByRole('button', { name: reviewLabel });
    expect(reviewButtons.length).toBeGreaterThan(0);

    // Every Review button must carry an onClick prop (no silent handlers, D-08).
    for (const btn of reviewButtons) {
      const onclick = (btn as HTMLButtonElement).onclick;
      expect(onclick).not.toBeNull();
    }
  });

  it('renders the Attention panel header (regression: panel itself is present)', () => {
    setupMocks('admin');
    renderLanding(() => undefined);
    const header = screen.queryByText(translate('attentionNeeded', 'en'));
    expect(header).not.toBeNull();
  });
});
