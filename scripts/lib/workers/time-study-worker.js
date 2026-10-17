import { parentPort } from "node:worker_threads";
import { createRng } from "../../../src/core/random.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { engineFor } from "../../../src/sim/bots.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { moveKey } from "../../../src/sim/search/search.js";

/**
 * One position of the time study: a single search run to `reference`
 * rollouts, noting the move it would play at each checkpoint of
 * `checkpoints`, then the reference's rating of every move it considered.
 */
function studyPosition(log, turn, checkpoints, reference) {
  const state = stateAt(log, turn);
  const moves = legalMoves(state);
  if (moves.length <= 1) return null;
  const bot = engineFor("experimental")(createRng(turn));
  const search = bot.searchFor(state, moves, {});
  const picks = [];
  for (const checkpoint of [...checkpoints, reference]) {
    while (!search.done() && search.rollouts() < checkpoint) search.step();
    picks.push({ checkpoint, move: moveKey(search.best()), stoppedEarly: search.done() });
  }
  const ratings = Object.fromEntries(search.scored().filter((entry) => entry.rollouts > 0).map((entry) => [moveKey(entry.move), entry.rating]));
  return { turn, picks, ratings };
}

parentPort.on("message", ({ items, checkpoints, reference, seconds }) => {
  const until = Date.now() + seconds * 1000;
  const results = [];
  for (const { log, turn } of items) {
    if (Date.now() > until) break;
    const result = studyPosition(log, turn, checkpoints, reference);
    if (result) results.push(result);
  }
  parentPort.postMessage(results);
});
