import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";
import { makeTestImage } from "./fixtures";

const KB = 1024;

test.describe("Compress to a size", () => {
  test("produces a file under the requested target", async ({ page }) => {
    await page.goto("/tools/compress");

    const image = await makeTestImage(page);
    // If the fixture were small the target would be met trivially.
    expect(image.buffer.byteLength).toBeGreaterThan(200 * KB);

    await page.setInputFiles('input[type="file"]', image);
    await expect(page.getByText(image.name)).toBeVisible();

    await page.getByLabel("Target size").fill("100");
    await page.getByRole("button", { name: "Compress" }).click();

    // "Done" renders only when the search landed under budget; the miss case
    // renders "Closest possible" instead.
    await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({
      timeout: 60_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).click();
    const download = await downloadPromise;

    const path = await download.path();
    expect(path).toBeTruthy();

    // The claim under test: the bytes on disk are actually under the target.
    const bytes = statSync(path!).size;
    expect(bytes).toBeLessThanOrEqual(100 * KB);
    expect(bytes).toBeGreaterThan(0);
  });

  test("rejects a target larger than the original", async ({ page }) => {
    await page.goto("/tools/compress");

    const image = await makeTestImage(page, { width: 400, height: 300 });
    await page.setInputFiles('input[type="file"]', image);

    await page.getByLabel("Target size").fill("50");
    await page.getByLabel("Unit").selectOption("MB");
    await page.getByRole("button", { name: "Compress" }).click();

    await expect(page.getByText(/already larger than the original/i)).toBeVisible();
  });

  test("honours the WebP output format", async ({ page }) => {
    await page.goto("/tools/compress");

    const image = await makeTestImage(page);
    await page.setInputFiles('input[type="file"]', image);
    await page.getByLabel("Target size").fill("120");
    await page.getByLabel("Output format").selectOption("image/webp");
    await page.getByRole("button", { name: "Compress" }).click();

    await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({
      timeout: 60_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.webp$/);
    expect(statSync((await download.path())!).size).toBeLessThanOrEqual(120 * KB);
  });
});
