"""Roster table component for the Caddo State media site.

Reads a roster file and renders an interactive, filterable HTML table that can
be embedded on a Quarto page. Quarto builds static HTML, so the *parsing*,
*validation* and *rendering* happen in Python at build time, while the live
filtering (by position, name, and class) runs client-side with a small
self-contained block of JavaScript.

The roster file is, effectively, a SQL table
--------------------------------------------
It is a CSV whose header row defines the columns (the schema) and whose rows are
the players. The schema is::

    Position   varchar(8)   -- any string up to 8 characters (QB, LF, LEDGE, ...)
    Name       string       -- required
    Class      enum         -- one of the CLASSES below (see aliases)
    Number     int          -- OPTIONAL jersey number (0-99), may be blank

Nothing about positions is hardcoded here: whatever positions appear in the
file are the positions the table knows about. `Class` *is* a fixed enum, so it
is validated and displayed in a consistent academic-year order.

Example (`roster-26.csv`)::

    Position,Name,Class,Number
    QB,Bryce Joiner,Redshirt Freshman,7
    RB,AJ Trimble,Redshirt Sophomore,22
    WR,Kareem Eber,Junior,
    LF,Some Player,Freshman,44

Usage from a Quarto (.qmd) page
-------------------------------
    ```{python}
    #| echo: false
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "roster_table", Path("../../components/roster-table.py").resolve()
    )
    roster_table = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(roster_table)

    roster_table.render("roster-26.csv")
    ```

The trailing `render(...)` call returns an ``IPython.display.HTML`` object, so
Quarto embeds the interactive table directly into the rendered page.
"""

from __future__ import annotations

import csv
import html
import json
from pathlib import Path

# --- Schema constants --------------------------------------------------------

POSITION_MAX_LEN = 8

# The Class column is an enum. This list is BOTH the set of valid values and
# the display order (freshman -> graduate). Redshirt variants sit next to their
# base year so a sorted roster reads naturally.
CLASSES = [
    "Freshman",
    "Redshirt Freshman",
    "Sophomore",
    "Redshirt Sophomore",
    "Junior",
    "Redshirt Junior",
    "Senior",
    "Redshirt Senior",
    "Graduate",
    "Redshirt Graduate",
]

# Accept common abbreviations and OCR-friendly spellings, all normalized to the
# canonical value above. Keys are compared case-insensitively with surrounding
# whitespace and internal spacing collapsed.
_CLASS_ALIASES = {
    "fr": "Freshman", "fresh": "Freshman", "freshman": "Freshman",
    "rfr": "Redshirt Freshman", "rs fr": "Redshirt Freshman",
    "rs-fr": "Redshirt Freshman", "redshirt freshman": "Redshirt Freshman",
    "so": "Sophomore", "soph": "Sophomore",
    "sophomore": "Sophomore", "sophmore": "Sophomore",
    "rso": "Redshirt Sophomore", "rs so": "Redshirt Sophomore",
    "rs-so": "Redshirt Sophomore",
    "redshirt sophomore": "Redshirt Sophomore",
    "redshirt sophmore": "Redshirt Sophomore",
    "jr": "Junior", "junior": "Junior",
    "rjr": "Redshirt Junior", "rs jr": "Redshirt Junior",
    "rs-jr": "Redshirt Junior", "redshirt junior": "Redshirt Junior",
    "sr": "Senior", "senior": "Senior",
    "rsr": "Redshirt Senior", "rs sr": "Redshirt Senior",
    "rs-sr": "Redshirt Senior", "redshirt senior": "Redshirt Senior",
    "gr": "Graduate", "grad": "Graduate", "graduate": "Graduate",
    "rgr": "Redshirt Graduate", "rs gr": "Redshirt Graduate",
    "rs-gr": "Redshirt Graduate", "redshirt graduate": "Redshirt Graduate",
}
# Canonical values are, of course, also valid keys.
_CLASS_ALIASES.update({c.lower(): c for c in CLASSES})

_REQUIRED = {"position", "name", "class"}
_FIELDS = _REQUIRED | {"number"}


def _normalize_class(value: str) -> str | None:
    """Return the canonical class name for a raw value, or None if unknown."""
    key = " ".join(value.strip().lower().replace("-", " ").split())
    # Try the collapsed-space form and the original hyphenated form.
    return _CLASS_ALIASES.get(key) or _CLASS_ALIASES.get(value.strip().lower())


