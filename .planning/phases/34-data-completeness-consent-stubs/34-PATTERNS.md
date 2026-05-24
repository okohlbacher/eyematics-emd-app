# Phase 34: Data Completeness (Consent + Stubs) - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 12 new/modified files
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `shared/types/fhir.ts` | model | — | `shared/types/fhir.ts` (self — add interfaces) | self-extension |
| `src/types/fhir.ts` | model | — | `src/types/fhir.ts` (self — re-export shim) | self-extension |
| `shared/patientCases.ts` | service | transform | `shared/patientCases.ts` (self — add filter) | self-extension |
| `src/services/fhirLoader.ts` | service | request-response | `src/services/fhirLoader.ts` (self — add helper + adjust count) | self-extension |
| `src/pages/LandingPage.tsx` | component | request-response | `src/pages/LandingPage.tsx` (self — add card) | self-extension |
| `src/i18n/translations.ts` | config | — | `src/i18n/translations.ts` (self — add 4 keys) | self-extension |
| `config/settings.yaml` | config | — | `config/settings.yaml` (self — add stubs section) | self-extension |
| `scripts/generate-center-bundle.ts` | utility | batch | `scripts/generate-center-bundle.ts` (self — add Consent + stubs) | self-extension |
| `scripts/augment-reference-bundles.ts` | utility | file-I/O | `scripts/generate-all-bundles.ts` | role-match |
| `scripts/verify-bundle-distributions.mjs` | utility | batch | `scripts/verify-bundle-distributions.mjs` (self — extend assertions) | self-extension |
| `scripts/audit-bundle-codes.mjs` | utility | batch | `scripts/audit-bundle-codes.mjs` (self — whitelist extension) | self-extension |
| `tests/stubIsolation.test.ts` | test | — | `tests/audit-bundle-codes.test.ts` | role-match |
| `tests/datenvollstaendigkeitCard.test.tsx` | test | — | `tests/LandingPage.test.tsx` | exact |
| `tests/augmentReferenceBundles.test.ts` | test | — | `tests/audit-bundle-codes.test.ts` | role-match |

---

## Pattern Assignments

### `shared/types/fhir.ts` — add `Consent` and `Encounter` interfaces

**Analog:** `shared/types/fhir.ts` lines 1–131 (existing resource interfaces)

**Existing interface pattern to copy** (lines 79–87, Procedure as model):
```typescript
export interface Procedure extends FhirResource {
  resourceType: 'Procedure';
  status: string;
  subject: FhirReference;
  code: FhirCodeableConcept;
  performedDateTime?: string;
  bodySite?: FhirCodeableConcept[];
  reasonCode?: FhirCodeableConcept[];
}
```

**New `Encounter` interface — follow same shape:**
```typescript
export interface Encounter extends FhirResource {
  resourceType: 'Encounter';
  status: string;
  subject: FhirReference;
  period?: FhirPeriod;          // FhirPeriod already defined at line 89
  serviceProvider?: FhirReference;
}
```

**New `Consent` interface — follow same shape, covering D-07 fields:**
```typescript
export interface Consent extends FhirResource {
  resourceType: 'Consent';
  status: string;
  scope: FhirCodeableConcept;
  category: FhirCodeableConcept[];
  patient: FhirReference;
  organization?: FhirReference[];
  dateTime?: string;
  policyRule?: FhirCodeableConcept;
  provision?: {
    type: string;
    purpose?: FhirCoding[];
  };
}
```

**Re-export shim** — `src/types/fhir.ts` is a single-line barrel (line 6):
```typescript
export * from '../../shared/types/fhir';
```
No change needed to `src/types/fhir.ts` — new types auto-flow through the barrel.

---

### `shared/patientCases.ts` — stub exclusion at `extractPatientCases` (D-03)

**Analog:** `shared/patientCases.ts` lines 65–99 (the function being modified)

**Insertion point:** After `observationsByRef` is built (line 75) but BEFORE `patients.map` (line 81). The `groupBySubject` call on line 75 must already have run so `observationsByRef` is available.

