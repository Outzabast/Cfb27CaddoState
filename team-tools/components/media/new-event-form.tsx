"use client";

import { useState } from "react";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PersonaSelect, type PersonaOption } from "@/components/media/persona-select";
import { PlayerMultiSelect, type PlayerOption } from "@/components/media/player-multi-select";
import { GameMultiSelect } from "@/components/media/game-multi-select";
import { createManualEvent } from "@/app/media/actions";
import { MEDIA_TYPE_LABELS, MEDIA_TYPES } from "@/lib/media/constants";
import { MEDIA_ANGLES, angleBySlug } from "@/lib/media/angles";

export type GameOption = { id: number; label: string; played: boolean };
export type SeasonOption = { id: number; name: string };
export type RecruitOption = { id: number; label: string };
export type StaffOption = { id: number; label: string };

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Hand-compose a mediaEvent: pick the article type (angle), subject, personas,
 *  and any context. */
export function NewEventForm({
  games,
  seasons,
  players,
  recruits,
  staff,
  personas,
}: {
  games: GameOption[];
  seasons: SeasonOption[];
  players: PlayerOption[];
  recruits: RecruitOption[];
  staff: StaffOption[];
  personas: PersonaOption[];
}) {
  const [angle, setAngle] = useState(MEDIA_ANGLES[0].slug);
  const meta = angleBySlug(angle)!;

  const gameOptions = games.map((g) => ({ id: g.id, label: g.label }));

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
          <Label htmlFor="angle">Article type</Label>
          <select
            id="angle"
            name="angle"
            className={selectClass}
            value={angle}
            onChange={(e) => setAngle(e.target.value)}
          >
            {MEDIA_ANGLES.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{meta.blurb}</p>

      {/* Subject picker depends on the angle */}
      {meta.subject === "players" ? (
        <>
          <PlayerMultiSelect players={players} name="subjectPlayerId" label="Players this article is about" />
          <GameMultiSelect
            games={gameOptions}
            name="focusGameId"
            label="Focus games (optional — center the piece on these)"
          />
        </>
      ) : meta.subject === "season" ? (
        <div className="grid gap-2">
          <Label htmlFor="subjectId">Season</Label>
          <select id="subjectId" name="subjectId" className={selectClass}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : meta.subject === "recruit" ? (
        <div className="grid gap-2">
          <Label htmlFor="subjectId">Recruit</Label>
          {recruits.length ? (
            <select id="subjectId" name="subjectId" className={selectClass}>
              {recruits.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-muted-foreground">
              No recruits yet — add one on the Recruits page first.
            </p>
          )}
        </div>
      ) : meta.subject === "staff" ? (
        <div className="grid gap-2">
          <Label htmlFor="subjectId">Staff member</Label>
          {staff.length ? (
            <select id="subjectId" name="subjectId" className={selectClass}>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-muted-foreground">
              No staff yet — assign coaches from a season&rsquo;s home page first.
            </p>
          )}
        </div>
      ) : (
        // gamePlayed (recap) or gameUpcoming (preview)
        <div className="grid gap-2">
          <Label htmlFor="subjectId">
            {meta.subject === "gameUpcoming" ? "Upcoming game" : "Game"}
          </Label>
          <select id="subjectId" name="subjectId" className={selectClass} key={meta.subject}>
            {games
              .filter((g) => (meta.subject === "gameUpcoming" ? !g.played : g.played))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
          </select>
          {meta.subject === "gameUpcoming" && (
            <p className="text-xs text-muted-foreground">
              Only unplayed games are listed. Add matchup context below.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-2">
        <Label>Written by</Label>
        <PersonaSelect personas={personas} />
      </div>

      {/* GAME/TEAM angles can also spin off separate player features */}
      {(meta.scope === "GAME" || meta.scope === "TEAM") && (
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
          placeholder="Anything the numbers miss — a storyline, a milestone, an injury, matchup angle…"
          className={textareaClass}
        />
      </div>

      <Button type="submit">Post &amp; generate</Button>
    </SaveForm>
  );
}
