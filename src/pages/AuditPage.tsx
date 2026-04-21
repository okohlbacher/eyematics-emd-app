import { Download, FileText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import { authFetch } from '../services/authHeaders';
import { getDateLocale } from '../utils/dateFormat';
import { datedFilename, downloadBlob, downloadCsv } from '../utils/download';

interface ServerAuditEntry {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  user: string;
  status: number;
  duration_ms: number;
}

// ---------------------------------------------------------------------------
// Map raw (method, path) to a semantic audit_action_* translation key.
// Only meaningful user actions are shown; noise (health checks, static assets)
// is filtered out by isRelevantEntry().
// ---------------------------------------------------------------------------

type TranslationFn = (key: TranslationKey) => string;

function describeAction(method: string, path: string, t: TranslationFn): string {
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

function describeDetail(method: string, path: string, user: string, t: TranslationFn): string {
  if (method === 'POST' && path === '/api/auth/login') return t('audit_detail_login').replace('{0}', user);
  if (method === 'POST' && path === '/api/auth/verify') return t('audit_detail_login').replace('{0}', user);
  if (method === 'DELETE' && path.startsWith('/api/auth/users/')) {
    const username = path.split('/').pop() ?? '';
    return t('audit_detail_delete_user').replace('{0}', decodeURIComponent(username));
  }
  return '';
}

/** Filter out noise — only show entries that represent meaningful user actions. */
function isRelevantEntry(entry: ServerAuditEntry): boolean {
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

function statusBadgeClass(status: number): string {
  if (status >= 500) return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
  if (status >= 400) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  if (status >= 300) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
  if (status >= 200) return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

export default function AuditPage() {
  const { locale, t } = useLanguage();
  const { user } = useAuth();

  const [entries, setEntries]     = useState<ServerAuditEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Filter state (5 controls per UI-SPEC D-01..D-04)
  const [filterUser, setFilterUser] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<'' | 'auth' | 'data' | 'admin' | 'outcomes'>('');
  const [filterFrom, setFilterFrom] = useState<string>('');   // YYYY-MM-DD
  const [filterTo, setFilterTo] = useState<string>('');       // YYYY-MM-DD
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [filterFailures, setFilterFailures] = useState<boolean>(false);

  const dateFmt = getDateLocale(locale);

  // Admin check + distinct user list for dropdown
  const isAdmin = user?.role === 'admin';
  const distinctUsers = useMemo(
    () => Array.from(new Set(entries.map(e => e.user).filter(Boolean))).sort(),
    [entries]
  );

  // Debounced server-side fetch (300ms) — fires on any filter change
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: '500', offset: '0' });
      if (filterUser) params.set('user', filterUser);
      if (filterCategory) params.set('action_category', filterCategory);
      if (filterFrom) params.set('fromTime', filterFrom);
      if (filterTo) params.set('toTime', `${filterTo}T23:59:59`);
      if (filterSearch) params.set('body_search', filterSearch);
      if (filterFailures) params.set('status_gte', '400');
      try {
        const res = await authFetch(`/api/audit?${params.toString()}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json() as { entries: ServerAuditEntry[]; total: number };
        if (!cancelled) { setEntries(data.entries); setTotal(data.total); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load audit log');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filterUser, filterCategory, filterFrom, filterTo, filterSearch, filterFailures]);

  // Client-side relevance filter + sort on the already-fetched entries
  const filteredEntries = useMemo(() => {
    return entries
      .filter(isRelevantEntry)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries]);

  const handleExportCsv = () => {
    const headers = [t('auditTime'), t('auditUser'), t('auditAction'), t('auditDetail'), t('auditStatus')];
    const rows = filteredEntries.map((e) => [
      new Date(e.timestamp).toLocaleString(dateFmt, { dateStyle: 'short', timeStyle: 'medium' }),
      e.user,
      describeAction(e.method, e.path, t),
      describeDetail(e.method, e.path, e.user, t),
      String(e.status),
    ]);
    downloadCsv(headers, rows, datedFilename('audit-log', 'csv'));
  };

  const handleExportJson = async () => {
    try {
      const resp = await authFetch('/api/audit/export');
      if (!resp.ok) {
        console.error('[AuditPage] Export failed:', resp.status);
        return;
      }
      const blob = await resp.blob();
      downloadBlob(blob, datedFilename('audit-export', 'json'));
    } catch (err) {
      console.error('[AuditPage] Export network error:', err);
    }
  };

  return (
    <div className="p-8 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FileText className="w-6 h-6" />
          {t('auditTitle')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('auditSubtitle')}</p>
      </div>

      {/* 5-control filter panel */}
      <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700 flex flex-wrap items-end gap-3">
        {isAdmin && (
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 dark:text-gray-400">{t('auditFilterUser')}</label>
            <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 max-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t('auditFilterAllUsers')}</option>
              {distinctUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 dark:text-gray-400">{t('auditFilterCategory')}</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as typeof filterCategory)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 max-w-[180px] focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">{t('auditFilterAllCategories')}</option>
            <option value="auth">{t('auditCategoryAuth')}</option>
            <option value="data">{t('auditCategoryData')}</option>
            <option value="admin">{t('auditCategoryAdmin')}</option>
            <option value="outcomes">{t('auditCategoryOutcomes')}</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 dark:text-gray-400">{t('auditFilterFrom')}</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 max-w-[140px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 dark:text-gray-400">{t('auditFilterTo')}</label>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 max-w-[140px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {isAdmin && (
          <div className="flex flex-col flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 dark:text-gray-400">{t('auditFilterCohortHash')}</label>
            <input type="search" value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
              placeholder={t('auditFilterCohortHash')}
              maxLength={128}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={filterFailures} onChange={e => setFilterFailures(e.target.checked)} />
          {t('auditFilterFailuresOnly')}
        </label>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('auditEntries')}:{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {filteredEntries.length === total
              ? total
              : `${filteredEntries.length} ${t('auditFilteredOf')} ${total}`}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={filteredEntries.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 dark:text-gray-300"
          >
            <Download className="w-4 h-4" />
            {t('auditExportCsv')}
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors dark:text-gray-300"
            >
              <Download className="w-4 h-4" />
              {t('auditExportJson')}
            </button>
          )}
        </div>
      </div>

      {/* Loading / error states */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500">
          Loading audit log…
        </div>
      )}

      {!loading && error && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-8 text-center text-red-500">
          {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">{t('auditEmptyFiltered')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('auditTime')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('auditUser')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('auditAction')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('auditDetail')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t('auditStatus')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString(dateFmt, {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {entry.user}
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                        {describeAction(entry.method, entry.path, t)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-sm">
                        {describeDetail(entry.method, entry.path, entry.user, t)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(entry.status)}`}
                        >
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
