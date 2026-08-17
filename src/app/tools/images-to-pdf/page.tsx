"use client";

import { useState } from "react";
import FileDrop from "@/components/FileDrop";
import { trackRun } from "@/lib/analytics";
import { formatBytes } from "@/lib/image/compress";
import { imagesToPdf } from "@/lib/pdf/operations";

type PageSize = "a4" | "fit";

export default function ImagesToPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  function addFiles(incoming: File[]) {
    const images = incoming.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      setError("Those don't look like images.");
      return;
    }
    setError(null);
    setFiles((current) => [...current, ...images]);
  }

  function move(index: number, direction: -1 | 1) {
    setFiles((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function run() {
    if (files.length === 0) return;

    setBusy(true);
    setError(null);
    setStatus("Starting…");

    const inputBytes = files.reduce((sum, file) => sum + file.size, 0);

    try {
      const blob = await trackRun("images-to-pdf", { inputBytes }, () =>
        imagesToPdf(files, { pageSize }, (_, label) => setStatus(label ?? "")),
      );

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "document.pdf";
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus(`Built — ${formatBytes(blob.size)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not build the PDF");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Images to PDF</h1>
      <p className="mt-2 text-muted text-pretty">
        Turn photos or scans into one document, in the order you arrange them.
      </p>

      <div className="mt-8">
        <FileDrop
          accept="image/*"
          multiple
          label="Drop images, or click to choose"
          hint="JPG, PNG, WebP, HEIC — anything your browser can open"
          disabled={busy}
          onFiles={addFiles}
        />
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">Page size</legend>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="pageSize"
              value="a4"
              checked={pageSize === "a4"}
              disabled={busy}
              onChange={() => setPageSize("a4")}
            />
            A4 — each image centred on a standard page
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="pageSize"
              value="fit"
              checked={pageSize === "fit"}
              disabled={busy}
              onChange={() => setPageSize("fit")}
            />
            Fit — page matches the image exactly
          </label>
        </div>
      </fieldset>

      {files.length > 0 ? (
        <ol className="mt-6 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-[var(--radius-base)] border border-border bg-surface px-4 py-3"
            >
              <span className="w-6 shrink-0 text-sm text-muted tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted tabular-nums">
                  {formatBytes(file.size)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-35"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={busy || index === files.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded border border-border px-2 py-1 text-xs disabled:opacity-35"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  disabled={busy}
                  onClick={() =>
                    setFiles((current) => current.filter((_, i) => i !== index))
                  }
                  className="rounded border border-border px-2 py-1 text-xs text-danger disabled:opacity-35"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={files.length === 0 || busy}
        className="mt-6 w-full rounded-[var(--radius-base)] bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
      >
        {busy ? status || "Building…" : `Create PDF${files.length ? ` (${files.length} pages)` : ""}`}
      </button>

      {error ? (
        <p className="mt-4 rounded-[var(--radius-base)] border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!busy && status && !error ? (
        <p className="mt-4 text-sm text-success">{status}</p>
      ) : null}
    </div>
  );
}
