---
phase: 10-visual-ux-qa-preview-stability
plan: 04a
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pages/AdminPage.tsx
  - src/i18n/translations.ts
  - tests/adminCenterFilter.test.tsx
autonomous: true
requirements: [VQA-01]
requirements_addressed: [VQA-01]

must_haves:
  truths:
    - "AdminPage's users-table toolbar renders a `<select>` center filter populated from `/api/fhir/centers` showing exactly 7 options (UKA, UKC, UKD, UKG, UKL, UKMZ, UKT) plus an 'All centers' default — total 8 `<option>` elements."
    - "When the center filter narrows to a specific center, the users table shows only users whose `centers` array includes that center id — at least one user is hidden and one visible under the multi-center seeded fixture of `tests/adminCenterFilter.test.tsx`."
  artifacts:
    - path: "src/pages/AdminPage.tsx"
      provides: "Center-filter <select> + filter predicate wired into filteredUsers useMemo"
      contains: "centerFilter"
    - path: "src/i18n/translations.ts"
      provides: "adminFilterAllCenters key (DE + EN) for the new filter option"
      contains: "adminFilterAllCenters"
    - path: "tests/adminCenterFilter.test.tsx"
      provides: "Locked-to-7-sites snapshot test + narrowing assertion (VQA-01)"
      contains: "describe('AdminPage center filter"
  key_links:
    - from: "src/pages/AdminPage.tsx"
      to: "/api/fhir/centers"
      via: "existing centerOptions fetch (no new endpoint)"
      pattern: "/api/fhir/centers"
    - from: "tests/adminCenterFilter.test.tsx"
      to: "src/pages/AdminPage.tsx"
      via: "RTL render + mocked authFetch returning the 7-site roster"
      pattern: "render\\(<AdminPage"
---

<objective>
Close VQA-01 (admin filter UI locked to 7 sites) by adding a center-filter `<select>` to `AdminPage.tsx`'s users-table toolbar, registering its i18n key, and locking the 7-site roster behavior with a snapshot + narrowing test.

VQA-01 work:
- Add a Center filter `<select>` to `AdminPage.tsx`'s users-table toolbar, populated from the existing `/api/fhir/centers` fetch (no new endpoint), narrowing `filteredUsers` by center id.
- Add `adminFilterAllCenters` translation key (DE + EN).
- Create `tests/adminCenterFilter.test.tsx` — mocks `authFetch` to return the 7-site roster; asserts exactly 8 `<option>` elements (7 sites + "All"), labels in the exact D-09 order (UKA, UKC, UKD, UKG, UKL, UKMZ, UKT), and that selecting a specific center narrows the user table.

Output: AdminPage edit, one new i18n key, one new test file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md
@src/pages/AdminPage.tsx
@src/i18n/translations.ts
@data/centers.json
@tests/OutcomesPage.test.tsx

<interfaces>
<!-- Current AdminPage state surfaces relevant to VQA-01 — extracted from source 2026-04-16 -->

From src/pages/AdminPage.tsx (lines 11, 58-59, 73, 104-113, 128-150, 438-453):
```typescript
interface CenterOption { id: string; label: string }

const [centerOptions, setCenterOptions] = useState<CenterOption[]>([]);
const [centerLabels, setCenterLabels] = useState<Record<string, string>>({});

const [roleFilter, setRoleFilter] = useState<string>('all');
// ...
// /api/fhir/centers fetch that populates centerOptions (already wired)
useEffect(() => {
  authFetch('/api/fhir/centers')
    .then((r) => r.ok ? r.json() as Promise<{ centers: Array<{ id: string; shorthand: string }> }> : null)
    .then((data) => {
      if (data?.centers) {
        setCenterOptions(data.centers.map((c) => ({ id: c.id, label: c.shorthand })));
        setCenterLabels(Object.fromEntries(data.centers.map((c) => [c.id, c.shorthand])));
      }
    });
}, []);

// filteredUsers useMemo with search + role filter at lines 128-150 — center filter must be added here.
```

Current toolbar (lines 426-454): search input + role `<select>` only. We add a center `<select>` alongside.

Canonical center order (from `data/centers.json` — authoritative):
```json
[
  { "id": "org-uka",  "shorthand": "UKA",  ... },
  { "id": "org-ukc",  "shorthand": "UKC",  ... },
  { "id": "org-ukd",  "shorthand": "UKD",  ... },
  { "id": "org-ukg",  "shorthand": "UKG",  ... },
  { "id": "org-ukl",  "shorthand": "UKL",  ... },
  { "id": "org-ukmz", "shorthand": "UKMZ", ... },
  { "id": "org-ukt",  "shorthand": "UKT",  ... }
]
```
7 entries, in exactly that order — D-09 "lock the list" applies.

