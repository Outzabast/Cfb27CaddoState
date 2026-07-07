import { extractWithOpenRouter } from "@/lib/ocr/openrouter";
import { normalizeResult } from "@/lib/ocr/normalize";
import { isOcrKind, type OcrResponse } from "@/lib/ocr/kinds";

// Screenshots are far larger than the 1MB Server Action body cap, so OCR
// extraction (a read, not a mutation) lives in a Route Handler instead.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB
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

  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return json({ ok: false, error: "Choose a screenshot to import." }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json({ ok: false, error: "Image is too large (max 15MB)." }, 400);
  }
  const type = ALLOWED_TYPES.has(file.type) ? file.type : "image/png";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${type};base64,${buffer.toString("base64")}`;
    const raw = await extractWithOpenRouter(kind, dataUrl);
    const result = normalizeResult(kind, raw);
    return json({ ok: true, result });
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : "OCR failed." },
      502,
    );
  }
}
