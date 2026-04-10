/**
 * Audit service — read-only client for server-side audit log.
 * All audit writes happen server-side via auditMiddleware.
 * This service only reads from GET /api/audit.
 */
import { getAuthHeaders } from './authHeaders';

export interface ServerAuditEntry {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  user: string;
  status: number;
  duration_ms: number;
  body: string | null;
  query: string | null;
}

export async function fetchAuditEntries(filters?: {
  user?: string;
  path?: string;
  fromTime?: string;
  toTime?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: ServerAuditEntry[]; total: number }> {
  const params = new URLSearchParams();
  if (filters?.user) params.set('user', filters.user);
  if (filters?.path) params.set('path', filters.path);
  if (filters?.fromTime) params.set('fromTime', filters.fromTime);
  if (filters?.toTime) params.set('toTime', filters.toTime);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const url = '/api/audit' + (params.toString() ? '?' + params.toString() : '');
  const resp = await fetch(url, { headers: getAuthHeaders() });
  if (!resp.ok) throw new Error(`Audit fetch failed: ${resp.status}`);
  return resp.json();
}

export async function exportAuditLog(): Promise<ServerAuditEntry[]> {
  const resp = await fetch('/api/audit/export', { headers: getAuthHeaders() });
  if (!resp.ok) throw new Error(`Audit export failed: ${resp.status}`);
  return resp.json();
}
