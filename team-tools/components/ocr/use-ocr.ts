"use client";

import { useState } from "react";
import type { OcrKind, OcrResult, OcrResponse } from "@/lib/ocr/kinds";

/**
 * POST one or more screenshots to the OCR route as a single request. The model
 * sees all of them together and returns one combined, normalized result.
 */
async function runOcr(kind: OcrKind, files: File[]): Promise<OcrResult> {
  const fd = new FormData();
  fd.set("kind", kind);
  for (const file of files) fd.append("image", file);
  const res = await fetch("/api/ocr", { method: "POST", body: fd });
  let data: OcrResponse;
  try {
    data = (await res.json()) as OcrResponse;
  } catch {
    throw new Error(`OCR request failed (${res.status}).`);
  }
  if (!data.ok) throw new Error(data.error);
  return data.result;
}

/** Client hook wrapping the OCR request with loading + error state. */
export function useOcr(kind: OcrKind) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(files: File[]): Promise<OcrResult | null> {
    if (files.length === 0) return null;
    setLoading(true);
    setError(null);
    try {
      return await runOcr(kind, files);
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { run, loading, error, setError };
}
