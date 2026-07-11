// Grouping + result inference for a game's play-by-play. Drives aren't stored;
// they're derived by splitting the ordered plays on possession changes, and each
// drive's result is guessed from its scoring play's text (cosmetic — the raw plays
// are the source of truth). Shared by the box-score display and media briefs.
//
// Special-teams plays sit inside whichever drive they belong to in the source feed
// (e.g. a kickoff or a punt + its return show up in the receiving/punting team's
// drive). We leave them there but treat them specially when inferring the result:
// the extra point / two-point try that trails a touchdown is an appendage, not the
// drive's outcome, and a turnover returned for a score is a turnover for the drive
// that lost the ball — not that team's touchdown.

import type { PlayType } from "@/generated/prisma/enums";

/** Canonical game clock, so "09:27" and "9:27" compare equal ("" for no clock). */
export function normClock(clock: string | null | undefined): string {
  const m = String(clock ?? "").match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${Number(m[1])}:${m[2]}` : "";
}

/** A merge key for a play: same period + same clock + same text = the same play,
 *  seen twice across overlapping screenshots. Punctuation/spacing/·case-insensitive. */
export function playMergeKey(
  quarter: number | null,
  clock: string | null,
  description: string,
): string {
  const desc = description.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${quarter}|${normClock(clock)}|${desc}`;
}

export type PlayLite = {
  quarter: number;
  clock: string | null;
  team: "TEAM" | "OPP";
  situation: string | null;
  description: string;
  /** Manual drive-boundary override: true = force a split at this play, false =
   *  force a merge onto the previous drive, null/undefined = automatic. */
  newDrive?: boolean | null;
  /** Typed outcome — drives scoring & drive result when present (legacy rows are
   *  SCRIMMAGE and fall back to text parsing). */
  playType?: PlayType | null;
  /** Points scored on this play (0 for non-scoring). */
  points?: number | null;
  /** Which team got the points (defaults to possession when null but points > 0). */
  scoringTeam?: "TEAM" | "OPP" | null;
};

export type Drive = {
  team: "TEAM" | "OPP";
  plays: PlayLite[];
  result: string;
  /** Running score AFTER this drive (Caddo State, opponent), computed from the
   *  scoring plays up to and including this drive. */
  teamScore: number;
  oppScore: number;
};

/** Whether `play` begins a new drive after `prev`. Honors the manual override
 *  first, then falls back to "possession changed". */
function startsNewDrive(prev: PlayLite | undefined, play: PlayLite): boolean {
  if (!prev) return true;
  if (play.newDrive === true) return true;
  if (play.newDrive === false) return false;
  return play.team !== prev.team;
}

/** A trailing play that follows a score and isn't itself the drive's outcome:
 *  the PAT / two-point try (however abbreviated — "2pt. conv.", "2-pt", "two-point
 *  conversion"), or the ensuing kickoff. */
function isScoringAppendage(desc: string): boolean {
  const t = desc.toLowerCase();
  return (
    /\bextra point\b|\bpat\b|two[-\s]?point|2[-\s]?pt|conversion|\bconv\b/.test(t) ||
    /\bkicks? off\b|\bkickoff\b/.test(t)
  );
}

/** Classify a single (already-lowercased) play description into a drive outcome.
 *  Order matters: a turnover or punt wins over a stray "td" mention so that a
 *  pick-six reads as an interception (for the team that threw it) rather than a
 *  touchdown, and a punt returned for a score reads as a punt. */
function classifyOutcome(t: string): string {
  if (/intercept/.test(t)) return "Interception";
  if (/fumble/.test(t) && /(lost|recovered by|returned)/.test(t)) return "Fumble";
  if (/\bpunt(s|ed|er)?\b/.test(t)) return "Punt";
  if (/(field goal|\bfg\b).*(good)|good.*(field goal|\bfg\b)/.test(t)) return "Field Goal";
  if (/(field goal|\bfg\b).*(miss|no good|blocked)|missed.*(field goal|\bfg\b)|blocked.*(field goal|\bfg\b)/.test(t))
    return "Missed FG";
  if (/\btouchdown\b|\btd\b/.test(t)) return "Touchdown";
  if (/\bsafety\b/.test(t)) return "Safety";
  if (/on downs/.test(t)) return "Turnover on downs";
  if (/kneel|victory formation/.test(t)) return "Kneel";
  if (/end of (the )?(quarter|half|game|1st|2nd|3rd|4th)/.test(t)) return "End of period";
  return "—";
}

/** Human label for a typed play outcome, or null if that type isn't a drive
 *  concluder (so we fall back to text parsing). */
