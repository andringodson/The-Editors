"use client";

import { useState } from "react";
import BatchLimitNotice from "@/components/BatchLimitNotice";
import FileDrop from "@/components/FileDrop";
import { trackRun } from "@/lib/analytics";
import { formatBytes } from "@/lib/image/compress";
import { getPageCount, mergePdfs } from "@/lib/pdf/operations";
import { usePlan } from "@/lib/use-plan";

interface Entry {
  file: File;
  /** Null until counted; undefined counts mean the file could not be parsed. */
  pages: number | null;
  error?: string;
}

export default function PdfMergePage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overflow, setOverflow] = useState<{ limit: number; attempted: number } | null>(
    null,
  );

  const { plan } = usePlan();

  async function addFiles(files: File[]) {
    const pdfs = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    );

    if (pdfs.length === 0) {
      setError("Those don't look like PDFs.");
      return;
    }

    setError(null);

    // Take what fits under the plan's cap rather than rejecting the whole drop —
    // losing four files because the fifth was one too many is hostile.
    const limit = plan.limits.batchFiles;
    const room = Math.max(0, limit - entries.length);
    const accepted = pdfs.slice(0, room);

    setOverflow(
      pdfs.length > room ? { limit, attempted: entries.length + pdfs.length } : null,
    );

    if (accepted.length === 0) return;

    const added: Entry[] = accepted.map((file) => ({ file, pages: null }));
    setEntries((current) => [...current, ...added]);

    // Count pages in the background so the list stays responsive; a corrupt or
    // password-protected file surfaces here rather than at merge time.
    for (const entry of added) {
      try {
        const pages = await getPageCount(entry.file);
        setEntries((current) =>
          current.map((item) =>
            item.file === entry.file ? { ...item, pages } : item,
          ),
        );
      } catch {
        setEntries((current) =>
          current.map((item) =>
            item.file === entry.file
              ? { ...item, pages: 0, error: "Could not read — encrypted or damaged" }
              : item,
          ),
        );
      }
    }
  }

  function move(index: number, direction: -1 | 1) {
    setEntries((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    setEntries((current) => current.filter((_, i) => i !== index));
  }

  async function run() {
    const usable = entries.filter((entry) => !entry.error);
    if (usable.length < 2) {
      setError("Add at least two readable PDFs to merge.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus("Starting…");

    const inputBytes = usable.reduce((sum, entry) => sum + entry.file.size, 0);

    try {
      const blob = await trackRun("pdf-merge", { inputBytes }, () =>
        mergePdfs(
          usable.map((entry) => entry.file),
          (_, label) => setStatus(label ?? ""),
        ),
      );

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "merged.pdf";
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus(`Merged — ${formatBytes(blob.size)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Merge failed");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  const totalPages = entries.reduce((sum, entry) => sum + (entry.pages ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Merge PDFs</h1>
      <p className="mt-2 text-muted text-pretty">
        Combine any number of PDFs into one. Reorder them first — the merged
        file follows the order below.
      </p>

      <div className="mt-8">
        <FileDrop
          accept="application/pdf,.pdf"
          multiple
          label="Drop PDFs, or click to choose"
          hint="Add as many as you like; they stay on your device"
          disabled={busy}
          onFiles={(files) => void addFiles(files)}
        />
        {overflow ? (
          <BatchLimitNotice limit={overflow.limit} attempted={overflow.attempted} />
        ) : null}
      </div>

      {entries.length > 0 ? (
        <>
          <ol className="mt-6 space-y-2">
            {entries.map((entry, index) => (
              <li
                key={`${entry.file.name}-${index}`}
                className="flex items-center gap-3 rounded-[var(--radius-base)] border border-border bg-surface px-4 py-3"
              >
                <span className="w-6 shrink-0 text-sm text-muted tabular-nums">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.file.name}</p>
                  <p className="text-xs text-muted tabular-nums">
                    {formatBytes(entry.file.size)}
                    {entry.error
                      ? ` · ${entry.error}`
                      : entry.pages === null
                        ? " · reading…"
                        : ` · ${entry.pages} page${entry.pages === 1 ? "" : "s"}`}
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
                    disabled={busy || index === entries.length - 1}
                    onClick={() => move(index, 1)}
                    className="rounded border border-border px-2 py-1 text-xs disabled:opacity-35"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    disabled={busy}
                    onClick={() => remove(index)}
                    className="rounded border border-border px-2 py-1 text-xs text-danger disabled:opacity-35"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-3 text-sm text-muted tabular-nums">
            {entries.length} files · {totalPages} pages
          </p>
        </>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={entries.length < 2 || busy}
        className="mt-6 w-full rounded-[var(--radius-base)] bg-accent px-5 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-45"
      >
        {busy ? status || "Merging…" : "Merge and download"}
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
