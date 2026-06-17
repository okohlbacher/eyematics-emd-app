// @vitest-environment jsdom
/**
 * N7 (v1.19 WS-C): the theme selector is now a COLLAPSIBLE MENU, not a cycle.
 * The trigger opens a popover listing all three modes (Light / Dark / System),
 * each directly selectable via setTheme. The active mode is marked (aria-checked).
 * The menu closes on selection, outside-click and Escape. These tests replace the
 * retired themeCycle/nextTheme unit tests.
 */
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ThemeToggle } from '../src/components/ThemeToggle';
import { LanguageProvider } from '../src/context/LanguageContext';
import { ThemeProvider } from '../src/context/ThemeContext';

function renderToggle() {
  // Pin English so the menu labels are deterministic (LanguageProvider defaults to 'de').
  localStorage.setItem('emd-locale', 'en');
  return render(
    <LanguageProvider>
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    </LanguageProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('N7 — theme selector menu', () => {
  it('starts closed (no menu in the DOM)', () => {
    const { container } = renderToggle();
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('opens the menu listing all three options when the trigger is clicked', () => {
    const { container, getByRole } = renderToggle();
    fireEvent.click(getByRole('button', { name: 'Theme' }));
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    const items = container.querySelectorAll('[role="menuitemradio"]');
    expect(items.length).toBe(3);
  });

  it('marks the active option (System by default) as checked', () => {
    const { getByRole, getAllByRole } = renderToggle();
    fireEvent.click(getByRole('button', { name: 'Theme' }));
    const items = getAllByRole('menuitemradio');
    const checked = items.filter((el) => el.getAttribute('aria-checked') === 'true');
    expect(checked.length).toBe(1);
    expect(checked[0]!.textContent).toContain('System');
  });

  it('selecting Light persists light, marks it active, and closes the menu', () => {
    const { container, getByRole } = renderToggle();
    fireEvent.click(getByRole('button', { name: 'Theme' }));
    const menu = container.querySelector('[role="menu"]') as HTMLElement;
    fireEvent.click(within(menu).getByText('Light'));
    // menu closed after selection
    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(localStorage.getItem('emd-theme')).toBe('light');
    // re-open: Light is now the checked option
    fireEvent.click(getByRole('button', { name: 'Theme' }));
    const checked = container.querySelector('[role="menuitemradio"][aria-checked="true"]');
    expect(checked).not.toBeNull();
    expect(checked!.textContent).toContain('Light');
  });

  it('each option selects its own theme value', () => {
    for (const [label, expected] of [['Light', 'light'], ['Dark', 'dark'], ['System', 'system']] as const) {
      localStorage.clear();
      const { container, getByRole, unmount } = renderToggle();
      fireEvent.click(getByRole('button', { name: 'Theme' }));
      const menu = container.querySelector('[role="menu"]') as HTMLElement;
      fireEvent.click(within(menu).getByText(label));
      expect(localStorage.getItem('emd-theme')).toBe(expected);
      unmount();
    }
  });

  it('closes on Escape', () => {
    const { container, getByRole } = renderToggle();
    fireEvent.click(getByRole('button', { name: 'Theme' }));
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('closes on outside click', () => {
    const { container, getByRole } = renderToggle();
    fireEvent.click(getByRole('button', { name: 'Theme' }));
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});
