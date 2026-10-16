/**
 * The seat advantage read in the kept duels (`npm run seats`, docs/sieges.md), PURE.
 *
 * - `phaseSplit`: from the index rows alone, where the first player's points go: the games over before the pile
 *   is empty (30 moves), the position once it is (the solver's verdict, `advantage`), then the play from there.
 * - `tallyGame`: from a log, who opens each border and who wins it, who completes a side last, how borders are
 *   decided, on whose move a game ends, who passes; `clusteredInterval` counts the deals played twice once.
 */
const budgetOf = (engine) => Number(/@(\d+)$/.exec(engine)?.[1] ?? -1);
const tree = (engine) => engine.startsWith("ismcts") && budgetOf(engine) >= 2000;

/** The kept games looked at: trees at 2 000 iterations and more (no `@t` budget), at the page's rule. */
export const ENGINE_GROUPS = Object.freeze({
  trees: { label: "arbres @2000 et plus", test: tree },
  exact12: { label: "… avec exact=12 (la famille de la 1.2)", test: (engine) => tree(engine) && engine.includes("+exact=12") },
  older: { label: "… sans exact=12 (fin résolue à 8 cartes)", test: (engine) => tree(engine) && !engine.includes("+exact=12") },
});

export const rowsOf = (rows, group) => rows.filter((row) => row.endMode === "claim-end" && row.engines.every(ENGINE_GROUPS[group].test));

const firstShare = (rows) => rows.filter((row) => row.winner === 0).length / rows.length;
const solvedAt30 = (row) => !row.advantage?.ended && Number.isFinite(row.advantage?.value);

/** Games the solver gave to `seat` once the pile was empty, and that seat lost all the same. */
const thrownBy = (rows, seat) => rows.filter((row) => row.advantage.winner === seat && row.winner === 1 - seat).length;

/** Where the first player's points go: `points` is that phase's share of the gap to 50 %, over all the games. */
export function phaseSplit(rows) {
  const games = rows.length;
  const early = rows.filter((row) => row.advantage?.ended);
  const solved = rows.filter(solvedAt30);
  const perfect = solved.filter((row) => row.advantage.winner === 0).length / solved.length;
  const played = firstShare(solved);
  return {
    games,
    first: firstShare(rows),
    early: { games: early.length, first: firstShare(early), points: (early.length * (0.5 - firstShare(early))) / games },
    position: { games: solved.length, first: perfect, points: (solved.length * (0.5 - perfect)) / games },
    play: { first: played, points: (solved.length * (perfect - played)) / games, thrown: [thrownBy(solved, 0), thrownBy(solved, 1)] },
  };
}

export function emptyTally() {
  return {
    games: 0,
    opened: [0, 0],
    openerWon: [0, 0],
    lastCompleter: [0, 0],
    lastCompleterWon: [0, 0],
    decidedBy: { claim: [0, 0], formation: [0, 0], sum: [0, 0], first: [0, 0] },
    winsOn: { own: [0, 0], theirs: [0, 0] },
    passes: [0, 0],
    ends: new Map(),
    deals: new Map(),
  };
}

/** Per border (0-based): the seat that laid its first card, and the turn each seat laid its third. */
function bordersOf(log) {
  const opener = new Array(7).fill(null);
  const counts = [new Array(7).fill(0), new Array(7).fill(0)];
  const completed = [new Array(7).fill(null), new Array(7).fill(null)];
  for (const entry of log.turns) {
    if (!entry.move) continue;
    const border = entry.move.border - 1;
    opener[border] ??= entry.player;
    counts[entry.player][border] += 1;
    if (counts[entry.player][border] === 3) completed[entry.player][border] = entry.turn;
  }
  return { opener, completed };
}

function tallyBorders(tally, log) {
  const { opener, completed } = bordersOf(log);
  for (const { border: number, winner, decidedBy } of log.result.borders) {
    const border = number - 1;
    const first = opener[border];
    tally.opened[first] += 1;
    if (winner === first) tally.openerWon[first] += 1;
    tally.decidedBy[decidedBy][winner] += 1;
    const [zero, one] = [completed[0][border], completed[1][border]];
    if (zero === null || one === null) continue;
    const last = zero > one ? 0 : 1;
    tally.lastCompleter[last] += 1;
    if (winner === last) tally.lastCompleterWon[last] += 1;
  }
}

function tallyEnd(tally, log) {
  const { winner } = log.result;
  const last = log.turns.at(-1);
  const end = tally.ends.get(log.turns.length) ?? { games: 0, firstWins: 0 };
  end.games += 1;
  if (winner === 0) end.firstWins += 1;
  tally.ends.set(log.turns.length, end);
  if (winner !== null) tally.winsOn[last.player === winner ? "own" : "theirs"][winner] += 1;
  for (const entry of log.turns) if (!entry.move) tally.passes[entry.player] += 1;
}

/** One kept game into `tally`; games dealt the same deck (a duel's mirror) share a cluster. */
export function tallyGame(tally, log) {
  tally.games += 1;
  tallyBorders(tally, log);
  tallyEnd(tally, log);
  const key = log.deck.join(" ");
  const deal = tally.deals.get(key) ?? { games: 0, firstWins: 0 };
  deal.games += 1;
  if (log.result.winner === 0) deal.firstWins += 1;
  tally.deals.set(key, deal);
  return tally;
}

/**
 * The first player's share and its 95 % interval with games of the same deal counted together (cluster-robust):
 * a duel plays each deck twice, and a deck that favours its first player does it both times.
 */
export function clusteredInterval(clusters, z = 1.96) {
  const list = [...clusters];
  const games = list.reduce((sum, { games: n }) => sum + n, 0);
  const share = list.reduce((sum, { firstWins }) => sum + firstWins, 0) / games;
  const spread = list.reduce((sum, { games: n, firstWins }) => sum + (firstWins - share * n) ** 2, 0);
  const half = z * Math.sqrt((spread * list.length) / Math.max(1, list.length - 1)) / games;
  return { share, low: share - half, high: share + half, deals: list.length };
}

/** Games ending after each number of moves, with the first player's share and the hazard (ends / games still on). */
export function endTable(ends) {
  let running = [...ends.values()].reduce((sum, { games }) => sum + games, 0);
  return [...ends.keys()].sort((a, b) => a - b).map((turns) => {
    const { games, firstWins } = ends.get(turns);
    const row = { turns, mover: (turns - 1) % 2, games, first: firstWins / games, hazard: games / running };
    running -= games;
    return row;
  });
}
