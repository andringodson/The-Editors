import { expect, test } from "@playwright/test";

/**
 * CI runs with NEXT_PUBLIC_ADSENSE_CLIENT unset, which is the state most worth
 * pinning: with no publisher id, no third-party code may load and the strict
 * Content-Security-Policy must remain intact.
 */

test.describe("Advertising", () => {
  test("loads no ad code when unconfigured", async ({ page }) => {
    const thirdParty: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (/googlesyndication|doubleclick|googleadservices/.test(url)) {
        thirdParty.push(url);
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(thirdParty).toEqual([]);
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  });

  test("keeps the strict CSP while ads are off", async ({ request }) => {
    const response = await request.get("/");
    const csp = response.headers()["content-security-policy"];

    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("googlesyndication");

    // Nothing may be framed at all until ad units need it.
    expect(csp).toContain("frame-src 'none'");

    // The claim the whole product rests on: files cannot be sent anywhere.
    expect(csp).toContain("connect-src 'self'");
  });

  test("serves ads.txt from the site root", async ({ request }) => {
    // Without this at the root, most programmatic demand refuses to bid.
    const response = await request.get("/ads.txt");
    expect(response.ok()).toBe(true);
  });
});

test.describe("Privacy disclosure", () => {
  test("separates the file claim from the tracking claim", async ({ page }) => {
    await page.goto("/privacy");

    await expect(
      page.getByRole("heading", { name: "Privacy & ads" }),
    ).toBeVisible();

    // The honest version of the pitch: files are private, ads still profile you.
    await expect(page.getByText(/never uploaded, never stored/i)).toBeVisible();
    await expect(page.getByText(/non-personalised by default/i)).toBeVisible();

    // Office→PDF is the one exception and must be called out, not buried.
    await expect(page.getByText(/Office→PDF is the exception/)).toBeVisible();
  });

  test("is reachable from the footer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Privacy & ads/ }).click();
    await expect(page).toHaveURL(/\/privacy$/);
  });
});

test.describe("No paid tiers", () => {
  test("pricing is gone", async ({ request }) => {
    const response = await request.get("/pricing");
    expect(response.status()).toBe(404);
  });

  test("checkout endpoints are gone", async ({ request }) => {
    for (const path of ["/api/checkout", "/api/stripe/webhook"]) {
      const response = await request.post(path);
      expect(response.status()).toBe(404);
    }
  });
});
