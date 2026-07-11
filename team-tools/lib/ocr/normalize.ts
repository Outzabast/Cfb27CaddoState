import {
  PLAYER_STAT_GROUPS,
  TEAM_STAT_GROUPS,
  parseDuration,
  type StatGroup,
} from "@/lib/stat-fields";
import { normalizeClass, isValidLocation } from "@/lib/classes";
import {
  SCOREBOARD_FIELDS,
  type OcrKind,
  type OcrResult,
  type OcrRosterRow,
  type OcrScheduleRow,
  type OcrPlayerStatLine,
  type OcrScoringPlay,
  type OcrScoreboard,
  type OcrRecruitRow,
  type OcrPlay,
} from "./kinds";
import { nameKey } from "./name-match";
import { playMergeKey } from "@/lib/play-by-play";

const MAX_POSITION_LEN = 8;

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const s = v.trim().replace(/,/g, "");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toIntOrNull(v: unknown): number | null {
  const n = toNumberOrNull(v);
  return n === null ? null : Math.trunc(n);
}

function cleanString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function cleanPosition(v: unknown): string {
  return cleanString(v).slice(0, MAX_POSITION_LEN);
}

/** Descriptors of each field in a stat group, split by how they parse. */
function statFieldMeta(groups: StatGroup[]) {
  const duration = new Set<string>();
  const float = new Set<string>();
  const all = new Set<string>();
  for (const g of groups) {
    for (const f of g.fields) {
      all.add(f.name);
      if (f.format === "duration") duration.add(f.name);
      if (f.float) float.add(f.name);
    }
  }
  return { all, duration, float };
}

/** Coerce a raw `{ field: value }` object into a validated stats map. */
function normalizeStats(raw: unknown, groups: StatGroup[]): Record<string, number> {
  const { all, duration, float } = statFieldMeta(groups);
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!all.has(key)) continue;
    if (duration.has(key)) {
      if (typeof value === "string" && value.includes(":")) {
        try {
          out[key] = parseDuration(value);
        } catch {
          /* skip unparseable durations */
        }
      } else {
        const n = toIntOrNull(value);
        if (n !== null && n >= 0) out[key] = n;
      }
      continue;
    }
    const n = float.has(key) ? toNumberOrNull(value) : toIntOrNull(value);
    if (n !== null && n >= 0) out[key] = n;
  }
  return out;
}

function normalizeRoster(raw: unknown): OcrRosterRow[] {
  const players = asArray((raw as { players?: unknown })?.players);
  const rows: OcrRosterRow[] = [];
  for (const p of players) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const name = cleanString(o.name);
    const position = cleanPosition(o.position);
    if (!name && !position) continue;
    const { city, state } = splitHometown(o.hometown);
    rows.push({
      name,
      position,
      class: o.class == null ? null : normalizeClass(String(o.class)),
      number: toIntOrNull(o.number),
      heightInches: heightToInches(o.height),
      weightLbs: toIntOrNull(o.weightLbs),
      hometownCity: city,
      hometownState: state,
    });
  }
  return rows;
}

function normalizeSchedule(raw: unknown): OcrScheduleRow[] {
  const games = asArray((raw as { games?: unknown })?.games);
  const rows: OcrScheduleRow[] = [];
  for (const g of games) {
    if (!g || typeof g !== "object") continue;
    const o = g as Record<string, unknown>;
    const opponent = cleanString(o.opponent).replace(/^(@|vs\.?|at)\s+/i, "").trim();
    if (!opponent) continue;

    const loc = cleanString(o.location).toUpperCase();
    const dateStr = cleanString(o.date);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : null;
    let week = toIntOrNull(o.week);
    if (week !== null && (week < 0 || week > 20)) week = null;

    rows.push({
      week,
      date,
      opponent,
      location: isValidLocation(loc) ? loc : "HOME",
      teamPoints: toIntOrNull(o.teamPoints),
      oppPoints: toIntOrNull(o.oppPoints),
    });
  }
  return rows;
}

