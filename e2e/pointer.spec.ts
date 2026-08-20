import { expect, test } from "@playwright/test";

/**
 * The pointer layer — the section pool and the cursor.
 *
 * The interesting assertions here are about cost and about drift, not looks.
 * This site's real work is canvas and WASM image encoding, and a decorative
 * layer that holds an animation frame open would take exactly the budget the
 * compressor needs.
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

    // A short move on purpose. The easing converges per frame, so the distance
    // travelled sets how many frames the test has to wait out — and a test that
    // idles for seconds starves the workers running beside it, which is how
    // this one first turned the compressor tests flaky.
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.move(
      box.x + box.width * 0.5 + 60,
      box.y + box.height * 0.5,
      { steps: 6 },
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
  test("is a native cursor, drawn by the compositor", async ({ page }) => {
    await page.goto("/");

    const cursor = await page.evaluate(
      () => getComputedStyle(document.body).cursor,
    );

    // Not a pair of divs chasing the pointer: those cannot be zero-latency, and
    // on this site they stutter exactly when the encoder is busy.
    expect(cursor).toContain("data:image/svg+xml");
    expect(await page.locator(".cursor-dot, .cursor-ring").count()).toBe(0);

    // A keyword after the comma, so a data URI that ever fails to parse leaves
    // a working cursor rather than none.
    expect(cursor.trimEnd()).toMatch(/,\s*(auto|pointer|text)$/);
  });

  test("the art and the palette cannot drift apart", async ({ page }) => {
    await page.goto("/");

    // The hues are written twice — once as OKLCH tokens, once as hex inside the
    // cursor SVGs, because a data URI cannot read a custom property. This is
    // the guard that makes the duplication safe.
    const drift = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      const toHex = (css: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
      };

      const probe = document.createElement("div");
      document.body.append(probe);
      const bad: string[] = [];
      for (let i = 1; i <= 10; i++) {
        const n = String(i).padStart(2, "0");
        probe.className = `tint tint-${n}`;
        const style = getComputedStyle(probe);
        const accent = toHex(style.getPropertyValue("--accent").trim());
        if (!decodeURIComponent(style.cursor).includes(accent)) {
          bad.push(`tint-${n}: --accent is ${accent}, cursor art disagrees`);
        }
      }
      probe.remove();
      return bad;
    });

    expect(drift, drift.join("\n")).toEqual([]);
  });

  test("takes the hue of the tool it is on", async ({ page }) => {
    const rampOn = async (path: string) => {
      await page.goto(path);
      return page.evaluate(() =>
        decodeURIComponent(
          // `main .tint` on purpose: the nav tabs are tinted as well now, and
          // they are links, so they wear the interactive cursor rather than
          // the page one.
          getComputedStyle(document.querySelector("main .tint")!).cursor,
        ).match(/stop-color="(#[0-9a-fA-F]{6})"/g),
      );
    };

    const compress = await rampOn("/tools/compress");
    const crop = await rampOn("/tools/crop");

    // The marks carry a gradient from the tool hue into the next one round the
    // wheel, so the ramp itself is the identity, not a single stroke colour.
    expect(compress).toHaveLength(2);
    expect(crop).not.toEqual(compress);
  });

  test("closes in and lights up over anything actionable", async ({ page }) => {
    await page.goto("/");

    const art = (selector: string) =>
      page.evaluate(
        (sel) =>
          decodeURIComponent(
            getComputedStyle(document.querySelector(sel)!).cursor,
          ),
        selector,
      );

    const onLink = await art('a[href="/tools/compress"]');
    const onPage = await art("body");

    expect(onLink).not.toBe(onPage);
    // The tight geometry is the part that carries the signal, so it still reads
    // for anyone who cannot separate the hues.
    expect(onLink).toContain("M5 10V5h5");
    // And it ramps across the palette rather than the two-stop resting ramp.
    expect(onLink.match(/stop-color=/g)!.length).toBeGreaterThan(2);
  });

  test("shuts to a point while pressed", async ({ page }) => {
    await page.goto("/");

    const rule = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          if (
            rule.cssText.includes(":active") &&
            rule.cssText.includes("cursor")
          )
            return decodeURIComponent(rule.cssText);
        }
      }
      return null;
    });

    expect(rule, "no :active cursor rule found").toBeTruthy();
    expect(rule).toContain("M8 12V8h4");
  });

  test("text entry keeps the system caret", async ({ page }) => {
    await page.goto("/tools/compress");

    // The I-beam says something specific that crop marks do not.
    await expect(page.locator('input[type="number"]').first()).toHaveCSS(
      "cursor",
      "text",
    );
  });
});
