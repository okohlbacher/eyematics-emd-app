import { useMemo } from 'react';

import { CRITICAL_CRT_THRESHOLD, CRITICAL_IOP_THRESHOLD, CRITICAL_VISUS_THRESHOLD } from '../config/clinicalThresholds';
import type { TranslationKey } from '../i18n/translations';
import {
  getObservationsByCode,
  LOINC_CRT,
  LOINC_HBA1C,
  LOINC_IOP,
  LOINC_VISUS,
} from '../services/fhirLoader';
import type { PatientCase } from '../types/fhir';
import { getEyeLabel, translateClinical } from '../utils/clinicalTerms';
import { computeCrtDistribution, computeVisusDistribution } from '../utils/distributionBins';

/** Average days per month used to convert an absolute date span to relative
 *  months-since-baseline (J3c relative-time axis). */
const DAYS_PER_MONTH = 30.4375;
const MS_PER_DAY = 86_400_000;

/** Months between two ISO dates (YYYY-MM-DD), rounded to one decimal so distinct
 *  visits stay distinct on the relative axis while remaining readable. */
function monthsBetween(baseline: string, date: string): number {
  if (!baseline || !date) return 0;
  const days = (new Date(date).getTime() - new Date(baseline).getTime()) / MS_PER_DAY;
  return Math.round((days / DAYS_PER_MONTH) * 10) / 10;
}

/** A single row of the Visus/CRT trend chart's merged data array. */
export interface CombinedDataPoint {
  date: string;
  /** J3c: months since the patient's first observation (relative-time X axis).
   *  The chart keys its X dimension on this; `date` is retained for the tooltip. */
  relMonths: number;
  visus?: number;
  crt?: number;
  visusMeasured?: boolean;
  crtMeasured?: boolean;
  /** A4 v2: linearly interpolated display-only values (NOT real measurements).
   *  Kept on separate keys so derived data (scatter/correlation) never ingests
   *  fabricated pairs — those read .visus/.crt only. */
  visusInterp?: number;
  crtInterp?: number;
  /** FALL-011 (A3 v2): cohort reference folded onto the patient's row. */
  visusMedian?: number;
  crtMedian?: number;
  /** Range tuples [p25, p75] for the translucent IQR band Areas. */
  visusBand?: [number, number];
  crtBand?: [number, number];
}

/** Per-relative-month cohort percentile reference (FALL-011 + J3c).
 *  Keyed by the relative month bucket (months since each peer's own baseline),
 *  aligned onto the index patient's relative axis. `date` is the index patient's
 *  calendar date that resolves to this bucket (retained for tooltips). */
export interface CohortReferencePoint {
  date: string;
  relMonths: number;
  visusMedian?: number;
  visusP25?: number;
  visusP75?: number;
  crtMedian?: number;
  crtP25?: number;
  crtP75?: number;
}

/** A row of the Change-from-Baseline chart (J3c relative axis + J3d overlay). */
export interface BaselineChangePoint {
  date: string;
  relMonths: number;
  visusChange?: number;
  crtChange?: number;
  /** J3d: cohort percent-change median + IQR band ([p25, p75]) at this relative
   *  month bucket. Each peer's change is measured from its OWN baseline value. */
  visusChangeMedian?: number;
  visusChangeBand?: [number, number];
  crtChangeMedian?: number;
  crtChangeBand?: [number, number];
}

/** A row of the IOP (Augeninnendruck) chart. K3b: optionally carries the cohort
 *  median + IQR band aggregated by relative time since each peer's own baseline. */
export interface IopDataPoint {
  date: string;
  iop: number;
  /** K3b: cohort IOP median at this row's relative-month bucket. */
  iopMedian?: number;
  /** K3b: cohort IOP IQR [p25, p75] at this row's relative-month bucket. */
  iopBand?: [number, number];
}

