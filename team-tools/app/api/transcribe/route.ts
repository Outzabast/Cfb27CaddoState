// Speech-to-text for press-conference answers. The browser records the answer and
// decodes it to WAV, POSTs it here, and we hand it to an audio-capable model via
// OpenRouter's input_audio content part. Lives in a Route Handler (not a Server
// Action) because audio can exceed the 1MB action-body cap.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MAX_BYTES = 25 * 1024 * 1024; // 25MB
const DEFAULT_MODEL = "google/gemini-2.5-flash";

type Resp = { ok: true; text: string } | { ok: false; error: string };

function json(body: Resp, status = 200) {
  return Response.json(body, { status });
}

export async function POST(req: Request) {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) return json({ ok: false, error: "OPEN_ROUTER_API_KEY is not set." }, 500);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: "Expected an audio upload." }, 400);
  }
  const file = form.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return json({ ok: false, error: "No audio to transcribe." }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json({ ok: false, error: "Recording too long (max 25MB)." }, 400);
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const model = process.env.OPENROUTER_TRANSCRIBE_MODEL || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Caddo State Team Tools",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Transcribe this audio verbatim into plain text. Return ONLY the transcription — " +
                  "no quotes, labels, or commentary. If there's no discernible speech, return an empty string.",
              },
              { type: "input_audio", input_audio: { data: base64, format: "wav" } },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    return json({ ok: false, error: `Could not reach OpenRouter: ${(e as Error).message}` }, 502);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return json({ ok: false, error: `Transcription failed (${res.status}): ${text.slice(0, 200)}` }, 502);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
    error?: { message?: string };
  };
  if (data.error) return json({ ok: false, error: data.error.message || "Model error." }, 502);

  const raw = data.choices?.[0]?.message?.content;
  const text =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw.map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text: unknown }).text) : "")).join("")
        : "";

  return json({ ok: true, text: text.trim() });
}
