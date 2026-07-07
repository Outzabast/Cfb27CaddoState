// EA box-score screens give names as "F.Last" (e.g. "B.Joiner", "T.Turner").
// These helpers relate those to each other across screenshots and to full
// roster names so the same person's stat categories merge onto one line.

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/** Lowercased alphabetic tokens, with generational suffixes dropped. */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s.]/g, " ")
    .split(/[\s.]+/)
    .filter(Boolean)
    .filter((t) => !NAME_SUFFIXES.has(t));
}

/**
 * A stable key for a name that ignores whether the first name is spelled out
 * or abbreviated: first initial + surname. "B.Joiner", "B. Joiner", and
 * "Bryce Joiner" all key to "b|joiner", so the same player merges across
 * category screenshots.
 */
export function nameKey(name: string): string {
  const t = nameTokens(name);
  if (t.length === 0) return name.trim().toLowerCase();
  const surname = t[t.length - 1];
  const initial = t[0]?.[0] ?? "";
  return `${initial}|${surname}`;
}

export type Named = { name: string };

/**
 * Best-effort match of an OCR name to one of `candidates` (roster players).
 * Returns the matched index, or -1. Surname must match; a first-initial match
 * disambiguates when several share a surname.
 */
export function matchNameIndex(name: string, candidates: Named[]): number {
  const t = nameTokens(name);
  if (t.length === 0) return -1;
  const surname = t[t.length - 1];
  const firstInit = t[0]?.[0];

  const bySurname = candidates
    .map((c, i) => ({ i, tokens: nameTokens(c.name) }))
    .filter(({ tokens }) => tokens[tokens.length - 1] === surname);

  if (bySurname.length === 1) return bySurname[0].i;
  if (bySurname.length > 1 && firstInit) {
    const byInit = bySurname.find(({ tokens }) => tokens[0]?.[0] === firstInit);
    if (byInit) return byInit.i;
  }
  if (bySurname.length > 1) return bySurname[0].i;

  // Loose contains fallback (handles full-name-vs-full-name).
  const joined = t.join(" ");
  const loose = candidates.findIndex((c) => nameTokens(c.name).join(" ").includes(joined));
  return loose;
}
