/**
 * File size guards.
 *
 * Because processing is client-side, the constraint is not our infrastructure
 * but the user's tab. Decoding a very large image allocates roughly
 * width × height × 4 bytes, and pdf-lib holds whole documents in memory — so
 * the failure mode without a guard is a silent tab crash, which reads as "your
 * site is broken" rather than "that file was too big".
 *
 * These ceilings are deliberately generous. They exist to convert a crash into
 * a clear message, not to ration usage.
 */

export const MAX_IMAGE_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_PDF_BYTES = 200 * 1024 * 1024; // 200 MB
export const MAX_BATCH_BYTES = 500 * 1024 * 1024; // combined, for multi-file tools
export const MAX_BATCH_FILES = 100;

/** Roughly 8000×8000 — beyond this, decode allocations get dangerous. */
export const MAX_IMAGE_PIXELS = 64_000_000;

export interface LimitFailure {
  message: string;
}

function describe(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function checkImageFile(file: File): LimitFailure | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      message: `That image is ${describe(file.size)}. The limit is ${describe(
        MAX_IMAGE_BYTES,
      )} — above that, decoding it would likely crash the tab.`,
    };
  }
  return null;
}

export function checkPdfFile(file: File): LimitFailure | null {
  if (file.size > MAX_PDF_BYTES) {
    return {
      message: `That PDF is ${describe(file.size)}. The limit is ${describe(
        MAX_PDF_BYTES,
      )}.`,
    };
  }
  return null;
}

export function checkBatch(files: File[]): LimitFailure | null {
  if (files.length > MAX_BATCH_FILES) {
    return { message: `That's ${files.length} files. The limit is ${MAX_BATCH_FILES}.` };
  }

  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_BATCH_BYTES) {
    return {
      message: `Those add up to ${describe(total)}. The combined limit is ${describe(
        MAX_BATCH_BYTES,
      )} — everything is held in memory at once.`,
    };
  }

  return null;
}

/** Checked after decode, when the real pixel count is known. */
export function checkDecodedSize(
  bitmap: { width: number; height: number },
): LimitFailure | null {
  const pixels = bitmap.width * bitmap.height;
  if (pixels > MAX_IMAGE_PIXELS) {
    return {
      message: `That image is ${bitmap.width}×${bitmap.height} (${(
        pixels / 1_000_000
      ).toFixed(0)} megapixels). The limit is ${MAX_IMAGE_PIXELS / 1_000_000} MP.`,
    };
  }
  return null;
}
