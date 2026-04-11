import { Download, FileText, Filter } from 'lucide-react';
import { useEffect,useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authFetch } from '../services/authHeaders';
import { getDateLocale } from '../utils/dateFormat';
import { datedFilename,downloadCsv } from '../utils/download';

interface ServerAuditEntry {
  id: number;
  timestamp: string;
  method: string;
  path: string;
  user: string;
  status: number;
  duration_ms: number;
}

type TimeRange = 'today' | '7d' | '30d' | 'all';

// ---------------------------------------------------------------------------
// Map raw (method, path) to a semantic audit_action_* translation key.
// Only meaningful user actions are shown; noise (health checks, static assets)
// is filtered out by isRelevantEntry().
// ---------------------------------------------------------------------------

type TranslationFn = (key: string, ...args: string[]) => string;

function describeAction(method: string, path: string, t: TranslationFn): string {
  if (method === 'POST' && path === '/api/auth/login') return t('audit_action_login');
  if (method === 'POST' && path === '/api/auth/logout') return t('audit_action_logout');
  if (method === 'POST' && path === '/api/auth/users') return t('audit_action_create_user');
  if (method === 'DELETE' && path.startsWith('/api/auth/users/')) return t('audit_action_delete_user');
  if (method === 'PUT' && path === '/api/settings') return t('audit_action_update_settings');
  if (method === 'GET' && path === '/api/settings') return t('audit_action_view_settings');
  if (method === 'POST' && path === '/api/quality/flags') return t('audit_action_flag_error');
  if (method === 'PUT' && path.startsWith('/api/quality/flags/')) return t('audit_action_update_flag');
  if (method === 'POST' && path.startsWith('/api/quality/exclude/')) return t('audit_action_exclude_case');
  if (method === 'DELETE' && path.startsWith('/api/quality/exclude/')) return t('audit_action_include_case');
  if (method === 'POST' && path.startsWith('/api/quality/reviewed/')) return t('audit_action_save_search');
  if (method === 'POST' && path === '/api/cohort/searches') return t('audit_action_save_search');
  if (method === 'DELETE' && path.startsWith('/api/cohort/searches/')) return t('audit_action_delete_search');
  if (method === 'GET' && path.startsWith('/api/fhir/')) return t('audit_action_data_access');
  if (method === 'GET' && path.startsWith('/api/audit')) return t('audit_action_view_audit');
  return t('audit_action_unknown');
}

function describeDetail(method: string, path: string, user: string, t: TranslationFn): string {
  if (method === 'POST' && path === '/api/auth/login') return t('audit_detail_login', user);
  if (method === 'POST' && path === '/api/auth/logout') return t('audit_detail_logout');
  if (method === 'DELETE' && path.startsWith('/api/auth/users/')) {
    const username = path.split('/').pop() ?? '';
    return t('audit_detail_delete_user', decodeURIComponent(username));
  }
  if (method === 'GET' && path.startsWith('/api/fhir/cases/')) {
    const caseId = path.replace('/api/fhir/cases/', '').split('/')[0];
    return t('audit_detail_view_case', caseId);
  }
  return '';
}

/** Filter out noise — only show entries that represent meaningful user actions. */
function isRelevantEntry(entry: ServerAuditEntry): boolean {
  const { method, path } = entry;
  // Always show mutations
  if (method !== 'GET') return true;
  // Show specific meaningful GETs
  if (path === '/api/settings') return true;
  if (path.startsWith('/api/audit')) return true;
  if (path.startsWith('/api/fhir/cases/')) return true;
  // Filter out bulk data loads, auth config checks, and other noise
  return false;
}

function statusBadgeClass(status: number): string {
  if (status >= 500) return 'bg-red-100 text-red-700';
  if (status >= 400) return 'bg-amber-100 text-amber-700';
  if (status >= 300) return 'bg-blue-100 text-blue-700';
  if (status >= 200) return 'bg-green-100 text-green-700';
  return 'bg-gray-100 text-gray-700';
}

function getTimeRangeStart(range: TimeRange): number {
  const now = new Date();
  switch (range) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return start.getTime();
    }
    case '7d':  return now.getTime() - 7  * 24 * 60 * 60 * 1000;
    case '30d': return now.getTime() - 30 * 24 * 60 * 60 * 1000;
    default:    return 0;
  }
}

export default function AuditPage() {
  const { locale, t } = useLanguage();
  const { user } = useAuth();

  const [entries, setEntries]     = useState<ServerAuditEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Filter state
  const [timeRange, setTimeRange]       = useState<TimeRange>('all');
  const [showFilters, setShowFilters]   = useState(false);

  const dateFmt = getDateLocale(locale);

  // Load entries from the server on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchAudit() {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch('/api/audit?limit=500&offset=0');
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        const data = (await res.json()) as { entries: ServerAuditEntry[]; total: number };
        if (!cancelled) {
          setEntries(data.entries);
          setTotal(data.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load audit log');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchAudit();
    return () => { cancelled = true; };
  }, []);

  // Client-side filter + sort on the already-fetched 500 entries
  const filteredEntries = useMemo(() => {
    const rangeStart = getTimeRangeStart(timeRange);

    return entries
      .filter((e) => {
        if (!isRelevantEntry(e)) return false;
        if (new Date(e.timestamp).getTime() < rangeStart) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries, timeRange]);

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
    const resp = await authFetch('/api/audit/export');
    if (!resp.ok) return;
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-6 h-6" />
          {t('auditTitle')}
        </h1>
        <p className="text-gray-500 mt-1">{t('auditSubtitle')}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {t('auditEntries')}:{' '}
          <span className="font-semibold text-gray-900">
            {filteredEntries.length === entries.length
              ? total
              : `${filteredEntries.length} ${t('auditFilteredOf')} ${total}`}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {t('filterCriteria')}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={filteredEntries.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {t('auditExportCsv')}
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              {t('auditExportJson')}
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
              {t('auditFilterTime')}
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 max-w-xs"
            >
              <option value="all">{t('auditAllTime')}</option>
              <option value="today">{t('auditToday')}</option>
              <option value="7d">{t('auditLast7Days')}</option>
              <option value="30d">{t('auditLast30Days')}</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading / error states */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Loading audit log…
        </div>
      )}

      {!loading && error && (
        <div className="bg-white rounded-xl border border-red-200 p-8 text-center text-red-500">
          {error}
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filteredEntries.length === 0 ? (
            <div className="p-8 text-center text-gray-400">{t('auditEmpty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      {t('auditTime')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      {t('auditUser')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      {t('auditAction')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      {t('auditDetail')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      {t('auditStatus')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString(dateFmt, {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {entry.user}
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {describeAction(entry.method, entry.path, t)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
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
