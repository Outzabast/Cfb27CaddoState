"use client";

import { useState } from "react";
import { driveResult, scoreAfterEachDrive, type PlayLite } from "@/lib/play-by-play";
import type { PlayType } from "@/generated/prisma/enums";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type EditPlay = {
  id: number;
  quarter: number;
  clock: string | null;
  team: "TEAM" | "OPP";
  situation: string | null;
  description: string;
  newDrive?: boolean | null;
  playType?: PlayType | null;
  points?: number | null;
  scoringTeam?: "TEAM" | "OPP" | null;
};

type PlayAction = (formData: FormData) => Promise<void>;

const PLAY_TYPE_OPTS: { value: string; label: string }[] = [
  { value: "SCRIMMAGE", label: "Scrimmage" },
  { value: "TOUCHDOWN", label: "Touchdown" },
  { value: "EXTRA_POINT", label: "Extra point (good)" },
  { value: "EXTRA_POINT_MISSED", label: "Extra point (miss)" },
  { value: "TWO_POINT", label: "2-pt (good)" },
  { value: "TWO_POINT_FAILED", label: "2-pt (failed)" },
  { value: "FIELD_GOAL", label: "Field goal (good)" },
  { value: "FIELD_GOAL_MISSED", label: "Field goal (miss)" },
  { value: "SAFETY", label: "Safety" },
  { value: "PUNT", label: "Punt" },
  { value: "INTERCEPTION", label: "Interception" },
  { value: "FUMBLE", label: "Fumble" },
  { value: "TURNOVER_ON_DOWNS", label: "Turnover on downs" },
  { value: "KICKOFF", label: "Kickoff" },
  { value: "PENALTY", label: "Penalty" },
  { value: "KNEEL", label: "Kneel" },
  { value: "END_PERIOD", label: "End of period" },
  { value: "OTHER", label: "Other" },
];

/** The typed-scoring controls shared by the edit and add forms: play type, points,
 *  and which team scored. */
