import { expect, test } from "@playwright/test";

/**
 * The pointer layer — the section pool and the drawn cursor.
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

test.describe("Cursor", () => {
  test("the native cursor is only hidden once the layer is running", async ({
    page,
  }) => {
    await page.goto("/");

    // The class is added by the component, not by the stylesheet. If the script
    // never runs the page keeps a working cursor instead of none at all — the
    // safe state has to be the one that survives the code not running.
    await expect(page.locator("html")).toHaveClass(/has-cursor/);

    const hiddenWithoutIt = await page.evaluate(() => {
      document.documentElement.classList.remove("has-cursor");
      const cursor = getComputedStyle(document.body).cursor;
      document.documentElement.classList.add("has-cursor");
      return cursor;
    });
    expect(hiddenWithoutIt).not.toBe("none");
  });

  test("the dot inverts against what is behind it", async ({ page }) => {
    await page.goto("/");

    // One element, both colours: difference blending over white renders white
    // on a dark ground and black on a light one, without anything having to
    // measure what is underneath.
    const dot = page.locator(".cursor-dot");
    await expect(dot).toHaveCSS("mix-blend-mode", "difference");
    await expect(dot).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });

  test("the ring takes the colour of the tool it is over", async ({ page }) => {
    await page.goto("/");

    const ring = page.locator(".cursor-ring");
    const colourOver = async (index: number) => {
      const cell = page.locator(".cells > *").nth(index);
      await cell.scrollIntoViewIfNeeded();
      const box = (await cell.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(450);
      return ring.evaluate((el) => getComputedStyle(el).borderTopColor);
    };

    const first = await colourOver(0);
    const second = await colourOver(2);

    expect(first).toBeTruthy();
    expect(second).not.toBe(first);
  });

  test("the ring opens over anything actionable", async ({ page }) => {
    await page.goto("/");

    const ring = page.locator(".cursor-ring");
    const heading = page.locator("h1");
    const headingBox = (await heading.boundingBox())!;
    await page.mouse.move(
      headingBox.x + 10,
      headingBox.y + headingBox.height / 2,
    );
    await page.waitForTimeout(300);
    const closed = await ring.evaluate((el) => getComputedStyle(el).inlineSize);

    const link = page.getByRole("link", { name: "Compress an image" });
    const linkBox = (await link.boundingBox())!;
    await page.mouse.move(
      linkBox.x + linkBox.width / 2,
      linkBox.y + linkBox.height / 2,
    );
    await page.waitForTimeout(300);
    const open = await ring.evaluate((el) => getComputedStyle(el).inlineSize);

    expect(parseFloat(open)).toBeGreaterThan(parseFloat(closed));
  });
});