function normalizeScoreboard(raw: unknown): OcrScoreboard | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: OcrScoreboard = {};
  for (const key of SCOREBOARD_FIELDS) {
    const n = toIntOrNull(o[key]);
    if (n !== null && n >= 0) out[key] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function normalizePlayerStats(raw: unknown): OcrPlayerStatLine[] {
  const lines = asArray((raw as { lines?: unknown })?.lines);
  const out: OcrPlayerStatLine[] = [];
  for (const l of lines) {
    if (!l || typeof l !== "object") continue;
    const o = l as Record<string, unknown>;
    const playerName = cleanString(o.playerName);
    const stats = normalizeStats(o.stats, PLAYER_STAT_GROUPS);
    if (!playerName && Object.keys(stats).length === 0) continue;
    out.push({
      playerName,
      position: o.position == null ? null : cleanPosition(o.position) || null,
      stats,
    });
  }
  return out;
}

const CLOCK_RE = /^\d{1,2}:\d{2}$/;

/** A dedupe key for a timed play across overlapping screenshots. Delegates to the
 *  shared key so the clock's leading zero ("09:27" vs "9:27") never splits a play. */
const playKey = playMergeKey;

function normalizeScoringPlays(raw: unknown): OcrScoringPlay[] {
  const plays = asArray((raw as { plays?: unknown })?.plays);
  const out: OcrScoringPlay[] = [];
  for (const p of plays) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const description = cleanString(o.description).replace(/^\((?:[A-Z]{2,5})\)\s*/, "").trim();
    if (!description) continue;
    let quarter = toIntOrNull(o.quarter);
    if (quarter !== null && (quarter < 1 || quarter > 10)) quarter = null;
    const clockStr = cleanString(o.clock);
    const points = toIntOrNull(o.points);
    out.push({
      quarter,
      team: String(o.team ?? "").toLowerCase() === "opp" ? "opp" : "team",
      clock: CLOCK_RE.test(clockStr) ? clockStr : null,
      description,
      points: points !== null && points >= 0 ? points : null,
    });
  }
  return out;
}

