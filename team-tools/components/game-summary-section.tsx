"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SaveForm } from "@/components/save-form";

type SummaryAction = (formData: FormData) => Promise<void>;

/** The editable one-paragraph game summary shown between the score header and the
 *  play-by-play. Renders the paragraph read-only until the user opts into editing;
 *  a persona picker lets them (re)generate it in a chosen voice. */
export function GameSummarySection({
  seasonId,
  gameId,
  summary,
  personas,
  saveAction,
  regenerateAction,
}: {
  seasonId: number;
  gameId: number;
  summary: string | null;
  personas: { id: number; name: string }[];
  saveAction: SummaryAction;
  regenerateAction: SummaryAction;
}) {
  const [editing, setEditing] = useState(false);

  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

  const personaPicker = (
    <div className="flex flex-wrap items-center gap-2">
      <select name="personaId" defaultValue={personas[0]?.id ?? ""} className={selectClass}>
        {personas.length === 0 && <option value="">Default voice</option>}
        {personas.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );

  // Nothing written yet, and not editing → a quiet prompt to generate one.
  if (!summary && !editing) {
    return (
      <section className="mx-auto max-w-2xl space-y-2 text-center">
        <h2 className="eyebrow !text-foreground">Game Summary</h2>
        <p className="text-sm text-muted-foreground">No summary yet.</p>
        <SaveForm
          action={regenerateAction}
          loadingText="Writing summary…"
          successText="Summary generated"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          <input type="hidden" name="seasonId" value={seasonId} />
          <input type="hidden" name="gameId" value={gameId} />
          {personaPicker}
          <Button type="submit" size="sm">Generate summary</Button>
        </SaveForm>
      </section>
    );
  }

  // Read view.
  if (!editing) {
    return (
      <section className="mx-auto max-w-2xl space-y-2">
        <div className="flex items-center justify-center gap-3">
          <h2 className="eyebrow !text-foreground">Game Summary</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Edit
          </button>
        </div>
        <p className="text-center text-[15px] leading-relaxed text-pretty">{summary}</p>
      </section>
    );
  }

  // Edit view: hand-edit the text, or regenerate it in a chosen persona's voice.
  return (
    <section className="mx-auto max-w-2xl space-y-3">
      <h2 className="eyebrow !text-foreground text-center">Game Summary</h2>

      <SaveForm
        action={saveAction}
        successText="Summary saved"
        onSuccess={() => setEditing(false)}
        className="space-y-2"
      >
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="gameId" value={gameId} />
        <textarea
          name="summary"
          defaultValue={summary ?? ""}
          rows={5}
          className="min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">Save summary</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </SaveForm>

      <SaveForm
        action={regenerateAction}
        loadingText="Rewriting…"
        successText="Summary regenerated"
        className="flex flex-wrap items-center gap-2 border-t pt-3"
      >
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="gameId" value={gameId} />
        <span className="text-xs text-muted-foreground">Regenerate as</span>
        {personaPicker}
        <Button type="submit" variant="outline" size="sm">Regenerate</Button>
      </SaveForm>
    </section>
  );
}
