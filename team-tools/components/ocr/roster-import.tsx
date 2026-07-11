"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";

import { CLASS_LABELS, CLASS_ORDER } from "@/lib/classes";
import type { PlayerClass } from "@/generated/prisma/enums";
import type { OcrResult } from "@/lib/ocr/kinds";
import { matchNameIndex, nameKey } from "@/lib/ocr/name-match";
import { formatHeight } from "@/lib/player-profile";
import { formatHometown } from "@/lib/recruits";
import { commitOcrRoster, bulkAddToRoster } from "@/app/seasons/[id]/roster/actions";
import { OcrFilePicker } from "./ocr-file-picker";
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
  DialogClose,
} from "@/components/ui/dialog";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const invalidRing =
  "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40";
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
  height: string;
  weight: string;
  hometown: string;
  onRoster: boolean;
  include: boolean;
};

/** "5'11\"", "5-11", or a plain inch count → inches (null when blank/invalid). */
function parseHeightInches(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/(\d+)\s*['\-\s]\s*(\d+)/);
  if (m) return Number(m[1]) * 12 + Number(m[2]);
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

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
      const byKey = new Map(prev.map((r) => [r.key, r]));
      let id = nextId;
      for (const r of result.rows) {
        const key = nameKey(r.name);
        const height = formatHeight(r.heightInches) ?? "";
        const weight = r.weightLbs == null ? "" : String(r.weightLbs);
        const hometown = formatHometown(r.hometownCity, r.hometownState) ?? "";
        const existing = byKey.get(key);
        if (existing) {
          // Same player from another shot — fill any blanks (e.g. HT/WT/hometown
          // read from the detail panel in a later screenshot).
          if (r.name.length > existing.name.length) existing.name = r.name;
          if (!existing.number && r.number != null) existing.number = String(r.number);
          if (!existing.position && r.position) existing.position = r.position;
          if (!existing.class && r.class) existing.class = r.class;
          if (!existing.height && height) existing.height = height;
          if (!existing.weight && weight) existing.weight = weight;
          if (!existing.hometown && hometown) existing.hometown = hometown;
        } else {
          const onRoster = matchNameIndex(r.name, existingNamed) >= 0;
          byKey.set(key, {
            id: id++,
            key,
            name: r.name,
            number: r.number == null ? "" : String(r.number),
            position: r.position,
            class: r.class ?? "",
            height,
            weight,
            hometown,
            onRoster,
            include: !onRoster,
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
      heightInches: parseHeightInches(r.height),
      weightLbs: r.weight.trim() === "" ? null : Number(r.weight),
      hometown: r.hometown.trim() || null,
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
            label={shots === 0 ? "Read screenshot(s)" : "Add more screenshots"}
            hint={
              shots > 0
                ? `${shots} screenshot${shots === 1 ? "" : "s"} read · ${rows.length} unique player${rows.length === 1 ? "" : "s"}`
                : undefined
            }
          />

          {rows.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              {rows.map((r) => {
                const nameInvalid = r.include && !r.name.trim();
                const posInvalid =
                  r.include && (!r.position.trim() || r.position.trim().length > 8);
                const classInvalid = r.include && !r.class;
                return (
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
                        aria-invalid={nameInvalid}
                        placeholder="Full name"
                        className="h-9 min-w-[9rem] flex-1"
                      />
                      {r.onRoster && (
                        <span className="shrink-0 text-xs text-muted-foreground">on roster</span>
                      )}
                      <Input
                        value={r.number}
                        onChange={(e) => update(r.id, { number: e.target.value })}
                        type="number"
                        placeholder="#"
                        className="h-9 w-14"
                        aria-label="Number"
                      />
                      <Input
                        value={r.position}
                        onChange={(e) => update(r.id, { position: e.target.value })}
                        maxLength={8}
                        aria-invalid={posInvalid}
                        placeholder="Pos"
                        className="h-9 w-16"
                        aria-label="Position"
                      />
                      <select
                        value={r.class}
                        onChange={(e) => update(r.id, { class: e.target.value as PlayerClass | "" })}
                        aria-invalid={classInvalid}
                        className={cn(selectClass, "w-40", classInvalid && invalidRing)}
                        aria-label="Class"
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
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                      <Input
                        value={r.height}
                        onChange={(e) => update(r.id, { height: e.target.value })}
                        placeholder={`Height (6'2")`}
                        className="h-8 w-28"
                        aria-label="Height"
                      />
                      <Input
                        value={r.weight}
                        onChange={(e) => update(r.id, { weight: e.target.value })}
                        type="number"
                        placeholder="Weight (lbs)"
                        className="h-8 w-28"
                        aria-label="Weight"
                      />
                      <Input
                        value={r.hometown}
                        onChange={(e) => update(r.id, { hometown: e.target.value })}
                        placeholder="Hometown (City, ST)"
                        className="h-8 min-w-[10rem] flex-1"
                        aria-label="Hometown"
                      />
                    </div>
                  </div>
                );
              })}
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
