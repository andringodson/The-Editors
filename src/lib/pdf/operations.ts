/**
 * PDF operations, all executed in the browser via pdf-lib.
 *
 * pdf-lib parses and writes PDFs in pure JavaScript, so merging a stack of
 * documents costs us nothing in server time and the files never leave the
 * user's machine. The ceiling is memory: everything is held as bytes, so very
 * large merges are bounded by the tab's heap rather than any upload limit.
 */

import { PDFDocument, degrees } from "pdf-lib";

export interface ProgressReporter {
  (fraction: number, label?: string): void;
}

async function readAsBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export async function getPageCount(file: Blob): Promise<number> {
  const doc = await PDFDocument.load(await readAsBytes(file), {
    // Encrypted files would otherwise throw before we can report a useful error.
    ignoreEncryption: true,
  });
  return doc.getPageCount();
}

/**
 * Concatenate PDFs in the given order.
 *
 * Pages are copied rather than referenced, so the output is self-contained and
 * does not degrade when the sources are discarded.
 */
export async function mergePdfs(
  files: Blob[],
  onProgress?: ProgressReporter,
): Promise<Blob> {
  if (files.length === 0) throw new Error("Select at least one PDF to merge");

  const merged = await PDFDocument.create();

  for (const [index, file] of files.entries()) {
    const source = await PDFDocument.load(await readAsBytes(file), {
      ignoreEncryption: true,
    });
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
    onProgress?.(
      (index + 1) / files.length,
      `Merged ${index + 1} of ${files.length}`,
    );
  }

  merged.setProducer("The Editors");
  merged.setCreationDate(new Date());

  const bytes = await merged.save();
  return new Blob([bytes as BufferSource], { type: "application/pdf" });
}

export interface SplitRange {
  /** 1-based, inclusive. */
  from: number;
  to: number;
}

/** Extract a page range into a new document. */
export async function extractPages(
  file: Blob,
  range: SplitRange,
): Promise<Blob> {
  const source = await PDFDocument.load(await readAsBytes(file), {
    ignoreEncryption: true,
  });

  const total = source.getPageCount();
  const from = Math.max(1, Math.min(range.from, total));
  const to = Math.max(from, Math.min(range.to, total));

  const output = await PDFDocument.create();
  const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
  const pages = await output.copyPages(source, indices);
  pages.forEach((page) => output.addPage(page));

  const bytes = await output.save();
  return new Blob([bytes as BufferSource], { type: "application/pdf" });
}

/**
 * Build a document from an explicit list of 1-based page numbers.
 *
 * Where `extractPages` takes one contiguous range, this takes whatever the
 * range parser produced — so "1-3, 7, 9-12" is one call, and the pages come out
 * in the order asked for rather than in document order.
 */
export async function selectPages(file: Blob, pages: number[]): Promise<Blob> {
  const source = await PDFDocument.load(await readAsBytes(file), {
    ignoreEncryption: true,
  });

  const total = source.getPageCount();
  const indices = pages
    .filter((page) => page >= 1 && page <= total)
    .map((page) => page - 1);

  if (indices.length === 0) {
    throw new Error("None of those pages exist in this document.");
  }

  const output = await PDFDocument.create();
  // copyPages is given every index at once so the source is parsed once rather
  // than once per page — the difference is minutes on a large document.
  const copied = await output.copyPages(source, indices);
  copied.forEach((page) => output.addPage(page));

  const bytes = await output.save();
  return new Blob([bytes as BufferSource], { type: "application/pdf" });
}

export async function rotatePdf(file: Blob, angle: number): Promise<Blob> {
  const doc = await PDFDocument.load(await readAsBytes(file), {
    ignoreEncryption: true,
  });
  doc.getPages().forEach((page) => {
    page.setRotation(degrees((page.getRotation().angle + angle) % 360));
  });
  const bytes = await doc.save();
  return new Blob([bytes as BufferSource], { type: "application/pdf" });
}

/** ISO 216 A4 at 72 dpi, the unit pdf-lib works in. */
const A4 = { width: 595.28, height: 841.89 };

export interface ImagesToPdfOptions {
  /** Fit each image to a full A4 page, or size the page to the image. */
  pageSize?: "a4" | "fit";
  marginPt?: number;
}

/**
 * Build a PDF from images — the reverse of "PDF to images", and the usual way
 * people assemble scanned documents from phone photos.
 *
 * Only JPEG and PNG are embeddable by pdf-lib. Anything else is transcoded to
 * JPEG on a canvas first.
 */
export async function imagesToPdf(
  files: Blob[],
  options: ImagesToPdfOptions = {},
  onProgress?: ProgressReporter,
): Promise<Blob> {
  if (files.length === 0) throw new Error("Select at least one image");

  const { pageSize = "a4", marginPt = 24 } = options;
  const doc = await PDFDocument.create();

  for (const [index, file] of files.entries()) {
    const { bytes, type } = await toEmbeddableImage(file);
    const image =
      type === "image/png"
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);

    if (pageSize === "fit") {
      const page = doc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    } else {
      const page = doc.addPage([A4.width, A4.height]);
      const maxWidth = A4.width - marginPt * 2;
      const maxHeight = A4.height - marginPt * 2;
      const scale = Math.min(
        maxWidth / image.width,
        maxHeight / image.height,
        1,
      );
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, {
        x: (A4.width - width) / 2,
        y: (A4.height - height) / 2,
        width,
        height,
      });
    }

    onProgress?.(
      (index + 1) / files.length,
      `Added ${index + 1} of ${files.length}`,
    );
  }

  doc.setProducer("The Editors");
  doc.setCreationDate(new Date());

  const bytes = await doc.save();
  return new Blob([bytes as BufferSource], { type: "application/pdf" });
}

/**
 * pdf-lib embeds JPEG and PNG only. WebP, AVIF and friends get a canvas
 * round-trip to JPEG so the caller can stay format-agnostic.
 */
async function toEmbeddableImage(
  file: Blob,
): Promise<{ bytes: Uint8Array; type: "image/png" | "image/jpeg" }> {
  if (file.type === "image/png" || file.type === "image/jpeg") {
    return { bytes: await readAsBytes(file), type: file.type };
  }

  const { decodeImage, renderBitmap } = await import("../image/canvas");
  const bitmap = await decodeImage(file);
  try {
    const jpeg = await renderBitmap(bitmap, {
      quality: 0.92,
      mimeType: "image/jpeg",
    });
    return { bytes: await readAsBytes(jpeg), type: "image/jpeg" };
  } finally {
    bitmap.close();
  }
}
