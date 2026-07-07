import type { MediaType, MediaScope, MediaGenStatus } from "@/generated/prisma/enums";

/** Model used when no ModelSetting row exists yet for a media type. */
export const DEFAULT_MEDIA_MODEL = "google/gemini-2.5-flash";

/** Fallback byline voice when no AuthorPersona is chosen/seeded. */
export const DEFAULT_VOICE =
  "A college-football beat writer covering Caddo State. Writes a tight, " +
  "energetic AP-newswire recap: a punchy lede, concrete numbers woven into the " +
  "story, and a forward-looking kicker. Never invents facts beyond what is given.";

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  ARTICLE: "Article",
};

export const MEDIA_SCOPE_LABELS: Record<MediaScope, string> = {
  PLAYER: "Player",
  GAME: "Game",
  TEAM: "Team",
};

export const MEDIA_STATUS_LABELS: Record<MediaGenStatus, string> = {
  PENDING: "Queued",
  GENERATING: "Writing…",
  READY: "Ready",
  FAILED: "Failed",
};

/** The media types we can currently generate (drives the settings page rows). */
export const MEDIA_TYPES: MediaType[] = ["ARTICLE"];
