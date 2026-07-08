// Text-to-speech via OpenRouter's audio models (openai/gpt-audio*). Audio output
// must be STREAMED and the only streamable format is raw pcm16 (24 kHz mono), so
// we reassemble the pcm chunks and wrap them in a WAV container the browser plays.

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const SAMPLE_RATE = 24000; // gpt-audio pcm16 output rate
const CHANNELS = 1;

export type SynthesizedAudio = {
  wav: Uint8Array<ArrayBuffer>;
  mime: string;
  seconds: number;
  transcript: string;
  costUsd: number | null;
};

/** Wrap raw 16-bit little-endian PCM in a minimal WAV/RIFF container. */
function pcm16ToWav(pcm: Uint8Array, sampleRate = SAMPLE_RATE, channels = CHANNELS): Uint8Array<ArrayBuffer> {
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  // Allocate a fresh ArrayBuffer-backed array (what Prisma Bytes expects).
  const out = new Uint8Array(44 + pcm.length);
  out.set(header, 0);
  out.set(pcm, 44);
  return out;
}

/**
 * Narrate `text` with an OpenRouter audio model + voice. Returns a playable WAV.
 * Throws with a readable message on config/network/stream failure.
 */
export async function synthesizeSpeech(
  model: string,
  voice: string,
  text: string,
): Promise<SynthesizedAudio> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) throw new Error("OPEN_ROUTER_API_KEY is not set on the server.");

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Caddo State Team Tools",
      },
      body: JSON.stringify({
        model,
        modalities: ["text", "audio"],
        audio: { voice, format: "pcm16" },
        stream: true,
        usage: { include: true },
        messages: [
          {
            role: "user",
            content:
              "You are a sports-radio host. Read the following monologue aloud, " +
              "verbatim and naturally — do not add, omit, or comment on anything:\n\n" +
              text,
          },
        ],
      }),
    });
  } catch (e) {
    throw new Error(`Could not reach OpenRouter: ${(e as Error).message}`);
  }
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter audio error ${res.status}: ${body.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const pcmChunks: Buffer[] = [];
  let transcript = "";
  let costUsd: number | null = null;
  let buf = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      let j: {
        usage?: { cost?: number };
        choices?: { delta?: { audio?: { data?: string; transcript?: string } } }[];
        error?: { message?: string };
      };
      try {
        j = JSON.parse(payload);
      } catch {
        continue;
      }
      if (j.error) throw new Error(j.error.message || "Audio stream returned an error.");
      if (typeof j.usage?.cost === "number") costUsd = j.usage.cost;
      const a = j.choices?.[0]?.delta?.audio;
      if (a?.data) pcmChunks.push(Buffer.from(a.data, "base64"));
      if (a?.transcript) transcript += a.transcript;
    }
  }

  const pcm = Buffer.concat(pcmChunks);
  if (pcm.length === 0) throw new Error("Audio model returned no audio.");

  return {
    wav: pcm16ToWav(pcm),
    mime: "audio/wav",
    seconds: Math.round(pcm.length / (SAMPLE_RATE * CHANNELS * 2)),
    transcript: transcript.trim(),
    costUsd,
  };
}
