// Article "angles" — the template/angle a piece is written from. Scope is the
// anchor (game/player/season); the angle refines the subject brief and the
// writing instruction. Stored as a slug on Media/MediaEvent so new angles don't
// need a schema migration.

import type { MediaScope } from "@/generated/prisma/enums";

export type MediaAngle = {
  slug: string;
  label: string;
  scope: MediaScope;
  /** UI blurb for the new-post form. */
  blurb: string;
  /** Whether the subject picker chooses a played game, an upcoming game, a season,
   *  player(s), or a recruit. */
  subject: "gamePlayed" | "gameUpcoming" | "season" | "players" | "recruit" | "staff";
};

export const MEDIA_ANGLES: MediaAngle[] = [
  {
    slug: "recap",
    label: "Game recap",
    scope: "GAME",
    blurb: "A played game's box score.",
    subject: "gamePlayed",
  },
  {
    slug: "preview",
    label: "Game preview",
    scope: "GAME",
    blurb: "An upcoming matchup — no box score yet; add your own context.",
    subject: "gameUpcoming",
  },
  {
    slug: "feature",
    label: "Player feature",
    scope: "PLAYER",
    blurb: "One or more players, optionally focused on specific games.",
    subject: "players",
  },
  {
    slug: "season",
    label: "Season / team story",
    scope: "TEAM",
    blurb: "The state of the season so far.",
    subject: "season",
  },
  {
    slug: "injury",
    label: "Injury report",
    scope: "TEAM",
    blurb: "Who's banged up — written from injured players and their details.",
    subject: "season",
  },
  {
    slug: "recruiting",
    label: "Recruiting profile",
    scope: "RECRUIT",
    blurb: "A prospect breakdown (HS or transfer) — stars, rankings, fit, and where they stand with us.",
    subject: "recruit",
  },
  {
    slug: "departure",
    label: "Transfer portal — departure",
    scope: "PLAYER",
    blurb: "A player entering the transfer portal / leaving the program.",
    subject: "players",
  },
  {
    slug: "staff-feature",
    label: "Staff feature",
    scope: "STAFF",
    blurb: "A coach profile — tenure, record, philosophy, and where the program's headed.",
    subject: "staff",
  },
];

const BY_SLUG = new Map(MEDIA_ANGLES.map((a) => [a.slug, a]));

export function angleBySlug(slug: string | null | undefined): MediaAngle | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}

/** The default angle slug for a scope (used when an event has no explicit angle). */
export function defaultAngleForScope(scope: MediaScope): string {
  return scope === "GAME"
    ? "recap"
    : scope === "PLAYER"
      ? "feature"
      : scope === "RECRUIT"
        ? "recruiting"
        : scope === "STAFF"
          ? "staff-feature"
          : "season";
}
