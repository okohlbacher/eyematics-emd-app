# Phase 1: Production Express Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 01-Production Express Backend
**Areas discussed:** Server entry point

---

## Server Entry Point

### Handler API Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap existing (Recommended) | Keep raw Node handlers shared between Vite dev + Express prod. Express calls them directly. Zero rewrite. | ✓ |
| Rewrite as Express | Convert to Express req.params, res.json(), etc. Cleaner Express but Vite needs separate wrappers. | |
| You decide | Claude picks most pragmatic approach. | |

**User's choice:** Wrap existing
**Notes:** None — recommended option accepted.

### Startup Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Env vars + settings.yaml | PORT, HOST from env vars. Data paths and FHIR URL from settings.yaml. | |
| CLI flags | node server.js --port 3000 --data-dir ./data | |
| Env vars only | Everything via environment variables. Docker-friendly. | |

**User's choice:** Custom — "I'd rather have everything in settings.yaml so settings are all in one place."
**Notes:** User wants a single configuration source. No env vars, no CLI flags. All config in settings.yaml.

### Logging

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal (Recommended) | Log startup info, API errors, FHIR proxy failures. No per-request logging. | ✓ (modified) |
| Morgan-style access log | Standard HTTP access log for all requests. | |
| You decide | Claude picks appropriate level. | |

**User's choice:** Minimal — with important caveat for Phase 2
**Notes:** "Minimal except for the audit log, which needs to be very detailed (every data new data access, every change to data/annotations on the case/patient level)." This expands the Phase 2 audit scope significantly.

### Data Directory

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-create + seed | Create data/ and seed users.json with defaults on first start. Zero manual setup. | ✓ |
| Auto-create only | Create data/ but don't seed. API handles missing files. | |
| Fail if missing | Require data/ to exist. Fail fast with clear error. | |

**User's choice:** Auto-create + seed
**Notes:** None — option accepted as-is.

---

## Claude's Discretion

- Build/deploy strategy: tsconfig.server.json config, npm script naming, output directory
- FHIR proxy implementation details (http-proxy-middleware config)
- Handler extraction pattern (how to export both Vite plugin and raw handlers)

## Deferred Ideas

- Audit log granularity (every data access, every annotation change) — Phase 2
