"use client";

import { useEffect, useRef, useState } from "react";
import FileDrop from "@/components/FileDrop";
import ToolMeta from "@/components/ToolMeta";
import { trackRun } from "@/lib/analytics";
import { formatBytes } from "@/lib/image/compress";
import { getPageCount, selectPages } from "@/lib/pdf/operations";
import { describePages, invertPages, parsePageRanges } from "@/lib/pdf/ranges";
import { toolTint } from "@/lib/tools";

type Mode = "keep" | "remove";

/**
 * Split a PDF, or delete pages from one.
 *
 * These are the same operation seen from either end — "keep 1-3" and "remove
 * 4-10" produce the same file — so they are one tool with a switch rather than
 * two pages that would compete with each other in search results and confuse
 * anyone who found the wrong one first.
 */
export default function PdfSplitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [spec, setSpec] = useState("");
  const [mode, setMode] = useState<Mode>("keep");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  // Guards against a slow page count for a file the user has already replaced.
  const token = useRef(0);

  /*
   * Only the async callbacks below set state. Clearing the count synchronously
   * here would be a setState inside an effect body, which cascades renders —
   * so the reset lives in the handler that swaps the file instead, where it
   * belongs anyway: replacing the file is the event, and this effect only
   * reports what the new one turned out to contain.
   */
  useEffect(() => {
    if (!file) return;

    const mine = ++token.current;
    void getPageCount(file)
      .then((count) => {
        if (token.current === mine) setTotal(count);
      })
      .catch(() => {
        if (token.current === mine) {
          setTotal(null);
          setError("That file could not be read as a PDF.");
        }
      });
  }, [file]);

  // Parsed on every keystroke so the summary below the field is always the
  // truth about what the button will do.
  const parsed = total === null ? null : parsePageRanges(spec, total);
  const selected =
    parsed && !parsed.error && total !== null
      ? mode === "keep"
        ? parsed.pages
        : invertPages(parsed.pages, total)
      : [];

  async function run() {
    if (!file || selected.length === 0) return;

    setBusy(true);
    setError(null);
    setStatus("");

    try {
      const blob = await trackRun("pdf-split", { inputBytes: file.size }, () =>
        selectPages(file, selected),
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name.replace(/\.pdf$/i, "") + "-pages.pdf";
      link.click();
      URL.revokeObjectURL(url);

      setStatus(
        `Done — ${selected.length} page${selected.length === 1 ? "" : "s"}, ${formatBytes(blob.size)}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Split failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`shell-narrow bleed py-[var(--space-l)] ${toolTint("pdf-split")}`}
    >
      <ToolMeta slug="pdf-split" />
      <h1 className="headline-sm">Split a PDF</h1>
      <p className="prose mt-[var(--space-2xs)] text-muted text-pretty">
        Pull out the pages you want, or drop the ones you do not. Name them the
        way you would to a printer — 1-3, 7, 9-12 — and the pages come out in
        the order you asked for.
      </p>

      <div className="mt-8">
        <FileDrop
          accept="application/pdf,.pdf"
          label={file ? file.name : "Drop a PDF, or click to choose"}
          hint={
            file
              ? `${formatBytes(file.size)}${total === null ? " · reading…" : ` · ${total} page${total === 1 ? "" : "s"}`}`
              : "Stays on your device — nothing is uploaded"
          }
          disabled={busy}
          onFiles={(files) => {
            setFile(files[0]);
            setTotal(null);
            setError(null);
            setStatus("");
          }}
        />
      </div>

      {file && total !== null ? (
        <div className="mt-6 grid gap-[var(--space-s)] sm:grid-cols-[auto_1fr] sm:items-start">
          <div>
            <label htmlFor="mode" className="label mb-[var(--space-3xs)] block">
              Then
            </label>
            <select
              id="mode"
              value={mode}
              disabled={busy}
              onChange={(event) => setMode(event.target.value as Mode)}
            >
              <option value="keep">Keep these pages</option>
              <option value="remove">Remove these pages</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="pages"
              className="label mb-[var(--space-3xs)] block"
            >
              Pages
            </label>
            <input
              id="pages"
              type="text"
              inputMode="numeric"
              value={spec}
              disabled={busy}
              placeholder={total >= 3 ? `1-3, ${total}` : "1"}
              onChange={(event) => setSpec(event.target.value)}
              aria-describedby="pages-summary"
            />
          </div>
        </div>
      ) : null}

      {file && total !== null ? (
        <p
          id="pages-summary"
          className="mt-[var(--space-2xs)] text-sm text-muted"
          role="status"
        >
          {spec.trim() === ""
            ? `This document has ${total} page${total === 1 ? "" : "s"}.`
            : parsed?.error
              ? parsed.error
              : selected.length === 0
                ? "That would remove every page."
                : `Result: ${selected.length} page${selected.length === 1 ? "" : "s"} — ${describePages(selected)}`}
        </p>
      ) : null}

      <button
        type="button"
        onClick={run}
        disabled={!file || selected.length === 0 || busy}
        className="mt-6 btn btn-primary btn-block"
      >
        {busy ? "Splitting…" : "Split and download"}
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
