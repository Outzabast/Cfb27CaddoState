// Low-level OpenRouter chat call. One request/response; the agentic loop that
// drives tool calls lives in agent.ts. Returns the assistant message (which may
// contain tool calls) plus the billed cost OpenRouter reports.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatResult = {
  content: string;
  toolCalls: ToolCall[];
  costUsd: number | null;
};

/** Pull the first JSON object out of a model response (tolerates code fences). */
export function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model did not return JSON.");
  }
}

export type CallOptions = {
  tools?: ToolSchema[];
  /** Force a JSON object response (used for the final answer, no tools). */
  jsonResponse?: boolean;
  temperature?: number;
};

/** One chat completion. Throws with a readable message on any failure. */
export async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  opts: CallOptions = {},
): Promise<ChatResult> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) throw new Error("OPEN_ROUTER_API_KEY is not set on the server.");

  const body: Record<string, unknown> = {
    model,
    temperature: opts.temperature ?? 0.7,
    usage: { include: true },
    messages,
  };
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.jsonResponse) body.response_format = { type: "json_object" };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Caddo State Team Tools",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`Could not reach OpenRouter: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: unknown; tool_calls?: ToolCall[] } }[];
    usage?: { cost?: number };
    error?: { message?: string };
  };
  if (data.error) throw new Error(data.error.message || "OpenRouter returned an error.");

  const msg = data.choices?.[0]?.message;
  const raw = msg?.content;
  const content =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? raw
            .map((c) => (c && typeof c === "object" && "text" in c ? String((c as { text: unknown }).text) : ""))
            .join("")
        : "";

  return {
    content,
    toolCalls: msg?.tool_calls ?? [],
    costUsd: typeof data.usage?.cost === "number" ? data.usage.cost : null,
  };
}
