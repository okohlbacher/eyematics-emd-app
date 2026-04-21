import { ArrowUpDown, Building2, CheckCircle,Database, Filter, Microscope, Search, Shield, ShieldCheck, Stethoscope, Trash2, UserPlus } from 'lucide-react';
import { useCallback,useEffect, useMemo, useState } from 'react';

import type { UserRole } from '../context/AuthContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import { authFetch } from '../services/authHeaders';
import { getDateLocale } from '../utils/dateFormat';

interface CenterOption { id: string; label: string }

interface ServerUser {
  username: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  centers: string[];
  createdAt: string;
  lastLogin?: string;
}

/** Map role to translation key */
function getRoleLabel(role: UserRole, t: (k: TranslationKey) => string): string {
  switch (role) {
    case 'admin': return t('roleAdmin');
    case 'researcher': return t('roleResearcher');
    case 'epidemiologist': return t('roleEpidemiologist');
    case 'clinician': return t('roleClinician');
    case 'data_manager': return t('roleDataManager');
    case 'clinic_lead': return t('roleClinicLead');
    default: return role;
  }
}

function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'admin': return <ShieldCheck className="w-4 h-4 text-amber-500" />;
    case 'researcher': return <Microscope className="w-4 h-4 text-blue-500" />;
    case 'epidemiologist': return <Shield className="w-4 h-4 text-green-500" />;
    case 'clinician': return <Stethoscope className="w-4 h-4 text-purple-500" />;
    case 'data_manager': return <Database className="w-4 h-4 text-cyan-500" />;
    case 'clinic_lead': return <Building2 className="w-4 h-4 text-rose-500" />;
    default: return <Shield className="w-4 h-4 text-gray-500" />;
  }
}

type SortField = 'username' | 'role' | 'center' | 'createdAt' | 'lastLogin';
type SortDir = 'asc' | 'desc';

