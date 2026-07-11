"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MicIcon, SquareIcon, Loader2Icon } from "lucide-react";
import { SaveForm } from "@/components/save-form";
import { Button } from "@/components/ui/button";
import { answerQuestion } from "@/app/press/actions";

const textareaClass =
  "min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Downmix an AudioBuffer to mono 16-bit PCM WAV (a format every provider accepts). */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const chs = buffer.numberOfChannels;
  const len = buffer.length;
  const mono = new Float32Array(len);
  for (let ch = 0; ch < chs; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += d[i] / chs;
  }
  const rate = buffer.sampleRate;
  const dataSize = len * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); str(8, "WAVE");
  str(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

async function blobToWav(blob: Blob): Promise<Blob> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    return audioBufferToWav(decoded);
  } finally {
    void ctx.close();
  }
}

/** Answer form for a pending press-conference question: type it, or dictate it with
 *  your voice (transcribed via OpenRouter). Submits through the answerQuestion action. */
export function PressAnswerForm({
  conferenceId,
  questionId,
  subjectName,
}: {
  conferenceId: number;
  questionId: number;
  subjectName: string;
}) {
  const [answer, setAnswer] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [canRecord, setCanRecord] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Feature-detect after mount (SSR has no navigator; flipping post-hydration
    // avoids a mismatch) — a one-time setState here is the intended pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanRecord(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined",
    );
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        await transcribe(blob);
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Couldn't access the microphone.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    const id = toast.loading("Transcribing…");
    try {
      const wav = await blobToWav(blob);
      const fd = new FormData();
      fd.append("audio", wav, "answer.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = (await res.json()) as { ok: boolean; text?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Transcription failed.");
      const text = (data.text ?? "").trim();
      if (!text) {
        toast.message("No speech detected.", { id });
      } else {
        setAnswer((a) => (a.trim() ? `${a.trim()} ${text}` : text));
        toast.success("Transcribed", { id });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed.", { id });
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <SaveForm action={answerQuestion} successText="Answered" className="space-y-3">
      <input type="hidden" name="conferenceId" value={conferenceId} />
      <input type="hidden" name="questionId" value={questionId} />
      <textarea
        name="answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={`Respond as ${subjectName} — type, or use the mic to dictate…`}
        className={textareaClass}
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={recording || transcribing}>Answer &amp; next</Button>
        {canRecord && (
          <Button
            type="button"
            variant={recording ? "destructive" : "outline"}
            size="sm"
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
          >
            {transcribing ? (
              <><Loader2Icon className="size-4 animate-spin" /> Transcribing…</>
            ) : recording ? (
              <><SquareIcon className="size-4" /> Stop</>
            ) : (
              <><MicIcon className="size-4" /> Dictate</>
            )}
          </Button>
        )}
      </div>
    </SaveForm>
  );
}
