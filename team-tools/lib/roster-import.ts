import { normalizeClass } from "./classes";
import type { PlayerClass } from "@/generated/prisma/enums";

export type ParsedRosterRow = {
  position: string;
  name: string;
  class: PlayerClass;
  number: number | null;
};

const MAX_POSITION_LEN = 8;

function looksLikeHeader(line: string): boolean {
  return /position/i.test(line) && /name/i.test(line);
}

/**
 * Parse pasted text or a CSV file's contents into roster rows. Format per line:
 *   Position, Name, Class, Number   (Number optional)
 * Blank lines and `#` comments are skipped; a leading header row is ignored.
 * Class accepts full names or abbreviations (see normalizeClass). Throws a
 * line-numbered error listing every problem, so a bad paste fails loudly.
 */
export function parseRosterRows(text: string): ParsedRosterRow[] {
  const rows: ParsedRosterRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  let first = true;

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;

    if (first) {
      first = false;
      if (looksLikeHeader(line)) return; // skip header row
    }

    const cells = line.split(",").map((c) => c.trim());
    const [position = "", name = "", cls = "", number = ""] = cells;
    if (!position && !name && !cls) return;

    if (!name) errors.push(`Line ${lineNo}: name is required`);
    if (!position) errors.push(`Line ${lineNo}: position is required`);
    else if (position.length > MAX_POSITION_LEN) {
      errors.push(
        `Line ${lineNo}: position "${position}" exceeds ${MAX_POSITION_LEN} characters`,
      );
    }

    const normClass = cls ? normalizeClass(cls) : null;
    if (!cls) errors.push(`Line ${lineNo}: class is required`);
    else if (!normClass) errors.push(`Line ${lineNo}: invalid class "${cls}"`);

    let num: number | null = null;
    if (number) {
      const n = Number(number);
      if (!Number.isInteger(n)) {
        errors.push(`Line ${lineNo}: number "${number}" must be a whole number`);
      } else num = n;
    }

    if (name && position && position.length <= MAX_POSITION_LEN && normClass) {
      rows.push({ position, name, class: normClass, number: num });
    }
  });

  if (errors.length) throw new Error(errors.join("\n"));
  if (rows.length === 0) throw new Error("No player rows found.");
  return rows;
}
