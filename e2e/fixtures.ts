import type { Page } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

/**
 * Test fixtures are generated rather than committed as binaries.
 *
 * Images are produced by the browser under test, so the bytes are a genuine
 * encoder output rather than something that happens to be checked in.
 */

export interface GeneratedFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Render a detailed, noisy image and return it as JPEG bytes.
 *
 * The noise is deliberate: a flat colour would compress to a few hundred bytes
 * and every size assertion would pass trivially, testing nothing.
 */
export async function makeTestImage(
  page: Page,
  { width = 1600, height = 1200, name = "test-photo.jpg" } = {},
): Promise<GeneratedFile> {
  const dataUrl = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#1e3a8a");
      gradient.addColorStop(0.5, "#f59e0b");
      gradient.addColorStop(1, "#7f1d1d");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Deterministic pseudo-random speckle — high-frequency detail is what
      // makes a JPEG genuinely expensive to encode.
      let seed = 12345;
      const random = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };

      for (let i = 0; i < 40000; i++) {
        ctx.fillStyle = `rgba(${Math.floor(random() * 255)},${Math.floor(
          random() * 255,
        )},${Math.floor(random() * 255)},0.85)`;
        ctx.fillRect(random() * width, random() * height, 4, 4);
      }

      return canvas.toDataURL("image/jpeg", 0.98);
    },
    { width, height },
  );

  return {
    name,
    mimeType: "image/jpeg",
    buffer: Buffer.from(dataUrl.split(",")[1], "base64"),
  };
}

/** Build a small multi-page PDF in Node. */
export async function makeTestPdf(
  name: string,
  pageCount: number,
): Promise<GeneratedFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let index = 0; index < pageCount; index++) {
    const page = doc.addPage([300, 400]);
    page.drawText(`${name} — page ${index + 1}`, {
      x: 24,
      y: 350,
      size: 14,
      font,
    });
  }

  return {
    name: `${name}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(await doc.save()),
  };
}
