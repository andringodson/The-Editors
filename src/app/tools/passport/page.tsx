"use client";

import { useEffect, useRef, useState } from "react";
import FileDrop from "@/components/FileDrop";
import { trackRun } from "@/lib/analytics";
import { cropBitmap, decodeImage } from "@/lib/image/canvas";
import { compressToTarget, formatBytes } from "@/lib/image/compress";
import {
  DPI_OPTIONS,
  PHOTO_PRESETS,
  presetAspectRatio,
  presetPixelSize,
  type Dpi,
} from "@/lib/image/presets";

export default function PassportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [presetId, setPresetId] = useState(PHOTO_PRESETS[0].id);
  const [dpi, setDpi] = useState<Dpi>(300);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0.5);
  const [offsetY, setOffsetY] = useState(0.5);
  const [enforceSize, setEnforceSize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bitmapRef = useRef<ImageBitmap | null>(null);
  const outputUrlRef = useRef<string | null>(null);

  const preset = PHOTO_PRESETS.find((item) => item.id === presetId)!;
  const pixels = presetPixelSize(preset, dpi);

  useEffect(() => {
    return () => {
      bitmapRef.current?.close();
      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
    };
  }, []);

  async function loadFile(next: File) {
    bitmapRef.current?.close();
    bitmapRef.current = await decodeImage(next);
    setFile(next);
    setOutput(null);
    setError(null);
  }

  /**
   * Work out the source rectangle: the largest box with the preset's aspect
   * ratio that fits inside the image, shrunk by `zoom`, then positioned by the
   * offset sliders. Clamped so the box can never leave the image.
   */
  function computeCropRect(bitmap: ImageBitmap) {
    const targetRatio = presetAspectRatio(preset);
    const sourceRatio = bitmap.width / bitmap.height;

    let width: number;
    let height: number;

    if (sourceRatio > targetRatio) {
      height = bitmap.height / zoom;
      width = height * targetRatio;
    } else {
      width = bitmap.width / zoom;
      height = width / targetRatio;
    }

    width = Math.min(width, bitmap.width);
    height = Math.min(height, bitmap.height);

    const x = (bitmap.width - width) * offsetX;
    const y = (bitmap.height - height) * offsetY;

    return { x, y, width, height };
  }

  async function run() {
    const bitmap = bitmapRef.current;
    if (!bitmap || !file) return;

    setBusy(true);
    setError(null);

    try {
      const blob = await trackRun(
        "passport",
        { inputBytes: file.size, targetBytes: preset.suggestedMaxBytes },
        async () => {
          const cropped = await cropBitmap(bitmap, computeCropRect(bitmap), {
            width: pixels.width,
            height: pixels.height,
            mimeType: "image/jpeg",
            quality: 0.95,
          });

          // Many government portals reject anything over a stated size, so the
          // preset's budget is applied as a second pass when asked for.
          if (enforceSize && preset.suggestedMaxBytes) {
            const shrunk = await compressToTarget(cropped, {
              targetBytes: preset.suggestedMaxBytes,
              mimeType: "image/jpeg",
              minQuality: 0.3,
            });
            return shrunk.blob;
          }

          return cropped;
        },
      );

      if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
      const url = URL.createObjectURL(blob);
      outputUrlRef.current = url;
      setOutput({ blob, url });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not build the photo");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!output) return;
    const link = document.createElement("a");
    link.href = output.url;
    link.download = `${preset.id}-${dpi}dpi.jpg`;
    link.click();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">
        Passport &amp; stamp photos
      </h1>
      <p className="mt-2 text-muted text-pretty">
        Exact millimetre dimensions, rendered at print resolution — and squeezed
        under the portal&apos;s upload limit when there is one.
      </p>

      <div className="mt-8">
        <FileDrop
          accept="image/*"
          label={file ? file.name : "Drop a photo, or click to choose"}
          hint={file ? formatBytes(file.size) : "A straight-on portrait works best"}
          disabled={busy}
          onFiles={(files) => void loadFile(files[0])}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="preset" className="block text-sm font-medium">
            Document type
          </label>
          <select
            id="preset"
            value={presetId}
            disabled={busy}
            onChange={(event) => {
              setPresetId(event.target.value);
              setOutput(null);
            }}
            className="mt-1.5 w-full rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2"
          >
            {PHOTO_PRESETS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} — {item.widthMm}×{item.heightMm} mm
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dpi" className="block text-sm font-medium">
            Resolution
          </label>
          <select
            id="dpi"
            value={dpi}
            disabled={busy}
            onChange={(event) => setDpi(Number(event.target.value) as Dpi)}
            className="mt-1.5 w-full rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2"
          >
            {DPI_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} DPI
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">
        Output: <span className="tabular-nums">{pixels.width}×{pixels.height}</span> pixels
        {preset.note ? ` · ${preset.note}` : ""}
      </p>

      {file ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              disabled={busy}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Horizontal</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={offsetX}
              disabled={busy}
              onChange={(event) => setOffsetX(Number(event.target.value))}
              className="mt-1.5 w-full"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Vertical</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={offsetY}
              disabled={busy}
              onChange={(event) => setOffsetY(Number(event.target.value))}
              className="mt-1.5 w-full"
            />
          </label>
        </div>
      ) : null}

      {preset.suggestedMaxBytes ? (
        <label className="mt-5 flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={enforceSize}
            disabled={busy}
            onChange={(event) => setEnforceSize(event.target.checked)}
            className="size-4"
          />
          Keep under {formatBytes(preset.suggestedMaxBytes)} (typical portal limit)
        </label>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={!file || busy}
        className="mt-6 w-full rounded-[var(--radius-base)] bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
      >
        {busy ? "Working…" : "Generate photo"}
      </button>

      {error ? (
        <p className="mt-4 rounded-[var(--radius-base)] border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {output ? (
        <section className="mt-8 rounded-[var(--radius-base)] border border-border bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">{preset.label}</h2>
            <p className="text-sm text-muted tabular-nums">
              {formatBytes(output.blob.size)}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={output.url}
            alt={`${preset.label} result`}
            className="mx-auto mt-4 max-h-80 rounded border border-border"
          />
          <button
            type="button"
            onClick={download}
            className="mt-5 w-full rounded-[var(--radius-base)] border border-border-strong px-5 py-2.5 font-medium transition-colors hover:border-accent"
          >
            Download
          </button>
        </section>
      ) : null}
    </div>
  );
}