export default function AdminPage() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();

  const dateFmt = getDateLocale(locale);

  const [users, setUsers] = useState<ServerUser[]>([]);
  const [centerOptions, setCenterOptions] = useState<CenterOption[]>([]);
  const [centerLabels, setCenterLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('researcher');
  const [selectedCenters, setSelectedCenters] = useState<string[]>([]);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Search, filter, sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // F-03: Auto-clear generated password after 30 seconds
  useEffect(() => {
    if (!generatedPassword) return;
    const timer = setTimeout(() => setGeneratedPassword(null), 30_000);
    return () => clearTimeout(timer);
  }, [generatedPassword]);

  const loadUsers = useCallback(async () => {
    setLoadError(null);
    try {
      const resp = await authFetch('/api/auth/users');
      if (resp.ok) {
        const data = await resp.json() as { users: ServerUser[] };
        setUsers(data.users);
      } else {
        setLoadError(`Server returned ${resp.status}`);
      }
    } catch (err) {
      console.error('[AdminPage] Failed to load users:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  // F-20: Load center options from server instead of hardcoding
  useEffect(() => {
    authFetch('/api/fhir/centers')
      .then((r) => r.ok ? r.json() as Promise<{ centers: Array<{ id: string; shorthand: string }> }> : null)
      .then((data) => {
        if (data?.centers) {
          setCenterOptions(data.centers.map((c) => ({ id: c.id, label: c.shorthand })));
          setCenterLabels(Object.fromEntries(data.centers.map((c) => [c.id, c.shorthand])));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      void loadUsers();
    }
  }, [loadUsers, user?.role]);

  const getCentersDisplay = useCallback((u: ServerUser): string => {
    if (u.centers && u.centers.length > 0) {
      return u.centers.map((c) => centerLabels[c] ?? c).join(', ');
    }
    return '—';
  }, [centerLabels]);

  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          getCentersDisplay(u).toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter);
    }

    // Center filter (VQA-01 / D-09)
    if (centerFilter !== 'all') {
      result = result.filter((u) => Array.isArray(u.centers) && u.centers.includes(centerFilter));
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'username':
          cmp = a.username.localeCompare(b.username);
          break;
        case 'role':
          cmp = a.role.localeCompare(b.role);
          break;
        case 'center':
          cmp = getCentersDisplay(a).localeCompare(getCentersDisplay(b));
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'lastLogin':
          cmp = new Date(a.lastLogin ?? 0).getTime() - new Date(b.lastLogin ?? 0).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [users, searchQuery, roleFilter, centerFilter, sortField, sortDir, getCentersDisplay]);

  // --- Early return AFTER all hooks ---
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center max-w-md">
          <Shield className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300 text-lg">{t('adminOnlyHint')}</p>
        </div>
      </div>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const toggleCenter = (c: string) => {
    setSelectedCenters((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const handleAdd = async () => {
    if (!username.trim()) return;

    try {
      const resp = await authFetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          role,
          centers: selectedCenters.length > 0 ? selectedCenters : [],
        }),
      });

      if (resp.ok) {
        const data = await resp.json() as { user: ServerUser; generatedPassword: string };
        setGeneratedPassword(data.generatedPassword);
        setUsername('');
        setFirstName('');
        setLastName('');
        setRole('researcher');
        setSelectedCenters([]);
        setShowForm(false);
        await loadUsers();
      } else {
        const err = await resp.json() as { error: string };
        alert(err.error ?? 'Failed to create user');
      }
    } catch (err) {
      console.error('[AdminPage] Failed to create user:', err);
    }
  };

  const handleDelete = async (targetUsername: string) => {
    try {
      const resp = await authFetch(`/api/auth/users/${encodeURIComponent(targetUsername)}`, {
        method: 'DELETE',
      });
      if (resp.ok) {
        await loadUsers();
      }
    } catch (err) {
      console.error('[AdminPage] Failed to delete user:', err);
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="pb-3 font-medium cursor-pointer select-none hover:text-gray-900 transition-colors"
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-600' : 'text-gray-300'}`} />
      </span>
    </th>
  );

  return (
    <div className="p-8 space-y-6 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('adminTitle')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('adminSubtitle')}</p>
      </div>

      {/* Generated password banner */}
      {generatedPassword && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">{t('userCreatedSuccess')}</p>
            <p className="text-sm text-green-700 mt-1">
              {t('generatedPasswordLabel')} <code className="bg-green-100 px-2 py-0.5 rounded font-mono text-sm">{generatedPassword}</code>
              <button
                onClick={() => { void navigator.clipboard.writeText(generatedPassword); }}
                className="ml-2 text-xs text-green-600 hover:text-green-800 underline"
              >
                {t('copy')}
              </button>
            </p>
            <p className="text-xs text-green-600 mt-1">{t('savePasswordHint')}</p>
            <button
              onClick={() => setGeneratedPassword(null)}
              className="text-xs text-green-600 hover:text-green-800 mt-2 underline"
            >
              {t('dismiss')}
            </button>
          </div>
        </div>
      )}

      {/* Add User Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium"
          >
            <UserPlus className="w-5 h-5" />
            {t('adminAddUser')}
          </button>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {t('adminAddUser')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('loginUsername')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('adminFirstName')}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('adminLastName')}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('adminRole')}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="researcher">{t('roleResearcher')}</option>
                  <option value="admin">{t('roleAdmin')}</option>
                  <option value="epidemiologist">{t('roleEpidemiologist')}</option>
                  <option value="clinician">{t('roleClinician')}</option>
                  <option value="data_manager">{t('roleDataManager')}</option>
                  <option value="clinic_lead">{t('roleClinicLead')}</option>
                </select>
              </div>
            </div>

            {/* N10.02: Multi-center assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('adminAssignCenters')}
              </label>
              <div className="flex flex-wrap gap-2">
                {centerOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCenter(c.id)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      selectedCenters.includes(c.id)
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => void handleAdd()}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                {t('save')}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setUsername('');
                  setFirstName('');
                  setLastName('');
                  setRole('researcher');
                  setSelectedCenters([]);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('adminUsers')}</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {loading ? '…' : filteredUsers.length === users.length
              ? `${users.length} ${t('adminUsersCount')}`
              : `${filteredUsers.length} ${t('auditFilteredOf')} ${users.length}`}
          </span>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('adminSearchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('adminFilterAllRoles')}</option>
              <option value="admin">{t('roleAdmin')}</option>
              <option value="researcher">{t('roleResearcher')}</option>
              <option value="epidemiologist">{t('roleEpidemiologist')}</option>
              <option value="clinician">{t('roleClinician')}</option>
              <option value="data_manager">{t('roleDataManager')}</option>
              <option value="clinic_lead">{t('roleClinicLead')}</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              data-testid="admin-center-filter"
              value={centerFilter}
              onChange={(e) => setCenterFilter(e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('adminFilterAllCenters')}</option>
              {centerOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <SortHeader field="username" label={t('loginUsername')} />
                <th className="pb-3 font-medium">{t('adminFullName')}</th>
                <SortHeader field="role" label={t('adminRole')} />
                <SortHeader field="center" label={t('adminAssignedCenters')} />
                <SortHeader field="createdAt" label={t('adminCreated')} />
                <SortHeader field="lastLogin" label={t('adminLastLogin')} />
                <th className="pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-red-500">{loadError}</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.username} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="py-3 font-medium text-gray-900 dark:text-gray-100">{u.username}</td>
                    <td className="py-3 text-gray-600 dark:text-gray-300">
                      {u.firstName || u.lastName
                        ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                        {getRoleIcon(u.role)}
                        {getRoleLabel(u.role, t)}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-300">
                      {u.centers && u.centers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.centers.map((c) => (
                            <span key={c} className="inline-block px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded text-xs font-medium">
                              {centerLabels[c] ?? c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-300">
                      {new Date(u.createdAt).toLocaleDateString(dateFmt)}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-300">
                      {u.lastLogin
                        ? new Date(u.lastLogin).toLocaleString(dateFmt, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 text-right">
                      {u.username === user.username ? (
                        <span
                          className="text-gray-400 cursor-not-allowed inline-flex items-center gap-1"
                          title={t('adminNoDelete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </span>
                      ) : (
                        <button
                          onClick={() => void handleDelete(u.username)}
                          className="text-red-500 hover:text-red-700 inline-flex items-center gap-1"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
