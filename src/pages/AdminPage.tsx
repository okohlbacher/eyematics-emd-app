import { ArrowUpDown, Building2, CheckCircle, ChevronDown, ChevronUp, Database, Filter, Key, KeyRound, Loader2, LogOut, Microscope, Pencil, Search, Shield, ShieldCheck, Stethoscope, Trash2, UserPlus, X } from 'lucide-react';
import React, { useCallback,useEffect, useMemo, useState } from 'react';

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
  /** UMGMT-03: activation flag; absent means active (migration target) */
  active?: boolean;
}

// DTO returned by GET /api/auth/sessions — projected subset of server/sessionsDb.ts SessionRow.
// sid/ver/revoked/username are omitted server-side to limit browser-visible session metadata.
interface SessionRow {
  id: string;
  issued_at: string;
  expires_at: string;
  last_used_at: string | null;
  key_id: string;
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

/** Column header with sort-toggle click handler. Hoisted to module scope so
 * React treats it as a stable component (react-hooks/static-components). */
function SortHeader({
  field,
  label,
  sortField,
  onSort,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  onSort: (f: SortField) => void;
}) {
  return (
    <th
      className="pb-3 font-medium cursor-pointer select-none hover:text-gray-900 transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-blue-600' : 'text-gray-300'}`} />
      </span>
    </th>
  );
}

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
  const [copyFeedback, setCopyFeedback] = useState(false);
  // L3: inline action-error banner replaces blocking alert() for create/update failures.
  const [actionError, setActionError] = useState<string | null>(null);
  // UMGMT-02: extended to include firstName, lastName, role validation
  const [formErrors, setFormErrors] = useState<{ username?: string; firstName?: string; lastName?: string; role?: string; centers?: string }>({});

