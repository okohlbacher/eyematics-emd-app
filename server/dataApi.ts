/**
 * Data API router: per-user CRUD for quality flags, saved searches,
 * excluded cases, and reviewed cases.
 *
 * All routes are protected by authMiddleware (global on /api/*).
 * Per D-06: data is per-user, scoped by req.auth.preferred_username.
 *
 * Review concern #5: flaggedBy/flaggedAt derived server-side, client values ignored.
 * Review concern #4: quality_flags uses surrogate id (not composite PK).
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import {
  getQualityFlags,
  setQualityFlags,
  getSavedSearches,
  addSavedSearch,
  removeSavedSearch,
  getExcludedCases,
  setExcludedCases,
  getReviewedCases,
  setReviewedCases,
} from './dataDb.js';
import type { QualityFlagRow, SavedSearchRow } from './dataDb.js';
import { getCaseToCenter, isBypass } from './fhirApi.js';

export const dataApiRouter = Router();

/** Maximum array size for bulk replacement endpoints (review suggestion: cap list sizes) */
const MAX_ARRAY_SIZE = 10000;

// ---------------------------------------------------------------------------
// Center validation helper (CENTER-03, D-10, T-05-02)
// ---------------------------------------------------------------------------

/**
 * Validate that all case IDs belong to the user's permitted centers.
 * Returns an error message string if any case is outside permitted centers, or null if all pass.
 *
 * - Admin users and users with all centers bypass validation (same logic as isBypass).
 * - Unknown case IDs (not in FHIR cache) are REJECTED — prevents writes to
 *   unauthorized centers before cache warms (H-10).
 */
