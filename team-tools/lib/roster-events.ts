import { Prisma } from "@/generated/prisma/client";
import type { RosterEventType } from "@/generated/prisma/enums";

export const ROSTER_EVENT_LABELS: Record<RosterEventType, string> = {
  JOINED_RECRUIT: "Signed (recruit)",
  JOINED_TRANSFER: "Transferred in",
  NAMED_STARTER: "Named starter",
  LOST_STARTER: "Lost starting job",
  GRADUATED: "Graduated",
  TRANSFERRED_OUT: "Transferred out",
  OTHER: "Note",
};

/** Order for the "add event" dropdown. */
export const ROSTER_EVENT_ORDER: RosterEventType[] = [
  "JOINED_RECRUIT",
  "JOINED_TRANSFER",
  "NAMED_STARTER",
  "LOST_STARTER",
  "TRANSFERRED_OUT",
  "GRADUATED",
  "OTHER",
];

/** Event types whose counterparty (the other school) is meaningful. */
export const TRANSFER_EVENTS: RosterEventType[] = ["JOINED_TRANSFER", "TRANSFERRED_OUT"];

export function parseRosterEventType(raw: unknown): RosterEventType {
  const s = String(raw ?? "");
  return (Object.keys(ROSTER_EVENT_LABELS) as string[]).includes(s)
    ? (s as RosterEventType)
    : "OTHER";
}

/** The "from X" / "to X" tail for a transfer event (empty otherwise). */
export function transferTail(type: RosterEventType, counterparty: string | null): string {
  if (!counterparty) return "";
  if (type === "JOINED_TRANSFER") return ` from ${counterparty}`;
  if (type === "TRANSFERRED_OUT") return ` to ${counterparty}`;
  return "";
}

/**
 * Write a roster event as part of a mutation (signing, offseason, starter toggle).
 * Pass a transaction client when inside one so it commits atomically with the
 * change it records.
 */
export async function recordRosterEvent(
  tx: Prisma.TransactionClient,
  input: {
    playerId: number;
    type: RosterEventType;
    seasonId?: number | null;
    counterparty?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await tx.playerRosterEvent.create({
    data: {
      playerId: input.playerId,
      type: input.type,
      seasonId: input.seasonId ?? null,
      counterparty: input.counterparty ?? null,
      note: input.note ?? null,
    },
  });
}

/**
 * The seasons a player was rostered, collapsed into contiguous spans — so a
 * straight run reads "2026-2028" while a gap (transferred out then back) lists
 * each run: "2026-2027, 2028-2029". Seasons are consecutive when their start
 * years differ by one.
 */
export function activeSeasonSpans(seasons: { startYear: number; endYear: number }[]): string | null {
  const sorted = [...seasons].sort((a, b) => a.startYear - b.startYear);
  const uniq: { startYear: number; endYear: number }[] = [];
  for (const s of sorted) {
    if (!uniq.length || uniq[uniq.length - 1].startYear !== s.startYear) uniq.push(s);
  }
  if (uniq.length === 0) return null;

  const runs: string[] = [];
  let runStart = uniq[0];
  let prev = uniq[0];
  for (let i = 1; i < uniq.length; i++) {
    const cur = uniq[i];
    if (cur.startYear === prev.startYear + 1) {
      prev = cur;
      continue;
    }
    runs.push(`${runStart.startYear}-${prev.endYear}`);
    runStart = cur;
    prev = cur;
  }
  runs.push(`${runStart.startYear}-${prev.endYear}`);
  return runs.join(", ");
}
