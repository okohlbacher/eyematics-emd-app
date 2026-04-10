import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { fetchAuditEntries, exportAuditLog, type ServerAuditEntry } from '../services/auditService';
import type { TranslationKey } from '../i18n/translations';
import { FileText, Download, Filter } from 'lucide-react';
import { downloadCsv, datedFilename } from '../utils/download';
import { getDateLocale } from '../utils/dateFormat';

/**
 * Maps a raw server audit entry (method + path + status) to a human-readable
 * event with translated action and detail strings.
 * Returns null for entries that should be hidden (noise like config fetches).
 */
interface AuditEvent {
  raw: ServerAuditEntry;
  actionKey: TranslationKey;
  detailKey: TranslationKey | null;
  detailParam: string | null;
  category: 'auth' | 'navigation' | 'data' | 'settings' | 'admin';
}

function classifyEntry(e: ServerAuditEntry): AuditEvent | null {
  const p = e.path;
  const m = e.method;

  // --- Auth events ---
  if (p === '/api/auth/login' && m === 'POST') {
    if (e.status >= 200 && e.status < 300) {
      return { raw: e, actionKey: 'audit_action_login', detailKey: 'audit_detail_login', detailParam: e.user, category: 'auth' };
    }
    // Failed login — still interesting
    return { raw: e, actionKey: 'audit_action_login', detailKey: null, detailParam: null, category: 'auth' };
  }
  if (p === '/api/auth/verify' && m === 'POST') {
    return { raw: e, actionKey: 'audit_action_login', detailKey: null, detailParam: null, category: 'auth' };
  }

  // Hide noise: config fetch, user list fetch, audit reads
  if (p === '/api/auth/config' || p === '/api/auth/users') return null;
  if (p.startsWith('/api/audit')) return null;

  // --- Page views (GET on known pages inferred from API patterns) ---
  if (m === 'GET' && p === '/api/issues') {
    return { raw: e, actionKey: 'audit_action_view_cohort', detailKey: 'audit_detail_view_cohort', detailParam: null, category: 'navigation' };
  }
  if (m === 'GET' && p.startsWith('/api/issues/')) {
    const caseId = p.split('/').pop() ?? '';
    return { raw: e, actionKey: 'audit_action_view_case', detailKey: 'audit_detail_view_case', detailParam: caseId, category: 'navigation' };
  }

  // --- Data mutations ---
  if (m === 'POST' && p === '/api/issues') {
    return { raw: e, actionKey: 'audit_action_flag_error', detailKey: 'audit_detail_flag_error', detailParam: '', category: 'data' };
  }

  // --- Settings ---
  if (p.startsWith('/api/settings') && (m === 'POST' || m === 'PUT')) {
    return { raw: e, actionKey: 'audit_action_save_search', detailKey: null, detailParam: null, category: 'settings' };
  }
  if (p.startsWith('/api/settings') && m === 'GET') {
    return null; // hide settings reads
  }

  // Catch-all for any other API call — show as generic entry
  return null;
}

type TimeRange = 'today' | '7d' | '30d' | 'all';

function statusIcon(status: number): string {
  if (status >= 200 && status < 300) return '✓';
  if (status >= 400 && status < 500) return '✗';
  if (status >= 500) return '⚠';
  return '';
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600';
  if (status >= 400 && status < 500) return 'text-amber-600';
  if (status >= 500) return 'text-red-600';
  return 'text-gray-600';
}

function categoryBadgeClass(cat: AuditEvent['category']): string {
  switch (cat) {
    case 'auth': return 'bg-blue-100 text-blue-700';
    case 'navigation': return 'bg-gray-100 text-gray-700';
    case 'data': return 'bg-green-100 text-green-700';
    case 'settings': return 'bg-amber-100 text-amber-700';
    case 'admin': return 'bg-purple-100 text-purple-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function getTimeRangeStart(range: TimeRange): number {
  const now = new Date();
  switch (range) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return start.getTime();
    }
    case '7d': return now.getTime() - 7 * 24 * 60 * 60 * 1000;
    case '30d': return now.getTime() - 30 * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

export default function AuditPage() {
  const { locale, t } = useLanguage();
  const { user } = useAuth();

  const [entries, setEntries] = useState<ServerAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const dateFmt = getDateLocale(locale);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAuditEntries({ limit: 500 })
      .then(result => {
        if (!cancelled) {
          setEntries(result.entries);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    fetchAuditEntries({ limit: 500 })
      .then(result => { setEntries(result.entries); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  };

  // Classify raw entries into human-readable events, filter noise
  const events = useMemo(() => {
    const rangeStart = getTimeRangeStart(timeRange);

    return entries
      .map(classifyEntry)
      .filter((ev): ev is AuditEvent => {
        if (!ev) return false;
        if (new Date(ev.raw.timestamp).getTime() < rangeStart) return false;
        if (categoryFilter !== 'all' && ev.category !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.raw.timestamp).getTime() - new Date(a.raw.timestamp).getTime());
  }, [entries, timeRange, categoryFilter]);

  /** Resolve a translation key, replacing {0} with param */
  function resolveDetail(key: TranslationKey | null, param: string | null): string {
    if (!key) return '';
    const str = t(key);
    return param ? str.replace('{0}', param) : str;
  }

  const handleExportCsv = async () => {
    if (user?.role === 'admin') {
      try {
        const allEntries = await exportAuditLog();
        const allEvents = allEntries.map(classifyEntry).filter((ev): ev is AuditEvent => ev !== null);
        const headers = [t('auditTime'), t('auditUser'), t('auditAction'), t('auditDetail')];
        const rows = allEvents.map((ev) => [
          new Date(ev.raw.timestamp).toLocaleString(dateFmt, { dateStyle: 'short', timeStyle: 'medium' }),
          ev.raw.user,
          t(ev.actionKey),
          resolveDetail(ev.detailKey, ev.detailParam),
        ]);
        downloadCsv(headers, rows, datedFilename('audit-log-full', 'csv'));
      } catch (err) {
        console.error('Audit export failed:', err);
      }
    } else {
      const headers = [t('auditTime'), t('auditUser'), t('auditAction'), t('auditDetail')];
      const rows = events.map((ev) => [
        new Date(ev.raw.timestamp).toLocaleString(dateFmt, { dateStyle: 'short', timeStyle: 'medium' }),
        ev.raw.user,
        t(ev.actionKey),
        resolveDetail(ev.detailKey, ev.detailParam),
      ]);
      downloadCsv(headers, rows, datedFilename('audit-log', 'csv'));
    }
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
            {loading ? '...' : events.length}
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
            disabled={events.length === 0 || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {t('auditExportCsv')}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                {t('auditFilterTime')}
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="all">{t('auditAllTime')}</option>
                <option value="today">{t('auditToday')}</option>
                <option value="7d">{t('auditLast7Days')}</option>
                <option value="30d">{t('auditLast30Days')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                {t('auditFilterType')}
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              >
                <option value="all">{t('auditFilterAll')}</option>
                <option value="auth">{t('auditCategoryAuth')}</option>
                <option value="navigation">{t('auditCategoryView')}</option>
                <option value="data">{t('auditCategoryQuality')}</option>
                <option value="settings">{t('auditCategoryAdmin')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-red-600 mb-3">{error}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-10">
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((ev) => (
                  <tr key={ev.raw.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(ev.raw.timestamp).toLocaleString(dateFmt, {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {ev.raw.user}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${categoryBadgeClass(ev.category)}`}>
                        {t(ev.actionKey)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {resolveDetail(ev.detailKey, ev.detailParam)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={statusClass(ev.raw.status)}>{statusIcon(ev.raw.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
