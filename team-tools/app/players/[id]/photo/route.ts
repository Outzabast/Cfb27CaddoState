import { db } from "@/lib/db";

/** Serves a player's uploaded PNG (stored as bytes in Postgres). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });

  const player = await db.player.findUnique({
    where: { id },
    select: { photo: true },
  });
  if (!player?.photo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(player.photo), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