**Current code at line 81** (the map to prepend the filter before):
```typescript
return patients.map((pat) => {
  const ref = `Patient/${pat.id}`;
  const org = pat.meta?.source ? orgById.get(pat.meta.source) : undefined;
  return { ... };
});
```

**D-03 filter to insert between line 79 and 81:**
```typescript
// D-03: exclude stub Patients (zero Observations) before building PatientCase objects.
// Stubs are identified purely by the absence of Observation resources — no tag/extension.
// This is the SINGLE chokepoint; all clinical consumers (cohort, outcomes, quality,
// case detail, charts, server aggregation) are clean by construction.
const clinicalPatients = patients.filter((pat) => {
  const ref = `Patient/${pat.id}`;
  return (observationsByRef.get(ref) ?? []).length > 0;
});

return clinicalPatients.map((pat) => {
```

**Key constraint:** `resourcesOfType` calls for `observations` (line 68) and `groupBySubject(observations)` (line 75) must remain before this filter. `observationsByRef` is required for the filter predicate.

---

### `src/services/fhirLoader.ts` — two changes: stub exclusion from `patientCount` (D-04) + new `countRawPatients` helper (D-09)

**Analog:** `src/services/fhirLoader.ts` lines 40–71 (the `resourcesOfType` + `extractCenters` functions being modified)

**`resourcesOfType` helper already present** (lines 40–48) — reuse, do not duplicate:
```typescript
function resourcesOfType<T extends FhirResource>(
  bundles: FhirBundle[],
  type: string
): T[] {
  return bundles.flatMap((b) =>
    b.entry
      .filter((e) => e.resource.resourceType === type)
      .map((e) => e.resource as T)
  );
}
```

**Current `patientCount` line 67** (must change to exclude zero-Observation patients):
```typescript
patientCount: orgPatients.length,   // current — counts ALL patients per org
```

**D-04 replacement pattern — compute clinical patients inline:**
```typescript
// D-04: patientCount = patients with ≥1 Observation (excludes stubs).
// observationsByPatientId built from same bundles; same pattern as extractPatientCases.
patientCount: orgPatients.filter((p) =>
  observations.some((o) => o.subject.reference === `Patient/${p.id}`)
).length,
```

Note: `observations` must be extracted before the `orgs.map` call. Add:
```typescript
const observations = resourcesOfType<Observation>(bundles, 'Observation');
```
after line 53 (after `patients`), importing `Observation` type from `'../types/fhir'`.

**New `countRawPatients` helper (D-09) — append after `extractCenters`:**
```typescript
/**
 * D-09: Count ALL Patient resources across the provided bundles.
 * Does NOT exclude stubs — this is the Datenvollzähligkeit denominator.
 * The bundles parameter already contains only the user's permitted bundles
 * (server-side filtering by req.auth.centers), so no extra center filter
 * is needed for the full-page LandingPage display.
 */
export function countRawPatients(bundles: FhirBundle[]): number {
  return bundles.reduce(
    (sum, b) =>
      sum + b.entry.filter((e) => e.resource.resourceType === 'Patient').length,
    0,
  );
}
```

---

### `src/pages/LandingPage.tsx` — new Datenvollzähligkeit card (D-08 / D-09 / D-10)

**Analog:** `src/pages/LandingPage.tsx` lines 136–158 (existing KPI tiles grid — the card follows this exact pattern)

**Additional import needed** — `ShieldCheck` from lucide-react (line 1–10 import block):
```typescript
import {
  Activity,
  Building2,
  ChevronRight,
  Clock,
  Download,
  Plus,
  ScanEye,
  ShieldCheck,   // ADD
  Users,
} from 'lucide-react';
```

**Import `countRawPatients`** from fhirLoader (line 18):
```typescript
import { countRawPatients, getCenterShorthand } from '../services/fhirLoader';
```

**Destructure `bundles` from `useData()`** (line 31):
```typescript
const { loading, bundles, centers, cases } = useData();
```

