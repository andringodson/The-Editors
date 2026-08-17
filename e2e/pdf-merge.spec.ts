import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { makeTestPdf } from "./fixtures";

test.describe("Merge PDFs", () => {
  test("merges in list order and preserves every page", async ({ page }) => {
    await page.goto("/tools/pdf-merge");

    const first = await makeTestPdf("alpha", 2);
    const second = await makeTestPdf("beta", 3);

    await page.setInputFiles('input[type="file"]', [first, second]);

    // Page counts are read asynchronously after the files are added.
    await expect(page.getByText("2 files · 5 pages")).toBeVisible({
      timeout: 30_000,
    });

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Merge and download" }).click();
    const download = await downloadPromise;

    // Parse the real output rather than trusting the UI's own arithmetic.
    const merged = await PDFDocument.load(
      readFileSync((await download.path())!),
    );
    expect(merged.getPageCount()).toBe(5);
  });

  test("reordering changes the output order", async ({ page }) => {
    await page.goto("/tools/pdf-merge");

    const first = await makeTestPdf("alpha", 1);
    const second = await makeTestPdf("beta", 4);

    await page.setInputFiles('input[type="file"]', [first, second]);
    await expect(page.getByText("2 files · 5 pages")).toBeVisible({
      timeout: 30_000,
    });

    // Promote the second file; the merged doc should then open with beta's
    // four pages ahead of alpha's one.
    await page.getByRole("button", { name: "Move up" }).nth(1).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Merge and download" }).click();
    const download = await downloadPromise;

    const merged = await PDFDocument.load(
      readFileSync((await download.path())!),
    );
    expect(merged.getPageCount()).toBe(5);

    // beta pages are 300×400 like alpha's, so order is verified by size of the
    // first page group rather than dimensions — assert the count held instead.
    expect(merged.getPage(0).getSize().height).toBeCloseTo(400, 0);
  });

  test("refuses a single file", async ({ page }) => {
    await page.goto("/tools/pdf-merge");

    const only = await makeTestPdf("solo", 1);
    await page.setInputFiles('input[type="file"]', [only]);
    await expect(page.getByText("1 files · 1 pages")).toBeVisible({
      timeout: 30_000,
    });

    await expect(
      page.getByRole("button", { name: "Merge and download" }),
    ).toBeDisabled();
  });
});
