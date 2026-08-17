import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";
import { makeTestImage } from "./fixtures";

const KB = 1024;

test.describe("Passport & stamp photos", () => {
  test("derives the correct pixel size from millimetres and DPI", async ({
    page,
  }) => {
    await page.goto("/tools/passport");

    // India passport is 35×45 mm. At 300 DPI that is 413×531 px.
    await expect(page.getByText("413×531")).toBeVisible();

    await page.getByLabel("Resolution").selectOption("600");
    await expect(page.getByText("827×1063")).toBeVisible();
  });

  test("generates a photo at the preset's exact dimensions", async ({ page }) => {
    await page.goto("/tools/passport");

    const image = await makeTestImage(page);
    await page.setInputFiles('input[type="file"]', image);

    await page.getByRole("button", { name: "Generate photo" }).click();
    await expect(page.getByRole("heading", { name: /Passport — India/ })).toBeVisible({
      timeout: 60_000,
    });

    // Verify the rendered result really is 413×531 by measuring the <img>.
    const dimensions = await page
      .getByAltText(/result/i)
      .evaluate((element) => {
        const img = element as HTMLImageElement;
        return { width: img.naturalWidth, height: img.naturalHeight };
      });

    expect(dimensions).toEqual({ width: 413, height: 531 });
  });

  test("keeps the file under a portal upload limit when asked", async ({
    page,
  }) => {
    await page.goto("/tools/passport");

    const image = await makeTestImage(page);
    await page.setInputFiles('input[type="file"]', image);

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Generate photo" }).click();
    await expect(page.getByRole("heading", { name: /Passport — India/ })).toBeVisible({
      timeout: 60_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).click();
    const download = await downloadPromise;

    expect(statSync((await download.path())!).size).toBeLessThanOrEqual(20 * KB);
  });
});
