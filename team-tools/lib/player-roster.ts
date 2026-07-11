import { Prisma } from "@/generated/prisma/client";
import type { PlayerClass } from "@/generated/prisma/enums";

export type RosterPlayerRow = {
  name: string;
  position: string;
  class: PlayerClass;
  number: number | null;
  /** Optional profile fields (set on a newly-created player; fills blanks on an
   *  existing one). Callers that don't have them omit them. */
  heightInches?: number | null;
  weightLbs?: number | null;
  hometown?: string | null;
};

/**
 * Attach a player to a roster, REUSING an existing player (matched by name,
 * case-insensitively, across all seasons) instead of creating a duplicate. This
 * is the one place player identity is deduped, so a remove + re-import cycle
 * can't spawn a second `Player` row for the same person. No-op if they are
 * already on this roster. Returns the player's id.
 *
 * Must run inside a transaction so concurrent rows in the same import see each
 * other's just-created players.
 */
export async function attachPlayerToRoster(
  tx: Prisma.TransactionClient,
  rosterId: number,
  row: RosterPlayerRow,
): Promise<number> {
  const existing = await tx.player.findFirst({
    where: { name: { equals: row.name, mode: "insensitive" } },
    select: { id: true, name: true, heightInches: true, weightLbs: true, hometown: true },
  });

  if (existing) {
    const already = await tx.seasonPlayer.findUnique({
      where: {
        seasonRosterId_playerId: { seasonRosterId: rosterId, playerId: existing.id },
      },
      select: { id: true },
    });
    if (!already) {
      await tx.seasonPlayer.create({
        data: {
          seasonRosterId: rosterId,
          playerId: existing.id,
          playerName: existing.name,
          position: row.position,
          class: row.class,
          number: row.number,
        },
      });
    }
    // Fill in profile fields the existing player is missing (never overwrite).
    const fill: { heightInches?: number; weightLbs?: number; hometown?: string } = {};
    if (existing.heightInches == null && row.heightInches != null) fill.heightInches = row.heightInches;
    if (existing.weightLbs == null && row.weightLbs != null) fill.weightLbs = row.weightLbs;
    if (!existing.hometown && row.hometown) fill.hometown = row.hometown;
    if (Object.keys(fill).length) {
      await tx.player.update({ where: { id: existing.id }, data: fill });
    }
    return existing.id;
  }

  const created = await tx.player.create({
    data: {
      name: row.name,
      heightInches: row.heightInches ?? null,
      weightLbs: row.weightLbs ?? null,
      hometown: row.hometown ?? null,
      seasonPlayers: {
        create: {
          seasonRosterId: rosterId,
          playerName: row.name,
          position: row.position,
          class: row.class,
          number: row.number,
        },
      },
    },
    select: { id: true },
  });
  return created.id;
}