const TYPE_LABEL: Partial<Record<PlayType, string>> = {
  TOUCHDOWN: "Touchdown",
  FIELD_GOAL: "Field Goal",
  FIELD_GOAL_MISSED: "Missed FG",
  SAFETY: "Safety",
  PUNT: "Punt",
  INTERCEPTION: "Interception",
  FUMBLE: "Fumble",
  TURNOVER_ON_DOWNS: "Turnover on downs",
  KNEEL: "Kneel",
  END_PERIOD: "End of period",
};

/** Play types that trail a score and aren't a drive's outcome. */
const APPENDAGE_TYPES = new Set<PlayType>([
  "EXTRA_POINT",
  "EXTRA_POINT_MISSED",
  "TWO_POINT",
  "TWO_POINT_FAILED",
  "KICKOFF",
  "PENALTY",
]);

const isTyped = (p: PlayLite) => p.playType != null && p.playType !== "SCRIMMAGE";

/** Whether a play is a trailing appendage (typed PAT/2pt/kickoff, or — for legacy
 *  rows — inferred from the text). */
function isAppendagePlay(p: PlayLite): boolean {
  if (isTyped(p)) return APPENDAGE_TYPES.has(p.playType as PlayType);
  return isScoringAppendage(p.description);
}

/** A single play's outcome label — typed when available, else text-parsed. */
function outcomeOf(p: PlayLite | undefined): string {
  if (!p) return "—";
  if (isTyped(p)) return TYPE_LABEL[p.playType as PlayType] ?? classifyOutcome(p.description.toLowerCase());
  return classifyOutcome(p.description.toLowerCase());
}

/** Best-effort drive outcome. Reads the last *meaningful* play — skipping the
 *  extra-point / two-point / ensuing-kickoff appendages that trail a score — so a
 *  touchdown followed by a PAT is still a touchdown. */
export function driveResult(plays: PlayLite[]): string {
  let i = plays.length - 1;
  while (i > 0 && isAppendagePlay(plays[i])) i--;
  return outcomeOf(plays[i]);
}

/** A drive is "concluded" when its outcome is a recognized ending. Drives that
 *  resolve to "—" need the user's attention in the reconciliation view. */
export function driveConcluded(plays: PlayLite[]): boolean {
  return driveResult(plays) !== "—";
}

// ---- Scoring -------------------------------------------------------------

/** Was a kick/conversion successful? Guards against "no good", blocks, misses. */
function made(t: string): boolean {
  if (/(no good|missed|\bmiss\b|blocked|\bblock\b|failed|\bfail\b|\bwide\b|stopped|intercepted)/.test(t)) {
    return false;
  }
  return /\bgood\b|\bis good\b|converted|successful|\bsuccess\b|\bmade\b/.test(t);
}

type PlayScore = { team: number; opp: number; tdTeam: "TEAM" | "OPP" | null };

/**
 * Points a single play puts on the board, and to which team. `possTeam` is the
 * side with the ball on this play (the drive's possession). `lastTd` is the team
 * credited with the most recent touchdown, so a trailing PAT / two-point try is
 * credited to whoever actually scored — critical for defensive & return TDs.
 *
 * Attribution rules, in priority order:
 *  - pick-six / fumble-return TD → the DEFENSE (the other team)
 *  - punt-return TD → the RETURNING team (the other team; the punt is logged
 *    under the punting team's drive)
 *  - kickoff-return TD → the RECEIVING team (the drive's own team; the kickoff
 *    is logged under the receiver's drive)
 *  - plain touchdown → the offense (possession)
 *  - field goal → the offense; safety → the defense
 *  - extra point / two-point → whoever scored the touchdown it follows
 */
function scorePlay(p: PlayLite, lastTd: "TEAM" | "OPP" | null): PlayScore {
  const t = p.description.toLowerCase();
  const T = p.team;
  const O: "TEAM" | "OPP" = T === "TEAM" ? "OPP" : "TEAM";
  const to = (side: "TEAM" | "OPP", pts: number, td: "TEAM" | "OPP" | null): PlayScore =>
    side === "TEAM" ? { team: pts, opp: 0, tdTeam: td } : { team: 0, opp: pts, tdTeam: td };
  const none: PlayScore = { team: 0, opp: 0, tdTeam: lastTd };

  const hasTd = /\btouchdown\b|\btd\b/.test(t);
  if (hasTd) {
    if (/intercept/.test(t)) return to(O, 6, O); // pick six
    if (/fumble/.test(t) && /(return|recover)/.test(t)) return to(O, 6, O); // scoop & score
    if (/\bpunt/.test(t)) return to(O, 6, O); // punt-return TD → returning team
    if (/\bkick(off)?\b|kick return|returns? (the )?kick/.test(t)) return to(T, 6, T); // KR TD → receiver
    return to(T, 6, T); // offensive TD
  }

  if (/(field goal|\bfg\b)/.test(t) && made(t)) return to(T, 3, lastTd);
  if (/\bsafety\b/.test(t)) return to(O, 2, lastTd); // safety → the defense scores 2

  // Conversions follow a TD, so credit the team that just scored (lastTd).
  if (/(two[-\s]?point|2[-\s]?pt|2pt|conversion)/.test(t)) {
    return made(t) ? to(lastTd ?? T, 2, lastTd) : none;
  }
  if (/(extra point|\bpat\b|\bxp\b)/.test(t)) {
    return made(t) ? to(lastTd ?? T, 1, lastTd) : none;
  }
  return none;
}

