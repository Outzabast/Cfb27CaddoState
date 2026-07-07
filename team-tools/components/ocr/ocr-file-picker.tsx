"use client";

import { useRef, useState } from "react";
import { useOcr } from "./use-ocr";
import type { OcrKind, OcrResult } from "@/lib/ocr/kinds";
import { Button } from "@/components/ui/button";

/**
 * Pick a screenshot and read it. Calls `onResult` with the normalized data.
 * The picker stays usable after each read (the input clears) so several
 * screenshots can be stacked into one import.
 */
export function OcrFilePicker({
  kind,
  onResult,
  label = "Read screenshot",
  hint,
}: {
  kind: OcrKind;
  onResult: (result: OcrResult) => void;
  label?: string;
  hint?: string;
}) {
  const { run, loading, error } = useOcr(kind);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-sm"
        />
        <Button
          type="button"
          disabled={!file || loading}
          onClick={async () => {
            if (!file) return;
            const result = await run(file);
            if (result) {
              onResult(result);
              setFile(null);
              if (inputRef.current) inputRef.current.value = "";
            }
          }}
        >
          {loading ? "Reading…" : label}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
