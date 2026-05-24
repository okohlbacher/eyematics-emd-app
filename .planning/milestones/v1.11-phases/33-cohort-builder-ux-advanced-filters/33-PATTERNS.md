# Phase 33: Cohort Builder UX & Advanced Filters — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/CohortBuilderPage.tsx` | component/page | request-response | self (extending) | exact |
| `shared/types/fhir.ts` | model | — | self (extending) | exact |
| `shared/patientCases.ts` | service/utility | transform | self (extending) | exact |
| `shared/qualityPredicates.ts` (new) | utility | transform | `QualityPage.tsx` `getTherapyStatus` | role-match (lift-out) |
| `src/pages/AdvancedFilterDialog.tsx` (new) | component | request-response | `QualityFlagDialog.tsx` | exact |
| `src/context/AuthContext.tsx` | provider | event-driven | self (extending) | exact |
| `src/pages/LandingPage.tsx` | component/page | request-response | self (extending) | exact |
| `src/pages/QualityPage.tsx` | component/page | request-response | self (extending) | exact |
| `src/i18n/translations.ts` | config | — | self (extending) | exact |
| `config/settings.yaml` | config | — | self (extending) | exact |
| `tests/` (multiple new test files) | test | — | `tests/landingPageAlerts.test.tsx` | role-match |

---

## Pattern Assignments

### `src/pages/CohortBuilderPage.tsx` — inline validation (COH-01)

**Analog:** self, existing `saveName` validation block

**Imports pattern** (lines 1–35): Current imports are the template. Add `Sliders` from `lucide-react` for the advanced-dialog trigger.

**Inline validation pattern** (lines 84–138) — copy exactly for numeric field validation:

```typescript
// Pattern: derived validation object computed inline in render (no useState for errors)
const { hasHardError, isHardError, validationMsg } = (() => {
  const trimmed = saveName.trim();
  if (!trimmed) return { hasHardError: false, isHardError: false, validationMsg: '' };
  // ... rule checks returning { hasHardError: true, isHardError: true, validationMsg: t('key') }
  return { hasHardError: false, isHardError: false, validationMsg: '' };
})();
```

For COH-01, produce one derived value per field group (age, visus, CRT) using the same IIFE pattern:

```typescript
// Example — age group validation (derive from filter state, not a separate useState)
const ageError = (() => {
  const min = filters.ageRange?.[0];
  const max = filters.ageRange?.[1];
  if (min !== undefined && (isNaN(min) || min < 0)) return t('cohortValidationAgeNonNumeric');
  if (max !== undefined && (isNaN(max) || max < 0)) return t('cohortValidationAgeNonNumeric');
  if (min !== undefined && max !== undefined && min > max) return t('cohortValidationAgeLowerExceedsUpper');
  return '';
})();
const hasAnyFilterError = !!(ageError || visusError || crtError);
```

**Validation error element** (lines 592–603) — exact CSS classes to reuse:

```tsx
{validationMsg && (
  <p
    id="cohort-name-validation"
    role={isHardError ? 'alert' : 'status'}
    className={`mt-1 text-xs px-2 py-1 rounded border ${
      isHardError
        ? 'bg-red-50 border-red-200 text-red-600 dark:bg-[--color-coral-soft] dark:border-[--color-coral] dark:text-[--color-coral-ink]'
        : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-[--color-amber-soft] dark:border-[--color-amber] dark:text-[--color-amber-ink]'
    }`}
  >
    {validationMsg}
  </p>
)}
```

For COH-01 all filter errors are hard errors (`role="alert"`, coral/red classes only). Use `py-1.5` (not `py-1`) per UI-SPEC Spacing Exceptions table.

**Save button disabled gate** (line 585):

```tsx
// Existing:
disabled={hasHardError || !saveName.trim()}
// Extended for COH-01:
disabled={hasHardError || hasAnyFilterError || !saveName.trim()}
```

**Silent clamping code to replace** (lines 440, 458, 530, 548):

```typescript
// REMOVE these patterns:
Math.max(0, Number(e.target.value) || 0)       // age min  (line 440)
Math.max(0, Number(e.target.value) || 120)     // age max  (line 458)
Math.max(0, Number(e.target.value) || 0)       // CRT min  (line 530)
Math.max(0, Number(e.target.value) || 800)     // CRT max  (line 548)
// REPLACE with: set raw value into state; derive error via validation IIFE above.
```

