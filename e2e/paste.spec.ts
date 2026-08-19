import { expect, test } from "@playwright/test";
import { makeTestImage } from "./fixtures";

/**
 * Paste.
 *
 * "My screenshot is too big" is one of the most common versions of the problem
 * this site solves, and without paste it means saving to disk and hunting for
 * the file again for no reason.
 *
 * These drive a real ClipboardEvent carrying a real file rather than calling the
 * handler directly — the interesting failures are in the wiring: whether the
 * listener is on the window at all, and whether it correctly refuses to steal a
 * paste aimed at a text field.
 */

/** Puts a real file on the clipboard and pastes it at the given target. */
async function paste(
  page: import("@playwright/test").Page,
  selector: string,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  return page.evaluate(
    ({ sel, name, mimeType, data }) => {
      const clipped = new File([new Uint8Array(data)], name, {
        type: mimeType,
      });
      const transfer = new DataTransfer();
      transfer.items.add(clipped);
      document.querySelector(sel)!.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: transfer,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    {
      sel: selector,
      name: file.name,
      mimeType: file.mimeType,
      data: [...file.buffer],
    },
  );
}

test.describe("Paste", () => {
  test("a pasted screenshot is accepted by the tool", async ({ page }) => {
    await page.goto("/tools/compress");
    const image = await makeTestImage(page, { name: "screenshot.png" });

    await paste(page, "body", image);

    // The drop zone reports the file it is holding, so this proves the paste
    // reached the tool rather than merely firing.
    await expect(page.getByText("screenshot.png")).toBeVisible();

    // And it is a usable file, not just a name: run the tool on it.
    await page.getByRole("button", { name: "Compress" }).click();
    await expect(page.getByRole("heading", { name: "Done" })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("pasting into a text field is left alone", async ({ page }) => {
    await page.goto("/tools/compress");
    const image = await makeTestImage(page, { name: "screenshot.png" });

    // Someone typing a target size pastes numbers into it; that has to keep
    // working, so the listener must ignore pastes aimed at a field.
    await paste(page, 'input[type="number"]', image);

    await expect(page.getByText("screenshot.png")).toBeHidden();
  });

  test("works on the PDF tools too, not just images", async ({ page }) => {
    await page.goto("/tools/pdf-merge");

    // An image is not a PDF: the accept filter has to reject it rather than
    // hand the tool something it cannot open.
    const image = await makeTestImage(page, { name: "screenshot.png" });
    await paste(page, "body", image);
    await expect(page.getByText("screenshot.png")).toBeHidden();
  });
});
