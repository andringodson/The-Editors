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

  return (
    <div>
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
        className={[
          "rounded-[var(--radius-base)] border-2 border-dashed p-8 text-center transition-colors",
          disabled
            ? "cursor-not-allowed border-border opacity-60"
            : "cursor-pointer",
          isDragging
            ? "border-accent bg-accent-subtle"
            : "border-border-strong bg-surface hover:border-accent",
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
        <label htmlFor={inputId} className="block cursor-pointer font-medium">
          {label}
        </label>
        {hint ? <p className="mt-1.5 text-sm text-muted">{hint}</p> : null}
      </div>

      {rejection ? (
        <p
          role="alert"
          className="mt-3 rounded-[var(--radius-base)] border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {rejection}
        </p>
      ) : null}
    </div>
  );
}
