import { expect, test } from "@playwright/test";

/** Matches AuthUser + TokenResponse.user */
const adminUser = {
  id: 1,
  name: "E2E Admin",
  email: "e2e-admin@test.local",
  role: "admin",
  factory_id: 1,
  must_change_password: false,
};

function overviewWithQc() {
  return {
    today: "2026-04-12",
    todays_units: 0,
    todays_schedules: 0,
    todays_completed: 0,
    late_scheduled_items: 0,
    unscheduled_elements: 0,
    hollowcore_late_elements: 0,
    hollowcore_unscheduled_elements: 0,
    projects_at_risk: [],
    dispatch_orders_planned: 0,
    dispatch_orders_planned_with_items: 0,
    yard_inventory_lines: 0,
    hollowcore_planned_casts_today: 0,
    qc_lab_overdue: 2,
    qc_lab_due_today: 1,
    qc_lab_due_tomorrow: 0,
    qc_manual_results_pending: 3,
  };
}

test.describe("Dashboard overview (mocked API)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/token", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "e2e-test-token",
          token_type: "bearer",
          user: adminUser,
        }),
      });
    });

    await page.route("**/api/auth/me", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(adminUser),
      });
    });

    await page.route("**/api/dashboard/overview", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(overviewWithQc()),
      });
    });

    await page.route("**/api/dashboard/planned-by-type**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("sign-in loads dashboard and overview JSON includes QC metrics", async ({ page }) => {
    const overviewWait = page.waitForResponse(
      (r) => r.url().includes("/api/dashboard/overview") && r.request().method() === "GET" && r.ok()
    );

    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill("e2e-admin@test.local");
    await page.getByRole("textbox", { name: "Password" }).fill("not-used-mocked");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Precast Manager Dashboard" })).toBeVisible();

    const overviewRes = await overviewWait;
    const json = (await overviewRes.json()) as Record<string, unknown>;

    expect(typeof json.qc_lab_overdue).toBe("number");
    expect(typeof json.qc_lab_due_today).toBe("number");
    expect(typeof json.qc_lab_due_tomorrow).toBe("number");
    expect(typeof json.qc_manual_results_pending).toBe("number");

    expect(json.qc_lab_overdue).toBe(2);
    expect(json.qc_lab_due_today).toBe(1);
    expect(json.qc_lab_due_tomorrow).toBe(0);
    expect(json.qc_manual_results_pending).toBe(3);
  });

  test("admin sees QC next-step chips when counts are non-zero", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill("e2e-admin@test.local");
    await page.getByRole("textbox", { name: "Password" }).fill("not-used-mocked");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Next steps" })).toBeVisible();

    await expect(page.getByRole("link", { name: /QC lab: 2 overdue/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /QC lab: 1 due today/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /QC: 3 pending recorded tests/i })).toBeVisible();
  });
});