/** Parse a height into inches from "6'6\"", "6-6", or a plain inch count. */
function heightToInches(raw: unknown): number | null {
  const s = cleanString(raw);
  if (!s) return null;
  const m = s.match(/(\d+)\s*['\-\s]\s*(\d+)/);
  if (m) return Number(m[1]) * 12 + Number(m[2]);
  const n = toIntOrNull(s);
  return n !== null && n > 0 ? n : null;
}

/** Split "New Orleans, LA" into [city, state]; a lone value is treated as city. */
function splitHometown(raw: unknown): { city: string | null; state: string | null } {
  const s = cleanString(raw);
  if (!s) return { city: null, state: null };
  const i = s.lastIndexOf(",");
  if (i === -1) return { city: s, state: null };
  return { city: s.slice(0, i).trim() || null, state: s.slice(i + 1).trim() || null };
}

function normalizeRecruits(raw: unknown): OcrRecruitRow[] {
  const rows = asArray((raw as { recruits?: unknown })?.recruits);
  const out: OcrRecruitRow[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = cleanString(o.name);
    const position = cleanPosition(o.position);
    if (!name && !position) continue;
    const stars = toIntOrNull(o.stars);
    const { city, state } = splitHometown(o.hometown);
    out.push({
      name,
      position,
      kind: String(o.kind ?? "").toUpperCase() === "TRANSFER" ? "TRANSFER" : "HIGH_SCHOOL",
      stars: stars === null ? null : Math.min(5, Math.max(0, stars)),
      nationalRank: toIntOrNull(o.nationalRank),
      stateRank: toIntOrNull(o.stateRank),
      positionRank: toIntOrNull(o.positionRank),
      heightInches: heightToInches(o.height),
      weightLbs: toIntOrNull(o.weightLbs),
      hometownCity: city,
      hometownState: state,
      previousSchool: cleanString(o.previousSchool) || null,
      signed: o.signed === true,
    });
  }
  return out;
}

/** Merge two reads of the same prospect: keep the longer name, fill null fields. */
function mergeRecruit(a: OcrRecruitRow, b: OcrRecruitRow): OcrRecruitRow {
  const pick = <T,>(x: T | null, y: T | null): T | null => (x ?? null) !== null ? x : y;
  return {
    name: b.name.length > a.name.length ? b.name : a.name,
    position: a.position || b.position,
    kind: a.kind === "TRANSFER" || b.kind === "TRANSFER" ? "TRANSFER" : "HIGH_SCHOOL",
    stars: pick(a.stars, b.stars),
    nationalRank: pick(a.nationalRank, b.nationalRank),
    stateRank: pick(a.stateRank, b.stateRank),
    positionRank: pick(a.positionRank, b.positionRank),
    heightInches: pick(a.heightInches, b.heightInches),
    weightLbs: pick(a.weightLbs, b.weightLbs),
    hometownCity: pick(a.hometownCity, b.hometownCity),
    hometownState: pick(a.hometownState, b.hometownState),
    previousSchool: pick(a.previousSchool, b.previousSchool),
    signed: a.signed || b.signed,
  };
}

const OCR_PLAY_TYPES = new Set<string>([
  "scrimmage", "touchdown", "extra_point", "extra_point_missed", "two_point",
  "two_point_failed", "field_goal", "field_goal_missed", "safety", "punt",
  "interception", "fumble", "turnover_on_downs", "kickoff", "penalty", "kneel",
  "end_period", "other",
]);

/** "team"/"opp"/null (null = unknown → the importer carries the last team forward). */
function toSide(v: unknown): "team" | "opp" | null {
  const s = String(v ?? "").toLowerCase();
  if (s === "team") return "team";
  if (s === "opp") return "opp";
  return null;
}

function normalizePlays(raw: unknown): OcrPlay[] {
  const plays = asArray((raw as { plays?: unknown })?.plays);
  const out: OcrPlay[] = [];
  for (const p of plays) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const description = cleanString(o.description);
    if (!description) continue;
    let quarter = toIntOrNull(o.quarter);
    if (quarter !== null && (quarter < 1 || quarter > 10)) quarter = null;
    const clock = cleanString(o.clock);
    const pt = String(o.playType ?? "").toLowerCase();
    const pts = toIntOrNull(o.points);
    out.push({
      quarter,
      clock: CLOCK_RE.test(clock) ? clock : null,
      team: toSide(o.team),
      situation: cleanString(o.situation) || null,
      description,
      playType: OCR_PLAY_TYPES.has(pt) ? (pt as OcrPlay["playType"]) : null,
      points: pts != null && pts >= 0 ? pts : null,
      scoringTeam: toSide(o.scoringTeam),
    });
  }
  return out;
}

/**
 * Merge normalized results from multiple OCR batches (each batch = its own model
 * request over ≤8 images) into one, so a big import can be split across calls for
 * cleaner extraction and reassembled at presentation time. Rows dedupe by
 * identity; stat maps union (first non-empty wins); player categories merge onto
 * one line by name — the same merge the review dialog does across screenshots.
 */
export function mergeOcrResults(parts: OcrResult[]): OcrResult {
  const first = parts[0];
  if (parts.length === 1) return first;

  switch (first.kind) {
    case "roster": {
      const pick = <T,>(x: T | null, y: T | null): T | null => (x ?? null) !== null ? x : y;
      const byKey = new Map<string, OcrRosterRow>();
      const order: string[] = [];
      let anon = 0;
      for (const p of parts as Extract<OcrResult, { kind: "roster" }>[]) {
        for (const r of p.rows) {
          const key = r.name ? nameKey(r.name) : `__anon_${anon++}`;
          const ex = byKey.get(key);
          if (ex) {
            byKey.set(key, {
              name: r.name.length > ex.name.length ? r.name : ex.name,
              position: ex.position || r.position,
              class: ex.class ?? r.class,
              number: pick(ex.number, r.number),
              heightInches: pick(ex.heightInches, r.heightInches),
              weightLbs: pick(ex.weightLbs, r.weightLbs),
              hometownCity: pick(ex.hometownCity, r.hometownCity),
              hometownState: pick(ex.hometownState, r.hometownState),
            });
          } else {
            byKey.set(key, r);
            order.push(key);
          }
        }
      }
      return { kind: "roster", rows: order.map((k) => byKey.get(k)!) };
    }
    case "schedule": {
      const rows: OcrScheduleRow[] = [];
      const seen = new Set<string>();
      for (const p of parts as Extract<OcrResult, { kind: "schedule" }>[]) {
        for (const r of p.rows) {
          const key = r.week != null ? `w${r.week}` : `o${r.opponent.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push(r);
        }
      }
      return { kind: "schedule", rows };
    }
    case "teamStats": {
      const stats: Record<string, number> = {};
      const oppStats: Record<string, number> = {};
      let scoreboard: OcrScoreboard | null = null;
      for (const p of parts as Extract<OcrResult, { kind: "teamStats" }>[]) {
        for (const [k, v] of Object.entries(p.stats)) if (!(k in stats)) stats[k] = v;
        for (const [k, v] of Object.entries(p.oppStats)) if (!(k in oppStats)) oppStats[k] = v;
        if (p.scoreboard) scoreboard = { ...(scoreboard ?? {}), ...p.scoreboard };
      }
      return { kind: "teamStats", stats, oppStats, scoreboard };
    }
    case "playerStats": {
      const byKey = new Map<string, OcrPlayerStatLine>();
      const order: string[] = [];
      let unnamed = 0;
      for (const p of parts as Extract<OcrResult, { kind: "playerStats" }>[]) {
        for (const l of p.lines) {
          const name = l.playerName.trim();
          const key = name ? name.toLowerCase() : `__unnamed_${unnamed++}`;
          const ex = byKey.get(key);
          if (ex) {
            ex.stats = { ...ex.stats, ...l.stats };
            if (l.playerName.length > ex.playerName.length) ex.playerName = l.playerName;
            if (!ex.position && l.position) ex.position = l.position;
          } else {
            byKey.set(key, { ...l, stats: { ...l.stats } });
            order.push(key);
          }
        }
      }
      return { kind: "playerStats", lines: order.map((k) => byKey.get(k)!) };
    }
    case "scoringSummary": {
      const plays: OcrScoringPlay[] = [];
      const seen = new Set<string>();
      let scoreboard: OcrScoreboard | null = null;
      for (const p of parts as Extract<OcrResult, { kind: "scoringSummary" }>[]) {
        for (const play of p.plays) {
          const key = playKey(play.quarter, play.clock, play.description);
          if (seen.has(key)) continue;
          seen.add(key);
          plays.push(play);
        }
        if (p.scoreboard) scoreboard = { ...(scoreboard ?? {}), ...p.scoreboard };
      }
      return { kind: "scoringSummary", plays, scoreboard };
    }
    case "recruits": {
      // Reconcile list rows with detail cards by first-initial + surname, so an
      // abbreviated "S. Rozeboom" folds into the full "Shaun Rozeboom".
      const byKey = new Map<string, OcrRecruitRow>();
      const order: string[] = [];
      let anon = 0;
      for (const p of parts as Extract<OcrResult, { kind: "recruits" }>[]) {
        for (const r of p.rows) {
          const key = r.name ? nameKey(r.name) : `__anon_${anon++}`;
          const existing = byKey.get(key);
          if (existing) byKey.set(key, mergeRecruit(existing, r));
          else {
            byKey.set(key, r);
            order.push(key);
          }
        }
      }
      return { kind: "recruits", rows: order.map((k) => byKey.get(k)!) };
    }
    case "playByPlay": {
      const plays: OcrPlay[] = [];
      const seen = new Set<string>();
      for (const p of parts as Extract<OcrResult, { kind: "playByPlay" }>[]) {
        for (const play of p.plays) {
          const key = playKey(play.quarter, play.clock, play.description);
          if (seen.has(key)) continue;
          seen.add(key);
          plays.push(play);
        }
      }
      return { kind: "playByPlay", plays };
    }
  }
}

/** Turn the raw model JSON into the normalized, app-typed result for a kind. */
export function normalizeResult(kind: OcrKind, raw: unknown): OcrResult {
  switch (kind) {
    case "roster":
      return { kind, rows: normalizeRoster(raw) };
    case "schedule":
      return { kind, rows: normalizeSchedule(raw) };
    case "teamStats":
      return {
        kind,
        stats: normalizeStats((raw as { stats?: unknown })?.stats, TEAM_STAT_GROUPS),
        oppStats: normalizeStats((raw as { oppStats?: unknown })?.oppStats, TEAM_STAT_GROUPS),
        scoreboard: normalizeScoreboard((raw as { scoreboard?: unknown })?.scoreboard),
      };
    case "playerStats":
      return { kind, lines: normalizePlayerStats(raw) };
    case "scoringSummary":
      return {
        kind,
        plays: normalizeScoringPlays(raw),
        scoreboard: normalizeScoreboard((raw as { scoreboard?: unknown })?.scoreboard),
      };
    case "recruits":
      return { kind, rows: normalizeRecruits(raw) };
    case "playByPlay":
      return { kind, plays: normalizePlays(raw) };
  }
}
