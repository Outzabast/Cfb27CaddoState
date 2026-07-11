"use client";

import { useState } from "react";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPressConference } from "@/app/press/actions";

export type Opt = { id: number; label: string };
export type GameOpt = { id: number; label: string; played: boolean };

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function PressSetupForm({
  games,
  seasons,
  players,
  staff,
  personas,
}: {
  games: GameOpt[];
  seasons: Opt[];
  players: Opt[];
  staff: Opt[];
  personas: Opt[];
}) {
  const [occasion, setOccasion] = useState<"game" | "season">("game");
  const [subjectKind, setSubjectKind] = useState<"player" | "staff">("player");
  const [gameId, setGameId] = useState(games[0]?.id ?? 0);

  const selectedGame = games.find((g) => g.id === gameId);
  const gameType = selectedGame?.played ? "Post-game" : "Pre-game";

  return (
    <SaveForm action={createPressConference} loadingText="Starting…" successText="Press conference started" className="space-y-6">
      {/* Occasion */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Occasion</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="occasion" value="game" checked={occasion === "game"} onChange={() => setOccasion("game")} />
            A game
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="occasion" value="season" checked={occasion === "season"} onChange={() => setOccasion("season")} />
            A season
          </label>
        </div>

        {occasion === "game" ? (
          <div className="grid gap-2">
            <Label htmlFor="gameId">Game</Label>
            <select
              id="gameId"
              name="gameId"
              className={selectClass}
              value={gameId}
              onChange={(e) => setGameId(Number(e.target.value))}
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              This will be a <span className="font-semibold">{gameType}</span> press conference
              {selectedGame?.played ? " (result recorded)" : " (not yet played)"}.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="seasonId">Season</Label>
              <select id="seasonId" name="seasonId" className={selectClass}>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="seasonPhase">Phase</Label>
              <select id="seasonPhase" name="seasonPhase" className={selectClass} defaultValue="pre">
                <option value="pre">Preseason</option>
                <option value="post">Postseason</option>
              </select>
            </div>
          </div>
        )}
      </fieldset>

      {/* Subject */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">At the podium</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="subjectKind" value="player" checked={subjectKind === "player"} onChange={() => setSubjectKind("player")} />
            Player
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="subjectKind" value="staff" checked={subjectKind === "staff"} onChange={() => setSubjectKind("staff")} />
            Staff
          </label>
        </div>
        <select name="subjectId" className={selectClass} key={subjectKind}>
          {(subjectKind === "player" ? players : staff).map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </fieldset>

      {/* Reporters */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Reporters asking</legend>
        {personas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No author personas yet — a default beat writer will ask. Add personas in Settings.
          </p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {personas.map((p, i) => (
              <label key={p.id} className="flex items-center gap-2">
                <input type="checkbox" name="personaId" value={p.id} defaultChecked={i < 3} />
                {p.label}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {/* Caps */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="maxTotal">Total questions</Label>
          <Input id="maxTotal" name="maxTotal" type="number" min={1} max={30} defaultValue={10} className="w-28" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="maxPerPersona">Max per reporter</Label>
          <Input id="maxPerPersona" name="maxPerPersona" type="number" min={1} max={5} defaultValue={2} className="w-28" />
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-md border bg-muted/20 p-3 text-sm">
        <input type="checkbox" name="speakQuestions" className="mt-0.5 size-4" />
        <span>
          <span className="font-medium">Read questions aloud</span>
          <span className="block text-xs text-muted-foreground">
            Voices each reporter&rsquo;s question with their configured TTS voice — pricier
            and a bit slower, so leave off unless you want to hear it.
          </span>
        </span>
      </label>

      <Button type="submit">Start press conference</Button>
    </SaveForm>
  );
}
