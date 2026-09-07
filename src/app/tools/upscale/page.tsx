"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FileDrop from "@/components/FileDrop";
import CompareSlider from "@/components/CompareSlider";
import ToolMeta from "@/components/ToolMeta";
import { trackRun } from "@/lib/analytics";
import { decodeImage, type EncodeMime } from "@/lib/image/canvas";
import { formatBytes } from "@/lib/image/compress";
import { resampleToBlob } from "@/lib/image/resample";
import {
  MAX_AI_PIXELS,
  MODEL_BYTES,
  MODEL_SCALE,
  detectWebGPU,
  tileCount,
  type SuperResDevice,
  type SuperResRequest,
  type SuperResResponse,
} from "@/lib/image/superres";
import { checkDecodedSize } from "@/lib/limits";
import { toolTint } from "@/lib/tools";

/** Presets name a target for the longest edge; `x4` follows the source. */
const TARGETS = [
  { id: "x4", label: "4× the original — the model's native size" },
  { id: "hd", label: "Full HD — 1920 px", longEdge: 1920 },
  { id: "qhd", label: "2K — 2560 px", longEdge: 2560 },
  { id: "uhd", label: "4K — 3840 px", longEdge: 3840 },
  { id: "uhd8", label: "8K — 7680 px", longEdge: 7680 },
] as const;

/**
 * Rough per-tile cost, for the estimate shown before anyone commits to a wait.
 * Measured on mid-range hardware; the running estimate replaces it with the
 * real rate as soon as the first tiles are through.
 */
const MS_PER_TILE: Record<SuperResDevice, number> = { webgpu: 45, wasm: 480 };

type Method = "ai" | "resample";

interface Progress {
  stage: "loading-model" | "upscaling" | "encoding";
  done: number;
  total: number;
  /** Reported by the worker, so rendering the estimate stays a pure function. */
  elapsedMs: number;
}

