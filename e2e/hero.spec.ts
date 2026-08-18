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

  test("the caret stays after the line is typed", async ({ page }) => {
    await page.goto("/");

    // Not a flourish that tidies itself away: the line reads as unfinished
    // without a prompt sitting at the end of it.
    const caret = page.locator(".type-caret--rest");
    await expect(caret).toHaveCSS("animation-iteration-count", "infinite");

    // Well past the point the typing has finished.
    await page.waitForTimeout(3500);
    await expect(caret).toBeAttached();
    await expect(caret).not.toHaveCSS("display", "none");
  });

  test("the caret never goes dark mid-sentence", async ({ page }) => {
    await page.goto("/");

    // Each character lights its caret for exactly the gap until the next one,
    // so the windows tile the whole typing run with no holes. A fixed-duration
    // caret would blink out during every between-word pause.
    const slots = await page.evaluate(() =>
      [...document.querySelectorAll(".type-char")].map((el) => ({
        at: parseFloat(getComputedStyle(el).animationDelay),
        lit: parseFloat(getComputedStyle(el, "::after").animationDuration),
      })),
    );

    expect(slots.length).toBeGreaterThan(20);
    for (let i = 1; i < slots.length; i++) {
      const endOfPrevious = slots[i - 1].at + slots[i - 1].lit;
      expect(
        endOfPrevious,
        `caret goes dark between character ${i - 1} and ${i}`,
      ).toBeGreaterThanOrEqual(slots[i].at - 0.001);
    }
  });

  test("the typing rhythm is uneven, and the same every render", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    // getComputedStyle reports seconds; the markup stamps milliseconds.
    const delays = await page.evaluate(() =>
      [...document.querySelectorAll(".type-char")].map((el) =>
        Math.round(parseFloat(getComputedStyle(el).animationDelay) * 1000),
      ),
    );

    // A fixed interval reads as a progress bar made of letters, not typing.
    const gaps = delays.slice(1).map((d, i) => d - delays[i]);
    expect(new Set(gaps).size).toBeGreaterThan(3);

    // The jitter is a hash of the stroke index, not Math.random — the server
    // must produce identical markup every time it renders.
    const html = await (await request.get("/")).text();
    const stamped = [...html.matchAll(/animation-delay:\s*([\d.]+)ms/g)].map(
      (m) => parseFloat(m[1]),
    );
    for (const delay of delays) {
      expect(stamped).toContain(delay);
    }
  });

  test("reduced motion renders the finished hero outright", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const firstChar = page.locator(".type-char").first();
    await expect(firstChar).toHaveCSS("opacity", "1");
    await expect(firstChar).toHaveCSS("animation-name", "none");

    for (const caret of await page.locator(".type-caret").all()) {
      await expect(caret).toHaveCSS("display", "none");
    }
  });
});
