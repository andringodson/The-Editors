"use client";

import { useCallback, useId, useRef, useState } from "react";

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
 * Kept deliberately plain — this is the component most likely to be replaced
 * wholesale once the real design arrives, so nothing else depends on its
 * internals.
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

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  return (
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
  );
}
