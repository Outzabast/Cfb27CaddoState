import { db } from "@/lib/db";

/** Serves a staff member's uploaded PNG (stored as bytes in Postgres). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });

  const staff = await db.staff.findUnique({ where: { id }, select: { photo: true } });
  if (!staff?.photo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(staff.photo), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
