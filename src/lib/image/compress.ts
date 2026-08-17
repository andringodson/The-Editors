/**
 * Compress an image to land under a specific byte budget.
 *
 * This is the tool most competitors do badly: they expose a quality slider and
 * leave you guessing. Here the *size* is the input.
 *
 * There is no formula mapping quality to output bytes — it depends entirely on
 * image content — so we search. Quality is tried first because it preserves
 * dimensions; only when even the floor quality overshoots do we downscale, since
 * losing pixels is the more destructive move.
 */

import { decodeImage, renderBitmap, type EncodeMime } from "./canvas";

export interface CompressOptions {
  /** Hard ceiling for the output, in bytes. */
  targetBytes: number;
  /** JPEG usually wins on photos; WebP on flat art. */
  mimeType?: Extract<EncodeMime, "image/jpeg" | "image/webp">;
  /** Refuse to degrade past this. Below ~0.4 artefacts get ugly. */
  minQuality?: number;
  maxQuality?: number;
  /** Binary-search steps per scale. 7 lands within ~0.4% of optimal quality. */
  qualitySteps?: number;
  onProgress?: (fraction: number) => void;
}

export interface CompressResult {
  blob: Blob;
  /** Quality that produced `blob`. */
  quality: number;
  /** Dimension multiplier that produced `blob`. 1 means full size. */
  scale: number;
  width: number;
  height: number;
  originalBytes: number;
  /** True when we exhausted the search without getting under target. */
  missedTarget: boolean;
  attempts: number;
}

/** Progressively harsher fallbacks, only reached if quality alone can't do it. */
const SCALE_LADDER = [1, 0.85, 0.7, 0.55, 0.45, 0.35, 0.25, 0.15];

export async function compressToTarget(
  file: Blob,
  options: CompressOptions,
): Promise<CompressResult> {
  const {
    targetBytes,
    mimeType = "image/jpeg",
    minQuality = 0.4,
    maxQuality = 0.95,
    qualitySteps = 7,
    onProgress,
  } = options;

  if (targetBytes <= 0) {
    throw new Error("Target size must be greater than zero");
  }

  const bitmap = await decodeImage(file);
  let attempts = 0;

  // Best under-target candidate seen so far, and the smallest output overall —
  // the latter is our answer if the target turns out to be unreachable.
  let best: CompressResult | null = null;
  let smallest: CompressResult | null = null;

  const record = (blob: Blob, quality: number, scale: number): CompressResult => ({
    blob,
    quality,
    scale,
    width: Math.round(bitmap.width * scale),
    height: Math.round(bitmap.height * scale),
    originalBytes: file.size,
    missedTarget: blob.size > targetBytes,
    attempts,
  });

  try {
    for (const [index, scale] of SCALE_LADDER.entries()) {
      let low = minQuality;
      let high = maxQuality;
      let localBest: CompressResult | null = null;

      for (let step = 0; step < qualitySteps; step++) {
        const quality = (low + high) / 2;
        const blob = await renderBitmap(bitmap, { scale, quality, mimeType });
        attempts++;

        const candidate = record(blob, quality, scale);
        if (!smallest || blob.size < smallest.blob.size) smallest = candidate;

        if (blob.size <= targetBytes) {
          // Under budget — keep it and try to spend the remaining headroom.
          localBest = candidate;
          low = quality;
        } else {
          high = quality;
        }

        onProgress?.(
          (index + (step + 1) / qualitySteps) / SCALE_LADDER.length,
        );
      }

      if (localBest) {
        best = localBest;
        break; // Largest scale that fits wins; no reason to shrink further.
      }
    }
  } finally {
    bitmap.close();
  }

  onProgress?.(1);

  const result = best ?? smallest;
  if (!result) throw new Error("Compression produced no output");
  return { ...result, attempts };
}

const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(index === 0 ? 0 : decimals)} ${UNITS[index]}`;
}

export function parseTargetSize(value: number, unit: "KB" | "MB"): number {
  return Math.round(value * (unit === "MB" ? 1024 * 1024 : 1024));
}
