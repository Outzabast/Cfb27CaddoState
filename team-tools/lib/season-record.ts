// Season win-loss record, overall and conference. A game counts once played
// (either score non-zero). Conference games (isConference) also roll into the
// conference sub-record shown in parentheses.

export type GameResult = {
  teamPoints: number;
  oppPoints: number;
  isConference: boolean;
};

export type SeasonRecord = {
  wins: number;
  losses: number;
  ties: number;
  confWins: number;
  confLosses: number;
  confTies: number;
  pointsFor: number;
  pointsAgainst: number;
  gamesPlayed: number;
};

export function computeRecord(games: GameResult[]): SeasonRecord {
  const r: SeasonRecord = {
    wins: 0, losses: 0, ties: 0,
    confWins: 0, confLosses: 0, confTies: 0,
    pointsFor: 0, pointsAgainst: 0, gamesPlayed: 0,
  };
  for (const g of games) {
    r.pointsFor += g.teamPoints;
    r.pointsAgainst += g.oppPoints;
    if (g.teamPoints === 0 && g.oppPoints === 0) continue; // unplayed
    r.gamesPlayed++;
    const win = g.teamPoints > g.oppPoints;
    const loss = g.teamPoints < g.oppPoints;
    if (win) r.wins++;
    else if (loss) r.losses++;
    else r.ties++;
    if (g.isConference) {
      if (win) r.confWins++;
      else if (loss) r.confLosses++;
      else r.confTies++;
    }
  }
  return r;
}

const wl = (w: number, l: number, t: number) => (t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`);

/** "3-4 (2-2)" — overall record with the conference record in parentheses. */
export function formatRecord(r: SeasonRecord): string {
  return `${wl(r.wins, r.losses, r.ties)} (${wl(r.confWins, r.confLosses, r.confTies)})`;
}
