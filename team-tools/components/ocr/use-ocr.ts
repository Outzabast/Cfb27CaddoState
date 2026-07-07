"use client";

import { useState } from "react";
import type { OcrKind, OcrResult, OcrResponse } from "@/lib/ocr/kinds";

/** POST a screenshot to the OCR route and return the normalized result. */
async function runOcr(kind: OcrKind, file: File): Promise<OcrResult> {
  const fd = new FormData();
  fd.set("kind", kind);
  fd.set("image", file);
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

  async function run(file: File): Promise<OcrResult | null> {
    setLoading(true);
    setError(null);
    try {
      return await runOcr(kind, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { run, loading, error, setError };
}