/** Nearest-rank percentile (0-based fraction, 0 = min, 1 = max). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(Math.floor(p * sorted.length), sorted.length - 1);
  return sorted[idx];
}

export function useCaseData(
  patientCase: PatientCase | undefined,
  cases: PatientCase[],
  locale: string,
  t: (key: TranslationKey) => string,
) {
  // Cohort averages for comparison (EMDREQ-FALL-006)
  const cohortAvgVisus = useMemo(() => {
    const all = cases.flatMap((c) => getObservationsByCode(c.observations, LOINC_VISUS));
    if (!all.length) return 0;
    return all.reduce((s, o) => s + (o.valueQuantity?.value ?? 0), 0) / all.length;
  }, [cases]);

  const cohortAvgCrt = useMemo(() => {
    const all = cases.flatMap((c) => getObservationsByCode(c.observations, LOINC_CRT));
    if (!all.length) return 0;
    return all.reduce((s, o) => s + (o.valueQuantity?.value ?? 0), 0) / all.length;
  }, [cases]);

  // Derived observations (safe when patientCase is undefined — returns empty arrays)
  const visusObs = useMemo(
    () => (patientCase ? getObservationsByCode(patientCase.observations, LOINC_VISUS) : []),
    [patientCase],
  );
  const crtObs = useMemo(
    () => (patientCase ? getObservationsByCode(patientCase.observations, LOINC_CRT) : []),
    [patientCase],
  );
  const iopObs = useMemo(
    () => (patientCase ? getObservationsByCode(patientCase.observations, LOINC_IOP) : []),
    [patientCase],
  );
  const hba1cObs = useMemo(
    () => (patientCase ? getObservationsByCode(patientCase.observations, LOINC_HBA1C) : []),
    [patientCase],
  );

  const injections = useMemo(
    () => patientCase?.procedures.filter((p) => p.code.coding.some((c) => c.code === '36189003')) ?? [],
    [patientCase],
  );

  const refractionObs = useMemo(
    () =>
      (patientCase?.observations ?? [])
        .filter((o) => o.code.coding.some((c) => c.code === '79846-2') && o.component)
        .sort((a, b) => (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? '')),
    [patientCase],
  );

  const anteriorFindings = useMemo(
    () =>
      (patientCase?.observations ?? [])
        .filter((o) => o.code.coding.some((c) => c.code === 'anterior-segment'))
        .sort((a, b) => (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? '')),
    [patientCase],
  );

  const posteriorFindings = useMemo(
    () =>
      (patientCase?.observations ?? [])
        .filter((o) => o.code.coding.some((c) => c.code === 'posterior-segment'))
        .sort((a, b) => (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? '')),
    [patientCase],
  );

  const ophthalmicAnamnesis = useMemo(
    () =>
      (patientCase?.conditions ?? []).filter((c) =>
        c.category?.some((cat) => cat.coding?.some((cd) => cd.code === 'ophthalmic')),
      ),
    [patientCase],
  );

  const nonOphthalmicAnamnesis = useMemo(
    () =>
      (patientCase?.conditions ?? []).filter((c) =>
        c.category?.some((cat) => cat.coding?.some((cd) => cd.code === 'non-ophthalmic')),
      ),
    [patientCase],
  );

  const adverseEvents = useMemo(
    () =>
      (patientCase?.conditions ?? []).filter((c) =>
        c.category?.some((cat) => cat.coding?.some((cd) => cd.code === 'adverse-event')),
      ),
    [patientCase],
  );

  const primaryDiagnoses = useMemo(
    () => (patientCase?.conditions ?? []).filter((c) => !c.category || c.category.length === 0),
    [patientCase],
  );

  const treatmentIndicationRaw = injections[0]?.reasonCode?.[0]?.coding?.[0]?.display;
  const treatmentIndication = treatmentIndicationRaw
    ? translateClinical(treatmentIndicationRaw, locale)
    : undefined;

  const eyeLaterality = visusObs[0] ? getEyeLabel(visusObs[0]) : '';

  const diabetesCond = useMemo(
    () =>
      patientCase?.conditions.find((c) =>
        c.code.coding.some((cd) => cd.code === 'E11.9' || cd.code === 'E10.9'),
      ),
    [patientCase],
  );

  const crtData = useMemo(
    () =>
      crtObs.map((o) => ({
        date: o.effectiveDateTime?.substring(0, 10) ?? '',
        crt: o.valueQuantity?.value ?? 0,
      })),
    [crtObs],
  );

  // J3c: the patient's baseline = earliest visus/crt observation date. All
  // relative-time offsets (chart X axis, IVI markers, date highlight) are
  // measured in months since this date.
  const baselineDate = useMemo(() => {
    const dates: string[] = [];
    for (const o of visusObs) {
      const d = o.effectiveDateTime?.substring(0, 10);
      if (d) dates.push(d);
    }
    for (const o of crtObs) {
      const d = o.effectiveDateTime?.substring(0, 10);
      if (d) dates.push(d);
    }
    if (!dates.length) return '';
    return dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  }, [visusObs, crtObs]);

  // Combined dual-axis data: merge visus + CRT by date. The chart's X axis is the
  // calendar date (K3c); `relMonths` is retained per row only to bucket the cohort
  // overlay by relative time-since-baseline (mapped back onto these date rows).
  const combinedData = useMemo((): CombinedDataPoint[] => {
    const dateMap = new Map<string, CombinedDataPoint>();
    const ensure = (d: string): CombinedDataPoint => {
      const existing = dateMap.get(d);
      if (existing) return existing;
      const entry: CombinedDataPoint = { date: d, relMonths: monthsBetween(baselineDate, d) };
      dateMap.set(d, entry);
      return entry;
    };
    visusObs.forEach((o) => {
      const d = o.effectiveDateTime?.substring(0, 10) ?? '';
      const entry = ensure(d);
      entry.visus = o.valueQuantity?.value;
      entry.visusMeasured = true;
    });
    crtObs.forEach((o) => {
      const d = o.effectiveDateTime?.substring(0, 10) ?? '';
      const entry = ensure(d);
      entry.crt = o.valueQuantity?.value;
      entry.crtMeasured = true;
    });
    // K3c/K3d: ensure each injection date exists as a row (with no visus/crt
    // values) so the calendar-date category axis includes it — the date-keyed IVI
    // marker + injection highlight ReferenceLines then always land on a real tick.
    injections.forEach((inj) => {
      const d = inj.performedDateTime?.substring(0, 10);
      if (d) ensure(d);
    });
    const rows = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // A4 v2: linear interpolation for display-only open-circle markers.
    // For a metric missing on a row but with measured neighbours BOTH before
    // AND after, write the linear interpolation onto a SEPARATE key
    // (visusInterp/crtInterp) — never onto .visus/.crt, so visusCrtScatter and
    // all derived data stay free of fabricated pairs. Edge gaps (only one side
    // present) are NOT interpolated.
    const interpolate = (
      metric: 'visus' | 'crt',
      interpKey: 'visusInterp' | 'crtInterp',
    ) => {
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][metric] != null) continue;
        // find previous measured neighbour
        let prev = -1;
        for (let j = i - 1; j >= 0; j--) {
          if (rows[j][metric] != null) { prev = j; break; }
        }
        // find next measured neighbour
        let next = -1;
        for (let j = i + 1; j < rows.length; j++) {
          if (rows[j][metric] != null) { next = j; break; }
        }
        if (prev === -1 || next === -1) continue; // edge gap — skip
        const prevVal = rows[prev][metric]!;
        const nextVal = rows[next][metric]!;
        const span = new Date(rows[next].date).getTime() - new Date(rows[prev].date).getTime();
        const offset = new Date(rows[i].date).getTime() - new Date(rows[prev].date).getTime();
        const frac = span > 0 ? offset / span : 0.5;
        rows[i][interpKey] = prevVal + (nextVal - prevVal) * frac;
      }
    };
    interpolate('visus', 'visusInterp');
    interpolate('crt', 'crtInterp');

    return rows;
  }, [visusObs, crtObs, injections, baselineDate]);

  // A4 v2: hint/markers only when interpolated points actually exist.
  const hasInterpolatedPoints = useMemo(
    () => combinedData.some((d) => d.visusInterp != null || d.crtInterp != null),
    [combinedData],
  );

  const visusDistribution = useMemo(() => computeVisusDistribution(visusObs), [visusObs]);
  const crtDistribution = useMemo(() => computeCrtDistribution(crtObs), [crtObs]);

  // J3d: peer-cohort observations (index patient excluded) for the distribution +
  // scatter overlays. Reuses the same exclusion rule as cohortReference (WR-04).
  const peerVisusObs = useMemo(
    () =>
      cases
        .filter((c) => !patientCase || c.id !== patientCase.id)
        .flatMap((c) => getObservationsByCode(c.observations, LOINC_VISUS)),
    [cases, patientCase],
  );
  const peerCrtObs = useMemo(
    () =>
      cases
        .filter((c) => !patientCase || c.id !== patientCase.id)
        .flatMap((c) => getObservationsByCode(c.observations, LOINC_CRT)),
    [cases, patientCase],
  );

  // J3d: fold the cohort distribution onto the patient's bins as a cohort
  // percentage per bin (own scale → comparable to the patient's small counts).
  const visusDistributionWithCohort = useMemo(() => {
    const cohort = computeVisusDistribution(peerVisusObs);
    const total = cohort.reduce((s, b) => s + b.count, 0);
    return visusDistribution.map((bin, i) => ({
      ...bin,
      cohortPct: total ? +((cohort[i].count / total) * 100).toFixed(1) : 0,
    }));
  }, [visusDistribution, peerVisusObs]);

  const crtDistributionWithCohort = useMemo(() => {
    const cohort = computeCrtDistribution(peerCrtObs);
    const total = cohort.reduce((s, b) => s + b.count, 0);
    return crtDistribution.map((bin, i) => ({
      ...bin,
      cohortPct: total ? +((cohort[i].count / total) * 100).toFixed(1) : 0,
    }));
  }, [crtDistribution, peerCrtObs]);

  const visusCrtScatter = useMemo(
    () =>
      combinedData
        .filter((d) => d.visus != null && d.crt != null)
        .map((d) => ({ visus: d.visus!, crt: d.crt!, date: d.date })),
    [combinedData],
  );

  // J3d: cohort Visus-vs-CRT cloud (peer same-day visus+crt pairs), capped to keep
  // the scatter render light. Drawn behind the patient's points.
  const cohortVisusCrtScatter = useMemo(() => {
    const COHORT_SCATTER_CAP = 400;
    const pairs: Array<{ visus: number; crt: number }> = [];
    for (const c of cases) {
      if (patientCase && c.id === patientCase.id) continue;
      const byDate = new Map<string, { visus?: number; crt?: number }>();
      for (const o of getObservationsByCode(c.observations, LOINC_VISUS)) {
        const d = o.effectiveDateTime?.substring(0, 10) ?? '';
        const v = o.valueQuantity?.value;
        if (d && v != null) (byDate.get(d) ?? byDate.set(d, {}).get(d)!).visus = v;
      }
      for (const o of getObservationsByCode(c.observations, LOINC_CRT)) {
        const d = o.effectiveDateTime?.substring(0, 10) ?? '';
        const v = o.valueQuantity?.value;
        if (d && v != null) (byDate.get(d) ?? byDate.set(d, {}).get(d)!).crt = v;
      }
      for (const { visus, crt } of byDate.values()) {
        if (visus != null && crt != null) pairs.push({ visus, crt });
      }
    }
    if (pairs.length <= COHORT_SCATTER_CAP) return pairs;
    // Even downsample to the cap.
    const step = pairs.length / COHORT_SCATTER_CAP;
    const out: Array<{ visus: number; crt: number }> = [];
    for (let i = 0; i < pairs.length; i += step) out.push(pairs[Math.floor(i)]);
    return out;
  }, [cases, patientCase]);

  const baselineData = useMemo((): BaselineChangePoint[] => {
    if (visusObs.length < 2) return [];
    const baselineVisus = visusObs[0]?.valueQuantity?.value ?? 0;
    const baselineCrt = crtObs[0]?.valueQuantity?.value ?? 0;
    const dateMap = new Map<string, BaselineChangePoint>();
    const ensure = (d: string): BaselineChangePoint => {
      const existing = dateMap.get(d);
      if (existing) return existing;
      const entry: BaselineChangePoint = { date: d, relMonths: monthsBetween(baselineDate, d) };
      dateMap.set(d, entry);
      return entry;
    };
    visusObs.forEach((o) => {
      const d = o.effectiveDateTime?.substring(0, 10) ?? '';
      const val = o.valueQuantity?.value ?? 0;
      const entry = ensure(d);
      entry.visusChange = baselineVisus
        ? +((((val - baselineVisus) / baselineVisus) * 100).toFixed(1))
        : 0;
    });
    crtObs.forEach((o) => {
      const d = o.effectiveDateTime?.substring(0, 10) ?? '';
      const val = o.valueQuantity?.value ?? 0;
      const entry = ensure(d);
      entry.crtChange = baselineCrt
        ? +((((val - baselineCrt) / baselineCrt) * 100).toFixed(1))
        : 0;
    });
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [visusObs, crtObs, baselineDate]);

  // J3d: cohort percent-change-from-baseline reference, bucketed by months since
  // EACH peer's own baseline (same relative-time alignment as cohortReference).
  // Each peer's change at a visit = % change from that peer's first measured value.
  const baselineChangeWithReference = useMemo((): BaselineChangePoint[] => {
    if (!baselineData.length || !cases.length) return baselineData;

    const visusChangeByRelMonth = new Map<number, number[]>();
    const crtChangeByRelMonth = new Map<number, number[]>();

    for (const c of cases) {
      if (patientCase && c.id === patientCase.id) continue; // exclude index patient
      const pv = getObservationsByCode(c.observations, LOINC_VISUS);
      const pc = getObservationsByCode(c.observations, LOINC_CRT);
      const peerDates: string[] = [];
      for (const o of pv) { const d = o.effectiveDateTime?.substring(0, 10); if (d) peerDates.push(d); }
      for (const o of pc) { const d = o.effectiveDateTime?.substring(0, 10); if (d) peerDates.push(d); }
      if (!peerDates.length) continue;
      const peerBaseline = peerDates.reduce((min, d) => (d < min ? d : min), peerDates[0]);

      const sortedV = [...pv].sort((a, b) => (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? ''));
      const sortedC = [...pc].sort((a, b) => (a.effectiveDateTime ?? '').localeCompare(b.effectiveDateTime ?? ''));
      const baseV = sortedV[0]?.valueQuantity?.value ?? 0;
      const baseC = sortedC[0]?.valueQuantity?.value ?? 0;

      for (const o of sortedV) {
        const d = o.effectiveDateTime?.substring(0, 10) ?? '';
        const val = o.valueQuantity?.value;
        if (!d || val == null || !baseV) continue;
        const bucket = Math.round(monthsBetween(peerBaseline, d));
        const arr = visusChangeByRelMonth.get(bucket) ?? [];
        arr.push(((val - baseV) / baseV) * 100);
        visusChangeByRelMonth.set(bucket, arr);
      }
      for (const o of sortedC) {
        const d = o.effectiveDateTime?.substring(0, 10) ?? '';
        const val = o.valueQuantity?.value;
        if (!d || val == null || !baseC) continue;
        const bucket = Math.round(monthsBetween(peerBaseline, d));
        const arr = crtChangeByRelMonth.get(bucket) ?? [];
        arr.push(((val - baseC) / baseC) * 100);
        crtChangeByRelMonth.set(bucket, arr);
      }
    }

    return baselineData.map((point) => {
      const bucket = Math.round(point.relMonths);
      const vVals = visusChangeByRelMonth.get(bucket);
      const cVals = crtChangeByRelMonth.get(bucket);
      const merged: BaselineChangePoint = { ...point };
      if (vVals && vVals.length) {
        const sorted = [...vVals].sort((a, b) => a - b);
        merged.visusChangeMedian = +percentile(sorted, 0.5).toFixed(1);
        merged.visusChangeBand = [+percentile(sorted, 0.25).toFixed(1), +percentile(sorted, 0.75).toFixed(1)];
      }
      if (cVals && cVals.length) {
        const sorted = [...cVals].sort((a, b) => a - b);
        merged.crtChangeMedian = +percentile(sorted, 0.5).toFixed(1);
        merged.crtChangeBand = [+percentile(sorted, 0.25).toFixed(1), +percentile(sorted, 0.75).toFixed(1)];
      }
      return merged;
    });
  }, [baselineData, cases, patientCase]);

  const totalEncounters =
    (patientCase?.observations.length ?? 0) + (patientCase?.procedures.length ?? 0);

  const hasCriticalValues =
    crtObs.some((o) => (o.valueQuantity?.value ?? 0) > CRITICAL_CRT_THRESHOLD()) ||
    visusObs.some((o) => (o.valueQuantity?.value ?? 0) < CRITICAL_VISUS_THRESHOLD());

  const criticalCrtCount = crtObs.filter(
    (o) => (o.valueQuantity?.value ?? 0) > CRITICAL_CRT_THRESHOLD(),
  ).length;
  const criticalVisusCount = visusObs.filter(
    (o) => (o.valueQuantity?.value ?? 0) < CRITICAL_VISUS_THRESHOLD(),
  ).length;
  const criticalIopCount = iopObs.filter(
    (o) => (o.valueQuantity?.value ?? 0) > CRITICAL_IOP_THRESHOLD(),
  ).length;

  const octImages = useMemo(
    () =>
      (patientCase?.imagingStudies ?? []).flatMap((study) =>
        (study.series ?? []).flatMap((s) =>
          (s.instance ?? []).map((inst) => ({
            title: study.description ?? 'OCT',
            date: study.started?.substring(0, 10) ?? '',
            path: `/api/fhir/images/${(inst.title ?? '').replace(/^.*\//, '')}`,
          })),
        ),
      ),
    [patientCase],
  );

  const encounterTimeline = useMemo(() => {
    const dateMap = new Map<
      string,
      {
        date: string;
        events: Array<{ type: 'visus' | 'crt' | 'injection' | 'oct'; label: string; octIdx?: number }>;
      }
    >();
    const ensure = (d: string) => {
      if (!dateMap.has(d)) dateMap.set(d, { date: d, events: [] });
      return dateMap.get(d)!;
    };
    visusObs.forEach((o) => {
      const d = o.effectiveDateTime?.substring(0, 10) ?? '';
      if (d) ensure(d).events.push({ type: 'visus', label: `Visus: ${o.valueQuantity?.value ?? '\u2014'}` });
    });
    crtObs.forEach((o) => {
      const d = o.effectiveDateTime?.substring(0, 10) ?? '';
      if (d) ensure(d).events.push({ type: 'crt', label: `CRT: ${o.valueQuantity?.value ?? '\u2014'} \u00b5m` });
    });
    injections.forEach((inj) => {
      const d = inj.performedDateTime?.substring(0, 10) ?? '';
      if (d) ensure(d).events.push({ type: 'injection', label: `${t('intravitralInjection')}` });
    });
    octImages.forEach((img, idx) => {
      if (img.date) ensure(img.date).events.push({ type: 'oct', label: `OCT: ${img.title}`, octIdx: idx });
    });
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [visusObs, crtObs, injections, octImages, t]);

  const iopData = useMemo(
    () =>
      iopObs.map((o) => ({
        date: o.effectiveDateTime?.substring(0, 10) ?? '',
        iop: o.valueQuantity?.value ?? 0,
      })),
    [iopObs],
  );

  // K3b: cohort IOP reference (median + IQR), aggregated by months-since-each-
  // peer's-own-baseline (same relative-time alignment + index-exclusion as
  // cohortReference, WR-04) and mapped back onto the index patient's IOP dates
  // (calendar-date axis per K3c). Folded onto each iopData row as iopMedian +
  // iopBand ([p25, p75]) so the IOP chart reads them as extra dataKeys.
  const iopDataWithReference = useMemo((): IopDataPoint[] => {
    if (!iopData.length || !cases.length) return iopData;

    // The index patient's baseline for bucketing its own rows = earliest IOP date.
    const indexBaseline = iopData
      .map((d) => d.date)
      .filter(Boolean)
      .reduce((min, d) => (!min || d < min ? d : min), '');

    const iopByRelMonth = new Map<number, number[]>();
    for (const c of cases) {
      if (patientCase && c.id === patientCase.id) continue; // WR-04: exclude index
      const peerIop = getObservationsByCode(c.observations, LOINC_IOP);
      const peerDates: string[] = [];
      for (const o of peerIop) {
        const d = o.effectiveDateTime?.substring(0, 10);
        if (d) peerDates.push(d);
      }
      if (!peerDates.length) continue;
      const peerBaseline = peerDates.reduce((min, d) => (d < min ? d : min), peerDates[0]);
      for (const o of peerIop) {
        const d = o.effectiveDateTime?.substring(0, 10) ?? '';
        const val = o.valueQuantity?.value;
        if (!d || val == null) continue;
        const bucket = Math.round(monthsBetween(peerBaseline, d));
        const arr = iopByRelMonth.get(bucket) ?? [];
        arr.push(val);
        iopByRelMonth.set(bucket, arr);
      }
    }

    if (!iopByRelMonth.size) return iopData;

    return iopData.map((row) => {
      const bucket = Math.round(monthsBetween(indexBaseline, row.date));
      const vals = iopByRelMonth.get(bucket);
      if (!vals || !vals.length) return row;
      const sorted = [...vals].sort((a, b) => a - b);
      return {
        ...row,
        iopMedian: +percentile(sorted, 0.5).toFixed(1),
        iopBand: [+percentile(sorted, 0.25).toFixed(1), +percentile(sorted, 0.75).toFixed(1)] as [number, number],
      };
    });
  }, [iopData, cases, patientCase]);

  // FALL-011 + J3c: cohort median + IQR reference series, aligned to the
  // patient's RELATIVE-time axis (months since the patient's first visit).
  //
  // WR-04: the index/current patient is EXCLUDED from the cohort buckets so the
  //   band is a true peer comparison (a patient is never compared against a band
  //   that includes itself).
  // J3c (relative aggregation): each peer is bucketed by months since THAT peer's
  //   OWN baseline (its earliest visus/crt date) — NOT by absolute calendar month.
  //   This is the clinically-correct comparison the tester asked for: peers are
  //   aligned to their own start-of-treatment, then compared at the same elapsed
  //   time. Buckets are integer months (round of the relative offset) so visits
  //   that fall in the same month-since-baseline aggregate together; each index
  //   patient row resolves its reference from the bucket matching round(relMonths).
  const cohortReference = useMemo((): CohortReferencePoint[] => {
    if (!combinedData.length || !cases.length) return [];

    // Build per-relative-month buckets from the PEER cohort only.
    const visusByRelMonth = new Map<number, number[]>();
    const crtByRelMonth = new Map<number, number[]>();

    for (const c of cases) {
      if (patientCase && c.id === patientCase.id) continue; // WR-04: exclude index patient
      const peerVisus = getObservationsByCode(c.observations, LOINC_VISUS);
      const peerCrt = getObservationsByCode(c.observations, LOINC_CRT);
      // This peer's own baseline = earliest of its visus/crt observation dates.
      const peerDates: string[] = [];
      for (const o of peerVisus) {
        const d = o.effectiveDateTime?.substring(0, 10);
        if (d) peerDates.push(d);
      }
      for (const o of peerCrt) {
        const d = o.effectiveDateTime?.substring(0, 10);
        if (d) peerDates.push(d);
      }
      if (!peerDates.length) continue;
      const peerBaseline = peerDates.reduce((min, d) => (d < min ? d : min), peerDates[0]);

      for (const o of peerVisus) {
        const d = o.effectiveDateTime?.substring(0, 10) ?? '';
        if (!d) continue;
        const val = o.valueQuantity?.value;
        if (val == null) continue;
        const bucket = Math.round(monthsBetween(peerBaseline, d));
        const arr = visusByRelMonth.get(bucket) ?? [];
        arr.push(val);
        visusByRelMonth.set(bucket, arr);
      }
      for (const o of peerCrt) {
        const d = o.effectiveDateTime?.substring(0, 10) ?? '';
        if (!d) continue;
        const val = o.valueQuantity?.value;
        if (val == null) continue;
        const bucket = Math.round(monthsBetween(peerBaseline, d));
        const arr = crtByRelMonth.get(bucket) ?? [];
        arr.push(val);
        crtByRelMonth.set(bucket, arr);
      }
    }

    return combinedData
      .map((point): CohortReferencePoint | null => {
        const bucket = Math.round(point.relMonths);
        const visusVals = visusByRelMonth.get(bucket);
        const crtVals = crtByRelMonth.get(bucket);

        const hasVisus = visusVals && visusVals.length > 0;
        const hasCrt = crtVals && crtVals.length > 0;
        if (!hasVisus && !hasCrt) return null;

        // Emit the reference keyed by the patient's relative month so the overlay
        // series share the chart's numeric x-domain (dataKey="relMonths").
        const ref: CohortReferencePoint = { date: point.date, relMonths: point.relMonths };

        if (hasVisus) {
          const sorted = [...visusVals].sort((a, b) => a - b);
          ref.visusMedian = percentile(sorted, 0.5);
          ref.visusP25 = percentile(sorted, 0.25);
          ref.visusP75 = percentile(sorted, 0.75);
        }
        if (hasCrt) {
          const sorted = [...crtVals].sort((a, b) => a - b);
          ref.crtMedian = percentile(sorted, 0.5);
          ref.crtP25 = percentile(sorted, 0.25);
          ref.crtP75 = percentile(sorted, 0.75);
        }

        return ref;
      })
      .filter((p): p is CohortReferencePoint => p !== null);
  }, [combinedData, cases, patientCase]);

  // FALL-011 (A3 v2): fold the cohort reference fields onto the patient's
  // combinedData rows by date, producing a SINGLE data array for the chart.
  // Reference Areas/Lines then read their dataKeys from this array with no own
  // `data` prop — axis-domain distortion becomes structurally impossible.
  //
  // The IQR bands are stored as range tuples ([p25, p75]) so they can be drawn
  // with a single translucent range-Area each (no white paint-over masking).
  const combinedDataWithReference = useMemo((): CombinedDataPoint[] => {
    if (!cohortReference.length) return combinedData;
    const refByDate = new Map(cohortReference.map((r) => [r.date, r]));
    return combinedData.map((point) => {
      const ref = refByDate.get(point.date);
      if (!ref) return point;
      const merged: CombinedDataPoint = { ...point };
      if (ref.visusMedian != null) merged.visusMedian = ref.visusMedian;
      if (ref.visusP25 != null && ref.visusP75 != null) {
        merged.visusBand = [ref.visusP25, ref.visusP75];
      }
      if (ref.crtMedian != null) merged.crtMedian = ref.crtMedian;
      if (ref.crtP25 != null && ref.crtP75 != null) {
        merged.crtBand = [ref.crtP25, ref.crtP75];
      }
      return merged;
    });
  }, [combinedData, cohortReference]);

  return {
    cohortAvgVisus,
    cohortAvgCrt,
    cohortReference,
    combinedDataWithReference,
    hasInterpolatedPoints,
    visusObs,
    crtObs,
    iopObs,
    hba1cObs,
    injections,
    refractionObs,
    anteriorFindings,
    posteriorFindings,
    ophthalmicAnamnesis,
    nonOphthalmicAnamnesis,
    adverseEvents,
    primaryDiagnoses,
    treatmentIndication,
    eyeLaterality,
    diabetesCond,
    crtData,
    combinedData,
    visusDistribution,
    crtDistribution,
    visusDistributionWithCohort,
    crtDistributionWithCohort,
    visusCrtScatter,
    cohortVisusCrtScatter,
    baselineData,
    baselineChangeWithReference,
    totalEncounters,
    hasCriticalValues,
    criticalCrtCount,
    criticalVisusCount,
    criticalIopCount,
    octImages,
    encounterTimeline,
    iopData,
    iopDataWithReference,
  };
}
