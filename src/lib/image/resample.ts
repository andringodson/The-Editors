/**
 * High-quality resizing, used by the fast path and to fit the AI result to the
 * requested resolution.
 *
 * `drawImage` resamples in one step no matter how far the sizes are apart. That
 * is fine when enlarging, but a browser reducing an image by more than half
 * samples too sparsely to see detail it is dropping, which is what turns fine
 * texture into aliased noise. Halving repeatedly keeps every source pixel
 * contributing to the result, and costs a few milliseconds.
 */

import { canvasToBlob, createCanvas, type EncodeMime } from "./canvas";

type Surface = OffscreenCanvas | HTMLCanvasElement;
type DrawSource = ImageBitmap | Surface;

function context2d(canvas: Surface) {
  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Could not acquire a 2D drawing context");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  return ctx;
}

function sizeOf(source: DrawSource): { width: number; height: number } {
  return { width: source.width, height: source.height };
}

/** Resize onto a fresh canvas, halving down in stages when reducing a lot. */
export function resample(
  source: DrawSource,
  width: number,
  height: number,
): Surface {
  let current: DrawSource = source;
  let { width: w, height: h } = sizeOf(source);

  while (w > width * 2 && h > height * 2) {
    w = Math.max(width, Math.round(w / 2));
    h = Math.max(height, Math.round(h / 2));
    const step = createCanvas(w, h);
    context2d(step).drawImage(current, 0, 0, w, h);
    current = step;
  }

  const canvas = createCanvas(width, height);
  context2d(canvas).drawImage(current, 0, 0, width, height);
  return canvas;
}

export interface EncodeOptions {
  width: number;
  height: number;
  mimeType: EncodeMime;
  quality?: number;
  /** Painted first for formats without an alpha channel. */
  background?: string;
}

export async function resampleToBlob(
  source: DrawSource,
  options: EncodeOptions,
): Promise<Blob> {
  const {
    width,
    height,
    mimeType,
    quality = 0.92,
    background = "#ffffff",
  } = options;

  const resized = resample(source, width, height);
  if (mimeType !== "image/jpeg") return canvasToBlob(resized, mimeType, quality);

  // JPEG has no alpha, so transparent pixels would encode as black. Compose
  // onto a matte rather than letting the encoder decide.
  const matted = createCanvas(width, height);
  const ctx = context2d(matted);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(resized, 0, 0);
  return canvasToBlob(matted, mimeType, quality);
}
