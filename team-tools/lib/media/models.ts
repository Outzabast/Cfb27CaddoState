// Fetches the OpenRouter model catalog so the settings page can list models and
// show their per-token cost. Live data — pricing drifts, so we never store it.

const MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";

export type OpenRouterModel = {
  id: string;
  name: string;
  contextLength: number | null;
  /** USD per prompt (input) token. */
  promptPrice: number;
  /** USD per completion (output) token. */
  completionPrice: number;
  /** True when this model can take text input (excludes image-only models). */
  textInput: boolean;
  /** True when this model can output audio (for the AUDIO media type). */
  audioOutput: boolean;
};

type RawModel = {
  id?: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
};

/**
 * Get the OpenRouter catalog, sorted by name. Text-input models only (we generate
 * from text). Throws with a readable message on any config/network failure.
 */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  let res: Response;
  try {
    res = await fetch(MODELS_ENDPOINT, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      // The catalog changes rarely; let Next cache it for an hour.
      next: { revalidate: 3600 },
    });
  } catch (e) {
    throw new Error(`Could not reach OpenRouter: ${(e as Error).message}`);
  }
  if (!res.ok) {
    throw new Error(`OpenRouter models error ${res.status}.`);
  }

  const data = (await res.json()) as { data?: RawModel[] };
  const rows = Array.isArray(data.data) ? data.data : [];

  return rows
    .filter((m): m is RawModel & { id: string } => typeof m.id === "string")
    .map((m) => ({
      id: m.id,
      name: m.name || m.id,
      contextLength: typeof m.context_length === "number" ? m.context_length : null,
      promptPrice: Number(m.pricing?.prompt ?? 0) || 0,
      completionPrice: Number(m.pricing?.completion ?? 0) || 0,
      textInput: (m.architecture?.input_modalities ?? ["text"]).includes("text"),
      audioOutput: (m.architecture?.output_modalities ?? []).includes("audio"),
    }))
    .filter((m) => m.textInput || m.audioOutput)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Format a per-token price as $/million tokens, the unit humans reason about. */
export function pricePerMillion(perToken: number): string {
  if (!perToken) return "Free";
  const perM = perToken * 1_000_000;
  return `$${perM >= 1 ? perM.toFixed(2) : perM.toPrecision(2)}/M`;
}