**Compute metric values** — add after line 56 (after existing KPI derivations), using a separate raw count that never touches `cases`:
```typescript
// D-09: denominator = raw Patient count from bundles (includes stubs).
// D-05: numerator = cases.length (extractPatientCases already excluded stubs).
const totalRawPatients = countRawPatients(bundles);
const consentedPatients = cases.length;  // non-stub clinical set
const completenessFraction =
  totalRawPatients > 0 ? consentedPatients / totalRawPatients : 0;
const completenessPercent = Math.round(completenessFraction * 100);
```

**Completeness color helper** — follows `scoreColor` pattern from `src/utils/qualityMetrics.ts:51`, but uses CSS token variables per UI-SPEC:
```typescript
function completenessColor(fraction: number): string {
  if (fraction >= 0.5) return 'var(--color-sage)';
  if (fraction >= 0.25) return 'var(--color-amber)';
  return 'var(--color-coral)';
}
```

**Card JSX** — insert between the KPI tiles grid `</div>` (line 158) and the Centres row `<div` (line 160). Copies the `Tile` / icon-container / mono-value / label-row pattern from lines 141–156:
```tsx
{/* Datenvollzähligkeit card — D-10: full-width row between KPI tiles and Centers */}
<div className="px-8 mb-3.5">
  <Tile className="p-[18px_18px_14px]">
    <div className="flex items-center gap-4">
      <div
        className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
        style={{ background: 'var(--color-teal-soft)' }}
      >
        <ShieldCheck
          className="w-4 h-4"
          style={{ color: 'var(--color-teal)' }}
          aria-hidden="true"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--color-ink-3)] mb-1">
          {t('datenvollstaendigkeitCaption')}
        </div>
        <div className="flex items-baseline gap-3">
          <span
            className="text-[32px] font-semibold tracking-[-0.03em] font-data"
            style={{ color: completenessColor(completenessFraction) }}
          >
            {completenessPercent} %
          </span>
          <span className="text-[12px] text-[var(--color-ink-3)]">
            {t('datenvollstaendigkeitPatients')
              .replace('{n}', String(consentedPatients))
              .replace('{m}', String(totalRawPatients))}
          </span>
        </div>
        {/* Progress bar — replicates MetricCard.tsx:31-36 pattern */}
        <div className="mt-2 h-1.5 rounded-full bg-[var(--color-teal-soft)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(completenessPercent, 100)}%`,
              backgroundColor: completenessColor(completenessFraction),
            }}
            role="progressbar"
            aria-valuenow={completenessPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('datenvollstaendigkeitAriaLabel').replace('{pct}', String(completenessPercent))}
          />
        </div>
      </div>
    </div>
  </Tile>
