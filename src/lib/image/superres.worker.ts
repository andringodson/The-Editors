/// <reference lib="webworker" />

/**
 * The super-resolution pass, off the main thread.
 *
 * Inference blocks whatever thread it runs on for as long as it takes, and a
 * frozen tab reads as a crash. Everything here — decode, tiling, inference,
 * resize and encode — happens in the worker, so the page stays responsive
 * enough to report progress and to be cancelled.
 *
 * The session is kept between runs. Loading the graph costs about as much as
 * upscaling a small image, and a second attempt at a different size should not
 * pay it twice.
 */

// The default entry point is the JSEP build: WebGPU and WebAssembly in one
// binary. `onnxruntime-web/webgpu` would pull a different one — see
// scripts/sync-onnx-runtime.mjs.
import * as ort from "onnxruntime-web";
import { resampleToBlob } from "./resample";
import {
  MODEL_SCALE,
  MODEL_URL,
  TILE,
  TILE_CORE,
  TILE_PAD,
  tileCount,
  type SuperResDevice,
  type SuperResRequest,
  type SuperResResponse,
} from "./superres";

// Both served from this origin — see the note in superres.ts.
ort.env.wasm.wasmPaths = "/ort/";
// Threads need cross-origin isolation, which would break the ad frames. WebGPU
// is where the speed comes from anyway; this only keeps the fallback honest.
ort.env.wasm.numThreads = 1;

declare const self: DedicatedWorkerGlobalScope;

function post(message: SuperResResponse, transfer: Transferable[] = []) {
  self.postMessage(message, transfer);
}

let session: ort.InferenceSession | null = null;
let sessionDevice: SuperResDevice | null = null;

async function getSession(preferred: SuperResDevice) {
  if (session && sessionDevice === preferred) {
    return { session, device: sessionDevice };
  }

  post({ type: "stage", stage: "loading-model" });

  // An adapter can exist and still fail to compile the graph. Falling back to
  // wasm on that failure is the difference between a slow tool and a broken one.
  const order: SuperResDevice[] =
    preferred === "webgpu" ? ["webgpu", "wasm"] : ["wasm"];

  let lastError: unknown;
  for (const device of order) {
    try {
      session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: [device],
        graphOptimizationLevel: "all",
      });
      sessionDevice = device;
      return { session, device };
    } catch (cause) {
      lastError = cause;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not start the upscaling model");
}

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value;

/**
 * Read one padded tile out of the source as the NCHW float tensor the model
 * wants. Coordinates outside the image clamp to the nearest edge pixel, so a
 * tile at the border is padded with real colour instead of black — otherwise
 * the model reconstructs the border it was given and every edge gains a frame.
 */
function readTile(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  originX: number,
  originY: number,
): Float32Array {
  const plane = TILE * TILE;
  const tensor = new Float32Array(3 * plane);

  for (let y = 0; y < TILE; y++) {
    const sy = clamp(originY - TILE_PAD + y, 0, height - 1);
    for (let x = 0; x < TILE; x++) {
      const sx = clamp(originX - TILE_PAD + x, 0, width - 1);
      const source = (sy * width + sx) * 4;
      const target = y * TILE + x;
      tensor[target] = pixels[source] / 255;
      tensor[plane + target] = pixels[source + 1] / 255;
      tensor[2 * plane + target] = pixels[source + 2] / 255;
    }
  }

  return tensor;
}

/** Copy the unpadded middle of a model output into the assembled result. */
function writeTile(
  output: Float32Array,
  target: Uint8ClampedArray,
  targetWidth: number,
  targetHeight: number,
  originX: number,
  originY: number,
) {
  const span = TILE * MODEL_SCALE;
  const plane = span * span;
  const offset = TILE_PAD * MODEL_SCALE;
  const core = TILE_CORE * MODEL_SCALE;

  for (let y = 0; y < core; y++) {
    const dy = originY * MODEL_SCALE + y;
    if (dy >= targetHeight) break;
    for (let x = 0; x < core; x++) {
      const dx = originX * MODEL_SCALE + x;
      if (dx >= targetWidth) break;
      const source = (y + offset) * span + (x + offset);
      const destination = (dy * targetWidth + dx) * 4;
      // Uint8ClampedArray does the clamping; the model overshoots slightly.
      target[destination] = output[source] * 255;
      target[destination + 1] = output[plane + source] * 255;
      target[destination + 2] = output[2 * plane + source] * 255;
      target[destination + 3] = 255;
    }
  }
}

async function upscale(request: SuperResRequest) {
  const { session: model, device } = await getSession(request.device);
  const inputName = model.inputNames[0];
  const outputName = model.outputNames[0];

  const bitmap = await createImageBitmap(request.file);
  const { width, height } = bitmap;

  const surface = new OffscreenCanvas(width, height);
  const ctx = surface.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not acquire a 2D drawing context");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const pixels = ctx.getImageData(0, 0, width, height).data;

  const scaledWidth = width * MODEL_SCALE;
  const scaledHeight = height * MODEL_SCALE;
  const scaled = new Uint8ClampedArray(scaledWidth * scaledHeight * 4);

  post({ type: "stage", stage: "upscaling" });
  const total = tileCount(width, height);
  const startedAt = performance.now();
  let done = 0;

  for (let originY = 0; originY < height; originY += TILE_CORE) {
    for (let originX = 0; originX < width; originX += TILE_CORE) {
      const input = new ort.Tensor(
        "float32",
        readTile(pixels, width, height, originX, originY),
        [1, 3, TILE, TILE],
      );
      const result = await model.run({ [inputName]: input });
      writeTile(
        result[outputName].data as Float32Array,
        scaled,
        scaledWidth,
        scaledHeight,
        originX,
        originY,
      );
      post({
        type: "progress",
        done: ++done,
        total,
        elapsedMs: performance.now() - startedAt,
      });
    }
  }

  post({ type: "stage", stage: "encoding" });

  const assembled = new OffscreenCanvas(scaledWidth, scaledHeight);
  assembled
    .getContext("2d")!
    .putImageData(new ImageData(scaled, scaledWidth, scaledHeight), 0, 0);

  const blob = await resampleToBlob(assembled, {
    width: request.targetWidth,
    height: request.targetHeight,
    mimeType: request.mimeType as "image/jpeg" | "image/png" | "image/webp",
    quality: request.quality,
  });

  post({
    type: "done",
    blob,
    width: request.targetWidth,
    height: request.targetHeight,
    device,
  });
}

self.addEventListener("message", (event: MessageEvent<SuperResRequest>) => {
  void upscale(event.data).catch((cause: unknown) => {
    post({
      type: "error",
      message:
        cause instanceof Error ? cause.message : "The upscaling pass failed",
    });
  });
});