**Visus text-input state** (lines 141–142) — COH-01 Visus validation reads from these text strings, not from `filters.visusRange`:

```typescript
const [visusMinText, setVisusMinText] = useState('');
const [visusMaxText, setVisusMaxText] = useState('');
// Visus validation must parse visusMinText/visusMaxText directly:
const visusMinParsed = parseFloat(visusMinText.replace(',', '.'));
// if (!isNaN(visusMinParsed) && visusMinParsed > 1) => cohortValidationVisusOutOfRange
```

**Filter state initialization** (line 60) — COH-02 converts this from plain `useState` to a sessionStorage-backed lazy initializer:

```typescript
// BEFORE (line 60):
const [filters, setFilters] = useState<CohortFilter>({});

// AFTER (COH-02 pattern — mirrors recentActivityStore try/catch idiom):
const [filters, setFilters] = useState<CohortFilter>(() => {
  try {
    const raw = sessionStorage.getItem('emd-cohort-filters');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return safePickCohortFilter(parsed); // same safe-pick pattern as AnalysisPage lines 98–108
  } catch { return {}; }
});
// Write on every filter change:
useEffect(() => {
  try {
    sessionStorage.setItem('emd-cohort-filters', JSON.stringify(filters));
  } catch { /* ignore */ }
}, [filters]);
```

**Reset control** (lines 558–563) — extend to also clear sessionStorage and text states:

```tsx
<button
  onClick={() => {
    setFilters({});
    setVisusMinText('');
    setVisusMaxText('');
    try { sessionStorage.removeItem('emd-cohort-filters'); } catch { /* ignore */ }
  }}
  className="flex-1 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300"
>
  {t('reset')}
</button>
```

**Existing filter input field pattern** (lines 430–463, age group) — copy for layout of new validation error element placement:

```tsx
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
    {t('ageYears')}
  </label>
  <div className="flex items-center gap-2">
    <input
      type="number"
      placeholder="Min"
      min={0}
      value={filters.ageRange?.[0] ?? ''}
      onChange={...}
      className="w-20 px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
    />
    <span className="text-gray-400 dark:text-gray-500">—</span>
    <input ... />
  </div>
  {/* NEW: error element goes here, directly below the min-max pair */}
  {ageError && (
    <p role="alert" className="mt-1 text-xs px-2 py-1.5 rounded border bg-red-50 border-red-200 text-red-600 dark:bg-[--color-coral-soft] dark:border-[--color-coral] dark:text-[--color-coral-ink]">
      {ageError}
    </p>
  )}
</div>
```

---

### `shared/types/fhir.ts` — `CohortFilter` extension

**Analog:** self, lines 159–166

**Current shape to extend** (lines 159–166):

```typescript
export interface CohortFilter {
  diagnosis?: string[];
  gender?: string[];
  ageRange?: [number, number];
  visusRange?: [number, number];
  crtRange?: [number, number];
  centers?: string[];
}
```

**Extended shape** — add all Phase 33 fields below `centers`:

```typescript
export interface CohortFilter {
  diagnosis?: string[];
  gender?: string[];
  ageRange?: [number, number];
  visusRange?: [number, number];
  crtRange?: [number, number];
  centers?: string[];
  // Phase 33 — COH-03 preset discriminant
  preset?: 'therapyBreaker' | 'implausibleCrt' | 'flaggedQuality' | 'implausibleVisus';
  flaggedCaseIds?: Set<string>;  // NOTE: not JSON-serializable; serialize as string[] for sessionStorage
  // Phase 33 — COH-04 advanced dialog (D-11)
  diagnosisSubtype?: string[];
  hasComorbidity?: boolean;
  hba1cRange?: [number, number];
  medicationCodes?: string[];
  laterality?: 'OD' | 'OS' | 'OU';
}
```

---

### `shared/patientCases.ts` — `applyFilters` extension

**Analog:** self, lines 111–137

**Current `applyFilters`** (lines 111–137) — guard-clause chain pattern to extend:

```typescript
export function applyFilters(cases: PatientCase[], filters: CohortFilter): PatientCase[] {
  return cases.filter((c) => {
    if (filters.centers?.length && !filters.centers.includes(c.centerId)) return false;
    if (filters.gender?.length && !filters.gender.includes(c.gender)) return false;
    if (filters.diagnosis?.length) {
      const codes = c.conditions.flatMap((cond) => cond.code.coding.map((cd) => cd.code));
      if (!filters.diagnosis.some((d) => codes.includes(d))) return false;
    }
    if (filters.ageRange) {
      const age = getAge(c.birthDate);
      if (age < filters.ageRange[0] || age > filters.ageRange[1]) return false;
    }
    if (filters.visusRange) {
      const latest = getLatestObservation(c.observations, LOINC_VISUS);
      const val = latest?.valueQuantity?.value;
      if (val == null) return false;
      if (val < filters.visusRange[0] || val > filters.visusRange[1]) return false;
    }
    if (filters.crtRange) {
      const latest = getLatestObservation(c.observations, LOINC_CRT);
      const val = latest?.valueQuantity?.value;
      if (val == null) return false;
      if (val < filters.crtRange[0] || val > filters.crtRange[1]) return false;
    }
    return true;
  });
}
```

**Preset predicate block** — add after existing `crtRange` block, before `return true`:

```typescript
// Phase 33 — COH-03 preset predicates (guard-clause pattern, same as above)
if (filters.preset === 'therapyBreaker') {
  // getTherapyStatus imported from shared/qualityPredicates.ts (lifted from QualityPage)
  const thresholds = { interrupterDays: settings.therapyInterrupterDays, breakerDays: settings.therapyBreakerDays };
  const { status } = getTherapyStatus(c, thresholds);
  if (status !== 'breaker') return false;
}
if (filters.preset === 'implausibleCrt') {
  const latest = getLatestObservation(c.observations, LOINC_CRT);
  const val = latest?.valueQuantity?.value;
  if (val == null || val <= settings.crtImplausibleThresholdUm) return false;
}
if (filters.preset === 'flaggedQuality') {
  if (!filters.flaggedCaseIds?.has(c.id)) return false;
}
if (filters.preset === 'implausibleVisus') {
  const latest = getLatestObservation(c.observations, LOINC_VISUS);
  const val = latest?.valueQuantity?.value;
  if (val == null || (val >= 0 && val <= 1)) return false;
}
```

**Advanced attribute block** — add after preset block, before `return true`:

```typescript
// Phase 33 — COH-04 advanced dialog attributes
if (filters.diagnosisSubtype?.length) {
  const codes = c.conditions.flatMap((cond) => cond.code.coding.map((cd) => cd.code));
  if (!filters.diagnosisSubtype.some((d) => codes.includes(d))) return false;
}
if (filters.hasComorbidity === true) {
  // Comorbidities are Condition resources with non-AMD/non-DR codes
  const PRIMARY_CODES = [SNOMED_AMD, SNOMED_DR];  // import from fhirCodes.js
  const hasComorb = c.conditions.some(
    (cond) => !cond.code.coding.some((cd) => PRIMARY_CODES.includes(cd.code))
  );
  if (!hasComorb) return false;
}
if (filters.hba1cRange) {
  const latest = getLatestObservation(c.observations, LOINC_HBA1C);  // '4548-4'
  const val = latest?.valueQuantity?.value;
  if (val == null) return false;
  if (val < filters.hba1cRange[0] || val > filters.hba1cRange[1]) return false;
}
if (filters.medicationCodes?.length) {
  const patientCodes = c.medications.flatMap(
    (m) => m.medicationCodeableConcept?.coding?.map((cd) => cd.code) ?? []
  );
  if (!filters.medicationCodes.some((code) => patientCodes.includes(code))) return false;
}
if (filters.laterality) {
  // SNOMED_EYE_RIGHT = '362503005', SNOMED_EYE_LEFT = '362502000' from fhirCodes.js
  const targetCode = filters.laterality === 'OD' ? SNOMED_EYE_RIGHT : filters.laterality === 'OS' ? SNOMED_EYE_LEFT : null;
  if (targetCode) {
    const hasLat = c.conditions.some(
      (cond) => cond.bodySite?.some((bs) => bs.coding?.some((cd) => cd.code === targetCode))
    );
    if (!hasLat) return false;
  }
  // 'OU' (bilateral) — no additional filtering; all cases pass
}
```

