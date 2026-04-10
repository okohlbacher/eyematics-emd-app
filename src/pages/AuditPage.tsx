import { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getAuditLog, clearAuditLog, type AuditEntry, type AuditAction } from '../services/auditService';
import type { TranslationKey } from '../i18n/translations';
import { FileText, Trash2, Download, Filter } from 'lucide-react';
import { downloadCsv, datedFilename } from '../utils/download';
import { getDateLocale } from '../utils/dateFormat';

// Action categories for filtering
const ACTION_CATEGORIES: Record<string, AuditAction[]> = {
  auth: ['login', 'logout', 'auto_logout'],
  views: ['view_landing', 'view_cohort', 'view_analysis', 'view_case', 'view_quality', 'view_admin', 'view_audit'],
  quality: ['flag_error', 'update_flag', 'exclude_case', 'include_case', 'save_search', 'delete_search'],
  admin: ['create_user', 'delete_user'],
};

type TimeRange = 'today' | '7d' | '30d' | 'all';

function actionBadgeClass(action: string): string {
  if (['login', 'logout', 'auto_logout'].includes(action)) return 'bg-blue-100 text-blue-700';
  if (action.startsWith('view_')) return 'bg-gray-100 text-gray-700';
  if (['save_search', 'delete_search'].includes(action)) return 'bg-green-100 text-green-700';
  if (['flag_error', 'update_flag'].includes(action)) return 'bg-amber-100 text-amber-700';
  if (['exclude_case', 'include_case'].includes(action)) return 'bg-red-100 text-red-700';
  if (['create_user', 'delete_user'].includes(action)) return 'bg-purple-100 text-purple-700';
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
  const [entries, setEntries] = useState<AuditEntry[]>(() => getAuditLog());

  // Filter state
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  const dateFmt = getDateLocale(locale);

  /** Translate an action key to a localized label */
  const translateAction = (action: AuditAction): string => {
    const key = `audit_action_${action}` as TranslationKey;
    try { return t(key); } catch { return action; }
  };

  /** Translate a detail key with argument interpolation */
  const translateDetail = (entry: AuditEntry): string => {
    const key = entry.detailKey as TranslationKey;
    let text: string;
    try { text = t(key); } catch { text = entry.detailKey; }
    // Replace {0}, {1}, ... with detailArgs
    if (entry.detailArgs) {
      entry.detailArgs.forEach((arg, i) => {
        text = text.replace(`{${i}}`, arg);
      });
    }
    return text;
  };

  // Filtered & sorted entries
  const filteredEntries = useMemo(() => {
    const rangeStart = getTimeRangeStart(timeRange);
    const allowedActions = categoryFilter === 'all'
      ? null
      : ACTION_CATEGORIES[categoryFilter] ?? null;

    return entries
      .filter((e) => {
        if (new Date(e.timestamp).getTime() < rangeStart) return false;
        if (allowedActions && !allowedActions.includes(e.action)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries, timeRange, categoryFilter]);

  const handleClear = () => {
    clearAuditLog();
    setEntries([]);
  };

  const handleExportCsv = () => {
    const headers = [t('auditTime'), t('auditUser'), t('auditAction'), t('auditDetail'), 'Resource'];
    const rows = filteredEntries.map((e) => [
      new Date(e.timestamp).toLocaleString(dateFmt, { dateStyle: 'short', timeStyle: 'medium' }),
      e.user,
      translateAction(e.action),
      translateDetail(e),
      e.resource ?? '',
    ]);

    downloadCsv(headers, rows, datedFilename('audit-log', 'csv'));
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
            disabled={filteredEntries.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {t('auditExportCsv')}
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {t('auditClear')}
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
            {/* Event type */}
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
                <option value="views">{t('auditCategoryView')}</option>
                <option value="quality">{t('auditCategoryQuality')}</option>
                <option value="admin">{t('auditCategoryAdmin')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
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
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${actionBadgeClass(entry.action)}`}
                      >
                        {translateAction(entry.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {translateDetail(entry)}
                      {entry.resource && (
                        <span className="ml-1 text-gray-400">({entry.resource})</span>
                      )}
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
