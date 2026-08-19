import { expect, test } from "@playwright/test";

/**
 * Search presence.
 *
 * This matters more here than on a typical site: the product is ad-funded, so
 * organic search is the entire revenue channel. A duplicate-title regression
 * would be invisible in the UI and quietly halve the site's reach.
 */

const TOOL_PATHS = [
  "/tools/compress",
  "/tools/passport",
  "/tools/crop",
  "/tools/upscale",
  "/tools/format",
  "/tools/pdf-merge",
  "/tools/pdf-split",
  "/tools/images-to-pdf",
  "/tools/office-to-pdf",
];

test.describe("Search presence", () => {
  test("every tool page has a distinct title and description", async ({ page }) => {
    const titles = new Map<string, string>();

    for (const path of TOOL_PATHS) {
      await page.goto(path);

      const title = await page.title();
      const description = await page
        .locator('meta[name="description"]')
        .getAttribute("content");

      expect(title, `${path} has no title`).toBeTruthy();
      expect(description, `${path} has no description`).toBeTruthy();

      // The failure this guards against: every page inheriting the site
      // default, so they all compete with one another.
      const clash = [...titles.entries()].find(([, value]) => value === title);
      expect(clash, `${path} shares a title with ${clash?.[0]}`).toBeUndefined();

      titles.set(path, title);
    }

    expect(titles.size).toBe(TOOL_PATHS.length);
  });

  test("tool pages declare a canonical URL", async ({ page }) => {
    for (const path of TOOL_PATHS.slice(0, 3)) {
      await page.goto(path);
      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      expect(canonical, `${path} has no canonical`).toContain(path);
    }
  });

  test("robots.txt points at the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBe(true);

    const body = await response.text();
    expect(body).toContain("Sitemap:");
    // Machine endpoints and per-user pages waste crawl budget.
    expect(body).toContain("Disallow: /api/");
  });

  test("sitemap lists every tool", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);

    const body = await response.text();
    for (const path of TOOL_PATHS) {
      expect(body, `sitemap missing ${path}`).toContain(path);
    }
  });

  test("serves a social card", async ({ request }) => {
    const response = await request.get("/opengraph-image");
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");

    // A blank or failed render still returns 200, so check it has real bytes.
    expect((await response.body()).byteLength).toBeGreaterThan(10_000);
  });
});
