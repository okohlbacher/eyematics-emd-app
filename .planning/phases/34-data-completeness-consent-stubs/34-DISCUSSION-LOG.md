# Phase 34: Data Completeness (Consent + Stubs) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 34-data-completeness-consent-stubs
**Areas discussed:** Stub isolation strategy, Consent model & "consented" definition, Metric computation & dashboard display, Stub generation & reference-bundle handling

---

## Stub isolation strategy (H2)

### Stub representation
| Option | Description | Selected |
|--------|-------------|----------|
| Tagged FHIR Patient, filtered at extraction | meta.tag/profile marker, filtered at extractPatientCases + patientCount | |
| Separate non-clinical stub record (not a Patient) | distinct structure, never a FHIR Patient | |
| Separate stub bundle the metric reads only | isolation by load path | |
| **Free-text (user)** | **Stubs are real FHIR Patient resources, no Observations, recognized by that absence at import** | ✓ |

**User's choice:** Real FHIR Patient resources with no observations, recognized structurally upon import.
**Notes:** A fourth approach distinct from the menu — recognition by clinical emptiness, not a tag.

### Recognition predicate
| Option | Description | Selected |
|--------|-------------|----------|
| Zero Observations | stub = Patient with no Observation resources | ✓ |
| Zero clinical resources of any kind | stub = no Obs/Conditions/Procedures/Meds/Imaging | |
| No Consent resource present | recognize by absence of active Consent | |

**User's choice:** Zero Observations.

### Encounter date representation
| Option | Description | Selected |
|--------|-------------|----------|
| A minimal FHIR Encounter resource | one site-attributed Encounter per stub | ✓ |
| Patient.meta.lastUpdated / extension field | store the date on the Patient | |
| You decide | defer | |

**User's choice:** A minimal FHIR Encounter resource.

### Enforcement point
| Option | Description | Selected |
|--------|-------------|----------|
| Inside extractPatientCases | drop zero-Observation patients at the single chokepoint + regression test | ✓ |
| A filter step at each consumer | each surface filters stubs itself | |
| You decide | defer | |

**User's choice:** Inside extractPatientCases (single chokepoint), with a separate raw-count path for the metric.

---

## Consent model & "consented" definition

### Numerator definition
| Option | Description | Selected |
|--------|-------------|----------|
| Count active research Consent resources | numerator keyed off Consent | |
| Count non-stub patients (has observations) | numerator = patients with clinical data | ✓ |

**User's choice:** Count non-stub patients (has observations). Consent resources still added but the metric keys off observations.

### Consent rate
| Option | Description | Selected |
|--------|-------------|----------|
| All full patients consented | 100% of non-stubs consented; gap is stubs only | ✓ |
| Model a partial consent rate among full patients | a fraction of full patients lack consent | |

**User's choice:** All full patients consented.

### Consent shape
| Option | Description | Selected |
|--------|-------------|----------|
| Minimal valid research Consent | status=active, scope, ref, policyRule | |
| Richer Consent with provisions | adds Consent.provision detail | ✓ |
| You decide | defer | |

**User's choice:** Richer Consent with provisions.

---

## Metric computation & dashboard display

### Compute location
| Option | Description | Selected |
|--------|-------------|----------|
| Client-side from loaded bundles | O(N) count, no server round-trip | ✓ |
| Server-side endpoint | API route, server-filtered | |
| You decide | defer | |

**User's choice:** Client-side from loaded bundles.

### Display
| Option | Description | Selected |
|--------|-------------|----------|
| One Datenvollzähligkeit summary card | total + consented + fraction, site-filtered | ✓ |
| Summary card + per-site breakdown | global card plus per-center fractions | |
| You decide / defer to UI-SPEC | layout deferred | |

**User's choice:** One Datenvollzähligkeit summary card.

### Existing patientCount meaning
| Option | Description | Selected |
|--------|-------------|----------|
| Keep it as consented-only (exclude stubs) | per-center count stays clinically-real | ✓ |
| Make it total (include stubs) | per-center count becomes consented + stubs | |
| You decide | defer | |

**User's choice:** Keep it consented-only (exclude stubs); extractCenters.patientCount gets the stub-exclusion filter.

---

## Stub generation & reference-bundle handling

### Multiplier
| Option | Description | Selected |
|--------|-------------|----------|
| 4.5× consented, in settings.yaml | single global midpoint multiplier | |
| Fixed integer multiple in settings.yaml | whole-number multiple | |
| You decide the exact default | settle on settings.yaml as source | |
| **Free-text (user)** | **Per-site random factor in [2, 8], applied once during generation** | ✓ |

**User's choice:** Per-site random factor between 2 and 8, applied only once during stub generation (deterministically seeded — see follow-up).
**Notes:** Per-site variation intended; not a single global multiplier.

### Reference-site stubs
| Option | Description | Selected |
|--------|-------------|----------|
| Consent only, no stubs | reference sites get Consent, no stubs (~100%) | |
| Add stubs to reference sites too | reference sites also get stubs | ✓ |

**User's choice:** Add stubs to reference sites too.

### Reference Consent mechanism
| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent augmentation script | re-runnable script appends Consent/stubs, curated untouched | ✓ |
| Manual one-time edit committed as data | direct JSON edit, no script | |
| You decide | defer | |

**User's choice:** Idempotent augmentation script.

### Determinism
| Option | Description | Selected |
|--------|-------------|----------|
| Seeded per-site, deterministic | factor from per-site Mulberry32 seed; byte-identical reruns | ✓ |
| Pinned per-site constants | fixed factor per site in config | |
| You decide | defer | |

**User's choice:** Seeded per-site, deterministic.

### D-06 curated-data guard
| Option | Description | Selected |
|--------|-------------|----------|
| Append-only, existing resources byte-untouched | only append new resources + test asserts curated unchanged | ✓ |
| You decide | defer | |

**User's choice:** Append-only, existing curated resources byte-untouched.

---

## Claude's Discretion

- `birthDate` representation for "year of birth".
- New `Consent` / `Encounter` TS types in `shared/types/fhir.ts`.
- Exact `settings.yaml` key names; whether the [2,8] range is itself configurable.
- DE/EN i18n keys for the completeness card.
- Card layout / placement on LandingPage (defer to UI-SPEC).
- Whether generator + augmentation script share a stub/Consent builder helper.

## Deferred Ideas

- Server-side completeness endpoint.
- Partial consent rate among full patients.
- Making the metric read Consent resources instead of clinical emptiness.
- Exposing stub demographics anywhere beyond the aggregate count.
