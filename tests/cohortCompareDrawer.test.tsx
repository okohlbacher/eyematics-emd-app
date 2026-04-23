// @vitest-environment jsdom
import { cleanup,fireEvent, render, screen } from '@testing-library/react';
import { afterEach,describe, expect, it, vi } from 'vitest';

afterEach(cleanup);
import CohortCompareDrawer from '../src/components/outcomes/CohortCompareDrawer';

/**
 * Phase 16 Plan 03 — XCOHORT-01, XCOHORT-03 drawer tests.
 *
 * Tests the CohortCompareDrawer component behaviour:
 * primary cohort always checked+disabled, max-4 enforcement,
 * patient-count label format, onChange/onReset callbacks.
 */
describe('CohortCompareDrawer (Wave 0 scaffold)', () => {
  const primaryId = 'p1';
  const savedSearches = [
    { id: 'p1', name: 'Cohort A', createdAt: '2026-01-01', filters: {} },
    { id: 'p2', name: 'Cohort B', createdAt: '2026-01-02', filters: {} },
    { id: 'p3', name: 'Cohort C', createdAt: '2026-01-03', filters: {} },
    { id: 'p4', name: 'Cohort D', createdAt: '2026-01-04', filters: {} },
    { id: 'p5', name: 'Cohort E', createdAt: '2026-01-05', filters: {} },
  ];

  const renderDrawer = (selected: string[]) => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const onClose = vi.fn();
    const patientCounts = { p1: 42, p2: 17, p3: 8, p4: 5, p5: 3 };
    const utils = render(
      <CohortCompareDrawer
        open
        onClose={onClose}
        savedSearches={savedSearches}
        patientCounts={patientCounts}
        primaryCohortId={primaryId}
        selectedIds={selected}
        onChange={onChange}
        onReset={onReset}
        t={(k) => k}
      />
    );
    return { ...utils, onChange, onReset, onClose };
  };

  it('XCOHORT-01: primary cohort checkbox is checked and disabled', () => {
    renderDrawer(['p1']);
    const primary = screen.getByLabelText(/Cohort A \(N=42 patients\)/i) as HTMLInputElement;
    expect(primary.checked).toBe(true);
    expect(primary.disabled).toBe(true);
  });

  it('XCOHORT-01: max 4 cohorts — 5th checkbox is disabled when 4 already selected', () => {
    renderDrawer(['p1', 'p2', 'p3', 'p4']);
    const fifth = screen.getByLabelText(/Cohort E \(N=3 patients\)/i) as HTMLInputElement;
    expect(fifth.disabled).toBe(true);
    expect(fifth.checked).toBe(false);
  });

  it('XCOHORT-03: displays patient count next to each cohort name', () => {
    renderDrawer(['p1']);
    expect(screen.getByText(/Cohort B \(N=17 patients\)/i)).toBeTruthy();
  });

  it('onChange fires with id removed when a selected non-primary cohort is unchecked', () => {
    const { onChange } = renderDrawer(['p1', 'p2']);
    const b = screen.getByLabelText(/Cohort B \(N=17 patients\)/i) as HTMLInputElement;
    fireEvent.click(b);
    expect(onChange).toHaveBeenCalledWith(['p1']);
  });

  it('onReset fires when the footer link is clicked', () => {
    const { onReset } = renderDrawer(['p1']);
    fireEvent.click(screen.getByText(/outcomesCompareReset/i));
    expect(onReset).toHaveBeenCalled();
  });
});
