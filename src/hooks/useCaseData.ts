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
    crtObs.some((o) => (o.valueQuantity?.value ?? 0) > CRITICAL_CRT_THRESHOLD) ||
    visusObs.some((o) => (o.valueQuantity?.value ?? 0) < CRITICAL_VISUS_THRESHOLD);

  const criticalCrtCount = crtObs.filter(
    (o) => (o.valueQuantity?.value ?? 0) > CRITICAL_CRT_THRESHOLD,
  ).length;
  const criticalVisusCount = visusObs.filter(
    (o) => (o.valueQuantity?.value ?? 0) < CRITICAL_VISUS_THRESHOLD,
  ).length;
  const criticalIopCount = iopObs.filter(
    (o) => (o.valueQuantity?.value ?? 0) > CRITICAL_IOP_THRESHOLD,
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

  return {
    cohortAvgVisus,
    cohortAvgCrt,
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
