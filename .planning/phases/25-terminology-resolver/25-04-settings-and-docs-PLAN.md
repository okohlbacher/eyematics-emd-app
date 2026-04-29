---
phase: 25-terminology-resolver
plan: 04
type: execute
wave: 4
depends_on:
  - 25-02
  - 25-03
files_modified:
  - config/settings.yaml
  - server/index.ts
  - docs/Konfiguration.md
  - README.md
autonomous: true
requirements:
  - TERM-04
must_haves:
  truths:
    - "config/settings.yaml example contains the three terminology.* keys with the D-16 default values"
    - "server/index.ts code-supplies the same defaults so a minimal YAML omitting terminology.* still produces working behavior (D-17, Phase 23 D-17 pattern)"
    - "docs/Konfiguration.md (German) documents enabled / serverUrl / cacheTtlMs with the same minimal-vs-full note pattern used by other Phase 23-era keys (D-18)"
    - "README/BOM updated only if it surfaces a configuration table that previously omitted terminology"
    - "Defaults preserve current offline behavior — terminology.enabled is false by default (D-16)"
    - "Final safety net green: test:ci + build + lint + knip (D-24)"
  artifacts:
    - path: "config/settings.yaml"
      provides: "terminology.* example block"
      contains: "terminology"
    - path: "server/index.ts"
      provides: "Code-defaulted terminology config (Phase 23 D-17 pattern)"
      contains: "terminology"
    - path: "docs/Konfiguration.md"
      provides: "German documentation of the three terminology keys"
      contains: "terminology"
  key_links:
    - from: "server/terminologyApi.ts readTerminologySettings"
      to: "config/settings.yaml terminology.* + server/index.ts code defaults"
      via: "YAML read with code-supplied fallbacks"
      pattern: "terminology"
---

<objective>
Land the configuration surface for the terminology resolver: add the three `terminology.*` keys to `config/settings.yaml` with the D-16 defaults, code-supply the same defaults in `server/index.ts` per the Phase 23 D-17 minimal-YAML pattern, and document them in German in `docs/Konfiguration.md` (D-18). Defaults must preserve current offline behavior (`terminology.enabled: false`). README/BOM update only if a configuration table is materially affected.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/25-terminology-resolver/25-CONTEXT.md
@.planning/REQUIREMENTS.md
@CLAUDE.md
@config/settings.yaml
@server/index.ts
@docs/Konfiguration.md
@README.md

<interfaces>
Existing settings.yaml shape (head):
```yaml
twoFactorEnabled: false
therapyInterrupterDays: 120
therapyBreakerDays: 365
dataSource:
  type: local
  blazeUrl: http://localhost:8080/fhir
outcomes:
  serverAggregationThresholdPatients: 1000
  aggregateCacheTtlMs: 1800000
auth:
  refreshTokenTtlMs: 28800000
  refreshAbsoluteCapMs: 43200000
  refreshCookieSecure: true
```

D-16 block to add at top level (after `auth` block):
```yaml
terminology:
  enabled: false                                          # default OFF — preserves offline behavior
  serverUrl: 'https://r4.ontoserver.csiro.au/fhir'        # placeholder default; real server set per-deployment
  cacheTtlMs: 86400000                                    # 24h
```

Server-side code defaults (D-17, Phase 23 D-17 pattern): `server/index.ts` reads `settings = yaml.load(...)` once at boot. The router file `server/terminologyApi.ts` already has `readTerminologySettings()` (plan 25-02 Task 1) which falls back to `enabled=false`, `cacheTtlMs=86400000`, `serverUrl=undefined` when keys are missing. This plan does NOT need to change the router — but `server/index.ts` should mirror the same defaults if it loads or surfaces them anywhere (e.g. CSP headers in line 169-183 added a Keycloak-issuer entry to `connectSrc` based on a settings key; if `terminology.enabled` ever needs to inject `terminology.serverUrl` into `connectSrc`, that wiring belongs here — verify whether the resolver fetches from the browser directly OR only via the server proxy).

Per plan 25-01 Task 2: the browser-side `resolveDisplay` calls `/api/terminology/lookup` (same-origin) — NOT the external `terminology.serverUrl` directly. Therefore CSP `connectSrc` does NOT need updating for terminology. The server proxy is the only outbound caller; it runs server-side where CSP doesn't apply.

