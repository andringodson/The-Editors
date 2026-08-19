import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { makeTestPdf } from "./fixtures";

/**
 * Split a PDF.
 *
 * The assertions load the produced file back with pdf-lib and count what came
 * out, rather than trusting the summary line. A tool that says "3 pages" and
 * emits the wrong three is the failure worth catching, and no amount of UI text
 * would reveal it.
 */

async function pageCount(path: string) {
  const doc = await PDFDocument.load(await readFile(path));
  return doc.getPageCount();
}

/**
 * The live summary under the fields — the one place that states what the button
 * will actually do. The drop-zone hint also reports a page count, so assertions
 * have to name this element rather than search the page for the number.
 */
function summary(page: import("@playwright/test").Page) {
  return page.locator("#pages-summary");
}

test.describe("Split a PDF", () => {
  test("keeps exactly the pages named", async ({ page }) => {
    await page.goto("/tools/pdf-split");

    const pdf = await makeTestPdf("report.pdf", 10);
    await page.setInputFiles('input[type="file"]', pdf);

    await expect(summary(page)).toHaveText(`This document has 10 pages.`);

    await page.getByLabel("Pages").fill("1-3, 7");
    // The summary is the contract the button honours, so assert on it too.
    await expect(summary(page)).toHaveText("Result: 4 pages — 1-3, 7");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Split and download" }).click();
    const path = (await (await download).path())!;

    expect(await pageCount(path)).toBe(4);
  });

  test("remove mode drops the pages named and keeps the rest", async ({
    page,
  }) => {
    await page.goto("/tools/pdf-split");

    const pdf = await makeTestPdf("report.pdf", 6);
    await page.setInputFiles('input[type="file"]', pdf);
    await expect(summary(page)).toHaveText(`This document has 6 pages.`);

    await page.getByLabel("Then").selectOption("remove");
    await page.getByLabel("Pages").fill("2, 4");
    await expect(summary(page)).toHaveText("Result: 4 pages — 1, 3, 5-6");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Split and download" }).click();
    const path = (await (await download).path())!;

    expect(await pageCount(path)).toBe(4);
  });

  test("explains a range it cannot honour instead of failing later", async ({
    page,
  }) => {
    await page.goto("/tools/pdf-split");

    const pdf = await makeTestPdf("report.pdf", 4);
    await page.setInputFiles('input[type="file"]', pdf);
    await expect(summary(page)).toHaveText(`This document has 4 pages.`);

    await page.getByLabel("Pages").fill("2-9");
    await expect(summary(page)).toHaveText(
      "This document has 4 pages, so 9 does not exist.",
    );

    // And the action is unavailable rather than failing on click.
    await expect(
      page.getByRole("button", { name: "Split and download" }),
    ).toBeDisabled();

    await page.getByLabel("Pages").fill("banana");
    await expect(summary(page)).toHaveText(
      `"banana" is not a page or a range.`,
    );
  });

  test("refuses to produce an empty document", async ({ page }) => {
    await page.goto("/tools/pdf-split");

    const pdf = await makeTestPdf("report.pdf", 3);
    await page.setInputFiles('input[type="file"]', pdf);
    await expect(summary(page)).toHaveText(`This document has 3 pages.`);

    await page.getByLabel("Then").selectOption("remove");
    await page.getByLabel("Pages").fill("1-3");

    await expect(summary(page)).toHaveText("That would remove every page.");
    await expect(
      page.getByRole("button", { name: "Split and download" }),
    ).toBeDisabled();
  });

  test("honours the order the pages were asked for", async ({ page }) => {
    await page.goto("/tools/pdf-split");

    const pdf = await makeTestPdf("report.pdf", 5);
    await page.setInputFiles('input[type="file"]', pdf);
    await expect(summary(page)).toHaveText(`This document has 5 pages.`);

    // Reordering falls out of the parser preserving input order. It is worth a
    // test because it is the kind of behaviour a later "tidy up" would sort
    // away without realising it was load-bearing.
    await page.getByLabel("Pages").fill("5, 1");
    await expect(summary(page)).toHaveText("Result: 2 pages — 5, 1");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Split and download" }).click();
    expect(await pageCount((await (await download).path())!)).toBe(2);
  });
});
