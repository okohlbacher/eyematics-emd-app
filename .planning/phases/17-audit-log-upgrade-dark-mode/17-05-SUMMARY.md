---
phase: 17-audit-log-upgrade-dark-mode
plan: 05
type: gap_closure
closes_gap: UAT Test 1 — Theme Toggle in Sidebar
completed: 2026-04-21
---

# Plan 17-05 Summary: Fix Class-Based Dark Mode

## What was done

Fixed Tailwind v4 dark mode not responding to the `.dark` class toggle.

**File changed:** `src/index.css` (1-line change)
- Before: `@custom-variant dark (&:where(.dark, .dark *));`
- After:  `@variant dark (&:where(.dark, .dark *));`

## Root cause

In Tailwind v4, `@custom-variant` creates an additional variant but does NOT override the built-in `dark` variant (which defaults to `@media (prefers-color-scheme: dark)`). Using `@variant dark` correctly overrides the built-in variant so `dark:*` utilities respond to the `.dark` class on `<html>` — which is what `ThemeContext` toggles.

## Verification

- `dark` class confirmed on `document.documentElement`
- Test element with `dark:bg-gray-900` computed to `oklch(0.21 0.034 264.665)` (gray-900) — confirming class-based resolution is active
- No console errors

## Gap closed

UAT Test 1 (severity: major): theme toggle now visibly applies dark backgrounds and light text across the dashboard.
