---
plan: 36-01
phase: 36-architecture-review-compaction
status: complete
requirements: [ARCH-01, ARCH-02]
completed: 2026-05-24
key_files:
  created:
    - .planning/reviews/v1.11-arch-review/PROMPT.md
    - .planning/reviews/v1.11-arch-review/FINDINGS.md
    - .planning/reviews/v1.11-arch-review/COMPACTION-PLAN.md
    - .planning/reviews/v1.11-arch-review/codex.stdout.log
  modified: []
---

# 36-01 SUMMARY — Adversarial CODEX Review + Compaction Plan

## What was done
- Ran an adversarial full-codebase architecture review with the **CODEX CLI** (`codex exec --sandbox read-only`, codex-cli 0.128.0) over `server/`, `src/`, `shared/`, `scripts/`.
- Produced `FINDINGS.md` — a severity-classified report with **15 findings (F-01..F-15)** spanning SoC violations, duplicated logic, oversized modules, and dead code, each with file:line locations, recommendations, and fix-risk.
- Synthesized `COMPACTION-PLAN.md` — prioritized into Tier A (safe mechanical), Tier B (behavior-preserving de-dup), Tier C (higher-risk SoC/structural → defer), and folded in the local `knip`/`lint` baseline items.

## Findings overview
- **High:** F-01 (server aggregation ignores configured filter thresholds — latent correctness gap), F-02 (clinical thresholds outside settings.yaml).
- **Medium:** F-03 (unreachable Keycloak path), F-04..F-08 (duplicated filter/laterality/responder/interval/outcome logic), F-09 (authApi.ts 1,175-line God module), F-10 (OutcomesView 771 lines), F-13 (client-owned saved-search provenance).
- **Low:** F-11 (OutcomesDataPreview repetition), F-12 (ignored data-source params), F-14 (stale changelog script), F-15 (unused assets).

## Verification
- `codex exec` exited 0; FINDINGS.md (134 lines) + COMPACTION-PLAN.md written; product source unchanged (`git status` shows only `.planning/` additions).

## Self-Check: PASSED
ARCH-01 (CODEX findings report) and ARCH-02 (prioritized compaction plan with concrete file refs) satisfied. No product code modified in this read-only plan.
