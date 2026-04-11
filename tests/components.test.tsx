// @vitest-environment jsdom
/**
 * T-10: React component tests — ErrorBoundary, CustomTooltip, MetricCard.
 *
 * Uses jsdom environment via per-file docblock.
 * Tests core UI components that are self-contained (no complex context dependencies).
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ErrorBoundary from '../src/components/ErrorBoundary';
import { CustomTooltip } from '../src/components/doc-quality/CustomTooltip';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">OK</div>
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeDefined();
    expect(screen.getByTestId('child').textContent).toBe('OK');
  });

  it('renders error UI when child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bomb(): JSX.Element {
      throw new Error('Test explosion');
    }
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Test explosion')).toBeDefined();
    // Should show a reload button
    expect(screen.getByRole('button')).toBeDefined();
    spy.mockRestore();
  });

  it('shows German text when navigator.language is de', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const langSpy = vi.spyOn(navigator, 'language', 'get').mockReturnValue('de-DE');
    function Bomb(): JSX.Element {
      throw new Error('Fehler');
    }
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Anwendungsfehler')).toBeDefined();
    expect(screen.getByText('Neu laden')).toBeDefined();
    langSpy.mockRestore();
    spy.mockRestore();
  });

  it('shows English text when navigator.language is en', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const langSpy = vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    function Bomb(): JSX.Element {
      throw new Error('Boom');
    }
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Application Error')).toBeDefined();
    expect(screen.getByText('Reload')).toBeDefined();
    langSpy.mockRestore();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// CustomTooltip
// ---------------------------------------------------------------------------

describe('CustomTooltip', () => {
  it('renders null when not active', () => {
    const { container } = render(<CustomTooltip active={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders null when payload is empty', () => {
    const { container } = render(<CustomTooltip active={true} payload={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders label and entries when active with payload', () => {
    const payload = [
      { name: 'Completeness', value: 85.7, color: '#3b82f6' },
      { name: 'Plausibility', value: 92.1, color: '#10b981' },
    ];
    render(<CustomTooltip active={true} payload={payload} label="UKA" />);
    expect(screen.getByText('UKA')).toBeDefined();
    expect(screen.getByText('Completeness:')).toBeDefined();
    expect(screen.getByText('86%')).toBeDefined(); // Math.round(85.7)
    expect(screen.getByText('Plausibility:')).toBeDefined();
    expect(screen.getByText('92%')).toBeDefined();
  });
});
