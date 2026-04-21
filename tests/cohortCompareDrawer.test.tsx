// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// Plan 03 will create this component; until then the import is a scaffold.
// import CohortCompareDrawer from '../src/components/outcomes/CohortCompareDrawer';

/**
 * Phase 16 Wave-0 scaffold for XCOHORT-01, XCOHORT-03.
 *
 * These tests describe behaviour that Plan 03 (CohortCompareDrawer) must
 * satisfy. The block is `describe.skip` so the file runs cleanly during
 * Wave 1 and 2; Plan 03 flips it to `describe` as part of delivery.
 */
describe.skip('CohortCompareDrawer (Wave 0 scaffold)', () => {
  const primaryId = 'p1';
  const savedSearches = [
    { id: 'p1', name: 'Cohort A', createdAt: '2026-01-01', filters: {} },
    { id: 'p2', name: 'Cohort B', createdAt: '2026-01-02', filters: {} },
    { id: 'p3', name: 'Cohort C', createdAt: '2026-01-03', filters: {} },
    { id: 'p4', name: 'Cohort D', createdAt: '2026-01-04', filters: {} },
    { id: 'p5', name: 'Cohort E', createdAt: '2026-01-05', filters: {} },
  ];

  const renderDrawer = (_selected: string[]) => {
    // render(<CohortCompareDrawer open primaryCohortId={primaryId}
    //   savedSearches={savedSearches} selectedIds={_selected}
    //   onChange={() => {}} onClose={() => {}} t={(k) => k} />);
  };

  it('XCOHORT-01: primary cohort checkbox is checked and disabled', () => {
    renderDrawer([primaryId]);
    const primary = screen.getByLabelText(/Cohort A/i) as HTMLInputElement;
    expect(primary.checked).toBe(true);
    expect(primary.disabled).toBe(true);
  });

  it('XCOHORT-01: max 4 cohorts — 5th checkbox is disabled when 4 already selected', () => {
    renderDrawer(['p1', 'p2', 'p3', 'p4']);
    const fifth = screen.getByLabelText(/Cohort E/i) as HTMLInputElement;
    expect(fifth.disabled).toBe(true);
    expect(fifth.checked).toBe(false);
  });

  it('XCOHORT-03: displays patient count next to each cohort name', () => {
    renderDrawer([primaryId]);
    // Drawer shows "Cohort A (N=42 patients)" style — exact format locked in UI-SPEC.
    expect(screen.getByText(/Cohort A/i)).toBeTruthy();
  });

  it('allows unchecking a non-primary cohort', () => {
    renderDrawer(['p1', 'p2']);
    const b = screen.getByLabelText(/Cohort B/i) as HTMLInputElement;
    fireEvent.click(b);
    // Plan 03 onChange handler must remove p2 from selectedIds.
  });
});
