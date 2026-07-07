import { Prisma } from "@/generated/prisma/client";
import type { PlayerClass } from "@/generated/prisma/enums";

export type RosterPlayerRow = {
  name: string;
  position: string;
  class: PlayerClass;
  number: number | null;
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
    select: { id: true, name: true },
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
    return existing.id;
  }

  const created = await tx.player.create({
    data: {
      name: row.name,
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