Existing i18n pattern for the filter label (around line 320):
```typescript
adminFilterAllRoles: { de: 'Alle Rollen', en: 'All roles' },
```
Mirror that for centers: `adminFilterAllCenters: { de: 'Alle Zentren', en: 'All centers' }`.
</interfaces>

<scope_note>
D-09 is explicit about lockstep maintenance: if `data/centers.json` ever changes, `tests/adminCenterFilter.test.tsx` MUST be updated in the same PR. Test asserts exact labels AND exact count. This is a feature — the test is the roster-change canary.
</scope_note>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add adminFilterAllCenters i18n key (DE + EN)</name>
  <files>src/i18n/translations.ts</files>
  <read_first>
    - src/i18n/translations.ts line 320 (existing `adminFilterAllRoles` — insertion point)
  </read_first>
  <behavior>
    - `translations.adminFilterAllCenters.de` === `"Alle Zentren"`
    - `translations.adminFilterAllCenters.en` === `"All centers"`
    - Insertion immediately after `adminFilterAllRoles` to keep admin filter keys grouped.
  </behavior>
  <action>
    Open `src/i18n/translations.ts`. Locate the line (currently line 320):
    ```typescript
      adminFilterAllRoles: { de: 'Alle Rollen', en: 'All roles' },
    ```

    Immediately after it, insert:
    ```typescript
      adminFilterAllCenters: { de: 'Alle Zentren', en: 'All centers' },
    ```
  </action>
  <verify>
    <automated>grep -n "adminFilterAllCenters" src/i18n/translations.ts &amp;&amp; npm run typecheck 2>&amp;1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -F "adminFilterAllCenters: { de: 'Alle Zentren', en: 'All centers' }" src/i18n/translations.ts` matches exactly once
    - `npm run typecheck` exits 0
  </acceptance_criteria>
  <done>i18n key added; TypeScript compiles.</done>
</task>

<task type="auto">
  <name>Task 2: Add center filter UI to AdminPage.tsx (users-table toolbar)</name>
  <files>src/pages/AdminPage.tsx</files>
  <read_first>
    - src/pages/AdminPage.tsx lines 58-75 (state declarations), 103-113 (center fetch), 128-171 (filteredUsers useMemo), 426-454 (Search and Filter Bar block)
    - src/i18n/translations.ts (confirm adminFilterAllCenters exists after Task 1)
  </read_first>
  <behavior>
    - New state: `const [centerFilter, setCenterFilter] = useState<string>('all');` (mirrors roleFilter pattern).
    - `filteredUsers` useMemo adds a center-filter pass: when `centerFilter !== 'all'`, keeps only users whose `u.centers` array includes `centerFilter`.
    - `useMemo` dependency list includes `centerFilter`.
    - New `<select>` sits next to the role `<select>` in the toolbar:
      - First option: `<option value="all">{t('adminFilterAllCenters')}</option>`
      - Then one `<option value={c.id}>{c.label}</option>` for each entry in `centerOptions` (preserving fetch order — /api/fhir/centers returns roster order).
    - A `data-testid="admin-center-filter"` attribute on the `<select>` anchors the test.
    - No other code in AdminPage changes.
  </behavior>
  <action>
    Edit `src/pages/AdminPage.tsx`:

    Step 1: Add the state declaration. Locate (line 73):
    ```typescript
      const [roleFilter, setRoleFilter] = useState<string>('all');
    ```
    Immediately after it, insert:
    ```typescript
      const [centerFilter, setCenterFilter] = useState<string>('all');
    ```

    Step 2: Extend the `filteredUsers` useMemo (lines 128-171). Locate the role filter block (around lines 143-145):
    ```typescript
        // Role filter
        if (roleFilter !== 'all') {
          result = result.filter((u) => u.role === roleFilter);
        }
    ```
    Immediately after this block (before the Sort block), insert:
    ```typescript
        // Center filter (VQA-01 / D-09)
        if (centerFilter !== 'all') {
          result = result.filter((u) => Array.isArray(u.centers) && u.centers.includes(centerFilter));
        }
    ```
    Update the useMemo dependency array (line 171) from:
    ```typescript
      }, [users, searchQuery, roleFilter, sortField, sortDir, getCentersDisplay]);
    ```
    to:
    ```typescript
      }, [users, searchQuery, roleFilter, centerFilter, sortField, sortDir, getCentersDisplay]);
    ```

    Step 3: Add the center `<select>` to the toolbar. Locate the role-filter `<div>` block (lines 438-453):
    ```tsx
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
    ```

    IMMEDIATELY AFTER the closing `</div>` of that role-filter block, insert a new sibling block:
    ```tsx
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-gray-400" />
                <select
                  data-testid="admin-center-filter"
                  value={centerFilter}
                  onChange={(e) => setCenterFilter(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">{t('adminFilterAllCenters')}</option>
                  {centerOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
    ```

    (`Building2` is already imported from `lucide-react` on line 1 — no new import needed.)

    Do NOT modify the users table rows or any other AdminPage logic.
  </action>
  <verify>
    <automated>npm run typecheck 2>&amp;1 | tail -10 &amp;&amp; grep -En "centerFilter|admin-center-filter" src/pages/AdminPage.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -E "const \[centerFilter, setCenterFilter\] = useState<string>\('all'\);" src/pages/AdminPage.tsx` matches
    - `grep -E "if \(centerFilter !== 'all'\)" src/pages/AdminPage.tsx` matches
    - `grep -E "u\.centers\.includes\(centerFilter\)" src/pages/AdminPage.tsx` matches
    - `grep -E "data-testid=\"admin-center-filter\"" src/pages/AdminPage.tsx` matches
    - `grep -E "t\('adminFilterAllCenters'\)" src/pages/AdminPage.tsx` matches
    - `grep -E "\[users, searchQuery, roleFilter, centerFilter, sortField, sortDir, getCentersDisplay\]" src/pages/AdminPage.tsx` matches (useMemo deps updated)
    - `npm run typecheck` exits 0
  </acceptance_criteria>
  <done>AdminPage renders a center filter select sourced from /api/fhir/centers and narrows the user table when a specific center is selected.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add tests/adminCenterFilter.test.tsx (VQA-01 snapshot + narrowing)</name>
  <files>tests/adminCenterFilter.test.tsx</files>
  <read_first>
    - src/pages/AdminPage.tsx (after Task 2 lands — confirm data-testid is present)
    - src/context/AuthContext.tsx (to understand admin-role gating — `AdminPage` likely gates user-fetch on `user?.role === 'admin'` per line 115-117)
    - src/context/LanguageContext.tsx (to mock the `useLanguage` hook surface)
    - src/services/authHeaders.ts (to understand `authFetch` shape for mocking)
    - tests/OutcomesPage.test.tsx (lines 1-90) for mocking pattern reference
    - data/centers.json (roster authoritative source)
  </read_first>
  <behavior>
    - Mock `authFetch` to return (a) `{ centers: [...7-site roster...] }` for `/api/fhir/centers` and (b) `{ users: [...fixture...] }` for `/api/auth/users`. Fixture has at least 3 users with distinct center memberships: one belonging to org-uka only, one belonging to org-ukd only, one belonging to both org-uka and org-ukd.
    - Mock `useAuth` to return `{ user: { role: 'admin', username: 'admin' } }` so the users-fetch path runs.
    - Mock `useLanguage` to return a minimal `t` stub + locale='en'.
    - Test 1: after render (and waitFor users loaded), query `[data-testid="admin-center-filter"]`; assert it has exactly 8 `<option>` children; the option at indexes 1..7 have textContent `UKA, UKC, UKD, UKG, UKL, UKMZ, UKT` IN THAT ORDER; option 0 value is `'all'` and text includes `All centers`.
    - Test 2: fireEvent.change on the select to value=`org-uka`; assert the rendered user table contains the two org-uka users (single-center + multi-center) and NOT the org-ukd-only user.
    - Test 3: change to value=`org-ukd`; assert the two org-ukd users present, org-uka-only user absent.
    - Test 4: change back to `all`; assert all three users present.
  </behavior>
  <action>
    Create `tests/adminCenterFilter.test.tsx`:

    ```typescript
    // @vitest-environment jsdom
    /**
     * VQA-01 / D-09: AdminPage center filter locked to the 7-site roster.
     *
     * This test is the roster-change canary — if data/centers.json changes, UPDATE THIS
     * TEST IN THE SAME PR (the exact label list is locked here intentionally).
     */
    import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
    import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
    import { MemoryRouter } from 'react-router-dom';

    // ---------- Mocks ----------
    vi.mock('../src/services/authHeaders', () => ({
      authFetch: vi.fn(),
    }));

    vi.mock('../src/context/AuthContext', () => ({
      useAuth: vi.fn(),
    }));

    vi.mock('../src/context/LanguageContext', () => ({
      useLanguage: vi.fn(),
    }));

    import AdminPage from '../src/pages/AdminPage';
    import { authFetch } from '../src/services/authHeaders';
    import { useAuth } from '../src/context/AuthContext';
    import { useLanguage } from '../src/context/LanguageContext';

    const ROSTER = [
      { id: 'org-uka',  shorthand: 'UKA' },
      { id: 'org-ukc',  shorthand: 'UKC' },
      { id: 'org-ukd',  shorthand: 'UKD' },
      { id: 'org-ukg',  shorthand: 'UKG' },
      { id: 'org-ukl',  shorthand: 'UKL' },
      { id: 'org-ukmz', shorthand: 'UKMZ' },
      { id: 'org-ukt',  shorthand: 'UKT' },
    ];

    const USERS = [
      {
        username: 'u-uka',
        firstName: 'Alice',
        lastName: 'A',
        role: 'researcher',
        centers: ['org-uka'],
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        username: 'u-ukd',
        firstName: 'Bob',
        lastName: 'B',
        role: 'researcher',
        centers: ['org-ukd'],
        createdAt: '2026-01-02T00:00:00Z',
      },
      {
        username: 'u-both',
        firstName: 'Carol',
        lastName: 'C',
        role: 'researcher',
        centers: ['org-uka', 'org-ukd'],
        createdAt: '2026-01-03T00:00:00Z',
      },
    ];

    // Minimal translation stub — returns the key when unknown; hard-codes the strings
    // the center filter actually displays for label assertions.
    const tStub = (k: string) => {
      const map: Record<string, string> = {
        adminFilterAllCenters: 'All centers',
        adminFilterAllRoles: 'All roles',
      };
      return map[k] ?? k;
    };

    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: { username: 'admin', role: 'admin' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      vi.mocked(useLanguage).mockReturnValue({
        t: tStub,
        locale: 'en',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      vi.mocked(authFetch).mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/fhir/centers')) {
          return new Response(JSON.stringify({ centers: ROSTER }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (typeof url === 'string' && url.includes('/api/auth/users')) {
          return new Response(JSON.stringify({ users: USERS }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not found', { status: 404 });
      });
    });

    afterEach(() => {
      cleanup();
      vi.clearAllMocks();
    });

    async function renderAdminPage() {
      const utils = render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      );
      // Wait for /api/fhir/centers + /api/auth/users to resolve.
      await waitFor(() => {
        expect(
          utils.container.querySelector('[data-testid="admin-center-filter"]'),
        ).not.toBeNull();
      });
      return utils;
    }

    describe('AdminPage center filter — locked-to-7-sites roster (VQA-01 / D-09)', () => {
      it('renders exactly 8 <option> elements: All centers + 7 sites in roster order', async () => {
        const { container } = await renderAdminPage();
        const select = container.querySelector<HTMLSelectElement>(
          '[data-testid="admin-center-filter"]',
        );
        expect(select).not.toBeNull();
        const options = Array.from(select!.querySelectorAll('option'));
        expect(options.length).toBe(8);
        expect(options[0].value).toBe('all');
        expect(options[0].textContent).toContain('All centers');
        // Exact roster order — D-09 lock.
        expect(options.slice(1).map((o) => o.textContent)).toEqual([
          'UKA',
          'UKC',
          'UKD',
          'UKG',
          'UKL',
          'UKMZ',
          'UKT',
        ]);
        expect(options.slice(1).map((o) => o.value)).toEqual([
          'org-uka',
          'org-ukc',
          'org-ukd',
          'org-ukg',
          'org-ukl',
          'org-ukmz',
          'org-ukt',
        ]);
      });

      it('narrows the user table to only users belonging to the selected center', async () => {
        const { container } = await renderAdminPage();
        // Wait until all 3 users visible in the table.
        await waitFor(() => {
          expect(screen.queryByText('u-uka')).not.toBeNull();
          expect(screen.queryByText('u-ukd')).not.toBeNull();
          expect(screen.queryByText('u-both')).not.toBeNull();
        });
        const select = container.querySelector<HTMLSelectElement>(
          '[data-testid="admin-center-filter"]',
        )!;

        // Narrow to org-uka — u-uka and u-both remain, u-ukd drops.
        fireEvent.change(select, { target: { value: 'org-uka' } });
        await waitFor(() => {
          expect(screen.queryByText('u-uka')).not.toBeNull();
          expect(screen.queryByText('u-both')).not.toBeNull();
          expect(screen.queryByText('u-ukd')).toBeNull();
        });

        // Narrow to org-ukd — u-ukd and u-both remain, u-uka drops.
        fireEvent.change(select, { target: { value: 'org-ukd' } });
        await waitFor(() => {
          expect(screen.queryByText('u-ukd')).not.toBeNull();
          expect(screen.queryByText('u-both')).not.toBeNull();
          expect(screen.queryByText('u-uka')).toBeNull();
        });

        // Reset — all three visible again.
        fireEvent.change(select, { target: { value: 'all' } });
        await waitFor(() => {
          expect(screen.queryByText('u-uka')).not.toBeNull();
          expect(screen.queryByText('u-ukd')).not.toBeNull();
          expect(screen.queryByText('u-both')).not.toBeNull();
        });
      });
    });
    ```

    If any mock surface above does not match the real `useAuth`/`useLanguage`/`authFetch` export shape, adjust the mock structure to match the real exports (do not change the assertion logic).
  </action>
  <verify>
    <automated>npx vitest run tests/adminCenterFilter.test.tsx 2>&amp;1 | tail -40</automated>
  </verify>
  <acceptance_criteria>
    - `test -f tests/adminCenterFilter.test.tsx` exits 0
    - `grep -E "describe\('AdminPage center filter" tests/adminCenterFilter.test.tsx` matches
    - `grep -F "'UKA'," tests/adminCenterFilter.test.tsx` matches (exact label present)
    - `grep -F "'UKMZ'," tests/adminCenterFilter.test.tsx` matches
    - `grep -E "expect\(options\.length\)\.toBe\(8\)" tests/adminCenterFilter.test.tsx` matches
    - `grep -E "fireEvent\.change\(select" tests/adminCenterFilter.test.tsx` matches
    - `npx vitest run tests/adminCenterFilter.test.tsx` exits 0 (both tests green)
  </acceptance_criteria>
  <done>Admin center filter snapshot + narrowing tests pass; VQA-01 closed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→server (AdminPage test) | `tests/adminCenterFilter.test.tsx` mocks authFetch responses in-process. The fixture includes no real PII (usernames `u-uka`, `u-ukd`, `u-both`; fabricated names) and is never persisted — lives only in test memory. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-04a-01 | Spoofing | tests/adminCenterFilter.test.tsx useAuth mock | accept | Test-local mock; not reachable from production runtime. |
| T-10-04a-02 | Tampering | AdminPage centerFilter state | accept | Client-side UI filter; server-side authz on /api/auth/users is unchanged and remains authoritative. |
| T-10-04a-03 | Repudiation | — | N/A | Audit surface not touched. |
| T-10-04a-04 | Information Disclosure | adminCenterFilter fixture | accept | Fixture has no real PII (synthetic usernames). |
| T-10-04a-05 | Denial of Service | — | N/A | Client-side `.filter` predicate; bounded by users list already loaded. |
| T-10-04a-06 | Elevation of Privilege | AdminPage centerFilter | accept | Client-side predicate only; does NOT replace the server-side center scoping enforced by the FHIR bundle plugin (v1.0). Per CONTEXT.md guidance, the fixture does not contain real center-PII. |

Severity summary: **none/low**. No high-severity threats; client-side filter is UX-only, server authz unchanged.
</threat_model>

<verification>
Maps to ROADMAP Phase 10 Success Criterion #1 (admin filter 7-site snapshot).

- `npx vitest run tests/adminCenterFilter.test.tsx` exits 0 (8-option snapshot + narrowing)
- `npx vitest run tests/outcomesI18n.test.ts` exits 0 (adminFilterAllCenters doesn't collide with outcomes* keys; admin* keys are separate namespace)
- `grep -F 'adminFilterAllCenters' src/i18n/translations.ts` matches
- `grep -F 'data-testid="admin-center-filter"' src/pages/AdminPage.tsx` matches
</verification>

<success_criteria>
- All 3 tasks' acceptance criteria pass.
- VQA-01 closed: 7-site snapshot + narrowing verified.
- Phase regression gate preserved (313/313 + new tests).
</success_criteria>

<output>
After completion, create `.planning/phases/10-visual-ux-qa-preview-stability/10-04a-SUMMARY.md` with:
- Confirmation that mocks in tests/adminCenterFilter.test.tsx match the real `useAuth`/`useLanguage`/`authFetch` exports (if any adjustments were needed, record them)
- Roster lockstep reminder: if data/centers.json changes, tests/adminCenterFilter.test.tsx MUST be updated in the same PR
</output>
</content>
