import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { fetchAuditEntries, exportAuditLog, type ServerAuditEntry } from '../services/auditService';
import { FileText, Download, Filter } from 'lucide-react';
import { downloadCsv, datedFilename } from '../utils/download';
import { getDateLocale } from '../utils/dateFormat';

// Path-based categories for filtering server audit entries
const PATH_CATEGORIES: Record<string, (entry: ServerAuditEntry) => boolean> = {
  auth: (e) => e.path.startsWith('/api/auth'),
  data: (e) => e.path.startsWith('/api/issues') || e.path.startsWith('/api/data'),
  settings: (e) => e.path.startsWith('/api/settings'),
  audit: (e) => e.path.startsWith('/api/audit'),
};

type TimeRange = 'today' | '7d' | '30d' | 'all';

function methodBadgeClass(method: string): string {
  switch (method) {
    case 'GET': return 'bg-gray-100 text-gray-700';
    case 'POST': return 'bg-green-100 text-green-700';
    case 'PUT': return 'bg-amber-100 text-amber-700';
    case 'DELETE': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}

function statusBadgeClass(status: number): string {
  if (status >= 200 && status < 300) return 'bg-green-100 text-green-700';
  if (status >= 400 && status < 500) return 'bg-amber-100 text-amber-700';
  if (status >= 500) return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-700';
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

  // Filtered & sorted entries (client-side time range + category on fetched data)
  const filteredEntries = useMemo(() => {
    const rangeStart = getTimeRangeStart(timeRange);
    const categoryFn = categoryFilter === 'all' ? null : PATH_CATEGORIES[categoryFilter] ?? null;

    return entries
      .filter((e) => {
        if (new Date(e.timestamp).getTime() < rangeStart) return false;
        if (categoryFn && !categoryFn(e)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries, timeRange, categoryFilter]);

  const handleExportCsv = async () => {
    if (user?.role === 'admin') {
      // Admin: fetch full server export
      try {
        const allEntries = await exportAuditLog();
        const headers = ['Timestamp', 'Method', 'Path', 'User', 'Status', 'Duration (ms)'];
        const rows = allEntries.map((e) => [
          new Date(e.timestamp).toLocaleString(dateFmt, { dateStyle: 'short', timeStyle: 'medium' }),
          e.method,
          e.path,
          e.user,
          String(e.status),
          String(e.duration_ms),
        ]);
        downloadCsv(headers, rows, datedFilename('audit-log-full', 'csv'));
      } catch (err) {
        console.error('Audit export failed:', err);
      }
    } else {
      // Non-admin: export currently displayed entries
      const headers = ['Timestamp', 'Method', 'Path', 'User', 'Status', 'Duration (ms)'];
      const rows = filteredEntries.map((e) => [
        new Date(e.timestamp).toLocaleString(dateFmt, { dateStyle: 'short', timeStyle: 'medium' }),
        e.method,
        e.path,
        e.user,
        String(e.status),
        String(e.duration_ms),
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
            {loading
              ? '...'
              : filteredEntries.length === entries.length
              ? entries.length
              : `${filteredEntries.length} ${t('auditFilteredOf')} ${entries.length}`}
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
            disabled={filteredEntries.length === 0 || loading}
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
            {/* Event category */}
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
                <option value="data">Data</option>
                <option value="settings">{t('auditCategoryAdmin')}</option>
                <option value="audit">Audit</option>
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
        ) : filteredEntries.length === 0 ? (
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Duration (ms)
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
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs break-all">
                      {entry.path}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(entry.status)}`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-right font-mono">
                      {entry.duration_ms}
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
