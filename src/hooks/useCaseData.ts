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

/** Per-date cohort percentile reference (FALL-011). */
export interface CohortReferencePoint {
  date: string;
  visusMedian?: number;
  visusP25?: number;
  visusP75?: number;
  crtMedian?: number;
  crtP25?: number;
  crtP75?: number;
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

  // Combined dual-axis data: merge visus + CRT by date
  const combinedData = useMemo(() => {
    const dateMap = new Map<
      string,
      { date: string; visus?: number; crt?: number; visusMeasured?: boolean; crtMeasured?: boolean }
    >();
    visusObs.forEach((o) => {
      const d = o.effectiveDateTime?.substring(0, 10) ?? '';
      const entry = dateMap.get(d) ?? { date: d };
      entry.visus = o.valueQuantity?.value;
      entry.visusMeasured = true;
      dateMap.set(d, entry);
    });
    crtObs.forEach((o) => {
      const d = o.effectiveDateTime?.substring(0, 10) ?? '';
      const entry = dateMap.get(d) ?? { date: d };
      entry.crt = o.valueQuantity?.value;
      entry.crtMeasured = true;
      dateMap.set(d, entry);
    });
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [visusObs, crtObs]);

  const visusDistribution = useMemo(() => computeVisusDistribution(visusObs), [visusObs]);
  const crtDistribution = useMemo(() => computeCrtDistribution(crtObs), [crtObs]);

  const visusCrtScatter = useMemo(
    () =>
      combinedData
        .filter((d) => d.visus != null && d.crt != null)
        .map((d) => ({ visus: d.visus!, crt: d.crt!, date: d.date })),
    [combinedData],
  );

  const baselineData = useMemo(() => {
    if (visusObs.length < 2) return [];
    const baselineVisus = visusObs[0]?.valueQuantity?.value ?? 0;
    const baselineCrt = crtObs[0]?.valueQuantity?.value ?? 0;
    const dateMap = new Map<string, { date: string; visusChange?: number; crtChange?: number }>();
    visusObs.forEach((o) => {
      const d = o.effectiveDateTime?.substring(0, 10) ?? '';
      const val = o.valueQuantity?.value ?? 0;
      const entry = dateMap.get(d) ?? { date: d };
      entry.visusChange = baselineVisus
        ? +((((val - baselineVisus) / baselineVisus) * 100).toFixed(1))
        : 0;
      dateMap.set(d, entry);
    });
    crtObs.forEach((o) => {
      const d = o.effectiveDateTime?.substring(0, 10) ?? '';
      const val = o.valueQuantity?.value ?? 0;
      const entry = dateMap.get(d) ?? { date: d };
      entry.crtChange = baselineCrt
        ? +((((val - baselineCrt) / baselineCrt) * 100).toFixed(1))
        : 0;
      dateMap.set(d, entry);
    });
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [visusObs, crtObs]);

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

  // FALL-011: cohort median + IQR reference series, aligned to the patient's dates.
  //
  // WR-04: the index/current patient is EXCLUDED from the cohort buckets so the
  //   band is a true peer comparison (a patient is never compared against a band
  //   that includes itself).
  // WR-05: cohort values are bucketed by MONTH ('YYYY-MM'), not exact day. Clinical
  //   visit dates rarely collide to the day across patients, so exact-date keying
  //   produced an empty overlay on realistic data. Each patient date now resolves
  //   its reference from the matching month bin, so the band/median render across
  //   the chart's date x-domain whenever the cohort has measurements in the
  //   patient's month span — even with no exact-day matches.
  const cohortReference = useMemo((): CohortReferencePoint[] => {
    if (!combinedData.length || !cases.length) return [];

    // Build per-month buckets from the PEER cohort only (exclude the current case).
    const visusByMonth = new Map<string, number[]>();
    const crtByMonth = new Map<string, number[]>();

    for (const c of cases) {
      if (patientCase && c.id === patientCase.id) continue; // WR-04: exclude index patient
      for (const o of getObservationsByCode(c.observations, LOINC_VISUS)) {
        const m = o.effectiveDateTime?.substring(0, 7) ?? ''; // YYYY-MM
        if (!m) continue;
        const val = o.valueQuantity?.value;
        if (val == null) continue;
        const bucket = visusByMonth.get(m) ?? [];
        bucket.push(val);
        visusByMonth.set(m, bucket);
      }
      for (const o of getObservationsByCode(c.observations, LOINC_CRT)) {
        const m = o.effectiveDateTime?.substring(0, 7) ?? ''; // YYYY-MM
        if (!m) continue;
        const val = o.valueQuantity?.value;
        if (val == null) continue;
        const bucket = crtByMonth.get(m) ?? [];
        bucket.push(val);
        crtByMonth.set(m, bucket);
      }
    }

    return combinedData
      .map((point): CohortReferencePoint | null => {
        const d = point.date;
        const month = d.substring(0, 7); // YYYY-MM
        const visusVals = visusByMonth.get(month);
        const crtVals = crtByMonth.get(month);

        const hasVisus = visusVals && visusVals.length > 0;
        const hasCrt = crtVals && crtVals.length > 0;
        if (!hasVisus && !hasCrt) return null;

        // Emit the reference keyed by the patient's exact date so the overlay
        // series share the chart's category x-domain (dataKey="date").
        const ref: CohortReferencePoint = { date: d };

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

  return {
    cohortAvgVisus,
    cohortAvgCrt,
    cohortReference,
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
    visusCrtScatter,
    baselineData,
    totalEncounters,
    hasCriticalValues,
    criticalCrtCount,
    criticalVisusCount,
    criticalIopCount,
    octImages,
    encounterTimeline,
    iopData,
  };
}