**Imports to add** to `shared/patientCases.ts`:

```typescript
import { LOINC_CRT, LOINC_VISUS, LOINC_HBA1C, SNOMED_AMD, SNOMED_DR, SNOMED_EYE_RIGHT, SNOMED_EYE_LEFT } from './fhirCodes.js';
import { getTherapyStatus } from './qualityPredicates.js';
import { getSettings } from '../src/services/settingsService.js';  // NOTE: planner must verify cross-boundary import path
```

Note: `getSettings()` import from `shared/` is a cross-boundary concern. The planner should confirm the existing import path for settings in `shared/` context or pass threshold values as a third `options` parameter to `applyFilters` to avoid the import.

---

### `shared/qualityPredicates.ts` (new file)

**Analog:** `src/pages/QualityPage.tsx` lines 40–66 (lift-out of `getTherapyStatus`)

**Full function to lift** (QualityPage.tsx lines 42–66):

```typescript
// Therapy discontinuation detection (EMDREQ-QUAL-009)
// F-20: thresholds passed as parameters instead of reading global singleton
function getTherapyStatus(
  pc: PatientCase,
  thresholds: { interrupterDays: number; breakerDays: number },
): { status: 'active' | 'interrupter' | 'breaker'; gapDays: number } {
  const injections = pc.procedures
    .filter((p) => p.code.coding.some((c) => c.code === SNOMED_IVI))
    .map((p) => new Date(p.performedDateTime ?? '').getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);

  if (injections.length < 2) return { status: 'active', gapDays: 0 };

  let maxGap = 0;
  for (let i = 1; i < injections.length; i++) {
    const gap = (injections[i] - injections[i - 1]) / (1000 * 60 * 60 * 24);
    if (gap > maxGap) maxGap = gap;
  }

  const lastToNow = (Date.now() - injections[injections.length - 1]) / (1000 * 60 * 60 * 24);
  if (lastToNow > maxGap) maxGap = lastToNow;

  if (maxGap > thresholds.breakerDays) return { status: 'breaker', gapDays: Math.round(maxGap) };
  if (maxGap > thresholds.interrupterDays) return { status: 'interrupter', gapDays: Math.round(maxGap) };
  return { status: 'active', gapDays: Math.round(maxGap) };
}
```

**New module header to use** (mirror `shared/patientCases.ts` header style, lines 1–24):

```typescript
/**
 * shared/qualityPredicates.ts — lifted quality-related predicate helpers.
 *
 * Lifted from QualityPage.tsx (Phase 33) so shared/patientCases.ts applyFilters
 * can call getTherapyStatus for the Therapie-Abbrecher preset without duplicating
 * the gap-calculation logic.
 *
 * No I/O, no browser APIs, no side effects.
 */
import { SNOMED_IVI } from './fhirCodes.js';
import type { PatientCase } from './types/fhir.js';

export function getTherapyStatus(
  pc: PatientCase,
  thresholds: { interrupterDays: number; breakerDays: number },
): { status: 'active' | 'interrupter' | 'breaker'; gapDays: number } {
  // ... (exact body from QualityPage.tsx lines 47–65)
}
```

**After lift:** `QualityPage.tsx` imports and re-uses:

```typescript
// In QualityPage.tsx — replace the local function declaration (lines 42–66) with:
import { getTherapyStatus } from '../../shared/qualityPredicates.js';
// Usage at lines 152–160 remains unchanged.
```

---

### `src/pages/AdvancedFilterDialog.tsx` (new component)

**Analog:** `src/components/quality/QualityFlagDialog.tsx` (modal scaffold) + `src/components/FeedbackButton.tsx` (focus trap)

**Modal scaffold** (QualityFlagDialog.tsx lines 35–78) — copy outer container structure:

