import { db } from "@/lib/db";

/** Serves an AUDIO piece's synthesized WAV (stored as bytes). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });

  const media = await db.media.findUnique({
    where: { id },
    select: { audio: true, audioMime: true },
  });
  if (!media?.audio) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(media.audio), {
    headers: {
      "Content-Type": media.audioMime ?? "audio/wav",
      "Cache-Control": "no-store",
    },
  });
}
