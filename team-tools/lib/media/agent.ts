// The writing agent: a bounded tool-calling loop. The model researches with the
// read-only tools (tools.ts), then returns the final article as JSON. Falls back
// to a single tool-less JSON call if the model can't do tool calls, so any model
// the user picks still produces something.

import {
  callOpenRouter,
  parseJsonLoose,
  type ChatMessage,
} from "./openrouter";
import { MEDIA_TOOLS, runTool } from "./tools";

const MAX_STEPS = 6; // research rounds before we force the final answer
const MAX_TOOL_RESULT = 6000; // chars per tool result fed back to the model

export type WrittenArticle = {
  headline: string;
  body: string;
  costUsd: number | null;
  toolCalls: number;
};

function finalize(content: string, cost: number, toolCalls: number): WrittenArticle {
  const parsed = parseJsonLoose(content) as { headline?: unknown; body?: unknown };
  const headline = String(parsed.headline ?? "").trim();
  const body = String(parsed.body ?? "").trim();
  if (!headline || !body) throw new Error("Model response was missing a headline or body.");
  return { headline, body, costUsd: cost || null, toolCalls };
}

/** One tool-less call that forces a JSON article (fallback + final safety net). */
async function oneShotJson(model: string, system: string, seed: string): Promise<WrittenArticle> {
  const { content, costUsd } = await callOpenRouter(
    model,
    [
      { role: "system", content: system },
      { role: "user", content: `${seed}\n\nRespond with ONLY the JSON object now.` },
    ],
    { jsonResponse: true },
  );
  return finalize(content, costUsd ?? 0, 0);
}

/**
 * Draft an article. The model may call research tools across several rounds; when
 * it stops calling tools it should return the JSON article. Costs accumulate
 * across every round.
 */
export async function writeArticle(
  model: string,
  system: string,
  seed: string,
): Promise<WrittenArticle> {
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: seed },
  ];
  let cost = 0;
  let toolCalls = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    let res;
    try {
      res = await callOpenRouter(model, messages, { tools: MEDIA_TOOLS });
    } catch (e) {
      // Model likely can't do tool calls — degrade to a plain JSON generation.
      if (step === 0) return oneShotJson(model, system, seed);
      throw e;
    }
    cost += res.costUsd ?? 0;

    if (res.toolCalls.length > 0) {
      messages.push({ role: "assistant", content: res.content || "", tool_calls: res.toolCalls });
      for (const tc of res.toolCalls) {
        toolCalls++;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          /* leave args empty; the tool will report a missing-arg error */
        }
        const result = await runTool(tc.function.name, args);
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result.slice(0, MAX_TOOL_RESULT),
        });
      }
      continue;
    }

    // No tool calls — this should be the article.
    if (res.content.trim()) return finalize(res.content, cost, toolCalls);
    break;
  }

  // Ran out of research rounds (or got empty content): force the final answer,
  // keeping whatever the model has already gathered in context.
  messages.push({
    role: "user",
    content: "Stop researching and respond with ONLY the JSON article object now.",
  });
  const finalRes = await callOpenRouter(model, messages, { jsonResponse: true });
  cost += finalRes.costUsd ?? 0;
  return finalize(finalRes.content, cost, toolCalls);
}
