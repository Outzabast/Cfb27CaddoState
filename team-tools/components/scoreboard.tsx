"use client";

import { useState } from "react";
import { updateScoreboard } from "@/app/seasons/[id]/schedule/[gameId]/box-score/actions";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";

type Vals = {
  teamQ1: number; teamQ2: number; teamQ3: number; teamQ4: number; teamOt: number;
  oppQ1: number; oppQ2: number; oppQ3: number; oppQ4: number; oppOt: number;
};

const QUARTERS = [
  { label: "1", team: "teamQ1", opp: "oppQ1" },
  { label: "2", team: "teamQ2", opp: "oppQ2" },
  { label: "3", team: "teamQ3", opp: "oppQ3" },
  { label: "4", team: "teamQ4", opp: "oppQ4" },
] as const;
const OT = { label: "OT", team: "teamOt", opp: "oppOt" } as const;

export function Scoreboard({
  seasonId,
  gameId,
  teamName,
  oppName,
  values,
}: {
  seasonId: number;
  gameId: number;
  teamName: string;
  oppName: string;
  values: Vals;
}) {
  const [v, setV] = useState<Vals>(values);
  const [showOt, setShowOt] = useState(values.teamOt > 0 || values.oppOt > 0);

  const set = (k: keyof Vals) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((s) => ({ ...s, [k]: Math.max(0, Number(e.target.value || 0)) }));

  const cols = showOt ? [...QUARTERS, OT] : [...QUARTERS];
  const teamFinal =
    v.teamQ1 + v.teamQ2 + v.teamQ3 + v.teamQ4 + (showOt ? v.teamOt : 0);
  const oppFinal = v.oppQ1 + v.oppQ2 + v.oppQ3 + v.oppQ4 + (showOt ? v.oppOt : 0);

  const cell =
    "h-9 w-12 rounded-md border border-input bg-transparent text-center text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

  return (
    <SaveForm action={updateScoreboard} successText="Score saved" className="space-y-3">
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="gameId" value={gameId} />

      <div className="w-fit overflow-x-auto rounded-lg border">
        <table className="border-collapse">
          <thead>
            <tr className="text-xs font-semibold uppercase text-muted-foreground">
              <th className="px-3 py-2 text-left"></th>
              {cols.map((c) => (
                <th key={c.label} className="px-2 py-2 text-center">
                  {c.label}
                </th>
              ))}
              <th className="border-l px-3 py-2 text-center">Final</th>
            </tr>
          </thead>
          <tbody>
            {(["team", "opp"] as const).map((side) => {
              const name = side === "team" ? teamName : oppName;
              const final = side === "team" ? teamFinal : oppFinal;
              return (
                <tr key={side} className="border-t">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{name}</td>
                  {cols.map((c) => {
                    const k = c[side] as keyof Vals;
                    return (
                      <td key={c.label} className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min={0}
                          name={k}
                          value={v[k]}
                          onChange={set(k)}
                          className={cell}
                          aria-label={`${name} ${c.label}`}
                        />
                      </td>
                    );
                  })}
                  <td className="border-l px-3 py-2 text-center text-xl font-bold tabular-nums">
                    {final}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit">Save score</Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowOt((s) => !s)}
        >
          {showOt ? "Remove OT" : "+ Add OT"}
        </Button>
      </div>
    </SaveForm>
  );
}
