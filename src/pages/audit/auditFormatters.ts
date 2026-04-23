/**
 * Phase 19 / AUDIT-03: Pure formatter helpers — moved VERBATIM from AuditPage.tsx lines 21-85.
 * No logic changes. Phase 20 SESSION-13 will extend `describeAction` from this location.
 */
import type { ServerAuditEntry } from './auditPageState';
import type { TranslationKey } from '../../i18n/translations';

// ---------------------------------------------------------------------------
// Map raw (method, path) to a semantic audit_action_* translation key.
// Only meaningful user actions are shown; noise (health checks, static assets)
// is filtered out by isRelevantEntry().
// ---------------------------------------------------------------------------

export type TranslationFn = (key: TranslationKey) => string;

export function describeAction(method: string, path: string, t: TranslationFn): string {
  // Auth actions
  if (method === 'POST' && path === '/api/auth/login') return t('audit_action_login');
  if (method === 'POST' && path === '/api/auth/verify') return t('audit_action_login');
  if (method === 'POST' && path === '/api/auth/users') return t('audit_action_create_user');
  if (method === 'DELETE' && path.startsWith('/api/auth/users/')) return t('audit_action_delete_user');
  // Settings
  if (method === 'PUT' && path === '/api/settings') return t('audit_action_update_settings');
  if (method === 'GET' && path === '/api/settings') return t('audit_action_view_settings');
  // Quality flags (actual routes: /api/data/quality-flags)
  if (method === 'PUT' && path === '/api/data/quality-flags') return t('audit_action_update_flag');
  // Saved searches (actual routes: /api/data/saved-searches)
  if (method === 'POST' && path === '/api/data/saved-searches') return t('audit_action_save_search');
  if (method === 'DELETE' && path.startsWith('/api/data/saved-searches/')) return t('audit_action_delete_search');
  // Excluded cases (actual routes: /api/data/excluded-cases)
  if (method === 'PUT' && path === '/api/data/excluded-cases') return t('audit_action_exclude_case');
  // Reviewed cases (actual routes: /api/data/reviewed-cases)
  if (method === 'PUT' && path === '/api/data/reviewed-cases') return t('audit_action_update_flag');
  // Issue reporting
  if (method === 'POST' && path === '/api/issues') return t('audit_action_flag_error');
  // Data access
  if (method === 'GET' && path === '/api/fhir/bundles') return t('audit_action_data_access');
  // Audit log
  if (method === 'GET' && path.startsWith('/api/audit')) return t('audit_action_view_audit');
  return t('audit_action_unknown');
}

export function describeDetail(method: string, path: string, user: string, t: TranslationFn): string {
  if (method === 'POST' && path === '/api/auth/login') return t('audit_detail_login').replace('{0}', user);
  if (method === 'POST' && path === '/api/auth/verify') return t('audit_detail_login').replace('{0}', user);
  if (method === 'DELETE' && path.startsWith('/api/auth/users/')) {
    const username = path.split('/').pop() ?? '';
    return t('audit_detail_delete_user').replace('{0}', decodeURIComponent(username));
  }
  return '';
}

/** Filter out noise — only show entries that represent meaningful user actions. */
export function isRelevantEntry(entry: ServerAuditEntry): boolean {
  const { method, path } = entry;
  // Always show mutations (POST, PUT, DELETE)
  if (method !== 'GET') return true;
  // Show specific meaningful GETs
  if (path === '/api/settings') return true;
  if (path.startsWith('/api/audit')) return true;
  if (path === '/api/fhir/bundles') return true;
  // Filter out auth config checks, user/me lookups, center lists, and other noise
  return false;
}

export function statusBadgeClass(status: number): string {
  if (status >= 500) return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
  if (status >= 400) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  if (status >= 300) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
  if (status >= 200) return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}