function describeSeconds(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export default function UpscalePage() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [targetId, setTargetId] = useState<string>("x4");
  const [method, setMethod] = useState<Method>("ai");
  const [format, setFormat] = useState<EncodeMime>("image/jpeg");
  const [device, setDevice] = useState<SuperResDevice | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<{
    blob: Blob;
    width: number;
    height: number;
    method: Method;
  } | null>(null);
  const [wipe, setWipe] = useState(50);
  const [error, setError] = useState<string | null>(null);

  const bitmapRef = useRef<ImageBitmap | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const beforeUrlRef = useRef<string | null>(null);
  const afterUrlRef = useRef<string | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);

  /* Which backend the AI pass would use. Probed once: requesting an adapter is
     the only way to tell a real WebGPU implementation from a stubbed one. */
  useEffect(() => {
    let live = true;
    void detectWebGPU().then((ok) => {
      if (live) setDevice(ok ? "webgpu" : "wasm");
    });
    return () => {
      live = false;
    };
  }, []);

  const releaseUrls = useCallback(() => {
    if (beforeUrlRef.current) URL.revokeObjectURL(beforeUrlRef.current);
    if (afterUrlRef.current) URL.revokeObjectURL(afterUrlRef.current);
    beforeUrlRef.current = null;
    afterUrlRef.current = null;
    setBeforeUrl(null);
    setAfterUrl(null);
  }, []);

  useEffect(
    () => () => {
      bitmapRef.current?.close();
      workerRef.current?.terminate();
      releaseUrls();
    },
    [releaseUrls],
  );

  const target = TARGETS.find((item) => item.id === targetId)!;
  const pixels = source ? source.width * source.height : 0;
  const tooBigForAi = pixels > MAX_AI_PIXELS;
  const aiAvailable = Boolean(source) && !tooBigForAi;
  const effectiveMethod: Method = method === "ai" && aiAvailable ? "ai" : "resample";

  /** Output size, preserving aspect ratio. */
  const projected = source
    ? (() => {
        if (!("longEdge" in target)) {
          return {
            width: source.width * MODEL_SCALE,
            height: source.height * MODEL_SCALE,
            factor: MODEL_SCALE,
          };
        }
        const factor = target.longEdge / Math.max(source.width, source.height);
        return {
          width: Math.round(source.width * factor),
          height: Math.round(source.height * factor),
          factor,
        };
      })()
    : null;

  const estimate =
    source && device && effectiveMethod === "ai"
      ? tileCount(source.width, source.height) * MS_PER_TILE[device]
      : null;

  async function loadFile(next: File) {
    releaseUrls();
    bitmapRef.current?.close();
    bitmapRef.current = null;

    const bitmap = await decodeImage(next);
    const failure = checkDecodedSize(bitmap);
    if (failure) {
      bitmap.close();
      setError(failure.message);
      setFile(null);
      setSource(null);
      return;
    }

    bitmapRef.current = bitmap;
    setFile(next);
    setSource({ width: bitmap.width, height: bitmap.height });
    setOutput(null);
    setError(null);
  }

  function finish(blob: Blob, width: number, height: number, used: Method) {
    if (!file) return;
    releaseUrls();
    beforeUrlRef.current = URL.createObjectURL(file);
    afterUrlRef.current = URL.createObjectURL(blob);
    setBeforeUrl(beforeUrlRef.current);
    setAfterUrl(afterUrlRef.current);
    setWipe(50);
    setOutput({ blob, width, height, method: used });
  }

  /** The AI pass. Everything happens in the worker; this only reports on it. */
  function runModel() {
    if (!file || !projected || !device) return;

    const worker =
      workerRef.current ??
      new Worker(new URL("@/lib/image/superres.worker.ts", import.meta.url));
    workerRef.current = worker;

    setProgress({
      stage: "loading-model",
      done: 0,
      total: tileCount(source!.width, source!.height),
      elapsedMs: 0,
    });

    void trackRun(
      "upscale",
      { inputBytes: file.size },
      () =>
        new Promise<void>((resolve, reject) => {
          worker.onmessage = (event: MessageEvent<SuperResResponse>) => {
            const message = event.data;
            if (message.type === "stage") {
              setProgress((current) =>
                current ? { ...current, stage: message.stage } : current,
              );
              return;
            }
            if (message.type === "progress") {
              setProgress((current) =>
                current
                  ? {
                      ...current,
                      done: message.done,
                      total: message.total,
                      elapsedMs: message.elapsedMs,
                    }
                  : current,
              );
              return;
            }
            if (message.type === "done") {
              finish(message.blob, message.width, message.height, "ai");
              setDevice(message.device);
              resolve();
              return;
            }
            reject(new Error(message.message));
          };
          worker.onerror = () =>
            reject(new Error("The upscaler could not start in this browser"));

          const request: SuperResRequest = {
            type: "run",
            file,
            targetWidth: projected.width,
            targetHeight: projected.height,
            mimeType: format,
            quality: 0.92,
            device,
          };
          worker.postMessage(request);
        }),
    )
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : "Could not upscale that image",
        );
        // The session may be half-built after a failure; start clean next time.
        workerRef.current?.terminate();
        workerRef.current = null;
      })
      .finally(() => {
        setBusy(false);
        setProgress(null);
      });
  }

  async function runResample() {
    const bitmap = bitmapRef.current;
    if (!bitmap || !file || !projected) return;

    try {
      const blob = await trackRun("upscale", { inputBytes: file.size }, () =>
        resampleToBlob(bitmap, {
          width: projected.width,
          height: projected.height,
          mimeType: format,
          quality: 0.92,
        }),
      );
      finish(blob, projected.width, projected.height, "resample");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resize");
    } finally {
      setBusy(false);
    }
  }

  function run() {
    setBusy(true);
    setError(null);
    setOutput(null);
    if (effectiveMethod === "ai") runModel();
    else void runResample();
  }

  function cancel() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setBusy(false);
    setProgress(null);
  }

  function download() {
    if (!output || !file) return;
    const extension = format.split("/")[1].replace("jpeg", "jpg");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(output.blob);
    link.download = `${file.name.replace(/\.[^.]+$/, "")}-${output.width}px.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const remaining =
    progress && progress.done > 0
      ? (progress.elapsedMs / progress.done) * (progress.total - progress.done)
      : null;

  return (
    <div
      className={`shell-narrow bleed py-[var(--space-l)] ${toolTint("upscale")}`}
    >
      <ToolMeta slug="upscale" />
      <h1 className="headline-sm">Upscale an image</h1>
      <p className="prose mt-[var(--space-2xs)] text-muted text-pretty">
        Enlarge a photo with Real-ESRGAN, the same open-source network Upscayl
        uses — it reconstructs edges and texture rather than stretching the
        pixels it was given. The model runs on your device; nothing is uploaded.
      </p>

      <div className="mt-8">
        <FileDrop
          accept="image/*"
          label={file ? file.name : "Drop an image, or click to choose"}
          hint={
            source
              ? `${source.width}×${source.height} · ${formatBytes(file!.size)}`
              : "Small originals gain the most — that is what the model is for"
          }
          disabled={busy}
          onFiles={(files) => void loadFile(files[0])}
        />
      </div>

      <fieldset className="mt-6" disabled={busy}>
        <legend className="label mb-[var(--space-2xs)]">Method</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={[
              "panel-sunk cursor-pointer p-3",
              effectiveMethod === "ai" ? "outline-2 outline-accent" : "",
              aiAvailable || !source ? "" : "cursor-not-allowed text-muted",
            ].join(" ")}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="label text-foreground">
                <input
                  type="radio"
                  name="method"
                  value="ai"
                  checked={method === "ai"}
                  disabled={Boolean(source) && !aiAvailable}
                  onChange={() => {
                    setMethod("ai");
                    setOutput(null);
                  }}
                  className="mr-2 accent-[var(--accent)]"
                />
                AI reconstruction
              </span>
              {device ? (
                <span className="label-tight">
                  {device === "webgpu" ? "GPU" : "CPU"}
                </span>
              ) : null}
            </span>
            <span className="label-tight mt-1.5 block">
              {tooBigForAi
                ? `Already ${(pixels / 1_000_000).toFixed(1)} MP — past ${MAX_AI_PIXELS / 1_000_000} MP resampling is the better tool`
                : `Real-ESRGAN x4v3 · ${formatBytes(MODEL_BYTES)} model, downloaded once${
                    estimate ? ` · about ${describeSeconds(estimate)}` : ""
                  }`}
            </span>
          </label>

          <label
            className={[
              "panel-sunk cursor-pointer p-3",
              effectiveMethod === "resample" ? "outline-2 outline-accent" : "",
            ].join(" ")}
          >
            <span className="label text-foreground">
              <input
                type="radio"
                name="method"
                value="resample"
                checked={method === "resample"}
                onChange={() => {
                  setMethod("resample");
                  setOutput(null);
                }}
                className="mr-2 accent-[var(--accent)]"
              />
              Sharp resample
            </span>
            <span className="label-tight mt-1.5 block">
              Instant, and invents nothing. The honest choice when the original
              is already detailed.
            </span>
          </label>
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="target" className="label mb-[var(--space-3xs)] block">
            Target resolution
          </label>
          <select
            id="target"
            value={targetId}
            disabled={busy}
            onChange={(event) => {
              setTargetId(event.target.value);
              setOutput(null);
            }}
            className="mt-1.5 w-full panel-sunk px-3 py-2"
          >
            {TARGETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="format" className="label mb-[var(--space-3xs)] block">
            Output format
          </label>
          <select
            id="format"
            value={format}
            disabled={busy}
            onChange={(event) => {
              setFormat(event.target.value as EncodeMime);
              setOutput(null);
            }}
            className="mt-1.5 w-full panel-sunk px-3 py-2"
          >
            <option value="image/jpeg">JPEG</option>
            <option value="image/png">PNG — lossless</option>
            <option value="image/webp">WebP</option>
          </select>
        </div>
      </div>

      {projected ? (
        <p className="mt-3 text-sm text-muted">
          Result:{" "}
          <span className="tabular-nums">
            {projected.width}×{projected.height}
          </span>
          {projected.factor < 1 ? (
            <span className="text-danger">
              {" "}
              — this would shrink the image, not enlarge it
            </span>
          ) : (
            <span className="tabular-nums">
              {" "}
              — {projected.factor.toFixed(2)}× larger
            </span>
          )}
          {effectiveMethod === "ai" && projected.factor > MODEL_SCALE ? (
            <span>
              {" "}
              · the model reconstructs {MODEL_SCALE}×, the rest is resampled
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={run}
          disabled={!file || busy}
          className="btn btn-primary btn-block"
        >
          {busy
            ? "Working…"
            : effectiveMethod === "ai"
              ? "Upscale with AI"
              : "Upscale"}
        </button>
        {busy && effectiveMethod === "ai" ? (
          <button type="button" onClick={cancel} className="btn">
            Cancel
          </button>
        ) : null}
      </div>

      {progress ? (
        <section
          aria-live="polite"
          className="mt-4 panel bg-panel px-4 py-3 text-sm"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span>
              {progress.stage === "loading-model"
                ? "Loading the model…"
                : progress.stage === "encoding"
                  ? "Encoding…"
                  : `Reconstructing — tile ${progress.done} of ${progress.total}`}
            </span>
            {remaining !== null && progress.stage === "upscaling" ? (
              <span className="label-tight tabular-nums">
                about {describeSeconds(remaining)} left
              </span>
            ) : null}
          </div>
          <div className="mt-2 h-1 w-full bg-panel-sunk">
            <div
              className="h-full bg-accent transition-[width]"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="mt-4 panel bg-panel px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}

      {output ? (
        <section className="mt-8 panel bg-panel p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-medium">Done</h2>
            <p className="text-sm text-muted tabular-nums">
              {output.width}×{output.height} · {formatBytes(output.blob.size)}
            </p>
          </div>

          {beforeUrl && afterUrl ? (
            <div className="mt-4">
              <CompareSlider
                beforeUrl={beforeUrl}
                afterUrl={afterUrl}
                width={output.width}
                height={output.height}
                position={wipe}
                onPosition={setWipe}
              />
            </div>
          ) : null}

          <button type="button" onClick={download} className="mt-4 btn btn-block">
            Download
          </button>
        </section>
      ) : null}
    </div>
  );
}
