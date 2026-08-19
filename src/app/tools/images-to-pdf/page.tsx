"use client";

import { useState } from "react";
import BatchLimitNotice from "@/components/BatchLimitNotice";
import FileDrop from "@/components/FileDrop";
import { trackRun } from "@/lib/analytics";
import { formatBytes } from "@/lib/image/compress";
import { imagesToPdf } from "@/lib/pdf/operations";
import { BATCH_FILE_LIMIT } from "@/lib/quotas";
import ToolMeta from "@/components/ToolMeta";

type PageSize = "a4" | "fit";

export default function ImagesToPdfPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<{ limit: number; attempted: number } | null>(
    null,
  );

  function addFiles(incoming: File[]) {
    const images = incoming.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      setError("Those don't look like images.");
      return;
    }
    setError(null);

    // Keep what fits rather than rejecting the whole drop.
    const limit = BATCH_FILE_LIMIT;
    const room = Math.max(0, limit - files.length);

    setOverflow(
      images.length > room ? { limit, attempted: files.length + images.length } : null,
    );

    setFiles((current) => [...current, ...images.slice(0, room)]);
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
    <div className="shell-narrow bleed py-[var(--space-l)]">
      <ToolMeta slug="images-to-pdf" />
      <h1 className="headline-sm">Images to PDF</h1>
      <p className="prose mt-[var(--space-2xs)] text-muted text-pretty">
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
        {overflow ? (
          <BatchLimitNotice limit={overflow.limit} attempted={overflow.attempted} />
        ) : null}
      </div>

      <fieldset className="mt-6">
        <legend className="label">Page size</legend>
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
              className="flex items-center gap-3 panel bg-panel px-4 py-3"
            >
              <span className="w-6 shrink-0 text-sm text-muted tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="label truncate">{file.name}</p>
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
                  className="panel px-2.5 py-1.5 text-xs disabled:opacity-35"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={busy || index === files.length - 1}
                  onClick={() => move(index, 1)}
                  className="panel px-2.5 py-1.5 text-xs disabled:opacity-35"
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
                  className="panel px-2.5 py-1.5 text-xs text-danger disabled:opacity-35"
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
        className="mt-6 btn btn-primary btn-block"
      >
        {busy ? status || "Building…" : `Create PDF${files.length ? ` (${files.length} pages)` : ""}`}
      </button>

      {error ? (
        <p className="mt-4 panel bg-panel px-4 py-3 text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}

      {!busy && status && !error ? (
        <p className="mt-4 text-sm text-success">{status}</p>
      ) : null}
    </div>
  );
}
