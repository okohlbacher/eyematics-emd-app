# Requirements check — v1.19 — 2026-10-08

requirements 408 · PASS 231 · FAIL 0 · KNOWN_GAP 0 · UNVERIFIED 185 · N/A 3 · vitest 1329/1329 passed
round v1.19: items 11 · PASS 11 · FAIL 0 · KNOWN_GAP 0 · UNVERIFIED 0 · N/A 0

| ID | Area | Status | Unit | Browser | Overall | Title |
|---|---|---|---|---|---|---|
| UIR-ADMIN-001 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Non-admin never sees the user table on /admin |
| UIR-ADMIN-002 | ADMIN | implemented | PASS | NONE | **PASS** | User list columns: username, name, role, centres, dates, sessions |
| UIR-ADMIN-003 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Fresh deployment lists the seven seeded users |
| UIR-ADMIN-004 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Full-text search filters users by name, centre, role key |
| UIR-ADMIN-005 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Role filter dropdown restricts the user list |
| UIR-ADMIN-006 | ADMIN | implemented | PASS | NONE | **PASS** | Centre filter restricts the user list |
| UIR-ADMIN-007 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Column headers sort the user list asc/desc |
| UIR-ADMIN-008 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | "Nutzer anlegen" opens form with name, role, centre fields |
| UIR-ADMIN-009 | ADMIN | implemented | PASS | NONE | **PASS** | Role select offers exactly six German role names |
| UIR-ADMIN-010 | ADMIN | implemented | PASS | NONE | **PASS** | Create form shows "Pflichtfeld" errors for empty fields |
| UIR-ADMIN-011 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Create without centre shows centre-required error |
| UIR-ADMIN-012 | ADMIN | implemented | PASS | NONE | **PASS** | Saved new user appears in the user list |
| UIR-ADMIN-013 | ADMIN | implemented | PASS | NONE | **PASS** | Green banner shows one-time generated password |
| UIR-ADMIN-014 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | "Kopieren" copies password and shows "Kopiert!" |
| UIR-ADMIN-015 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Password banner dismisses and is never re-shown |
| UIR-ADMIN-016 | ADMIN | implemented | PASS | NONE | **PASS** | Duplicate username rejected regardless of case |
| UIR-ADMIN-017 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Create/update/reset errors show dismissible red banner |
| UIR-ADMIN-018 | ADMIN | implemented | PASS | NONE | **PASS** | Row edit allows names, role, centres and Aktiv |
| UIR-ADMIN-019 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Assigned centres shown in list after edit |
| UIR-ADMIN-020 | ADMIN | implemented | PASS | NONE | **PASS** | Deactivated user shows inactive badge, cannot log in |
| UIR-ADMIN-021 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Failed edit keeps previous value |
| UIR-ADMIN-022 | ADMIN | implemented | PASS | NONE | **PASS** | "Passwort zurücksetzen" confirms, then shows new password |
| UIR-ADMIN-023 | ADMIN | partial | PASS | NONE | **PASS** | Password reset invalidates old password and sessions |
| UIR-ADMIN-024 | ADMIN | implemented | PASS | NONE | **PASS** | "TOTP zurücksetzen" works after confirmation |
| UIR-ADMIN-025 | ADMIN | implemented | PASS | NONE | **PASS** | "Sitzungen" accordion lists a user's sessions |
| UIR-ADMIN-026 | ADMIN | implemented | PASS | NONE | **PASS** | "Sitzung beenden" revokes a single session |
| UIR-ADMIN-027 | ADMIN | implemented | PASS | NONE | **PASS** | "Überall abmelden" signs a user out everywhere |
| UIR-ADMIN-028 | ADMIN | implemented | PASS | NONE | **PASS** | Delete removes user from list and blocks login |
| UIR-ADMIN-029 | ADMIN | implemented | PASS | NONE | **PASS** | Own row's delete action is disabled |
| UIR-ADMIN-030 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Deleting a user invalidates all their sessions |
| UIR-ADMIN-031 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Audit rows keep deleted user's real username |
| UIR-ADMIN-032 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | "Abbrechen" closes the create form and clears its values |
| UIR-ADMIN-033 | ADMIN | implemented | NONE | NONE | **UNVERIFIED** | Only one "Sitzungen" panel open at a time; click again collapses |
| UIR-AGG-001 | AGG | implemented | PASS | NONE | **PASS** | Analyse page reachable with Aggregiert/Verläufe tabs |
| UIR-AGG-002 | AGG | implemented | NONE | NONE | **UNVERIFIED** | Tab selection is driven by ?tab= URL param |
| UIR-AGG-003 | AGG | implemented | NONE | NONE | **UNVERIFIED** | ?filters= applies cohort filters to the Analyse page |
| UIR-AGG-004 | AGG | implemented | PASS | NONE | **PASS** | Derived cohort name shown for ?filters= cohorts |
| UIR-AGG-005 | AGG | implemented | PASS | NONE | **PASS** | ?cohort=<savedId> resolves saved search and shows its name |
| UIR-AGG-006 | AGG | implemented | PASS | NONE | **PASS** | Header shows case count of current cohort |
| UIR-AGG-007 | AGG | implemented | NONE | NONE | **UNVERIFIED** | Header shows red critical-value count (CRT > 400 µm) |
| UIR-AGG-008 | AGG | not_implemented | NONE | NONE | **UNVERIFIED** | Critical count uses the CRT threshold from Einstellungen |
| UIR-AGG-009 | AGG | implemented | PASS | NONE | **PASS** | Centre multi-select chips narrow count and charts |
| UIR-AGG-010 | AGG | implemented | PASS | NONE | **PASS** | Centre chips never list unassigned centres |
| UIR-AGG-011 | AGG | implemented | NONE | NONE | **UNVERIFIED** | Centre distribution bar chart |
| UIR-AGG-012 | AGG | implemented | NONE | NONE | **UNVERIFIED** | Diagnosis distribution pie with legend and full-text tooltip |
| UIR-AGG-013 | AGG | implemented | NONE | NONE | **UNVERIFIED** | Mean visus per quarter line chart |
| UIR-AGG-014 | AGG | implemented | NONE | NONE | **UNVERIFIED** | CRT distribution histogram with visible bars |
| UIR-AGG-015 | AGG | implemented | NONE | NONE | **UNVERIFIED** | Age vs. visus scatter with median line and ascending axis |
| UIR-AGG-016 | AGG | implemented | PASS | NONE | **PASS** | Comparison layout for two or more cohorts |
| UIR-AGG-017 | AGG | partial | NONE | NONE | **UNVERIFIED** | Aggregiert and Verläufe share the same cohort |
| UIR-AGG-018 | AGG | implemented | PASS | NONE | **PASS** | Aggregate charts restyle for dark mode |
| UIR-AGG-019 | AGG | implemented | PASS | NONE | **PASS** | Opening Analyse records a Weitermachen entry |
| UIR-AGG-020 | AGG | implemented | PASS | NONE | **PASS** | Diagnosis labels follow the UI language |
| UIR-AUDIT-001 | AUDIT | implemented | PASS | NONE | **PASS** | Protokoll shows loading card, then red error card on fetch failure |
| UIR-AUDIT-002 | AUDIT | implemented | PASS | NONE | **PASS** | Audit table has five columns, newest entry first |
| UIR-AUDIT-003 | AUDIT | implemented | PASS | NONE | **PASS** | Status column is a colour-coded badge |
| UIR-AUDIT-004 | AUDIT | implemented | PASS | NONE | **PASS** | Routine GET noise is hidden from the table |
| UIR-AUDIT-005 | AUDIT | implemented | NONE | NONE | **UNVERIFIED** | Count line reads 'N von M' when fewer rows shown than server total |
| UIR-AUDIT-006 | AUDIT | implemented | PASS | NONE | **PASS** | Own login appears as a new entry with username as actor |
| UIR-AUDIT-007 | AUDIT | not_implemented | NONE | NONE | **UNVERIFIED** | Opening a case creates a 'Daten' audit entry |
| UIR-AUDIT-008 | AUDIT | implemented | PASS | NONE | **PASS** | Failed login shows attempted username, password redacted in export |
| UIR-AUDIT-009 | AUDIT | implemented | PASS | NONE | **PASS** | Token-less 401 requests show actor 'unauthenticated' |
| UIR-AUDIT-010 | AUDIT | implemented | PASS | NONE | **PASS** | Expired-token 401s attributed to the token's username |
| UIR-AUDIT-011 | AUDIT | implemented | PASS | NONE | **PASS** | Admin can filter the Protokoll by user |
| UIR-AUDIT-012 | AUDIT | implemented | PASS | NONE | **PASS** | User can filter the Protokoll by category |
| UIR-AUDIT-013 | AUDIT | implemented | PASS | NONE | **PASS** | User can filter the Protokoll by date range |
| UIR-AUDIT-014 | AUDIT | implemented | PASS | NONE | **PASS** | Admin can search the Protokoll by cohort hash |
| UIR-AUDIT-015 | AUDIT | implemented | PASS | NONE | **PASS** | 'Nur Fehler' shows only failed entries |
| UIR-AUDIT-016 | AUDIT | implemented | PASS | NONE | **PASS** | 'CSV exportieren' downloads the displayed entries |
| UIR-AUDIT-017 | AUDIT | implemented | PASS | NONE | **PASS** | Admin-only 'JSON exportieren' downloads the full log |
| UIR-AUDIT-018 | AUDIT | implemented | NONE | NONE | **UNVERIFIED** | No edit or delete control for audit entries |
| UIR-AUDIT-019 | AUDIT | implemented | PASS | NONE | **PASS** | Empty-filter state message when no entries match |
| UIR-AUTH-001 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Unauthenticated access to protected routes redirects to /login |
| UIR-AUTH-002 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Login page shows Benutzerkennung, Passwort and Weiter |
| UIR-AUTH-003 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Password field has a show/hide toggle |
| UIR-AUTH-004 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Login page offers a language toggle |
| UIR-AUTH-005 | AUTH | not_implemented | PASS | NONE | **PASS** | Keycloak provider replaces the form with a Keycloak button |
| UIR-AUTH-006 | AUTH | implemented | PASS | NONE | **PASS** | Valid credentials log the user in and land on Startseite |
| UIR-AUTH-007 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Seven seeded default users log in on a fresh deployment |
| UIR-AUTH-008 | AUTH | implemented | PASS | NONE | **PASS** | Wrong credentials show one generic, non-revealing error |
| UIR-AUTH-009 | AUTH | implemented | PASS | NONE | **PASS** | Remaining-attempts hint counts down after failures |
| UIR-AUTH-010 | AUTH | implemented | PASS | NONE | **PASS** | Lockout after max failed attempts with mm:ss countdown |
| UIR-AUTH-011 | AUTH | implemented | PASS | NONE | **PASS** | Lockout duration doubles on repeated failures |
| UIR-AUTH-012 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | OTP step appears after correct password when 2FA is enabled |
| UIR-AUTH-013 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Zurück aborts the OTP step without logging in |
| UIR-AUTH-014 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Wrong OTP shows an error and returns to the credentials step |
| UIR-AUTH-015 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Sidebar footer shows logged-in user and opens /account |
| UIR-AUTH-016 | AUTH | implemented | PASS | NONE | **PASS** | Abmelden logs out and returns to /login |
| UIR-AUTH-017 | AUTH | implemented | PASS | NONE | **PASS** | Logout clears session and recent-item storage |
| UIR-AUTH-018 | AUTH | implemented | PASS | NONE | **PASS** | Logout in one tab logs out sibling tabs |
| UIR-AUTH-019 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | New browser session requires a fresh login |
| UIR-AUTH-020 | AUTH | implemented | PASS | NONE | **PASS** | Inactivity warning banner with mm:ss countdown |
| UIR-AUTH-021 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Activity dismisses the inactivity warning |
| UIR-AUTH-022 | AUTH | implemented | PASS | NONE | **PASS** | Automatic logout when inactivity timeout elapses |
| UIR-AUTH-023 | AUTH | implemented | PASS | NONE | **PASS** | Account page lets the user change their password |
| UIR-AUTH-024 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Password change shows a success banner that clears after 30 s |
| UIR-AUTH-025 | AUTH | implemented | PASS | NONE | **PASS** | Account page shows TOTP status and allows enrol/disable |
| UIR-AUTH-026 | AUTH | implemented | NONE | NONE | **UNVERIFIED** | Empty login fields are rejected client-side with a hint |
| UIR-AUTH-027 | AUTH | implemented | PASS | NONE | **PASS** | Rejected token refresh ends the session and redirects to /login |
| UIR-CASE-001 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Open case from Kohortenbildung Detailansicht row |
| UIR-CASE-002 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Open case from Datenqualität detail panel |
| UIR-CASE-003 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Unknown case id shows not-found message |
| UIR-CASE-004 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Patient header fields and Zurück button |
| UIR-CASE-005 | CASE | implemented | NONE | NONE | **UNVERIFIED** | No identifying data anywhere on the case page |
| UIR-CASE-006 | CASE | implemented | PASS | NONE | **PASS** | Diagnosis pills with short label and full-term tooltip |
| UIR-CASE-007 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Behandlungsindikation in header |
| UIR-CASE-008 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Adverse-events badge count matches AE section |
| UIR-CASE-009 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Kritische Überschreitungen badge with per-metric counts |
| UIR-CASE-010 | CASE | partial | NONE | NONE | **UNVERIFIED** | Critical marking follows Einstellungen thresholds |
| UIR-CASE-011 | CASE | not_implemented | NONE | NONE | **UNVERIFIED** | Exclusion state and include/exclude toggle |
| UIR-CASE-012 | CASE | implemented | PASS | NONE | **PASS** | Kohorten-Referenz toggle in header, off by default |
| UIR-CASE-013 | CASE | implemented | PASS | NONE | **PASS** | Vergleichskohorte wählen selector |
| UIR-CASE-014 | CASE | implemented | PASS | NONE | **PASS** | Active cohort label with name and N |
| UIR-CASE-015 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Behandlungsverlauf timeline strip with per-contact icons |
| UIR-CASE-016 | CASE | implemented | PASS | NONE | **PASS** | Timeline tile click highlights the visit date |
| UIR-CASE-017 | CASE | implemented | PASS | NONE | **PASS** | Injection highlight via strip or list |
| UIR-CASE-018 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Highlights and cohort selection reset on case change |
| UIR-CASE-019 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Timeline camera icon jumps to OCT image |
| UIR-CASE-020 | CASE | implemented | PASS | NONE | **PASS** | Dual-axis Visus/CRT time-course chart |
| UIR-CASE-021 | CASE | implemented | PASS | NONE | **PASS** | Clickable injection markers on the time axis |
| UIR-CASE-022 | CASE | implemented | PASS | NONE | **PASS** | CRT legend label and upright right-axis title |
| UIR-CASE-023 | CASE | implemented | PASS | NONE | **PASS** | Visus axis title and full legend label |
| UIR-CASE-024 | CASE | implemented | PASS | NONE | **PASS** | Filled markers only, no 'Offene Kreise' |
| UIR-CASE-025 | CASE | implemented | PASS | NONE | **PASS** | Legend never describes an undrawn style |
| UIR-CASE-026 | CASE | partial | NONE | NONE | **UNVERIFIED** | All case chart axes render tick labels |
| UIR-CASE-027 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Red critical CRT threshold line follows settings |
| UIR-CASE-028 | CASE | implemented | PASS | NONE | **PASS** | Calendar-date x-axis is linear in time |
| UIR-CASE-029 | CASE | implemented | PASS | NONE | **PASS** | Overlay switches x-axis to months since first visit |
| UIR-CASE-030 | CASE | implemented | PASS | NONE | **PASS** | Cohort median line and IQR band on Visus/CRT |
| UIR-CASE-031 | CASE | implemented | PASS | NONE | **PASS** | Four cohort legend entries with translucent IQR swatches |
| UIR-CASE-032 | CASE | implemented | PASS | NONE | **PASS** | Band labelled as IQR, never standard deviation |
| UIR-CASE-033 | CASE | implemented | PASS | NONE | **PASS** | Cohort aggregated by relative time since first visit |
| UIR-CASE-034 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Tooltips show medians, never IQR band values |
| UIR-CASE-035 | CASE | implemented | PASS | NONE | **PASS** | Info icons explain plots and overlay aggregation |
| UIR-CASE-036 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Intravitreale Injektionen list with count and substance badge |
| UIR-CASE-037 | CASE | implemented | PASS | NONE | **PASS** | Veränderung zum Ausgangswert chart |
| UIR-CASE-038 | CASE | implemented | PASS | NONE | **PASS** | Baseline change anchored per metric |
| UIR-CASE-039 | CASE | implemented | PASS | NONE | **PASS** | Baseline chart overlay with unified legend |
| UIR-CASE-040 | CASE | implemented | PASS | NONE | **PASS** | Visus and CRT count histograms |
| UIR-CASE-041 | CASE | implemented | PASS | NONE | **PASS** | Paired patient/cohort % bars with overlay on |
| UIR-CASE-042 | CASE | implemented | PASS | NONE | **PASS** | Visus vs. CRT scatter with labelled axes |
| UIR-CASE-043 | CASE | implemented | PASS | NONE | **PASS** | Scatter shows cohort cloud with overlay on |
| UIR-CASE-044 | CASE | implemented | PASS | NONE | **PASS** | Augeninnendruck (IOD) chart with method and threshold |
| UIR-CASE-045 | CASE | implemented | PASS | NONE | **PASS** | IOD overlay as median line plus IQR band |
| UIR-CASE-046 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Refraktion card with sphere, cylinder, axis |
| UIR-CASE-047 | CASE | implemented | NONE | NONE | **UNVERIFIED** | HbA1c card with diabetes onset and red >7.0 |
| UIR-CASE-048 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Anamnese split into ophthalmic and non-ophthalmic |
| UIR-CASE-049 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Befunde split into anterior and posterior segment |
| UIR-CASE-050 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Unerwünschte Ereignisse section with status badges |
| UIR-CASE-051 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Medikation card with switch marker |
| UIR-CASE-052 | CASE | implemented | NONE | NONE | **UNVERIFIED** | OCT viewer with thumbnails, stepping and dropdown |
| UIR-CASE-053 | CASE | implemented | NONE | NONE | **UNVERIFIED** | OCT zoom and fullscreen |
| UIR-CASE-054 | CASE | implemented | NONE | NONE | **UNVERIFIED** | OCT Vergleich compare mode |
| UIR-CASE-055 | CASE | implemented | PASS | NONE | **PASS** | OCT images served only through authenticated API |
| UIR-CASE-056 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Cohort average reference lines always shown on Visus/CRT |
| UIR-CASE-057 | CASE | implemented | NONE | NONE | **UNVERIFIED** | Visus measurement method line under the chart title |
| UIR-COH-001 | COH | implemented | PASS | NONE | **PASS** | Non-admin users see only their assigned centres |
| UIR-COH-002 | COH | implemented | NONE | NONE | **UNVERIFIED** | Filter panel offers six filter groups |
| UIR-COH-003 | COH | implemented | NONE | NONE | **UNVERIFIED** | Diagnosis checkboxes AMD / DR filter the case list |
| UIR-COH-004 | COH | implemented | NONE | NONE | **UNVERIFIED** | Gender checkboxes filter the case list |
| UIR-COH-005 | COH | implemented | PASS | NONE | **PASS** | Centre checkboxes filter the case list |
| UIR-COH-006 | COH | implemented | NONE | NONE | **UNVERIFIED** | Age range filter (min–max years) |
| UIR-COH-007 | COH | implemented | PASS | NONE | **PASS** | Visus range filter accepts comma or dot decimals |
| UIR-COH-008 | COH | implemented | NONE | NONE | **UNVERIFIED** | CRT (retinal thickness) range filter |
| UIR-COH-009 | COH | implemented | PASS | NONE | **PASS** | All active filters combine; no filter shows all cases |
| UIR-COH-010 | COH | implemented | PASS | NONE | **PASS** | Live case count "Kohorte: N Fälle von M" |
| UIR-COH-011 | COH | implemented | PASS | NONE | **PASS** | Inline validation for invalid numeric ranges |
| UIR-COH-012 | COH | not_implemented | NONE | NONE | **UNVERIFIED** | Plausibility warning for out-of-range filter values |
| UIR-COH-013 | COH | implemented | PASS | NONE | **PASS** | "Zurücksetzen" clears all filters |
| UIR-COH-014 | COH | implemented | PASS | NONE | **PASS** | Filter state survives reload and navigation |
| UIR-COH-015 | COH | implemented | PASS | NONE | **PASS** | "Schnellauswahl" presets filter with one click |
| UIR-COH-016 | COH | implemented | PASS | NONE | **PASS** | Editing a manual filter clears the active preset |
| UIR-COH-017 | COH | implemented | PASS | NONE | **PASS** | "Markierte Qualitätsfälle" preset = open quality flags |
| UIR-COH-018 | COH | implemented | NONE | NONE | **UNVERIFIED** | Excluded cases are absent from the cohort list |
| UIR-COH-019 | COH | implemented | PASS | NONE | **PASS** | "Erweiterte Filter" opens an accessible modal dialog |
| UIR-COH-020 | COH | implemented | PASS | NONE | **PASS** | Advanced filter dialog sections |
| UIR-COH-021 | COH | implemented | PASS | NONE | **PASS** | "Filter anwenden" applies and badges active groups |
| UIR-COH-022 | COH | implemented | PASS | NONE | **PASS** | Advanced dialog HbA1c rules, clear and discard |
| UIR-COH-023 | COH | implemented | NONE | NONE | **UNVERIFIED** | Toggle between "Zusammenfassung" and "Detailansicht" |
| UIR-COH-024 | COH | implemented | NONE | NONE | **UNVERIFIED** | Detail table columns per case |
| UIR-COH-025 | COH | implemented | NONE | NONE | **UNVERIFIED** | Table row opens the Fallansicht; diagnosis chip tooltip |
| UIR-COH-026 | COH | implemented | NONE | NONE | **UNVERIFIED** | CSV / JSON export of the filtered cohort |
| UIR-COH-027 | COH | partial | PASS | NONE | **PASS** | "Kohorte analysieren" opens Analyse with the cohort |
| UIR-COH-028 | COH | implemented | PASS | NONE | **PASS** | Save current filters as a named search |
| UIR-COH-029 | COH | implemented | PASS | NONE | **PASS** | Cohort name validation: duplicates and colon forms |
| UIR-COH-030 | COH | implemented | NONE | NONE | **UNVERIFIED** | Cohort name input is legible in both themes |
| UIR-COH-031 | COH | implemented | PASS | NONE | **PASS** | Saved searches are per user and server-side |
| UIR-COH-032 | COH | implemented | PASS | NONE | **PASS** | No quality-check checklist; new cohort has all checks on |
| UIR-COH-033 | COH | implemented | PASS | NONE | **PASS** | "Gespeicherte Suchen (n)" panel lists saved searches |
| UIR-COH-034 | COH | implemented | NONE | NONE | **UNVERIFIED** | Sort saved searches "Nach Datum" / "Nach Name" |
| UIR-COH-035 | COH | partial | NONE | NONE | **UNVERIFIED** | "Ausführen" re-applies a saved search |
| UIR-COH-036 | COH | implemented | PASS | NONE | **PASS** | "Löschen" removes a saved search everywhere |
| UIR-COH-037 | COH | implemented | PASS | NONE | **PASS** | "Outcomes anzeigen" opens Verläufe for the cohort |
| UIR-COH-038 | COH | implemented | PASS | NONE | **PASS** | "Als Unterkohorte aufteilen" creates one Parent:Sub |
| UIR-COH-039 | COH | implemented | PASS | NONE | **PASS** | "Kohorte aufteilen" dialog with attribute and preview |
| UIR-COH-040 | COH | implemented | PASS | NONE | **PASS** | Categorical split yields one sub-cohort per value |
| UIR-COH-041 | COH | implemented | PASS | NONE | **PASS** | Split confirm creates Parent:Group sub-cohorts |
| UIR-COH-042 | COH | implemented | PASS | NONE | **PASS** | After split, Verläufe compare opens with children preselected |
| UIR-COH-043 | COH | implemented | PASS | NONE | **PASS** | Logout clears the persisted cohort filter state |
| UIR-DEPLOY-001 | DEPLOY | implemented | NONE | NONE | **N/A** | Published image is public and multi-arch |
| UIR-DEPLOY-002 | DEPLOY | implemented | PASS | NONE | **PASS** | Container runs with no environment variables |
| UIR-DEPLOY-003 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | First start seeds users, centres and settings |
| UIR-DEPLOY-004 | DEPLOY | implemented | PASS | NONE | **PASS** | /healthz answers 200 without login or audit row |
| UIR-DEPLOY-005 | DEPLOY | implemented | PASS | NONE | **PASS** | SPA and API served from one origin on port 3000 |
| UIR-DEPLOY-006 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Plain HTTP on a LAN host loads all assets |
| UIR-DEPLOY-007 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Production CSP header is strict and inline-script free |
| UIR-DEPLOY-008 | DEPLOY | implemented | PASS | NONE | **PASS** | index.html has no inline script; theme via /theme-init.js |
| UIR-DEPLOY-009 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Dark theme shows no light flash on load |
| UIR-DEPLOY-010 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Fonts are self-hosted; no Google Fonts request |
| UIR-DEPLOY-011 | DEPLOY | implemented | PASS | NONE | **PASS** | Refresh cookie is httpOnly/Strict with single-flight refresh |
| UIR-DEPLOY-012 | DEPLOY | implemented | PASS | NONE | **PASS** | Session survives >10 min active use over plain HTTP |
| UIR-DEPLOY-013 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Deep links survive a reload (SPA fallback) |
| UIR-DEPLOY-014 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Verläufe WebGL renders under the production CSP |
| UIR-DEPLOY-015 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Direct /data/* requests return 403 |
| UIR-DEPLOY-016 | DEPLOY | partial | NONE | NONE | **UNVERIFIED** | /settings.yaml is never served |
| UIR-DEPLOY-017 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Unmatched /api/* routes return JSON 404 |
| UIR-DEPLOY-018 | DEPLOY | implemented | PASS | NONE | **PASS** | Settings changes persist on the volume across restart |
| UIR-DEPLOY-019 | DEPLOY | implemented | PASS | NONE | **PASS** | Feedback reports persist on the volume across restart |
| UIR-DEPLOY-020 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Session stays valid across a container restart |
| UIR-DEPLOY-021 | DEPLOY | implemented | NONE | NONE | **N/A** | UI version matches the image version label |
| UIR-DEPLOY-022 | DEPLOY | implemented | NONE | NONE | **N/A** | Auto-update keeps users and data |
| UIR-DEPLOY-023 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Container stops within 3 s on SIGTERM |
| UIR-DEPLOY-024 | DEPLOY | implemented | NONE | NONE | **UNVERIFIED** | Unwritable /data volume fails fast with a clear message |
| UIR-DOCQ-001 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Header: Zeitraum toggle reveals time-range bar |
| UIR-DOCQ-002 | DOCQ | implemented | PASS | NONE | **PASS** | Time-range presets incl. Benutzerdefiniert with date picker |
| UIR-DOCQ-003 | DOCQ | implemented | PASS | NONE | **PASS** | Metrics, Grundgesamtheit and counts recompute on time range |
| UIR-DOCQ-004 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Subtitle badge shows active non-default time range |
| UIR-DOCQ-005 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Always-visible centre select scopes KPIs (no chip filter) |
| UIR-DOCQ-006 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Centres without cases in window are omitted |
| UIR-DOCQ-007 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Grundgesamtheit label in overview only |
| UIR-DOCQ-008 | DOCQ | implemented | PASS | NONE | **PASS** | Four KPI cards with info tooltips |
| UIR-DOCQ-009 | DOCQ | implemented | PASS | NONE | **PASS** | Gesamtbewertung tooltip states 40/30/30 weighting |
| UIR-DOCQ-010 | DOCQ | implemented | PASS | NONE | **PASS** | Cards show patient count, progress bar and 80 % target |
| UIR-DOCQ-011 | DOCQ | implemented | PASS | NONE | **PASS** | Vollzähligkeit matches Startseite definition |
| UIR-DOCQ-012 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Plausibilität reflects ranges set in Einstellungen |
| UIR-DOCQ-013 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Per-centre comparison bar chart |
| UIR-DOCQ-014 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Per-centre table with four metrics and score badges |
| UIR-DOCQ-015 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Clicking a centre row opens the detail panel |
| UIR-DOCQ-016 | DOCQ | implemented | PASS | NONE | **PASS** | Detail panel: stats, four cards with counts, bar chart |
| UIR-DOCQ-017 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Back link returns from detail to overview |
| UIR-DOCQ-018 | DOCQ | implemented | PASS | NONE | **PASS** | Collapsible Plausibilitätsbereiche table (live settings) |
| UIR-DOCQ-019 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Bericht exportieren downloads per-centre CSV |
| UIR-DOCQ-020 | DOCQ | implemented | NONE | NONE | **UNVERIFIED** | Metric cards tinted and iconed by score band |
| UIR-FEEDBACK-001 | FEEDBACK | implemented | NONE | NONE | **UNVERIFIED** | "Problem melden" tab visible on every authenticated page |
| UIR-FEEDBACK-002 | FEEDBACK | implemented | NONE | NONE | **UNVERIFIED** | Screenshot captured automatically before the dialog opens |
| UIR-FEEDBACK-003 | FEEDBACK | implemented | NONE | NONE | **UNVERIFIED** | Dialog shows page label and build version |
| UIR-FEEDBACK-004 | FEEDBACK | implemented | NONE | NONE | **UNVERIFIED** | Case pages labelled with case id in the dialog |
| UIR-FEEDBACK-005 | FEEDBACK | implemented | PASS | NONE | **PASS** | Description field autofocused; "Absenden" disabled while empty |
| UIR-FEEDBACK-006 | FEEDBACK | implemented | NONE | NONE | **UNVERIFIED** | Dialog is an accessible modal that traps focus |
| UIR-FEEDBACK-007 | FEEDBACK | implemented | NONE | NONE | **UNVERIFIED** | Dialog closes on Escape, overlay click or X |
| UIR-FEEDBACK-008 | FEEDBACK | implemented | NONE | NONE | **UNVERIFIED** | Submit shows success check and auto-closes after 2 s |
| UIR-FEEDBACK-009 | FEEDBACK | implemented | PASS | NONE | **PASS** | Submitted issue stored on server and counted in Einstellungen |
| UIR-FEEDBACK-010 | FEEDBACK | implemented | PASS | NONE | **PASS** | Admin can export collected issues as JSON |
| UIR-FEEDBACK-011 | FEEDBACK | implemented | NONE | NONE | **UNVERIFIED** | Feedback tab and dialog follow the language switch |
| UIR-LAND-001 | LAND | implemented | NONE | NONE | **UNVERIFIED** | Startseite is the post-login landing page |
| UIR-LAND-002 | LAND | implemented | NONE | NONE | **UNVERIFIED** | Loading text while FHIR bundles load |
| UIR-LAND-003 | LAND | implemented | NONE | NONE | **UNVERIFIED** | Greeting by display name from the server |
| UIR-LAND-004 | LAND | implemented | NONE | NONE | **UNVERIFIED** | Today's date in the active locale |
| UIR-LAND-005 | LAND | implemented | NONE | NONE | **UNVERIFIED** | Four KPI tiles for the user's visible data |
| UIR-LAND-006 | LAND | partial | NONE | NONE | **UNVERIFIED** | Fälle KPI equals unfiltered cohort count |
| UIR-LAND-007 | LAND | implemented | PASS | NONE | **PASS** | Datenvollzähligkeit card with % and n / m |
| UIR-LAND-008 | LAND | implemented | PASS | NONE | **PASS** | Completeness info tooltip |
| UIR-LAND-009 | LAND | implemented | NONE | NONE | **UNVERIFIED** | Kohortenbildung button navigates to /cohort |
| UIR-LAND-010 | LAND | implemented | NONE | NONE | **UNVERIFIED** | Export button disabled with not-available hint |
| UIR-LAND-011 | LAND | implemented | PASS | NONE | **PASS** | One centre row per visible centre |
| UIR-LAND-012 | LAND | implemented | PASS | NONE | **PASS** | Centre rows limited to the user's centres |
| UIR-LAND-013 | LAND | partial | PASS | NONE | **PASS** | Centre row case count from local data |
| UIR-LAND-014 | LAND | implemented | NONE | NONE | **UNVERIFIED** | Centre row last-update date in locale format |
| UIR-LAND-015 | LAND | partial | NONE | NONE | **UNVERIFIED** | Centre row opens Dokumentationsqualität |
| UIR-LAND-016 | LAND | implemented | PASS | NONE | **PASS** | Weitermachen tile lists recent entries |
| UIR-LAND-017 | LAND | implemented | PASS | NONE | **PASS** | Weitermachen empty state |
| UIR-LAND-018 | LAND | partial | PASS | NONE | **PASS** | Attention tile lists breakers and CRT without counts |
| UIR-LAND-019 | LAND | implemented | PASS | NONE | **PASS** | Prüfen buttons open pre-filtered Datenqualität |
| UIR-LAND-020 | LAND | implemented | NONE | NONE | **UNVERIFIED** | Return to Startseite via sidebar |
| UIR-LAND-021 | LAND | implemented | NONE | NONE | **UNVERIFIED** | Centres tile heading, subtitle and Alle aktiv badge |
| UIR-NAV-001 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Fixed sidebar with logo and independent content scroll |
| UIR-NAV-002 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Research sidebar entries visible for every role |
| UIR-NAV-003 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Active sidebar item marked with teal accent |
| UIR-NAV-004 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Dokumentationsqualität entry gated to quality roles |
| UIR-NAV-005 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Direct /doc-quality redirects non-quality roles |
| UIR-NAV-006 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Admin sidebar group only for admin role |
| UIR-NAV-007 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Direct admin routes redirect non-admins |
| UIR-NAV-008 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Unknown paths redirect to Startseite |
| UIR-NAV-009 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Unknown case id shows not-found with back button |
| UIR-NAV-010 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Sidebar language button toggles DE/EN immediately |
| UIR-NAV-011 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Language choice persists; German is the default |
| UIR-NAV-012 | NAV | not_implemented | NONE | NONE | **UNVERIFIED** | App chrome shows the current released version |
| UIR-NAV-013 | NAV | implemented | PASS | NONE | **PASS** | Render errors show bilingual error screen with reload |
| UIR-NAV-014 | NAV | implemented | NONE | NONE | **UNVERIFIED** | Sidebar user row opens the account page |
| UIR-QUAL-001 | QUAL | implemented | PASS | NONE | **PASS** | Kohorte scope dropdown restricts the review set |
| UIR-QUAL-002 | QUAL | implemented | PASS | NONE | **PASS** | Per-cohort quality-check checklist persists |
| UIR-QUAL-003 | QUAL | implemented | PASS | NONE | **PASS** | Cohort checks use live global thresholds |
| UIR-QUAL-004 | QUAL | implemented | PASS | NONE | **PASS** | Time-range bar scopes the population |
| UIR-QUAL-005 | QUAL | partial | PASS | NONE | **PASS** | Grundgesamtheit label counts distinct patients |
| UIR-QUAL-006 | QUAL | implemented | PASS | NONE | **PASS** | Centre chip multi-select narrows the view |
| UIR-QUAL-007 | QUAL | partial | PASS | NONE | **PASS** | Summary tiles with counts, n/total and percentage |
| UIR-QUAL-008 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Pseudonym search narrows the case list |
| UIR-QUAL-009 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Prüfstatus filter on the case list |
| UIR-QUAL-010 | QUAL | partial | PASS | NONE | **PASS** | Therapiestatus and CRT-Wert filters |
| UIR-QUAL-011 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Case list therapy badges in yellow and red |
| UIR-QUAL-012 | QUAL | implemented | PASS | NONE | **PASS** | URL params seed filters and open the panel |
| UIR-QUAL-013 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Ausgeschlossene anzeigen reveals excluded cases |
| UIR-QUAL-014 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | CSV export of the filtered list |
| UIR-QUAL-015 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Clicking a case opens its review detail panel |
| UIR-QUAL-016 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Selecting a case records a Weitermachen entry |
| UIR-QUAL-017 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Case detail header content and links |
| UIR-QUAL-018 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Therapy classification with gap days in header |
| UIR-QUAL-019 | QUAL | implemented | PASS | NONE | **PASS** | Exclude / include a case from analyses |
| UIR-QUAL-020 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Measurement and OCT tabs in the case detail |
| UIR-QUAL-021 | QUAL | implemented | PASS | NONE | **PASS** | Filter chips Alle / Nur auffällige / Offen |
| UIR-QUAL-022 | QUAL | implemented | PASS | NONE | **PASS** | Measurement table with six fixed columns |
| UIR-QUAL-023 | QUAL | implemented | PASS | NONE | **PASS** | Anomalous and missing values highlighted inline |
| UIR-QUAL-024 | QUAL | implemented | PASS | NONE | **PASS** | Status pill vocabulary with legend tooltips |
| UIR-QUAL-025 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Fortschritt line counts judged values |
| UIR-QUAL-026 | QUAL | implemented | PASS | NONE | **PASS** | Per-row Bestätigen with tooltip and reset |
| UIR-QUAL-027 | QUAL | implemented | PASS | NONE | **PASS** | Only Bestätigen and Fehler melden row actions |
| UIR-QUAL-028 | QUAL | implemented | PASS | NONE | **PASS** | Bulk confirm skips anomalous and judged rows |
| UIR-QUAL-029 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Fehler melden dialog with error-type select |
| UIR-QUAL-030 | QUAL | implemented | PASS | NONE | **PASS** | Annotation column shows flag content, wraps inside |
| UIR-QUAL-031 | QUAL | implemented | PASS | NONE | **PASS** | Annotation survives confirm; no placeholders |
| UIR-QUAL-032 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Multiple flags on one parameter are independent |
| UIR-QUAL-033 | QUAL | implemented | PASS | NONE | **PASS** | Resolved flag shown as Behoben with upstream note |
| UIR-QUAL-034 | QUAL | implemented | PASS | NONE | **PASS** | Read-only Fallstatus & Prüfprotokoll log |
| UIR-QUAL-035 | QUAL | implemented | PASS | NONE | **PASS** | Als geprüft markieren / Prüfung aufheben |
| UIR-QUAL-036 | QUAL | implemented | PASS | NONE | **PASS** | Review state stored server-side per user |
| UIR-QUAL-037 | QUAL | implemented | NONE | NONE | **UNVERIFIED** | Case list rows show status icon, pseudonym and centre |
| UIR-SET-001 | SET | implemented | PASS | NONE | **PASS** | Einstellungen reachable only by administrators |
| UIR-SET-002 | SET | implemented | NONE | NONE | **UNVERIFIED** | "YAML exportieren" downloads current settings.yaml |
| UIR-SET-003 | SET | implemented | NONE | NONE | **UNVERIFIED** | Successful save shows "Einstellungen gespeichert" for 3 s |
| UIR-SET-004 | SET | implemented | NONE | NONE | **UNVERIFIED** | Failed save shows red error banner |
| UIR-SET-005 | SET | implemented | PASS | NONE | **PASS** | Saved settings persist across reload and browsers |
| UIR-SET-006 | SET | implemented | NONE | NONE | **UNVERIFIED** | 2FA switch is off by default and controls OTP step |
| UIR-SET-007 | SET | implemented | NONE | NONE | **UNVERIFIED** | 2FA switch saves immediately, amber warning while off |
| UIR-SET-008 | SET | implemented | PASS | NONE | **PASS** | 2FA setting change is recorded in the Protokoll |
| UIR-SET-009 | SET | implemented | PASS | NONE | **PASS** | Per-user TOTP enrollment with QR and recovery codes |
| UIR-SET-010 | SET | implemented | PASS | NONE | **PASS** | Per-user TOTP can be disabled with a code |
| UIR-SET-011 | SET | implemented | NONE | NONE | **UNVERIFIED** | Session section shows token lifetime fields only |
| UIR-SET-012 | SET | implemented | PASS | NONE | **PASS** | Session lifetime inputs validate live, Save disabled |
| UIR-SET-013 | SET | implemented | NONE | NONE | **UNVERIFIED** | Therapy thresholds editable with defaults 120/365 |
| UIR-SET-014 | SET | implemented | NONE | NONE | **UNVERIFIED** | Therapy thresholds require 0 < t < t' |
| UIR-SET-015 | SET | implemented | PASS | NONE | **PASS** | "Auf Standardwerte zurücksetzen" restores defaults |
| UIR-SET-016 | SET | implemented | PASS | NONE | **PASS** | Clinical thresholds editable with defaults |
| UIR-SET-017 | SET | implemented | PASS | NONE | **PASS** | Clinical thresholds show inline validation error |
| UIR-SET-018 | SET | implemented | PASS | NONE | **PASS** | Plausibility ranges editable with defaults |
| UIR-SET-019 | SET | implemented | PASS | NONE | **PASS** | Plausibility ranges require min < max |
| UIR-SET-020 | SET | implemented | PASS | NONE | **PASS** | Plausibility ranges feed Dokumentationsqualität |
| UIR-SET-021 | SET | implemented | NONE | NONE | **UNVERIFIED** | Data source choice, Blaze URL and "Verbindung testen" |
| UIR-SET-022 | SET | implemented | NONE | NONE | **UNVERIFIED** | Switching data source reloads all data |
| UIR-SET-023 | SET | implemented | PASS | NONE | **PASS** | Issues section shows count, export disabled at zero |
| UIR-SET-024 | SET | implemented | PASS | NONE | **PASS** | "Issues exportieren" downloads JSON bundle |
| UIR-THEME-001 | THEME | implemented | PASS | NONE | **PASS** | Theme menu offers Hell, Dunkel, System with active marked |
| UIR-THEME-002 | THEME | implemented | PASS | NONE | **PASS** | Theme menu closes on outside click or Escape |
| UIR-THEME-003 | THEME | implemented | PASS | NONE | **PASS** | Theme defaults to System (prefers-color-scheme) |
| UIR-THEME-004 | THEME | implemented | PASS | NONE | **PASS** | Chosen theme applies immediately and persists across reload |
| UIR-THEME-005 | THEME | implemented | NONE | NONE | **UNVERIFIED** | System mode follows OS appearance changes live |
| UIR-THEME-006 | THEME | implemented | NONE | NONE | **UNVERIFIED** | No light flash on reload in dark mode |
| UIR-THEME-007 | THEME | implemented | PASS | NONE | **PASS** | Dark mode restyles all Analyse charts and raw-data preview |
| UIR-THEME-008 | THEME | implemented | NONE | NONE | **UNVERIFIED** | Dark mode restyles case view header, charts and cards |
| UIR-THEME-009 | THEME | implemented | NONE | NONE | **UNVERIFIED** | Dark mode restyles quality and doc-quality pages |
| UIR-THEME-010 | THEME | implemented | PASS | NONE | **PASS** | Every page fully German by default, fully English after switch |
| UIR-THEME-011 | THEME | implemented | NONE | NONE | **UNVERIFIED** | Language switch keeps current page and state |
| UIR-THEME-012 | THEME | partial | NONE | NONE | **UNVERIFIED** | Dates and numbers formatted for the active locale |
| UIR-THEME-013 | THEME | implemented | NONE | NONE | **UNVERIFIED** | Text in Inter Variable, data numbers in JetBrains Mono |
| UIR-THEME-014 | THEME | implemented | NONE | NONE | **UNVERIFIED** | Fonts self-hosted from /assets, no third-party font requests |
| UIR-THEME-015 | THEME | implemented | PASS | NONE | **PASS** | Language choice persists across reload |
| UIR-THEME-016 | THEME | partial | NONE | NONE | **UNVERIFIED** | Dialogs and overlays render dark in dark mode |
| UIR-TRAJ-001 | TRAJ | implemented | PASS | NONE | **PASS** | Metric tablist Visus/CRT/Behandlungsintervall/Responder via ?metric= |
| UIR-TRAJ-002 | TRAJ | implemented | PASS | NONE | **PASS** | Header buttons Kohorten vergleichen and Diagramm-Anzeige |
| UIR-TRAJ-003 | TRAJ | implemented | PASS | NONE | **PASS** | Visus shows four summary cards above three panels OD/OS/combined |
| UIR-TRAJ-004 | TRAJ | implemented | PASS | NONE | **PASS** | Computing status shown; no blank cards; controls stay responsive |
| UIR-TRAJ-005 | TRAJ | implemented | PASS | NONE | **PASS** | Heavy cohorts mount panels one at a time with placeholders |
| UIR-TRAJ-006 | TRAJ | implemented | NONE | NONE | **UNVERIFIED** | First visit defaults to X-axis days and Y-metric Δ from baseline |
| UIR-TRAJ-007 | TRAJ | implemented | NONE | NONE | **UNVERIFIED** | Every panel shows Y- and X-axis titles matching metric and mode |
| UIR-TRAJ-008 | TRAJ | implemented | NONE | NONE | **UNVERIFIED** | Plotly modebar: zoom, pan, box/lasso, autoscale, reset; no logo/camera |
| UIR-TRAJ-009 | TRAJ | implemented | PASS | NONE | **PASS** | Panel has role=img aria-label with count and drill-down hint |
| UIR-TRAJ-010 | TRAJ | implemented | PASS | NONE | **PASS** | Settings drawer offers axis, Y-mode, layer and grid controls |
| UIR-TRAJ-011 | TRAJ | implemented | NONE | NONE | **UNVERIFIED** | Settings drawer focuses first radio on open and closes on Escape |
| UIR-TRAJ-012 | TRAJ | implemented | NONE | NONE | **UNVERIFIED** | Settings drawer shows no-controls note for Behandlungsintervall |
| UIR-TRAJ-013 | TRAJ | implemented | NONE | NONE | **UNVERIFIED** | Settings drawer shows responder-threshold input for Responder |
| UIR-TRAJ-014 | TRAJ | implemented | PASS | NONE | **PASS** | Auf Standard zurücksetzen restores axis, Y, grid and layer defaults |
| UIR-TRAJ-015 | TRAJ | implemented | PASS | NONE | **PASS** | Layer toggles add/remove traces in place on all panels |
| UIR-TRAJ-016 | TRAJ | partial | PASS | NONE | **PASS** | All layers off shows an empty-state card instead of panels |
| UIR-TRAJ-017 | TRAJ | implemented | PASS | NONE | **PASS** | Empty states for no cohort, no visus data and no CRT data |
| UIR-TRAJ-018 | TRAJ | implemented | PASS | NONE | **PASS** | Large cohorts default scatter and per-patient curves off with note |
| UIR-TRAJ-019 | TRAJ | implemented | PASS | NONE | **PASS** | Layer toggles survive metric-tab and compare-selection changes |
| UIR-TRAJ-020 | TRAJ | partial | PASS | NONE | **PASS** | View state persists per cohort when leaving and returning |
| UIR-TRAJ-021 | TRAJ | implemented | PASS | NONE | **PASS** | Scatter renders full cloud via WebGL, downsampled only above 6000 |
| UIR-TRAJ-022 | TRAJ | implemented | NONE | NONE | **UNVERIFIED** | No WebGL context accumulation on repeated toggles and tab switches |
| UIR-TRAJ-023 | TRAJ | implemented | PASS | NONE | **PASS** | Tooltip shows hovered point's pseudonym, x and y with unit |
| UIR-TRAJ-024 | TRAJ | implemented | PASS | NONE | **PASS** | Exactly one tooltip; no nearest-x tooltip |
| UIR-TRAJ-025 | TRAJ | implemented | NONE | NONE | **UNVERIFIED** | Hovered scatter point gets an enlarged ringed highlight marker |
| UIR-TRAJ-026 | TRAJ | implemented | PASS | NONE | **PASS** | Hovering a per-patient line thickens it and shows patient tooltip |
| UIR-TRAJ-027 | TRAJ | implemented | NONE | NONE | **UNVERIFIED** | Line emphasis only at measurement points, not between visits |
| UIR-TRAJ-028 | TRAJ | implemented | PASS | NONE | **PASS** | Click a scatter point opens that patient's Fallansicht |
| UIR-TRAJ-029 | TRAJ | implemented | PASS | NONE | **PASS** | Click an individual curve opens that patient's case |
| UIR-TRAJ-030 | TRAJ | implemented | PASS | NONE | **PASS** | Drill-down is disabled in cross-cohort compare mode |
| UIR-TRAJ-031 | TRAJ | implemented | PASS | NONE | **PASS** | Compare drawer lists saved cohorts, locks primary, max 4, subgroups |
| UIR-TRAJ-032 | TRAJ | implemented | PASS | NONE | **PASS** | Compare drawer keeps any non-empty selection and stays interactive |
| UIR-TRAJ-033 | TRAJ | implemented | PASS | NONE | **PASS** | ≥2 cohorts enter cross mode with one coloured median per cohort |
| UIR-TRAJ-034 | TRAJ | implemented | PASS | NONE | **PASS** | Compare mode renders scatter and curves per cohort colour, opt-in |
| UIR-TRAJ-035 | TRAJ | implemented | NONE | NONE | **UNVERIFIED** | ?compare=open auto-opens the compare drawer |
| UIR-TRAJ-036 | TRAJ | implemented | PASS | NONE | **PASS** | Behandlungsintervall histogram with eye toggle and median text |
| UIR-TRAJ-037 | TRAJ | implemented | PASS | NONE | **PASS** | Interval histogram groups bars per cohort with legend in cross mode |
| UIR-TRAJ-038 | TRAJ | implemented | PASS | NONE | **PASS** | Responder view: grouped bars, overlay, per-cohort small multiples |
| UIR-TRAJ-039 | TRAJ | implemented | PASS | NONE | **PASS** | Responder ℹ tooltip states the responder definition |
| UIR-TRAJ-040 | TRAJ | implemented | PASS | NONE | **PASS** | Rohdaten anzeigen table with CSV export per metric |
| UIR-TRAJ-041 | TRAJ | implemented | PASS | NONE | **PASS** | Dark mode uses lighter eye colours and light axis/legend text |
| UIR-TRAJ-042 | TRAJ | implemented | PASS | NONE | **PASS** | Header shows Outcomes title with cohort name and patient count |
| N1 | round | by_design | NONE | PASS | **PASS** | Line hover emphasis along the whole line, not only at points |
| N2 | round | fix | NONE | PASS | **PASS** | Highlight the hovered scatter point, not only its tooltip |
| N3 | round | fix | PASS | PASS | **PASS** | Header cluster: warnings left, cohort-reference toggle far right |
| N4 | round | fix | PASS | PASS | **PASS** | IOD relative axis must fully replace the calendar dates |
| N5 | round | fix | PASS | PASS | **PASS** | Distribution plots: paired patient/cohort %-bars when the overlay is on |
| N6 | round | fix | PASS | PASS | **PASS** | Dark mode: finish the remaining light surfaces |
| N7 | round | fix | PASS | PASS | **PASS** | Theme selection as a collapsible 3-option menu |
| N8 | round | fix | PASS | PASS | **PASS** | Vollzähligkeit denominator follows the time-range filter |
| N9 | round | fix | NONE | PASS | **PASS** | Y-axis label naming the active metric on every trajectory panel |
| N10 | round | fix | PASS | PASS | **PASS** | Name the cohort the overlay represents |
| N11 | round | fix | PASS | PASS | **PASS** | Select which patient-containing cohort the overlay compares against |

## Details

- **UIR-ADMIN-002** — unit: tests/userCrud.test.ts: 1 passed; browser: —
- **UIR-ADMIN-006** — unit: tests/adminCenterFilter.test.tsx: 1 passed | tests/adminCenterFilter.test.tsx: 1 passed; browser: —
- **UIR-ADMIN-009** — unit: tests/ui-requirements.test.ts: 1 passed; browser: —
- **UIR-ADMIN-010** — unit: tests/adminUserDialog.test.tsx: 1 passed; browser: —
- **UIR-ADMIN-012** — unit: tests/userCrud.test.ts: 1 passed; browser: —
- **UIR-ADMIN-013** — unit: tests/userCrud.test.ts: 1 passed; browser: —
- **UIR-ADMIN-016** — unit: tests/userCrud.test.ts: 1 passed; browser: —
- **UIR-ADMIN-018** — unit: tests/adminUserDialog.test.tsx: 1 passed | tests/adminUserDialog.test.tsx: 1 passed; browser: —
- **UIR-ADMIN-020** — unit: tests/adminUserDialog.test.tsx: 1 passed | tests/userCrud.test.ts: 1 passed | tests/userCrud.test.ts: 1 passed; browser: —
- **UIR-ADMIN-022** — unit: tests/userCrud.test.ts: 1 passed; browser: —
- **UIR-ADMIN-023** — unit: tests/credentialMutationInvalidation.test.ts: 1 passed; browser: —
- **UIR-ADMIN-024** — unit: tests/credentialMutationInvalidation.test.ts: 1 passed; browser: —
- **UIR-ADMIN-025** — unit: tests/sessionRevoke.test.ts: 1 passed; browser: —
- **UIR-ADMIN-026** — unit: tests/sessionRevoke.test.ts: 1 passed; browser: —
- **UIR-ADMIN-027** — unit: tests/sessionRevoke.test.ts: 1 passed; browser: —
- **UIR-ADMIN-028** — unit: tests/userCrud.test.ts: 1 passed; browser: —
- **UIR-ADMIN-029** — unit: tests/userCrud.test.ts: 1 passed; browser: —
- **UIR-AGG-001** — unit: tests/AnalysisPage.test.tsx: 1 passed; browser: —
- **UIR-AGG-004** — unit: tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed; browser: —
- **UIR-AGG-005** — unit: tests/AnalysisPage.test.tsx: 1 passed | tests/cohortBuilderEntryPoints.test.tsx: 1 passed; browser: —
- **UIR-AGG-006** — unit: tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed; browser: —
- **UIR-AGG-009** — unit: tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed | tests/CenterMultiSelect.test.tsx: 1 passed | tests/CenterMultiSelect.test.tsx: 1 passed; browser: —
- **UIR-AGG-010** — unit: tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed | tests/fhirApi.test.ts: 1 passed | tests/centerBypass.test.ts: 1 passed; browser: —
- **UIR-AGG-016** — unit: tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed | tests/AnalysisPage.test.tsx: 1 passed; browser: —
- **UIR-AGG-018** — unit: tests/rechartsDarkTheme.test.tsx: 1 passed; browser: —
- **UIR-AGG-019** — unit: tests/jumpBackIn.test.tsx: 1 passed | tests/jumpBackIn.test.tsx: 1 passed | tests/recentActivityStore.test.ts: 1 passed; browser: —
- **UIR-AGG-020** — unit: tests/terminology.test.ts: 1 passed; browser: —
- **UIR-AUDIT-001** — unit: tests/auditPageCharacterization.test.tsx: 1 passed | tests/auditPageCharacterization.test.tsx: 1 passed | tests/auditPageReducer.test.ts: 1 passed; browser: —
- **UIR-AUDIT-002** — unit: tests/auditPageCharacterization.test.tsx: 1 passed | tests/auditPageCharacterization.test.tsx: 1 passed | tests/auditPageReducer.test.ts: 1 passed; browser: —
- **UIR-AUDIT-003** — unit: tests/auditPageReducer.test.ts: 1 passed | tests/auditPageReducer.test.ts: 1 passed | tests/auditPageReducer.test.ts: 1 passed; browser: —
- **UIR-AUDIT-004** — unit: tests/auditPageCharacterization.test.tsx: 1 passed | tests/auditPageReducer.test.ts: 1 passed | tests/auditMiddleware.test.ts: 1 passed; browser: —
- **UIR-AUDIT-006** — unit: tests/auditMiddleware.test.ts: 1 passed | tests/auditMiddleware.test.ts: 1 passed | tests/auditPageReducer.test.ts: 1 passed | tests/auditPageCharacterization.test.tsx: 1 passed; browser: —
- **UIR-AUDIT-008** — unit: tests/auditMiddleware.test.ts: 1 passed | tests/auditMiddleware.test.ts: 1 passed; browser: —
- **UIR-AUDIT-009** — unit: tests/auditMiddleware.test.ts: 1 passed | tests/auditMiddleware.test.ts: 1 passed | tests/auditMiddleware.test.ts: 1 passed; browser: —
- **UIR-AUDIT-010** — unit: tests/auditMiddleware.test.ts: 1 passed | tests/auditMiddleware.test.ts: 1 passed | tests/auditMiddleware.test.ts: 1 passed | tests/auditMiddleware.test.ts: 1 passed; browser: —
- **UIR-AUDIT-011** — unit: tests/auditPageCharacterization.test.tsx: 1 passed | tests/auditApi.test.ts: 1 passed | tests/auditApi.test.ts: 1 passed | tests/auditPageReducer.test.ts: 1 passed; browser: —
- **UIR-AUDIT-012** — unit: tests/auditPageCharacterization.test.tsx: 1 passed | tests/audit.test.ts: 1 passed | tests/audit.test.ts: 1 passed | tests/auditApi.test.ts: 1 passed; browser: —
- **UIR-AUDIT-013** — unit: tests/auditPageCharacterization.test.tsx: 1 passed | tests/auditApi.test.ts: 1 passed | tests/auditApi.test.ts: 1 passed; browser: —
- **UIR-AUDIT-014** — unit: tests/auditPageCharacterization.test.tsx: 1 passed | tests/auditApi.test.ts: 1 passed | tests/auditApi.test.ts: 1 passed | tests/auditApi.test.ts: 1 passed | tests/audit.test.ts: 1 passed; browser: —
- **UIR-AUDIT-015** — unit: tests/auditPageCharacterization.test.tsx: 1 passed | tests/auditPageReducer.test.ts: 1 passed | tests/audit.test.ts: 1 passed | tests/auditApi.test.ts: 1 passed; browser: —
- **UIR-AUDIT-016** — unit: tests/auditPageCharacterization.test.tsx: 1 passed; browser: —
- **UIR-AUDIT-017** — unit: tests/auditPageCharacterization.test.tsx: 1 passed | tests/auditApi.test.ts: 1 passed | tests/auditApi.test.ts: 1 passed; browser: —
- **UIR-AUDIT-019** — unit: tests/auditPageCharacterization.test.tsx: 1 passed; browser: —
- **UIR-AUTH-005** — unit: tests/authConfigProvider.test.ts: 1 passed | tests/authConfigProvider.test.ts: 1 passed; browser: —
- **UIR-AUTH-006** — unit: tests/authConfigProvider.test.ts: 1 passed | tests/userCrud.test.ts: 1 passed; browser: —
- **UIR-AUTH-008** — unit: tests/loginLockout.test.ts: 1 passed | tests/userCrud.test.ts: 1 passed; browser: —
- **UIR-AUTH-009** — unit: tests/loginLockout.test.ts: 1 passed | tests/loginLockout.test.ts: 1 passed | tests/inactivitySettings.test.ts: 1 passed; browser: —
- **UIR-AUTH-010** — unit: tests/loginLockout.test.ts: 1 passed | tests/rateLimiting.test.ts: 2 passed | tests/ui-requirements.test.ts: 1 passed; browser: —
- **UIR-AUTH-011** — unit: tests/rateLimiting.test.ts: 1 passed | tests/rateLimiting.test.ts: 1 passed; browser: —
- **UIR-AUTH-016** — unit: tests/authFetchRefresh.test.ts: 1 passed | tests/authRefresh.test.ts: 1 passed; browser: —
- **UIR-AUTH-017** — unit: tests/cohortFilterPersistence.test.tsx: 1 passed | tests/recentActivityStore.test.ts: 1 passed | tests/sessionTimers.test.tsx: 1 passed; browser: —
- **UIR-AUTH-018** — unit: tests/authFetchRefresh.test.ts: 1 passed | tests/authFetchRefresh.test.ts: 1 passed; browser: —
- **UIR-AUTH-020** — unit: tests/inactivitySettings.test.ts: 1 passed | tests/inactivitySettings.test.ts: 1 passed; browser: —
- **UIR-AUTH-022** — unit: tests/sessionTimers.test.tsx: 1 passed | tests/authFetchRefresh.test.ts: 1 passed | tests/inactivitySettings.test.ts: 1 passed; browser: —
- **UIR-AUTH-023** — unit: tests/credentialMutationInvalidation.test.ts: 1 passed; browser: —
- **UIR-AUTH-025** — unit: tests/credentialMutationInvalidation.test.ts: 1 passed | tests/credentialMutationInvalidation.test.ts: 1 passed; browser: —
- **UIR-AUTH-027** — unit: tests/sessionTimers.test.tsx: 1 passed | tests/credentialMutationInvalidation.test.ts: 1 passed; browser: —
- **UIR-CASE-006** — unit: tests/terminology.test.ts: 1 passed; browser: —
- **UIR-CASE-012** — unit: tests/CaseDetailRound5.test.tsx: 1 passed | tests/CaseDetailRound5.test.tsx: 1 passed | tests/CaseDetailRound7.test.tsx: 1 passed; browser: —
- **UIR-CASE-013** — unit: tests/CaseDetailRound7.test.tsx: 1 passed | tests/CaseDetailRound7.test.tsx: 1 passed; browser: —
- **UIR-CASE-014** — unit: tests/CaseDetailRound7.test.tsx: 1 passed; browser: —
- **UIR-CASE-016** — unit: tests/CaseDetailRound5.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed; browser: —
- **UIR-CASE-017** — unit: tests/CaseDetailRound5.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed; browser: —
- **UIR-CASE-020** — unit: tests/VisusCrtChartLabels.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed; browser: —
- **UIR-CASE-021** — unit: tests/VisusCrtChartReference.test.tsx: 1 passed | tests/CaseDetailRound5.test.tsx: 1 passed; browser: —
- **UIR-CASE-022** — unit: tests/VisusCrtChartLabels.test.tsx: 1 passed; browser: —
- **UIR-CASE-023** — unit: tests/VisusCrtChartLabels.test.tsx: 1 passed | tests/VisusCrtChartLabels.test.tsx: 1 passed; browser: —
- **UIR-CASE-024** — unit: tests/CaseDetailRound5.test.tsx: 1 passed | tests/VisusCrtChartLabels.test.tsx: 1 passed; browser: —
- **UIR-CASE-025** — unit: tests/VisusCrtChartLabels.test.tsx: 1 passed | tests/VisusCrtChartLabels.test.tsx: 1 passed; browser: —
- **UIR-CASE-028** — unit: tests/CaseDetailRound5.test.tsx: 1 passed | tests/CaseDetailRound5.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed | tests/CaseDetailRound7.test.tsx: 1 passed; browser: —
- **UIR-CASE-029** — unit: tests/CaseDetailRound5.test.tsx: 1 passed | tests/CaseDetailRound5.test.tsx: 1 passed; browser: —
- **UIR-CASE-030** — unit: tests/VisusCrtChartReference.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed; browser: —
- **UIR-CASE-031** — unit: tests/VisusCrtChartLabels.test.tsx: 1 passed | tests/VisusCrtChartLabels.test.tsx: 1 passed | tests/VisusCrtChartLabels.test.tsx: 1 passed; browser: —
- **UIR-CASE-032** — unit: tests/VisusCrtChartLabels.test.tsx: 1 passed; browser: —
- **UIR-CASE-033** — unit: tests/VisusCrtChartReference.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed; browser: —
- **UIR-CASE-035** — unit: tests/components.test.tsx: 1 passed; browser: —
- **UIR-CASE-037** — unit: tests/VisusCrtChartReference.test.tsx: 1 passed; browser: —
- **UIR-CASE-038** — unit: tests/VisusCrtChartReference.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed; browser: —
- **UIR-CASE-039** — unit: tests/VisusCrtChartReference.test.tsx: 1 passed; browser: —
- **UIR-CASE-040** — unit: tests/DistributionChartsLabels.test.tsx: 1 passed; browser: —
- **UIR-CASE-041** — unit: tests/DistributionChartsLabels.test.tsx: 1 passed | tests/DistributionChartsLabels.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed | tests/CaseDetailRound7.test.tsx: 1 passed; browser: —
- **UIR-CASE-042** — unit: tests/DistributionChartsLabels.test.tsx: 1 passed | tests/DistributionChartsLabels.test.tsx: 1 passed; browser: —
- **UIR-CASE-043** — unit: tests/DistributionChartsLabels.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed; browser: —
- **UIR-CASE-044** — unit: tests/CaseDetailRound5.test.tsx: 1 passed; browser: —
- **UIR-CASE-045** — unit: tests/CaseDetailRound7.test.tsx: 1 passed | tests/CaseDetailRound7.test.tsx: 1 passed | tests/CaseDetailRound5.test.tsx: 1 passed | tests/CaseDetailRound5.test.tsx: 1 passed; browser: —
- **UIR-CASE-055** — unit: tests/authMiddlewareLocal.test.ts: 1 passed; browser: —
- **UIR-COH-001** — unit: tests/fhirApi.test.ts: 1 passed | tests/fhirApi.test.ts: 1 passed | tests/centerBypass.test.ts: 1 passed; browser: —
- **UIR-COH-005** — unit: tests/cohortPresets.test.ts: 1 passed; browser: —
- **UIR-COH-007** — unit: tests/cohortFilterPersistence.test.tsx: 1 passed; browser: —
- **UIR-COH-009** — unit: tests/cohortPresets.test.ts: 1 passed; browser: —
- **UIR-COH-010** — unit: tests/advancedFilterDialog.test.tsx: 1 passed; browser: —
- **UIR-COH-011** — unit: tests/cohortBuilderValidation.test.tsx: 1 passed | tests/cohortBuilderValidation.test.tsx: 1 passed | tests/cohortBuilderValidation.test.tsx: 1 passed | tests/cohortBuilderValidation.test.tsx: 1 passed | tests/cohortBuilderValidation.test.tsx: 1 passed; browser: —
- **UIR-COH-013** — unit: tests/cohortFilterPersistence.test.tsx: 1 passed | tests/cohortFilterPersistence.test.tsx: 1 passed; browser: —
- **UIR-COH-014** — unit: tests/cohortFilterPersistence.test.tsx: 1 passed | tests/cohortFilterPersistence.test.tsx: 1 passed; browser: —
- **UIR-COH-015** — unit: tests/advancedFilterDialog.test.tsx: 1 passed | tests/advancedFilterDialog.test.tsx: 1 passed | tests/advancedFilterDialog.test.tsx: 1 passed | tests/cohortPresets.test.ts: 1 passed; browser: —
- **UIR-COH-016** — unit: tests/advancedFilterDialog.test.tsx: 1 passed; browser: —
- **UIR-COH-017** — unit: tests/advancedFilterDialog.test.tsx: 1 passed | tests/cohortPresets.test.ts: 1 passed; browser: —
- **UIR-COH-019** — unit: tests/advancedFilterDialog.test.tsx: 1 passed | tests/advancedFilterDialog.test.tsx: 1 passed; browser: —
- **UIR-COH-020** — unit: tests/advancedFilterDialog.test.tsx: 1 passed; browser: —
- **UIR-COH-021** — unit: tests/advancedFilterDialog.test.tsx: 1 passed; browser: —
- **UIR-COH-022** — unit: tests/advancedFilterDialog.test.tsx: 1 passed | tests/advancedFilterDialog.test.tsx: 1 passed | tests/advancedFilterDialog.test.tsx: 1 passed; browser: —
- **UIR-COH-027** — unit: tests/AnalysisPage.test.tsx: 1 passed; browser: —
- **UIR-COH-028** — unit: tests/dataApiSavedSearch.test.ts: 1 passed | tests/dataDb.test.ts: 1 passed; browser: —
- **UIR-COH-029** — unit: tests/cohortBuilderEntryPoints.test.tsx: 1 passed | tests/cohortBuilderEntryPoints.test.tsx: 1 passed | tests/cohortBuilderEntryPoints.test.tsx: 1 passed | tests/cohortNames.test.ts: 1 passed; browser: —
- **UIR-COH-031** — unit: tests/dataDb.test.ts: 1 passed | tests/dataApiSavedSearch.test.ts: 1 passed; browser: —
- **UIR-COH-032** — unit: tests/qualityCohortScope.test.tsx: 1 passed | tests/dataApiSavedSearch.test.ts: 1 passed; browser: —
- **UIR-COH-033** — unit: tests/cohortBuilderEntryPoints.test.tsx: 1 passed; browser: —
- **UIR-COH-036** — unit: tests/dataDb.test.ts: 1 passed; browser: —
- **UIR-COH-037** — unit: tests/cohortBuilderEntryPoints.test.tsx: 1 passed; browser: —
- **UIR-COH-038** — unit: tests/cohortBuilderEntryPoints.test.tsx: 1 passed | tests/cohortCompareDrawer.test.tsx: 1 passed | tests/cohortNames.test.ts: 1 passed; browser: —
- **UIR-COH-039** — unit: tests/cohortSplitDialog.test.tsx: 1 passed | tests/cohortSplit.test.ts: 1 passed; browser: —
- **UIR-COH-040** — unit: tests/cohortSplitDialog.test.tsx: 1 passed | tests/cohortSplit.test.ts: 1 passed | tests/cohortSplit.test.ts: 1 passed; browser: —
- **UIR-COH-041** — unit: tests/cohortSplitDialog.test.tsx: 1 passed | tests/cohortSplit.test.ts: 1 passed; browser: —
- **UIR-COH-042** — unit: tests/cohortSplitDialog.test.tsx: 1 passed | tests/cohortSplitDialog.test.tsx: 1 passed | tests/cohortCompareDrawer.test.tsx: 1 passed | tests/cohortCompareDrawer.test.tsx: 1 passed | tests/OutcomesViewRouting.test.tsx: 1 passed | tests/OutcomesViewRouting.test.tsx: 1 passed; browser: —
- **UIR-COH-043** — unit: tests/cohortFilterPersistence.test.tsx: 1 passed; browser: —
- **UIR-DEPLOY-002** — unit: tests/deploySettings.test.ts: 1 passed; browser: —
- **UIR-DEPLOY-004** — unit: tests/auditMiddleware.test.ts: 1 passed; browser: —
- **UIR-DEPLOY-005** — unit: tests/deploySettings.test.ts: 1 passed; browser: —
- **UIR-DEPLOY-008** — unit: tests/themeToggleCycle.test.tsx: 1 passed; browser: —
- **UIR-DEPLOY-011** — unit: tests/authRefresh.test.ts: 1 passed | tests/authFetchRefresh.test.ts: 1 passed | tests/authFetchRefresh.test.ts: 1 passed | tests/authFetchRefresh.test.ts: 1 passed | tests/authFetchRefreshSuite.test.ts: 1 passed; browser: —
- **UIR-DEPLOY-012** — unit: tests/deploySettings.test.ts: 1 passed | tests/sessionRotation.test.ts: 1 passed; browser: —
- **UIR-DEPLOY-018** — unit: tests/settingsApi.test.ts: 1 passed | tests/settingsApi.test.ts: 1 passed; browser: —
- **UIR-DEPLOY-019** — unit: tests/issueApi.test.ts: 1 passed | tests/issueApi.test.ts: 1 passed | tests/issueApi.test.ts: 1 passed; browser: —
- **UIR-DOCQ-002** — unit: tests/qualityMetrics.test.ts: 1 passed | tests/qualityMetrics.test.ts: 1 passed | tests/qualityMetrics.test.ts: 1 passed | tests/qualityMetrics.test.ts: 1 passed; browser: —
- **UIR-DOCQ-003** — unit: tests/qualityMetrics.test.ts: 1 passed | tests/qualityMetrics.test.ts: 1 passed | tests/qualityMetrics.test.ts: 1 passed; browser: —
- **UIR-DOCQ-008** — unit: tests/docQualityVollzaehligkeit.test.tsx: 1 passed | tests/docQualityVollzaehligkeit.test.tsx: 1 passed | tests/docQualityVollzaehligkeit.test.tsx: 1 passed | tests/components.test.tsx: 1 passed | tests/docQualityMainCentreParity.test.tsx: 1 passed; browser: —
- **UIR-DOCQ-009** — unit: tests/docQualityVollzaehligkeit.test.tsx: 1 passed | tests/docQualityVollzaehligkeit.test.tsx: 1 passed; browser: —
- **UIR-DOCQ-010** — unit: tests/docQualityMainCentreParity.test.tsx: 1 passed; browser: —
- **UIR-DOCQ-011** — unit: tests/qualityMetrics.test.ts: 1 passed | tests/stubIsolation.test.ts: 1 passed; browser: —
- **UIR-DOCQ-016** — unit: tests/docQualityMainCentreParity.test.tsx: 1 passed | tests/docQualityMainCentreParity.test.tsx: 1 passed | tests/components.test.tsx: 1 passed; browser: —
- **UIR-DOCQ-018** — unit: tests/docQualityMainCentreParity.test.tsx: 1 passed | tests/docQualityMainCentreParity.test.tsx: 1 passed | tests/docQualityMainCentreParity.test.tsx: 1 passed; browser: —
- **UIR-FEEDBACK-005** — unit: tests/issueApi.test.ts: 1 passed; browser: —
- **UIR-FEEDBACK-009** — unit: tests/issueApi.test.ts: 1 passed | tests/issueApi.test.ts: 1 passed; browser: —
- **UIR-FEEDBACK-010** — unit: tests/issueApi.test.ts: 1 passed | tests/issueApi.test.ts: 1 passed; browser: —
- **UIR-LAND-007** — unit: tests/datenvollstaendigkeitCard.test.tsx: 1 passed | tests/datenvollstaendigkeitCard.test.tsx: 1 passed | tests/datenvollstaendigkeitCard.test.tsx: 1 passed | tests/datenvollstaendigkeitCard.test.tsx: 1 passed | tests/stubIsolation.test.ts: 1 passed; browser: —
- **UIR-LAND-008** — unit: tests/datenvollstaendigkeitCard.test.tsx: 1 passed; browser: —
- **UIR-LAND-011** — unit: tests/generatedBundles.test.ts: 4 passed | tests/constants.test.ts: 1 passed; browser: —
- **UIR-LAND-012** — unit: tests/fhirApi.test.ts: 1 passed | tests/fhirApi.test.ts: 1 passed | tests/centerBypass.test.ts: 1 passed | tests/centerBypass.test.ts: 1 passed; browser: —
- **UIR-LAND-013** — unit: tests/stubIsolation.test.ts: 1 passed | tests/generatedBundles.test.ts: 4 passed; browser: —
- **UIR-LAND-016** — unit: tests/jumpBackIn.test.tsx: 1 passed | tests/jumpBackIn.test.tsx: 1 passed | tests/recentActivityStore.test.ts: 1 passed | tests/recentActivityStore.test.ts: 1 passed; browser: —
- **UIR-LAND-017** — unit: tests/jumpBackIn.test.tsx: 1 passed | tests/LandingPage.test.tsx: 1 passed | tests/LandingPage.test.tsx: 1 passed | tests/recentActivityStore.test.ts: 1 passed; browser: —
- **UIR-LAND-018** — unit: tests/LandingPage.test.tsx: 1 passed | tests/landingPageAlerts.test.tsx: 1 passed; browser: —
- **UIR-LAND-019** — unit: tests/landingPageAlerts.test.tsx: 1 passed | tests/landingPageAlerts.test.tsx: 1 passed | tests/LandingPage.test.tsx: 1 passed | tests/LandingPage.test.tsx: 1 passed | tests/qualityPageDeepLink.test.tsx: 1 passed | tests/qualityPageDeepLink.test.tsx: 1 passed | tests/qualityPageDeepLink.test.tsx: 1 passed; browser: —
- **UIR-NAV-013** — unit: tests/components.test.tsx: 1 passed | tests/components.test.tsx: 1 passed | tests/components.test.tsx: 1 passed; browser: —
- **UIR-QUAL-001** — unit: tests/qualityCohortScope.test.tsx: 1 passed | tests/qualityCohortScope.test.tsx: 1 passed | tests/qualityCohortScope.test.tsx: 1 passed | tests/qualityFlaggedCohortRoundTrip.test.tsx: 1 passed; browser: —
- **UIR-QUAL-002** — unit: tests/qualityCohortScope.test.tsx: 1 passed | tests/qualityCohortScope.test.tsx: 1 passed | tests/qualityCohortScope.test.tsx: 1 passed | tests/qualityCohortScope.test.tsx: 1 passed | tests/dataApiSavedSearch.test.ts: 1 passed | tests/dataApiSavedSearch.test.ts: 1 passed | tests/qualityParams.test.ts: 1 passed; browser: —
- **UIR-QUAL-003** — unit: tests/ui-requirements.test.ts: 1 passed; browser: —
- **UIR-QUAL-004** — unit: tests/QualityPage.test.tsx: 1 passed | tests/QualityPage.test.tsx: 1 passed | tests/qualityMetrics.test.ts: 1 passed | tests/qualityMetrics.test.ts: 1 passed; browser: —
- **UIR-QUAL-005** — unit: tests/QualityPage.test.tsx: 1 passed | tests/QualityPage.test.tsx: 1 passed; browser: —
- **UIR-QUAL-006** — unit: tests/CenterMultiSelect.test.tsx: 1 passed | tests/CenterMultiSelect.test.tsx: 1 passed | tests/CenterMultiSelect.test.tsx: 1 passed | tests/fhirApi.test.ts: 1 passed; browser: —
- **UIR-QUAL-007** — unit: tests/QualityPage.test.tsx: 1 passed; browser: —
- **UIR-QUAL-010** — unit: tests/qualityPageDeepLink.test.tsx: 1 passed; browser: —
- **UIR-QUAL-012** — unit: tests/qualityPageDeepLink.test.tsx: 1 passed | tests/qualityPageDeepLink.test.tsx: 1 passed | tests/qualityPageDeepLink.test.tsx: 1 passed | tests/qualityPageDeepLink.test.tsx: 1 passed | tests/qualityPageDeepLink.test.tsx: 1 passed | tests/landingPageAlerts.test.tsx: 1 passed; browser: —
- **UIR-QUAL-019** — unit: tests/dataDb.test.ts: 1 passed; browser: —
- **UIR-QUAL-021** — unit: tests/QualityCaseDetail.test.tsx: 1 passed; browser: —
- **UIR-QUAL-022** — unit: tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed; browser: —
- **UIR-QUAL-023** — unit: tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed | tests/qualityCohortScope.test.tsx: 1 passed | tests/qualityCohortScope.test.tsx: 1 passed; browser: —
- **UIR-QUAL-024** — unit: tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed; browser: —
- **UIR-QUAL-026** — unit: tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed | tests/dataDb.test.ts: 1 passed; browser: —
- **UIR-QUAL-027** — unit: tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed; browser: —
- **UIR-QUAL-028** — unit: tests/QualityCaseDetail.test.tsx: 1 passed; browser: —
- **UIR-QUAL-030** — unit: tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed; browser: —
- **UIR-QUAL-031** — unit: tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed; browser: —
- **UIR-QUAL-033** — unit: tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed; browser: —
- **UIR-QUAL-034** — unit: tests/QualityCaseDetail.test.tsx: 1 passed | tests/QualityCaseDetail.test.tsx: 1 passed; browser: —
- **UIR-QUAL-035** — unit: tests/QualityCaseDetail.test.tsx: 1 passed | tests/dataDb.test.ts: 1 passed; browser: —
- **UIR-QUAL-036** — unit: tests/dataDb.test.ts: 4 passed | tests/dataApiCenter.test.ts: 1 passed | tests/dataApiCenter.test.ts: 1 passed; browser: —
- **UIR-SET-001** — unit: tests/settingsApi.test.ts: 1 passed; browser: —
- **UIR-SET-005** — unit: tests/settingsApi.test.ts: 1 passed | tests/settingsApi.test.ts: 1 passed; browser: —
- **UIR-SET-008** — unit: tests/auditPageReducer.test.ts: 1 passed | tests/auditMiddleware.test.ts: 1 passed | tests/auditMiddleware.test.ts: 1 passed; browser: —
- **UIR-SET-009** — unit: tests/credentialMutationInvalidation.test.ts: 1 passed; browser: —
- **UIR-SET-010** — unit: tests/credentialMutationInvalidation.test.ts: 1 passed; browser: —
- **UIR-SET-012** — unit: tests/ttlConversion.test.ts: 1 passed | tests/ttlConversion.test.ts: 1 passed | tests/ttlConversion.test.ts: 1 passed; browser: —
- **UIR-SET-015** — unit: tests/settingsResetKeepsSections.test.ts: 1 passed | tests/settingsApi.test.ts: 1 passed; browser: —
- **UIR-SET-016** — unit: tests/thresholdConfig.test.ts: 1 passed; browser: —
- **UIR-SET-017** — unit: tests/thresholdConfig.test.ts: 1 passed | tests/thresholdConfig.test.ts: 1 passed; browser: —
- **UIR-SET-018** — unit: tests/thresholdConfig.test.ts: 1 passed; browser: —
- **UIR-SET-019** — unit: tests/thresholdConfig.test.ts: 1 passed | tests/thresholdConfig.test.ts: 1 passed; browser: —
- **UIR-SET-020** — unit: tests/docQualityMainCentreParity.test.tsx: 1 passed | tests/docQualityMainCentreParity.test.tsx: 1 passed; browser: —
- **UIR-SET-023** — unit: tests/issueApi.test.ts: 1 passed; browser: —
- **UIR-SET-024** — unit: tests/issueApi.test.ts: 1 passed; browser: —
- **UIR-THEME-001** — unit: tests/themeToggleCycle.test.tsx: 1 passed | tests/themeToggleCycle.test.tsx: 1 passed | tests/themeToggleCycle.test.tsx: 1 passed | tests/themeToggleCycle.test.tsx: 1 passed; browser: —
- **UIR-THEME-002** — unit: tests/themeToggleCycle.test.tsx: 1 passed | tests/themeToggleCycle.test.tsx: 1 passed; browser: —
- **UIR-THEME-003** — unit: tests/themeToggleCycle.test.tsx: 1 passed; browser: —
- **UIR-THEME-004** — unit: tests/themeToggleCycle.test.tsx: 1 passed | tests/themeToggleCycle.test.tsx: 1 passed; browser: —
- **UIR-THEME-007** — unit: tests/rechartsDarkTheme.test.tsx: 1 passed | tests/rechartsDarkTheme.test.tsx: 1 passed | tests/rechartsDarkTheme.test.tsx: 1 passed; browser: —
- **UIR-THEME-010** — unit: tests/outcomesI18n.test.ts: 1 passed | tests/outcomesI18n.test.ts: 1 passed | tests/docQualityVollzaehligkeit.test.tsx: 1 passed | tests/inactivitySettings.test.ts: 1 passed; browser: —
- **UIR-THEME-015** — unit: tests/themeToggleCycle.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-001** — unit: tests/metricSelector.test.tsx: 1 passed | tests/metricSelector.test.tsx: 1 passed | tests/metricSelector.test.tsx: 1 passed | tests/metricSelector.test.tsx: 1 passed | tests/metricSelector.test.tsx: 1 passed | tests/metricSelector.test.tsx: 1 passed | tests/metricSelector.test.tsx: 1 passed | tests/metricSelector.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-002** — unit: tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesViewRouting.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-003** — unit: tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-004** — unit: tests/OutcomesPerfI2.test.tsx: 1 passed | tests/OutcomesPerfI2.test.tsx: 1 passed | tests/OutcomesPerfI2.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-005** — unit: tests/useProgressivePanels.test.tsx: 1 passed | tests/useProgressivePanels.test.tsx: 1 passed | tests/useProgressivePanels.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-009** — unit: tests/OutcomesPanel.test.tsx: 1 passed | tests/OutcomesPanel.test.tsx: 1 passed | tests/OutcomesPanelDrillDown.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-010** — unit: tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-014** — unit: tests/outcomesViewStatePersist.test.ts: 1 passed; browser: —
- **UIR-TRAJ-015** — unit: tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPanelScatterCap.test.tsx: 1 passed | tests/OutcomesPanelLineClick.test.tsx: 1 passed | tests/plotlyTracesHover.test.ts: 1 passed; browser: —
- **UIR-TRAJ-016** — unit: tests/outcomesEmptyState.test.tsx: 1 passed | tests/outcomesEmptyState.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-017** — unit: tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed | tests/outcomesEmptyState.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-018** — unit: tests/OutcomesPerfI2.test.tsx: 1 passed | tests/OutcomesPerfI2.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPerfA6.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-019** — unit: tests/OutcomesPerfI2.test.tsx: 1 passed | tests/OutcomesViewPersist.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-020** — unit: tests/outcomesViewStatePersist.test.ts: 1 passed | tests/outcomesViewStatePersist.test.ts: 1 passed | tests/OutcomesViewPersist.test.tsx: 1 passed | tests/OutcomesViewPersist.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-021** — unit: tests/OutcomesPanelScatterCap.test.tsx: 1 passed | tests/OutcomesPanelScatterCap.test.tsx: 1 passed | tests/OutcomesPanelScatterCap.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-023** — unit: tests/OutcomesPanelHoverTooltip.test.tsx: 1 passed | tests/OutcomesPanelHoverTooltip.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-024** — unit: tests/OutcomesPanelHoverTooltip.test.tsx: 1 passed | tests/plotlyTracesHover.test.ts: 1 passed | tests/plotlyTracesHover.test.ts: 1 passed; browser: —
- **UIR-TRAJ-026** — unit: tests/OutcomesPanelLineClick.test.tsx: 1 passed | tests/OutcomesPanelLineClick.test.tsx: 1 passed | tests/OutcomesPanelLineClick.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-028** — unit: tests/OutcomesPanelDrillDown.test.tsx: 1 passed | tests/OutcomesPanelDrillDown.test.tsx: 1 passed | tests/OutcomesPanelDrillDown.test.tsx: 1 passed | tests/OutcomesPanelDrillDown.test.tsx: 1 passed | tests/plotlyDrillDownGate.test.ts: 1 passed; browser: —
- **UIR-TRAJ-029** — unit: tests/OutcomesPanelLineClick.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-030** — unit: tests/OutcomesPanelLineClick.test.tsx: 1 passed | tests/OutcomesPanelDrillDown.test.tsx: 1 passed | tests/OutcomesPanelDrillDown.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-031** — unit: tests/cohortCompareDrawer.test.tsx: 1 passed | tests/cohortCompareDrawer.test.tsx: 1 passed | tests/cohortCompareDrawer.test.tsx: 1 passed | tests/cohortCompareDrawer.test.tsx: 1 passed | tests/cohortCompareDrawer.test.tsx: 1 passed | tests/cohortCompareDrawer.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-032** — unit: tests/OutcomesViewRouting.test.tsx: 1 passed | tests/cohortCompareDrawer.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-033** — unit: tests/OutcomesViewRouting.test.tsx: 1 passed | tests/OutcomesViewRouting.test.tsx: 1 passed | tests/OutcomesPanel.test.tsx: 1 passed | tests/OutcomesPanel.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-034** — unit: tests/OutcomesPanel.test.tsx: 1 passed | tests/OutcomesPanel.test.tsx: 1 passed | tests/OutcomesPanel.test.tsx: 1 passed | tests/plotlyTracesHover.test.ts: 1 passed; browser: —
- **UIR-TRAJ-036** — unit: tests/intervalHistogram.test.tsx: 1 passed | tests/intervalHistogram.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-037** — unit: tests/intervalHistogram.test.tsx: 1 passed | tests/intervalHistogram.test.tsx: 1 passed | tests/intervalHistogram.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-038** — unit: tests/responderView.test.tsx: 1 passed | tests/responderView.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-039** — unit: tests/ResponderTooltipPlacement.test.tsx: 1 passed | tests/ResponderTooltipPlacement.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-040** — unit: tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-041** — unit: tests/outcomesPalette.contrast.test.ts: 3 passed | tests/rechartsDarkTheme.test.tsx: 1 passed; browser: —
- **UIR-TRAJ-042** — unit: tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed; browser: —
- **N1** — unit: —; browser: By design (owner decision, round 7): line emphasis is anchored at the measurement points; hovering a line emphasises it there and no mid-segment emphasis exists (Plotly hoveron supports points/fills only). Verified live in the v1.19 dev-response pass.
- **N2** — unit: —; browser: Dev response: 'Hovering a point in the cloud emphasises that point (an enlarged, ringed marker) in addition to the single detailed tooltip.' Closing statement: 'live in-browser checks of every item above — including a deployed production build (single-server)'.
- **N3** — unit: tests/CaseDetailRound5.test.tsx: 1 passed | tests/CaseDetailRound5.test.tsx: 1 passed | tests/CaseDetailRound7.test.tsx: 1 passed; browser: Dev response: 'the header's top-right cluster is reordered — the implausible-data warnings sit to the left and the "Kohorten-Referenz anzeigen" toggle is the rightmost element.' Closing statement: 'live in-browser checks of every item above'.
- **N4** — unit: tests/CaseDetailRound7.test.tsx: 1 passed | tests/CaseDetailRound7.test.tsx: 1 passed | tests/CaseDetailRound5.test.tsx: 1 passed | tests/CaseDetailRound5.test.tsx: 1 passed; browser: Dev response: 'the IOD plot now switches cleanly to the relative "Monate seit Erstvisite" axis with no residual calendar-date ticks (verified on EM-UKT-0027).'
- **N5** — unit: tests/DistributionChartsLabels.test.tsx: 1 passed | tests/DistributionChartsLabels.test.tsx: 1 passed | tests/VisusCrtChartReference.test.tsx: 1 passed | tests/CaseDetailRound7.test.tsx: 1 passed; browser: Dev response, How to verify: 'open EM-UKT-0027 → enable "Kohorten-Referenz anzeigen" → … the Visus/CRT distribution plots show paired patient/cohort %-bars on a 0–% axis, with counts on hover.' Closing statement: 'The cohort-overlay distribution comparison is drawn with a lightweight grouped-bar renderer … it behaves identically and stays on the shared percentage scale.'
- **N6** — unit: tests/rechartsDarkTheme.test.tsx: 1 passed | tests/rechartsDarkTheme.test.tsx: 1 passed | tests/rechartsDarkTheme.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed | tests/OutcomesPage.test.tsx: 1 passed; browser: Dev response, How to verify: 'pick "Dunkel" (or "System" on a dark OS) → open a case and the Verläufe view: every figure, table, collapsible and the OCT viewer render dark.' Tester confirmed the Analyse and quality surfaces in the following round (registry sources 'UAT v1.19 N6 (tester confirmed)' on UIR-THEME-007/009).
- **N7** — unit: tests/themeToggleCycle.test.tsx: 1 passed | tests/themeToggleCycle.test.tsx: 1 passed | tests/themeToggleCycle.test.tsx: 1 passed | tests/themeToggleCycle.test.tsx: 1 passed | tests/themeToggleCycle.test.tsx: 1 passed | tests/themeToggleCycle.test.tsx: 1 passed; browser: Dev response: 'the theme selector is now a collapsible menu with the three options (Hell / Dunkel / System) directly selectable, the active one marked. (The cycling button is retired.)' Closing statement: 'live in-browser checks of every item above'.
- **N8** — unit: tests/qualityMetrics.test.ts: 1 passed | tests/stubIsolation.test.ts: 1 passed; browser: Dev response, How to verify: 'Dokumentationsqualität → Zeitraum → "Letztes Jahr": the count and the % both update to the windowed population.'
- **N9** — unit: —; browser: Dev response: 'every trajectory panel now shows a y-axis label for the active metric (e.g. "Δ logMAR", "logMAR", "Netzhautdicke (µm)"), so the plotted quantity is clear without opening Diagramm-Anzeige.' Closing statement: 'live in-browser checks of every item above'.
- **N10** — unit: tests/CaseDetailRound7.test.tsx: 1 passed; browser: Dev response, How to verify: 'open a case → next to the overlay toggle, the selector lists the patient's cohorts and the header shows the chosen one's name + N.'
- **N11** — unit: tests/CaseDetailRound7.test.tsx: 1 passed | tests/CaseDetailRound7.test.tsx: 1 passed; browser: Dev response, How to verify: 'open a case → next to the overlay toggle, the selector lists the patient's cohorts and the header shows the chosen one's name + N.'
