"use client";

import { useEffect, useRef, useState } from "react";
import FileDrop from "@/components/FileDrop";
import { trackRun } from "@/lib/analytics";
import { decodeImage, renderBitmap, type EncodeMime } from "@/lib/image/canvas";
import { formatBytes } from "@/lib/image/compress";

/** Target width for the longest edge. */
const TARGETS = [
  { id: "hd", label: "Full HD — 1920 px", longEdge: 1920 },
  { id: "qhd", label: "2K — 2560 px", longEdge: 2560 },
  { id: "uhd", label: "4K — 3840 px", longEdge: 3840 },
  { id: "uhd8", label: "8K — 7680 px", longEdge: 7680 },
] as const;

export default function UpscalePage() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<{ width: number; height: number } | null>(null);
  const [targetId, setTargetId] = useState<string>("uhd");
  const [format, setFormat] = useState<EncodeMime>("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<{ blob: Blob; width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bitmapRef = useRef<ImageBitmap | null>(null);

  useEffect(() => () => bitmapRef.current?.close(), []);

  const target = TARGETS.find((item) => item.id === targetId)!;

  /** Scale the longest edge to the target, preserving aspect ratio. */
  const projected = source
    ? (() => {
        const longest = Math.max(source.width, source.height);
        const factor = target.longEdge / longest;
        return {
          width: Math.round(source.width * factor),
          height: Math.round(source.height * factor),
          factor,
        };
      })()
    : null;

  async function loadFile(next: File) {
    bitmapRef.current?.close();
    const bitmap = await decodeImage(next);
    bitmapRef.current = bitmap;
    setFile(next);
    setSource({ width: bitmap.width, height: bitmap.height });
    setOutput(null);
    setError(null);
  }

  async function run() {
    const bitmap = bitmapRef.current;
    if (!bitmap || !file || !projected) return;

    setBusy(true);
    setError(null);

    try {
      const blob = await trackRun("upscale", { inputBytes: file.size }, () =>
        renderBitmap(bitmap, {
          width: projected.width,
          height: projected.height,
          mimeType: format,
          quality: 0.92,
        }),
      );
      setOutput({ blob, width: projected.width, height: projected.height });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resize");
    } finally {
      setBusy(false);
    }
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Upscale to 4K</h1>
      <p className="mt-2 text-muted text-pretty">
        Resample to a larger canvas with high-quality smoothing. This enlarges
        an image — it cannot invent detail that was never captured.
      </p>

      <div className="mt-8">
        <FileDrop
          accept="image/*"
          label={file ? file.name : "Drop an image, or click to choose"}
          hint={
            source
              ? `${source.width}×${source.height} · ${formatBytes(file!.size)}`
              : "Larger originals give better results"
          }
          disabled={busy}
          onFiles={(files) => void loadFile(files[0])}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="target" className="block text-sm font-medium">
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
            className="mt-1.5 w-full rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2"
          >
            {TARGETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="format" className="block text-sm font-medium">
            Output format
          </label>
          <select
            id="format"
            value={format}
            disabled={busy}
            onChange={(event) => setFormat(event.target.value as EncodeMime)}
            className="mt-1.5 w-full rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2"
          >
            <option value="image/jpeg">JPEG</option>
            <option value="image/png">PNG — lossless</option>
            <option value="image/webp">WebP</option>
          </select>
        </div>
      </div>

      {projected ? (
        <p className="mt-3 text-sm text-muted">
          Result: <span className="tabular-nums">{projected.width}×{projected.height}</span>
          {projected.factor < 1 ? (
            <span className="text-danger">
              {" "}
              — this would shrink the image, not enlarge it
            </span>
          ) : (
            <span className="tabular-nums"> — {projected.factor.toFixed(2)}× larger</span>
          )}
        </p>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={!file || busy}
        className="mt-6 w-full rounded-[var(--radius-base)] bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
      >
        {busy ? "Resampling…" : "Upscale"}
      </button>

      {error ? (
        <p className="mt-4 rounded-[var(--radius-base)] border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {output ? (
        <section className="mt-8 rounded-[var(--radius-base)] border border-border bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Done</h2>
            <p className="text-sm text-muted tabular-nums">
              {output.width}×{output.height} · {formatBytes(output.blob.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={download}
            className="mt-4 w-full rounded-[var(--radius-base)] border border-border-strong px-5 py-2.5 font-medium transition-colors hover:border-accent"
          >
            Download
          </button>
        </section>
      ) : null}
    </div>
  );
}
