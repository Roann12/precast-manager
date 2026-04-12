import { expect, test } from "@playwright/test";

test("home sends unauthenticated users to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("protected activity route redirects to login when logged out", async ({ page }) => {
  await page.goto("/activity");
  await expect(page).toHaveURL(/\/login$/);
});
