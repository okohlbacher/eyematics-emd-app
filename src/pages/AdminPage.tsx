import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { TranslationKey } from '../i18n/translations';
import { usePageAudit } from '../hooks/usePageAudit';
import { getDateLocale } from '../utils/dateFormat';
import { getAuthHeaders } from '../services/authHeaders';
import { UserPlus, Trash2, Shield, ShieldCheck, Search, ArrowUpDown, Filter, Microscope, Stethoscope, Database, Building2, Loader2, Copy, Check, KeyRound } from 'lucide-react';
import type { ManagedUser, UserRole } from '../context/AuthContext';

const ALL_CENTERS = ['UKA', 'UKB', 'LMU', 'UKT', 'UKM'];

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
  const { user, managedUsers, fetchUsers } = useAuth();
  const { locale, t } = useLanguage();

  usePageAudit('view_admin', 'audit_detail_view_admin');

  const dateFmt = getDateLocale(locale);

  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('researcher');
  const [selectedCenters, setSelectedCenters] = useState<string[]>([]);

  // Search, filter, sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Server CRUD state
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalUsername, setPasswordModalUsername] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);

  const getCentersDisplay = (mu: ManagedUser): string => {
    if (mu.centers && mu.centers.length > 0) return mu.centers.join(', ');
    return mu.center ?? '—';
  };

  const filteredUsers = useMemo(() => {
    let result = [...managedUsers];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (mu) =>
          mu.username.toLowerCase().includes(q) ||
          getCentersDisplay(mu).toLowerCase().includes(q) ||
          mu.role.toLowerCase().includes(q)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter((mu) => mu.role === roleFilter);
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
  }, [managedUsers, searchQuery, roleFilter, sortField, sortDir]);

  // --- Early return AFTER all hooks ---
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-md">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">{t('adminOnlyHint')}</p>
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
    setCreating(true);
    setCreateError(null);

    try {
      const resp = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          username: username.trim(),
          role,
          centers: selectedCenters.length > 0 ? selectedCenters : undefined,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: 'Request failed' }));
        setCreateError(data.error || `Error ${resp.status}`);
        setCreating(false);
        return;
      }

      const data = await resp.json() as { user: ManagedUser; generatedPassword: string };
      setGeneratedPassword(data.generatedPassword);
      setPasswordModalUsername(data.user.username);
      setShowPasswordModal(true);

      // Reset form
      setUsername('');
      setFirstName('');
      setLastName('');
      setRole('researcher');
      setSelectedCenters([]);
      setShowForm(false);
      setCreating(false);

      // Refresh user list from server
      fetchUsers();
    } catch {
      setCreateError('Network error');
      setCreating(false);
    }
  };

  const handleDelete = async (targetUsername: string) => {
    setDeletingUser(targetUsername);

    try {
      const resp = await fetch(`/api/auth/users/${encodeURIComponent(targetUsername)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: 'Request failed' }));
        console.error('Delete failed:', data.error);
      }

      // Refresh list from server regardless
      fetchUsers();
    } catch {
      console.error('Delete failed: network error');
    } finally {
      setDeletingUser(null);
      setConfirmDelete(null);
    }
  };

  const handleResetPassword = async (targetUsername: string) => {
    setResettingPassword(targetUsername);

    try {
      const resp = await fetch(`/api/auth/users/${encodeURIComponent(targetUsername)}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({ error: 'Request failed' }));
        console.error('Password reset failed:', data.error);
        return;
      }

      const data = await resp.json() as { generatedPassword: string };
      setGeneratedPassword(data.generatedPassword);
      setPasswordModalUsername(targetUsername);
      setShowPasswordModal(true);
    } catch {
      console.error('Password reset failed: network error');
    } finally {
      setResettingPassword(null);
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
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('adminTitle')}</h1>
        <p className="text-gray-500 mt-1">{t('adminSubtitle')}</p>
      </div>

      {/* Add User Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
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
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {t('adminAddUser')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('loginUsername')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {createError && (
                  <p className="text-sm text-red-600 mt-1">{createError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('adminFirstName')}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('adminLastName')}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('adminRole')}
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('adminAssignCenters')}
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_CENTERS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCenter(c)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      selectedCenters.includes(c)
                        ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAdd}
                disabled={creating || !username.trim()}
                className={`px-4 py-2 text-sm font-semibold rounded-lg text-white ${
                  creating || !username.trim() ? 'bg-blue-400 opacity-60 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
                aria-disabled={creating}
                aria-label={creating ? 'Creating user, please wait' : undefined}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('createUser' as TranslationKey)}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setUsername('');
                  setFirstName('');
                  setLastName('');
                  setRole('researcher');
                  setSelectedCenters([]);
                  setCreateError(null);
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
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{t('adminUsers')}</h2>
          <span className="text-sm text-gray-500">
            {filteredUsers.length === managedUsers.length
              ? `${managedUsers.length} ${t('adminUsersCount')}`
              : `${filteredUsers.length} ${t('auditFilteredOf')} ${managedUsers.length}`}
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
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
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
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((mu) => (
                  <tr key={mu.username} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{mu.username}</td>
                    <td className="py-3 text-gray-600">
                      {mu.firstName || mu.lastName
                        ? `${mu.firstName ?? ''} ${mu.lastName ?? ''}`.trim()
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        {getRoleIcon(mu.role)}
                        {getRoleLabel(mu.role, t)}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">
                      {mu.centers && mu.centers.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {mu.centers.map((c) => (
                            <span key={c} className="inline-block px-1.5 py-0.5 bg-gray-100 rounded text-xs font-medium">
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        mu.center ?? <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-600">
                      {new Date(mu.createdAt).toLocaleDateString(dateFmt)}
                    </td>
                    <td className="py-3 text-gray-600">
                      {mu.lastLogin
                        ? new Date(mu.lastLogin).toLocaleString(dateFmt, {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="py-3 text-right">
                      {confirmDelete === mu.username ? (
                        <span className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600">{(t('removeConfirm' as TranslationKey)).replace('{username}', mu.username)}</span>
                          <button
                            onClick={() => handleDelete(mu.username)}
                            disabled={deletingUser === mu.username}
                            className="text-red-600 hover:text-red-800 font-medium"
                            aria-label={`Remove ${mu.username}`}
                          >
                            {deletingUser === mu.username ? <Loader2 className="w-4 h-4 animate-spin" /> : t('remove' as TranslationKey)}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-gray-500 hover:text-gray-700">
                            {t('cancel')}
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => handleResetPassword(mu.username)}
                            disabled={resettingPassword === mu.username}
                            className="text-gray-400 hover:text-blue-500 transition-colors p-1"
                            aria-label={`Reset password for ${mu.username}`}
                            title={t('resetPassword' as TranslationKey)}
                          >
                            {resettingPassword === mu.username ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                          </button>
                          {user.username.toLowerCase() === mu.username.toLowerCase() ? (
                            <span className="text-gray-300 p-1" title={t('cannotDeleteSelf' as TranslationKey)}>
                              <Trash2 className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(mu.username)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                              aria-label={`Remove ${mu.username}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Modal — shared for create and reset */}
      {showPasswordModal && generatedPassword && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="pwd-modal-heading">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <p id="pwd-modal-heading" className="text-sm font-semibold text-gray-700 mb-2">
              {passwordModalUsername ? `${t('passwordFor' as TranslationKey)} ${passwordModalUsername}` : t('userCreated' as TranslationKey)}
            </p>
            <p className="text-sm text-gray-500 mb-3">{t('copyPasswordNow' as TranslationKey)}</p>
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200" aria-live="polite">
              <p className="font-mono text-lg text-center select-all">{generatedPassword}</p>
            </div>
            <div className="flex gap-3 mt-4 justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedPassword);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                {copied ? <><Check className="w-4 h-4" />{t('copied' as TranslationKey)}</> : <><Copy className="w-4 h-4" />{t('copyPassword' as TranslationKey)}</>}
              </button>
              <button
                onClick={() => { setShowPasswordModal(false); setGeneratedPassword(null); setPasswordModalUsername(null); setCopied(false); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
              >
                {t('done' as TranslationKey)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
