/**
 * Distribution binning utilities for clinical observation histograms.
 * Extracted from CaseDetailPage (N05.31/N05.32).
 */

import type { Observation } from '../types/fhir';

export interface DistributionBin {
  range: string;
  count: number;
}

/** Compute visus distribution across standard bins. */
export function computeVisusDistribution(observations: Observation[]): DistributionBin[] {
  const bins = [
    { range: '0\u20130.2', min: 0, max: 0.2, count: 0 },
    { range: '0.2\u20130.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4\u20130.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6\u20130.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8\u20131.0', min: 0.8, max: 1.01, count: 0 },
  ];
  observations.forEach((o) => {
    const v = o.valueQuantity?.value;
    if (v == null) return;
    const bin = bins.find((b) => v >= b.min && v < b.max);
    if (bin) bin.count++;
  });
  return bins.map(({ range, count }) => ({ range, count }));
}

/** Compute CRT distribution across standard bins. */
export function computeCrtDistribution(observations: Observation[]): DistributionBin[] {
  const bins = [
    { range: '<200', min: 0, max: 200, count: 0 },
    { range: '200\u2013250', min: 200, max: 250, count: 0 },
    { range: '250\u2013300', min: 250, max: 300, count: 0 },
    { range: '300\u2013350', min: 300, max: 350, count: 0 },
    { range: '350\u2013400', min: 350, max: 400, count: 0 },
    { range: '>400', min: 400, max: 9999, count: 0 },
  ];
  observations.forEach((o) => {
    const v = o.valueQuantity?.value;
    if (v == null) return;
    const bin = bins.find((b) => v >= b.min && v < b.max);
    if (bin) bin.count++;
  });
  return bins.map(({ range, count }) => ({ range, count }));
}
