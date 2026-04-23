/**
 * Phase 12 / AGG-03 / D-13 — client wrapper for POST /api/outcomes/aggregate.
 *
 * Routes cohorts larger than settings.outcomes.serverAggregationThresholdPatients
 * to the server endpoint. On non-OK responses the caller catches + falls back to
 * client-side computeCohortTrajectory.
 *
 * retained: live client wrapper (not a re-export shim). Listed as a Phase 22
 * shim candidate by 22-RESEARCH but per D-15 it is not a dedup target — this
 * file holds the browser-only `authFetch` + body serialization logic for the
 * POST /api/outcomes/aggregate endpoint.
 */
import { authFetch } from './authHeaders';
import type {
  AxisMode,
  Eye,
  GridPoint,
  PatientSeries,
  SpreadMode,
  YMetric,
} from '../utils/cohortTrajectory';

export interface AggregateRequest {
  cohortId: string;
  axisMode: AxisMode;
  yMetric: YMetric;
  gridPoints: number;
  eye: Eye;
  spreadMode?: SpreadMode;
  includePerPatient?: boolean;
  includeScatter?: boolean;
  metric?: 'visus' | 'crt';  // optional for backward compat — absent defaults to 'visus' on server
}

export interface AggregateResponse {
  median: GridPoint[];
  iqrLow: number[];
  iqrHigh: number[];
  perPatient?: PatientSeries[];
  scatter?: Array<{ x: number; y: number; patientId: string }>;
  meta: {
    patientCount: number;
    excludedCount: number;
    measurementCount: number;
    cacheHit: boolean;
  };
}

export async function postAggregate(body: AggregateRequest): Promise<AggregateResponse> {
  const resp = await authFetch('/api/outcomes/aggregate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!resp.ok) {
    throw new Error(`Server aggregate failed: ${resp.status}`);
  }
  return (await resp.json()) as AggregateResponse;
}
