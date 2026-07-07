"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";

import {
  PLAYER_STAT_GROUPS,
  TEAM_STAT_GROUPS,
  TEAM_PCTS,
  parseStats,
  formatDuration,
} from "@/lib/stat-fields";
import { CLASS_LABELS, CLASS_ORDER } from "@/lib/classes";
import type { PlayerClass } from "@/generated/prisma/enums";
import {
  SCOREBOARD_FIELDS,
  type OcrResult,
  type OcrScoreboard,
  type OcrPlayerStatLine,
} from "@/lib/ocr/kinds";
import { matchNameIndex, nameKey } from "@/lib/ocr/name-match";
import {
  commitOcrBoxScore,
  commitOcrPlayerStats,
  type OcrPlayerStatInput,
} from "@/app/seasons/[id]/schedule/[gameId]/box-score/actions";
import { OcrFilePicker } from "./ocr-file-picker";
import { StatFieldGroups } from "@/components/stat-field-groups";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";

export type RosterOption = { playerId: number; name: string; position: string };

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const classOptions = CLASS_ORDER.map((c) => ({ value: c, label: CLASS_LABELS[c] }));

export function BoxScoreImportMenu({
  seasonId,
  gameId,
  roster,
}: {
  seasonId: number;
  gameId: number;
  roster: RosterOption[];
}) {
  const [teamOpen, setTeamOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              Import
              <ChevronDownIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTeamOpen(true)}>
            Team stats + score from screenshots
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPlayerOpen(true)}>
            Player stat lines from screenshots
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TeamStatsOcrDialog
        seasonId={seasonId}
        gameId={gameId}
        open={teamOpen}
        onOpenChange={setTeamOpen}
      />
      <PlayerStatsOcrDialog
        seasonId={seasonId}
        gameId={gameId}
        roster={roster}
        open={playerOpen}
        onOpenChange={setPlayerOpen}
      />
    </>
  );
}

/* ------------------------------ Team stats + scoreboard ------------------------------ */

const SCORE_QUARTERS: { label: string; team: keyof OcrScoreboard; opp: keyof OcrScoreboard }[] = [
  { label: "Q1", team: "teamQ1", opp: "oppQ1" },
  { label: "Q2", team: "teamQ2", opp: "oppQ2" },
  { label: "Q3", team: "teamQ3", opp: "oppQ3" },
  { label: "Q4", team: "teamQ4", opp: "oppQ4" },
  { label: "OT", team: "teamOt", opp: "oppOt" },
];

