"use client";

import { useState } from "react";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PersonaSelect, type PersonaOption } from "@/components/media/persona-select";
import { PlayerMultiSelect, type PlayerOption } from "@/components/media/player-multi-select";
import { createManualEvent } from "@/app/media/actions";
import { MEDIA_TYPE_LABELS, MEDIA_TYPES } from "@/lib/media/constants";
import type { MediaScope } from "@/generated/prisma/enums";

export type GameOption = { id: number; label: string };
export type SeasonOption = { id: number; name: string };

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Hand-compose a mediaEvent: pick type, subject, personas, and any context. */
export function NewEventForm({
  games,
  seasons,
  players,
  personas,
}: {
  games: GameOption[];
  seasons: SeasonOption[];
  players: PlayerOption[];
  personas: PersonaOption[];
}) {
  const [scope, setScope] = useState<MediaScope>("GAME");

  return (
    <SaveForm action={createManualEvent} successText="Posted to the media space" className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="mediaType">Media type</Label>
          <select id="mediaType" name="mediaType" className={selectClass} defaultValue="ARTICLE">
            {MEDIA_TYPES.map((t) => (
              <option key={t} value={t}>
                {MEDIA_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="scope">About</Label>
          <select
            id="scope"
            name="scope"
            className={selectClass}
            value={scope}
            onChange={(e) => setScope(e.target.value as MediaScope)}
          >
            <option value="GAME">A game</option>
            <option value="TEAM">A season / the team</option>
            <option value="PLAYER">A player</option>
          </select>
        </div>
      </div>

      {scope === "PLAYER" ? (
        <PlayerMultiSelect players={players} name="subjectPlayerId" label="Players this article is about" />
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="subjectId">Subject</Label>
          <select id="subjectId" name="subjectId" className={selectClass} key={scope}>
            {scope === "GAME" &&
              games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            {scope === "TEAM" &&
              seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="grid gap-2">
        <Label>Written by</Label>
        <PersonaSelect personas={personas} />
      </div>

      {scope !== "PLAYER" && (
        <PlayerMultiSelect
          players={players}
          name="mediaPlayerId"
          label="Also write player features for (optional)"
        />
      )}

      <div className="grid gap-2">
        <Label htmlFor="mediaContext">Context the stats don&rsquo;t show (optional)</Label>
        <textarea
          id="mediaContext"
          name="mediaContext"
          placeholder="Anything the numbers miss — a storyline, a milestone, an injury…"
          className={textareaClass}
        />
      </div>

      <Button type="submit">Post &amp; generate</Button>
    </SaveForm>
  );
}
