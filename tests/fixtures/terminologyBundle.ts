/**
 * Test fixture for `collectCodings` (Phase 25, plan 25-01).
 *
 * Contains one of each interesting resource type plus an unrelated Patient
 * (which `collectCodings` must skip).
 */
import type { FhirBundle } from '../../src/types/fhir';

export const terminologyFixture: FhirBundle = {
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        id: 'patient-1',
      },
    },
    {
      resource: {
        resourceType: 'Condition',
        id: 'cond-1',
        subject: { reference: 'Patient/patient-1' },
        code: {
          coding: [
            { system: 'http://snomed.info/sct', code: '267718000', display: 'AMD' },
          ],
        },
      },
    },
    {
      resource: {
        resourceType: 'Condition',
        id: 'cond-2',
        subject: { reference: 'Patient/patient-1' },
        code: {
          coding: [
            { system: 'http://fhir.de/CodeSystem/bfarm/icd-10-gm', code: 'E11.9' },
          ],
        },
      },
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-1',
        status: 'final',
        subject: { reference: 'Patient/patient-1' },
        code: {
          coding: [
            { system: 'http://loinc.org', code: '79880-1' },
          ],
        },
      },
    },
    {
      resource: {
        resourceType: 'Procedure',
        id: 'proc-1',
        status: 'completed',
        subject: { reference: 'Patient/patient-1' },
        code: {
          coding: [
            { system: 'http://snomed.info/sct', code: '36189003' },
          ],
        },
      },
    },
    {
      // Coding with no system — should bucket under '_'
      resource: {
        resourceType: 'Condition',
        id: 'cond-3',
        subject: { reference: 'Patient/patient-1' },
        code: {
          coding: [
            { code: 'NOSYS' },
          ],
        },
      },
    },
  ],
};
