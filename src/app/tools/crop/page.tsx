"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FileDrop from "@/components/FileDrop";
import { trackRun } from "@/lib/analytics";
import {
  cropBitmap,
  decodeImage,
  rotateBitmap,
  type CropRect,
} from "@/lib/image/canvas";
import { formatBytes } from "@/lib/image/compress";
import ToolMeta from "@/components/ToolMeta";
import { toolTint } from "@/lib/tools";

const RATIOS = [
  { id: "free", label: "Free", value: null },
  { id: "1:1", label: "Square", value: 1 },
  { id: "4:3", label: "4 : 3", value: 4 / 3 },
  { id: "3:4", label: "3 : 4", value: 3 / 4 },
  { id: "16:9", label: "16 : 9", value: 16 / 9 },
  { id: "9:16", label: "9 : 16", value: 9 / 16 },
] as const;

interface Selection {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function CropPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [ratioId, setRatioId] = useState<string>("free");
  const [angle, setAngle] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  // Derived from `selection` at drag time rather than during render: mapping to
  // source pixels needs the surface's measured size, and reading a ref while
  // rendering is unsafe under concurrent React.
  const [sourceRect, setSourceRect] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The bitmap the crop is measured against — replaced whenever rotation is
  // applied, so selection coordinates always match what is on screen.
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const previewRef = useRef<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const ratio = RATIOS.find((item) => item.id === ratioId)?.value ?? null;