  const [editUsername, setEditUsername] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('researcher');
  const [editCenters, setEditCenters] = useState<string[]>([]);
  // UMGMT-01/02/03: edit-dialog validation errors and activation state
  const [editFormErrors, setEditFormErrors] = useState<{ firstName?: string; lastName?: string; role?: string; centers?: string }>({});
  // UMGMT-03: activation flag, seeded from user.active (absent → true)
  const [editActive, setEditActive] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [centerFilter, setCenterFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Session accordion state (Phase 28 / SESSUI-01, SESSUI-02)
  const [expandedSessionUser, setExpandedSessionUser] = useState<string | null>(null);
  const [sessionMap, setSessionMap] = useState<Record<string, SessionRow[]>>({});
  const [sessionLoading, setSessionLoading] = useState<Record<string, boolean>>({});
  const [sessionError, setSessionError] = useState<Record<string, string | null>>({});
  const [signingOutUser, setSigningOutUser] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<Record<string, string | null>>({});

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

  const fetchSessions = useCallback(async (uname: string) => {
    setSessionLoading((p) => ({ ...p, [uname]: true }));
    setSessionError((p) => ({ ...p, [uname]: null }));
    try {
      const resp = await authFetch(`/api/auth/sessions?username=${encodeURIComponent(uname)}`);
      if (!resp.ok) throw new Error(String(resp.status));
      const data = (await resp.json()) as { sessions: SessionRow[] };
      setSessionMap((p) => ({ ...p, [uname]: data.sessions }));
    } catch (err) {
      setSessionError((p) => ({ ...p, [uname]: err instanceof Error ? err.message : 'error' }));
    } finally {
      setSessionLoading((p) => ({ ...p, [uname]: false }));
    }
  }, []);

  // F-20: Load center options from server instead of hardcoding
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch('/api/fhir/centers');
        const data = r.ok
          ? ((await r.json()) as { centers: Array<{ id: string; shorthand: string }> })
          : null;
        if (cancelled || !data?.centers) return;
        setCenterOptions(data.centers.map((c) => ({ id: c.id, label: c.shorthand })));
        setCenterLabels(Object.fromEntries(data.centers.map((c) => [c.id, c.shorthand])));
      } catch {
        /* swallow — admin page retains hardcoded fallback labels */
      }
    })();
    return () => { cancelled = true; };
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

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          getCentersDisplay(u).toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      );
    }

    if (roleFilter !== 'all') {
      result = result.filter((u) => u.role === roleFilter);
    }

    // Center filter (VQA-01 / D-09)
    if (centerFilter !== 'all') {
      result = result.filter((u) => Array.isArray(u.centers) && u.centers.includes(centerFilter));
    }

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
    // USM-001 + UMGMT-02: validate all required fields before submitting
    const errors: typeof formErrors = {};
    if (!username.trim()) errors.username = t('fieldRequired');
    if (!firstName.trim()) errors.firstName = t('fieldRequired');
    if (!lastName.trim()) errors.lastName = t('fieldRequired');
    if (!role) errors.role = t('fieldRequired');
    if (selectedCenters.length === 0) errors.centers = t('centerRequired');
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

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
        setActionError(err.error ?? 'Failed to create user');
      }
    } catch (err) {
      console.error('[AdminPage] Failed to create user:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to create user');
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

  const handleResetPassword = async (targetUsername: string) => {
    if (!confirm(t('adminResetPasswordConfirm').replace('{0}', targetUsername))) return;
    setActionError(null);
    try {
      const resp = await authFetch(`/api/auth/users/${encodeURIComponent(targetUsername)}/password`, {
        method: 'PUT',
      });
      if (resp.ok) {
        const data = await resp.json() as { generatedPassword: string };
        setGeneratedPassword(data.generatedPassword);
        await loadUsers();
      } else {
        const err = await resp.json() as { error: string };
        setActionError(err.error ?? 'Failed to reset password');
      }
    } catch (err) {
      console.error('[AdminPage] Failed to reset password:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  const handleResetTotp = async (targetUsername: string) => {
    if (!confirm(t('adminResetTotpConfirm').replace('{0}', targetUsername))) return;
    try {
      const resp = await authFetch(`/api/auth/users/${encodeURIComponent(targetUsername)}/totp/reset`, {
        method: 'POST',
      });
      if (resp.ok) {
        await loadUsers();
      }
    } catch (err) {
      console.error('[AdminPage] Failed to reset TOTP:', err);
    }
  };

  const startEdit = (u: ServerUser) => {
    setEditUsername(u.username);
    setEditFirstName(u.firstName ?? '');
    setEditLastName(u.lastName ?? '');
    setEditRole(u.role);
    setEditCenters(u.centers ?? []);
    // UMGMT-03: seed activation state; absent active field means active (migration target)
    setEditActive(u.active !== false);
    setEditFormErrors({});
  };

  const cancelEdit = () => setEditUsername(null);

  const handleEditSave = async () => {
    if (!editUsername) return;

    // UMGMT-01 + UMGMT-02: validate all required edit-dialog fields before submitting
    const errors: typeof editFormErrors = {};
    if (!editFirstName.trim()) errors.firstName = t('fieldRequired');
    if (!editLastName.trim()) errors.lastName = t('fieldRequired');
    if (!editRole) errors.role = t('fieldRequired');
    if (editCenters.length === 0) errors.centers = t('centerRequired');
    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }
    setEditFormErrors({});

    try {
      const resp = await authFetch(`/api/auth/users/${encodeURIComponent(editUsername)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // UMGMT-03: include active in PUT body
        body: JSON.stringify({
          firstName: editFirstName.trim() || undefined,
          lastName: editLastName.trim() || undefined,
          role: editRole,
          centers: editCenters,
          active: editActive,
        }),
      });
      if (resp.ok) {
        setEditUsername(null);
        await loadUsers();
      } else {
        const err = await resp.json() as { error: string };
        setActionError(err.error ?? 'Failed to update user');
      }
    } catch (err) {
      console.error('[AdminPage] Failed to update user:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const toggleEditCenter = (c: string) => {
    setEditCenters((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  const toggleSessionAccordion = (uname: string) => {
    if (expandedSessionUser === uname) {
      setExpandedSessionUser(null);
    } else {
      setExpandedSessionUser(uname);
      void fetchSessions(uname);
    }
  };

  const handleRevokeSession = async (uname: string, id: string) => {
    setRevokeError((p) => ({ ...p, [uname]: null }));
    try {
      const resp = await authFetch(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(String(resp.status));
      await fetchSessions(uname); // re-fetch — D-15
    } catch {
      setRevokeError((p) => ({ ...p, [uname]: t('adminRevokeError') }));
    }
  };

  const handleSignOutEverywhere = async (uname: string) => {
    setSigningOutUser(uname);
    setRevokeError((p) => ({ ...p, [uname]: null }));
    try {
      const resp = await authFetch(`/api/auth/sessions?username=${encodeURIComponent(uname)}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(String(resp.status));
      await fetchSessions(uname); // list empties
    } catch {
      setRevokeError((p) => ({ ...p, [uname]: t('mutationErrorGeneric') }));
    } finally {
      setSigningOutUser(null);
    }
  };

  return (
    <div className="p-8 space-y-6 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('adminTitle')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('adminSubtitle')}</p>
      </div>

      {/* L3: action error banner (replaces blocking alert()) */}
      {actionError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start justify-between gap-3">
          <p className="text-sm text-red-800 dark:text-red-200">{actionError}</p>
          <button
            onClick={() => setActionError(null)}
            className="text-xs text-red-600 hover:text-red-800 dark:text-red-300 underline"
          >
            {t('dismiss')}
          </button>
        </div>
      )}

      {/* Generated password banner */}
      {generatedPassword && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-800">{t('userCreatedSuccess')}</p>
            <p className="text-sm text-green-700 mt-1">
              {t('generatedPasswordLabel')} <code className="bg-green-100 px-2 py-0.5 rounded font-mono text-sm">{generatedPassword}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedPassword).then(() => {
                    setCopyFeedback(true);
                    setTimeout(() => setCopyFeedback(false), 2000);
                  }).catch(() => {
                    // Fallback: select the code element text manually
                    void navigator.clipboard.writeText(generatedPassword);
                  });
                }}
                className="ml-2 text-xs text-green-600 hover:text-green-800 underline"
              >
                {copyFeedback ? t('copied') : t('copy')}
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
                  {t('loginUsername')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setFormErrors((prev) => ({ ...prev, username: undefined })); }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 ${formErrors.username ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                />
                {formErrors.username && <p className="text-xs text-red-500 mt-1">{formErrors.username}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('adminFirstName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  placeholder={t('adminFirstName')}
                  onChange={(e) => { setFirstName(e.target.value); setFormErrors((prev) => ({ ...prev, firstName: undefined })); }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 ${formErrors.firstName ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                />
                {formErrors.firstName && <p className="text-xs text-red-500 mt-1">{formErrors.firstName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('adminLastName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  placeholder={t('adminLastName')}
                  onChange={(e) => { setLastName(e.target.value); setFormErrors((prev) => ({ ...prev, lastName: undefined })); }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 ${formErrors.lastName ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                />
                {formErrors.lastName && <p className="text-xs text-red-500 mt-1">{formErrors.lastName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('adminRole')} <span className="text-red-500">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => { setRole(e.target.value as UserRole); setFormErrors((prev) => ({ ...prev, role: undefined })); }}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 ${formErrors.role ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                >
                  <option value="researcher">{t('roleResearcher')}</option>
                  <option value="admin">{t('roleAdmin')}</option>
                  <option value="epidemiologist">{t('roleEpidemiologist')}</option>
                  <option value="clinician">{t('roleClinician')}</option>
                  <option value="data_manager">{t('roleDataManager')}</option>
                  <option value="clinic_lead">{t('roleClinicLead')}</option>
                </select>
                {formErrors.role && <p className="text-xs text-red-500 mt-1">{formErrors.role}</p>}
              </div>
            </div>

            {/* N10.02: Multi-center assignment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('adminAssignCenters')} <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {centerOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { toggleCenter(c.id); setFormErrors((prev) => ({ ...prev, centers: undefined })); }}
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
              {formErrors.centers && <p className="text-xs text-red-500 mt-1">{formErrors.centers}</p>}
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
                  setFormErrors({});
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
                <SortHeader field="username" label={t('loginUsername')} sortField={sortField} onSort={handleSort} />
                <th className="pb-3 font-medium">{t('adminFullName')}</th>
                <SortHeader field="role" label={t('adminRole')} sortField={sortField} onSort={handleSort} />
                <SortHeader field="center" label={t('adminAssignedCenters')} sortField={sortField} onSort={handleSort} />
                <SortHeader field="createdAt" label={t('adminCreated')} sortField={sortField} onSort={handleSort} />
                <SortHeader field="lastLogin" label={t('adminLastLogin')} sortField={sortField} onSort={handleSort} />
                <th className="pb-3 font-medium">{t('adminSessions')}</th>
                <th className="pb-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">Loading…</td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-red-500">{loadError}</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  editUsername === u.username ? (
                    <tr key={u.username} className="border-b border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10">
                      <td className="py-3 font-medium text-gray-900 dark:text-gray-100">{u.username}</td>
                      <td className="py-2" colSpan={2}>
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-2">
                            <div className="flex flex-col">
                              <input
                                type="text"
                                value={editFirstName}
                                onChange={(e) => { setEditFirstName(e.target.value); setEditFormErrors((prev) => ({ ...prev, firstName: undefined })); }}
                                placeholder={t('adminFirstName')}
                                className={`w-28 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 ${editFormErrors.firstName ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                              />
                              {editFormErrors.firstName && <p className="text-xs text-red-500 mt-0.5">{editFormErrors.firstName}</p>}
                            </div>
                            <div className="flex flex-col">
                              <input
                                type="text"
                                value={editLastName}
                                onChange={(e) => { setEditLastName(e.target.value); setEditFormErrors((prev) => ({ ...prev, lastName: undefined })); }}
                                placeholder={t('adminLastName')}
                                className={`w-28 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 ${editFormErrors.lastName ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                              />
                              {editFormErrors.lastName && <p className="text-xs text-red-500 mt-0.5">{editFormErrors.lastName}</p>}
                            </div>
                            <div className="flex flex-col">
                              <select
                                value={editRole}
                                onChange={(e) => { setEditRole(e.target.value as UserRole); setEditFormErrors((prev) => ({ ...prev, role: undefined })); }}
                                className={`border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 ${editFormErrors.role ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                              >
                                <option value="researcher">{t('roleResearcher')}</option>
                                <option value="admin">{t('roleAdmin')}</option>
                                <option value="epidemiologist">{t('roleEpidemiologist')}</option>
                                <option value="clinician">{t('roleClinician')}</option>
                                <option value="data_manager">{t('roleDataManager')}</option>
                                <option value="clinic_lead">{t('roleClinicLead')}</option>
                              </select>
                              {editFormErrors.role && <p className="text-xs text-red-500 mt-0.5">{editFormErrors.role}</p>}
                            </div>
                          </div>
                          {/* UMGMT-03: activation checkbox */}
                          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editActive}
                              onChange={(e) => setEditActive(e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            {t('adminUserActive')}
                          </label>
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap gap-1">
                            {centerOptions.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => { toggleEditCenter(c.id); setEditFormErrors((prev) => ({ ...prev, centers: undefined })); }}
                                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                                  editCenters.includes(c.id)
                                    ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                          {editFormErrors.centers && <p className="text-xs text-red-500 mt-0.5">{editFormErrors.centers}</p>}
                        </div>
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-300">
                        {new Date(u.createdAt).toLocaleDateString(dateFmt)}
                      </td>
                      <td />
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => void handleEditSave()}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >
                            {t('save')}
                          </button>
                          <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <React.Fragment key={u.username}>
                    <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 font-medium text-gray-900 dark:text-gray-100">
                        {u.username}
                        {/* UMGMT-03: show muted "inactive" badge for deactivated users */}
                        {u.active === false && (
                          <span className="ml-2 inline-block px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded text-xs font-normal">
                            {t('adminUserInactiveBadge')}
                          </span>
                        )}
                      </td>
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
                      <td className="py-3">
                        <button
                          onClick={() => toggleSessionAccordion(u.username)}
                          className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 inline-flex items-center gap-1"
                          aria-expanded={expandedSessionUser === u.username}
                          title={t('adminSessions')}
                        >
                          {expandedSessionUser === u.username
                            ? <ChevronUp className="w-4 h-4 text-blue-600" />
                            : <ChevronDown className="w-4 h-4" />}
                          {t('adminSessions')}
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => startEdit(u)}
                            className="text-gray-400 hover:text-blue-600"
                            title={t('edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleResetPassword(u.username)}
                            className="text-gray-400 hover:text-blue-600"
                            title={t('adminResetPassword')}
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleResetTotp(u.username)}
                            className="text-gray-400 hover:text-amber-600"
                            title={t('adminResetTotp')}
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {u.username === user.username ? (
                            <span
                              className="text-gray-300 cursor-not-allowed"
                              title={t('adminNoDelete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={() => void handleDelete(u.username)}
                              className="text-red-500 hover:text-red-700"
                              title={t('delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedSessionUser === u.username && (
                      <tr key={`${u.username}-sessions`}>
                        <td colSpan={8} className="pb-3 bg-indigo-50/30 dark:bg-indigo-900/10">
                          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mt-2 mb-3">
                            {/* Header row */}
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Key className="w-4 h-4" />
                                {t('adminSessionsTitle')} ({sessionMap[u.username]?.length ?? 0})
                              </span>
                              <button
                                onClick={() => void handleSignOutEverywhere(u.username)}
                                disabled={signingOutUser === u.username}
                                aria-busy={signingOutUser === u.username}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                              >
                                {signingOutUser === u.username ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {t('adminSigningOut')}
                                  </>
                                ) : (
                                  <>
                                    <LogOut className="w-3 h-3" />
                                    {t('adminSignOutEverywhere')}
                                  </>
                                )}
                              </button>
                            </div>
                            {/* Loading state */}
                            {sessionLoading[u.username] && (
                              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400 dark:text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                {t('dataLoading')}
                              </div>
                            )}
                            {/* Error state */}
                            {!sessionLoading[u.username] && sessionError[u.username] && (
                              <p className="text-sm text-red-500">
                                {t('adminSessionsLoadError')}
                                <button
                                  onClick={() => void fetchSessions(u.username)}
                                  className="text-red-600 hover:text-red-800 underline ml-1"
                                >
                                  {t('retry')}
                                </button>
                              </p>
                            )}
                            {/* Empty state */}
                            {!sessionLoading[u.username] && !sessionError[u.username] && sessionMap[u.username]?.length === 0 && (
                              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">{t('adminNoActiveSessions')}</p>
                            )}
                            {/* Session table */}
                            {!sessionLoading[u.username] && !sessionError[u.username] && sessionMap[u.username] && sessionMap[u.username].length > 0 && (
                              <table className="w-full text-sm mt-2">
                                <thead>
                                  <tr className="text-left">
                                    <th scope="col" className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2 pr-4">{t('sessionDevice')}</th>
                                    <th scope="col" className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2 pr-4">{t('sessionIssuedAt')}</th>
                                    <th scope="col" className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2 pr-4">{t('sessionLastUsed')}</th>
                                    <th scope="col" className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2 pr-4">{t('sessionExpires')}</th>
                                    <th scope="col" className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide border-b border-gray-200 dark:border-gray-700 pb-2" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessionMap[u.username].map((s) => (
                                    <tr key={s.id} className="border-b border-gray-100 dark:border-gray-700/60 last:border-0">
                                      <td className="font-data text-xs text-gray-600 dark:text-gray-300 py-2 pr-4">Key: {s.key_id.slice(-8)}</td>
                                      <td className="font-data text-xs text-gray-500 dark:text-gray-400 py-2 pr-4">{new Date(s.issued_at).toLocaleString()}</td>
                                      <td className="font-data text-xs text-gray-500 dark:text-gray-400 py-2 pr-4">{s.last_used_at ? new Date(s.last_used_at).toLocaleString() : '—'}</td>
                                      <td className="font-data text-xs text-gray-500 dark:text-gray-400 py-2 pr-4">{new Date(s.expires_at).toLocaleString()}</td>
                                      <td className="py-2 text-right">
                                        <button
                                          onClick={() => void handleRevokeSession(u.username, s.id)}
                                          aria-label={`${t('adminRevokeSession')} ${s.key_id}`}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded transition-colors"
                                        >
                                          {t('adminRevokeSession')}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            {/* Revoke error */}
                            {revokeError[u.username] && (
                              <p className="text-xs text-red-500 mt-1" role="alert">{revokeError[u.username]}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  )
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
