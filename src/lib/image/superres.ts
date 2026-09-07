/**
 * Neural super-resolution — the contract between the page and its worker.
 *
 * The model is Real-ESRGAN "general x4v3" (SRVGGNetCompact), the same network
 * Upscayl ships as its default. It was picked over the heavier alternatives on
 * measurement rather than reputation: on a 128 px tile it runs in ~0.2 s where
 * Real-ESRGAN x4plus takes ~3.7 s and Swin2SR ~5.1 s, for output that is barely
 * distinguishable at normal viewing sizes. A tool nobody waits for is a tool
 * nobody uses, and 4.9 MB of weights is a download people will actually accept.
 *
 * Both the weights and the ONNX runtime are served from this origin. That keeps
 * `connect-src 'self'` intact — the promise that no image leaves the device is
 * worth more than the few megabytes a CDN would have saved.
 */

/** Fixed by the exported graph: the model only accepts 128×128 input. */
export const TILE = 128;

/**
 * Context fed to each tile and then discarded from its output.
 *
 * A convolutional network has a receptive field, so pixels near a tile edge are
 * reconstructed from less information than pixels in the middle. Overlapping
 * the tiles and keeping only the middle means every pixel that survives was
 * predicted with full context — which is what makes the seams disappear rather
 * than merely become less obvious.
 */
export const TILE_PAD = 8;

/** The stride between tiles: the part of each one that is actually kept. */
export const TILE_CORE = TILE - TILE_PAD * 2;

/** The model's native factor. Any other size is resampled from this. */
export const MODEL_SCALE = 4;

export const MODEL_URL = "/models/realesrgan-x4v3.onnx";
export const MODEL_BYTES = 4_876_654;

/**
 * Ceiling on what may be fed to the model.
 *
 * Cost is linear in source pixels and this runs on someone's phone as often as
 * their laptop. Past this size the honest answer is that resampling is the
 * better tool — the AI pass would take minutes to enlarge something that was
 * already big enough.
 */
export const MAX_AI_PIXELS = 2_000_000;

export type SuperResDevice = "webgpu" | "wasm";

export function tileCount(width: number, height: number): number {
  return (
    Math.ceil(width / TILE_CORE) * Math.ceil(height / TILE_CORE)
  );
}

/**
 * Is WebGPU actually usable here, or only present as an object?
 *
 * Typed structurally rather than from `@webgpu/types`: this is the only WebGPU
 * call in the codebase, and one method signature is cheaper than a dependency
 * that would put the whole API in scope.
 */
export async function detectWebGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } })
    .gpu;
  if (!gpu) return false;
  try {
    return Boolean(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

export interface SuperResRequest {
  type: "run";
  file: Blob;
  /** Final output size, reached by resampling the model's 4× result. */
  targetWidth: number;
  targetHeight: number;
  mimeType: string;
  quality: number;
  device: SuperResDevice;
}

export type SuperResResponse =
  | { type: "stage"; stage: "loading-model" | "upscaling" | "encoding" }
  /** `elapsedMs` is measured in the worker so the page can stay a pure render. */
  | { type: "progress"; done: number; total: number; elapsedMs: number }
  | { type: "done"; blob: Blob; width: number; height: number; device: SuperResDevice }
  | { type: "error"; message: string };
