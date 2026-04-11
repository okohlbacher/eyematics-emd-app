/**
 * German translations for clinical FHIR display terms.
 * Extracted from CaseDetailPage for reuse across the application.
 */

import { SNOMED_EYE_RIGHT } from '../services/fhirLoader';
import type { Observation } from '../types/fhir';

/** Map English FHIR display texts to German equivalents */
export const CLINICAL_TERMS_DE: Record<string, string> = {
  // Treatment indications
  'Age-related macular degeneration': 'Altersbedingte Makuladegeneration',
  'Diabetic retinopathy': 'Diabetische Retinopathie',
  // Anamnesis
  'Senile nuclear cataract': 'Senile Kernkatarakt',
  'Primary open-angle glaucoma': 'Primäres Offenwinkelglaukom',
  'Retinal detachment with break': 'Netzhautablösung mit Riss',
  'Essential hypertension': 'Essentielle Hypertonie',
  'Type 2 diabetes mellitus': 'Diabetes mellitus Typ 2',
  'Type 1 diabetes mellitus': 'Diabetes mellitus Typ 1',
  'Hypercholesterolemia': 'Hypercholesterinämie',
  'Coronary artery disease': 'Koronare Herzkrankheit',
  // Segment findings
  'Incipient senile cataract': 'Beginnende senile Katarakt',
  'Acute iridocyclitis': 'Akute Iridozyklitis',
  'Anterior segment unremarkable': 'Vorderer Augenabschnitt unauffällig',
  'Drusen (degenerative)': 'Drusen (degenerativ)',
  'Retinal hemorrhage': 'Netzhautblutung',
  'Macular edema': 'Makulaödem',
  'Posterior segment unremarkable': 'Hinterer Augenabschnitt unauffällig',
  // Adverse events
  'Endophthalmitis post-procedural': 'Endophthalmitis postprozedural',
  'Vitreous hemorrhage': 'Glaskörperblutung',
  'Retinal detachment': 'Netzhautablösung',
  'Elevated IOP post-injection': 'Erhöhter IOD nach Injektion',
  // IOP methods
  'Goldmann applanation tonometry': 'Goldmann-Applanationstonometrie',
  'Non-contact tonometry': 'Non-Contact-Tonometrie',
  // Diabetes
  'Diabetes mellitus Typ 2': 'Diabetes mellitus Typ 2',
  'Diabetes mellitus Typ 1': 'Diabetes mellitus Typ 1',
};

/** Translate a clinical display term based on current locale */
export function translateClinical(text: string, locale: string): string {
  if (locale === 'de' && CLINICAL_TERMS_DE[text]) return CLINICAL_TERMS_DE[text];
  return text;
}

/** Get eye laterality label (OD/OS) from an Observation's bodySite */
export function getEyeLabel(obs: Observation): string {
  const code = obs.bodySite?.coding?.[0]?.code;
  if (code === SNOMED_EYE_RIGHT) return 'OD';
  if (code) return 'OS';
  return '';
}
