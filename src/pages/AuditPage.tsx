import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getAuthHeaders } from '../services/authHeaders';
import { FileText, Download, Filter } from 'lucide-react';
import { downloadCsv, datedFilename } from '../utils/download';
import { getDateLocale } from '../utils/dateFormat';

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
type MethodFilter = 'all' | 'GET' | 'POST' | 'PUT' | 'DELETE';

const HTTP_METHODS: MethodFilter[] = ['all', 'GET', 'POST', 'PUT', 'DELETE'];

function methodBadgeClass(method: string): string {
  switch (method) {
    case 'GET':    return 'bg-gray-100 text-gray-700';
    case 'POST':   return 'bg-blue-100 text-blue-700';
    case 'PUT':    return 'bg-amber-100 text-amber-700';
    case 'DELETE': return 'bg-red-100 text-red-700';
    default:       return 'bg-gray-100 text-gray-700';
  }
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
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [showFilters, setShowFilters]   = useState(false);

  const dateFmt = getDateLocale(locale);

  // Load entries from the server on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchAudit() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/audit?limit=500&offset=0', {
          headers: getAuthHeaders(),
        });
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
        if (new Date(e.timestamp).getTime() < rangeStart) return false;
        if (methodFilter !== 'all' && e.method !== methodFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries, timeRange, methodFilter]);

  const handleExportCsv = () => {
    const headers = [t('auditTime'), t('auditUser'), 'Method', 'Path', 'Status'];
    const rows = filteredEntries.map((e) => [
      new Date(e.timestamp).toLocaleString(dateFmt, { dateStyle: 'short', timeStyle: 'medium' }),
      e.user,
      e.method,
      e.path,
      String(e.status),
    ]);
    downloadCsv(headers, rows, datedFilename('audit-log', 'csv'));
  };

  const handleExportJson = () => {
    window.open('/api/audit/export', '_blank');
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
              Export JSON
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Time range */}
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
            {/* HTTP method */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                {t('auditFilterType')}
              </label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as MethodFilter)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m === 'all' ? t('auditFilterAll') : m}
                  </option>
                ))}
              </select>
            </div>
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
                      Method
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      Path
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                      Status
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
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${methodBadgeClass(entry.method)}`}
                        >
                          {entry.method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {entry.path}
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
