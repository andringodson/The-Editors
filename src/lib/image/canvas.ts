/**
 * Canvas helpers shared by every image tool.
 *
 * Everything here runs in the browser — no image ever leaves the device.
 * OffscreenCanvas is used when available (it can encode off the main thread);
 * otherwise we fall back to a detached <canvas>.
 */

export type EncodeMime = "image/jpeg" | "image/webp" | "image/png";

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

/** Formats that carry an alpha channel. JPEG does not, so it needs a matte. */
const LOSSY_WITH_ALPHA: EncodeMime[] = ["image/webp", "image/png"];

export function createCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

export async function canvasToBlob(
  canvas: AnyCanvas,
  mimeType: EncodeMime,
  quality: number,
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error(`Failed to encode ${mimeType}`)),
      mimeType,
      quality,
    );
  });
}

export interface RenderOptions {
  /** Multiplier applied to the source dimensions. Ignored if width/height given. */
  scale?: number;
  /** Explicit output size. Overrides `scale`. */
  width?: number;
  height?: number;
  quality?: number;
  mimeType?: EncodeMime;
  /** Backdrop painted before the image, for formats without alpha. */
  background?: string;
}

/**
 * Draw a bitmap to a fresh canvas at the requested size and encode it.
 *
 * JPEG has no alpha channel, so transparent source pixels would otherwise
 * encode as black. We paint a matte first whenever the target lacks alpha.
 */
export async function renderBitmap(
  bitmap: ImageBitmap,
  options: RenderOptions = {},
): Promise<Blob> {
  const {
    scale = 1,
    quality = 0.9,
    mimeType = "image/jpeg",
    background = "#ffffff",
  } = options;

  const width = Math.max(1, Math.round(options.width ?? bitmap.width * scale));
  const height = Math.max(1, Math.round(options.height ?? bitmap.height * scale));

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;

  if (!ctx) throw new Error("Could not acquire a 2D drawing context");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (!LOSSY_WITH_ALPHA.includes(mimeType)) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvasToBlob(canvas, mimeType, quality);
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Crop a region out of the source, optionally rescaling it to a fixed output
 * size. Used by the crop tool and by the passport/stamp presets, which need
 * an exact pixel result rather than whatever the crop box happened to be.
 */
export async function cropBitmap(
  bitmap: ImageBitmap,
  rect: CropRect,
  options: RenderOptions = {},
): Promise<Blob> {
  const {
    quality = 0.92,
    mimeType = "image/jpeg",
    background = "#ffffff",
  } = options;

  const width = Math.max(1, Math.round(options.width ?? rect.width));
  const height = Math.max(1, Math.round(options.height ?? rect.height));

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;

  if (!ctx) throw new Error("Could not acquire a 2D drawing context");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (!LOSSY_WITH_ALPHA.includes(mimeType)) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(
    bitmap,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    width,
    height,
  );

  return canvasToBlob(canvas, mimeType, quality);
}

/**
 * Rotate by an arbitrary angle, expanding the canvas so no corner is clipped.
 * `degrees` is clockwise.
 */
export async function rotateBitmap(
  bitmap: ImageBitmap,
  degrees: number,
  options: RenderOptions = {},
): Promise<Blob> {
  const {
    quality = 0.92,
    mimeType = "image/jpeg",
    background = "#ffffff",
  } = options;

  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));

  const width = Math.round(bitmap.width * cos + bitmap.height * sin);
  const height = Math.round(bitmap.width * sin + bitmap.height * cos);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;

  if (!ctx) throw new Error("Could not acquire a 2D drawing context");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.translate(width / 2, height / 2);
  ctx.rotate(radians);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  return canvasToBlob(canvas, mimeType, quality);
}
