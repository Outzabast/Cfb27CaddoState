"use client";

import { useMemo, useState } from "react";
import { pricePerMillion, type OpenRouterModel } from "@/lib/media/models";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const listClass =
  "w-full rounded-md border border-input bg-transparent p-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function priceLabel(m: OpenRouterModel): string {
  if (!m.promptPrice && !m.completionPrice) return "Free";
  return `${pricePerMillion(m.promptPrice)} in / ${pricePerMillion(m.completionPrice)} out`;
}

/**
 * Filterable model dropdown for a persona's text model. Emits `name` (default
 * "modelId"); empty value = fall back to the media type's model. The chosen model
 * is always kept in the list (even when filtered out or the catalog is empty), so
 * submitting never silently drops the current selection.
 */
export function PersonaModelSelect({
  models,
  name = "modelId",
  defaultValue = "",
}: {
  models: OpenRouterModel[];
  name?: string;
  defaultValue?: string;
}) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(defaultValue);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let base = q
      ? models.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      : models;
    if (selected && !base.some((m) => m.id === selected)) {
      const sel =
        models.find((m) => m.id === selected) ??
        ({
          id: selected,
          name: selected,
          contextLength: null,
          promptPrice: 0,
          completionPrice: 0,
          textInput: true,
          audioOutput: false,
        } satisfies OpenRouterModel);
      base = [sel, ...base];
    }
    return base;
  }, [filter, models, selected]);

  const selectedModel = selected ? models.find((m) => m.id === selected) : undefined;

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Search ${models.length} models…`}
        className={inputClass}
      />
      <select
        name={name}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        size={6}
        className={listClass}
      >
        <option value="">Use media-type default</option>
        {shown.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        {selected === "" ? (
          "Falls back to the media-type model."
        ) : (
          <>
            <span className="font-mono">{selected}</span>
            {selectedModel && ` · ${priceLabel(selectedModel)}`}
          </>
        )}
      </p>
    </div>
  );
}
