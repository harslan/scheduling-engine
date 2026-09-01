import { test, expect, type Page, type Browser } from "@playwright/test";

/**
 * The fifteen-minute pilot walkthrough, as a regression guard.
 *
 * Drives the exact demo path shown to the Dean: Dean sets dials → runs the
 * allocation (SIMULATION) → sees the result and insights; then a faculty
 * member declares and sees their office reveal with clause-numbered reasons
 * and the swap-by-consent panel. It asserts the *mechanism* (every screen
 * renders, the run produces a result, the reveal traces its reasons), not the
 * registrar-specific 61/60 number — that dataset is personnel-adjacent and
 * never committed, so this stays reproducible from the `sawyer` seed.
 *
 * The Dean runs the allocation FIRST on purpose: the reveal reads from a run's
 * assignments, so the run must exist before a faculty member can see an office.
 *
 * Prerequisites (local only):
 *   1. Seed the sawyer org into a local dev DB:
 *        npx tsx --env-file=.env prisma/seed-sawyer.ts
 *   2. Start the app:  npm run dev -- -p 3100
 *   3. Run:  BASE_URL=http://localhost:3100 npx playwright test e2e/pilot-walkthrough.spec.ts
 *
 * SAFETY: this test clicks "Run allocation", which writes a run. It refuses to
 * run against anything but a local server so it can never fire against the
 * pilot/production deployment.
 */

const BASE = process.env.BASE_URL || "";
const isLocal = /localhost|127\.0\.0\.1/.test(BASE);

const DEAN = { email: "dean@sawyer.demo", password: "sawyer2026" };
const FACULTY = { email: "mverhoeven@sawyer.demo", password: "sawyer2026" };

async function loginAs(page: Page, email: string, password: string) {
  await page.goto(`/login?callbackUrl=/sawyer`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Match on pathname, not a glob — "/login?callbackUrl=/sawyer" also ends in
  // "/sawyer", so a glob would resolve before the login round-trip completes.
  await page.waitForURL((url) => url.pathname === "/sawyer", { timeout: 20_000 });
}

async function go(page: Page, path: string) {
  // networkidle (not domcontentloaded): these are streamed RSC pages; wait for
  // the payload to fully apply before asserting, or fast admin-to-admin
  // navigations race the render and assertions miss intermittently.
  await page.goto(path, { waitUntil: "networkidle" });
}

test.describe("Pilot walkthrough (sawyer)", () => {
  test.skip(
    !isLocal,
    "Runs only against a local seeded server — set BASE_URL=http://localhost:3100"
  );

  test("end-to-end: Dean runs allocation, faculty sees the reveal", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    // ---- Dean: dials → run → result → insights ----
    const deanCtx = await browser.newContext();
    const dean = await deanCtx.newPage();
    await loginAs(dean, DEAN.email, DEAN.password);

    // Run the allocation first (the reveal depends on a run existing)
    await go(dean, `/sawyer/admin/space`);
    await dean.getByRole("button", { name: /Run allocation/i }).click();
    await expect(dean.getByText(/Latest run/i)).toBeVisible({ timeout: 20_000 });
    await expect(dean.getByText("SIMULATION").first()).toBeVisible();
    await expect(dean.getByText(/NEEDED/i).first()).toBeVisible();
    // Either it fits or it names the displaced — both are valid, neither is an error
    await expect(
      dean.getByText(/Fits with|Over capacity by/i).first()
    ).toBeVisible();

    // The charter dials, in DRAFT (every run is a simulation until ratified)
    await go(dean, `/sawyer/admin/space/charter`);
    await expect(
      dean.getByRole("heading", { name: /The charter/i })
    ).toBeVisible();
    await expect(dean.getByText(/every run is a simulation/i)).toBeVisible();
    await expect(dean.getByText(/Reason for this change/i)).toBeVisible();

    // Insights: the by-day picture the brief promises
    await go(dean, `/sawyer/admin/space/insights`);
    await expect(
      dean.getByRole("heading", { name: /Space insights/i })
    ).toBeVisible();
    await expect(
      dean.getByRole("heading", { name: /Faculty on campus, by day/i })
    ).toBeVisible();

    await deanCtx.close();

    // ---- Faculty: declare → office reveal with reasons → swap panel ----
    const facCtx = await browser.newContext();
    const fac = await facCtx.newPage();
    await loginAs(fac, FACULTY.email, FACULTY.password);

    await go(fac, `/sawyer/declare`);
    await expect(fac).toHaveURL(/\/sawyer\/declare/);

    await go(fac, `/sawyer/my-space`);
    await expect(
      fac.getByRole("heading", { name: /My space/i }).first()
    ).toBeVisible();
    await expect(fac.getByText(/Office \d{3,4}/).first()).toBeVisible();
    // Clause traces (2.4 threshold, 6.1 standard-office guarantee)
    await expect(fac.getByText("2.4").first()).toBeVisible();
    await expect(fac.getByText("6.1").first()).toBeVisible();
    // The appeal door — nothing on the page is beyond appeal
    await expect(fac.getByText(/human review/i)).toBeVisible();
    // Swap by consent
    await expect(fac.getByText(/Swap by consent/i)).toBeVisible();
    await expect(
      fac.getByRole("button", { name: /Propose swap/i })
    ).toBeVisible();

    await facCtx.close();
  });
});
