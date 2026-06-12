# Hotfix Plan — NF UAT Findings A1–A6 (pre-v1.13)

**Baseline:** main @ `83f8227` (v1.12 tag `8ddf490`) · gates green (build, 1093/1093, lint 0, knip clean).
**Process rule for this batch:** every UI fix gets **live-browser verification** via the Vite preview (lesson from A1 — RTL with mocked recharts cannot validate chart interactivity). Sequential execution on `main` (no worktrees).

---

## A1 — FALL-010 drill-down click does not navigate (HIGH)

**Symptom:** scatter points visible, tooltip shows pseudonym, click does nothing (real browser).
**Root cause (diagnosed):** symbol-level `<Scatter onClick>` doesn't fire reliably in Recharts v3 in-browser (tiny hit targets; median `<Line>`s render after the scatter and overlay it; mocked-recharts tests couldn't catch it). The tooltip works because it uses the **chart-level proximity event pipeline**.

**Fix:**
- `src/components/outcomes/OutcomesPanel.tsx`: move drill-down to the **`ComposedChart onClick`** handler. Recharts passes `{ activePayload, activeLabel }` — the same nearest-point state that drives the visible tooltip. Extract the scatter payload (entry whose `payload.patientId` is set; prefer the scatter series' entry) and call `onPointClick(patientId)`.
- Only attach when `onPointClick` is provided (single-cohort mode, prop already gated by `!isCrossMode` in OutcomesView). Keep the existing symbol-level onClick as belt-and-braces; keep `cursor: 'pointer'` on the chart container when drill-down is active.
- IDOR gate unchanged (`handlePointDrillDown` resolves pseudonym within `cohort.cases` only).
- Guard: a click with no `activePayload` (empty plot area) is a no-op.

**Tests:** extend `tests/OutcomesPanelDrillDown.test.tsx` — chart-level onClick wired when prop present, absent otherwise; handler extracts patientId from a synthetic activePayload incl. mixed payloads (line + scatter entries) and ignores clicks without payload.
**Live verify (MANDATORY):** preview → Analyse → Verläufe → click a point → case detail opens. Also confirm no navigation in compare mode.

## A2 — DocQuality counts don't react to the time filter (HIGH)

**Symptom:** Grundgesamtheit + card patient counts static under time-range changes.
**Root cause (code-confirmed):** `DocQualityPage.distinctPatientCount` uses unfiltered `cases`; `filterCasesByTimeRange` trims observations but keeps zero-obs cases, so per-center `patientCount` and metric denominators never shrink.

**Fix:**
- `src/utils/qualityMetrics.ts`: after observation-trimming in `filterCasesByTimeRange` (or in `buildCenterMetrics`), **drop cases with 0 observations in the window** for metric computation + patientCount. (Scores are already computed over trimmed observations; excluding empty cases removes their distortion of averages.)
- `src/pages/DocQualityPage.tsx`: compute `distinctPatientCount` from the **time-scoped** case set (cases with ≥1 obs in window), not raw `cases`.
- Boundary: deeper "all metrics windowed + more range options + Vollzähligkeit naming" is B1/B2 (user discussion pending) — this fix only makes the displayed counts/denominators consistent with the chosen window, which the tester explicitly flagged as a defect.

**Tests:** unit tests — case with obs only outside window excluded from count + metrics at `6m`, included at `all`; 0-safe.
**Live verify:** Dokumentationsqualität → switch all/6m/1y → Grundgesamtheit + card counts change.

## A3 — FALL-011 overlay distorts the chart (MEDIUM)

**Symptom:** enabling the cohort overlay changes the X-range; chart "hardly readable".
**Likely cause:** the 4 `<Area>` + 2 `<Line>` reference series each carry their **own `data={cohortReference}` array**; on a category X-axis Recharts merges categories across all series — any ordering/subset mismatch reorders or extends the axis. Exact in-browser behavior to be confirmed first (mandatory repro).

**Fix:**
- **Repro in preview first** (screenshot before/after).
- `src/hooks/useCaseData.ts` + `src/components/case-detail/VisusCrtChart.tsx`: **merge reference fields (`visusMedian/visusP25/visusP75/crtMedian/crtP25/crtP75`) into the patient's `combinedData` rows** keyed by the same `date` — one single data array on the chart, reference series read their dataKeys from it with no own `data` prop. This makes axis-domain distortion structurally impossible.
- Readability: cap band opacity (~0.15) and keep median lines thin/dashed; verify visually.
- Out of scope (→ B/C discussion): relative-since-start X-axis; overlay on additional plots.

**Tests:** update `tests/VisusCrtChartReference.test.tsx` to the merged-row shape (reference values present on patient rows; no separate series data).
**Live verify:** toggle overlay on/off → X-axis identical, band+median visible, readable.

## A4 — FALL-012 label leftovers (SMALL)

1. **Visus-vs-CRT scatter unlabeled:** `DistributionCharts.tsx` — add axis name labels (X "Visus (dezimal)", Y "CRT (µm)") via i18n.
2. **Y-axis label cut off:** `VisusCrtChart.tsx` — shorten the Y-axis label to "Visus" and move the full text "Visus (Dezimal, bestkorrigiert)" into a caption/legend line under the chart (next to the interpolation hint) where space exists.
3. **Open circle never renders (code-confirmed dead branch):** `useCaseData.combinedData` sets `visusMeasured/crtMeasured: true` whenever a value exists and **never computes interpolated values** — the open-circle dot branch is unreachable. **Fix:** in `combinedData`, for dates where one metric is missing but has measured neighbors on both sides, add a **linearly interpolated value with `*Measured: false`** — the existing dot renderer then draws the promised open circle exactly where `connectNulls` already draws the line through. Show the interpolation hint **only when interpolated points exist**.

**Tests:** unit — interpolation inserts flagged values between neighbors, none at edges; hint conditional.
**Live verify:** case with asynchronous Visus/CRT dates → open circles visible; labels not cut off.

## A5 — Audit: expired-session 401 bursts logged as `unauthenticated` (MEDIUM, security-sensitive)

**Symptom (tester screenshot):** ~10 `401 unauthenticated Sonstige Aktion` rows in the same second, then `admin` succeeds — the expired-token reload burst.
**Fix:**
- `server/jwtUtil.ts`: add `verifyIgnoringExpiry(token)` — same HS256 pin + dual-key (current + previous signing key) as the normal verify, but `ignoreExpiration: true`. Signature-invalid → throws/null.
- `server/auditMiddleware.ts`: on finish with status 401 and an `Authorization: Bearer` header and no `req.auth`: try `verifyIgnoringExpiry`; if the signature is valid, set actor to the token's `preferred_username` (sanitized via existing `sanitizeActor`). Signature-invalid or absent → stays `unauthenticated`.
- Rationale: a signature-valid token proves issuance to that user — attributing the 401 to them is honest ("this user's session expired"), the 401 status already conveys failure, and forged tokens still surface as `unauthenticated`. Keeps audit-UI user filtering working (no suffix in the actor column).
- NO row suppression (audit completeness preserved).

**Tests:** extend `tests/auditMiddleware.test.ts` + jwtUtil tests — expired-but-valid token → actor = username; invalid-signature token → `unauthenticated`; no Authorization header → `unauthenticated`; rotated-key (previous key) token honored.
**Live verify:** in preview, expire/clear access token, trigger reload burst → audit rows show the username with 401.

## A6 — "Verläufe" tab very slow (MEDIUM — measure first)

**Action plan (no guess-optimization):**
1. **Profile in preview** (Performance timing around OutcomesView mount + interaction; count rendered SVG nodes).
2. Expected hotspot: ~200 per-patient `<Line>` series × up to 6 panels → thousands of SVG nodes per render. Apply the **smallest measured win**, candidates in order: (a) memoize per-patient line data arrays (currently rebuilt inline in `.map()` every render — new object identity defeats recharts memoization); (b) default the `perPatient` layer OFF above a patient-count threshold (e.g. >100) with the existing layer toggle as opt-in + a small notice; (c) cap scatter point count by sampling. 
3. Record before/after timings in the fix summary. If profiling exonerates rendering (e.g. it's aggregation compute), fix the measured cause instead.

**Live verify:** perceptible improvement on the largest cohort; record numbers.

---

## Execution order & file-overlap sequencing
1. **A5** (server-only: jwtUtil, auditMiddleware) — independent.
2. **A2** (qualityMetrics, DocQualityPage) — independent.
3. **A3 + A4** together (shared files: useCaseData, VisusCrtChart; + DistributionCharts, i18n).
4. **A1 + A6** together (shared file: OutcomesPanel; + OutcomesView, tests).
5. Gates after each: `npm run build`, `npm run test:ci`, `npm run lint`. Live-browser pass at the end covering A1, A2, A3, A4, A6 (+A5 via API).

## Risks / review questions for Codex & Vibe
- A1: is chart-level `activePayload` extraction robust across Recharts 3.x payload shapes (line + scatter mixed)? Edge: click between categories.
- A5: any security objection to attributing signature-valid-but-expired tokens? (Replay of an old token after deletion → sessions revoked, but audit actor would still show the name — acceptable? Alternative: suffix marker, but breaks audit user-filter equality.)
- A4(3): is linear interpolation between neighbors clinically acceptable for *display-only* markers (matches existing `connectNulls` visual)?
- A2: excluding zero-obs-in-window cases changes per-center scores — intended (tester directive) but flags any test relying on static counts.
- A6: is defaulting perPatient OFF above a threshold acceptable UX, or must we keep current default and only memoize?

---

# REVISION v2 (after adversarial plan review — Codex 0.137 + Vibe 2.14, both converged; see PLAN-REVIEW-*.md)

**Codex: plan "not sound as written" — 5 TOP CHANGES. Vibe: "Codex RIGHT on all 5" + 3 additions. All adopted:**

- **A1 (REPLACED):** Recharts 3.8.1 chart-level `onClick` does NOT receive `activePayload` (verified in node_modules middleware/types). New approach: **controlled-tooltip ref** — a custom `Tooltip content` component stashes the active scatter payload's `patientId` in a ref (this is the exact pipeline the tester can see working); chart-level `onClick` navigates to `ref.current`. Additionally fix z-order (scatter renders after/above median lines) and keep the symbol-level onClick as belt-and-braces. No-payload click = no-op.
- **A3 (REFOCUSED):** real culprit = the **white paint-over band** (`<Area fill="#ffffff" fillOpacity={1}>`) masking the plot. Replace with a proper range band (Recharts range-Area `dataKey → [p25, p75]`, translucent fill) — no white overpaint. Keep the single-merged-data-array change as structural hygiene. Browser repro before/after stays mandatory.
- **A4 (HARDENED):** interpolated values go into **separate dataKeys** (`visusInterp`/`crtInterp`) rendered as a dot-only series — the measured monotone curve is untouched (Vibe's curve-shape concern), and `visusCrtScatter`/derived data can't ingest fabricated pairs (Codex's leak trap) since they read `.visus`/`.crt`. Tooltip marks interpolated points; hint conditional on their existence.
- **A5 (TIGHTENED):** **current signing key ONLY** (access/challenge tokens never had dual-key per initAuth policy; only refresh does), enforce `typ: 'access'`, reject refresh/challenge tokens, `sanitizeActor`, and a **max expired age of 24h** (Vibe) to limit audit spoofing with old stolen tokens. Documented as "expired signed-claim attribution", not authenticated identity. Drop the previous-key test.
- **A2 (CLARIFIED):** freeze time in tests (`cutoffDate` uses `new Date()`); document semantics — Grundgesamtheit = distinct pseudonyms **in window**, per-center `patientCount` = case count **in window**.
- **A6 (ORDERED):** (1) memoize per-patient line data arrays first (rebuilt inline each render — lowest-risk measured win); (2) threshold default `perPatient: false` for cohorts >100 patients computed in `useOutcomesRouteState` BEFORE aggregation/render (server request depends on the layer); opt-in toggle preserved + notice. NO scatter sampling (breaks drill-down coverage).
