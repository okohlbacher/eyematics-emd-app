// UseAVibe Playwright fixtures (installed by the UseAVibe harness; build prompt §5.3, workflow plan §7.7).
// - loginAs(user): logs in through the login form with a seeded user (docs/Konfiguration.md → Standardbenutzer).
// - startTask(task): navigation helper to the start state of FB-P task A1…A5 — reused by the later AI-based tests.
// - The browser clock is pinned to USEAVIBE_REFERENCE_DATE (default below) with page.clock.setFixedTime; Date-dependent
//   values computed on the server (e.g. server/outcomesAggregateApi.ts age) still use the server clock.
// Synthetic data only. Persisted per-user state (saved searches, exclusions, flags) survives between tests on the
// local dev pair: tests create uniquely named objects and must not rely on a fresh /data volume.
import { expect, test as base } from '@playwright/test';

const PASSWORD = process.env.USEAVIBE_TEST_PASSWORD ?? 'changeme2025!';
const REFERENCE_DATE = process.env.USEAVIBE_REFERENCE_DATE ?? '2026-10-01T10:00:00+02:00';

type Task = 'A1' | 'A2' | 'A3' | 'A4' | 'A5';
// Start route per FB-P task. Participants use one account for all tasks — `klinikleitung` (widest non-admin
// permissions, all sites; no re-login during a session; decision O-11). Override with USEAVIBE_TASK_USERS='{"A1":…}'.
const TASK_USER = 'klinikleitung';
const TASKS: Record<Task, { route: string; user: string }> = {
  A1: { route: '/cohort', user: TASK_USER },      // Kohorte filtern und als „Testkohorte“ speichern
  A2: { route: '/analysis', user: TASK_USER },    // CRT-Verlauf der Kohorte vs. Grundgesamtheit
  A3: { route: '/cohort', user: TASK_USER },      // Patient*in aus der „Testkohorte“ auswählen, vergleichen
  A4: { route: '/quality', user: TASK_USER },     // Therapieunterbrecher in „Datenqualität“ ausschließen
  A5: { route: '/doc-quality', user: TASK_USER }, // Dokumentationsqualität des UKT (Rolle Klinikleitung)
};
const taskUsers: Partial<Record<Task, string>> = JSON.parse(process.env.USEAVIBE_TASK_USERS ?? '{}');

export const test = base.extend<{
  loginAs: (user: string) => Promise<void>;
  startTask: (task: Task) => Promise<void>;
}>({
  page: async ({ page, baseURL }, provide) => {
    if (!baseURL) throw new Error('PLAYWRIGHT_BASE_URL is not set — run `npm run test:acceptance` (container)');
    await page.clock.setFixedTime(new Date(REFERENCE_DATE));
    await provide(page);
  },
  loginAs: async ({ page }, provide) => {
    await provide(async (user) => {
      await page.goto('/login');
      await page.locator('form input[type="text"]').first().fill(user);
      await page.locator('form input[type="password"]').fill(PASSWORD);
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL((url) => !url.pathname.startsWith('/login'));
    });
  },
  startTask: async ({ page, loginAs }, provide) => {
    await provide(async (task) => {
      await loginAs(taskUsers[task] ?? TASKS[task].user);
      await page.goto(TASKS[task].route);
    });
  },
});

export { expect };
