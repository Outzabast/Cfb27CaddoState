"use client";

import { useState, type ReactNode } from "react";

type Tab = "team" | "players";
type Side = "us" | "opp";

const tabBtn = (active: boolean) =>
  "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
  (active
    ? "border-primary text-foreground"
    : "border-transparent text-muted-foreground hover:text-foreground");

const pillBtn = (active: boolean) =>
  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors " +
  (active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground");

/** The read-only box score, split into Team Stats / Player Stats tabs. The Player
 *  Stats tab toggles between our team (default) and the opponent. */
export function BoxScoreReadTabs({
  teamName,
  oppName,
  teamStats,
  ourPlayers,
  oppPlayers,
}: {
  teamName: string;
  oppName: string;
  teamStats: ReactNode;
  ourPlayers: ReactNode;
  /** Opponent player tables, or null when no opponent lines were recorded. */
  oppPlayers: ReactNode | null;
}) {
  const [tab, setTab] = useState<Tab>("team");
  const [side, setSide] = useState<Side>("us");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        <button type="button" onClick={() => setTab("team")} className={tabBtn(tab === "team")}>
          Team Stats
        </button>
        <button type="button" onClick={() => setTab("players")} className={tabBtn(tab === "players")}>
          Player Stats
        </button>
      </div>

      {tab === "team" ? (
        teamStats
      ) : (
        <div className="space-y-4">
          <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
            <button type="button" onClick={() => setSide("us")} className={pillBtn(side === "us")}>
              {teamName}
            </button>
            <button
              type="button"
              onClick={() => setSide("opp")}
              className={pillBtn(side === "opp")}
              disabled={!oppPlayers}
              title={oppPlayers ? undefined : "No opponent player stats recorded"}
            >
              {oppName}
            </button>
          </div>
          {side === "us" || !oppPlayers ? ourPlayers : oppPlayers}
        </div>
      )}
    </div>
  );
}
