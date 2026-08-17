import { expect, test } from "@playwright/test";

test.describe("Installability", () => {
  test("serves a valid manifest linked from the page", async ({ page, request }) => {
    await page.goto("/");

    const href = await page
      .locator('link[rel="manifest"]')
      .getAttribute("href");
    expect(href).toBe("/manifest.webmanifest");

    const response = await request.get(href!);
    expect(response.ok()).toBe(true);

    const manifest = JSON.parse(await response.text());
    expect(manifest.name).toBe("The Editors");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");

    // A maskable icon is what stops Android cropping the mark into a circle
    // and clipping it.
    const purposes = manifest.icons.map(
      (icon: { purpose: string }) => icon.purpose,
    );
    expect(purposes).toContain("maskable");
  });

  test("serves the service worker from the origin root", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.ok()).toBe(true);

    // Scope is bounded by the path it is served from; anywhere but the root
    // would silently fail to control the tool pages.
    const body = await response.text();
    expect(body).toContain("addEventListener");
  });

  test("offline fallback lists the tools that work without a network", async ({
    page,
  }) => {
    await page.goto("/offline");

    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Compress to a size" }),
    ).toBeVisible();

    // The server-dependent tool must not be advertised as available offline.
    await expect(page.getByText(/Office to PDF is the exception/)).toBeVisible();
  });

  test("allows pinch-zoom", async ({ page }) => {
    await page.goto("/");
    const viewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");

    expect(viewport).not.toContain("user-scalable=no");
    expect(viewport).toContain("maximum-scale=5");
  });
});
