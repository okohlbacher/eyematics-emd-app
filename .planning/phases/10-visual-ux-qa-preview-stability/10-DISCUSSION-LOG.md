# Phase 10: Visual/UX QA & Preview Stability — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 10-visual-ux-qa-preview-stability
**Areas discussed:** Chart palette (explicit), Light-vs-dark mode scoping

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Chart palette | Which colors for median / per-patient / scatter / IQR (WCAG AA split) | ✓ |
| Empty state copy | Third variant wording + action link | Deferred to Claude |
| Tooltip detail | Content + suppression logic | Deferred to Claude |
| You decide | Claude picks sensible defaults for all visual details | ✓ |

**User's choice:** "Chart palette" + "You decide"
**Notes:** User wanted palette decision locked explicitly; accepted Claude discretion on tooltip + empty-state copy.

---

## Chart Palette

| Option | Description | Selected |
|--------|-------------|----------|
| Per-eye base + roles | Keep OD/OS/OD+OS color identity; derive series from opacity+weight | ✓ |
| Per-series semantic | Median / patient / scatter / IQR each have their own color; eye in panel header | |
| Hybrid | Per-eye for median+IQR; per-series for per-patient+scatter | |

**User's choice:** Per-eye base + roles
**Notes:** Preserves v1.5 visual identity; minimal diff from existing panel; captured as D-01 in CONTEXT.md.

---

## Dark Mode Scoping

| Option | Description | Selected |
|--------|-------------|----------|
| Light only | Skip dark mode tests in Phase 10; defer | ✓ |
| Both | Verify contrast in both modes | |

**User's choice:** Light only
**Notes:** Codebase scout confirmed no dark-mode infrastructure exists. Deviation from VQA-02 requirement text captured in Deferred Ideas of CONTEXT.md.

---

## Claude's Discretion

- Tooltip content format and layer-suppression logic (D-05, D-06)
- Empty-state copy for `all-eyes-filtered` variant (D-07, D-08)
- Admin filter snapshot test placement and assertions (D-09)
- Row-key composite format for OutcomesDataPreview (D-10, D-11)
- Exact HSL values for the three base colors (meets WCAG AA per D-02)

## Deferred Ideas

- Dark mode contrast verification (no infrastructure exists)
- Centralized design tokens beyond chart palette
- Image-snapshot visual regression harness
- OutcomesDataPreview virtual scrolling