function ScoringFields({
  teamName,
  oppName,
  playType,
  points,
  scoringTeam,
}: {
  teamName: string;
  oppName: string;
  playType?: string | null;
  points?: number | null;
  scoringTeam?: "TEAM" | "OPP" | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5">
      <label className="text-xs text-muted-foreground">
        Type
        <select name="playType" defaultValue={playType ?? "SCRIMMAGE"} className={selectClass + " ml-1"}>
          {PLAY_TYPE_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted-foreground">
        Points
        <Input
          name="points"
          type="number"
          min={0}
          max={8}
          defaultValue={points ?? 0}
          className="ml-1 inline-flex h-9 w-16"
        />
      </label>
      <label className="text-xs text-muted-foreground">
        Scored by
        <select name="scoringTeam" defaultValue={scoringTeam ?? ""} className={selectClass + " ml-1"}>
          <option value="">— (possession)</option>
          <option value="TEAM">{teamName}</option>
          <option value="OPP">{oppName}</option>
        </select>
      </label>
    </div>
  );
}

/** Split ordered plays into drives, keeping their DB ids. Mirrors groupDrives:
 *  possession change starts a drive, unless a manual override forces otherwise. */
function groupEditDrives(plays: EditPlay[]): { team: "TEAM" | "OPP"; plays: EditPlay[] }[] {
  const drives: { team: "TEAM" | "OPP"; plays: EditPlay[] }[] = [];
  let prev: EditPlay | undefined;
  for (const p of plays) {
    const boundary =
      !prev || p.newDrive === true || (p.newDrive !== false && p.team !== prev.team);
    if (boundary) drives.push({ team: p.team, plays: [p] });
    else drives[drives.length - 1].plays.push(p);
    prev = p;
  }
  return drives;
}

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const textareaClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Where a pending "add" form is anchored. afterPlayId 0 = append at the very end. */
type Adding = { afterPlayId: number; kind: "play" | "drive" };

/** In-place editor for a game's play-by-play. Fix OCR mistakes or build a game by
 *  hand: create drives and plays, flip a drive's possession, split / merge drives,
 *  and edit / delete individual plays. */
export function PlayByPlayEditor({
  seasonId,
  gameId,
  plays,
  teamName,
  oppName,
  updateAction,
  deleteAction,
  setPossessionAction,
  setBoundaryAction,
  addAction,
  deleteDriveAction,
  deleteAllAction,
}: {
  seasonId: number;
  gameId: number;
  plays: EditPlay[];
  teamName: string;
  oppName: string;
  updateAction: PlayAction;
  deleteAction: PlayAction;
  setPossessionAction: PlayAction;
  setBoundaryAction: PlayAction;
  addAction: PlayAction;
  deleteDriveAction: PlayAction;
  deleteAllAction: PlayAction;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [qFilter, setQFilter] = useState<string>("all");
  const [collapsed, setCollapsed] = useState(false);

  const drives = groupEditDrives(plays);
  const scores = scoreAfterEachDrive(drives);
  const name = (t: "TEAM" | "OPP") => (t === "TEAM" ? teamName : oppName);

  // Quarters present, for the filter. 5+ collapse to a single "OT" option.
  const quarters = Array.from(new Set(plays.map((p) => (p.quarter >= 5 ? 5 : p.quarter)))).sort(
    (a, b) => a - b,
  );
  const inFilter = (d: { plays: EditPlay[] }) =>
    qFilter === "all" ||
    d.plays.some((p) => (qFilter === "ot" ? p.quarter >= 5 : p.quarter === Number(qFilter)));
  const ids = () => (
    <>
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="gameId" value={gameId} />
    </>
  );

  const addForm = (a: Adding, defaultTeam: "TEAM" | "OPP", defaultQuarter: number) => (
    <AddPlayForm
      seasonId={seasonId}
      gameId={gameId}
      teamName={teamName}
      oppName={oppName}
      afterPlayId={a.afterPlayId}
      kind={a.kind}
      defaultTeam={defaultTeam}
      defaultQuarter={defaultQuarter}
      action={addAction}
      onDone={() => setAdding(null)}
    />
  );

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="eyebrow !text-foreground">Edit Play-by-Play</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Add / delete drives &amp; plays, flip possession, or split / merge drives.
          </span>
          {plays.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setCollapsed((c) => !c)}>
              {collapsed ? "▸ Expand" : "▾ Collapse"}
            </Button>
          )}
          {plays.length > 0 && (
            <SaveForm
              action={deleteAllAction}
              successText="Play-by-play cleared"
              onSubmit={(e) => {
                if (!window.confirm(`Delete all ${plays.length} plays? You can then re-import.`)) e.preventDefault();
              }}
            >
              {ids()}
              <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                Delete all
              </Button>
            </SaveForm>
          )}
        </div>
      </div>

      {collapsed && plays.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {plays.length} play{plays.length === 1 ? "" : "s"} across {drives.length} drive
          {drives.length === 1 ? "" : "s"} — collapsed.
        </p>
      )}

      {!collapsed && (
        <>
      {quarters.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Quarter</span>
          <select
            value={qFilter}
            onChange={(e) => setQFilter(e.target.value)}
            className={selectClass}
            aria-label="Filter by quarter"
          >
            <option value="all">All</option>
            {quarters.map((q) => (
              <option key={q} value={q >= 5 ? "ot" : String(q)}>
                {q >= 5 ? "OT" : `Q${q}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {drives.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No plays yet. Add the first drive below.
        </p>
      )}

      <div className="space-y-3">
        {drives.map((d, i) => {
          if (!inFilter(d)) return null;
          const other = d.team === "TEAM" ? "OPP" : "TEAM";
          const first = d.plays[0];
          const last = d.plays[d.plays.length - 1];
          return (
            <div key={i} className="overflow-hidden rounded-md border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
                <div className="text-sm">
                  <span className={"font-semibold " + (d.team === "TEAM" ? "text-primary" : "")}>
                    {name(d.team)}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {d.plays.length} play{d.plays.length === 1 ? "" : "s"} · Q{first.quarter}
                    {first.clock ? ` ${first.clock}` : ""} · {driveResult(d.plays as PlayLite[])}
                  </span>
                  <span className="ml-2 tabular-nums font-semibold" title={`${teamName}–${oppName}`}>
                    {scores[i].team}–{scores[i].opp}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {i > 0 && (
                    <SaveForm action={setBoundaryAction} successText="Merged with previous drive">
                      {ids()}
                      <input type="hidden" name="playId" value={first.id} />
                      <input type="hidden" name="boundary" value="merge" />
                      <Button type="submit" variant="ghost" size="sm">
                        ↑ Merge up
                      </Button>
                    </SaveForm>
                  )}
                  <SaveForm action={setPossessionAction} successText={`Drive set to ${name(other)}`}>
                    {ids()}
                    <input type="hidden" name="team" value={other} />
                    <input type="hidden" name="playIds" value={d.plays.map((p) => p.id).join(",")} />
                    <Button type="submit" variant="outline" size="sm">
                      This is {name(other)}&rsquo;s ball
                    </Button>
                  </SaveForm>
                  <SaveForm
                    action={deleteDriveAction}
                    successText="Drive deleted"
                    onSubmit={(e) => {
                      if (!window.confirm(`Delete this ${d.plays.length}-play drive?`)) e.preventDefault();
                    }}
                  >
                    {ids()}
                    <input type="hidden" name="playIds" value={d.plays.map((p) => p.id).join(",")} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                      Delete drive
                    </Button>
                  </SaveForm>
                </div>
              </div>

              <div>
                {d.plays.map((p, j) =>
                  editingId === p.id ? (
                    <div key={p.id} className="border-b p-4 last:border-0">
                      <SaveForm
                        action={updateAction}
                        successText="Play updated"
                        onSuccess={() => setEditingId(null)}
                        className="space-y-2"
                      >
                        {ids()}
                        <input type="hidden" name="playId" value={p.id} />
                        <div className="flex flex-wrap gap-2">
                          <label className="text-xs text-muted-foreground">
                            Team
                            <select name="team" defaultValue={p.team} className={selectClass + " ml-1"}>
                              <option value="TEAM">{teamName}</option>
                              <option value="OPP">{oppName}</option>
                            </select>
                          </label>
                          <label className="text-xs text-muted-foreground">
                            Qtr
                            <Input
                              name="quarter"
                              type="number"
                              min={1}
                              max={9}
                              defaultValue={p.quarter}
                              className="ml-1 inline-flex h-9 w-16"
                            />
                          </label>
                          <label className="text-xs text-muted-foreground">
                            Clock
                            <Input
                              name="clock"
                              defaultValue={p.clock ?? ""}
                              placeholder="mm:ss"
                              className="ml-1 inline-flex h-9 w-20"
                            />
                          </label>
                        </div>
                        <Input name="situation" defaultValue={p.situation ?? ""} placeholder="1st & 10 on NIU 25" />
                        <textarea name="description" defaultValue={p.description} rows={2} className={textareaClass} />
                        <ScoringFields
                          teamName={teamName}
                          oppName={oppName}
                          playType={p.playType}
                          points={p.points}
                          scoringTeam={p.scoringTeam}
                        />
                        <div className="flex items-center gap-2">
                          <Button type="submit" size="sm">Save play</Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </SaveForm>
                    </div>
                  ) : (
                    <div key={p.id} className="flex items-start justify-between gap-3 border-b px-4 py-2 text-sm last:border-0">
                      <div className="min-w-0">
                        {p.situation && (
                          <div className="text-xs font-medium text-muted-foreground">{p.situation}</div>
                        )}
                        <div>
                          {p.clock && <span className="tabular-nums text-xs text-muted-foreground">{p.clock} </span>}
                          {p.description}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {j > 0 && (
                          <SaveForm action={setBoundaryAction} successText="Drive split here">
                            {ids()}
                            <input type="hidden" name="playId" value={p.id} />
                            <input type="hidden" name="boundary" value="split" />
                            <Button type="submit" variant="ghost" size="sm" title="Start a new drive at this play">
                              ✂ Split
                            </Button>
                          </SaveForm>
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(p.id)}>
                          Edit
                        </Button>
                        <SaveForm action={deleteAction} successText="Play deleted">
                          {ids()}
                          <input type="hidden" name="playId" value={p.id} />
                          <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                            Delete
                          </Button>
                        </SaveForm>
                      </div>
                    </div>
                  ),
                )}
              </div>

              {/* Drive footer: add a play to this drive, or a new drive after it. */}
              <div className="flex flex-wrap items-center gap-3 border-t bg-muted/10 px-4 py-2">
                {adding?.afterPlayId === last.id && adding.kind === "play" ? (
                  addForm(adding, d.team, last.quarter)
                ) : adding?.afterPlayId === last.id && adding.kind === "drive" ? (
                  addForm(adding, other, last.quarter)
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setAdding({ afterPlayId: last.id, kind: "play" })}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      + Add play
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdding({ afterPlayId: last.id, kind: "drive" })}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      + Drive below
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Append a drive at the very end (also the entry point when empty). */}
      <div className="rounded-md border border-dashed p-3">
        {adding?.afterPlayId === 0 ? (
          addForm(adding, "OPP", plays[plays.length - 1]?.quarter ?? 1)
        ) : (
          <button
            type="button"
            onClick={() => setAdding({ afterPlayId: 0, kind: "drive" })}
            className="text-sm font-medium text-primary hover:underline"
          >
            + Add drive at end
          </button>
        )}
      </div>
        </>
      )}
    </section>
  );
}

/** Inline form to add a single play. `kind: "drive"` forces the play to begin a
 *  new drive (and lets you pick its possession); `kind: "play"` appends to the
 *  drive it's anchored under, inheriting that drive's team. */
function AddPlayForm({
  seasonId,
  gameId,
  teamName,
  oppName,
  afterPlayId,
  kind,
  defaultTeam,
  defaultQuarter,
  action,
  onDone,
}: {
  seasonId: number;
  gameId: number;
  teamName: string;
  oppName: string;
  afterPlayId: number;
  kind: "play" | "drive";
  defaultTeam: "TEAM" | "OPP";
  defaultQuarter: number;
  action: PlayAction;
  onDone: () => void;
}) {
  return (
    <SaveForm
      action={action}
      successText={kind === "drive" ? "Drive added" : "Play added"}
      onSuccess={onDone}
      className="w-full space-y-2"
    >
      <input type="hidden" name="seasonId" value={seasonId} />
      <input type="hidden" name="gameId" value={gameId} />
      <input type="hidden" name="afterPlayId" value={afterPlayId} />
      <input type="hidden" name="startsDrive" value={kind === "drive" ? "1" : ""} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {kind === "drive" ? "New drive" : "New play"}
        </span>
        {kind === "drive" ? (
          <label className="text-xs text-muted-foreground">
            Possession
            <select name="team" defaultValue={defaultTeam} className={selectClass + " ml-1"}>
              <option value="TEAM">{teamName}</option>
              <option value="OPP">{oppName}</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="team" value={defaultTeam} />
        )}
        <label className="text-xs text-muted-foreground">
          Qtr
          <Input
            name="quarter"
            type="number"
            min={1}
            max={9}
            defaultValue={defaultQuarter}
            className="ml-1 inline-flex h-9 w-16"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Clock
          <Input name="clock" placeholder="mm:ss" className="ml-1 inline-flex h-9 w-20" />
        </label>
      </div>
      <Input name="situation" placeholder="1st & 10 on NIU 25" />
      <textarea name="description" placeholder="Play description" rows={2} className={textareaClass} required />
      <ScoringFields teamName={teamName} oppName={oppName} />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">{kind === "drive" ? "Add drive" : "Add play"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </SaveForm>
  );
}