</div>
```

---

### `src/i18n/translations.ts` — 4 new i18n keys

**Analog:** `src/i18n/translations.ts` lines 1–60 (existing camelCase key pattern)

**Existing key shape to copy** (line 47):
```typescript
cases: { de: 'Fälle', en: 'Cases' },
```

**New keys to append** in the LandingPage section (near `connectedCenters`, `pseudonymizedCases` etc.):
```typescript
datenvollstaendigkeitCaption: { de: 'DATENVOLLZÄHLIGKEIT', en: 'DATA COMPLETENESS' },
datenvollstaendigkeitLabel: { de: 'Datenvollzähligkeit', en: 'Data completeness' },
datenvollstaendigkeitPatients: { de: '{n} / {m} Patienten', en: '{n} / {m} patients' },
datenvollstaendigkeitAriaLabel: { de: 'Datenvollzähligkeit: {pct}%', en: 'Data completeness: {pct}%' },
```

**Convention:** camelCase key, object with `de` and `en` string properties. Interpolation uses `{placeholder}` in the string, replaced by callers with `.replace('{n}', ...)` — the `t()` function does not perform interpolation itself (verified by inspection of existing usage in LandingPage).

---

### `scripts/generate-center-bundle.ts` — add Consent + stubs after the full-patient loop (D-11 / D-12)

**Analog:** `scripts/generate-center-bundle.ts` lines 315–601 (`generateCenterBundle` function)

**PRNG import** (line 33 — already present):
```typescript
import { addDays, mulberry32, seededRandInt } from './prng.js';
```

**Full-patient loop ends at line 581** (`}` closing `for (let i = 1; i <= patients; i++)`). All new `rand()` calls for stubs and Consent MUST come after line 581 to avoid shifting PRNG state for existing patients.

**Bundle assembly at line 587–601** (current — add new arrays before this):
```typescript
const bundle = {
  resourceType: 'Bundle',
  type: 'collection',
  meta: { lastUpdated, source: name },
  entry: [
    orgEntry,
    ...patientEntries,
    ...conditionEntries,
    ...observationEntries,
    ...procedureEntries,
    ...medicationEntries,
  ],
};
```

**Insert after line 581, before line 583 (`// Seed-derived meta.lastUpdated`):**
```typescript
// ---------------------------------------------------------------------------
// D-12 / D-11: Consent resources (one per full patient) + stub generation.
// ALL rand() calls for these come AFTER the full-patient loop to preserve
// byte-identical regen of existing patients (Pitfall 2 guard).
// ---------------------------------------------------------------------------

const consentEntries: unknown[] = [];
const sh = shorthand.toLowerCase();

// Consent: one active research Consent per full patient.
for (let i = 1; i <= patients; i++) {
  const patNum = String(i).padStart(4, '0');
  const patId = `pat-${sh}-${patNum}`;
  // Consent dateTime: random offset [0, 60] days after a fixed reference date.
  // One rand() call per patient — after the full-patient loop.
  const consentOffset = seededRandInt(rand, 0, 60);
  const consentDate = addDays('2022-06-01', consentOffset + i * 3); // spread across enrollment
  consentEntries.push({
    resource: {
      resourceType: 'Consent',
      id: `consent-${sh}-${patNum}`,
      status: 'active',
      scope: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          code: 'research',
          display: 'Research',
        }],
      },
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'INFOACCESS',
          display: 'Information Access',
        }],
      }],
      patient: { reference: `Patient/${patId}` },
      organization: [{ reference: `Organization/${centerId}` }],
      dateTime: consentDate,
      policyRule: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'OPTIN',
        }],
      },
      provision: {
        type: 'permit',
        purpose: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
          code: 'HRESCH',
          display: 'healthcare research',
        }],
      },
    },
  });
}

// Stubs: D-11 per-site factor in [2, 8] drawn once from seeded PRNG.
const stubFactor = seededRandInt(rand, 2, 8);
const stubCount = Math.round(patients * stubFactor);
const stubEntries: unknown[] = [];
const stubEncounterEntries: unknown[] = [];

for (let s = 1; s <= stubCount; s++) {
  const stubNum = String(s).padStart(4, '0');
  const stubId = `pat-${sh}-stub-${stubNum}`;
  // D-02: only gender + year-of-birth + one Encounter. No Observations.
  const stubGender = rand() < 0.55 ? 'female' : 'male';
  const stubBirthYear = 1930 + seededRandInt(rand, 0, 65); // 1930–1995
  const stubBirthDate = `${stubBirthYear}-01-01`; // YYYY-01-01 per Claude's Discretion
  // One minimal Encounter — visit date within the baseline range used by full patients.
  const visitOffset = seededRandInt(rand, 0, 880);
  const visitDate = addDays('2022-01-01', visitOffset);
  stubEntries.push({
    resource: {
      resourceType: 'Patient',
      id: stubId,
      meta: { source: centerId }, // D-10: site attribution for filter
      gender: stubGender,
      birthDate: stubBirthDate,
      // No identifier (no pseudonym system) — stubs are not enrollees.
    },
  });
  stubEncounterEntries.push({
    resource: {
      resourceType: 'Encounter',
      id: `enc-${sh}-stub-${stubNum}`,
      status: 'finished',
      subject: { reference: `Patient/${stubId}` },
      serviceProvider: { reference: `Organization/${centerId}` },
      period: { start: visitDate },
    },
  });
}
```

