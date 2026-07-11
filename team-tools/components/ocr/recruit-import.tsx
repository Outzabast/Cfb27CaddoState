"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { OcrResult } from "@/lib/ocr/kinds";
import type { RecruitKind } from "@/generated/prisma/enums";
import { RECRUIT_KIND_ORDER, RECRUIT_KIND_LABELS, formatHometown } from "@/lib/recruits";
import { formatHeight } from "@/lib/player-profile";
import { commitOcrRecruits } from "@/app/recruits/actions";
import { OcrFilePicker } from "./ocr-file-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type SeasonOption = { id: number; name: string };

type EditRow = {
  id: number;
  include: boolean;
  name: string;
  position: string;
  stars: string;
  kind: RecruitKind;
  signed: boolean;
  // Passed through from OCR (shown read-only, imported as-is).
  nationalRank: number | null;
  stateRank: number | null;
  positionRank: number | null;
  heightInches: number | null;
  weightLbs: number | null;
  hometownCity: string | null;
  hometownState: string | null;
  previousSchool: string | null;
};

export function RecruitImportButton({
  seasons,
  defaultSeasonId,
}: {
  seasons: SeasonOption[];
  defaultSeasonId?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} disabled={seasons.length === 0}>
        Import
      </Button>
      <RecruitOcrDialog
        seasons={seasons}
        defaultSeasonId={defaultSeasonId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function summary(r: EditRow): string {
  const bits = [
    formatHeight(r.heightInches),
    r.weightLbs ? `${r.weightLbs} lbs` : null,
    formatHometown(r.hometownCity, r.hometownState),
    r.nationalRank != null ? `NAT ${r.nationalRank}` : null,
    r.kind === "TRANSFER" && r.previousSchool ? `from ${r.previousSchool}` : null,
  ].filter(Boolean);
  return bits.join(" · ") || "no extra details read";
}

function RecruitOcrDialog({
  seasons,
  defaultSeasonId,
  open,
  onOpenChange,
}: {
  seasons: SeasonOption[];
  defaultSeasonId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [seasonId, setSeasonId] = useState<number>(defaultSeasonId ?? seasons[0]?.id ?? 0);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [shots, setShots] = useState(0);
  const [nextId, setNextId] = useState(0);
  const [pending, startTransition] = useTransition();

  function mergeResult(result: OcrResult) {
    if (result.kind !== "recruits") return;
    setShots((s) => s + 1);
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.name.trim().toLowerCase()));
      let id = nextId;
      const additions: EditRow[] = [];
      for (const r of result.rows) {
        const key = r.name.trim().toLowerCase();
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        additions.push({
          id: id++,
          include: true,
          name: r.name,
          position: r.position,
          stars: r.stars == null ? "" : String(r.stars),
          kind: r.kind,
          signed: r.signed,
          nationalRank: r.nationalRank,
          stateRank: r.stateRank,
          positionRank: r.positionRank,
          heightInches: r.heightInches,
          weightLbs: r.weightLbs,
          hometownCity: r.hometownCity,
          hometownState: r.hometownState,
          previousSchool: r.previousSchool,
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
  const canImport = Number.isInteger(seasonId) && seasonId > 0 && selected.length > 0 && selected.every((r) => r.name.trim());

  function doImport() {
    const payload = selected.map((r) => ({
      name: r.name.trim(),
      position: r.position.trim(),
      kind: r.kind,
      stars: r.stars.trim() === "" ? null : Number(r.stars),
      nationalRank: r.nationalRank,
      stateRank: r.stateRank,
      positionRank: r.positionRank,
      heightInches: r.heightInches,
      weightLbs: r.weightLbs,
      hometownCity: r.hometownCity,
      hometownState: r.hometownState,
      previousSchool: r.previousSchool,
      signed: r.signed,
    }));
    startTransition(async () => {
      const id = toast.loading("Importing recruits…");
      try {
        await commitOcrRecruits(seasonId, payload);
        toast.success(`Imported ${payload.length} recruit${payload.length === 1 ? "" : "s"}`, { id });
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
          <DialogTitle>Import recruits from screenshots</DialogTitle>
          <DialogDescription>
            Add recruiting-board screenshots (the detail card reads fullest). Pick the
            class to import into, review each prospect, then import.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium">Recruiting class</span>
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(Number(e.target.value))}
              className={selectClass}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <OcrFilePicker
            kind="recruits"
            onResult={mergeResult}
            label={shots === 0 ? "Read screenshot(s)" : "Add more screenshots"}
            hint={
              shots > 0
                ? `${shots} screenshot${shots === 1 ? "" : "s"} read · ${rows.length} recruit${rows.length === 1 ? "" : "s"}`
                : "Capture the recruit detail card (and the board list) — several stack into one import."
            }
          />

          {rows.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              {rows.map((r) => (
                <div key={r.id} className="rounded-md border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => update(r.id, { include: e.target.checked })}
                      aria-label={`Import ${r.name}`}
                      className="size-4"
                    />
                    <Input
                      value={r.name}
                      onChange={(e) => update(r.id, { name: e.target.value })}
                      placeholder="Full name"
                      className="h-8 min-w-[10rem] flex-1"
                      aria-label="Name"
                    />
                    <Input
                      value={r.position}
                      onChange={(e) => update(r.id, { position: e.target.value })}
                      placeholder="Pos"
                      maxLength={8}
                      className="h-8 w-16"
                      aria-label="Position"
                    />
                    <label className="flex items-center gap-1 text-xs text-muted-foreground">
                      ★
                      <Input
                        value={r.stars}
                        onChange={(e) => update(r.id, { stars: e.target.value })}
                        type="number"
                        min={0}
                        max={5}
                        className="h-8 w-14"
                        aria-label="Stars"
                      />
                    </label>
                    <select
                      value={r.kind}
                      onChange={(e) => update(r.id, { kind: e.target.value as RecruitKind })}
                      className={selectClass + " h-8"}
                      aria-label="Type"
                    >
                      {RECRUIT_KIND_ORDER.map((k) => (
                        <option key={k} value={k}>
                          {RECRUIT_KIND_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={r.signed}
                        onChange={(e) => update(r.id, { signed: e.target.checked })}
                      />
                      Signed
                    </label>
                  </div>
                  <p className="mt-1 pl-6 text-xs text-muted-foreground">{summary(r)}</p>
                </div>
              ))}
            </div>
          )}
          {shots > 0 && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No recruits were read from that image. Try a clearer screenshot of the detail card.
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
            {pending ? "Importing…" : `Import ${selected.length} recruit${selected.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
