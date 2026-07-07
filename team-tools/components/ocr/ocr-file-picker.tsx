"use client";

import { useRef, useState } from "react";
import { useOcr } from "./use-ocr";
import type { OcrKind, OcrResult } from "@/lib/ocr/kinds";
import { Button } from "@/components/ui/button";

/**
 * Pick one or more screenshots and read them in a single OCR request — the
 * model sees all of them together and returns one combined result. The picker
 * stays usable after each read (the input clears) so more can be added later.
 */
export function OcrFilePicker({
  kind,
  onResult,
  label = "Read screenshot(s)",
  hint,
}: {
  kind: OcrKind;
  onResult: (result: OcrResult) => void;
  label?: string;
  hint?: string;
}) {
  const { run, loading, error } = useOcr(kind);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const buttonText = loading
    ? "Reading…"
    : files.length > 1
      ? `Read ${files.length} screenshots`
      : label;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-sm"
        />
        <Button
          type="button"
          disabled={files.length === 0 || loading}
          onClick={async () => {
            if (files.length === 0) return;
            const result = await run(files);
            if (result) {
              onResult(result);
              setFiles([]);
              if (inputRef.current) inputRef.current.value = "";
            }
          }}
        >
          {buttonText}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