**Update bundle entry array to include new resource arrays:**
```typescript
entry: [
  orgEntry,
  ...patientEntries,
  ...consentEntries,         // ADD
  ...stubEntries,             // ADD
  ...stubEncounterEntries,    // ADD
  ...conditionEntries,
  ...observationEntries,
  ...procedureEntries,
  ...medicationEntries,
],
```

---

### `scripts/augment-reference-bundles.ts` — new idempotent append-only script for Aachen + Tübingen (D-13)

**Analog:** `scripts/generate-all-bundles.ts` (lines 1–56 — file I/O pattern, `writeFileSync`, `JSON.stringify(bundle, null, 2) + '\n'`)

**File I/O pattern from generate-all-bundles.ts line 54:**
```typescript
fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
```

**PRNG import from generate-center-bundle.ts line 33:**
```typescript
import { addDays, mulberry32, seededRandInt } from './prng.js';
```

**Idempotency check pattern (D-13):**
```typescript
const alreadyAugmented = bundle.entry.some(
  (e: { resource: { resourceType: string } }) =>
    e.resource.resourceType === 'Consent'
);
if (alreadyAugmented) {
  console.log(`[augment] ${file} already augmented — skipping`);
  return;
}
```

**Append-only invariant** — never mutate `bundle.entry` items that were already present. Only push new entries:
```typescript
// Collect full patients (those with ≥1 Observation) — D-03 same structural rule
const obsByPatient = new Map<string, number>();
for (const e of bundle.entry) {
  if (e.resource.resourceType === 'Observation') {
    const ref = (e.resource as { subject?: { reference?: string } }).subject?.reference;
    if (ref) obsByPatient.set(ref, (obsByPatient.get(ref) ?? 0) + 1);
  }
}
const fullPatientIds = bundle.entry
  .filter((e) =>
    e.resource.resourceType === 'Patient' &&
    (obsByPatient.get(`Patient/${e.resource.id}`) ?? 0) > 0
  )
  .map((e) => e.resource.id as string);

// Append Consent entries (one per full patient)
for (const patId of fullPatientIds) {
  bundle.entry.push({ resource: buildConsent(patId, centerId, rand) });
}

// Append stubs
const stubFactor = seededRandInt(rand, 2, 8);
const stubCount = Math.round(fullPatientIds.length * stubFactor);
for (let s = 1; s <= stubCount; s++) {
  const [stubPatient, stubEncounter] = buildStub(centerId, rand, s, shorthand);
  bundle.entry.push({ resource: stubPatient });
  bundle.entry.push({ resource: stubEncounter });
}
```

**Write-back with correct format (matches generate-all-bundles.ts line 54):**
```typescript
fs.writeFileSync(filePath, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
```

**Reference sites to augment** (per D-12 + generate-all-bundles.ts SITES for seeds):
```typescript
const REFERENCE_SITES = [
  { file: 'public/data/center-aachen.json',   centerId: 'org-uka', shorthand: 'uka', seed: 70101 },
  { file: 'public/data/center-tuebingen.json', centerId: 'org-ukt', shorthand: 'ukt', seed: 70116 },
];
```

---

### `scripts/verify-bundle-distributions.mjs` — extend stub-ratio assertion (D-14)

**Analog:** `scripts/verify-bundle-distributions.mjs` lines 44–50 (`THRESHOLDS` object) and lines 181–242 (`verify` function)

**THRESHOLDS extension:**
```javascript
const THRESHOLDS = {
  amdMedianAgeMin: 70,
  amdComorbidityRateMin: 0.6,
  dmeHba1cMin: 2,
  stubFactorMin: 2,   // ADD: per-site stub count / consented count ≥ 2
  stubFactorMax: 8,   // ADD: per-site stub count / consented count ≤ 8
};
```

**Stub ratio assertion to add in `verify` function (after existing assertions):**
```javascript
// 5) Per-bundle stub ratio in [stubFactorMin, stubFactorMax]
// (This assertion is per-bundle, not aggregate — iterate separately from allPatients)
// Caller must pass per-bundle stats; see aggregateBundle extension below.
```

