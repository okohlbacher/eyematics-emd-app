/**
 * J2 (v1.15-p4): progressive / non-blocking panel mount.
 *
 * Even after aggregation moves to the worker, building the three Recharts panels
 * (OD / OS / combined) synchronously in one render still janks the main thread —
 * the tester's "white cards then freeze". This hook mounts the panels ONE AT A
 * TIME: the first paints immediately, each subsequent one mounts on a later
 * macrotask (setTimeout 0), so the event loop yields between heavy Recharts builds
 * and the controls (layer toggles, Einstellungen drawer) stay responsive.
 *
 * Why setTimeout, not requestIdleCallback/rAF: rAF is throttled to ~0 Hz in a
 * backgrounded/hidden tab, which would stall the staged mount forever; rIC is not
 * universally available. A macrotask always fires (subject only to the clamped
 * minimum delay), matching the deferral pattern already used in OutcomesView.
 *
 * `active` gates staging: when false (small cohort, cross-mode, server path) all
 * `count` panels mount at once so there is no perceptible flash and tests that
 * assert all three panels are present pass without advancing timers.
 *
 * State design mirrors OutcomesView's deferred-render gate: the staged progress is
 * stored as { key, n } and readiness is DERIVED by comparing the stored key to the
 * current stageKey. A key change therefore instantly reverts to one mounted panel
 * WITHOUT a synchronous setState-in-effect (which would re-render the heavy subtree
 * twice and trips react-hooks/set-state-in-effect). The timer only ever advances n.
 */
import { useEffect, useState } from 'react';

export function useProgressivePanels(
  count: number,
  active: boolean,
  stageKey: string,
): number {
  // Staged progress for a specific key. `n` is the panel count mounted SO FAR for
  // `key`; when `key` !== the current stageKey the staged progress is stale and the
  // derived value falls back to 1 (re-arm) without writing state synchronously.
  const [staged, setStaged] = useState<{ key: string; n: number }>({ key: stageKey, n: 1 });

  // Derived mounted count: all at once when inactive; else the staged n for the
  // CURRENT key (stale key → start from one panel again).
  const mounted = !active ? count : staged.key === stageKey ? staged.n : 1;

  useEffect(() => {
    if (!active) return;
    if (mounted >= count) return;
    // Mount the next panel on a later macrotask, yielding the main thread so the
    // controls can process input between heavy Recharts builds. Setting state to a
    // key-stamped value here is a normal async update (not a synchronous in-effect
    // setState), so it re-renders once with the next panel.
    const timer = setTimeout(
      () => setStaged({ key: stageKey, n: Math.min(mounted + 1, count) }),
      0,
    );
    return () => clearTimeout(timer);
  }, [active, count, stageKey, mounted]);

  return mounted;
}
