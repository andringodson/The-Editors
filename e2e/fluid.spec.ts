import { expect, test } from "@playwright/test";

/**
 * The section fluid effect.
 *
 * The interesting assertions here are about cost, not looks. This site's real
 * work is canvas and WASM image encoding, and a decorative layer that holds an
 * animation frame open would take exactly the budget the compressor needs. Two
 * of these tests exist to make that promise enforceable.
 */

async function countIdleFrames(
  page: import("@playwright/test").Page,
  ms: number,
) {
  return page.evaluate(
    (duration) =>
      new Promise<number>((resolve) => {
        let n = 0;
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => {
          n++;
          return raf(cb);
        };
        setTimeout(() => {
          window.requestAnimationFrame = raf;
          resolve(n);
        }, duration);
      }),
    ms,
  );
}

test.describe("Section fluid", () => {
  test("the pool follows the pointer through a section", async ({ page }) => {
    await page.goto("/");

    const section = page.locator("[data-fluid]").first();
    await section.scrollIntoViewIfNeeded();
    const box = (await section.boundingBox())!;

    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
    await page.waitForTimeout(500);
    const first = await section.evaluate((el) =>
      el.style.getPropertyValue("--fx"),
    );

    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, {
      steps: 12,
    });
    await page.waitForTimeout(700);
    const second = await section.evaluate((el) =>
      el.style.getPropertyValue("--fx"),
    );

    expect(first).not.toBe("");
    expect(second).not.toBe(first);
    expect(parseFloat(second)).toBeGreaterThan(parseFloat(first));
  });

  test("the loop stops once the pool catches up", async ({ page }) => {
    await page.goto("/");

    const section = page.locator("[data-fluid]").first();
    const box = (await section.boundingBox())!;

    // A short move on purpose. Both eased loops converge per frame, so the
    // distance travelled sets how many frames the test has to wait out — and a
    // test that idles for seconds starves the workers running beside it, which
    // is how this one first turned the compressor tests flaky.
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.move(
      box.x + box.width * 0.5 + 60,
      box.y + box.height * 0.5,
      {
        steps: 6,
      },
    );

    // Poll for quiet rather than hardcoding a settle time: "it stops" is the
    // invariant, not how long it takes.
    //
    // A permanent animation frame is the failure this guards against. It costs
    // nothing visible and everything measurable, on a page whose real work is
    // canvas and WASM encoding.
    let frames = -1;
    for (let attempt = 0; attempt < 20 && frames !== 0; attempt++) {
      frames = await countIdleFrames(page, 250);
    }

    expect(frames, "an animation frame is still held open").toBe(0);
  });

  test("reduced motion never starts it", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const section = page.locator("[data-fluid]").first();
    const box = (await section.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(600);

    // Neither the listener nor the paint.
    expect(
      await section.evaluate((el) => el.style.getPropertyValue("--fx")),
    ).toBe("");
    expect(
      await section.evaluate((el) => getComputedStyle(el, "::after").display),
    ).toBe("none");
  });

  test("the effect is scoped to the section under the pointer", async ({
    page,
  }) => {
    await page.goto("/");

    const sections = page.locator("[data-fluid]");
    expect(await sections.count()).toBeGreaterThan(1);

    const first = sections.nth(0);
    const second = sections.nth(1);
    await second.scrollIntoViewIfNeeded();
    const box = (await second.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(600);

    // Only the hovered one is lit; a shared glow would wash the whole page.
    expect(
      await second.evaluate((el) => el.style.getPropertyValue("--fx")),
    ).not.toBe("");
    expect(
      await first.evaluate((el) => getComputedStyle(el, "::after").opacity),
    ).toBe("0");
  });
});
