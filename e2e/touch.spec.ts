import { devices, expect, test } from "@playwright/test";
import { makeTestImage } from "./fixtures";

/**
 * Touch behaviour on a phone-sized viewport.
 *
 * The crop tool is the only place in the product with a bespoke gesture, and a
 * screenshot cannot prove a drag works — so these dispatch real PointerEvents
 * with pointerType "touch" rather than driving the mouse.
 */

test.use({ ...devices["Pixel 7"] });

test.describe("Touch", () => {
  test("crop selection responds to a touch drag", async ({ page }) => {
    await page.goto("/tools/crop");

    const image = await makeTestImage(page, { width: 800, height: 600 });
    await page.setInputFiles('input[type="file"]', image);

    const surface = page.getByTestId("crop-surface");
    await expect(surface).toBeVisible();

    const box = (await surface.boundingBox())!;

    await surface.evaluate(
      (element, c: { x1: number; y1: number; x2: number; y2: number }) => {
        const opts = (x: number, y: number): PointerEventInit => ({
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: x,
          clientY: y,
        });

        element.dispatchEvent(new PointerEvent("pointerdown", opts(c.x1, c.y1)));
        element.dispatchEvent(new PointerEvent("pointermove", opts(c.x2, c.y2)));
        element.dispatchEvent(new PointerEvent("pointerup", opts(c.x2, c.y2)));
      },
      {
        x1: box.x + 25,
        y1: box.y + 25,
        x2: box.x + box.width - 25,
        y2: box.y + box.height - 25,
      },
    );

    await expect(page.getByText(/Selection: \d+×\d+ px/)).toBeVisible();
  });

  test("primary actions meet the 44px touch target minimum", async ({ page }) => {
    await page.goto("/tools/compress");

    // Anything smaller is below the documented minimum for a reliable tap.
    for (const name of ["Compress"]) {
      const box = (await page.getByRole("button", { name }).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    const field = (await page.getByLabel("Target size").boundingBox())!;
    expect(field.height).toBeGreaterThanOrEqual(44);
  });

  test("the page never scrolls sideways", async ({ page }) => {
    // A horizontally scrolling body is the classic symptom of a desktop
    // metaphor forced onto a phone.
    for (const path of ["/", "/tools/crop", "/tools/pdf-merge", "/privacy"]) {
      await page.goto(path);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflows, `${path} scrolls horizontally`).toBe(false);
    }
  });
});