def parse_roster(path: str | Path) -> list[dict]:
    """Parse and validate a roster CSV into a list of player dicts.

    Each dict has keys ``position``, ``name``, ``class`` and ``number``
    (``number`` may be an empty string). Row order from the file is preserved,
    just like ``SELECT *`` from a table.

    Raises ``ValueError`` with a line-numbered report if any row violates the
    schema (bad class, over-long position, non-numeric number, missing
    required field), so mistakes from the OCR pipeline surface at build time.
    """
    path = Path(path)
    players: list[dict] = []
    errors: list[str] = []

    with path.open(newline="", encoding="utf-8-sig") as fh:
        raw_lines = list(fh)

    # Drop blank and comment (#) lines, but remember the original 1-based line
    # number of each kept line so error messages point at the real file line.
    kept: list[str] = []
    line_numbers: list[int] = []
    for i, line in enumerate(raw_lines, start=1):
        if line.strip() and not line.lstrip().startswith("#"):
            kept.append(line)
            line_numbers.append(i)

    if not kept:
        return players

    reader = csv.reader(kept)
    header = next(reader)
    header_keys = [(h or "").strip().lower() for h in header]

    missing_cols = _REQUIRED - set(header_keys)
    if missing_cols:
        raise ValueError(
            f"{path.name}: header is missing required column(s): "
            f"{', '.join(sorted(c.title() for c in missing_cols))}. "
            f"Expected columns: Position, Name, Class, Number (Number optional)."
        )

    index = {key: header_keys.index(key) for key in _FIELDS if key in header_keys}

    def cell(row: list[str], key: str) -> str:
        i = index.get(key)
        return row[i].strip() if i is not None and i < len(row) else ""

    for row, lineno in zip(reader, line_numbers[1:]):
        if not any(c.strip() for c in row):
            continue  # fully blank data row

        position = cell(row, "position")
        name = cell(row, "name")
        raw_class = cell(row, "class")
        number = cell(row, "number")

        if not name:
            errors.append(f"  line {lineno}: Name is required")
        if not position:
            errors.append(f"  line {lineno}: Position is required")
        elif len(position) > POSITION_MAX_LEN:
            errors.append(
                f"  line {lineno}: Position '{position}' exceeds "
                f"{POSITION_MAX_LEN} characters"
            )

        norm_class = _normalize_class(raw_class) if raw_class else None
        if not raw_class:
            errors.append(f"  line {lineno}: Class is required")
        elif norm_class is None:
            errors.append(
                f"  line {lineno}: Class '{raw_class}' is not a valid class. "
                f"Valid values: {', '.join(CLASSES)}."
            )

        if number and not number.isdigit():
            errors.append(
                f"  line {lineno}: Number '{number}' must be a whole number"
            )

        players.append({
            "position": position,
            "name": name,
            "class": norm_class or raw_class,
            "number": number,
        })

    if errors:
        raise ValueError(
            f"{path.name}: {len(errors)} problem(s) found:\n" + "\n".join(errors)
        )

    return players


def _positions_in_file_order(players: list[dict]) -> list[str]:
    """Distinct positions, in the order they first appear in the roster."""
    seen: list[str] = []
    for p in players:
        if p["position"] and p["position"] not in seen:
            seen.append(p["position"])
    return seen


def _classes_present(players: list[dict]) -> list[str]:
    """Distinct classes present, in canonical academic-year order."""
    present = {p["class"] for p in players if p["class"]}
    known = [c for c in CLASSES if c in present]
    unknown = sorted(present - set(CLASSES))  # shouldn't happen post-validation
    return known + unknown


