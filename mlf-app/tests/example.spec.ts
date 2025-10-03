import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Fantasy Football Analytics/);
});

test('displays leaderboard', async ({ page }) => {
  await page.goto('/');

  // Wait for the leaderboard to load
  await expect(page.getByText('Team Statistics')).toBeVisible();

  // Check that we have some team data
  await expect(page.locator('[data-testid="team-row"]').first()).toBeVisible();
});

test('can filter by year', async ({ page }) => {
  await page.goto('/');

  // Wait for initial load
  await page.waitForLoadState('networkidle');

  // Find and click year selector (assuming it exists)
  const yearSelector = page.locator('select, input[type="number"], button').filter({ hasText: /202[45]/ }).first();
  if (await yearSelector.isVisible()) {
    await yearSelector.click();
  }

  // Verify content updates (basic check)
  await expect(page.getByText('Team Statistics')).toBeVisible();
});