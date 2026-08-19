"use client";

import { useCallback, useId, useRef, useState } from "react";
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
 * Drop zone / file picker.
 *
 * Size limits are enforced here rather than in each tool, so no page can forget
 * them. The rejection message renders inline — a file too large to process is a
 * property of the file, not of whatever the tool was about to do with it.
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
        <span>{spec}</span>
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
