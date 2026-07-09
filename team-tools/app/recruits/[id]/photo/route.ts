import { db } from "@/lib/db";

/** Serves a recruit's uploaded PNG headshot (stored as bytes). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });

  const recruit = await db.recruit.findUnique({
    where: { id },
    select: { photo: true },
  });
  if (!recruit?.photo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(recruit.photo), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
