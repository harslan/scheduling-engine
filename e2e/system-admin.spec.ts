import { test, expect, type Page } from "@playwright/test";

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`/login?callbackUrl=/admin`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin", { timeout: 15_000 });
}

test.describe("System Admin Panel", () => {
  test("unauthenticated users are redirected to login", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login/);
  });

  test("non-admin users are redirected away", async ({ page }) => {
    await page.goto("/login?callbackUrl=/admin");
    await page.fill('input[name="email"]', "demo@incae.edu");
    await page.fill('input[name="password"]', "demo123");
    await page.click('button[type="submit"]');

    // Should NOT end up at /admin — redirected to home
    await page.waitForTimeout(3000);
    await expect(page).not.toHaveURL(/\/admin$/);
  });

  test("system admin can access the admin panel", async ({ page }) => {
    await loginAs(page, "admin@scheduling.dev", "admin123");

    await expect(page.locator("h1")).toHaveText("Organizations");
    await expect(page.getByText("System Administration")).toBeVisible();
  });

  test("admin panel lists existing organizations", async ({ page }) => {
    await loginAs(page, "admin@scheduling.dev", "admin123");

    // Should show at least the INCAE org
    await expect(page.getByText("INCAE Classroom Booking")).toBeVisible();
    await expect(page.getByText("/incae")).toBeVisible();
  });

  test("create organization page loads", async ({ page }) => {
    await loginAs(page, "admin@scheduling.dev", "admin123");

    await page.getByRole("link", { name: "New Organization" }).click();
    await expect(page).toHaveURL(/\/admin\/create/);
    await expect(page.locator("h1")).toHaveText("New Organization");
  });

  test("create organization form validates input", async ({ page }) => {
    await page.goto("/login?callbackUrl=/admin/create");
    await page.fill('input[name="email"]', "admin@scheduling.dev");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/create", { timeout: 15_000 });

    // Try to create with duplicate slug
    await page.fill('input[name="name"]', "Test Org");
    await page.fill('input[name="shortName"]', "TEST");
    await page.fill('#slug', "incae");
    await page.fill('input[name="adminName"]', "Test Admin");
    await page.fill('input[name="adminEmail"]', "test@test.com");
    await page.fill('input[name="adminPassword"]', "test123");
    await page.click('button[type="submit"]');

    // Should show slug taken error
    await expect(page.getByText(/already taken/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