```tsx
// Overlay container — exact classes (QualityFlagDialog.tsx line 36):
<div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
  {/* Panel — use max-w-lg (vs max-w-md in QualityFlagDialog) per UI-SPEC */}
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="advanced-filter-dialog-title"
    className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg"
  >
    {/* Header row */}
    <div className="flex items-center justify-between mb-4">
      <h3 id="advanced-filter-dialog-title" className="text-base font-semibold text-gray-900 dark:text-white">
        {t('advancedFiltersTitle')}
      </h3>
      <button
        onClick={onClose}
        aria-label={t('advancedFiltersDiscard')}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>
    </div>

    {/* Fields */}
    { /* ... 5 curated attribute controls ... */ }

    {/* Footer — mirrors QualityFlagDialog.tsx lines 61–75 justify-end pattern */}
    <div className="flex gap-2 justify-end pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
      <Button variant="ghost" size="sm" onClick={handleClear}>
        {t('advancedFiltersClear')}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClose}>
        {t('advancedFiltersDiscard')}
      </Button>
      <Button variant="accent" size="sm" onClick={handleApply}>
        {t('advancedFiltersApply')}
      </Button>
    </div>
  </div>
</div>
```

**Focus trap + Escape** (FeedbackButton.tsx lines 40–68) — copy this exact pattern:

```typescript
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    onClose();
  }
  // Focus trap: keep Tab within modal
  if (e.key === 'Tab' && dialogRef.current) {
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, input, select, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}, [onClose]);

useEffect(() => {
  if (open) {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }
}, [open, handleKeyDown]);
```

**Props interface** — mirror `QualityFlagDialogProps` style (QualityFlagDialog.tsx lines 8–14):

```typescript
export interface AdvancedFilterDialogProps {
  open: boolean;
  filters: CohortFilter;   // the full filter object (dialog reads advanced fields from it)
  onApply: (advancedFields: Partial<CohortFilter>) => void;
  onClose: () => void;
}
```

**Field control pattern** — diagnosis checkboxes follow CohortBuilderPage lines 390–423 (existing Diagnosis checkboxes). HbA1c range inputs follow `px-2 py-1.5` (brownfield spacing exception) + `type="number"` + `inputMode="numeric"`.

---

### `src/context/AuthContext.tsx` — logout filter clear (COH-02 / D-05)

**Analog:** self, `performLogout` at lines 144–164

**Existing `performLogout`** (lines 144–164) — insertion point is after line 162:

```typescript
const performLogout = useCallback((auto = false) => {
  void auto;
  recentActivityStore.clearAll();    // line 152
  void serverLogout();               // line 156
  broadcastLogout();                 // line 158
  setUser(null);                     // line 159
  setToken(null);                    // line 160
  setInactivityWarning(false);       // line 161
  sessionStorage.removeItem('emd-token');      // line 162
  // ADD AFTER LINE 162:
  sessionStorage.removeItem('emd-cohort-filters');  // D-05: clear persisted filters on logout
  invalidateBundleCache();           // line 163
}, []);
```

The key naming pattern mirrors line 162: `emd-<domain>` prefix, no username suffix (sessionStorage is already tab-isolated).

---

### `src/pages/LandingPage.tsx` — DASH-02 routing fix

**Analog:** self, lines 288 and 302

**Current buggy button** (line 302) — exact text to change:

```tsx
// BEFORE (line 302):
<Button variant="ghost" size="sm" aria-label={t('reviewFlaggedCases')} onClick={() => navigate('/quality?status=flagged')}>
  {t('review')}
</Button>

// AFTER:
<Button variant="ghost" size="sm" aria-label={t('reviewImplausibleCrt')} onClick={() => navigate('/quality?crt=implausible')}>
  {t('review')}
</Button>
```

**Correct therapy-breaker button** (line 288) — DO NOT change (already correct):

```tsx
<Button variant="ghost" size="sm" aria-label={t('reviewTherapyBreakers')} onClick={() => navigate('/quality?therapy=breaker')}>
  {t('review')}
</Button>
```

---

### `src/pages/QualityPage.tsx` — CRT URL-param seeding (DASH-02)

**Analog:** self, existing `filterStatus` and `filterTherapy` lazy initializers (lines 93–110)

**Existing URL-param seeding pattern** (lines 93–110) — copy for `filterCrt`:

```typescript
// Existing pattern (lines 93–99):
const [filterStatus, setFilterStatus] = useState<QualityStatus | 'all'>(() => {
  const v = searchParams.get('status');
  return v === 'flagged' ? 'in_progress' : 'all';
});
// Existing pattern (lines 101–104):
const [filterTherapy, setFilterTherapy] = useState<string>(() => {
  const v = searchParams.get('therapy');
  return v === 'breaker' || v === 'interrupter' ? v : 'all';
});
// Existing showFilters auto-open (lines 108–110):
const [showFilters, setShowFilters] = useState<boolean>(() => {
  return searchParams.get('therapy') !== null || searchParams.get('status') !== null;
});

// ADD — new CRT initializer (same lazy-initializer pattern, same file position):
const [filterCrt, setFilterCrt] = useState<'implausible' | 'all'>(() => {
  return searchParams.get('crt') === 'implausible' ? 'implausible' : 'all';
});
// UPDATE showFilters to include crt:
const [showFilters, setShowFilters] = useState<boolean>(() => {
  return (
    searchParams.get('therapy') !== null ||
    searchParams.get('status') !== null ||
    searchParams.get('crt') !== null       // ADD this line
  );
});
```

**`filteredCases` memo extension** (lines 167–176) — add `filterCrt` clause after `filterTherapy`:

```typescript
// Existing filteredCases pattern (line 172):
if (filterTherapy !== 'all' && therapyStatuses.get(c.id)?.status !== filterTherapy) return false;
// ADD after it:
if (filterCrt === 'implausible') {
  const latest = getLatestObservation(c.observations, LOINC_CRT);
  const val = latest?.valueQuantity?.value;
  const threshold = getSettings().crtImplausibleThresholdUm;  // new settings.yaml key
  if (val == null || val <= threshold) return false;
}
```

---

### `src/i18n/translations.ts` — new Phase 33 keys

**Analog:** self, Attention keys at lines 879–898

**Existing key format** (lines 879–898) — the pattern all new keys follow:

```typescript
// Single-object shape with de/en string values — camelCase key names:
attentionNeeded: { de: 'Aufmerksamkeit erforderlich', en: 'Attention needed' },
attentionTherapyBreakers: { de: 'Therapie-Abbrecher', en: 'Therapy breakers' },
attentionTherapyBreakersSub: {
  de: 'Fälle mit Lücke > 365 Tagen prüfen',
  en: 'Review cases with gap > 365 days',
},
reviewTherapyBreakers: {
  de: 'Therapie-Abbrecher prüfen',
  en: 'Review therapy breakers',
},
reviewFlaggedCases: {
  de: 'Markierte Fälle prüfen',
  en: 'Review flagged cases',
},
```

**All new keys for Phase 33** (add as a `// Phase 33` comment block after line 898):