**`aggregateBundle` must count stub vs full patients separately:**
```javascript
// In aggregateBundle: count stub patients (zero Observations)
const stubPatients = new Set();  // patient IDs with 0 Observations
// (all Patient IDs not in obsByPatient with count > 0)
```

Pattern mirrors how `patients` Map is built at lines 135–147 and how `hba1cCount` is accumulated at lines 166–176.

---

### `scripts/audit-bundle-codes.mjs` — whitelist Consent coding systems (D-14)

**Analog:** `scripts/audit-bundle-codes.mjs` lines 47–61 (`WHITELIST_SYSTEMS` and `WHITELIST_KEYS`)

**Current `WHITELIST_SYSTEMS`** (lines 49–52):
```javascript
const WHITELIST_SYSTEMS = new Set([
  'http://loinc.org',
  'http://www.whocc.no/atc',
]);
```

**D-14 extension — add Consent coding systems to `WHITELIST_SYSTEMS`:**
```javascript
const WHITELIST_SYSTEMS = new Set([
  'http://loinc.org',
  'http://www.whocc.no/atc',
  // Phase 34: Consent coding systems (structural, not diagnosis codes)
  'http://terminology.hl7.org/CodeSystem/consentscope',
  'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  'http://terminology.hl7.org/CodeSystem/v3-ActReason',
]);
```

**Also extend the `interesting` resource-type filter** (line 112) to handle Consent entries without flagging them as unresolvable:
```javascript
// Current:
const interesting = new Set(['Condition', 'Observation', 'Procedure', 'MedicationStatement']);
// Consent: do NOT add to interesting — Consent codings are fully whitelisted by system.
// The audit skip for non-interesting resource types means Consent is silently passed.
```

---

## Tests

### `tests/stubIsolation.test.ts` — D-03 regression + D-04 patientCount (new)

**Analog:** `tests/audit-bundle-codes.test.ts` (lines 1–70, non-RTL unit test structure)

**Test framework pattern** (lines 1–12):
```typescript
import { describe, expect, it } from 'vitest';
```

**Fixture bundle pattern** — build minimal in-memory bundles rather than reading files, following the in-memory bundle approach:
```typescript
// Minimal bundle with 2 full patients (have Observations) + 1 stub (no Observations)
const bundle: FhirBundle = {
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    { resource: { resourceType: 'Organization', id: 'org-test', name: 'Test', address: [] } },
    { resource: { resourceType: 'Patient', id: 'pat-full-001', meta: { source: 'org-test' }, gender: 'female', birthDate: '1950-01-01' } },
    { resource: { resourceType: 'Patient', id: 'pat-stub-001', meta: { source: 'org-test' }, gender: 'male', birthDate: '1960-01-01' } },
    { resource: { resourceType: 'Observation', id: 'obs-001', status: 'final', subject: { reference: 'Patient/pat-full-001' }, code: { coding: [{ code: 'test' }] } } },
  ],
};
```

**Assertion pattern** (mirrors `queryByText().not.toBeNull()` project convention but for unit tests uses `expect(x).toBe(y)`):
```typescript
it('stub patients are excluded from extractPatientCases output', () => {
  const cases = extractPatientCases([bundle]);
  expect(cases.map((c) => c.id)).not.toContain('pat-stub-001');
  expect(cases.map((c) => c.id)).toContain('pat-full-001');
});

it('extractCenters patientCount excludes stubs (D-04)', () => {
  const centers = extractCenters([bundle]);
  const testCenter = centers.find((c) => c.id === 'org-test');
  expect(testCenter?.patientCount).toBe(1); // only full patient
});
```

---

### `tests/datenvollstaendigkeitCard.test.tsx` — card rendering + site-filter reactivity (new)

**Analog:** `tests/LandingPage.test.tsx` (lines 1–194 — exact pattern to replicate)

**Test environment header** (line 1):
```typescript
// @vitest-environment jsdom
```

