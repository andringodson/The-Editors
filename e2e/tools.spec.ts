import { expect, test } from "@playwright/test";
import { readFileSync, statSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { makeTestImage } from "./fixtures";

/** PNG stores its dimensions in the IHDR chunk at a fixed offset. */
function pngDimensions(buffer: Buffer): { width: number; height: number } {
  expect(buffer.subarray(0, 8)).toEqual(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test.describe("Images to PDF", () => {
  test("creates one page per image", async ({ page }) => {
    await page.goto("/tools/images-to-pdf");

    const images = [
      await makeTestImage(page, { width: 600, height: 400, name: "one.jpg" }),
      await makeTestImage(page, { width: 600, height: 400, name: "two.jpg" }),
      await makeTestImage(page, { width: 600, height: 400, name: "three.jpg" }),
    ];

    await page.setInputFiles('input[type="file"]', images);
    await expect(page.getByRole("button", { name: /Create PDF \(3 pages\)/ })).toBeEnabled();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Create PDF/ }).click();
    const download = await downloadPromise;

    const doc = await PDFDocument.load(readFileSync((await download.path())!));
    expect(doc.getPageCount()).toBe(3);

    // A4 at 72 dpi is 595×842 pt.
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(595.28, 0);
    expect(height).toBeCloseTo(841.89, 0);
  });
});

test.describe("Change format", () => {
  test("really emits PNG bytes", async ({ page }) => {
    await page.goto("/tools/format");

    const image = await makeTestImage(page, { width: 500, height: 300 });
    await page.setInputFiles('input[type="file"]', image);
    await page.getByLabel("Convert to").selectOption("image/png");
    await page.getByRole("button", { name: "Convert" }).click();

    await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({
      timeout: 30_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.png$/);

    // Verified by magic bytes, not by the file extension we chose ourselves.
    const buffer = readFileSync((await download.path())!);
    expect(pngDimensions(buffer)).toEqual({ width: 500, height: 300 });
  });
});

test.describe("Upscale", () => {
  test("scales the longest edge to the chosen resolution", async ({ page }) => {
    await page.goto("/tools/upscale");

    const image = await makeTestImage(page, { width: 800, height: 600 });
    await page.setInputFiles('input[type="file"]', image);

    // 800 → 3840 is 4.8×, so 600 → 2880.
    await expect(page.getByText("3840×2880")).toBeVisible();

    await page.getByLabel("Output format").selectOption("image/png");
    await page.getByRole("button", { name: "Upscale" }).click();
    await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({
      timeout: 60_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).click();
    const download = await downloadPromise;

    const buffer = readFileSync((await download.path())!);
    expect(pngDimensions(buffer)).toEqual({ width: 3840, height: 2880 });
  });
});

test.describe("Office to PDF", () => {
  // CI runs without NEXT_PUBLIC_CONVERTER_URL, which is the case worth pinning:
  // a server-dependent tool must degrade to an explanation, never a broken
  // upload form or a crash.
  test("explains itself when the converter is not connected", async ({ page }) => {
    await page.goto("/tools/office-to-pdf");

    await expect(
      page.getByRole("heading", { name: "Office to PDF" }),
    ).toBeVisible();
    await expect(page.getByText(/not connected to this deployment/i)).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("is marked unavailable on the landing page", async ({ page }) => {
    await page.goto("/");

    const card = page.locator("li", { hasText: "Office to PDF" });
    await expect(card.getByText("Soon")).toBeVisible();
  });

  test("refuses to mint a token without a signing secret", async ({ request }) => {
    const response = await request.post("/api/convert-token");
    expect(response.status()).toBe(503);
  });
});

test.describe("Crop", () => {
  test("crops the dragged region", async ({ page }) => {
    await page.goto("/tools/crop");

    const image = await makeTestImage(page, { width: 1000, height: 800 });
    await page.setInputFiles('input[type="file"]', image);

    const surface = page.getByTestId("crop-surface");
    await expect(surface).toBeVisible();

    // page.mouse works in raw viewport coordinates and does no scrolling of its
    // own, so the surface has to be on screen before the box is measured.
    await surface.scrollIntoViewIfNeeded();
    const box = (await surface.boundingBox())!;

    // Drag a box across roughly the middle half of the image.
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.75, {
      steps: 10,
    });
    await page.mouse.up();

    await expect(page.getByText(/Selection: \d+×\d+ px/)).toBeVisible();

    await page.getByRole("button", { name: "Crop" }).click();
    await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({
      timeout: 30_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).click();
    const download = await downloadPromise;

    expect(statSync((await download.path())!).size).toBeGreaterThan(0);
  });

  test("locks the aspect ratio when a preset is chosen", async ({ page }) => {
    await page.goto("/tools/crop");

    const image = await makeTestImage(page, { width: 1000, height: 1000 });
    await page.setInputFiles('input[type="file"]', image);

    await page.getByRole("button", { name: "Square" }).click();

    const surface = page.getByTestId("crop-surface");
    const box = (await surface.boundingBox())!;

    // Drag a deliberately non-square gesture; the lock should square it up.
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + 320, box.y + 90, { steps: 10 });
    await page.mouse.up();

    const label = await page.getByText(/Selection: \d+×\d+ px/).innerText();
    const [, width, height] = label.match(/(\d+)×(\d+)/)!;
    expect(Number(width)).toBeCloseTo(Number(height), -1);
  });
});
