**Plan Soundness: NOT SOUND** – A1, A3, A4, A5 have material flaws.

**Codex Verdict: RIGHT on all 5 TOP CHANGES**

| Item | Plan Flaw | Codex Correct? | Why |
|------|-----------|----------------|-----|
| **A1** | Assumes `activePayload` in chart `onClick` (3.8.1 lacks it) | ✅ | Recharts 3.8.1 `ComposedChart onClick` receives `activeCoordinate/Index/Label/TooltipIndex` but **not** `activePayload` (types + middleware confirm). Plan’s extraction logic will crash. Fix must target scatter hit area/z-order or controlled tooltip ref. |
| **A3** | Blames separate `data` arrays for X-range drift | ✅ | Root cause is **white paint-over Areas**: `fill="#ffffff" fillOpacity={1}` at line 141 masks the plot. Data merging is structural hygiene but won’t fix the immediate readability. |
| **A4** | Interpolation written into `combinedData` | ✅ | `visusCrtScatter` (line 179) ingests any row with both values → **interpolated points leak into correlation chart**. Must: (a) compute interpolation in VisusCrtChart only, (b) exclude from scatter, (c) flag in tooltip. |
| **A5** | Dual-key for expired access tokens | ✅ | Codebase policy: access tokens use **current key only** (initAuth.ts:177); only refresh tokens have dual-key fallback (jwtUtil.ts:106). Plan violates this. Must constrain to `typ: 'access'` + current key + max expired age. |
| **A2** | Time filter counts | ⚠️ | Codex right on diagnosis + frozen test dates. Plan’s fix is sound but must clarify: `Grundgesamtheit` = distinct pseudonyms in window, per-center `patientCount` = case count (both now windowed). |

**Both Missed:**
- **A1**: `activeTooltipIndex` + chart ref can recover payload in 3.8.1, but this is more complex than the plan’s false assumption.
- **A4**: With `type="monotone"` (line 201), linear interpolation alters curve shape—must use `type="linear"` for interpolated segments or skip interpolation for monotone lines.
- **A6**: Memoizing per-patient line data (OutcomesPanel.tsx:262) is lowest-risk first fix; defaulting `perPatient: false` >100 patients should be **server-side** (useOutcomesRouteState.ts:99) to avoid client-side aggregation cost.
- **A5 Security**: Expired access token attribution should **cap age** (e.g., <24h) to limit audit spoofing with old stolen tokens.

TOP CHANGES
