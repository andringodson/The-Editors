"use client";

import { useEffect, useRef, useState } from "react";
import FileDrop from "@/components/FileDrop";
import { trackRun } from "@/lib/analytics";
import ToolMeta from "@/components/ToolMeta";
import { toolTint } from "@/lib/tools";
import {
  compressToTarget,
  formatBytes,
  parseTargetSize,
  type CompressResult,
} from "@/lib/image/compress";

type Unit = "KB" | "MB";
type Format = "image/jpeg" | "image/webp";

export default function CompressPage() {
  const [file, setFile] = useState<File | null>(null);
  const [amount, setAmount] = useState(200);
  const [unit, setUnit] = useState<Unit>("KB");
  const [format, setFormat] = useState<Format>("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Blob URLs are leaked unless revoked explicitly; hold them in a ref so the
  // cleanup effect can reclaim the previous one on every change.
  const previewUrl = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  function setPreviewFromBlob(blob: Blob | null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    if (!blob) {
      previewUrl.current = null;
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    previewUrl.current = url;
    setPreview(url);
  }

  async function run() {
    if (!file) return;

    const targetBytes = parseTargetSize(amount, unit);
    if (targetBytes >= file.size) {
      setError(
        `That target is already larger than the original (${formatBytes(file.size)}). Pick a smaller number.`,
      );
      return;
    }

    setBusy(true);
    setError(null);
    setProgress(0);
    setResult(null);
    setPreviewFromBlob(null);

    try {
      const output = await trackRun(
        "compress",
        { inputBytes: file.size, targetBytes },
        () =>
          compressToTarget(file, {
            targetBytes,
            mimeType: format,
            onProgress: setProgress,
          }),
      );

      setResult(output);
      setPreviewFromBlob(output.blob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Compression failed");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!result || !file) return;
    const extension = format === "image/webp" ? "webp" : "jpg";
    const base = file.name.replace(/\.[^.]+$/, "");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(result.blob);
    link.download = `${base}-compressed.${extension}`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div
      className={`shell-narrow bleed py-[var(--space-l)] ${toolTint("compress")}`}
    >
      <ToolMeta slug="compress" />
      <h1 className="headline-sm">Compress to a size</h1>
      <p className="prose mt-[var(--space-2xs)] text-muted text-pretty">
        Most compressors give you a quality slider and let you guess. Give this
        one a number and it searches for the best-looking image that fits under
        it.
      </p>

      <div className="mt-8">
        <FileDrop
          accept="image/*"
          label={file ? file.name : "Drop an image, or click to choose"}
          hint={
            file
              ? `${formatBytes(file.size)} · ${file.type || "unknown type"}`
              : "JPG, PNG, WebP, AVIF, HEIC — anything your browser can open"
          }
          disabled={busy}
          onFiles={(files) => {
            setFile(files[0]);
            setResult(null);
            setError(null);
            setPreviewFromBlob(null);
          }}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="target" className="label mb-[var(--space-3xs)] block">
            Target size
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="target"
              type="number"
              min={1}
              value={amount}
              disabled={busy}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="w-full panel-sunk px-3 py-2 tabular-nums"
            />
            <select
              aria-label="Unit"
              value={unit}
              disabled={busy}
              onChange={(event) => setUnit(event.target.value as Unit)}
              className="panel-sunk px-3 py-2"
            >
              <option value="KB">KB</option>
              <option value="MB">MB</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="format" className="label mb-[var(--space-3xs)] block">
            Output format
          </label>
          <select
            id="format"
            value={format}
            disabled={busy}
            onChange={(event) => setFormat(event.target.value as Format)}
            className="mt-1.5 w-full panel-sunk px-3 py-2"
          >
            <option value="image/jpeg">JPEG — best for photographs</option>
            <option value="image/webp">
              WebP — smaller, best for flat art
            </option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={run}
        disabled={!file || busy}
        className="mt-6 btn btn-primary btn-block"
      >
        {busy ? `Searching… ${Math.round(progress * 100)}%` : "Compress"}
      </button>

      {error ? (
        <p className="mt-4 panel bg-panel px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="mt-8 panel bg-panel p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">
              {result.missedTarget ? "Closest possible" : "Done"}
            </h2>
            <p className="text-sm text-muted tabular-nums">
              {result.attempts} encodes
            </p>
          </div>

          {result.missedTarget ? (
            <p className="mt-2 text-sm text-danger">
              Could not reach that target without destroying the image. This is
              the smallest acceptable result.
            </p>
          ) : null}

          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted">Original</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {formatBytes(result.originalBytes)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Result</dt>
              <dd className="mt-0.5 font-medium text-success tabular-nums">
                {formatBytes(result.blob.size)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Dimensions</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {result.width}×{result.height}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Quality</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {Math.round(result.quality * 100)}%
              </dd>
            </div>
          </dl>

          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview}
              alt="Compressed result"
              className="mt-5 max-h-96 w-full panel object-contain"
            />
          ) : null}

          <button
            type="button"
            onClick={download}
            className="mt-5 btn btn-block"
          >
            Download
          </button>
        </section>
      ) : null}
    </div>
  );
}
