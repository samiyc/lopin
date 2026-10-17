import { parentPort } from "node:worker_threads";
import { OFFICIAL_RULES } from "../../../src/config/rules.js";
import { createRng } from "../../../src/core/random.js";
import { finishLog, playLogged, rulesOf, startLog } from "../../../src/replay/core/log.js";
import { engineFor } from "../../../src/sim/bots.js";
import { createGame, legalMoves } from "../../../src/sim/engine/game.js";

/**
 * One self-play worker: plays `engine` against itself until `seconds` have
 * passed, and returns the games as replay logs (with each move's scored
 * candidates), for `scripts/selfplay.js`.
 */
function selfPlayGame(engine, seed) {
  const { spec, order, jokerRule, endMode } = rulesOf(OFFICIAL_RULES);
  const rng = createRng(seed);
  const state = createGame(spec, { order, jokerRule, endMode, rng });
  const bots = [engineFor(engine)(rng), engineFor(engine)(rng)];
  const players = [0, 1].map((seat) => ({ seat, kind: "bot", bot: engine, version: "selfplay" }));
  const log = startLog(state, { rules: OFFICIAL_RULES, players, seed, startedAt: new Date().toISOString() });
  while (!state.over) {
    const moves = legalMoves(state);
    const scored = moves.length > 0 ? bots[state.current].scoreMoves(state, moves) : null;
    const best = scored?.reduce((a, b) => (b.gain > a.gain ? b : a));
    playLogged(log, state, best?.move ?? null, scored);
  }
  return finishLog(log, state);
}

parentPort.on("message", ({ engine, seconds, seed }) => {
  const until = Date.now() + seconds * 1000;
  const logs = [];
  while (Date.now() < until) logs.push(selfPlayGame(engine, seed + 7919 * logs.length));
  parentPort.postMessage(logs);
});
