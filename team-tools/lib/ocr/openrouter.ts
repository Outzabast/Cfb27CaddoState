import { buildPrompt } from "./prompts";
import type { OcrKind } from "./kinds";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

/** Pull the first JSON object out of a model response (tolerates code fences). */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall back to the first {...} block (handles ```json fences / stray prose).
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model did not return JSON.");
  }
}

/**
 * Send an image to the configured OpenRouter vision model and get back the raw
 * parsed JSON for the given OCR kind. Throws with a readable message on any
 * config/network/parse failure.
 */
export async function extractWithOpenRouter(
  kind: OcrKind,
  imageDataUrls: string[],
): Promise<unknown> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPEN_ROUTER_API_KEY is not set on the server.");
  }
  if (imageDataUrls.length === 0) throw new Error("No images to read.");
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const { system, instruction } = buildPrompt(kind);

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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              ...imageDataUrls.map((url) => ({
                type: "image_url" as const,
                image_url: { url },
              })),
            ],
          },
        ],
      }),
    });
  } catch (e) {
    throw new Error(`Could not reach OpenRouter: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: unknown } }[];
    error?: { message?: string };
  };
  if (data.error) throw new Error(data.error.message || "OpenRouter returned an error.");

  const content = data.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text: unknown }).text) : ""))
            .join("")
        : "";
  if (!text.trim()) throw new Error("Model returned an empty response.");

  return parseJsonLoose(text);
}
