/**
 * Distribution binning utilities for clinical observation histograms.
 * Extracted from CaseDetailPage (N05.31/N05.32).
 */

import type { Observation } from '../types/fhir';

export interface DistributionBin {
  range: string;
  count: number;
}

/** N5 (v1.19 WS-B): a histogram bin carrying the comparable PERCENTAGE figures
 *  used by the reworked distribution plots when the cohort overlay is on, plus
 *  the absolute counts shown in the tooltip. The patient figures are the
 *  patient's own share of their measurements in this bin; the cohort figures are
 *  the MEDIAN across the cohort patients (each patient's own per-bin share /
 *  count), so the two bars sit on a single shared percentage axis. */
export interface ComparableDistributionBin extends DistributionBin {
  /** Patient's % of their own measurements that fall in this bin. */
  patientPct: number;
  /** Median across cohort patients of each patient's per-bin percentage. */
  cohortMedianPct: number;
  /** Median across cohort patients of each patient's per-bin absolute count. */
  cohortMedianCount: number;
}

/** Median of a numeric list (0 for empty). Linear interpolation for even n. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * N5: build comparable percentage bins for the patient's histogram against a
 * cohort. `binFn` is the relevant per-observation binner (visus or CRT).
 *
 * - The patient bars are `patientPct` = the patient's count in each bin as a %
 *   of all their own measurements.
 * - The cohort bars are the per-bin MEDIAN of each cohort patient's own bin-%
 *   (and the median of each cohort patient's bin COUNT, for the tooltip) — NOT
 *   a single pooled percentage, so an atypically prolific patient cannot skew
 *   the comparison. Cohort patients with zero measurements are excluded.
 */
export function computeComparableDistribution(
  patientObs: Observation[],
  cohortPerPatientObs: Observation[][],
  binFn: (obs: Observation[]) => DistributionBin[],
): ComparableDistributionBin[] {
  const patientBins = binFn(patientObs);
  const patientTotal = patientBins.reduce((s, b) => s + b.count, 0);

  // Per cohort patient: their own per-bin counts + total (skip empty patients).
  const cohortBinned = cohortPerPatientObs
    .map((obs) => binFn(obs))
    .map((bins) => ({ bins, total: bins.reduce((s, b) => s + b.count, 0) }))
    .filter((p) => p.total > 0);

  return patientBins.map((bin, i) => {
    const cohortPcts = cohortBinned.map((p) => (p.bins[i].count / p.total) * 100);
    const cohortCounts = cohortBinned.map((p) => p.bins[i].count);
    return {
      range: bin.range,
      count: bin.count,
      patientPct: patientTotal ? +((bin.count / patientTotal) * 100).toFixed(1) : 0,
      cohortMedianPct: +median(cohortPcts).toFixed(1),
      cohortMedianCount: +median(cohortCounts).toFixed(1),
    };
  });
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
