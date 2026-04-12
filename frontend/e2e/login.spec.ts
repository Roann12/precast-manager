import { expect, test } from "@playwright/test";

test("login page heading is visible", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
});