def render_html(path: str | Path, table_id: str = "roster") -> str:
    """Build the full self-contained HTML string for the roster component."""
    players = parse_roster(path)

    # Only show the Number column if at least one player actually has a number.
    show_number = any(p["number"] for p in players)
    col_count = 4 if show_number else 3

    positions = _positions_in_file_order(players)
    classes = _classes_present(players)

    def options(values: list[str]) -> str:
        return "".join(
            f'<option value="{html.escape(v)}">{html.escape(v)}</option>'
            for v in values
        )

    # Build the table body. Data attributes drive the client-side filter.
    rows_html = []
    for p in players:
        cells = [
            f'<td class="rt-pos">{html.escape(p["position"])}</td>',
            f'<td class="rt-name">{html.escape(p["name"])}</td>',
            f'<td class="rt-class">{html.escape(p["class"])}</td>',
        ]
        if show_number:
            num = p["number"]
            cells.append(
                f'<td class="rt-num">{html.escape(num) if num else "&mdash;"}</td>'
            )
        rows_html.append(
            f'    <tr data-pos="{html.escape(p["position"].lower())}" '
            f'data-class="{html.escape(p["class"].lower())}" '
            f'data-name="{html.escape(p["name"].lower())}">\n'
            f'      {"".join(cells)}\n    </tr>'
        )

    number_header = '<th scope="col">Number</th>' if show_number else ""
    total = len(players)
    tid = html.escape(table_id)

    # Everything below is scoped by the unique table id so multiple roster
    # tables can live on the same page without clashing.
    return f"""
<div class="roster-table" id="{tid}">
  <style>
    #{tid} .rt-controls {{
      display: flex; flex-wrap: wrap; gap: .75rem;
      align-items: flex-end; margin-bottom: .75rem;
    }}
    #{tid} .rt-field {{ display: flex; flex-direction: column; gap: .25rem; }}
    #{tid} .rt-field label {{
      font-size: .75rem; text-transform: uppercase; letter-spacing: .04em;
      font-weight: 600; opacity: .7;
    }}
    #{tid} .rt-field input, #{tid} .rt-field select {{
      padding: .4rem .6rem; border: 1px solid var(--bs-border-color, #ccc);
      border-radius: .375rem; font-size: .95rem;
      background: var(--bs-body-bg, #fff); color: var(--bs-body-color, #212529);
    }}
    #{tid} .rt-search {{ min-width: 14rem; }}
    #{tid} .rt-reset {{
      padding: .45rem .8rem; border: 1px solid var(--bs-border-color, #ccc);
      border-radius: .375rem; background: transparent; cursor: pointer;
      font-size: .9rem; color: inherit;
    }}
    #{tid} .rt-reset:hover {{ background: var(--bs-secondary-bg, #f0f0f0); }}
    #{tid} .rt-count {{ font-size: .85rem; opacity: .7; margin-left: auto; }}
    #{tid} table {{ width: 100%; border-collapse: collapse; }}
    #{tid} th, #{tid} td {{
      padding: .5rem .65rem; text-align: left;
      border-bottom: 1px solid var(--bs-border-color, #e5e5e5);
    }}
    #{tid} thead th {{
      border-bottom: 2px solid var(--bs-border-color, #ccc);
      font-size: .8rem; text-transform: uppercase; letter-spacing: .03em;
    }}
    #{tid} tbody tr:hover {{ background: var(--bs-secondary-bg, #f6f6f6); }}
    #{tid} .rt-num {{ font-variant-numeric: tabular-nums; }}
    #{tid} .rt-empty td {{ text-align: center; padding: 1.5rem; opacity: .6; }}
  </style>

  <div class="rt-controls">
    <div class="rt-field">
      <label for="{tid}-search">Search name</label>
      <input class="rt-search" id="{tid}-search" type="search"
             placeholder="Type a name&hellip;" autocomplete="off">
    </div>
    <div class="rt-field">
      <label for="{tid}-pos">Position</label>
      <select id="{tid}-pos"><option value="">All</option>{options(positions)}</select>
    </div>
    <div class="rt-field">
      <label for="{tid}-class">Class</label>
      <select id="{tid}-class"><option value="">All</option>{options(classes)}</select>
    </div>
    <button class="rt-reset" id="{tid}-reset" type="button">Reset</button>
    <span class="rt-count" id="{tid}-count"></span>
  </div>

  <table>
    <thead>
      <tr>
        <th scope="col">Position</th>
        <th scope="col">Name</th>
        <th scope="col">Class</th>
        {number_header}
      </tr>
    </thead>
    <tbody id="{tid}-body">
{chr(10).join(rows_html)}
      <tr class="rt-empty" hidden><td colspan="{col_count}">No players match your filters.</td></tr>
    </tbody>
  </table>

  <script>
  (function () {{
    var root   = document.getElementById({json.dumps(table_id)});
    if (!root) return;
    var search = root.querySelector('#{tid}-search');
    var posSel = root.querySelector('#{tid}-pos');
    var clsSel = root.querySelector('#{tid}-class');
    var reset  = root.querySelector('#{tid}-reset');
    var count  = root.querySelector('#{tid}-count');
    var rows   = Array.prototype.slice.call(
      root.querySelectorAll('#{tid}-body tr[data-name]')
    );
    var empty  = root.querySelector('.rt-empty');
    var total  = {total};

    function apply() {{
      var q   = search.value.trim().toLowerCase();
      var pos = posSel.value.toLowerCase();
      var cls = clsSel.value.toLowerCase();
      var shown = 0;
      rows.forEach(function (row) {{
        var ok = (!q   || row.getAttribute('data-name').indexOf(q) !== -1) &&
                 (!pos || row.getAttribute('data-pos') === pos) &&
                 (!cls || row.getAttribute('data-class') === cls);
        row.hidden = !ok;
        if (ok) shown++;
      }});
      if (empty) empty.hidden = shown !== 0;
      count.textContent = 'Showing ' + shown + ' of ' + total;
    }}

    search.addEventListener('input', apply);
    posSel.addEventListener('change', apply);
    clsSel.addEventListener('change', apply);
    reset.addEventListener('click', function () {{
      search.value = ''; posSel.value = ''; clsSel.value = '';
      apply();
    }});
    apply();
  }})();
  </script>
</div>
"""


def render(path: str | Path, table_id: str = "roster"):
    """Return an ``IPython.display.HTML`` object for embedding in Quarto.

    A bare ``render("roster-26.csv")`` as the last line of a code cell will
    display the interactive table on the page.
    """
    from IPython.display import HTML  # imported lazily so the parser is usable
    return HTML(render_html(path, table_id=table_id))


if __name__ == "__main__":
    # Quick command-line smoke test: `python roster-table.py roster-26.csv`
    import sys

    target = sys.argv[1] if len(sys.argv) > 1 else "roster-26.csv"
    parsed = parse_roster(target)
    print(f"Parsed {len(parsed)} players from {target}")
    for player in parsed:
        print(f"  {player['position']:<8} {player['name']:<24} "
              f"{player['class']:<20} {player['number']}")
