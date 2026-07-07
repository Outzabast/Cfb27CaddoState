"use client";

import { useState } from "react";
import { PersonaSelect, type PersonaOption } from "@/components/media/persona-select";

export type { PersonaOption };

const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * The "Generate media" opt-in that rides along on a save form. When checked it
 * reveals a context box (for the stuff the stats don't show — a walk-off catch,
 * an NIL transfer) and a byline picker. The host form's action reads these via
 * `readMediaTrigger` and queues an article. Renders nothing but form fields, so
 * it drops inside any existing <form>.
 */
export function MediaTriggerFields({
  personas,
  label = "Generate media from this",
}: {
  personas: PersonaOption[];
  label?: string;
}) {
  const [on, setOn] = useState(false);

  return (
    <div className="rounded-md border bg-secondary/30 p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name="generateMedia"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
        />
        {label}
      </label>

      {on && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Context the stats don&rsquo;t show (optional)
            </span>
            <textarea
              name="mediaContext"
              placeholder="e.g. Transferred in on a big NIL deal · caught the winning TD on the final play"
              className={textareaClass}
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Written by
            </span>
            <PersonaSelect personas={personas} />
          </div>
          <p className="text-xs text-muted-foreground">
            The article writes in the background — check the Media tab in a moment.
          </p>
        </div>
      )}
    </div>
  );
}
