import { wilson } from "../../../src/irl/analysis.js";

/**
 * How many games a duel plays, and when it may stop early. Pure, tested.
 *
 * A bot that looks ahead costs seconds a game where the core costs
 * milliseconds, so each profile has two scales. Games are played in rounds;
 * after each round the duel stops as soon as the result is clear — a
 * stricter 99 % interval while peeking, since looking several times would
 * otherwise flatter chance — at the latest after `max` games a seat, and in
 * any case once `seconds` have passed: the time budget holds whatever the
 * machine, and the interval printed says what that time bought.
 *
 * - `quick`: to sort ideas, 5 minutes at most;
 * - `screen`: to sort costlier ideas, 10 minutes at most;
 * - `long`: to decide a new version, 20 minutes at most.
 *
 * With `pairs`, the interval is the paired one (`pairedInterval`): each deck
 * is played from both seats, and a pair where each side wins once carries no
 * luck at all. Otherwise it is Wilson's, game by game.
 */
export const PROFILES = Object.freeze({
  quick: Object.freeze({ seconds: 300, fast: { min: 1000, max: 4000, chunk: 250 }, slow: { min: 30, max: 100, chunk: 1 } }),
  screen: Object.freeze({ seconds: 600, fast: { min: 1000, max: 8000, chunk: 250 }, slow: { min: 60, max: 400, chunk: 2 } }),
  long: Object.freeze({ seconds: 1200, fast: { min: 4000, max: 12000, chunk: 500 }, slow: { min: 150, max: 400, chunk: 2 } }),
});

/** Engines that search at every move: seconds a game instead of milliseconds. */
export const isSlowEngine = (engine) => /^(lookahead|experimental|ismcts|phase)/.test(engine);

const PEEK_Z = 2.576;
const FINAL_Z = 1.96;

/**
 * `{ stop, low, high }` after `games` games a seat, `wins` won out of
 * `2 × games`: stop once `min` is played and the interval misses 50 %, or at
 * `max`. The interval returned is the one to report (95 % once stopped).
 */
export function duelVerdict({ wins, games, min, max, outOfTime = false, pairs }) {
  const interval = intervalOf({ wins, games, pairs });
  const [low, high] = interval(PEEK_Z);
  const clear = games >= min && (low > 0.5 || high < 0.5);
  const stop = clear || games >= max || outOfTime;
  const [low95, high95] = interval(FINAL_Z);
  return { stop, clear, low: stop ? low95 : low, high: stop ? high95 : high, wilson: wilson(wins, 2 * games, FINAL_Z) };
}

/** The interval a duel is judged by, at `z`: paired when the pairs are known. */
const intervalOf = ({ wins, games, pairs }) => (z) => (pairs ? pairedInterval(pairs, z) : wilson(wins, 2 * games, z));

/**
 * A's mean score over the deck pairs (each 0, ½ or 1: its points from both
 * seats, halved), ± `z` standard errors. The luck of a deck is shared inside
 * its pair, so what varies from pair to pair is mostly the difference
 * between the players.
 */
export function pairedInterval(scores, z = FINAL_Z) {
  const n = scores.length;
  if (n < 2) return [0, 1];
  const mean = scores.reduce((sum, score) => sum + score, 0) / n;
  const variance = scores.reduce((sum, score) => sum + (score - mean) ** 2, 0) / (n - 1);
  const half = z * Math.sqrt(variance / n);
  return [Math.max(0, mean - half), Math.min(1, mean + half)];
}

/** A's points in one game: 1 for a win, ½ for a draw. `seat` is where A sat. */
export const pointsOf = (winner, seat) => {
  if (winner === null) return 0.5;
  return winner === seat ? 1 : 0;
};
