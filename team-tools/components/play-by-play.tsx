import { groupDrives, type PlayLite } from "@/lib/play-by-play";

/** A short scoreboard code from a team name ("Northern Illinois" → "NI"). */
function abbr(name: string): string {
  const clean = name.replace(/[^A-Za-z ]/g, "").trim();
  if (clean.length <= 4) return clean.toUpperCase();
  const initials = clean.split(/\s+/).map((w) => w[0]).join("");
  return (initials.length >= 2 ? initials : clean.slice(0, 4)).toUpperCase();
}

/** ESPN-style play-by-play: collapsible drives (possession changes), each showing
 *  its plays. Native <details>, so no client JS. */
export function PlayByPlay({
  plays,
  teamName,
  oppName,
}: {
  plays: PlayLite[];
  teamName: string;
  oppName: string;
}) {
  if (plays.length === 0) return null;
  const drives = groupDrives(plays);
  const name = (t: "TEAM" | "OPP") => (t === "TEAM" ? teamName : oppName);
  const tAbbr = abbr(teamName);
  const oAbbr = abbr(oppName);

  return (
    <section className="space-y-2">
      <h2 className="eyebrow !text-foreground">Play-by-Play</h2>
      <div className="space-y-2">
        {drives.map((d, i) => {
          const first = d.plays[0];
          return (
            <details key={i} className="overflow-hidden rounded-md border bg-card" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span>
                  <span className={"font-semibold " + (d.team === "TEAM" ? "text-primary" : "")}>
                    {name(d.team)}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {d.plays.length} play{d.plays.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="tabular-nums text-muted-foreground">
                    Q{first.quarter}
                    {first.clock ? ` ${first.clock}` : ""}
                  </span>
                  <span className="rounded bg-secondary px-2 py-0.5 font-bold uppercase tracking-wide text-primary">
                    {d.result}
                  </span>
                  <span className="tabular-nums font-semibold whitespace-nowrap" title={`${teamName}–${oppName}`}>
                    {tAbbr} {d.teamScore}, {oAbbr} {d.oppScore}
                  </span>
                </span>
              </summary>
              <div className="border-t">
                {d.plays.map((p, j) => (
                  <div key={j} className="border-b px-4 py-2 text-sm last:border-0">
                    {p.situation && (
                      <div className="text-xs font-medium text-muted-foreground">{p.situation}</div>
                    )}
                    <div>
                      {p.clock && <span className="tabular-nums text-xs text-muted-foreground">{p.clock} </span>}
                      {p.description}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
