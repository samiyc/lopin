/**
 * Puzzle attempts (Sami, 07/10: he solves puzzles as a volunteer, and wants
 * them tracked). An attempt runs from a puzzle shown to its end or its
 * abandon: the active time (a clock that stops while the page is out of
 * focus), each move with its thinking time and whether it still won, the
 * « Révéler » used, and the result. Pure: the page records, the play server
 * stores one JSON line per attempt in data/puzzle-attempts.jsonl, and
 * `npm run puzzle-stats` reads them back.
 */
export const ATTEMPT_FORMAT = "lopin-puzzle-attempt/1";

/** How an attempt ended: solved alone, solved with help (a slip or a reveal), lost, or left (abandoned after a move, skipped before any). */
export const RESULTS = Object.freeze(["solved", "helped", "lost", "abandoned", "skipped"]);

/** A new attempt at `puzzle`, started at `startedAt` (an ISO date); `retry` when the same puzzle is played again at once. */
export const createAttempt = (puzzle, startedAt, retry = false) => ({
  format: ATTEMPT_FORMAT,
  id: puzzle.id,
  kind: puzzle.kind ?? "endgame",
  startedAt,
  retry,
  moves: [],
  slips: 0,
  revealedAtMs: null,
  activeMs: 0,
  result: null,
});

/** A move of the human: `move` ("7♥→3"), its thinking time, and whether it kept the win (`winners` otherwise). */
export function noteMove(attempt, { move, thinkMs, winning, winners = [] }) {
  attempt.moves.push(winning ? { move, thinkMs } : { move, thinkMs, winning: false, winners });
  if (!winning) attempt.slips += 1;
}

/** « Révéler », the first time, at `activeMs` into the attempt. */
export function noteReveal(attempt, activeMs) {
  if (attempt.revealedAtMs === null) attempt.revealedAtMs = activeMs;
}

/** The attempt's result, from how the puzzle ended (`won`) or was left (`won` undefined). */
export function resultOf(attempt, won) {
  if (won === undefined) return attempt.moves.length === 0 ? "skipped" : "abandoned";
  if (!won) return "lost";
  return attempt.slips > 0 || attempt.revealedAtMs !== null ? "helped" : "solved";
}

/** The attempt closed: its result and its active time. */
export const closeAttempt = (attempt, won, activeMs) => ({ ...attempt, result: resultOf(attempt, won), activeMs: Math.round(activeMs) });

/** Is `value` a closed attempt the server may store? */
export function isAttempt(value) {
  if (value?.format !== ATTEMPT_FORMAT || !Number.isInteger(value.id) || !RESULTS.includes(value.result)) return false;
  return Array.isArray(value.moves) && Number.isFinite(value.activeMs) && value.activeMs >= 0;
}

/** Per puzzle: attempts, solved alone, the best active time when solved alone, and the last attempt's slips. */
export function summarize(attempts) {
  const byId = {};
  for (const attempt of attempts) {
    const entry = byId[attempt.id] ?? { attempts: 0, solved: 0, bestMs: null, lastSlips: 0 };
    entry.attempts += 1;
    entry.lastSlips = attempt.slips;
    if (attempt.result === "solved") {
      entry.solved += 1;
      entry.bestMs = entry.bestMs === null ? attempt.activeMs : Math.min(entry.bestMs, attempt.activeMs);
    }
    byId[attempt.id] = entry;
  }
  return byId;
}