`docs/Konfiguration.md` is German per D-18. Inspect existing structure for the "minimal vs full" note pattern (likely a section per top-level key with default + override behavior). Mirror that pattern exactly.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add terminology.* to settings.yaml + verify code defaults in server</name>
  <files>config/settings.yaml, server/index.ts</files>
  <action>
    Per D-16, D-17:
    1. Open `config/settings.yaml`. Add the `terminology:` block after the `auth:` block, with the three keys + inline comments exactly as listed in `<interfaces>` above (D-16 verbatim).
    2. Inspect `server/index.ts` to confirm whether terminology defaults need to be code-supplied at boot. Plan 25-02's `readTerminologySettings()` already provides per-request defaults — that's the binding source-of-truth. If `server/index.ts` does NOT separately read or log terminology config at boot, no change is needed here (D-17 satisfied by router-level defaults). If `server/index.ts` does log or surface the resolved settings on boot (similar to how it logs `provider`/`maxLoginAttempts`), add a one-line `console.log('[server] terminology:', { enabled, serverUrl, cacheTtlMs })` mirroring that pattern with the same code defaults.
    3. Run `node -e "require('js-yaml').load(require('fs').readFileSync('config/settings.yaml','utf8'))"` to confirm YAML parses cleanly.
    4. Safety net: `npm run test:ci && npm run build`.
  </action>
  <verify>
    <automated>node -e "require('js-yaml').load(require('fs').readFileSync('config/settings.yaml','utf8'))" &amp;&amp; npm run test:ci &amp;&amp; npm run build</automated>
  </verify>
  <done>
    settings.yaml parses; YAML diff shows only the three new keys + the boot-log if added. Atomic commit: `chore(25-04): add terminology.* keys to settings.yaml + code defaults (TERM-04)`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Document terminology.* in docs/Konfiguration.md (German) + README/BOM if needed</name>
  <files>docs/Konfiguration.md, README.md</files>
  <action>
    Per D-18:
    1. Open `docs/Konfiguration.md`. Identify the existing section pattern (likely `## <key>` per top-level config key with a "minimal" default-behavior note and a "voll" full-override example). Mirror that pattern.
    2. Add a `## Terminologie-Server (`terminology`)` section (or whichever heading level matches the file's existing top-level keys). Include:
       - One-paragraph intro: was der Resolver tut (3-Tier: Cache → Server-Proxy → eingebauter Seed; Standard offline / `enabled: false`).
       - `### terminology.enabled` — Standard `false`. Wenn `true`, leitet `POST /api/terminology/lookup` Anfragen an `terminology.serverUrl` weiter; wenn `false`, antwortet der Endpoint mit 503 und der Client fällt auf die eingebaute Seed-Map zurück.
       - `### terminology.serverUrl` — FHIR-Endpunkt mit `$lookup`-Unterstützung. Standardplatzhalter `https://r4.ontoserver.csiro.au/fhir` (öffentlicher Ontoserver, anonymer SNOMED-CT-Lookup). Produktiv durch nationalen oder institutionellen Server ersetzen.
       - `### terminology.cacheTtlMs` — Server-seitiger LRU-Cache (max 10 000 Einträge, prozesslokal). Standard `86400000` (24 h). Per-Lookup-Audit-Logging ist deaktiviert (D-15).
       - "Minimal vs voll"-Hinweis im selben Stil wie andere Schlüssel: weglassen → Code-Defaults (offline); überschreiben → eigener Server.
    3. Inspect `README.md` for any configuration table that lists settings keys. If one exists and is the canonical entry point, append the three terminology keys with a one-line description each. If the README only points users to `docs/Konfiguration.md`, no README change is needed.
    4. Final safety net (D-24): `npm run test:ci && npm run build && npm run lint && npm run knip`.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run lint &amp;&amp; npm run knip</automated>
  </verify>
  <done>
    `docs/Konfiguration.md` has a German `terminology` section matching the file's existing pattern. README updated only if a config-key table exists there. Final safety net green. Atomic commit: `docs(25-04): document terminology.* config keys (TERM-04)`.
  </done>
</task>

</tasks>

<verification>
- `config/settings.yaml` contains `terminology.enabled`, `terminology.serverUrl`, `terminology.cacheTtlMs` with the D-16 default values.
- Removing the entire `terminology:` block from `settings.yaml` and restarting the server still produces working behavior (offline, 503 from `/api/terminology/lookup`) — proves D-17 code defaults work.
- `docs/Konfiguration.md` has a German section documenting all three keys.
- All four success criteria from ROADMAP §Phase 25 are satisfied across plans 25-01 → 25-04 (TERM-01 module, TERM-02 caller migration + fhirLoader cleanup, TERM-03 server proxy, TERM-04 settings + docs, TERM-05 tests covering all three layers).
- Test:ci grew from 619 baseline to ≈ 622–624 final (Claude's call per CONTEXT discretion).
</verification>

<success_criteria>
- TERM-04 fully satisfied: settings keys present + documented; defaults preserve offline behavior.
- Phase 25 complete end-to-end: all 5 TERM-* requirements green across the 4 plans.
- Final safety net green at phase close.
- A user upgrading from v1.9.3 with their existing `settings.yaml` (no `terminology:` block) sees zero behavior change — terminology resolver is dormant until they opt in.
</success_criteria>

<output>
After completion, create `.planning/phases/25-terminology-resolver/25-04-SUMMARY.md` per the standard summary template.
</output>
