// Simplified FHIR types for the EyeMatics Demonstrator
// These map to the subset of HL7 FHIR resources used in the project

export interface FhirCoding {
  system?: string;
  code: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding: FhirCoding[];
  text?: string;
}

export interface FhirQuantity {
  value: number;
  unit?: string;
  system?: string;
}

export interface FhirReference {
  reference: string;
}

export interface FhirIdentifier {
  system?: string;
  value: string;
}

export interface FhirAddress {
  city?: string;
  state?: string;
}

export interface FhirResource {
  resourceType: string;
  id: string;
  meta?: { source?: string; lastUpdated?: string };
}

export interface Organization extends FhirResource {
  resourceType: 'Organization';
  name: string;
  address?: FhirAddress[];
}

export interface Patient extends FhirResource {
  resourceType: 'Patient';
  gender?: string;
  birthDate?: string;
  identifier?: FhirIdentifier[];
}

export interface Condition extends FhirResource {
  resourceType: 'Condition';
  subject: FhirReference;
  code: FhirCodeableConcept;
  clinicalStatus?: FhirCodeableConcept;
  onsetDateTime?: string;
  bodySite?: FhirCodeableConcept[];
  category?: FhirCodeableConcept[];
}

export interface Observation extends FhirResource {
  resourceType: 'Observation';
  status: string;
  subject: FhirReference;
  code: FhirCodeableConcept;
  effectiveDateTime?: string;
  valueQuantity?: FhirQuantity;
  bodySite?: FhirCodeableConcept;
  method?: FhirCodeableConcept;
  component?: Array<{
    code: FhirCodeableConcept;
    valueQuantity?: FhirQuantity;
  }>;
}

export interface Procedure extends FhirResource {
  resourceType: 'Procedure';
  status: string;
  subject: FhirReference;
  code: FhirCodeableConcept;
  performedDateTime?: string;
  bodySite?: FhirCodeableConcept[];
  reasonCode?: FhirCodeableConcept[];
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface MedicationStatement extends FhirResource {
  resourceType: 'MedicationStatement';
  status: string;
  subject: FhirReference;
  medicationCodeableConcept?: FhirCodeableConcept;
  effectivePeriod?: FhirPeriod;
}

export interface ImagingStudy extends FhirResource {
  resourceType: 'ImagingStudy';
  status: string;
  subject: FhirReference;
  started?: string;
  modality?: FhirCoding[];
  description?: string;
  series?: Array<{
    uid: string;
    modality?: FhirCoding;
    instance?: Array<{
      uid: string;
      sopClass?: { code: string };
      title?: string;
    }>;
  }>;
}

export interface FhirBundleEntry {
  resource: FhirResource;
}

export interface FhirBundle {
  resourceType: 'Bundle';
  type: string;
  meta?: {
    lastUpdated?: string;
    source?: string;
  };
  entry: FhirBundleEntry[];
}

// Application-level types derived from FHIR data

export interface CenterInfo {
  id: string;
  name: string;
  city: string;
  state: string;
  patientCount: number;
  lastUpdated: string;
}

export interface PatientCase {
  id: string;
  pseudonym: string;
  gender: string;
  birthDate: string;
  centerId: string;
  centerName: string;
  conditions: Condition[];
  observations: Observation[];
  procedures: Procedure[];
  imagingStudies: ImagingStudy[];
  medications: MedicationStatement[];
}

export interface CohortFilter {
  diagnosis?: string[];
  gender?: string[];
  ageRange?: [number, number];
  visusRange?: [number, number];
  crtRange?: [number, number];
  centers?: string[];
}

export interface SavedSearch {
  id: string;
  name: string;
  createdAt: string;
  filters: CohortFilter;
}

export type QualityStatus = 'unchecked' | 'in_progress' | 'reviewed';

export interface QualityFlag {
  id?: string;
  caseId: string;
  parameter: string;
  errorType: string;
  flaggedAt: string;
  flaggedBy: string;
  status: 'open' | 'acknowledged' | 'resolved';
}
