"use client";

import { useState } from "react";
import FileDrop from "@/components/FileDrop";
import { recordToolRun } from "@/lib/analytics";
import { formatBytes } from "@/lib/image/compress";
import ToolMeta from "@/components/ToolMeta";
import { toolTint } from "@/lib/tools";
import {
  MAX_OFFICE_BYTES,
  OFFICE_ACCEPT,
  converterUrl,
  isConverterConfigured,
} from "@/lib/converter";

export default function OfficeToPdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!file) return;

    setBusy(true);
    setError(null);
    setStatus("Requesting a slot…");

    const started = performance.now();

    try {
      // The token proves the request came from this app recently. It is not a
      // login — see services/converter/src/token.ts for why.
      const tokenResponse = await fetch("/api/convert-token", {
        method: "POST",
      });
      if (!tokenResponse.ok) {
        throw new Error("Conversion is not available right now");
      }
      const { token } = (await tokenResponse.json()) as { token: string };

      setStatus("Converting… this one runs on a server and can take a moment");

      const body = new FormData();
      body.append("file", file, file.name);

      const response = await fetch(`${converterUrl}/convert`, {
        method: "POST",
        headers: { "x-convert-token": token },
        body,
      });

      if (!response.ok) {
        const detail = await response
          .json()
          .then((data: { error?: string }) => data.error)
          .catch(() => null);
        throw new Error(detail ?? `Conversion failed (${response.status})`);
      }

      const blob = await response.blob();

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${file.name.replace(/\.[^.]+$/, "")}.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);

      setStatus(`Converted — ${formatBytes(blob.size)}`);
      recordToolRun({
        toolId: "office-to-pdf",
        inputBytes: file.size,
        outputBytes: blob.size,
        durationMs: Math.round(performance.now() - started),
        succeeded: true,
      });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Conversion failed";
      setError(message);
      setStatus("");
      recordToolRun({
        toolId: "office-to-pdf",
        inputBytes: file.size,
        durationMs: Math.round(performance.now() - started),
        succeeded: false,
        errorCode: message.slice(0, 80),
      });
    } finally {
      setBusy(false);
    }
  }

  if (!isConverterConfigured) {
    return (
      <div
        className={`shell-narrow bleed py-[var(--space-l)] ${toolTint("office-to-pdf")}`}
      >
        <ToolMeta slug="office-to-pdf" />
        <h1 className="headline-sm">Office to PDF</h1>
        <p className="mt-3 text-muted text-pretty">
          This is the one tool that cannot run in your browser — converting
          PowerPoint, Word and Excel needs LibreOffice, which means a server.
        </p>
        <p className="mt-4 panel bg-panel px-4 py-3 text-sm text-muted">
          The conversion service is not connected to this deployment yet. Every
          other tool works normally.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`shell-narrow bleed py-[var(--space-l)] ${toolTint("office-to-pdf")}`}
    >
      <ToolMeta slug="office-to-pdf" />
      <h1 className="headline-sm">Office to PDF</h1>
      <p className="prose mt-[var(--space-2xs)] text-muted text-pretty">
        PowerPoint, Word and Excel into PDF. Unlike every other tool here, this
        one sends your file to a server — it is deleted as soon as the PDF is
        returned.
      </p>

      <div className="mt-8">
        <FileDrop
          accept={OFFICE_ACCEPT}
          label={file ? file.name : "Drop a document, or click to choose"}
          hint={
            file
              ? formatBytes(file.size)
              : `PPT, PPTX, DOC, DOCX, XLS, XLSX, ODT, ODS, ODP, RTF, CSV — up to ${formatBytes(MAX_OFFICE_BYTES)}`
          }
          disabled={busy}
          onFiles={(files) => {
            setFile(files[0]);
            setError(null);
            setStatus("");
          }}
        />
      </div>

      <button
        type="button"
        onClick={run}
        disabled={!file || busy}
        className="mt-6 btn btn-primary btn-block"
      >
        {busy ? status || "Converting…" : "Convert to PDF"}
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
