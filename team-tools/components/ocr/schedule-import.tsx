"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";

import { LOCATION_LABELS, LOCATION_ORDER } from "@/lib/classes";
import type { GameLocation } from "@/generated/prisma/enums";
import type { OcrResult } from "@/lib/ocr/kinds";
import { commitOcrGames } from "@/app/seasons/[id]/schedule/actions";
import { OcrFilePicker } from "./ocr-file-picker";
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

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const locationOptions = LOCATION_ORDER.map((l) => ({ value: l, label: LOCATION_LABELS[l] }));

export function ScheduleImportMenu({
  seasonId,
  existingWeeks,
  existingOpponents,
}: {
  seasonId: number;
  existingWeeks: number[];
  existingOpponents: string[];
}) {
  const [open, setOpen] = useState(false);
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
          <DropdownMenuItem onClick={() => setOpen(true)}>
            From screenshot (OCR)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ScheduleOcrDialog
        seasonId={seasonId}
        existingWeeks={existingWeeks}
        existingOpponents={existingOpponents}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

type EditRow = {
  id: number;
  key: string;
  week: string;
  date: string;
  opponent: string;
  location: GameLocation;
  teamPoints: string;
  oppPoints: string;
  dup: boolean;
  include: boolean;
};

/** Within-import dedupe key: by week when set, else by opponent name. */
function rowKey(week: number | null, opponent: string): string {
  return week != null ? `w:${week}` : `o:${opponent.trim().toLowerCase()}`;
}

function ScheduleOcrDialog({
  seasonId,
  existingWeeks,
  existingOpponents,
  open,
  onOpenChange,
}: {
  seasonId: number;
  existingWeeks: number[];
  existingOpponents: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditRow[]>([]);
  const [shots, setShots] = useState(0);
  const [nextId, setNextId] = useState(0);
  const [pending, startTransition] = useTransition();
  const weeks = new Set(existingWeeks);
  const opponents = new Set(existingOpponents.map((o) => o.toLowerCase()));

  function mergeResult(result: OcrResult) {
    if (result.kind !== "schedule") return;
    setShots((s) => s + 1);
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.key));
      let id = nextId;
      const additions: EditRow[] = [];
      for (const r of result.rows) {
        const key = rowKey(r.week, r.opponent);
        if (seen.has(key)) continue;
        seen.add(key);
        const dup =
          (r.week != null && weeks.has(r.week)) || opponents.has(r.opponent.toLowerCase());
        additions.push({
          id: id++,
          key,
          week: r.week == null ? "" : String(r.week),
          date: r.date ?? "",
          opponent: r.opponent,
          location: r.location,
          teamPoints: r.teamPoints == null ? "" : String(r.teamPoints),
          oppPoints: r.oppPoints == null ? "" : String(r.oppPoints),
          dup,
          include: !dup,
        });
      }
      setNextId(id);
      return [...prev, ...additions];
    });
  }

  function reset() {
    setRows([]);
    setShots(0);
  }
  const update = (id: number, patch: Partial<EditRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const selected = rows.filter((r) => r.include);
  const canImport = selected.length > 0 && selected.every((r) => r.opponent.trim());

  function doImport() {
    const payload = selected.map((r) => ({
      week: r.week.trim() === "" ? null : Number(r.week),
      date: r.date.trim() === "" ? null : r.date,
      opponent: r.opponent.trim(),
      location: r.location,
      teamPoints: r.teamPoints.trim() === "" ? null : Number(r.teamPoints),
      oppPoints: r.oppPoints.trim() === "" ? null : Number(r.oppPoints),
    }));
    startTransition(async () => {
      const id = toast.loading("Importing games…");
      try {
        await commitOcrGames(seasonId, payload);
        toast.success(`Imported ${payload.length} game${payload.length === 1 ? "" : "s"}`, { id });
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import schedule from screenshots</DialogTitle>
          <DialogDescription>
            Add one or more schedule screenshots — they stack into one import.
            Games matching an existing week or opponent are flagged and unchecked.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <OcrFilePicker
            kind="schedule"
            onResult={mergeResult}
            label={shots === 0 ? "Read screenshot(s)" : "Add more screenshots"}
            hint={
              shots > 0
                ? `${shots} screenshot${shots === 1 ? "" : "s"} read · ${rows.length} game${rows.length === 1 ? "" : "s"}`
                : undefined
            }
          />

          {rows.length > 0 && (
            <div className="space-y-1 border-t pt-3">
              <div className="grid grid-cols-[1.75rem_3rem_1fr_6rem_3rem_3rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
                <span />
                <span>Wk</span>
                <span>Opponent</span>
                <span>Where</span>
                <span>Us</span>
                <span>Them</span>
              </div>
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.75rem_3rem_1fr_6rem_3rem_3rem] items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => update(r.id, { include: e.target.checked })}
                    aria-label={`Import ${r.opponent}`}
                    className="size-4"
                  />
                  <Input
                    value={r.week}
                    onChange={(e) => update(r.id, { week: e.target.value })}
                    type="number"
                    className="h-9 px-1.5"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      value={r.opponent}
                      onChange={(e) => update(r.id, { opponent: e.target.value })}
                      className="h-9"
                    />
                    {r.dup && (
                      <span className="shrink-0 text-xs text-muted-foreground">exists</span>
                    )}
                  </div>
                  <select
                    value={r.location}
                    onChange={(e) => update(r.id, { location: e.target.value as GameLocation })}
                    className={selectClass}
                  >
                    {locationOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={r.teamPoints}
                    onChange={(e) => update(r.id, { teamPoints: e.target.value })}
                    type="number"
                    className="h-9 px-1.5"
                  />
                  <Input
                    value={r.oppPoints}
                    onChange={(e) => update(r.id, { oppPoints: e.target.value })}
                    type="number"
                    className="h-9 px-1.5"
                  />
                </div>
              ))}
            </div>
          )}
          {shots > 0 && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No games were read from that image. Try a clearer screenshot.
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
            {pending ? "Importing…" : `Import ${selected.length} game${selected.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
