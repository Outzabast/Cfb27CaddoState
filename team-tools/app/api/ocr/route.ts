import { extractWithOpenRouter } from "@/lib/ocr/openrouter";
import { normalizeResult } from "@/lib/ocr/normalize";
import { isOcrKind, type OcrResponse } from "@/lib/ocr/kinds";

// Screenshots are far larger than the 1MB Server Action body cap, so OCR
// extraction (a read, not a mutation) lives in a Route Handler instead.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB total across all images
const MAX_IMAGES = 8;
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
  if (files.length > MAX_IMAGES) {
    return json({ ok: false, error: `Too many images (max ${MAX_IMAGES} per import).` }, 400);
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_BYTES) {
    return json({ ok: false, error: "Images are too large (max 20MB total)." }, 400);
  }

  try {
    const dataUrls = await Promise.all(
      files.map(async (file) => {
        const type = ALLOWED_TYPES.has(file.type) ? file.type : "image/png";
        const buffer = Buffer.from(await file.arrayBuffer());
        return `data:${type};base64,${buffer.toString("base64")}`;
      }),
    );
    const raw = await extractWithOpenRouter(kind, dataUrls);
    const result = normalizeResult(kind, raw);
    return json({ ok: true, result });
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : "OCR failed." },
      502,
    );
  }
}