```typescript
// Phase 33 — COH-01 validation
cohortValidationAgeNonNumeric: { de: 'Ungültige Eingabe: nur Zahlen ≥ 0 erlaubt', en: 'Invalid input: numbers ≥ 0 only' },
cohortValidationAgeLowerExceedsUpper: { de: 'Untergrenze darf die Obergrenze nicht überschreiten', en: 'Lower bound must not exceed upper bound' },
cohortValidationVisusOutOfRange: { de: 'Visus muss im Bereich 0–1 liegen', en: 'Visus must be in range 0–1' },
cohortValidationVisusLowerExceedsUpper: { de: 'Untergrenze darf die Obergrenze nicht überschreiten', en: 'Lower bound must not exceed upper bound' },
cohortValidationCrtNonNumeric: { de: 'Ungültige Eingabe: nur Zahlen ≥ 0 erlaubt', en: 'Invalid input: numbers ≥ 0 only' },
cohortValidationCrtLowerExceedsUpper: { de: 'Untergrenze darf die Obergrenze nicht überschreiten', en: 'Lower bound must not exceed upper bound' },

// Phase 33 — COH-03 presets
cohortPresets: { de: 'Schnellauswahl', en: 'Quick presets' },
presetTherapyBreaker: { de: 'Therapie-Abbrecher', en: 'Therapy breakers' },
presetImplausibleCrt: { de: 'Unplausible CRT-Werte', en: 'Implausible CRT' },
presetFlaggedQuality: { de: 'Markierte Qualitätsfälle', en: 'Flagged quality cases' },
presetImplausibleVisus: { de: 'Implausible Visus', en: 'Implausible Visus' },

// Phase 33 — COH-04 advanced dialog
advancedFilters: { de: 'Erweiterte Filter', en: 'Advanced filters' },
advancedFiltersTitle: { de: 'Erweiterte Filterkriterien', en: 'Advanced filter criteria' },
advancedFiltersApply: { de: 'Filter anwenden', en: 'Apply filters' },
advancedFiltersClear: { de: 'Felder leeren', en: 'Clear fields' },
advancedFiltersDiscard: { de: 'Änderungen verwerfen', en: 'Discard changes' },
advancedFiltersDiagnosisSubtype: { de: 'Diagnose-Untertyp', en: 'Diagnosis subtype' },
advancedFiltersComorbidities: { de: 'Komorbiditäten', en: 'Comorbidities' },
advancedFiltersComorbiditiesAny: { de: 'Hat Komorbiditäten', en: 'Has comorbidities' },
advancedFiltersHba1c: { de: 'HbA1c (%)', en: 'HbA1c (%)' },
advancedFiltersMedication: { de: 'Wirkstoff / Medikament', en: 'Drug / agent' },
advancedFiltersLaterality: { de: 'Lateralität', en: 'Laterality' },
advancedFiltersLateralityOD: { de: 'OD (rechtes Auge)', en: 'OD (right eye)' },
advancedFiltersLateralityOS: { de: 'OS (linkes Auge)', en: 'OS (left eye)' },
advancedFiltersLateralityOU: { de: 'OU (beide Augen)', en: 'OU (both eyes)' },

// Phase 33 — DASH-02
reviewImplausibleCrt: { de: 'Unplausible CRT-Werte prüfen', en: 'Review implausible CRT readings' },
```

---

### `config/settings.yaml` — new CRT threshold key

**Analog:** existing `therapyBreakerDays` / `therapyInterrupterDays` entries (lines 2–3 confirmed in RESEARCH)

**Existing shape** (the two therapy threshold entries at lines 2–3):

```yaml
therapyInterrupterDays: 120
therapyBreakerDays: 365
```

**New key to add** (adjacent to existing thresholds):

```yaml
crtImplausibleThresholdUm: 400
```

Value 400 matches `CRITICAL_CRT_THRESHOLD` in `src/config/clinicalThresholds.ts:7` (existing quality-flag threshold). This makes `settings.yaml` the single source of truth per project convention.

---

### `tests/` — new test files

**Analog:** `tests/landingPageAlerts.test.tsx` (existing test to update + template for new tests)

**Test framework pattern** (all TSX test files):

- `// @vitest-environment jsdom` docblock at line 1
- No jest-dom; assertions use `queryByText('...').not.toBeNull()` / `.toBeNull()`
- `screen.getByRole`, `fireEvent.click`, `mockNavigate` from `vi.fn()`

**`tests/landingPageAlerts.test.tsx` line 83** — existing test to update:

```typescript
// BEFORE (line 83 — wrong target, must be updated):
expect(mockNavigate).toHaveBeenCalledWith('/quality?status=flagged');

// AFTER:
expect(mockNavigate).toHaveBeenCalledWith('/quality?crt=implausible');
// AND update the aria-label assertion from 'reviewFlaggedCases' → 'reviewImplausibleCrt'
```

---

## Shared Patterns

### sessionStorage Try/Catch Guard
**Source:** `src/services/recentActivityStore.ts` lines 48–58 and 61–67
**Apply to:** `CohortBuilderPage.tsx` (read on mount, write on filter change), `AuthContext.tsx` (removeItem on logout)

```typescript
// Read pattern (recentActivityStore lines 48–58):
try {
  const raw = localStorage.getItem(storageKey(username));
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isValidEntry);
} catch {
  return [];
}

// Write pattern (recentActivityStore lines 61–67):
try {
  localStorage.setItem(storageKey(username), JSON.stringify(next));
} catch { /* ignore */ }
```

Adapt `localStorage` → `sessionStorage` and the key to `'emd-cohort-filters'`. The `isValidEntry` shape-validation function becomes `safePickCohortFilter` (mirrors `AnalysisPage.tsx` lines 97–108).

