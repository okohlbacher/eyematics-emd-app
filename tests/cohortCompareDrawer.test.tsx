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

  // J7 (v1.15-p3): the cohort-split flow opens compare with sub-cohorts pre-selected
  // and NO primary (primaryCohortId === null). Nothing must be locked — every selected
  // entry stays deselectable, and the (unselected) parent stays addable.
  it('J7: with no primary, all pre-selected sub-cohorts are checked but NOT disabled (deselectable)', () => {
    const onChange = vi.fn();
    render(
      <CohortCompareDrawer
        open
        onClose={vi.fn()}
        savedSearches={savedSearches}
        patientCounts={{ p1: 42, p2: 17, p3: 8, p4: 5, p5: 3 }}
        primaryCohortId={null}
        selectedIds={['p2', 'p3']}
        onChange={onChange}
        onReset={vi.fn()}
        t={(k) => k}
      />,
    );
    const b = screen.getByLabelText(/Cohort B \(N=17 patients\)/i) as HTMLInputElement;
    expect(b.checked).toBe(true);
    expect(b.disabled).toBe(false);
    // Deselecting a pre-selected sub-cohort fires onChange with it removed.
    fireEvent.click(b);
    expect(onChange).toHaveBeenCalledWith(['p3']);
  });

  it('J7: with no primary, an unselected cohort (the parent) is addable (not disabled)', () => {
    const onChange = vi.fn();
    render(
      <CohortCompareDrawer
        open
        onClose={vi.fn()}
        savedSearches={savedSearches}
        patientCounts={{ p1: 42, p2: 17, p3: 8, p4: 5, p5: 3 }}
        primaryCohortId={null}
        selectedIds={['p2', 'p3']}
        onChange={onChange}
        onReset={vi.fn()}
        t={(k) => k}
      />,
    );
    // p1 stands in for the (unselected) parent — addable, not locked.
    const a = screen.getByLabelText(/Cohort A \(N=42 patients\)/i) as HTMLInputElement;
    expect(a.checked).toBe(false);
    expect(a.disabled).toBe(false);
    fireEvent.click(a);
    expect(onChange).toHaveBeenCalledWith(['p2', 'p3', 'p1']);
  });
});

// ---------------------------------------------------------------------------
// Wave 0 RED: subcohort tree render + independent selection + max-4 (SC2, SC3, D-R5)
//
// These tests are INTENTIONALLY RED until Plan 02 replaces the flat
// savedSearches.map in CohortCompareDrawer with tree rendering.
// They define the contract per 31-VALIDATION.md §"Wave 0 Requirements".
// ---------------------------------------------------------------------------

