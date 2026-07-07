"use client";

import { useMemo, useState } from "react";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { setMediaModel } from "@/app/settings/media/actions";
import { pricePerMillion, type OpenRouterModel } from "@/lib/media/models";
import type { MediaType } from "@/generated/prisma/enums";

// Rough per-article token footprint, for a ballpark cost estimate.
const EST_INPUT_TOKENS = 2000;
const EST_OUTPUT_TOKENS = 900;

function estimateCost(m: OpenRouterModel): string {
  const c = m.promptPrice * EST_INPUT_TOKENS + m.completionPrice * EST_OUTPUT_TOKENS;
  if (c === 0) return "Free";
  if (c < 0.01) return `~${(c * 100).toFixed(2)}¢/article`;
  return `~$${c.toFixed(3)}/article`;
}

/**
 * Picks the OpenRouter model for one media type. Filterable because the catalog
 * has hundreds of models; shows the selected model's per-token price and a rough
 * per-article estimate so cost is visible before you commit.
 */
export function ModelPicker({
  mediaType,
  label,
  current,
  models,
}: {
  mediaType: MediaType;
  label: string;
  current: string | null;
  models: OpenRouterModel[];
}) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(current ?? models[0]?.id ?? "");

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const base = q
      ? models.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      : models;
    // Always keep the selected model in the list even if it's filtered out.
    if (selected && !base.some((m) => m.id === selected)) {
      const sel = models.find((m) => m.id === selected);
      if (sel) return [sel, ...base];
    }
    return base;
  }, [filter, models, selected]);

  const selectedModel = models.find((m) => m.id === selected) ?? null;

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{label}</h3>
        <span className="text-xs text-muted-foreground">{models.length} models</span>
      </div>

      <SaveForm action={setMediaModel} successText="Model saved" className="space-y-3">
        <input type="hidden" name="mediaType" value={mediaType} />

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter models…"
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />

        <select
          name="modelId"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          size={8}
          className="w-full rounded-md border border-input bg-transparent p-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {shown.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {estimateCost(m)}
            </option>
          ))}
        </select>

        {selectedModel && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono">{selectedModel.id}</span>
            <span>Input {pricePerMillion(selectedModel.promptPrice)}</span>
            <span>Output {pricePerMillion(selectedModel.completionPrice)}</span>
            <span className="font-semibold text-foreground">{estimateCost(selectedModel)}</span>
          </div>
        )}

        <Button type="submit" size="sm">Save model</Button>
      </SaveForm>
    </div>
  );
}
