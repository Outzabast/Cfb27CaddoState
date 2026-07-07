"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";

import { CLASS_LABELS, CLASS_ORDER } from "@/lib/classes";
import type { PlayerClass } from "@/generated/prisma/enums";
import type { OcrResult } from "@/lib/ocr/kinds";
import { matchNameIndex, nameKey } from "@/lib/ocr/name-match";
import { commitOcrRoster, bulkAddToRoster } from "@/app/seasons/[id]/roster/actions";
import { OcrFilePicker } from "./ocr-file-picker";
import { SaveForm } from "@/components/save-form";
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
  DialogClose,
} from "@/components/ui/dialog";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const classOptions = CLASS_ORDER.map((c) => ({ value: c, label: CLASS_LABELS[c] }));

export function RosterImportMenu({
  seasonId,
  existingNames,
}: {
  seasonId: number;
  existingNames: string[];
}) {
  const [ocrOpen, setOcrOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

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
          <DropdownMenuItem onClick={() => setOcrOpen(true)}>
            From screenshot (OCR)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCsvOpen(true)}>
            From CSV file
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RosterOcrDialog
        seasonId={seasonId}
        existingNames={existingNames}
        open={ocrOpen}
        onOpenChange={setOcrOpen}
      />
      <RosterCsvDialog seasonId={seasonId} open={csvOpen} onOpenChange={setCsvOpen} />
    </>
  );
}

type EditRow = {
  id: number;
  key: string;
  name: string;
  number: string;
  position: string;
  class: PlayerClass | "";
  onRoster: boolean;
  include: boolean;
};

function RosterOcrDialog({
  seasonId,
  existingNames,
  open,
  onOpenChange,
}: {
  seasonId: number;
  existingNames: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<EditRow[]>([]);
  const [shots, setShots] = useState(0);
  const [nextId, setNextId] = useState(0);
  const [pending, startTransition] = useTransition();
  const existingNamed = useMemo(() => existingNames.map((name) => ({ name })), [existingNames]);

  function mergeResult(result: OcrResult) {
    if (result.kind !== "roster") return;
    setShots((s) => s + 1);
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.key));
      let id = nextId;
      const additions: EditRow[] = [];
      for (const r of result.rows) {
        const key = nameKey(r.name);
        if (seen.has(key)) continue; // same player already staged from another shot
        seen.add(key);
        const onRoster = matchNameIndex(r.name, existingNamed) >= 0;
        additions.push({
          id: id++,
          key,
          name: r.name,
          number: r.number == null ? "" : String(r.number),
          position: r.position,
          class: r.class ?? "",
          onRoster,
          include: !onRoster,
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
  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  const selected = rows.filter((r) => r.include);
  const canImport = selected.length > 0 && selected.every((r) => r.name && r.position && r.class);

  function doImport() {
    const payload = selected.map((r) => ({
      name: r.name.trim(),
      position: r.position.trim(),
      class: r.class as string,
      number: r.number.trim() === "" ? null : Number(r.number),
    }));
    startTransition(async () => {
      const id = toast.loading("Importing players…");
      try {
        await commitOcrRoster(seasonId, payload);
        toast.success(`Imported ${payload.length} player${payload.length === 1 ? "" : "s"}`, { id });
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
          <DialogTitle>Import roster from screenshots</DialogTitle>
          <DialogDescription>
            Add one or more roster screenshots — they stack into one import. EA
            shows short names (e.g. “B. Joiner”); players already on the roster are
            matched, flagged, and unchecked. New players: fill in the full name.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-3">
          <OcrFilePicker
            kind="roster"
            onResult={mergeResult}
            label={shots === 0 ? "Read screenshot" : "Add another screenshot"}
            hint={
              shots > 0
                ? `${shots} screenshot${shots === 1 ? "" : "s"} read · ${rows.length} unique player${rows.length === 1 ? "" : "s"}`
                : undefined
            }
          />

          {rows.length > 0 && (
            <div className="space-y-1 border-t pt-3">
              <div className="grid grid-cols-[2rem_1fr_4rem_5rem_11rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground">
                <span />
                <span>Name</span>
                <span>#</span>
                <span>Pos</span>
                <span>Class</span>
                <span />
              </div>
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[2rem_1fr_4rem_5rem_11rem_2rem] items-center gap-2"
                >
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => update(r.id, { include: e.target.checked })}
                    aria-label={`Import ${r.name}`}
                    className="size-4"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      value={r.name}
                      onChange={(e) => update(r.id, { name: e.target.value })}
                      className="h-9"
                    />
                    {r.onRoster && (
                      <span className="shrink-0 text-xs text-muted-foreground">on roster</span>
                    )}
                  </div>
                  <Input
                    value={r.number}
                    onChange={(e) => update(r.id, { number: e.target.value })}
                    type="number"
                    className="h-9"
                  />
                  <Input
                    value={r.position}
                    onChange={(e) => update(r.id, { position: e.target.value })}
                    maxLength={8}
                    className="h-9"
                  />
                  <select
                    value={r.class}
                    onChange={(e) => update(r.id, { class: e.target.value as PlayerClass | "" })}
                    className={selectClass}
                  >
                    <option value="">Pick class…</option>
                    {classOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${r.name}`}
                    onClick={() => removeRow(r.id)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}
          {shots > 0 && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No players were read from that image. Try a clearer screenshot.
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
            {pending ? "Importing…" : `Import ${selected.length} player${selected.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RosterCsvDialog({
  seasonId,
  open,
  onOpenChange,
}: {
  seasonId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import roster from CSV</DialogTitle>
          <DialogDescription>
            One player per line: <code>Position, Name, Class, Number</code> (number
            optional). Names already on this roster are skipped.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <pre className="overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
{`Position, Name, Class, Number
QB, Bryce Joiner, Redshirt Freshman, 7
RB, AJ Trimble, RS-SO, 22
WR, Deyonte Hocker III, FR,`}
          </pre>
          <SaveForm
            action={async (formData) => {
              await bulkAddToRoster(formData);
              onOpenChange(false);
            }}
            successText="Players imported"
            encType="multipart/form-data"
            className="flex flex-wrap items-center gap-3"
          >
            <input type="hidden" name="seasonId" value={seasonId} />
            <input
              name="file"
              type="file"
              accept=".csv,text/csv,text/plain"
              required
              className="text-sm"
            />
            <Button type="submit">Import CSV</Button>
          </SaveForm>
        </DialogBody>
        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="ghost">
                Close
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
