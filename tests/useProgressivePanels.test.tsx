// @vitest-environment jsdom
/**
 * J2 (v1.15-p4) — progressive panel mount.
 *
 * The hook mounts N panels ONE AT A TIME on later macrotasks when staging is
 * active (heavy single-cohort render), and mounts all N at once when inactive
 * (small cohort / cross-mode), so the main thread yields between Recharts builds.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProgressivePanels } from '../src/components/outcomes/useProgressivePanels';

describe('useProgressivePanels', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('mounts all panels at once when staging is inactive', () => {
    const { result } = renderHook(() => useProgressivePanels(3, false, 'k'));
    expect(result.current).toBe(3);
  });

  it('mounts one panel first, then stages the rest on later macrotasks', () => {
    const { result } = renderHook(() => useProgressivePanels(3, true, 'k'));
    // First paint: only one panel mounted.
    expect(result.current).toBe(1);
    // Each macrotask mounts the next.
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe(2);
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe(3);
    // No further growth past the count.
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe(3);
  });

  it('re-arms staging (drops back to 1) when the stage key changes', () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useProgressivePanels(3, true, key),
      { initialProps: { key: 'a' } },
    );
    act(() => { vi.advanceTimersByTime(0); });
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe(3);
    // New cohort/metric/layers → restart staging from one panel.
    rerender({ key: 'b' });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(0); });
    expect(result.current).toBe(2);
  });
});