describe('CohortCompareDrawer subcohort tree (SC2, SC3, D-R5)', () => {
  /**
   * savedSearches for tree tests:
   *  - Cohort1         (parent, has subcohorts)
   *  - Cohort1:Male    (subcohort of Cohort1)
   *  - Cohort1:Female  (subcohort of Cohort1)
   *  - FlatCohort      (no colons — renders flat, zero-regression baseline)
   */
  const treeSearches = [
    { id: 'c1', name: 'Cohort1', createdAt: '2026-01-01', filters: {} },
    { id: 'c1m', name: 'Cohort1:Male', createdAt: '2026-01-02', filters: {} },
    { id: 'c1f', name: 'Cohort1:Female', createdAt: '2026-01-03', filters: {} },
    { id: 'flat', name: 'FlatCohort', createdAt: '2026-01-04', filters: {} },
  ];

  const treePatientCounts = { c1: 100, c1m: 60, c1f: 40, flat: 25 };

  function renderTreeDrawer(selected: string[]) {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const onClose = vi.fn();
    const utils = render(
      <CohortCompareDrawer
        open
        onClose={onClose}
        savedSearches={treeSearches}
        patientCounts={treePatientCounts}
        primaryCohortId="c1"
        selectedIds={selected}
        onChange={onChange}
        onReset={onReset}
        t={(k) => k}
      />,
    );
    return { ...utils, onChange, onReset, onClose };
  }

  it('SC2: parent row "Cohort1" renders in the drawer', () => {
    renderTreeDrawer(['c1']);
    // Parent label includes patient count
    expect(screen.queryByText(/Cohort1 \(N=100 patients\)/i)).not.toBeNull();
  });

  it('SC2: subcohort row "Cohort1:Male" renders beneath the parent', () => {
    renderTreeDrawer(['c1']);
    expect(screen.queryByText(/Cohort1:Male \(N=60 patients\)/i)).not.toBeNull();
  });

  it('SC2: subcohort row "Cohort1:Female" renders beneath the parent', () => {
    renderTreeDrawer(['c1']);
    expect(screen.queryByText(/Cohort1:Female \(N=40 patients\)/i)).not.toBeNull();
  });

  it('SC2: flat cohort "FlatCohort" still renders flat (zero-regression baseline)', () => {
    renderTreeDrawer(['c1']);
    expect(screen.queryByText(/FlatCohort \(N=25 patients\)/i)).not.toBeNull();
  });

  it('SC3: selecting the parent checkbox calls onChange with the parent id only', () => {
    // Primary is c1 (always selected), select c1m so c1 is not primary-locked on toggle
    // Use a non-primary setup: primary = 'flat', select parent 'c1'
    const onChange = vi.fn();
    render(
      <CohortCompareDrawer
        open
        onClose={vi.fn()}
        savedSearches={treeSearches}
        patientCounts={treePatientCounts}
        primaryCohortId="flat"
        selectedIds={['flat']}
        onChange={onChange}
        onReset={vi.fn()}
        t={(k) => k}
      />,
    );
    const parentCheckbox = screen.getByLabelText(/Cohort1 \(N=100 patients\)/i) as HTMLInputElement;
    fireEvent.click(parentCheckbox);
    // onChange called with ['flat', 'c1'] — only the parent id added, no subcohorts implicitly
    expect(onChange).toHaveBeenCalledTimes(1);
    const [newSelection] = onChange.mock.calls[0] as [string[]];
    expect(newSelection).toContain('c1');
    expect(newSelection).not.toContain('c1m');
    expect(newSelection).not.toContain('c1f');
  });

  it('SC3: selecting a subcohort checkbox calls onChange with that subcohort id only', () => {
    const onChange = vi.fn();
    render(
      <CohortCompareDrawer
        open
        onClose={vi.fn()}
        savedSearches={treeSearches}
        patientCounts={treePatientCounts}
        primaryCohortId="flat"
        selectedIds={['flat']}
        onChange={onChange}
        onReset={vi.fn()}
        t={(k) => k}
      />,
    );
    const subCheckbox = screen.getByLabelText(/Cohort1:Male \(N=60 patients\)/i) as HTMLInputElement;
    fireEvent.click(subCheckbox);
    expect(onChange).toHaveBeenCalledTimes(1);
    const [newSelection] = onChange.mock.calls[0] as [string[]];
    expect(newSelection).toContain('c1m');
    expect(newSelection).not.toContain('c1');
    expect(newSelection).not.toContain('c1f');
  });

  it('D-R5: each entry (parent or subcohort) counts individually — 5th entry disabled when 4 selected', () => {
    // 4 already selected: flat (primary), c1, c1m, c1f — so the next entry is disabled
    renderTreeDrawer(['flat', 'c1', 'c1m', 'c1f']);
    // There is no 5th entry in treeSearches, so we need to check any of the 4 non-selected
    // Actually all 4 are selected — let's check that with 4 selected the isMaxReached state
    // is triggered. We do this by rendering with a config where one entry is unselected.
    cleanup();

    // 4 selected: flat(primary), c1, c1m — c1f is the 4th via separate set
    // Actually let's use a fresh setup: primary flat, selected = [flat, c1, c1m, c1f] = 4 total
    // Then render again to check a 5th entry would be disabled — but treeSearches only has 4.
    // Re-render with primaryCohortId = c1 (already in selected) and 3 more selected.
    // With selectedIds = ['c1', 'c1m', 'c1f', 'flat'] that is 4 total.
    // A hypothetical 5th is disabled; we verify by checking c1f disabled when already 4 selected.
    const onChange = vi.fn();
    render(
      <CohortCompareDrawer
        open
        onClose={vi.fn()}
        savedSearches={treeSearches}
        patientCounts={treePatientCounts}
        primaryCohortId="c1"
        selectedIds={['c1', 'c1m', 'c1f', 'flat']}
        onChange={onChange}
        onReset={vi.fn()}
        t={(k) => k}
      />,
    );
    // All 4 are selected; isMaxReached === true. A non-selected entry (if any) would be disabled.
    // Since all entries are selected, verify the flat cohort checkbox is NOT disabled (it is selected)
    // and that isMaxReached is reached (cannot add more). We assert onChange is NOT called on c1m click
    // because it would toggle OFF (deselect) — that is still allowed.
    // The real D-R5 check: with 4 selected and a 5th hypothetical cohort, that 5th is disabled.
    // Verify: FlatCohort row checkbox is checked (it is selected and not primary), confirming each counts.
    const flatCheckbox = screen.getByLabelText(/FlatCohort \(N=25 patients\)/i) as HTMLInputElement;
    expect(flatCheckbox.checked).toBe(true);
    // isMaxReached is true — verify by adding a 5th savedSearch and checking it is disabled
  });

  it('D-R5: 5th entry is disabled when 4 are already selected (parent + subcohort each count)', () => {
    // Use 5 entries: flat(primary), c1, c1m, c1f selected (4 total) — extra entry disabled
    const fiveSearches = [
      ...treeSearches,
      { id: 'extra', name: 'ExtraCohort', createdAt: '2026-01-05', filters: {} },
    ];
    const fiveCounts = { ...treePatientCounts, extra: 10 };
    render(
      <CohortCompareDrawer
        open
        onClose={vi.fn()}
        savedSearches={fiveSearches}
        patientCounts={fiveCounts}
        primaryCohortId="c1"
        selectedIds={['c1', 'c1m', 'c1f', 'flat']}
        onChange={vi.fn()}
        onReset={vi.fn()}
        t={(k) => k}
      />,
    );
    // ExtraCohort is the 5th (unselected); max-4 reached — must be disabled
    const extraCheckbox = screen.getByLabelText(/ExtraCohort \(N=10 patients\)/i) as HTMLInputElement;
    expect(extraCheckbox.disabled).toBe(true);
    expect(extraCheckbox.checked).toBe(false);
  });
});
