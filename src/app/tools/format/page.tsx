"use client";

import { useEffect, useRef, useState } from "react";
import FileDrop from "@/components/FileDrop";
import { trackRun } from "@/lib/analytics";
import { decodeImage, renderBitmap, type EncodeMime } from "@/lib/image/canvas";
import { formatBytes } from "@/lib/image/compress";

const FORMATS: { value: EncodeMime; label: string; lossy: boolean }[] = [
  { value: "image/jpeg", label: "JPEG", lossy: true },
  { value: "image/png", label: "PNG (lossless)", lossy: false },
  { value: "image/webp", label: "WebP", lossy: true },
];

export default function FormatPage() {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<EncodeMime>("image/webp");
  const [quality, setQuality] = useState(0.85);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bitmapRef = useRef<ImageBitmap | null>(null);

  useEffect(() => () => bitmapRef.current?.close(), []);

  const isLossy = FORMATS.find((item) => item.value === format)?.lossy ?? true;

  async function loadFile(next: File) {
    bitmapRef.current?.close();
    bitmapRef.current = await decodeImage(next);
    setFile(next);
    setOutput(null);
    setError(null);
  }

  async function run() {
    const bitmap = bitmapRef.current;
    if (!bitmap || !file) return;

    setBusy(true);
    setError(null);

    try {
      const blob = await trackRun("format", { inputBytes: file.size }, () =>
        renderBitmap(bitmap, { mimeType: format, quality }),
      );
      setOutput(blob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Conversion failed");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!output || !file) return;
    const extension = format.split("/")[1].replace("jpeg", "jpg");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(output);
    link.download = `${file.name.replace(/\.[^.]+$/, "")}.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const delta =
    output && file ? ((output.size - file.size) / file.size) * 100 : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Change format</h1>
      <p className="mt-2 text-muted text-pretty">
        Convert between JPEG, PNG and WebP. Your browser reads AVIF and HEIC too,
        so those work as inputs even though they are not offered as outputs.
      </p>

      <div className="mt-8">
        <FileDrop
          accept="image/*"
          label={file ? file.name : "Drop an image, or click to choose"}
          hint={file ? `${formatBytes(file.size)} · ${file.type || "unknown"}` : undefined}
          disabled={busy}
          onFiles={(files) => void loadFile(files[0])}
        />
      </div>

      <div className="mt-6">
        <label htmlFor="format" className="block text-sm font-medium">
          Convert to
        </label>
        <select
          id="format"
          value={format}
          disabled={busy}
          onChange={(event) => {
            setFormat(event.target.value as EncodeMime);
            setOutput(null);
          }}
          className="mt-1.5 w-full rounded-[var(--radius-base)] border border-border bg-surface px-3 py-2"
        >
          {FORMATS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {isLossy ? (
        <label className="mt-5 block text-sm">
          <span className="font-medium">
            Quality — <span className="tabular-nums">{Math.round(quality * 100)}%</span>
          </span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={quality}
            disabled={busy}
            onChange={(event) => setQuality(Number(event.target.value))}
            className="mt-1.5 w-full"
          />
        </label>
      ) : (
        <p className="mt-5 text-sm text-muted">
          PNG is lossless, so there is no quality setting. Expect a larger file
          than JPEG or WebP for photographs.
        </p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={!file || busy}
        className="mt-6 w-full rounded-[var(--radius-base)] bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
      >
        {busy ? "Converting…" : "Convert"}
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
            <p className="text-sm tabular-nums">
              <span className="text-muted">{formatBytes(output.size)}</span>
              {delta !== null ? (
                <span className={delta <= 0 ? "text-success" : "text-danger"}>
                  {" "}
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(0)}%
                </span>
              ) : null}
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
