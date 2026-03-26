import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");

    await expect(page.locator("h1")).toHaveText("Sign in to your account");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText(/Sign in/);
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="email"]', "nobody@example.com");
    await page.fill('input[name="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(page.getByText("Invalid email or password")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("successful login as demo user", async ({ page }) => {
    await page.goto("/login?callbackUrl=/incae");

    await page.fill('input[name="email"]', "demo@incae.edu");
    await page.fill('input[name="password"]', "demo123");
    await page.click('button[type="submit"]');

    // Should redirect to the org page
    await page.waitForURL("**/incae", { timeout: 15_000 });

    // Should show user info in header (authenticated state)
    await expect(page.getByText("demo@incae.edu")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("successful login as admin user", async ({ page }) => {
    await page.goto("/login?callbackUrl=/incae");

    await page.fill('input[name="email"]', "admin@scheduling.dev");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');

    await page.waitForURL("**/incae", { timeout: 15_000 });

    // Admin should see the Administration section in the desktop sidebar
    const desktopNav = page.locator('nav[aria-label="Main navigation"].lg\\:flex');
    await expect(desktopNav.getByText("Administration")).toBeVisible({
      timeout: 5_000,
    });
    await expect(desktopNav.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("sign out works", async ({ page }) => {
    // First, sign in
    await page.goto("/login?callbackUrl=/incae");
    await page.fill('input[name="email"]', "demo@incae.edu");
    await page.fill('input[name="password"]', "demo123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/incae", { timeout: 15_000 });

    // Click sign out
    await page.getByRole("button", { name: /sign out/i }).click();

    // Should see the Sign In button (unauthenticated state)
    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("unauthenticated user sees Sign In button on org page", async ({
    page,
  }) => {
    await page.goto("/incae");

    await expect(page.getByRole("link", { name: "Sign In" })).toBeVisible();
    // Should NOT see authenticated-only items like "My Events"
    await expect(page.getByRole("link", { name: /My / })).not.toBeVisible();
  });

  test("password visibility toggle works", async ({ page }) => {
    await page.goto("/login");

    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click the show password button
    await page.getByLabel("Show password").click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click again to hide
    await page.getByLabel("Hide password").click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });
});