function validateCaseCenters(caseIds: string[], userCenters: string[], role: string): string | null {
  if (isBypass(role, userCenters)) return null;
  const index = getCaseToCenter();
  for (const caseId of caseIds) {
    const caseCenterId = index.get(caseId);
    if (!caseCenterId) {
      return `Case ${caseId} not found — data may not be loaded yet`;
    }
    if (!userCenters.includes(caseCenterId)) {
      return `Case ${caseId} not in user's permitted centers`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Quality Flags (DATA-01)
// ---------------------------------------------------------------------------

dataApiRouter.get('/quality-flags', (req: Request, res: Response): void => {
  const username = req.auth!.preferred_username;
  const flags = getQualityFlags(username);
  // Map snake_case DB rows to camelCase for client
  const qualityFlags = flags.map((f) => ({
    id: f.id,
    caseId: f.case_id,
    parameter: f.parameter,
    errorType: f.error_type,
    flaggedAt: f.flagged_at,
    flaggedBy: f.flagged_by,
    status: f.status,
  }));
  res.json({ qualityFlags });
});

dataApiRouter.put('/quality-flags', (req: Request, res: Response): void => {
  const username = req.auth!.preferred_username;
  const { qualityFlags } = req.body as { qualityFlags?: unknown[] };

  if (!Array.isArray(qualityFlags)) {
    res.status(400).json({ error: 'qualityFlags array is required' });
    return;
  }
  if (qualityFlags.length > MAX_ARRAY_SIZE) {
    res.status(400).json({ error: `qualityFlags array exceeds maximum size of ${MAX_ARRAY_SIZE}` });
    return;
  }

  // Map camelCase client data to snake_case DB rows
  // Review concern #5: IGNORE client-supplied flaggedBy and flaggedAt
  // Server derives flaggedBy from JWT username and flaggedAt from server time
  const now = new Date().toISOString();
  const rows: QualityFlagRow[] = (qualityFlags as Record<string, unknown>[]).map((f) => {
    const caseId = String(f['caseId'] ?? '');
    const parameter = String(f['parameter'] ?? '');
    const errorType = String(f['errorType'] ?? '');
    const status = String(f['status'] ?? 'open');
    return {
      id: typeof f['id'] === 'string' && f['id'] ? f['id'] : crypto.randomUUID(),
      case_id: caseId,
      parameter,
      error_type: errorType,
      // Server-derived fields (F-13): ALWAYS use server time and JWT username
      flagged_at: now,
      flagged_by: username, // ALWAYS from JWT, never from client
      status: ['open', 'acknowledged', 'resolved'].includes(status) ? status : 'open',
      updated_at: now,
    };
  });

  // Validate required fields
  const invalid = rows.some((r) => !r.case_id || !r.parameter || !r.error_type);
  if (invalid) {
    res.status(400).json({ error: 'Each quality flag must have caseId, parameter, and errorType' });
    return;
  }

  // Validate that all caseIds belong to centers the user is permitted to access (CENTER-03, T-05-02)
  const caseIds = (qualityFlags as Record<string, unknown>[]).map((f) => String(f['caseId'] ?? ''));
  const centerError = validateCaseCenters(caseIds, req.auth!.centers, req.auth!.role);
  if (centerError) {
    res.status(403).json({ error: centerError });
    return;
  }

  setQualityFlags(username, rows);

  // Return saved flags in camelCase
  const saved = getQualityFlags(username);
  res.json({
    qualityFlags: saved.map((f) => ({
      id: f.id,
      caseId: f.case_id,
      parameter: f.parameter,
      errorType: f.error_type,
      flaggedAt: f.flagged_at,
      flaggedBy: f.flagged_by,
      status: f.status,
    })),
  });
});

// ---------------------------------------------------------------------------
// Saved Searches (DATA-02)
// ---------------------------------------------------------------------------

dataApiRouter.get('/saved-searches', (req: Request, res: Response): void => {
  const username = req.auth!.preferred_username;
  const rows = getSavedSearches(username);
  const savedSearches: Array<{ id: string; name: string; createdAt: string; filters: unknown }> = [];
  for (const r of rows) {
    try {
      savedSearches.push({
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        filters: JSON.parse(r.filters) as unknown,
      });
    } catch {
      console.warn(`[dataApi] Skipping saved search "${r.id}": corrupt filters JSON`);
    }
  }
  res.json({ savedSearches });
});

dataApiRouter.post('/saved-searches', (req: Request, res: Response): void => {
  const username = req.auth!.preferred_username;
  const { id, name, createdAt, filters } = req.body as Record<string, unknown>;

  if (typeof id !== 'string' || !id.trim()) {
    res.status(400).json({ error: 'id is required' });
    return;
  }
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (filters === undefined || filters === null || typeof filters !== 'object') {
    res.status(400).json({ error: 'filters object is required' });
    return;
  }

  // Cap serialized filters size to prevent garbage rows (review suggestion)
  const filtersStr = JSON.stringify(filters);
  if (filtersStr.length > 50000) {
    res.status(400).json({ error: 'filters object is too large' });
    return;
  }

  // Validate center ownership for any explicit case IDs in filters (CENTER-03)
  const filtersObj = typeof filters === 'object' && filters !== null ? filters as Record<string, unknown> : {};
  const searchCaseIds: string[] = [];
  if (Array.isArray(filtersObj['caseIds'])) searchCaseIds.push(...filtersObj['caseIds'].map(String));
  if (Array.isArray(filtersObj['selectedCases'])) searchCaseIds.push(...filtersObj['selectedCases'].map(String));
  if (searchCaseIds.length > 0) {
    const centerError = validateCaseCenters(searchCaseIds, req.auth!.centers, req.auth!.role);
    if (centerError) {
      res.status(403).json({ error: centerError });
      return;
    }
  }

  const row: SavedSearchRow = {
    id: id.trim(),
    name: name.trim(),
    created_at: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
    filters: filtersStr,
    updated_at: new Date().toISOString(),
  };

  addSavedSearch(username, row);

  res.status(201).json({
    savedSearch: {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      filters: JSON.parse(row.filters) as unknown,
    },
  });
});

dataApiRouter.delete('/saved-searches/:id', (req: Request, res: Response): void => {
  const username = req.auth!.preferred_username;
  removeSavedSearch(username, String(req.params.id ?? ''));
  res.json({ message: 'Saved search deleted' });
});

// ---------------------------------------------------------------------------
// Excluded Cases (DATA-03)
// ---------------------------------------------------------------------------

dataApiRouter.get('/excluded-cases', (req: Request, res: Response): void => {
  const username = req.auth!.preferred_username;
  res.json({ excludedCases: getExcludedCases(username) });
});

dataApiRouter.put('/excluded-cases', (req: Request, res: Response): void => {
  const username = req.auth!.preferred_username;
  const { excludedCases } = req.body as { excludedCases?: unknown[] };

  if (!Array.isArray(excludedCases)) {
    res.status(400).json({ error: 'excludedCases array is required' });
    return;
  }
  if (excludedCases.length > MAX_ARRAY_SIZE) {
    res.status(400).json({ error: `excludedCases array exceeds maximum size of ${MAX_ARRAY_SIZE}` });
    return;
  }

  const caseIds = excludedCases.filter((c): c is string => typeof c === 'string');

  // Validate center ownership (matching quality-flags pattern)
  const centerError = validateCaseCenters(caseIds, req.auth!.centers, req.auth!.role);
  if (centerError) {
    res.status(403).json({ error: centerError });
    return;
  }

  setExcludedCases(username, caseIds);
  res.json({ excludedCases: getExcludedCases(username) });
});

// ---------------------------------------------------------------------------
// Reviewed Cases (DATA-04)
// ---------------------------------------------------------------------------

dataApiRouter.get('/reviewed-cases', (req: Request, res: Response): void => {
  const username = req.auth!.preferred_username;
  res.json({ reviewedCases: getReviewedCases(username) });
});

dataApiRouter.put('/reviewed-cases', (req: Request, res: Response): void => {
  const username = req.auth!.preferred_username;
  const { reviewedCases } = req.body as { reviewedCases?: unknown[] };

  if (!Array.isArray(reviewedCases)) {
    res.status(400).json({ error: 'reviewedCases array is required' });
    return;
  }
  if (reviewedCases.length > MAX_ARRAY_SIZE) {
    res.status(400).json({ error: `reviewedCases array exceeds maximum size of ${MAX_ARRAY_SIZE}` });
    return;
  }

  const caseIds = reviewedCases.filter((c): c is string => typeof c === 'string');

  // Validate center ownership (matching quality-flags pattern)
  const centerError = validateCaseCenters(caseIds, req.auth!.centers, req.auth!.role);
  if (centerError) {
    res.status(403).json({ error: centerError });
    return;
  }

  setReviewedCases(username, caseIds);
  res.json({ reviewedCases: getReviewedCases(username) });
});
