import { parentPort } from "node:worker_threads";
import { DECKS, JOKER_RULES } from "../../../src/config/decks.js";
import { ORDERS } from "../../../src/config/formations.js";
import { createRng } from "../../../src/core/random.js";
import { buildDeck } from "../../../src/core/cards.js";
import { engineFor } from "../../../src/sim/bots.js";
import { budgetOf } from "../../../src/sim/heuristics/experimental.js";
import { createGame, legalMoves } from "../../../src/sim/engine/game.js";

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
  const children = [...search.tree().children.values()].filter((child) => child.visits > 0).sort((a, b) => b.visits - a.visits);
  const rate = (child) => (child ? child.wins / child.visits : 0.5);
  const total = children.reduce((sum, child) => sum + child.visits, 0);
  // The runner-up too (Sami, 16/10): how far behind it is, and how much of the search the favourite took.
  return { value: rate(children[0]), second: rate(children[1] ?? children[0]), topShare: total > 0 ? children[0].visits / total : 1 };
}

const meanOf = (xs) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

// `decks` (the cards in order, a kept game's `deck`) judges given deals instead of `dealSeeds`.
parentPort.on("message", ({ row, endMode, engine, dealSeeds = null, decks = null, seeds }) => {
  const spec = DECKS[row.deck];
  const deals = decks ?? dealSeeds.map((dealSeed) => createRng(dealSeed).shuffle(buildDeck(spec)));
  const values = deals.map((deck, d) => {
    const fresh = () => createGame(spec, { order: ORDERS[row.order], jokerRule: JOKER_RULES[row.jokerRule], rng: createRng(dealSeeds?.[d] ?? d + 1), endMode, deck: [...deck] });
    return seeds.map((seed) => rootValue(fresh(), engine, seed));
  });
  parentPort.postMessage({
    values: values.map((reads) => meanOf(reads.map((read) => read.value))),
    seconds: values.map((reads) => meanOf(reads.map((read) => read.second))),
    topShares: values.map((reads) => meanOf(reads.map((read) => read.topShare))),
  });
});
