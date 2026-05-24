/**
 * Phase 13 / METRIC-03 / D-05 — Responder classification.
 *
 * Classifies each PatientCase × eye into responder / partial / non-responder
 * buckets by comparing the year-1 visus to baseline (ETDRS letters).
 *
 * Sign convention: lower logMAR = better vision. Improvement = negative delta.
 *  - Responder: deltaLogmar ≤ -thresholdLogmar
 *  - Non-responder: deltaLogmar ≥ +thresholdLogmar
 *  - Partial: between (exclusive)
 *
 * Threshold conversion: thresholdLogmar = thresholdLetters * 0.02
 * (5 ETDRS letters = 0.1 logMAR = 1 ETDRS line)
 */
import { decimalToLogmar } from './cohortTrajectory';
import { LOINC_VISUS } from './fhirCodes';
import { resolveEye } from './laterality';
import type { Observation,PatientCase } from './types/fhir';

export type ResponderEye = 'od' | 'os' | 'combined';

export interface ResponderBuckets {
  responder: PatientCase[];
  partial: PatientCase[];
  nonResponder: PatientCase[];
}

/** Day-365 window: a measurement must fall within 365 ± 180 days to count. */
const YEAR_1_WINDOW_DAYS = 180;
const YEAR_1_TARGET_DAYS = 365;

function filterVisus(obs: Observation[], eye: 'od' | 'os' | null): Observation[] {
  return obs.filter((o) => {
    const isVisus = (o.code?.coding ?? []).some((c) => c?.code === LOINC_VISUS);
    if (!isVisus) return false;
    if (eye === null) return true;
    return resolveEye(o.bodySite) === eye;
  });
}

/** Given visus observations for one eye, return deltaLogmar at day-365 or null if not classifiable. */
function deltaAtYear1(visus: Observation[]): number | null {
  const valid = visus
    .filter(
      (o) =>
        typeof o.effectiveDateTime === 'string' &&
        typeof o.valueQuantity?.value === 'number' &&
        o.valueQuantity.value > 0,
    )
    .map((o) => ({
      date: new Date(o.effectiveDateTime as string).getTime(),
      decimal: o.valueQuantity!.value as number,
    }))
    .filter((m) => Number.isFinite(m.date))
    .sort((a, b) => a.date - b.date);

  if (valid.length < 2) return null;

  const baselineMs = valid[0].date;
  const baselineLogmar = decimalToLogmar(valid[0].decimal);

  if (!Number.isFinite(baselineLogmar)) return null;

  // Find measurement whose days-from-baseline is closest to 365.
  let best: { deltaDays: number; logmar: number } | null = null;
  for (const m of valid.slice(1)) {
    const days = (m.date - baselineMs) / 86400000;
    const deltaFromTarget = Math.abs(days - YEAR_1_TARGET_DAYS);
    if (deltaFromTarget > YEAR_1_WINDOW_DAYS) continue;
    if (!best || deltaFromTarget < Math.abs(best.deltaDays - YEAR_1_TARGET_DAYS)) {
      const logmar = decimalToLogmar(m.decimal);
      if (!Number.isFinite(logmar)) continue;
      best = { deltaDays: days, logmar };
    }
  }

  if (!best) return null;
  return best.logmar - baselineLogmar;
}

// ---------------------------------------------------------------------------
// Per-eye responder row projector (F-06) — shared by the CSV export path.
//
// classifyResponders (above) projects per PATIENT with a combined-eye averaging
// rule for chart bucket counts. The CSV export needs flat per-EYE rows with the
// year-1 measurement date and the signed letter delta. This projector owns that
// transform so OutcomesDataPreview no longer reimplements year-1 selection and
// bucket assignment. Behavior matches the prior in-component flattener exactly:
//   - per-eye visus series sorted by date string
//   - year-1 window via calendar arithmetic: [baseline-180d, baseline+1y+180d],
//     target = baseline + 1 calendar year, pick the closest measurement after
//     baseline within that window
//   - bucket via thresholdLogmar = max(0, thresholdLetters) * 0.02
//   - delta_visus_letters = round(-deltaLogmar / 0.02) (improvement = positive)
// ---------------------------------------------------------------------------

