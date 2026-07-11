import { db } from "@/lib/db";

/** Serves a press-conference question's spoken audio (WAV bytes). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ qid: string }> },
) {
  const qid = Number((await params).qid);
  if (!Number.isInteger(qid)) return new Response("Not found", { status: 404 });

  const q = await db.pressConferenceQuestion.findUnique({
    where: { id: qid },
    select: { audio: true, audioMime: true },
  });
  if (!q?.audio) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(q.audio), {
    headers: { "Content-Type": q.audioMime ?? "audio/wav", "Cache-Control": "no-store" },
  });
}
