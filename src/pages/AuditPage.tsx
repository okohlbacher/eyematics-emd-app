import { Download, FileText } from 'lucide-react';
import { useMemo } from 'react';

import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authFetch } from '../services/authHeaders';
import { getDateLocale } from '../utils/dateFormat';
import { datedFilename, downloadBlob, downloadCsv } from '../utils/download';
import { describeAction, describeDetail, statusBadgeClass } from './audit/auditFormatters';
import { selectDistinctUsers, selectFilteredEntries } from './audit/auditPageState';
import { useAuditData } from './audit/useAuditData';

export default function AuditPage() {
  const { locale, t } = useLanguage();
  const { user } = useAuth();

  const { state, dispatch } = useAuditData();
  const { entries, total, loading, error, filters } = state;

  const dateFmt = getDateLocale(locale);

  // Admin check + distinct user list for dropdown
  const isAdmin = user?.role === 'admin';
  const distinctUsers = useMemo(() => selectDistinctUsers(entries), [entries]);

  // Client-side relevance filter + sort on the already-fetched entries
  const filteredEntries = useMemo(() => selectFilteredEntries(entries), [entries]);

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

      {/* 6-dim filter state managed via useAuditData hook */}
      <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700 flex flex-wrap items-end gap-3">
        {isAdmin && (
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 dark:text-gray-400">{t('auditFilterUser')}</label>
            <select value={filters.user} onChange={e => dispatch({ type: 'FILTER_SET', key: 'user', value: e.target.value })}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 max-w-[160px] focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">{t('auditFilterAllUsers')}</option>
              {distinctUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 dark:text-gray-400">{t('auditFilterCategory')}</label>
          <select value={filters.category} onChange={e => dispatch({ type: 'FILTER_SET', key: 'category', value: e.target.value as typeof filters.category })}
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
          <input type="date" value={filters.fromDate} onChange={e => dispatch({ type: 'FILTER_SET', key: 'fromDate', value: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 max-w-[140px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 uppercase mb-1 dark:text-gray-400">{t('auditFilterTo')}</label>
          <input type="date" value={filters.toDate} onChange={e => dispatch({ type: 'FILTER_SET', key: 'toDate', value: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 max-w-[140px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {isAdmin && (
          <div className="flex flex-col flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 dark:text-gray-400">{t('auditFilterCohortHash')}</label>
            <input type="search" value={filters.search} onChange={e => dispatch({ type: 'FILTER_SET', key: 'search', value: e.target.value })}
              placeholder={t('auditFilterCohortHash')}
              maxLength={128}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={filters.failuresOnly} onChange={e => dispatch({ type: 'FILTER_SET', key: 'failuresOnly', value: e.target.checked })} />
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
