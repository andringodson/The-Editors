"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { checkBatch, checkImageFile, checkPdfFile } from "@/lib/limits";

interface FileDropProps {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/**
 * Drop zone, file picker, and paste target.
 *
 * Size limits are enforced here rather than in each tool, so no page can forget
 * them. The rejection message renders inline — a file too large to process is a
 * property of the file, not of whatever the tool was about to do with it.
 *
 * Paste is handled here for the same reason: every tool gets it from one
 * implementation. "My screenshot is too big" is one of the most common versions
 * of this problem, and without paste it means saving to disk and finding the
 * file again for no reason.
 */
export default function FileDrop({
  accept,
  multiple = false,
  onFiles,
  label,
  hint,
  disabled = false,
}: FileDropProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const [rejection, setRejection] = useState<string | null>(null);

  const validate = useCallback(
    (files: File[]): string | null => {
      const wantsPdf = accept.includes("pdf");

      for (const file of files) {
        const failure = wantsPdf ? checkPdfFile(file) : checkImageFile(file);
        if (failure) return failure.message;
      }

      if (files.length > 1) {
        const failure = checkBatch(files);
        if (failure) return failure.message;
      }

      return null;
    },
    [accept],
  );

  /**
   * Does this file match what the input asked for?
   *
   * A clipboard image arrives as `image/png` with no useful name, so the check
   * has to be on the MIME type. Wildcards are compared by their prefix, the way
   * the `accept` attribute itself works.
   */
  const wanted = useCallback(
    (file: File) =>
      accept.split(",").some((pattern) => {
        const want = pattern.trim();
        if (want.endsWith("/*")) return file.type.startsWith(want.slice(0, -1));
        if (want.startsWith(".")) return file.name.toLowerCase().endsWith(want);
        return file.type === want;
      }),
    [accept],
  );

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const files = Array.from(list);

      const problem = validate(files);
      if (problem) {
        setRejection(problem);
        return;
      }

      setRejection(null);
      onFiles(files);
    },
    [onFiles, validate],
  );

  useEffect(() => {
    if (disabled) return;

    const onPaste = (event: ClipboardEvent) => {
      // Never steal a paste meant for a field. Someone typing a target size
      // pastes numbers into it, and that has to keep working.
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable]") !==
          null &&
        target?.closest("input, textarea, select, [contenteditable]") !==
          undefined
      ) {
        return;
      }

      const pasted = Array.from(event.clipboardData?.files ?? []).filter(
        wanted,
      );
      if (pasted.length === 0) return;

      event.preventDefault();
      const list = multiple ? pasted : pasted.slice(0, 1);

      const problem = validate(list);
      if (problem) {
        setRejection(problem);
        return;
      }
      setRejection(null);
      onFiles(list);
    };

    // On the window rather than the drop zone: a paste is aimed at the page, and
    // asking someone to focus a div first would defeat the point.
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [disabled, multiple, onFiles, validate, wanted]);

  /* A short specification for the panel's right-hand corner, derived from the
     accept list rather than passed in, so it cannot contradict what the input
     will actually take. */
  const spec = accept.includes("pdf")
    ? "PDF"
    : accept.includes("image")
      ? "JPG / PNG / WEBP"
      : "Any file";

  return (
    <div className="panel" data-fluid>
      <div className="panel-meta">
        <span>
          Input <span className="text-accent">/</span>{" "}
          {multiple ? "drop or choose files" : "drop or choose a file"}
        </span>
        <span>
          <span className="hidden sm:inline">Paste, drop or pick</span>
          <span className="sm:hidden">{spec}</span>
        </span>
      </div>

      <div
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        /*
         * The dashed guide sits inside the panel rather than replacing its
         * border, so the "drop here" affordance reads without breaking the
         * grid the panel belongs to.
         *
         * Disabled state is a colour change, never opacity: fading drags the
         * muted text below 4.5:1, which is the exact threshold that colour was
         * picked to clear.
         */
        className={[
          "p-[var(--space-l)] text-center outline-2 -outline-offset-8 outline-dashed transition-colors",
          disabled
            ? "cursor-not-allowed outline-transparent"
            : "cursor-pointer hover:bg-accent-dim",
          isDragging ? "bg-accent-dim outline-accent" : "outline-line",
        ].join(" ")}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            // Allow re-selecting the same file after a reset.
            event.target.value = "";
          }}
        />
        <label
          htmlFor={inputId}
          className={[
            "label block cursor-pointer",
            disabled ? "" : "text-foreground",
          ].join(" ")}
        >
          {label}
        </label>
        {hint ? (
          <p className="label-tight mt-[var(--space-2xs)]">{hint}</p>
        ) : null}
        <p className="label-tight mt-[var(--space-2xs)] hidden sm:block">
          <span className="text-accent">or</span> press{" "}
          <kbd className="border border-line px-1">Ctrl</kbd>
          <span aria-hidden="true"> + </span>
          <kbd className="border border-line px-1">V</kbd> to paste{" "}
          {spec === "PDF" ? "a PDF" : "a screenshot"}
        </p>
      </div>

      {rejection ? (
        <p
          role="alert"
          className="label border-t border-line px-[var(--space-xs)] py-[var(--space-2xs)] text-danger"
        >
          {rejection}
        </p>
      ) : null}
    </div>
  );
}
