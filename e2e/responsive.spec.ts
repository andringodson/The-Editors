import { expect, test } from "@playwright/test";

/**
 * Fluid layout.
 *
 * The design is meant to interpolate rather than step: no width should exist at
 * which the page looks half-built. Spot-checking three "device" widths cannot
 * show that — a broken in-between width is exactly what a preset-based check
 * steps over. These tests sweep continuously instead.
 */

const PAGES = ["/", "/tools/compress", "/tools/pdf-merge", "/privacy"];

/** 320px is the narrowest viewport worth supporting; 1600 covers a desktop. */
const NARROW = 320;
const WIDE = 1600;
const STEP = 40;

test.describe("Fluid layout", () => {
  for (const path of PAGES) {
    test(`${path} never scrolls sideways, at any width`, async ({ page }) => {
      const offenders: string[] = [];

      for (let width = NARROW; width <= WIDE; width += STEP) {
        await page.setViewportSize({ width, height: 900 });
        if (width === NARROW) await page.goto(path);

        const overflow = await page.evaluate(() => {
          const root = document.documentElement;
          if (root.scrollWidth <= window.innerWidth + 1) return null;

          // Name the widest offender rather than just failing: "something
          // overflows" is a much worse bug report than "this element does".
          let worst = "";
          let worstWidth = 0;
          for (const el of document.querySelectorAll("*")) {
            const { width: w } = el.getBoundingClientRect();
            if (w > worstWidth) {
              worstWidth = w;
              worst = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 50)}`;
            }
          }
          return { scrollWidth: root.scrollWidth, worst };
        });

        if (overflow) {
          offenders.push(
            `${width}px → scrollWidth ${overflow.scrollWidth}, widest: ${overflow.worst}`,
          );
        }
      }

      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }

  test("type scales continuously, with no breakpoint cliffs", async ({
    page,
  }) => {
    await page.setViewportSize({ width: NARROW, height: 900 });
    await page.goto("/");

    const samples: { width: number; size: number }[] = [];
    for (let width = NARROW; width <= WIDE; width += STEP) {
      await page.setViewportSize({ width, height: 900 });
      const size = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.querySelector("h1")!).fontSize),
      );
      samples.push({ width, size });
    }

    // Never shrinks as the viewport grows.
    for (let i = 1; i < samples.length; i++) {
      expect(
        samples[i].size,
        `h1 shrank between ${samples[i - 1].width}px and ${samples[i].width}px`,
      ).toBeGreaterThanOrEqual(samples[i - 1].size - 0.01);
    }

    // And it genuinely scales rather than sitting at two fixed sizes.
    expect(new Set(samples.map((s) => s.size)).size).toBeGreaterThan(8);

    // A stepped design jumps at a breakpoint. With clamp() the largest single
    // step across 40px of viewport stays small — this is the assertion that
    // fails if someone reintroduces a media-query font size.
    const jumps = samples
      .slice(1)
      .map((s, i) => ({ at: s.width, delta: s.size - samples[i].size }));
    const worst = jumps.reduce((a, b) => (b.delta > a.delta ? b : a));
    expect(
      worst.delta,
      `h1 jumps ${worst.delta}px at ${worst.at}px`,
    ).toBeLessThan(3);
  });

  test("the tool grid reflows without leaving a cell too narrow to read", async ({
    page,
  }) => {
    await page.setViewportSize({ width: NARROW, height: 900 });
    await page.goto("/");

    for (let width = NARROW; width <= WIDE; width += STEP) {
      await page.setViewportSize({ width, height: 900 });

      const narrowest = await page.evaluate(() => {
        const cells = [...document.querySelectorAll(".cells > *")];
        return Math.min(...cells.map((c) => c.getBoundingClientRect().width));
      });

      // auto-fit drops a column rather than squeezing one below the track
      // minimum. Anything under ~200px means the overflow guard is missing.
      expect(
        narrowest,
        `a cell was ${narrowest}px wide at ${width}px`,
      ).toBeGreaterThan(200);
    }
  });

  test("body text keeps a readable measure on a wide screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: WIDE, height: 900 });
    await page.goto("/tools/compress");

    const width = await page.evaluate(() => {
      const p = document.querySelector(".prose");
      return p ? p.getBoundingClientRect().width : 0;
    });

    // Unbounded prose on a 1600px screen is a wall of text nobody reads.
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThan(820);
  });
});
