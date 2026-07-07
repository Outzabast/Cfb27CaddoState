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
  type OcrScoreboard,
} from "./kinds";

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
    rows.push({
      name,
      position,
      class: o.class == null ? null : normalizeClass(String(o.class)),
      number: toIntOrNull(o.number),
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
  }
}
