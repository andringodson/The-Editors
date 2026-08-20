import { expect, test } from "@playwright/test";

/**
 * Scroll reveals and the tab bar.
 *
 * The reveal is a scroll-driven CSS animation with a `both` fill. That has one
 * genuinely bad failure mode — a timeline that never advances would hold every
 * section at `opacity: 0` forever — and it is invisible to every other test in
 * the suite, including the accessibility scan. So the assertion that matters
 * here is simply: everything ends up visible.
 */

test.describe("Reveal", () => {
  test("every cell is fully visible once scrolled to", async ({ page }) => {
    await page.goto("/");

    // Walk the whole page rather than jumping to the end, so each cell passes
    // through its own entry range the way a reader would take it.
    await page.evaluate(async () => {
      const step = window.innerHeight / 2;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    const faded = await page.evaluate(() =>
      [...document.querySelectorAll(".cells > *")]
        .map((el) => ({
          text: el.textContent?.slice(0, 30) ?? "",
          opacity: getComputedStyle(el).opacity,
        }))
        .filter((cell) => Number(cell.opacity) < 1),
    );

    expect(faded, "cells left invisible after scrolling past them").toEqual([]);
  });

  test("content above the fold is visible without scrolling", async ({
    page,
  }) => {
    await page.goto("/");

    // Nothing in the first screenful should be waiting on a scroll that may
    // never happen.
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll(".cells > *, .reveal")]
        .filter((el) => el.getBoundingClientRect().top < window.innerHeight)
        .map((el) => getComputedStyle(el).opacity)
        .filter((opacity) => Number(opacity) < 1),
    );

    expect(hidden).toEqual([]);
  });

  test("reduced motion never declares the animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const cell = page.locator(".cells > *").first();
    await expect(cell).toHaveCSS("opacity", "1");
    await expect(cell).toHaveCSS("animation-name", "none");
  });
});

test.describe("Tabs", () => {
  test("the current tool is marked in the nav", async ({ page }) => {
    await page.goto("/tools/crop");

    const current = page.locator(
      'nav[aria-label="Tools"] a[aria-current="page"]',
    );
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText("Crop");
  });

  test("the tab rule is drawn in that tool's colour", async ({ page }) => {
    await page.goto("/tools/compress");

    const colours = await page.evaluate(() =>
      [...document.querySelectorAll('nav[aria-label="Tools"] a')].map(
        (el) => getComputedStyle(el, "::after").backgroundColor,
      ),
    );

    // Four tools, four different hues — the nav agreeing with the landing grid
    // and with the page each tab leads to.
    expect(new Set(colours.slice(0, 4)).size).toBe(4);
  });

  test("no tab is marked current on a page that is not a tool", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await expect(
      page.locator('nav[aria-label="Tools"] a[aria-current="page"]'),
    ).toHaveCount(0);
  });
});
