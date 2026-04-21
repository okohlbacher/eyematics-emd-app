# Phase 17: Audit Log Upgrade & Dark Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 17-audit-log-upgrade-dark-mode
**Areas discussed:** Audit filter architecture, Dark mode coverage depth, Theme toggle placement

---

## Audit Filter Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side | Extend AuditFilters + queryAudit() with action_category, body_search, status_gte params | ✓ |
| Client-side on fetched data | Keep 500-entry fetch, compute in React useMemo | |

**Follow-up — Category mapping:**

| Option | Description | Selected |
|--------|-------------|----------|
| Server maps categories to SQL | auditDb.ts builds WHERE clause from action_category param | ✓ |
| Client maps after server returns | Server returns raw rows, React groups into categories | |

**Follow-up — Cohort-hash search:**

| Option | Description | Selected |
|--------|-------------|----------|
| LIKE substring | body LIKE '%search%' OR query LIKE '%search%' | ✓ |
| Exact match | body = search OR query = search | |

**Follow-up — Fetch strategy:**

| Option | Description | Selected |
|--------|-------------|----------|
| Single server-filtered fetch | Filters as query params, fires on change (debounced), up to 500 rows | ✓ |
| Paginated fetch | Previous/Next controls, page-by-page | |

**Notes:** All recommended options accepted. Chose server-side to ensure pagination accuracy and future scalability.

---

## Dark Mode Coverage Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full app | All 10+ pages get dark: variants | ✓ |
| Core surfaces only | Main content + charts only; secondary pages stay light | |

**Follow-up — Sidebar treatment:**

| Option | Description | Selected |
|--------|-------------|----------|
| Stay the same (bg-slate-800) | Already dark, fits both themes without modification | ✓ |
| Go slightly darker (dark:bg-slate-900) | More visual separation in dark mode | |

**Follow-up — Dark background value:**

| Option | Description | Selected |
|--------|-------------|----------|
| gray-900 #111827 | Consistent with REQUIREMENTS.md WCAG spec background | ✓ |
| gray-800 #1f2937 | Slightly lighter, gives depth with gray-900 cards | |

**Notes:** Full-app coverage selected. Gray-900 background is the same value referenced in the REQUIREMENTS spec for DARK_EYE_COLORS contrast testing.

---

## Theme Toggle Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar footer, next to language switcher | Minimal change, sibling to globe button | ✓ |
| New top header bar in main content | Matches "Layout header" wording; requires restructure | |
| Top of sidebar, above nav items | Visible always; below logo | |

**Follow-up — Toggle style:**

| Option | Description | Selected |
|--------|-------------|----------|
| Single cycling icon (Sun → Moon → Monitor) | Compact, fits sidebar footer row | ✓ |
| 3-state segmented control | Explicit state display but takes more space | |

**Notes:** Sidebar footer placement accepted as the practical interpretation of "Layout header." Single cycling icon keeps the sidebar footer row compact alongside the existing language switcher.

---

## Claude's Discretion

- Exact `DARK_EYE_COLORS` hex values (must pass WCAG 4.5:1 vs `#111827`)
- `DARK_COHORT_PALETTES` analogous values
- Debounce delay for audit filter refetch
- i18n keys for toggle tooltip labels
- Tailwind `darkMode: 'class'` config location
- Dark badge color choices
- FOUC prevention inline script details

## Deferred Ideas

- Pagination UI for audit log (single fetch sufficient)
- FeedbackButton modal dark-mode styling
- Server-side theme preference sync
