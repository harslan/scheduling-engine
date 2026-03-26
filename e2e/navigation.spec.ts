import { test, expect } from "@playwright/test";

test.describe("Navigation & Pages", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toContainText("Manage every room");
    await expect(
      page.getByRole("link", { name: "Sign in", exact: true })
    ).toBeVisible();
  });

  test("org calendar page loads", async ({ page }) => {
    await page.goto("/incae");

    // Should show org name in header link
    await expect(
      page.getByRole("link", { name: "INCAE Classroom Booking" })
    ).toBeVisible({ timeout: 10_000 });
    // Should show the calendar nav
    await expect(page.getByRole("link", { name: "Calendar" })).toBeVisible();
  });

  test("help page loads", async ({ page }) => {
    await page.goto("/incae/help");

    await expect(page.locator("h1")).toHaveText("Help");
    await expect(
      page.getByRole("heading", { name: "Calendar Subscription" })
    ).toBeVisible();
  });

  test("rooms information page loads", async ({ page }) => {
    await page.goto("/incae/rooms");

    await expect(page).toHaveURL(/\/incae\/rooms/);
  });

  test("submit event page loads", async ({ page }) => {
    await page.goto("/incae/submit-event");

    await expect(page).toHaveURL(/\/incae\/submit-event/);
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.goto("/incae");

    // Click Help link
    await page.getByRole("link", { name: "Help" }).click();
    await expect(page).toHaveURL(/\/incae\/help/);

    // Click Calendar link to go back
    await page.getByRole("link", { name: "Calendar" }).first().click();
    await expect(page).toHaveURL(/\/incae$/);
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");

    // Check for the reset password heading or form
    await expect(page.locator("h1")).toBeVisible({ timeout: 10_000 });
  });

  test("404 page for invalid org", async ({ page }) => {
    const response = await page.goto("/nonexistent-org-slug-xyz");

    expect(response?.status()).toBe(404);
  });
});
