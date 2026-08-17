import { expect, test } from "@playwright/test";
import { makeTestPdf } from "./fixtures";

test.describe("Pricing", () => {
  test("shows both plans and commits to the free tier staying free", async ({
    page,
  }) => {
    await page.goto("/pricing");

    await expect(
      page.getByRole("heading", { name: /The tools stay free/i }),
    ).toBeVisible();

    // `exact` matters: the h1 contains the word "free", and the default
    // substring match would collide with the plan heading.
    await expect(
      page.getByRole("heading", { name: "Free", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Pro", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("$4.00")).toBeVisible();
  });

  test("says checkout is unavailable when Stripe is not configured", async ({
    page,
  }) => {
    // CI runs with no Stripe keys, which is the state worth pinning: the page
    // must explain itself rather than offering a button that cannot work.
    await page.goto("/pricing");
    await expect(page.getByText(/isn't connected to this deployment/i)).toBeVisible();
  });

  test("checkout endpoint refuses when unconfigured", async ({ request }) => {
    const response = await request.post("/api/checkout");
    expect([401, 503]).toContain(response.status());
  });

  test("webhook rejects an unsigned request", async ({ request }) => {
    // Without signature verification anyone could POST themselves onto Pro.
    const response = await request.post("/api/stripe/webhook", {
      data: { type: "checkout.session.completed" },
    });
    expect(response.ok()).toBe(false);
    expect([400, 503]).toContain(response.status());
  });

  test("is reachable from the header", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
  });
});

test.describe("Free plan batch cap", () => {
  test("keeps the files that fit instead of rejecting the whole drop", async ({
    page,
  }) => {
    await page.goto("/tools/pdf-merge");

    // Five files against a Free cap of three.
    const files = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => makeTestPdf(`doc-${n}`, 1)),
    );

    await page.setInputFiles('input[type="file"]', files);

    await expect(page.getByText(/Kept the first 3 of 5 files/)).toBeVisible();
    await expect(page.getByText("3 files · 3 pages")).toBeVisible({
      timeout: 30_000,
    });

    // The merge must still work with what was accepted.
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Merge and download" }).click();
    await downloadPromise;
  });
});