  useEffect(() => {
    return () => {
      bitmapRef.current?.close();
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const adoptBitmap = useCallback(async (blob: Blob) => {
    bitmapRef.current?.close();
    const bitmap = await decodeImage(blob);
    bitmapRef.current = bitmap;

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(blob);
    previewRef.current = url;

    setPreviewUrl(url);
    setNatural({ width: bitmap.width, height: bitmap.height });
    setSelection(null);
    setSourceRect(null);
    setOutput(null);
  }, []);

  async function loadFile(next: File) {
    setFile(next);
    setError(null);
    setAngle(0);
    await adoptBitmap(next);
  }

  /** Bake the current angle into the working bitmap, then reset the slider. */
  async function applyRotation(nextAngle: number) {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;

    setBusy(true);
    try {
      const rotated = await rotateBitmap(bitmap, nextAngle, {
        mimeType: "image/png", // lossless between edits
      });
      await adoptBitmap(rotated);
      setAngle(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rotation failed");
    } finally {
      setBusy(false);
    }
  }

  /** Convert a pointer event into coordinates within the displayed image. */
  function pointIn(event: React.PointerEvent): { x: number; y: number } | null {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    return {
      x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    };
  }

  function onPointerDown(event: React.PointerEvent) {
    if (busy || !previewUrl) return;
    const point = pointIn(event);
    if (!point) return;
    // Pointer capture keeps the drag alive when the finger leaves the box, but
    // it throws on an unrecognised pointerId in some browsers. Letting that
    // escape would abort the handler and the crop would never start, so a
    // failure here degrades to a drag that simply stops at the edge.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Non-fatal.
    }

    dragStart.current = point;
    setSelection({ x: point.x, y: point.y, width: 0, height: 0 });
    setSourceRect(null);
    setOutput(null);
  }

  function onPointerMove(event: React.PointerEvent) {
    const start = dragStart.current;
    if (!start) return;
    const point = pointIn(event);
    if (!point) return;

    let width = point.x - start.x;
    let height = point.y - start.y;

    // With a locked ratio the dominant axis drives the other, so the box always
    // matches the requested shape regardless of drag direction.
    if (ratio) {
      const magnitude = Math.max(Math.abs(width), Math.abs(height) * ratio);
      width = Math.sign(width || 1) * magnitude;
      height = Math.sign(height || 1) * (magnitude / ratio);
    }

    const next: Selection = {
      x: width < 0 ? start.x + width : start.x,
      y: height < 0 ? start.y + height : start.y,
      width: Math.abs(width),
      height: Math.abs(height),
    };

    setSelection(next);
    setSourceRect(mapToSource(next));
  }

  function onPointerUp() {
    dragStart.current = null;
  }

  /** Map an on-screen selection back onto the full-resolution bitmap. */
  function mapToSource(sel: Selection): CropRect | null {
    const surface = surfaceRef.current;
    if (!surface || !natural) return null;
    if (sel.width < 4 || sel.height < 4) return null;

    const rect = surface.getBoundingClientRect();
    const scaleX = natural.width / rect.width;
    const scaleY = natural.height / rect.height;

    return {
      x: Math.round(sel.x * scaleX),
      y: Math.round(sel.y * scaleY),
      width: Math.round(sel.width * scaleX),
      height: Math.round(sel.height * scaleY),
    };
  }

  async function run() {
    const bitmap = bitmapRef.current;
    const rect = sourceRect;
    if (!bitmap || !file) return;
    if (!rect) {
      setError("Drag a box on the image to choose what to keep.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const blob = await trackRun("crop", { inputBytes: file.size }, () =>
        cropBitmap(bitmap, rect, { mimeType: "image/jpeg", quality: 0.94 }),
      );
      setOutput(blob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Crop failed");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!output || !file) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(output);
    link.download = `${file.name.replace(/\.[^.]+$/, "")}-cropped.jpg`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div
      className={`shell-narrow bleed py-[var(--space-l)] ${toolTint("crop")}`}
    >
      <ToolMeta slug="crop" />
      <h1 className="headline-sm">Crop &amp; straighten</h1>
      <p className="prose mt-[var(--space-2xs)] text-muted text-pretty">
        Drag a box over the part you want to keep. Straighten a tilted scan
        first, then crop the result.
      </p>

      <div className="mt-8">
        <FileDrop
          accept="image/*"
          label={file ? file.name : "Drop an image, or click to choose"}
          hint={natural ? `${natural.width}×${natural.height}` : undefined}
          disabled={busy}
          onFiles={(files) => void loadFile(files[0])}
        />
      </div>

      {previewUrl ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="label">Ratio</span>
            {RATIOS.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setRatioId(item.id);
                  setSelection(null);
                  setSourceRect(null);
                }}
                className={[
                  "px-3 py-2 text-xs",
                  ratioId === item.id
                    ? "panel-sunk bg-accent-dim font-bold"
                    : "panel",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div
            ref={surfaceRef}
            data-testid="crop-surface"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative mt-4 touch-none select-none overflow-hidden panel bg-panel"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Source"
              draggable={false}
              className="block w-full"
              style={{ transform: `rotate(${angle}deg)` }}
            />
            {selection && selection.width > 0 ? (
              <div
                className="pointer-events-none absolute border-2 border-accent bg-accent/15"
                style={{
                  left: selection.x,
                  top: selection.y,
                  width: selection.width,
                  height: selection.height,
                }}
              />
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block text-sm">
              <span className="font-medium">
                Straighten — <span className="tabular-nums">{angle}°</span>
              </span>
              <input
                type="range"
                min={-15}
                max={15}
                step={0.5}
                value={angle}
                disabled={busy}
                onChange={(event) => setAngle(Number(event.target.value))}
                className="mt-1.5 w-full"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || angle === 0}
                onClick={() => void applyRotation(angle)}
                className="panel px-3 py-1.5 text-xs disabled:opacity-35"
              >
                Apply tilt
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void applyRotation(90)}
                className="panel px-3 py-1.5 text-xs disabled:opacity-35"
              >
                Rotate 90°
              </button>
            </div>
          </div>

          {sourceRect ? (
            <p className="mt-3 text-sm text-muted tabular-nums">
              Selection: {sourceRect.width}×{sourceRect.height} px
            </p>
          ) : null}
        </>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={!file || busy}
        className="mt-6 btn btn-primary btn-block"
      >
        {busy ? "Working…" : "Crop"}
      </button>

      {error ? (
        <p className="mt-4 panel bg-panel px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}

      {output ? (
        <section className="mt-8 panel bg-panel p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-medium">Done</h2>
            <p className="text-sm text-muted tabular-nums">
              {formatBytes(output.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={download}
            className="mt-4 btn btn-block"
          >
            Download
          </button>
        </section>
      ) : null}
    </div>
  );
}
