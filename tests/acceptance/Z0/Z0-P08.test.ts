// Z0-P08 — integer interpolation grid on the treatments axis (PLAN Z0 § Z0-P08 §3/§5). Synthetic values only.
import { describe, expect, it } from 'vitest';

import { buildGrid } from '../../../shared/cohortTrajectory';

describe('[Z0-P08] buildGrid on the treatments axis', () => {
  it('uses every whole treatment count between min and max (step 1), independent of gridPoints', () => {
    expect(buildGrid([[0, 3, 7], [1, 5]], 120, 'treatments')).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(buildGrid([[0, 3, 7], [1, 5]], 20, 'treatments')).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('has no grid point between 4 and 5', () => {
    const grid = buildGrid([[0, 12]], 120, 'treatments');
    expect(grid).toContain(5);
    expect(grid.filter((x) => x > 4 && x < 5)).toEqual([]);
  });

  it('keeps the uniform grid of gridPoints steps on the days axis', () => {
    expect(buildGrid([[0, 100], [50, 150]], 4, 'days')).toEqual([0, 50, 100, 150]);
  });
});
