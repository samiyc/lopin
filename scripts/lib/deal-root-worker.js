import { parentPort } from "node:worker_threads";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { buildDeck } from "../../src/core/cards.js";
import { engineFor } from "../../src/sim/bots.js";
import { budgetOf } from "../../src/sim/experimental.js";
import { createGame, legalMoves } from "../../src/sim/game.js";

/**
 * `npm run deals -- --root N`: one deal's value for the first player, from
 * the root of an omniscient search on turn 1 — the most visited move's win
 * rate, averaged over `seeds` searches. A few moves' cost, where `--plays K`
 * plays K whole games.
 */
function rootValue(state, engine, seed) {
  const bot = engineFor(engine)(createRng(seed));
  const moves = legalMoves(state);
  const search = bot.searchFor(state, moves, {});
  const budget = budgetOf(engine.split("@")[1]).budget;
  while (!search.done() && search.rollouts() < budget) search.step();
  let best = { visits: 0, wins: 0 };
  for (const child of search.tree().children.values()) if (child.visits > best.visits) best = child;
  return best.visits > 0 ? best.wins / best.visits : 0.5;
}

// `decks` (the cards in order, a kept game's `deck`) judges given deals instead of `dealSeeds`.
parentPort.on("message", ({ row, endMode, engine, dealSeeds = null, decks = null, seeds }) => {
  const spec = DECKS[row.deck];
  const deals = decks ?? dealSeeds.map((dealSeed) => createRng(dealSeed).shuffle(buildDeck(spec)));
  const values = deals.map((deck, d) => {
    const fresh = () => createGame(spec, { order: ORDERS[row.order], jokerRule: JOKER_RULES[row.jokerRule], rng: createRng(dealSeeds?.[d] ?? d + 1), endMode, deck: [...deck] });
    const total = seeds.reduce((sum, seed) => sum + rootValue(fresh(), engine, seed), 0);
    return total / seeds.length;
  });
  parentPort.postMessage({ values });
});
