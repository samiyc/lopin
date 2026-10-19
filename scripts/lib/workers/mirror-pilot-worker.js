import { parentPort } from "node:worker_threads";
import { DECKS, JOKER_RULES } from "../../../src/config/decks.js";
import { ORDERS } from "../../../src/config/formations.js";
import { createRng } from "../../../src/core/random.js";
import { engineFor } from "../../../src/sim/bots.js";
import { createGame, legalMoves } from "../../../src/sim/engine/game.js";
import { interval } from "../../../src/sim/mcts/tree-snapshot.js";
import { moveKey } from "../../../src/sim/search/search.js";

/**
 * One deal of the MirrorPrune pilot (scripts/archive/mirror-prune-pilot.js): its first move searched by each engine
 * from each seed, and what the root says — the favourite, the best move that is not its mirror, their rates and Wilson
 * intervals. Mirror twins are one move (`canonical`): the favourite's twin is never its runner-up.
 */
const canonical = (move) => `${move.card}@${Math.min(move.border, 6 - move.border)}`;

function measured(search, move) {
  const { visits = 0, wins = 0 } = search.tree().children.get(moveKey(move)) ?? {};
  return { key: canonical(move), visits, rate: visits ? wins / visits : 0, interval: interval(wins, visits) };
}

function rootOf(search) {
  const best = new Map();
  for (const move of search.candidates()) {
    const side = measured(search, move);
    if (side.visits > (best.get(side.key)?.visits ?? -1)) best.set(side.key, side);
  }
  const total = [...search.tree().children.values()].reduce((sum, child) => sum + child.visits, 0);
  const [first, second] = [...best.values()].sort((a, b) => b.visits - a.visits);
  return { distinct: best.size, total, first, second };
}

function searched(engine, state, seed, budget) {
  const search = engineFor(engine)(createRng(seed)).searchFor(state, legalMoves(state), {});
  for (let i = 0; i < budget; i += 1) search.step();
  return rootOf(search);
}

const seedsOf = (engine, state, { deal, seeds, budget }) => seeds.map((seed) => searched(`${engine}@${budget}`, state, seed + deal, budget));

parentPort.on("message", (task) => {
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(task.deal), endMode: "claim-end" });
  parentPort.postMessage(task.engines.map((engine) => seedsOf(engine, state, task)));
});
