// Harness smoke test (installed by the UseAVibe harness): the fixtures reach every FB-P task start page.
import { expect, test } from './fixtures';

for (const task of ['A1', 'A2', 'A3', 'A4', 'A5'] as const) {
  test(`[harness] task ${task} start page is reachable after login`, async ({ page, startTask }) => {
    await startTask(task);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main, #root').first()).toBeVisible();
  });
}
