// Issue reporting service — stores issues on the server filesystem via /api/issues

import { downloadBlob } from '../utils/download';
import { authFetch } from './authHeaders';

export interface ReportedIssue {
  id: string;
  timestamp: string;
  user: string;
  page: string;
  description: string;
  screenshot?: string; // base64 data URL
  hasScreenshot?: boolean; // set when screenshot is stripped in listing
  appVersion?: string; // build version from package.json, injected by Vite
}

/**
 * Submit a new issue to the server.
 * The server writes it as a JSON file in the `feedback/` directory.
 */
export async function addIssue(
  issue: Omit<ReportedIssue, 'id' | 'timestamp'>
): Promise<{ id: string; filename: string }> {
  const resp = await authFetch('/api/issues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(issue),
  });
  if (!resp.ok) {
    throw new Error(`Failed to save issue: ${resp.status}`);
  }
  return resp.json();
}

/**
 * Fetch all issues from the server (without screenshot data).
 */
export async function getIssues(): Promise<ReportedIssue[]> {
  const resp = await authFetch('/api/issues');
  if (!resp.ok) return [];
  const data = await resp.json() as { issues: ReportedIssue[] };
  return data.issues;
}

/**
 * Fetch the issue count from the server.
 */
// F-28: use total field from server instead of fetching all issues
export async function getIssueCount(): Promise<number> {
  const resp = await authFetch('/api/issues');
  if (!resp.ok) return 0;
  const data = await resp.json() as { total: number };
  return data.total;
}

/**
 * Delete all issues on the server (admin-only).
 * Returns the number of deleted files.
 */
export async function deleteAllIssues(): Promise<number> {
  const resp = await authFetch('/api/issues', { method: 'DELETE' });
  if (!resp.ok) {
    throw new Error(`Failed to delete issues: ${resp.status}`);
  }
  const data = await resp.json() as { deleted: number };
  return data.deleted;
}

/**
 * Export all issues (with screenshots) as a JSON file download.
 * Fetches with auth headers, then triggers browser download.
 */
export async function exportIssuesFull(): Promise<void> {
  const resp = await authFetch('/api/issues/export');
  if (!resp.ok) {
    console.error('[issueService] Export failed:', resp.status);
    return;
  }
  const blob = await resp.blob();
  downloadBlob(blob, `emd-issues-${new Date().toISOString().slice(0, 10)}.json`);
}
