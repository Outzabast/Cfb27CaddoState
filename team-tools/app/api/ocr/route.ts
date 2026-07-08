import { extractWithOpenRouter } from "@/lib/ocr/openrouter";
import { normalizeResult, mergeOcrResults } from "@/lib/ocr/normalize";
import { isOcrKind, type OcrResponse, type OcrResult } from "@/lib/ocr/kinds";

// Screenshots are far larger than the 1MB Server Action body cap, so OCR
// extraction (a read, not a mutation) lives in a Route Handler instead.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 40 * 1024 * 1024; // 40MB total (the real guardrail: memory/cost)
// Vision accuracy degrades when too many images share one request, so a single
// model call gets at most BATCH_SIZE images; any number of images is split into
// that many batches and merged. No image-count cap — batching handles it — but
// we run at most BATCH_CONCURRENCY batches at once so a big import doesn't fan
// out into unbounded parallel requests.
const BATCH_SIZE = 8;
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
    return json({ ok: false, error: "Images are too large (max 40MB total)." }, 400);
  }

  try {
    const dataUrls = await Promise.all(
      files.map(async (file) => {
        const type = ALLOWED_TYPES.has(file.type) ? file.type : "image/png";
        const buffer = Buffer.from(await file.arrayBuffer());
        return `data:${type};base64,${buffer.toString("base64")}`;
      }),
    );

    // Split into ≤BATCH_SIZE-image requests so each model call stays clean, then
    // run them in bounded waves and merge the results.
    const batches: string[][] = [];
    for (let i = 0; i < dataUrls.length; i += BATCH_SIZE) {
      batches.push(dataUrls.slice(i, i + BATCH_SIZE));
    }
    const parts: OcrResult[] = [];
    for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
      const wave = batches.slice(i, i + BATCH_CONCURRENCY);
      const done = await Promise.all(
        wave.map(async (b) => normalizeResult(kind, await extractWithOpenRouter(kind, b))),
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
