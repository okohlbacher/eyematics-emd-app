/**
 * Cohort comparison selection in the URL (?cohorts=), shared by the analysis tabs Verläufe and Aggregiert
 * (Z0-P23: one selection for both tabs; extracted from useOutcomesRouteState).
 */
import type { SetURLSearchParams } from 'react-router-dom';

import { ALL_PATIENTS_COHORT_ID } from '../../services/allPatientsCohort';

export interface CompareHandlers {
  handleCompareChange: (nextIds: string[], options?: { replace?: boolean }) => void;
  openCompare: () => void;
  handleCompareReset: () => void;
}

export function compareHandlers(args: {
  primaryCohortId: string | null;
  crossCohortIds: string[];
  isCrossMode: boolean;
  setSearchParams: SetURLSearchParams;
  setCompareOpen: (open: boolean) => void;
}): CompareHandlers {
  const { primaryCohortId, crossCohortIds, isCrossMode, setSearchParams, setCompareOpen } = args;

  const handleCompareChange = (nextIds: string[], options?: { replace?: boolean }) => {
    setSearchParams((p) => {
      // J7 (v1.15-p3): only KEEP an already-locked primary (the ?cohort= the view was
      // opened with). Do NOT promote nextIds[0] to a new locked primary — the cohort-
      // split flow opens compare with ?cohorts= and NO ?cohort=, and the sub-cohorts
      // must all stay freely deselectable (nothing force-locked). When a primary
      // already exists it is preserved + kept selected (the single-cohort→compare flow
      // it was opened from is unchanged).
      const primary = primaryCohortId ?? null;
      const ensured = primary && !nextIds.includes(primary) ? [primary, ...nextIds] : nextIds;
      const capped = ensured.slice(0, 4);
      // L3 (v1.17): persist ?cohorts= for ANY in-progress selection (>=1), not only
      // at >=2. The view still only enters cross mode at >=2 valid cohorts, but keeping
      // a single pick in the URL means it is NOT discarded — so the drawer stays
      // interactive and the user can add a second cohort. Only an EMPTY selection
      // clears the param.
      if (capped.length >= 1) {
        p.set('cohorts', capped.join(','));
        // D-05: ?cohorts= takes precedence — remove ?cohort= to avoid ambiguity, then re-add primary.
        p.delete('cohort');
        if (primary) p.set('cohort', primary);
      } else {
        p.delete('cohorts');
        if (primary) p.set('cohort', primary);
      }
      return p;
    }, options);
  };

  // Z0-P05: opening the compare drawer without an active comparison preselects "Alle Patienten" (each time;
  // not in the cohort-split flow, which opens the drawer via ?compare=open). It counts toward the cap of 4.
  const openCompare = () => {
    if (!isCrossMode) {
      const current = crossCohortIds.length > 0 ? crossCohortIds : (primaryCohortId ? [primaryCohortId] : []);
      // replace: opening the drawer adds no history entry, so browser Back leaves the page as before.
      if (!current.includes(ALL_PATIENTS_COHORT_ID)) {
        handleCompareChange([...current, ALL_PATIENTS_COHORT_ID], { replace: true });
      }
    }
    setCompareOpen(true);
  };

  const handleCompareReset = () => {
    setSearchParams((p) => {
      p.delete('cohorts');
      if (primaryCohortId) p.set('cohort', primaryCohortId);
      return p;
    });
    setCompareOpen(false);
  };

  return { handleCompareChange, openCompare, handleCompareReset };
}
