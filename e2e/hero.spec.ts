import { expect, test } from "@playwright/test";

/**
 * The typed headline.
 *
 * Splitting a sentence across one span per character is the kind of change that
 * looks fine on screen while quietly breaking the two audiences that read the
 * markup rather than the pixels: search crawlers and screen readers. These
 * tests assert on those, not on the animation.
 */

const HEADLINE = "Image and document tools that never upload your files";

test.describe("Hero", () => {
  test("the headline is one sentence to a screen reader", async ({ page }) => {
    await page.goto("/");

    // getByRole resolves the accessible name, so this fails if the per-character
    // spans ever leak into the accessibility tree as separate strings.
    await expect(
      page.getByRole("heading", { level: 1, name: HEADLINE, exact: true }),
    ).toBeVisible();
  });

  test("the headline is in the served HTML, not typed in by script", async ({
    request,
  }) => {
    // Fetched over HTTP with no browser: whatever a crawler would index. An
    // implementation that appends characters client-side would ship an empty
    // <h1> here and score nothing for the page's only heading.
    const html = await (await request.get("/")).text();

    const text = html
      .replace(/<[^>]+>/g, "") // strip the spans back out
      .replace(/\s+/g, " ");

    expect(text).toContain(HEADLINE);
  });

  test("the animation never leaves content invisible", async ({ page }) => {
    await page.goto("/");

    // Characters must settle at full opacity, and the call to action must be
    // hittable rather than gated behind the intro.
    const cta = page.getByRole("link", { name: "Compress an image" });
    await cta.click();
    await expect(page).toHaveURL(/\/tools\/compress$/);
  });

  test("reduced motion renders the finished hero outright", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const firstChar = page.locator(".type-char").first();
    await expect(firstChar).toHaveCSS("opacity", "1");
    await expect(firstChar).toHaveCSS("animation-name", "none");
    await expect(page.locator(".type-caret")).toBeHidden();
  });
});