export interface ResponderExportRow {
  patient_pseudonym: string;
  eye: 'od' | 'os';
  bucket: string;
  delta_visus_letters: number;
  measurement_date: string;
}

function deltaLogmarAtYear1(
  obs: Array<{ date: string; logmar: number }>,
): { delta: number; measurementDate: string } | null {
  if (obs.length < 2) return null;
  const baseline = obs[0];
  const year1Min = new Date(baseline.date);
  year1Min.setDate(year1Min.getDate() - 180);
  const year1Max = new Date(baseline.date);
  year1Max.setDate(year1Max.getDate() + 180);
  year1Max.setFullYear(year1Max.getFullYear() + 1);

  let best: { delta: number; measurementDate: string } | null = null;
  let minDist = Infinity;

  for (const o of obs.slice(1)) {
    const d = new Date(o.date);
    const target = new Date(baseline.date);
    target.setFullYear(target.getFullYear() + 1);
    if (d < year1Min || d > year1Max) continue;
    const dist = Math.abs(d.getTime() - target.getTime());
    if (dist < minDist) {
      minDist = dist;
      best = { delta: o.logmar - baseline.logmar, measurementDate: o.date };
    }
  }
  return best;
}

export function projectResponderRows(
  cases: PatientCase[],
  thresholdLetters: number,
): ResponderExportRow[] {
  const thresholdLogmar = Math.max(0, thresholdLetters) * 0.02;
  const rows: ResponderExportRow[] = [];

  for (const pc of cases) {
    const visusByEye: Record<'od' | 'os', Array<{ date: string; logmar: number }>> = {
      od: [],
      os: [],
    };

    for (const obs of pc.observations ?? []) {
      const isVisus = (obs.code?.coding ?? []).some((c) => c.code === LOINC_VISUS);
      if (!isVisus) continue;

      const e = resolveEye(obs.bodySite);
      if (e !== 'od' && e !== 'os') continue;

      const decimal =
        typeof obs.valueQuantity?.value === 'number' ? obs.valueQuantity.value : NaN;
      if (!Number.isFinite(decimal) || decimal <= 0) continue;

      const date =
        typeof obs.effectiveDateTime === 'string' ? obs.effectiveDateTime.slice(0, 10) : '';
      if (!date) continue;

      visusByEye[e].push({ date, logmar: decimalToLogmar(decimal) });
    }

    (['od', 'os'] as const).forEach((eye) => {
      visusByEye[eye].sort((a, b) => a.date.localeCompare(b.date));
      const result = deltaLogmarAtYear1(visusByEye[eye]);
      if (!result) return;

      const { delta, measurementDate } = result;
      const bucket =
        delta <= -thresholdLogmar ? 'responder' : delta >= thresholdLogmar ? 'non-responder' : 'partial';
      const deltaLetters = Math.round(-delta / 0.02); // improvement = positive letters

      rows.push({
        patient_pseudonym: pc.pseudonym,
        eye,
        bucket,
        delta_visus_letters: deltaLetters,
        measurement_date: measurementDate,
      });
    });
  }

  return rows;
}

export function classifyResponders(
  cases: PatientCase[],
  thresholdLetters: number,
  eye: ResponderEye,
): ResponderBuckets {
  const thresholdLogmar = Math.max(0, thresholdLetters) * 0.02;

  const buckets: ResponderBuckets = { responder: [], partial: [], nonResponder: [] };

  for (const pc of cases ?? []) {
    const obs = pc.observations ?? [];
    let deltaLogmar: number | null = null;

    if (eye === 'combined') {
      const odDelta = deltaAtYear1(filterVisus(obs, 'od'));
      const osDelta = deltaAtYear1(filterVisus(obs, 'os'));
      if (odDelta !== null && osDelta !== null) deltaLogmar = (odDelta + osDelta) / 2;
      else if (odDelta !== null) deltaLogmar = odDelta;
      else if (osDelta !== null) deltaLogmar = osDelta;
    } else {
      deltaLogmar = deltaAtYear1(filterVisus(obs, eye));
    }

    if (deltaLogmar === null) continue; // exclude from all buckets

    if (deltaLogmar <= -thresholdLogmar) buckets.responder.push(pc);
    else if (deltaLogmar >= thresholdLogmar) buckets.nonResponder.push(pc);
    else buckets.partial.push(pc);
  }

  return buckets;
}