function TeamStatsOcrDialog({
  seasonId,
  gameId,
  open,
  onOpenChange,
}: {
  seasonId: number;
  gameId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [score, setScore] = useState<OcrScoreboard>({});
  const [importScore, setImportScore] = useState(false);
  const [shots, setShots] = useState(0);
  const [version, setVersion] = useState(0);

  function mergeResult(result: OcrResult) {
    if (result.kind !== "teamStats") return;
    setShots((s) => s + 1);
    setStats((prev) => ({ ...prev, ...result.stats }));
    if (result.scoreboard) {
      setScore((prev) => ({ ...prev, ...result.scoreboard }));
      setImportScore(true);
    }
    setVersion((v) => v + 1);
  }

  function reset() {
    setStats({});
    setScore({});
    setImportScore(false);
    setShots(0);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import team stats + score</DialogTitle>
          <DialogDescription>
            Team stats often need a few screenshots (scroll for the rest) — they
            stack together. The score by quarter comes from the scoreboard shot.
            Review below, then save.
          </DialogDescription>
        </DialogHeader>

        <SaveForm
          action={async (formData) => {
            const parsed = parseStats(formData, TEAM_STAT_GROUPS);
            let scoreboard: OcrScoreboard | null = null;
            if (importScore) {
              scoreboard = {};
              for (const f of SCOREBOARD_FIELDS) {
                const n = Number(formData.get(f) ?? 0);
                scoreboard[f] = Number.isInteger(n) && n >= 0 ? n : 0;
              }
            }
            await commitOcrBoxScore(seasonId, gameId, parsed, scoreboard);
            onOpenChange(false);
            reset();
            router.refresh();
          }}
          successText="Box score saved"
          className="contents"
        >
          <DialogBody className="space-y-4">
            <OcrFilePicker
              kind="teamStats"
              onResult={mergeResult}
              label={shots === 0 ? "Read screenshot" : "Add another screenshot"}
              hint={
                shots > 0
                  ? `${shots} screenshot${shots === 1 ? "" : "s"} read`
                  : "Start with the scoreboard shot, then scroll for more team stats."
              }
            />

            {shots > 0 && (
              <div key={version} className="space-y-4 border-t pt-4">
                {/* Scoreboard */}
                <fieldset className="rounded-md border p-3">
                  <legend className="flex items-center gap-2 px-1">
                    <input
                      type="checkbox"
                      checked={importScore}
                      onChange={(e) => setImportScore(e.target.checked)}
                      className="size-4"
                      id="import-score"
                    />
                    <label
                      htmlFor="import-score"
                      className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      Score by quarter
                    </label>
                  </legend>
                  <div className="grid grid-cols-[3rem_repeat(5,1fr)] items-center gap-2 text-sm">
                    <span />
                    {SCORE_QUARTERS.map((q) => (
                      <span key={q.label} className="text-center text-xs text-muted-foreground">
                        {q.label}
                      </span>
                    ))}
                    <span className="text-xs text-muted-foreground">Us</span>
                    {SCORE_QUARTERS.map((q) => (
                      <Input
                        key={q.team}
                        name={q.team}
                        type="number"
                        defaultValue={score[q.team] ?? ""}
                        disabled={!importScore}
                        className="h-8 px-1 text-center"
                      />
                    ))}
                    <span className="text-xs text-muted-foreground">Them</span>
                    {SCORE_QUARTERS.map((q) => (
                      <Input
                        key={q.opp}
                        name={q.opp}
                        type="number"
                        defaultValue={score[q.opp] ?? ""}
                        disabled={!importScore}
                        className="h-8 px-1 text-center"
                      />
                    ))}
                  </div>
                </fieldset>

                {/* Team stats */}
                <StatFieldGroups
                  groups={TEAM_STAT_GROUPS}
                  values={stats}
                  idPrefix="ocr-team"
                  pcts={TEAM_PCTS}
                />
                <p className="text-xs text-muted-foreground">
                  Time of possession is entered as mm:ss ({formatDuration(0)} = none).
                  Blank fields save as 0.
                </p>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            {shots > 0 && (
              <Button type="button" variant="ghost" onClick={reset}>
                Clear
              </Button>
            )}
            <Button type="submit" disabled={shots === 0}>
              Save box score
            </Button>
          </DialogFooter>
        </SaveForm>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Player stat lines ------------------------------ */

const STAT_LABELS: Record<string, string> = {
  passYds: "pass yds",
  passTd: "pass TD",
  rushYds: "rush yds",
  rushTd: "rush TD",
  rec: "rec",
  recYds: "rec yds",
  recTd: "rec TD",
  tacklesSolo: "tkl",
  tacklesForLoss: "TFL",
  sacks: "sacks",
  defInt: "INT",
  fgMade: "FG",
};

function summarize(stats: Record<string, number>): string {
  const parts: string[] = [];
  for (const [key, label] of Object.entries(STAT_LABELS)) {
    const v = stats[key];
    if (v) parts.push(`${v} ${label}`);
    if (parts.length >= 5) break;
  }
  return parts.join(", ") || "no stats read";
}

const hasAnyStat = (stats: Record<string, number>) => Object.values(stats).some((v) => v);

type PlayerEditRow = {
  id: number;
  key: string;
  playerName: string;
  position: string | null;
  stats: Record<string, number>;
  assign: string; // "" unassigned | "new" | "<playerId>"
  include: boolean;
  newName: string;
  newPos: string;
  newClass: PlayerClass | "";
};

function PlayerStatsOcrDialog({
  seasonId,
  gameId,
  roster,
  open,
  onOpenChange,
}: {
  seasonId: number;
  gameId: number;
  roster: RosterOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<PlayerEditRow[]>([]);
  const [shots, setShots] = useState(0);
  const [nextId, setNextId] = useState(0);
  const [pending, startTransition] = useTransition();
  const named = useMemo(() => roster.map((r) => ({ name: r.name })), [roster]);

  function mergeResult(result: OcrResult) {
    if (result.kind !== "playerStats") return;
    setShots((s) => s + 1);
    setRows((prev) => {
      const byKey = new Map(prev.map((r) => [r.key, r]));
      let id = nextId;
      for (const line of result.lines) {
        const key = nameKey(line.playerName);
        const existing = byKey.get(key);
        if (existing) {
          // Same player from another category screenshot — merge their stats.
          existing.stats = { ...existing.stats, ...line.stats };
          if (line.playerName.length > existing.playerName.length) {
            existing.playerName = line.playerName;
          }
          if (!existing.position && line.position) existing.position = line.position;
        } else {
          const idx = matchNameIndex(line.playerName, named);
          const stats = { ...line.stats };
          byKey.set(key, {
            id: id++,
            key,
            playerName: line.playerName,
            position: line.position,
            stats,
            assign: idx >= 0 ? String(roster[idx].playerId) : "",
            include: hasAnyStat(stats),
            newName: line.playerName,
            newPos: line.position ?? "",
            newClass: "",
          });
        }
      }
      setNextId(id);
      return Array.from(byKey.values());
    });
  }

  function reset() {
    setRows([]);
    setShots(0);
  }
  const update = (id: number, patch: Partial<PlayerEditRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const selected = rows.filter((r) => r.include);
  const rowReady = (r: PlayerEditRow) =>
    r.assign === "new"
      ? Boolean(r.newName.trim() && r.newPos.trim() && r.newClass)
      : r.assign !== "";
  const canImport = selected.length > 0 && selected.every(rowReady);

  function doImport() {
    const payload: OcrPlayerStatInput[] = selected.map((r) =>
      r.assign === "new"
        ? {
            playerId: null,
            newPlayer: { name: r.newName.trim(), position: r.newPos.trim(), class: r.newClass as string },
            stats: r.stats,
          }
        : { playerId: Number(r.assign), stats: r.stats },
    );
    startTransition(async () => {
      const id = toast.loading("Importing stat lines…");
      try {
        await commitOcrPlayerStats(seasonId, gameId, payload);
        toast.success(`Imported ${payload.length} stat line${payload.length === 1 ? "" : "s"}`, { id });
        reset();
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Import failed", { id });
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import player stat lines</DialogTitle>
          <DialogDescription>
            One screenshot per category (passing, rushing, receiving, defense,
            kicking) — they stack, and a player’s categories merge onto one line.
            Confirm each player, or add a new one to the roster.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <OcrFilePicker
            kind="playerStats"
            onResult={mergeResult}
            label={shots === 0 ? "Read screenshot" : "Add another category"}
            hint={
              shots > 0
                ? `${shots} screenshot${shots === 1 ? "" : "s"} read · ${rows.length} player${rows.length === 1 ? "" : "s"}`
                : undefined
            }
          />

          {rows.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.75rem_1fr] items-start gap-2 rounded-md border p-2"
                >
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => update(r.id, { include: e.target.checked })}
                    aria-label={`Import ${r.playerName}`}
                    className="mt-1 size-4"
                  />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Read as{" "}
                        <span className="font-medium text-foreground">
                          {r.playerName || "—"}
                        </span>
                      </span>
                      <span aria-hidden>→</span>
                      <select
                        value={r.assign}
                        onChange={(e) => update(r.id, { assign: e.target.value })}
                        className={selectClass + " max-w-64"}
                      >
                        <option value="">Pick player…</option>
                        {roster.map((p) => (
                          <option key={p.playerId} value={p.playerId}>
                            {p.name} ({p.position})
                          </option>
                        ))}
                        <option value="new">➕ Add new player…</option>
                      </select>
                    </div>

                    {r.assign === "new" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          value={r.newName}
                          onChange={(e) => update(r.id, { newName: e.target.value })}
                          placeholder="Full name"
                          className="h-8 w-48"
                          aria-label="New player name"
                        />
                        <Input
                          value={r.newPos}
                          onChange={(e) => update(r.id, { newPos: e.target.value })}
                          placeholder="Pos"
                          maxLength={8}
                          className="h-8 w-16"
                          aria-label="New player position"
                        />
                        <select
                          value={r.newClass}
                          onChange={(e) =>
                            update(r.id, { newClass: e.target.value as PlayerClass | "" })
                          }
                          className={selectClass + " h-8 w-40"}
                          aria-label="New player class"
                        >
                          <option value="">Class…</option>
                          {classOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">{summarize(r.stats)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {shots > 0 && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No stat lines were read from that image. Try a clearer screenshot.
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          {rows.length > 0 && (
            <Button type="button" variant="ghost" onClick={reset}>
              Clear
            </Button>
          )}
          <Button type="button" onClick={doImport} disabled={!canImport || pending}>
            {pending
              ? "Importing…"
              : `Import ${selected.length} line${selected.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
