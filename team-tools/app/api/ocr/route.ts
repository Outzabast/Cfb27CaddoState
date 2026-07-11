import { extractWithOpenRouter } from "@/lib/ocr/openrouter";
import { normalizeResult, mergeOcrResults } from "@/lib/ocr/normalize";
import { isOcrKind, type OcrKind, type OcrResponse, type OcrResult } from "@/lib/ocr/kinds";

// Screenshots are far larger than the 1MB Server Action body cap, so OCR
// extraction (a read, not a mutation) lives in a Route Handler instead.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 500 * 1024 * 1024; // 500MB total — long play-by-play imports run big
// Vision accuracy degrades when too many images share one request, so a single
// model call gets at most this many images; any number is split into batches and
// merged. Dense, text-heavy logs (play-by-play, scoring summary) get a SMALLER
// batch so each is read accurately — these are captured across many overlapping
// screenshots, and cross-batch duplicates are reconciled in mergeOcrResults.
const DEFAULT_BATCH_SIZE = 8;
const BATCH_SIZE_BY_KIND: Partial<Record<OcrKind, number>> = {
  playByPlay: 3,
  scoringSummary: 4,
};
// We run at most this many model calls at once so a big import (20+ images) doesn't
// fan out into unbounded parallel requests.
const BATCH_CONCURRENCY = 4;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function json(body: OcrResponse, status = 200) {
  return Response.json(body, { status });
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: "Expected a multipart form upload." }, 400);
  }

  const kind = form.get("kind");
  if (!isOcrKind(kind)) {
    return json({ ok: false, error: "Unknown import kind." }, 400);
  }

  const files = form
    .getAll("image")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return json({ ok: false, error: "Choose at least one screenshot to import." }, 400);
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_BYTES) {
    return json({ ok: false, error: "Images are too large (max 500MB total)." }, 400);
  }

  try {
    // Split the FILES into per-kind-sized batches, then base64-encode each batch
    // only when its model call runs — so we never hold every image encoded in
    // memory at once (a big deal for the long play-by-play imports). Batches run
    // in bounded waves and the results are merged.
    const batchSize = BATCH_SIZE_BY_KIND[kind] ?? DEFAULT_BATCH_SIZE;
    const fileBatches: File[][] = [];
    for (let i = 0; i < files.length; i += batchSize) {
      fileBatches.push(files.slice(i, i + batchSize));
    }

    const encodeBatch = (batch: File[]): Promise<string[]> =>
      Promise.all(
        batch.map(async (file) => {
          const type = ALLOWED_TYPES.has(file.type) ? file.type : "image/png";
          const buffer = Buffer.from(await file.arrayBuffer());
          return `data:${type};base64,${buffer.toString("base64")}`;
        }),
      );

    const parts: OcrResult[] = [];
    for (let i = 0; i < fileBatches.length; i += BATCH_CONCURRENCY) {
      const wave = fileBatches.slice(i, i + BATCH_CONCURRENCY);
      const done = await Promise.all(
        wave.map(async (b) => normalizeResult(kind, await extractWithOpenRouter(kind, await encodeBatch(b)))),
      );
      parts.push(...done);
    }
    const result = mergeOcrResults(parts);
    return json({ ok: true, result });
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : "OCR failed." },
      502,
    );
  }
}