**Mock pattern for `useData`** (lines 24–26 and 61–66) — extend to include `bundles`:
```typescript
vi.mock('../src/context/DataContext', () => ({
  useData: vi.fn(),
}));

// In setupMocks:
(useData as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
  loading: false,
  bundles: [/* minimal bundle with stubs and full patients */],
  centers: [],
  cases: [/* PatientCase objects for full patients only */],
});
```

**`useRecentActivity` mock** (lines 33–35 — required because LandingPage always calls this hook):
```typescript
vi.mock('../src/hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ entries: [], record: vi.fn(), clear: vi.fn() }),
}));
```

**RTL assertion pattern** (project convention — NO jest-dom):
```typescript
const el = screen.queryByText('21 %');
expect(el).not.toBeNull();
// Not: expect(el).toBeInTheDocument()  ← forbidden
```

**`countRawPatients` mock** — since the card calls `countRawPatients(bundles)`, mock `fhirLoader`:
```typescript
vi.mock('../src/services/fhirLoader', async () => {
  const actual = await vi.importActual('../src/services/fhirLoader');
  return { ...actual, countRawPatients: vi.fn(() => 10), getCenterShorthand: vi.fn((id) => id) };
});
```

---

### `tests/augmentReferenceBundles.test.ts` — D-13 byte-equality + idempotency (new)

**Analog:** `tests/audit-bundle-codes.test.ts` (lines 37–60 — fixture manipulation + `spawnSync` pattern)

**File-read + modify approach** (lines 40–49):
```typescript
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Copy reference bundle to temp dir, run augmentation, assert curated resources unchanged
const tmp = mkdtempSync(join(tmpdir(), 'augment-test-'));
const src = readFileSync('public/data/center-aachen.json', 'utf-8');
const bundleBefore = JSON.parse(src);
```

**Pre-augmentation snapshot of curated entry IDs:**
```typescript
const curatedIds = new Set(bundleBefore.entry.map((e) => e.resource.id));
```

**Post-augmentation assertion:**
```typescript
const bundleAfter = JSON.parse(readFileSync(outPath, 'utf-8'));
// All pre-existing resources must be byte-identical
for (const e of bundleBefore.entry) {
  const after = bundleAfter.entry.find((a) => a.resource.id === e.resource.id);
  expect(JSON.stringify(after)).toBe(JSON.stringify(e));
}
// New resources (Consent + stubs) were appended
const newEntries = bundleAfter.entry.filter((e) => !curatedIds.has(e.resource.id));
expect(newEntries.length).toBeGreaterThan(0);
```

**Idempotency test:**
```typescript
it('is idempotent — running twice does not add more resources', () => {
  // Run augmentation on already-augmented bundle
  const countAfterFirst = bundleAfter.entry.length;
  spawnSync('node', ['--import', 'tsx', 'scripts/augment-reference-bundles.ts', '--dry-run-file', outPath], ...);
  const bundleAfterSecond = JSON.parse(readFileSync(outPath, 'utf-8'));
  expect(bundleAfterSecond.entry.length).toBe(countAfterFirst);
});
```

---

## Shared Patterns

### Mulberry32 deterministic PRNG
**Source:** `scripts/prng.ts` lines 9–36
**Apply to:** `scripts/generate-center-bundle.ts` (extension) and `scripts/augment-reference-bundles.ts` (new)
```typescript
import { addDays, mulberry32, seededRandInt } from './prng.js';

const rand = mulberry32(seed);  // one per site; all draws flow through this
const offset = seededRandInt(rand, 0, 880);   // inclusive integer
const date = addDays('2022-01-01', offset);    // ISO YYYY-MM-DD
```
**Critical constraint:** New `rand()` calls MUST come AFTER the existing full-patient loop in `generate-center-bundle.ts` to avoid shifting PRNG state.

### `resourcesOfType` bundle scanning
**Source:** `shared/patientCases.ts` lines 39–45 (shared) and `src/services/fhirLoader.ts` lines 40–48 (frontend)
**Apply to:** Any new code that needs to scan bundle entries by resource type
```typescript
function resourcesOfType<T>(bundles: BundleLike[], type: string): T[] {
  return bundles.flatMap((b) =>
    b.entry
      .filter((e) => e.resource.resourceType === type)
      .map((e) => e.resource as unknown as T),
  );
}
```

