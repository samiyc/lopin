import { readFileSync } from "node:fs";
import { parentPort } from "node:worker_threads";
import { formatCard } from "../../../src/core/notation.js";
import { createRng } from "../../../src/core/random.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { coreRanking } from "../../../src/replay/oracle/oracle.js";
import { strategistBot } from "../../../src/sim/bots.js";
import { coreWith, scoreOfRank } from "../../../src/sim/heuristics/distill.js";
import { legalMoves } from "../../../src/sim/engine/game.js";

/**
 * One worker of `npm run distill`: the positions of the cache
 * (oracle/distill-cache.json, written by the script), rebuilt once per worker
 * as they are asked for; a task scores one or two cores on a sample of them.
 *
 * Task: `{ cores: [values, …], indices }` → `[{ score, ranks }, …]`, one per
 * core: the summed `scoreOfRank`, and the rank of the oracle's move at each
 * position (0 when the core does not rank it at all).
 */
const cache = JSON.parse(readFileSync(new URL("../../../oracle/distill-cache.json", import.meta.url), "utf8"));
const states = new Map();
const stateOf = (index) => {
  if (!states.has(index)) {
    const position = cache.positions[index];
    states.set(index, stateAt(cache.games[position.game], position.turn));
  }
  return states.get(index);
};

function rankOfOracle(core, index) {
  const state = stateOf(index);
  const scored = strategistBot(createRng(1), core).scoreMoves(state, legalMoves(state), { keepAll: true });
  return coreRanking(scored).findIndex((move) => `${formatCard(state.spec, move.card)}→${move.border + 1}` === cache.positions[index].move) + 1;
}

function judge(values, indices) {
  const core = coreWith(values);
  const ranks = indices.map((index) => rankOfOracle(core, index));
  return { score: ranks.reduce((sum, rank) => sum + scoreOfRank(rank), 0), ranks };
}

parentPort.on("message", ({ cores, indices }) => parentPort.postMessage(cores.map((values) => judge(values, indices))));
