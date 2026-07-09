import type { MediaType, MediaScope, MediaGenStatus } from "@/generated/prisma/enums";

/** Model used when no ModelSetting row exists yet for a media type. */
export const DEFAULT_MEDIA_MODEL = "google/gemini-2.5-flash";

/** Audio model used to narrate AUDIO media when no AUDIO ModelSetting exists. */
export const DEFAULT_AUDIO_MODEL = "openai/gpt-audio-mini";

/** OpenAI TTS voices an audio persona can narrate with (first = default). */
export const AUDIO_VOICES = [
  "ash", "alloy", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse",
] as const;
export const DEFAULT_TTS_VOICE = "ash";

/**
 * Ground-truth canon about the program, injected into EVERY generator so the
 * model never fills gaps with real-world guesses (e.g. hallucinating a nearby
 * school's stadium). Edit here to add more facts — mascot, city, rivals, etc.
 */
export const TEAM_FACTS =
  "You cover the Caddo State Lumberjacks. Always call the team Caddo State or the " +
  "Lumberjacks. Team colors are navy and gold. Home games are played at Founders Field. " +
  "Never invent a different team name, nickname, city, stadium, or colors — if a " +
  "detail isn't provided, leave it out rather than guess.";

/**
 * Standing-fact importance (0–100) at/above which a fact is force-injected into
 * every relevant piece (the STANDING CONTEXT block). Facts below this stay out of
 * the prompt but are researchable via the list_facts tool — so the editorial
 * archive can grow without bloating every generation's context.
 */
export const FACT_AUTOINJECT_THRESHOLD = 70;

/** Fallback byline voice when no AuthorPersona is chosen/seeded. */
export const DEFAULT_VOICE =
  "A college-football beat writer covering Caddo State. Writes a tight, " +
  "energetic AP-newswire recap: a punchy lede, concrete numbers woven into the " +
  "story, and a forward-looking kicker. Never invents facts beyond what is given.";

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  ARTICLE: "Article",
  XPOST: "Social",
  AUDIO: "Audio",
};

export const MEDIA_SCOPE_LABELS: Record<MediaScope, string> = {
  PLAYER: "Player",
  GAME: "Game",
  TEAM: "Team",
  RECRUIT: "Recruit",
};

export const MEDIA_STATUS_LABELS: Record<MediaGenStatus, string> = {
  PENDING: "Queued",
  GENERATING: "Writing…",
  READY: "Ready",
  FAILED: "Failed",
};

/** The media types we can currently generate (drives the settings page rows). */
export const MEDIA_TYPES: MediaType[] = ["ARTICLE", "XPOST", "AUDIO"];