/** Points each play scored, aligned to `plays`. Uses the typed points/scoringTeam
 *  when the game has any (the reliable path), else falls back to parsing the text
 *  with the running-touchdown attribution above (legacy games). */
function perPlayPoints(plays: PlayLite[]): { team: number; opp: number }[] {
  const anyTyped = plays.some((p) => (p.points ?? 0) !== 0);
  if (anyTyped) {
    return plays.map((p) => {
      const pts = p.points ?? 0;
      if (pts === 0) return { team: 0, opp: 0 };
      const side = p.scoringTeam ?? p.team;
      return side === "TEAM" ? { team: pts, opp: 0 } : { team: 0, opp: pts };
    });
  }
  let lastTd: "TEAM" | "OPP" | null = null;
  return plays.map((p) => {
    const s = scorePlay(p, lastTd);
    lastTd = s.tdTeam;
    return { team: s.team, opp: s.opp };
  });
}

/** Running score (Caddo State, opponent) AFTER each drive, in order. */
export function scoreAfterEachDrive(
  drives: { team: "TEAM" | "OPP"; plays: PlayLite[] }[],
): { team: number; opp: number }[] {
  const flat = drives.flatMap((d) => d.plays);
  const pp = perPlayPoints(flat);
  let team = 0;
  let opp = 0;
  let i = 0;
  return drives.map((d) => {
    for (let k = 0; k < d.plays.length; k++, i++) {
      team += pp[i].team;
      opp += pp[i].opp;
    }
    return { team, opp };
  });
}

/** Points the play-by-play attributes to each team, bucketed by period (1–4, and
 *  5 = OT). Used to reconcile the derived PBP score against the authoritative
 *  score-by-quarter. */
export function pointsByQuarter(
  plays: PlayLite[],
): { quarter: number; team: number; opp: number }[] {
  const pp = perPlayPoints(plays);
  const buckets = new Map<number, { team: number; opp: number }>();
  plays.forEach((p, i) => {
    const q = p.quarter >= 5 ? 5 : p.quarter;
    const b = buckets.get(q) ?? { team: 0, opp: 0 };
    b.team += pp[i].team;
    b.opp += pp[i].opp;
    buckets.set(q, b);
  });
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([quarter, v]) => ({ quarter, team: v.team, opp: v.opp }));
}

/** Caddo State's field-position marker in situation lines ("on CSU 35"). */
const CADDO_ABBR = "CSU";

/** Pull the field position out of a situation line — "1st & 10 on NIU 25" →
 *  { abbr: "NIU", yard: 25 }, "1st & Goal on CSU 7" → { abbr: "CSU", yard: 7 }. */
function parseFieldPos(situation: string | null | undefined): { abbr: string; yard: number } | null {
  if (!situation) return null;
  const m = situation.match(/\bon\s+([A-Za-z]{2,5})\s+(\d{1,2})\b/i);
  if (!m) return null;
  const yard = Number(m[2]);
  if (!Number.isInteger(yard) || yard < 1 || yard > 50) return null;
  return { abbr: m[1].toUpperCase(), yard };
}

/** Down & distance from a situation line: "3rd & 5 on CSU 19" → { down: 3, dist: 5 },
 *  "1st & Goal on NIU 7" → { down: 1, dist: 0 }. */
function parseDown(situation: string | null | undefined): { down: number; dist: number } | null {
  const m = String(situation ?? "").match(/\b(1st|2nd|3rd|4th)\s*(?:&|and)\s*(goal|\d{1,2})\b/i);
  if (!m) return null;
  const down = m[1] === "1st" ? 1 : m[1] === "2nd" ? 2 : m[1] === "3rd" ? 3 : 4;
  const dist = /goal/i.test(m[2]) ? 0 : Number(m[2]);
  return { down, dist };
}

