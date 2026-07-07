import { db } from "@/lib/db";

/** Serves a media piece's uploaded PNG header image (stored as bytes). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });

  const media = await db.media.findUnique({
    where: { id },
    select: { photo: true },
  });
  if (!media?.photo) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(media.photo), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
