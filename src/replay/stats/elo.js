import { playerTag } from "../../config/bots.js";

/**
 * Elo ratings from game results, by the Bradley-Terry model: the chance that
 * A beats B is 1 / (1 + 10^((Rb − Ra) / 400)). Ratings are fitted to every
 * result at once — human games and bot duels together — so a player who only
 * met one bot is still placed against all of them. Pure; `npm run elo` and
 * the replay tab feed it.
 *
 * Every player also gets one virtual drawn game against the anchor, a light
 * pull towards it: without it a single won game would rate a player
 * infinitely high. Margins are 95 % intervals from the fit's curvature.
 */
const SCALE = 400 / Math.LN10;

/** The log-likelihood's slope and curvature in `player`'s strength. */
function newtonStep(player, pairs, strength) {
  let gradient = 0;
  let hessian = 0;
  for (const { a, b, score, games } of pairs) {
    if (a !== player && b !== player) continue;
    const [mine, theirs, points] = a === player ? [a, b, score] : [b, a, games - score];
    const expected = 1 / (1 + Math.exp(strength[theirs] - strength[mine]));
    gradient += points - games * expected;
    hessian += games * expected * (1 - expected);
  }
  return { gradient, hessian };
}

/** `results`: `[{ a, b, score, games }]`, `score` being A's points (a win 1, a draw ½). */
export function fitElo(results, { anchor, anchorRating = 500, iterations = 300 } = {}) {
  const players = [...new Set(results.flatMap(({ a, b }) => [a, b]))];
  const pairs = [...results, ...players.filter((p) => p !== anchor).map((p) => ({ a: p, b: anchor, score: 0.5, games: 1 }))];
  const strength = Object.fromEntries(players.map((p) => [p, 0]));
  const curvature = Object.fromEntries(players.map((p) => [p, 0]));
  for (let i = 0; i < iterations; i += 1) {
    for (const player of players.filter((p) => p !== anchor)) {
      const { gradient, hessian } = newtonStep(player, pairs, strength);
      strength[player] += gradient / hessian;
      curvature[player] = hessian;
    }
  }
  const played = (p) => results.reduce((sum, r) => sum + (r.a === p || r.b === p ? r.games : 0), 0);
  return Object.fromEntries(
    players.map((p) => [p, { elo: Math.round(anchorRating + SCALE * strength[p]), margin: p === anchor ? 0 : Math.round(1.96 * SCALE * Math.sqrt(1 / curvature[p])), games: played(p) }]),
  );
}

/** Human results from replay logs: each human (by name) against each bot version. */
export function resultsFromLogs(logs) {
  const tally = new Map();
  for (const log of logs) {
    const human = log.players.find((player) => player.kind === "human");
    const bot = log.players.find((player) => player.kind === "bot");
    if (!human || !bot || !log.result) continue;
    const key = `${human.name}|${playerTag(bot)}`;
    const entry = tally.get(key) ?? { a: human.name, b: playerTag(bot), score: 0, games: 0 };
    entry.games += 1;
    if (log.result.winner === null) entry.score += 0.5;
    else if (log.result.winner === human.seat) entry.score += 1;
    tally.set(key, entry);
  }
  return [...tally.values()];
}
