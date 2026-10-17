/**
 * The V1 in the oracle's shadow (`npm run shadow`, Sami, 03/10): the games
 * the oracle played, read again by another bot. Every move of the oracle
 * kept its best candidates and their visits in the replay (bot-games.js),
 * so the oracle's opinion costs nothing more: at each of its moves, where
 * does the V1's core rank the oracle's move, which move would the V1's
 * search play, and how much of the oracle's visits did that move get?
 *
 * Pure: the searches are scripts/lib/shadow-worker.js's.
 */
export const TURN_GROUPS = Object.freeze([
  [1, 4],
  [5, 8],
  [9, 12],
  [13, 16],
  [17, 20],
  [21, 24],
  [25, Infinity],
]);

const labelOf = (move) => `${move.card}→${move.border}`;

/** The oracle's moves in a game, from each seat it held: its choice and its candidates, when it had a real choice. */
export function oracleMoves(log, engine) {
  const seats = new Set(log.players.filter((player) => player.bot === engine || player.version === engine).map((player) => player.seat));
  return log.turns
    .filter((entry) => seats.has(entry.player) && entry.move && entry.candidates?.length > 1)
    .map((entry) => ({ turn: entry.turn, move: labelOf(entry.move), candidates: entry.candidates.map((candidate) => ({ move: labelOf(candidate), gain: candidate.gain })) }));
}

/** A candidate's share of the visits the oracle's kept candidates got (0 when it is not among them). */
export function shareOf(candidates, move) {
  const total = candidates.reduce((sum, candidate) => sum + candidate.gain, 0) || 1;
  return (candidates.find((candidate) => candidate.move === move)?.gain ?? 0) / total;
}

/** One move of the oracle against the V1's opinion there: `coreRank` (1 = its core's favourite), `searched` (the V1 search's move). */
export function shadowRow(oracle, { coreRank, searched }) {
  return {
    turn: oracle.turn,
    move: oracle.move,
    searched,
    coreRank,
    agrees: searched === oracle.move,
    // What the V1's move is worth for the oracle: its share of the visits, against the oracle's own move's.
    lost: shareOf(oracle.candidates, oracle.move) - shareOf(oracle.candidates, searched),
  };
}

const groupOf = (turn) => TURN_GROUPS.findIndex(([from, to]) => turn >= from && turn <= to);
const rate = (rows, test) => rows.filter(test).length / Math.max(1, rows.length);
const nameOf = ([from, to]) => (to === Infinity ? `${from}+` : `${from}-${to}`);

/** Agreement by group of turns, and the clearest disagreements first. */
export function summarizeShadow(rows, { top = 20 } = {}) {
  const groups = TURN_GROUPS.map((range, i) => {
    const list = rows.filter((row) => groupOf(row.turn) === i);
    return {
      turns: nameOf(range),
      moves: list.length,
      agrees: rate(list, (row) => row.agrees),
      core1: rate(list, (row) => row.coreRank === 1),
      core3: rate(list, (row) => row.coreRank >= 1 && row.coreRank <= 3),
      core8: rate(list, (row) => row.coreRank >= 1 && row.coreRank <= 8),
      lost: list.reduce((sum, row) => sum + row.lost, 0) / Math.max(1, list.length),
    };
  }).filter((group) => group.moves > 0);
  const all = { moves: rows.length, agrees: rate(rows, (row) => row.agrees), core8: rate(rows, (row) => row.coreRank >= 1 && row.coreRank <= 8) };
  const clearest = rows.filter((row) => !row.agrees).sort((a, b) => b.lost - a.lost).slice(0, top);
  return { all, groups, clearest };
}
