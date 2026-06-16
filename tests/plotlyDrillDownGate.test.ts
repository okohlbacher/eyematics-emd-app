/**
 * IDOR gate — resolveDrillDownId (the actual security boundary used by
 * OutcomesPanel.handlePlotlyClick). Review MED-3: the panel's drill-down navigates
 * only for a pseudonym known to THIS panel; a Plotly click carrying an unknown or
 * crafted `customdata` must NOT yield a navigable id. This drives the gate itself
 * (not a reimplementation) with hostile inputs.
 */
import { describe, expect, it } from 'vitest';

import { resolveDrillDownId } from '../src/components/outcomes/plotlyTraces';

const known = new Set(['PSN-1', 'PSN-2', 'PSN-3']);

const click = (customdata: unknown) => ({ points: [{ customdata }] });

describe('resolveDrillDownId (IDOR gate)', () => {
  it('returns the id for a known pseudonym', () => {
    expect(resolveDrillDownId(click('PSN-2'), known)).toBe('PSN-2');
  });

  it('returns null for an UNKNOWN pseudonym (the hostile/crafted customdata vector)', () => {
    expect(resolveDrillDownId(click('PSN-9999'), known)).toBeNull();
    expect(resolveDrillDownId(click('../admin'), known)).toBeNull();
    expect(resolveDrillDownId(click('CENTER-001'), known)).toBeNull();
  });

  it('returns null for non-string customdata', () => {
    expect(resolveDrillDownId(click(42), known)).toBeNull();
    expect(resolveDrillDownId(click({ pseudonym: 'PSN-1' }), known)).toBeNull();
    expect(resolveDrillDownId(click(null), known)).toBeNull();
    expect(resolveDrillDownId(click(undefined), known)).toBeNull();
  });

  it('returns null for a malformed / empty event', () => {
    expect(resolveDrillDownId({ points: [] }, known)).toBeNull();
    expect(resolveDrillDownId({}, known)).toBeNull();
    expect(resolveDrillDownId(null, known)).toBeNull();
    expect(resolveDrillDownId(undefined, known)).toBeNull();
  });

  it('returns null when the known set is empty (nothing is navigable)', () => {
    expect(resolveDrillDownId(click('PSN-1'), new Set())).toBeNull();
  });
});
