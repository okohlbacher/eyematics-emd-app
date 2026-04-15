// EMDREQ-PROT-001: Audit logging service
// Logs all data access events with timestamps
// Detail strings use locale-neutral keys for i18n translation at display time

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: AuditAction;
  /** Locale-neutral detail key, e.g. 'audit_detail_login' */
  detailKey: string;
  /** Optional interpolation arguments for the detail string */
  detailArgs?: string[];
  resource?: string;
}

export type AuditAction =
  | 'login'
  | 'logout'
  | 'view_landing'
  | 'view_cohort'
  | 'view_analysis'
  | 'view_case'
  | 'view_quality'
  | 'view_admin'
  | 'view_audit'
  | 'view_doc_quality'
  | 'save_search'
  | 'delete_search'
  | 'flag_error'
  | 'update_flag'
  | 'exclude_case'
  | 'include_case'
  | 'create_user'
  | 'delete_user'
  | 'auto_logout'
  | 'change_setting';

const STORAGE_KEY = 'emd-audit-log';
import { MAX_AUDIT_ENTRIES } from '../config/clinicalThresholds';
import { safeJsonParse } from '../utils/safeJson';
const MAX_ENTRIES = MAX_AUDIT_ENTRIES;

function loadEntries(): AuditEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? safeJsonParse<AuditEntry[]>(stored, []) : [];
}

function saveEntries(entries: AuditEntry[]): void {
  // Keep only last MAX_ENTRIES
  const trimmed = entries.slice(-MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

/**
 * Log an audit event with a locale-neutral detail key.
 * @param user - username
 * @param action - action type
 * @param detailKey - i18n key for the detail message
 * @param detailArgs - optional interpolation arguments (e.g. case ID, username)
 * @param resource - optional resource identifier
 */
export function logAudit(
  user: string,
  action: AuditAction,
  detailKey: string,
  detailArgs?: string[],
  resource?: string
): void {
  const entries = loadEntries();
  entries.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    user,
    action,
    detailKey,
    detailArgs,
    resource,
  });
  saveEntries(entries);
}

export function getAuditLog(): AuditEntry[] {
  return loadEntries();
}

export function clearAuditLog(): void {
  localStorage.removeItem(STORAGE_KEY);
}
