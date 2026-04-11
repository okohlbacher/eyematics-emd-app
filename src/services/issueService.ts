// Issue reporting service — stores issues on the server filesystem via /api/issues

import { authFetch } from './authHeaders';

export interface ReportedIssue {
  id: string;
  timestamp: string;
  user: string;
  page: string;
  description: string;
  screenshot?: string; // base64 data URL
  hasScreenshot?: boolean; // set when screenshot is stripped in listing
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
  return resp.json();
}

/**
 * Fetch the issue count from the server.
 */
export async function getIssueCount(): Promise<number> {
  const issues = await getIssues();
  return issues.length;
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `emd-issues-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}