/** Did the down-`i` play in this drive move the chains? A touchdown on the play,
 *  or the next play in the drive being 1st down (a fresh set), means it converted. */
function convertedDown(drive: { team: "TEAM" | "OPP"; plays: PlayLite[] }, i: number): boolean {
  const p = drive.plays[i];
  if (p.playType === "TOUCHDOWN") return true;
  if ((p.points ?? 0) >= 6 && (p.scoringTeam ?? p.team) === drive.team) return true;
  const next = drive.plays[i + 1];
  return next ? parseDown(next.situation)?.down === 1 : false;
}

export type DownEff = {
  firstDowns: number;
  thirdConv: number; thirdAtt: number;
  fourthConv: number; fourthAtt: number;
};

/**
 * First-down count and 3rd/4th-down efficiency for both teams, derived from the
 * play-by-play's down & distance. First downs = fresh 1st-down sets after the
 * drive's opening set. 3rd/4th-down attempts are plays on that down (4th-down
 * attempts exclude punts and field-goal tries); a conversion moves the chains.
 */
export function downEfficiencyByTeam(plays: PlayLite[]): { team: DownEff; opp: DownEff } {
  const blank = (): DownEff => ({ firstDowns: 0, thirdConv: 0, thirdAtt: 0, fourthConv: 0, fourthAtt: 0 });
  const out = { team: blank(), opp: blank() };
  for (const d of groupDrives(plays)) {
    const eff = d.team === "TEAM" ? out.team : out.opp;
    let sawFirst = false;
    d.plays.forEach((p, i) => {
      const dd = parseDown(p.situation);
      if (!dd) return;
      if (dd.down === 1) {
        if (sawFirst) eff.firstDowns++;
        else sawFirst = true; // the drive's opening set isn't a "gained" first down
      } else if (dd.down === 3) {
        eff.thirdAtt++;
        if (convertedDown(d, i)) eff.thirdConv++;
      } else if (dd.down === 4) {
        const pt = p.playType;
        const special = pt === "PUNT" || pt === "FIELD_GOAL" || pt === "FIELD_GOAL_MISSED";
        if (!special) {
          eff.fourthAtt++;
          if (convertedDown(d, i)) eff.fourthConv++;
        }
      }
    });
  }
  return out;
}

export type RedZone = { trips: number; td: number; fg: number };

/**
 * Red-zone efficiency for both teams, derived from the play-by-play: a drive is a
 * "trip" when it snaps the ball inside the opponent's 20 (their territory, ≤ the
 * 20). Each trip resolves to a touchdown, a made field goal, or nothing (a
 * turnover, a miss, downs). Standard efficiency = (td + fg) / trips.
 *
 * Territory is read from the situation's "on <ABBR> <yard>": Caddo State's own
 * side is "CSU", so a Caddo drive is in the red zone on a non-CSU yardline ≤ 20,
 * and an opponent drive is in the red zone on a "CSU" yardline ≤ 20.
 */
export function redZoneByTeam(plays: PlayLite[]): { team: RedZone; opp: RedZone } {
  const out = { team: { trips: 0, td: 0, fg: 0 }, opp: { trips: 0, td: 0, fg: 0 } };
  for (const d of groupDrives(plays)) {
    const inRz = d.plays.some((p) => {
      const fp = parseFieldPos(p.situation);
      if (!fp || fp.yard > 20) return false;
      const caddoTerritory = fp.abbr === CADDO_ABBR;
      // The possessing team is in its opponent's red zone.
      return d.team === "TEAM" ? !caddoTerritory : caddoTerritory;
    });
    if (!inRz) continue;
    const bucket = d.team === "TEAM" ? out.team : out.opp;
    bucket.trips++;
    const r = driveResult(d.plays);
    if (r === "Touchdown") bucket.td++;
    else if (r === "Field Goal") bucket.fg++;
  }
  return out;
}

/** Split ordered plays into drives on possession change (or a manual override).
 *  A drive's possession is its first play's team; each drive also carries the
 *  running score after it. */
export function groupDrives(plays: PlayLite[]): Drive[] {
  const drives: Drive[] = [];
  let prev: PlayLite | undefined;
  for (const p of plays) {
    if (startsNewDrive(prev, p))
      drives.push({ team: p.team, plays: [p], result: "", teamScore: 0, oppScore: 0 });
    else drives[drives.length - 1].plays.push(p);
    prev = p;
  }
  const scores = scoreAfterEachDrive(drives);
  drives.forEach((d, i) => {
    d.result = driveResult(d.plays);
    d.teamScore = scores[i].team;
    d.oppScore = scores[i].opp;
  });
  return drives;
}
