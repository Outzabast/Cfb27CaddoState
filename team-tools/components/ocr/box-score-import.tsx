"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";

import {
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
} from "@/lib/ocr/kinds";
import { matchNameIndex, nameKey } from "@/lib/ocr/name-match";
import { playMergeKey } from "@/lib/play-by-play";
import {
  commitOcrBoxScore,
  commitOcrPlayerStats,
  commitOcrScoringSummary,
  commitOcrPlayByPlay,
  commitOcrOppPlayerStats,
  type OcrPlayerStatInput,
  type OcrOppPlayerInput,
} from "@/app/seasons/[id]/schedule/[gameId]/box-score/actions";
import { OcrFilePicker } from "./ocr-file-picker";
import { StatFieldGroups } from "@/components/stat-field-groups";
import { SaveForm } from "@/components/save-form";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
const invalidRing =
  "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40";
const classOptions = CLASS_ORDER.map((c) => ({ value: c, label: CLASS_LABELS[c] }));

/** Dedupe key for a timed play across overlapping/repeated screenshots — the same
 *  shared key the server merge uses (clock normalized so "09:27" == "9:27"). */
const playDedupeKey = playMergeKey;

export function BoxScoreImportMenu({
  seasonId,
  gameId,
  roster,
  personas,
}: {
  seasonId: number;
  gameId: number;
  roster: RosterOption[];
  personas: { id: number; name: string }[];
}) {
  const [teamOpen, setTeamOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [oppPlayerOpen, setOppPlayerOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [pbpOpen, setPbpOpen] = useState(false);

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
            Player stat lines (Caddo State)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOppPlayerOpen(true)}>
            Player stat lines (opponent)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setSummaryOpen(true)}>
            Scoring summary from screenshots
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPbpOpen(true)}>
            Play-by-play from screenshots
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
      <ScoringSummaryOcrDialog
        seasonId={seasonId}
        gameId={gameId}
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
      />
      <PlayByPlayOcrDialog
        seasonId={seasonId}
        gameId={gameId}
        personas={personas}
        open={pbpOpen}
        onOpenChange={setPbpOpen}
      />
      <OppPlayerStatsOcrDialog
        seasonId={seasonId}
        gameId={gameId}
        open={oppPlayerOpen}
        onOpenChange={setOppPlayerOpen}
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
  const [oppStats, setOppStats] = useState<Record<string, number>>({});
  const [score, setScore] = useState<OcrScoreboard>({});
  const [importScore, setImportScore] = useState(false);
  const [shots, setShots] = useState(0);
  const [version, setVersion] = useState(0);

  function mergeResult(result: OcrResult) {
    if (result.kind !== "teamStats") return;
    setShots((s) => s + 1);
    setStats((prev) => ({ ...prev, ...result.stats }));
    setOppStats((prev) => ({ ...prev, ...result.oppStats }));
    if (result.scoreboard) {
      setScore((prev) => ({ ...prev, ...result.scoreboard }));
      setImportScore(true);
    }
    setVersion((v) => v + 1);
  }

  function reset() {
    setStats({});
    setOppStats({});
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
            const parsedOpp = parseStats(formData, TEAM_STAT_GROUPS, "opp_");
            let scoreboard: OcrScoreboard | null = null;
            if (importScore) {
              scoreboard = {};
              for (const f of SCOREBOARD_FIELDS) {
                const n = Number(formData.get(f) ?? 0);
                scoreboard[f] = Number.isInteger(n) && n >= 0 ? n : 0;
              }
            }
            await commitOcrBoxScore(seasonId, gameId, parsed, parsedOpp, scoreboard);
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
              label={shots === 0 ? "Read screenshot(s)" : "Add more screenshots"}
              hint={
                shots > 0
                  ? `${shots} screenshot${shots === 1 ? "" : "s"} read`
                  : "Select the scoreboard shot and any team-stats shots together, or add them in batches."
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

                {/* Team stats (Caddo State) */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Caddo State
                  </p>
                  <StatFieldGroups
                    groups={TEAM_STAT_GROUPS}
                    values={stats}
                    idPrefix="ocr-team"
                    pcts={TEAM_PCTS}
                  />
                </div>

                {/* Opponent team stats */}
                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Opponent
                  </p>
                  <StatFieldGroups
                    groups={TEAM_STAT_GROUPS}
                    values={oppStats}
                    idPrefix="ocr-opp"
                    namePrefix="opp_"
                    pcts={TEAM_PCTS}
                  />
                </div>

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
  passInt: "INT",
  rushYds: "rush yds",
  rushTd: "rush TD",
  rec: "rec",
  recYds: "rec yds",
  recTd: "rec TD",
  tacklesSolo: "tkl",
  tacklesForLoss: "TFL",
  sacks: "sacks",
  defInt: "def INT",
  fgMade: "FG",
};

function summarize(stats: Record<string, number>): string {
  const parts: string[] = [];
  for (const [key, label] of Object.entries(STAT_LABELS)) {
    const v = stats[key];
    if (v) parts.push(`${v} ${label}`);
    if (parts.length >= 7) break;
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
  // One stat line per player per game: count how many included lines target each
  // existing player so a player can't be assigned to two lines in one import.
  const assignCount = new Map<string, number>();
  for (const r of selected) {
    if (r.assign !== "" && r.assign !== "new") {
      assignCount.set(r.assign, (assignCount.get(r.assign) ?? 0) + 1);
    }
  }
  const isDupAssign = (r: PlayerEditRow) =>
    r.include && r.assign !== "" && r.assign !== "new" && (assignCount.get(r.assign) ?? 0) > 1;
  const rowReady = (r: PlayerEditRow) =>
    r.assign === "new"
      ? Boolean(r.newName.trim() && r.newPos.trim() && r.newClass)
      : r.assign !== "" && !isDupAssign(r);
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
            label={shots === 0 ? "Read screenshot(s)" : "Add more categories"}
            hint={
              shots > 0
                ? `${shots} screenshot${shots === 1 ? "" : "s"} read · ${rows.length} player${rows.length === 1 ? "" : "s"}`
                : undefined
            }
          />

          {rows.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              {rows.map((r) => {
                const isNew = r.assign === "new";
                const needsFix = r.include && !rowReady(r);
                const dupInvalid = isDupAssign(r);
                const assignInvalid = r.include && (r.assign === "" || dupInvalid);
                const nameInvalid = r.include && isNew && !r.newName.trim();
                const posInvalid =
                  r.include && isNew && (!r.newPos.trim() || r.newPos.trim().length > 8);
                const classInvalid = r.include && isNew && !r.newClass;
                // Players already claimed by another included line — can't pick them here.
                const takenByOthers = new Set(
                  rows
                    .filter(
                      (o) => o.id !== r.id && o.include && o.assign !== "" && o.assign !== "new",
                    )
                    .map((o) => o.assign),
                );
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "grid grid-cols-[1.75rem_1fr] items-start gap-2 rounded-md border p-2",
                      needsFix && "border-destructive/60 bg-destructive/5",
                    )}
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
                          aria-invalid={assignInvalid}
                          className={cn(selectClass, "max-w-64", assignInvalid && invalidRing)}
                        >
                          <option value="">Pick player…</option>
                          {roster.map((p) => {
                            const taken = takenByOthers.has(String(p.playerId));
                            return (
                              <option key={p.playerId} value={p.playerId} disabled={taken}>
                                {p.name} ({p.position}){taken ? " — already imported" : ""}
                              </option>
                            );
                          })}
                          <option value="new">➕ Add new player…</option>
                        </select>
                      </div>

                      {isNew && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            value={r.newName}
                            onChange={(e) => update(r.id, { newName: e.target.value })}
                            placeholder="Full name"
                            aria-invalid={nameInvalid}
                            className="h-8 w-48"
                            aria-label="New player name"
                          />
                          <Input
                            value={r.newPos}
                            onChange={(e) => update(r.id, { newPos: e.target.value })}
                            placeholder="Pos"
                            maxLength={8}
                            aria-invalid={posInvalid}
                            className="h-8 w-16"
                            aria-label="New player position"
                          />
                          <select
                            value={r.newClass}
                            onChange={(e) =>
                              update(r.id, { newClass: e.target.value as PlayerClass | "" })
                            }
                            aria-invalid={classInvalid}
                            className={cn(selectClass, "h-8 w-40", classInvalid && invalidRing)}
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
                      {needsFix && (
                        <p className="text-xs font-medium text-destructive">
                          {r.assign === ""
                            ? "Assign this line to a player, or choose “Add new player…”, before importing."
                            : dupInvalid
                              ? "This player already has a stat line in this import — pick a different player."
                              : "Enter the new player’s full name, position, and class."}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
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

/* ------------------------------ Scoring summary ------------------------------ */

type ScoringRow = {
  id: number;
  quarter: number; // 1-4 regulation, 5 = OT
  team: "team" | "opp";
  clock: string;
  description: string;
  points: string;
};

const QUARTER_OPTS = [
  { value: 1, label: "Q1" },
  { value: 2, label: "Q2" },
  { value: 3, label: "Q3" },
  { value: 4, label: "Q4" },
  { value: 5, label: "OT" },
];

function ScoringSummaryOcrDialog({
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
  const [rows, setRows] = useState<ScoringRow[]>([]);
  const [score, setScore] = useState<OcrScoreboard>({});
  const [importScore, setImportScore] = useState(false);
  const [shots, setShots] = useState(0);
  const [nextId, setNextId] = useState(0);
  const [pending, startTransition] = useTransition();

  function mergeResult(result: OcrResult) {
    if (result.kind !== "scoringSummary") return;
    setShots((s) => s + 1);
    setRows((prev) => {
      let id = nextId;
      const seen = new Set(prev.map((r) => playDedupeKey(r.quarter, r.clock, r.description)));
      const added: ScoringRow[] = [];
      for (const p of result.plays) {
        const quarter = p.quarter && p.quarter >= 1 && p.quarter <= 5 ? p.quarter : 1;
        const clock = p.clock ?? "";
        const key = playDedupeKey(quarter, clock, p.description);
        if (seen.has(key)) continue;
        seen.add(key);
        added.push({
          id: id++,
          quarter,
          team: p.team,
          clock,
          description: p.description,
          points: p.points != null ? String(p.points) : "",
        });
      }
      setNextId(id);
      return [...prev, ...added].sort((a, b) => a.quarter - b.quarter);
    });
    if (result.scoreboard) {
      setScore((prev) => ({ ...prev, ...result.scoreboard }));
      setImportScore(true);
    }
  }

  function reset() {
    setRows([]);
    setScore({});
    setImportScore(false);
    setShots(0);
  }
  const update = (id: number, patch: Partial<ScoringRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  function doImport() {
    const plays = rows
      .filter((r) => r.description.trim())
      .map((r) => ({
        quarter: r.quarter,
        team: r.team,
        clock: /^\d{1,2}:\d{2}$/.test(r.clock.trim()) ? r.clock.trim() : null,
        description: r.description.trim(),
        points: r.points.trim() === "" ? null : Number(r.points),
      }));
    const scoreboard = importScore ? score : null;
    startTransition(async () => {
      const id = toast.loading("Saving scoring summary…");
      try {
        await commitOcrScoringSummary(seasonId, gameId, plays, scoreboard);
        toast.success(`Saved ${plays.length} scoring play${plays.length === 1 ? "" : "s"}`, { id });
        reset();
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed", { id });
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import scoring summary</DialogTitle>
          <DialogDescription>
            Add each quarter&rsquo;s scoring-summary screenshot (they stack). Review
            the plays — who scored, when — then save. This replaces the game&rsquo;s
            current scoring summary.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <OcrFilePicker
            kind="scoringSummary"
            onResult={mergeResult}
            label={shots === 0 ? "Read screenshot(s)" : "Add more quarters"}
            hint={
              shots > 0
                ? `${shots} screenshot${shots === 1 ? "" : "s"} read · ${rows.length} play${rows.length === 1 ? "" : "s"}`
                : "Select all four quarter screenshots together, or add them one at a time."
            }
          />

          {rows.length > 0 && (
            <div className="space-y-3 border-t pt-3">
              {Object.keys(score).length > 0 && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={importScore}
                    onChange={(e) => setImportScore(e.target.checked)}
                    className="size-4"
                  />
                  Also set the score by quarter from these screenshots
                </label>
              )}
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={r.quarter}
                      onChange={(e) => update(r.id, { quarter: Number(e.target.value) })}
                      className={cn(selectClass, "h-8 w-16")}
                      aria-label="Quarter"
                    >
                      {QUARTER_OPTS.map((q) => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={r.team}
                      onChange={(e) => update(r.id, { team: e.target.value as "team" | "opp" })}
                      className={cn(selectClass, "h-8 w-20")}
                      aria-label="Scoring team"
                    >
                      <option value="team">Us</option>
                      <option value="opp">Them</option>
                    </select>
                    <Input
                      value={r.clock}
                      onChange={(e) => update(r.id, { clock: e.target.value })}
                      placeholder="mm:ss"
                      className="h-8 w-20"
                      aria-label="Clock"
                    />
                    <Input
                      value={r.description}
                      onChange={(e) => update(r.id, { description: e.target.value })}
                      placeholder="Scorer, play (PAT)"
                      className="h-8 min-w-[10rem] flex-1"
                      aria-label="Play"
                    />
                    <Input
                      value={r.points}
                      onChange={(e) => update(r.id, { points: e.target.value })}
                      type="number"
                      placeholder="pts"
                      className="h-8 w-14"
                      aria-label="Points"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(r.id)} aria-label="Remove play">
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {shots > 0 && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No scoring plays were read from that image. Try a clearer screenshot.
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          {rows.length > 0 && (
            <Button type="button" variant="ghost" onClick={reset}>
              Clear
            </Button>
          )}
          <Button type="button" onClick={doImport} disabled={rows.length === 0 || pending}>
            {pending ? "Saving…" : `Save ${rows.length} play${rows.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Play-by-play ------------------------------ */

type PlayRow = {
  id: number;
  quarter: number;
  team: "team" | "opp";
  clock: string;
  situation: string;
  description: string;
  /** Typed outcome + scoring carried through from OCR (corrected later in the editor). */
  playType: string | null;
  points: number | null;
  scoringTeam: "team" | "opp" | null;
};

function PlayByPlayOcrDialog({
  seasonId,
  gameId,
  personas,
  open,
  onOpenChange,
}: {
  seasonId: number;
  gameId: number;
  personas: { id: number; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<PlayRow[]>([]);
  const [shots, setShots] = useState(0);
  const [nextId, setNextId] = useState(0);
  const [pending, startTransition] = useTransition();
  const [genSummary, setGenSummary] = useState(false);
  const [summaryPersona, setSummaryPersona] = useState<number>(personas[0]?.id ?? 0);

  function mergeResult(result: OcrResult) {
    if (result.kind !== "playByPlay") return;
    setShots((s) => s + 1);
    setRows((prev) => {
      let id = nextId;
      const seen = new Set(prev.map((r) => playDedupeKey(r.quarter, r.clock, r.description)));
      // Carry possession forward when the model returns null (unknown).
      let lastTeam: "team" | "opp" = prev[prev.length - 1]?.team ?? "team";
      const added: PlayRow[] = [];
      for (const p of result.plays) {
        const quarter = p.quarter && p.quarter >= 1 && p.quarter <= 5 ? p.quarter : 1;
        const clock = p.clock ?? "";
        const team = p.team ?? lastTeam;
        lastTeam = team;
        const key = playDedupeKey(quarter, clock, p.description);
        if (seen.has(key)) continue;
        seen.add(key);
        added.push({
          id: id++,
          quarter,
          team,
          clock,
          situation: p.situation ?? "",
          description: p.description,
          playType: p.playType ?? null,
          points: p.points ?? null,
          scoringTeam: p.scoringTeam ?? null,
        });
      }
      setNextId(id);
      return [...prev, ...added];
    });
  }

  function reset() {
    setRows([]);
    setShots(0);
  }
  const update = (id: number, patch: Partial<PlayRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  function doImport() {
    const plays = rows
      .filter((r) => r.description.trim())
      .map((r) => ({
        quarter: r.quarter,
        team: r.team,
        clock: /^\d{1,2}:\d{2}$/.test(r.clock.trim()) ? r.clock.trim() : null,
        situation: r.situation.trim() || null,
        description: r.description.trim(),
        playType: r.playType,
        points: r.points,
        scoringTeam: r.scoringTeam,
      }));
    startTransition(async () => {
      const id = toast.loading(genSummary ? "Saving + writing summary…" : "Saving play-by-play…");
      try {
        await commitOcrPlayByPlay(seasonId, gameId, plays, {
          generateSummary: genSummary,
          summaryPersonaId: genSummary && summaryPersona > 0 ? summaryPersona : null,
        });
        toast.success(`Saved ${plays.length} play${plays.length === 1 ? "" : "s"}`, { id });
        reset();
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Save failed", { id });
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import play-by-play</DialogTitle>
          <DialogDescription>
            Add the in-game play-by-play screenshots (one per quarter, or scrolled
            sections) — they stack in order. Review, remove any misreads, then save.
            This replaces the game&rsquo;s current play-by-play.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <OcrFilePicker
            kind="playByPlay"
            onResult={mergeResult}
            label={shots === 0 ? "Read screenshot(s)" : "Add more"}
            hint={
              shots > 0
                ? `${shots} screenshot${shots === 1 ? "" : "s"} read · ${rows.length} play${rows.length === 1 ? "" : "s"}`
                : "Capture the play-by-play by quarter — several stack into one import."
            }
          />

          {rows.length > 0 && (
            <div className="max-h-[50vh] space-y-1.5 overflow-y-auto border-t pt-3">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={r.quarter}
                    onChange={(e) => update(r.id, { quarter: Number(e.target.value) })}
                    className={cn(selectClass, "h-8 w-16")}
                    aria-label="Quarter"
                  >
                    {QUARTER_OPTS.map((q) => (
                      <option key={q.value} value={q.value}>{q.label}</option>
                    ))}
                  </select>
                  <select
                    value={r.team}
                    onChange={(e) => update(r.id, { team: e.target.value as "team" | "opp" })}
                    className={cn(selectClass, "h-8 w-20")}
                    aria-label="Possession"
                  >
                    <option value="team">Us</option>
                    <option value="opp">Them</option>
                  </select>
                  <Input
                    value={r.clock}
                    onChange={(e) => update(r.id, { clock: e.target.value })}
                    placeholder="mm:ss"
                    className="h-8 w-20"
                    aria-label="Clock"
                  />
                  <Input
                    value={r.description}
                    onChange={(e) => update(r.id, { description: e.target.value })}
                    placeholder="Play"
                    className="h-8 min-w-[12rem] flex-1"
                    aria-label="Play description"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(r.id)} aria-label="Remove play">
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
          {shots > 0 && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No plays were read from that image. Try a clearer screenshot.
            </p>
          )}

          {rows.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={genSummary}
                  onChange={(e) => setGenSummary(e.target.checked)}
                  className="size-4"
                />
                <span className="font-medium">Generate a game summary from this play-by-play</span>
              </label>
              {genSummary && (
                <label className="flex items-center gap-2 pl-6 text-sm text-muted-foreground">
                  Written by
                  <select
                    value={summaryPersona}
                    onChange={(e) => setSummaryPersona(Number(e.target.value))}
                    className={cn(selectClass, "h-8 max-w-56")}
                  >
                    {personas.length === 0 && <option value={0}>Default voice</option>}
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {rows.length > 0 && (
            <Button type="button" variant="ghost" onClick={reset}>
              Clear
            </Button>
          )}
          <Button type="button" onClick={doImport} disabled={rows.length === 0 || pending}>
            {pending ? "Saving…" : `Save ${rows.length} play${rows.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Opponent player stat lines ------------------------------ */

type OppPlayerRow = {
  id: number;
  key: string;
  playerName: string;
  position: string | null;
  stats: Record<string, number>;
  include: boolean;
};

function OppPlayerStatsOcrDialog({
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
  const [rows, setRows] = useState<OppPlayerRow[]>([]);
  const [shots, setShots] = useState(0);
  const [nextId, setNextId] = useState(0);
  const [pending, startTransition] = useTransition();

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
          existing.stats = { ...existing.stats, ...line.stats };
          if (line.playerName.length > existing.playerName.length) existing.playerName = line.playerName;
          if (!existing.position && line.position) existing.position = line.position;
        } else {
          byKey.set(key, {
            id: id++,
            key,
            playerName: line.playerName,
            position: line.position,
            stats: { ...line.stats },
            include: hasAnyStat(line.stats),
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
  const update = (id: number, patch: Partial<OppPlayerRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const selected = rows.filter((r) => r.include);
  const canImport = selected.length > 0 && selected.every((r) => r.playerName.trim());

  function doImport() {
    const payload: OcrOppPlayerInput[] = selected.map((r) => ({
      playerName: r.playerName.trim(),
      position: r.position?.trim() || null,
      stats: r.stats,
    }));
    startTransition(async () => {
      const id = toast.loading("Importing opponent lines…");
      try {
        await commitOcrOppPlayerStats(seasonId, gameId, payload);
        toast.success(`Imported ${payload.length} opponent line${payload.length === 1 ? "" : "s"}`, { id });
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
          <DialogTitle>Import opponent player stats</DialogTitle>
          <DialogDescription>
            One screenshot per category (passing, rushing, …) — they stack and merge
            per player. These are recorded as named lines on this game (not roster
            players). Saving replaces the game&rsquo;s current opponent lines.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <OcrFilePicker
            kind="playerStats"
            onResult={mergeResult}
            label={shots === 0 ? "Read screenshot(s)" : "Add more categories"}
            hint={
              shots > 0
                ? `${shots} screenshot${shots === 1 ? "" : "s"} read · ${rows.length} player${rows.length === 1 ? "" : "s"}`
                : undefined
            }
          />

          {rows.length > 0 && (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto border-t pt-3">
              {rows.map((r) => (
                <div key={r.id} className="flex items-start gap-2 rounded-md border p-2">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => update(r.id, { include: e.target.checked })}
                    aria-label={`Import ${r.playerName}`}
                    className="mt-1 size-4"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={r.playerName}
                        onChange={(e) => update(r.id, { playerName: e.target.value })}
                        placeholder="Player name"
                        className="h-8 min-w-[10rem] flex-1"
                        aria-label="Opponent player name"
                      />
                      <Input
                        value={r.position ?? ""}
                        onChange={(e) => update(r.id, { position: e.target.value })}
                        placeholder="Pos"
                        maxLength={8}
                        className="h-8 w-16"
                        aria-label="Position"
                      />
                    </div>
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
            {pending ? "Importing…" : `Import ${selected.length} line${selected.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
