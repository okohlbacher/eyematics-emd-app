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
import { LOINC_VISUS, SNOMED_EYE_RIGHT, SNOMED_EYE_LEFT } from './fhirCodes';
import { decimalToLogmar } from './cohortTrajectory';
import type { PatientCase, Observation } from './types/fhir';

export type ResponderEye = 'od' | 'os' | 'combined';

export interface ResponderBuckets {
  responder: PatientCase[];
  partial: PatientCase[];
  nonResponder: PatientCase[];
}

/** Day-365 window: a measurement must fall within 365 ± 180 days to count. */
const YEAR_1_WINDOW_DAYS = 180;
const YEAR_1_TARGET_DAYS = 365;

/**
 * Determine eye laterality from an Observation bodySite.
 * Supports both SNOMED right/left eye codes known in the codebase and
 * alternative SNOMED codes used in test fixtures.
 */
function eyeFromBodySite(bodySite: unknown): 'od' | 'os' | null {
  if (!bodySite || typeof bodySite !== 'object') return null;
  const concept = bodySite as { coding?: Array<{ code?: string }> };
  const coding = concept.coding;
  if (!Array.isArray(coding) || coding.length === 0) return null;
  const code = coding[0]?.code;
  if (!code) return null;
  // Primary SNOMED codes (production data)
  if (code === SNOMED_EYE_RIGHT) return 'od';
  if (code === SNOMED_EYE_LEFT) return 'os';
  // Alternative SNOMED codes used in test fixtures
  // 24028007 = Right eye structure; 8966001 = Left eye structure
  if (code === '24028007') return 'od';
  if (code === '8966001') return 'os';
  return null;
}

function filterVisus(obs: Observation[], eye: 'od' | 'os' | null): Observation[] {
  return obs.filter((o) => {
    const isVisus = (o.code?.coding ?? []).some((c) => c?.code === LOINC_VISUS);
    if (!isVisus) return false;
    if (eye === null) return true;
    return eyeFromBodySite(o.bodySite) === eye;
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