### KPI card tile pattern (LandingPage)
**Source:** `src/pages/LandingPage.tsx` lines 141–156
**Apply to:** Datenvollzähligkeit card in LandingPage
```tsx
<Tile key={s.label} className="p-[18px_18px_14px]">
  <div className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: pair.bg }}>
    <Icon className="w-4 h-4" style={{ color: pair.fg }} />
  </div>
  <div className="text-[32px] font-semibold tracking-[-0.03em] text-[var(--color-ink)] mt-3.5 font-data">
    {s.value}
  </div>
  <div className="flex justify-between items-center mt-1">
    <div className="text-[12px] text-[var(--color-ink-2)]">{s.label}</div>
    <div className="text-[11px] text-[var(--color-ink-3)]">{s.sub}</div>
  </div>
</Tile>
```

### Progress bar pattern
**Source:** `src/components/doc-quality/MetricCard.tsx` lines 31–36
**Apply to:** Datenvollzähligkeit card progress bar
```tsx
<div className="mt-2 h-1.5 rounded-full bg-white/40">
  <div
    className="h-full rounded-full transition-all duration-500"
    style={{ width: `${Math.min(rounded, 100)}%`, backgroundColor: scoreColor(score) }}
  />
</div>
```
Note: use `bg-[var(--color-teal-soft)]` for track (not `bg-white/40`) to match token system.

### Semantic color function pattern
**Source:** `src/utils/qualityMetrics.ts` lines 51–55 (`scoreColor`)
**Apply to:** `completenessColor` helper in LandingPage
```typescript
export function scoreColor(score: number): string {
  if (score > 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}
```
New function uses CSS variable tokens instead of hex (per UI-SPEC and token system):
```typescript
function completenessColor(fraction: number): string {
  if (fraction >= 0.5) return 'var(--color-sage)';
  if (fraction >= 0.25) return 'var(--color-amber)';
  return 'var(--color-coral)';
}
```

### File write pattern for bundles
**Source:** `scripts/generate-all-bundles.ts` line 54
**Apply to:** `scripts/augment-reference-bundles.ts`
```typescript
fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2) + '\n', 'utf-8');
```
Must use `null, 2` indent + trailing `'\n'` — exactly this format, no variation.

### LandingPage test mock pattern
**Source:** `tests/LandingPage.test.tsx` lines 14–71 (mock setup)
**Apply to:** `tests/datenvollstaendigkeitCard.test.tsx`
- Mock `useAuth`, `useData`, `useLanguage`, `useRecentActivity`
- Mock `useData` must now include `bundles: FhirBundle[]` alongside `centers` and `cases`
- Use `t as translate` from `'../src/i18n/translations'` for text lookups
- RTL assertions: `screen.queryByText(x).not.toBeNull()` / `.toBeNull()` — no jest-dom

### i18n key registration
**Source:** `src/i18n/translations.ts` lines 1–60 (key object shape)
**Apply to:** 4 new Datenvollzähligkeit keys
```typescript
keyName: { de: 'German text', en: 'English text' },
```
Interpolation in callers uses string `.replace('{placeholder}', value)` — the `t()` function returns the raw string including `{n}` markers.

---

## No Analog Found

All files have analogs or are self-extensions of existing files. No new framework or pattern territory.

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `scripts/augment-reference-bundles.ts` | utility | file-I/O | No direct analog — closest is `generate-all-bundles.ts` for I/O shape and `generate-center-bundle.ts` for FHIR resource building. Idempotency guard is a new pattern; see Pattern Assignments above. |

---

## Metadata

**Analog search scope:** `shared/`, `src/services/`, `src/pages/`, `src/components/`, `src/context/`, `src/i18n/`, `src/utils/`, `scripts/`, `tests/`, `config/`
**Files scanned:** 16 source files read in full
**Pattern extraction date:** 2026-05-24
