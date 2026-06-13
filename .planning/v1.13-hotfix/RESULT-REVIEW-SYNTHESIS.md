# A1–A6 Hotfix — Adversarial Result Review Synthesis

Two independent adversarial reviewers on `git diff 7541e85..HEAD`: **Codex 0.137** (repo-access, 10 findings) + **internal code-reviewer agent** (3 WARNING / 2 INFO). Verdict from both: **NEEDS WORK** — 0 true blockers, several real correctness/UX gaps. Synthesized + code-verified below.

## Verdict: NEEDS WORK → fix the 6 agreed items, then re-verify

### FIX NOW (real, code-verified)

| # | Finding | Reviewers | Sev | Fix |
|---|---------|-----------|-----|-----|
| F1 | **A5 throw risk:** `sanitizeActor(payload.preferred_username)` with no `typeof` guard → `undefined.replace()` throws inside the unwrapped `res.on('finish')` handler when a signature-valid access token lacks `preferred_username`. | internal W2 | WARNING (stability) | guard `typeof payload.preferred_username === 'string'` before `sanitizeActor` (auditMiddleware.ts:262) |
| F2 | **A5 boundary:** `expiredAgeS <= 86400` has no lower bound, so a **non-expired** Bearer token (negative age) also attributes a 401 (e.g. on `/api/auth/refresh`, which bypasses Bearer auth). Intent was "expired tokens only". | Codex #2 | WARNING (correctness) | require `expiredAgeS >= 0 && expiredAgeS <= MAX` (auditMiddleware.ts:259) |
| F3 | **A6 wedge:** `resetToMetricDefaults` (useOutcomesRouteState.ts:279) sets `perPatient: true` directly + the Settings "reset defaults" button (OutcomesSettingsDrawer.ts:83) routes through `setLayersWithOverride`, marking a user override → permanently disables the >100-patient auto-off; metric-tab switch silently re-enables all per-patient lines on large cohorts and staleness the notice. | internal W1 + Codex #4 | WARNING (perf regression) | both reset paths must re-derive the large-cohort default (not mark override); metric switch keeps the derived default |
| F4 | **Tooltip leak:** default `<Tooltip />` now lists the folded `visusBand`/`crtBand` (raw `[p25,p75]` arrays), `visusMedian`/`crtMedian`, `visusInterp`/`crtInterp` as extra series when the overlay is on — clinically confusing on a patient chart. | internal W3 | WARNING (UX, tester already flagged chart clarity) | custom tooltip / filter dataKeys to measured Visus+CRT only (VisusCrtChart.tsx:117) |
| F5 | **Empty-window centers:** a center with 0 in-window cases is still pushed into `centerMetrics` as all-zero and drags the KPI `average()`. | internal I2 + Codex #6 | WARNING | exclude centers with 0 in-window cases from `centerMetrics` (DocQualityPage.tsx:31) |
| F6 | **Stale comment:** `QualityPage.tsx:141` still says "filterCasesByTimeRange does not drop cases" — now false (A2). | internal I1 + Codex #10 | INFO | correct the comment |

### CHEAP DEFENSIVE (fold in)
- **F7** Codex #5: reset `activePatientIdRef` to null when cohort changes (avoid stale within-cohort drill-down target after a cohort switch without a fresh hover). IDOR still gated, but defensive.
- **F8** Codex #3: skip building `perPatientSeries` when `layers.perPatient` is false (the array is built unconditionally; gate it — that's the A6 perf intent).

### DEFER / NOTE (not fixing in this batch)
- Codex #1 (first-render perPatient cost is effect-driven): the effect corrects post-first-render; a full derived-initial-state refactor is larger. F3 covers the user-visible wedge; note #1 as a minor A6 follow-up.
- Codex #7: expired **Keycloak** tokens never attributed — Keycloak is not the active provider (local HS256). Note for the eventual KEYCLK-01 (SEED-003).
- Codex #8: audit `user` column doesn't distinguish authenticated vs expired-signed-claim actor. Accepted: the 401 status conveys failure; adding a separate column is schema scope, not this batch.
- Codex #9: `sanitizeActor` strips Cc/Zl/Zp but not Unicode bidi/format controls. Low risk (admin-only audit view); note as hardening follow-up.

### VERIFIED CLEAN (no action — both reviewers concur)
- A1 IDOR gate: pseudonym resolved strictly within `cohort.cases`, navigates by server `case.id`, unknown = no-op. **Live-confirmed** navigation to `/case/<id>`.
- A4 interpolation never reaches `visusCrtScatter`/CSV/derived data (reads `.visus`/`.crt` only).
- A5 blocks token-type confusion (`typ:'access'`), forged tokens (signature), current-key only (D-12), NaN-safe on missing `exp`.
- A1 no-active-point click = true no-op.
- `tsc` clean; 1126 tests green.
