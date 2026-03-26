import { test, expect, type Page } from "@playwright/test";

async function loginAs(
  page: Page,
  email: string,
  password: string,
  callbackUrl = "/incae"
) {
  await page.goto(`/login?callbackUrl=${callbackUrl}`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`**${callbackUrl}`, { timeout: 15_000 });
}

test.describe("Authenticated user flows", () => {
  test("demo user can access My Events", async ({ page }) => {
    await loginAs(page, "demo@incae.edu", "demo123");

    // Should see "My Events" in sidebar (authenticated-only link)
    const myEventsLink = page.getByRole("link", { name: /My / });
    await expect(myEventsLink).toBeVisible();

    await myEventsLink.click();
    await expect(page).toHaveURL(/\/incae\/my-events/);
  });

  test("demo user can access AI Assistant", async ({ page }) => {
    await loginAs(page, "demo@incae.edu", "demo123");

    const chatLink = page.getByRole("link", { name: "AI Assistant" });
    await expect(chatLink).toBeVisible();

    await chatLink.click();
    await expect(page).toHaveURL(/\/incae\/chat/);
  });

  test("demo user does NOT see admin sections", async ({ page }) => {
    await loginAs(page, "demo@incae.edu", "demo123");

    // Regular user should NOT see Administration section in the desktop sidebar
    const desktopNav = page.locator('nav[aria-label="Main navigation"].lg\\:flex');
    await expect(desktopNav.getByText("Administration")).not.toBeVisible();
  });

  test("admin user sees full admin navigation", async ({ page }) => {
    await loginAs(page, "admin@scheduling.dev", "admin123");

    // Admin should see all admin links in the desktop sidebar
    const desktopNav = page.locator('nav[aria-label="Main navigation"].lg\\:flex');
    await expect(desktopNav.getByText("Administration")).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Users" })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Configurations" })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Reports" })).toBeVisible();
    await expect(desktopNav.getByRole("link", { name: "Import / Export" })).toBeVisible();
  });

  test("admin can navigate to admin dashboard", async ({ page }) => {
    await loginAs(page, "admin@scheduling.dev", "admin123");

    await page.getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/incae\/admin$/);
  });

  test("admin can navigate to users page", async ({ page }) => {
    await loginAs(page, "admin@scheduling.dev", "admin123");

    await page.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL(/\/incae\/admin\/users/);
  });

  test("admin can navigate to reports", async ({ page }) => {
    await loginAs(page, "admin@scheduling.dev", "admin123");

    await page.getByRole("link", { name: "Reports" }).click();
    await expect(page).toHaveURL(/\/incae\/admin\/reports/);
  });

  test("submit event form is accessible", async ({ page }) => {
    await loginAs(page, "demo@incae.edu", "demo123");

    await page.getByRole("link", { name: /Submit / }).click();
    await expect(page).toHaveURL(/\/incae\/submit-event/);

    // The form should have key fields
    await expect(page.getByText(/title/i)).toBeVisible({ timeout: 5_000 });
  });
});