### Safe-Pick Filter Deserialization
**Source:** `src/pages/AnalysisPage.tsx` lines 97–108; `src/components/outcomes/OutcomesView.tsx` lines 62–73
**Apply to:** `CohortBuilderPage.tsx` (sessionStorage read), and both safe-pick locations must be updated to include new Phase 33 `CohortFilter` keys

```typescript
// AnalysisPage.tsx lines 97–108 — the template:
const safe: CohortFilter = {};
if (Array.isArray(parsed.diagnosis)) safe.diagnosis = parsed.diagnosis.map(String);
if (Array.isArray(parsed.gender)) safe.gender = parsed.gender.map(String);
if (Array.isArray(parsed.ageRange) && parsed.ageRange.length === 2) safe.ageRange = [Number(parsed.ageRange[0]), Number(parsed.ageRange[1])];
if (Array.isArray(parsed.visusRange) && parsed.visusRange.length === 2) safe.visusRange = [Number(parsed.visusRange[0]), Number(parsed.visusRange[1])];
if (Array.isArray(parsed.crtRange) && parsed.crtRange.length === 2) safe.crtRange = [Number(parsed.crtRange[0]), Number(parsed.crtRange[1])];
if (Array.isArray(parsed.centers)) safe.centers = parsed.centers.map(String);
// ADD for Phase 33 keys in both AnalysisPage and OutcomesView:
if (['therapyBreaker','implausibleCrt','flaggedQuality','implausibleVisus'].includes(parsed.preset)) safe.preset = parsed.preset;
if (Array.isArray(parsed.flaggedCaseIds)) safe.flaggedCaseIds = new Set(parsed.flaggedCaseIds.map(String));
if (Array.isArray(parsed.diagnosisSubtype)) safe.diagnosisSubtype = parsed.diaggedCaseIds.map(String);
// ... repeat pattern for comorbidities, hba1cRange, medicationCodes, laterality
```

Note: `flaggedCaseIds` is `Set<string>` at runtime but serialized as `string[]` in JSON. Reconstruct with `new Set(array)`.

### Button Primitives
**Source:** `src/components/primitives/Button.tsx` lines 1–43
**Apply to:** `AdvancedFilterDialog.tsx`, preset buttons in `CohortBuilderPage.tsx`

```typescript
// Variant reference (Button.tsx lines 6–12):
ghost:   'bg-[var(--color-surface)] text-[var(--color-ink)] border-[var(--color-line-2)] hover:bg-[var(--color-surface-2)]'
soft:    'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-transparent hover:bg-[var(--color-line)]'
accent:  'bg-[var(--color-teal)] text-white border-[var(--color-teal)] hover:opacity-90'
// Size reference (Button.tsx lines 14–18):
sm: 'px-2.5 py-1 text-xs rounded-md gap-1'
```

UI-SPEC overrides Button `sm` `px` to `px-3` for preset buttons (Spacing Exceptions). Apply `className="px-3"` override on preset `<Button size="sm">` elements.

### Modal Overlay Pattern
**Source:** `src/components/quality/QualityFlagDialog.tsx` line 36; `src/components/FeedbackButton.tsx` lines 138–146
**Apply to:** `src/pages/AdvancedFilterDialog.tsx`

```tsx
// QualityFlagDialog.tsx line 36 (exact overlay classes):
className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
// FeedbackButton.tsx line 146 (panel classes — adapt max-w-lg instead of max-w-md):
className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg"
```

---

## Safe-Pick Update Obligation

When `CohortFilter` gains new fields, BOTH of these safe-pick implementations must be updated or those consumers will silently drop new fields:

| File | Line | Function |
|------|------|---------|
| `src/pages/AnalysisPage.tsx` | 97–108 | inline safe-pick in `filters` useMemo |
| `src/components/outcomes/OutcomesView.tsx` | 62–73 | `safePickFilter` function |

---

## No Analog Found

All files have analogs. No files in this phase require building from scratch without a codebase reference.

---

## Metadata

**Analog search scope:** `src/pages/`, `src/components/quality/`, `src/components/outcomes/`, `src/context/`, `shared/`, `src/i18n/`, `src/services/`, `config/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-22
