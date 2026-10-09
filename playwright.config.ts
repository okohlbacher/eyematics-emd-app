// UseAVibe acceptance tests (installed by the UseAVibe harness; build prompt §5.3).
// Target: PLAYWRIGHT_BASE_URL — set by scripts/useavibe/e2e-container.sh (`npm run test:acceptance`), which builds and
// runs the production container with a fresh /data volume, or by the operator for a published image. Chromium
// headless, fixed viewport, de-DE, Europe/Berlin;
// the browser clock is pinned per test in tests/acceptance/fixtures.ts — the server clock is not (documented there).
import { defineConfig, devices } from '@playwright/test';

// No throw here: tools such as knip load this file; the fixtures refuse to run without a target.
const baseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: 'tests',
  testMatch: ['acceptance/**/*.spec.ts', 'acceptance-at/**/*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    viewport: { width: 1440, height: 900 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
});
