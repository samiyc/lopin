import { createRng } from "../../../src/core/random.js";
import { solveEndgame } from "../../../src/sim/eval/endgame.js";
import { pileDeals } from "../../../src/sim/mcts/pimc.js";
import { determinize } from "../../../src/sim/search/lookahead.js";
import { moveKey } from "../../../src/sim/search/search.js";

/**
 * Moves judged at the game's rule (`claim-end`) over the deals their mover cannot tell apart, by the exact solver —
 * with one card in the pile every place of it, with more `SAMPLED` random deals (seeded 1 to 12, so two benches deal
 * alike). Shared by sure-lost-moves-worker.js and claim-pile-worker.js.
 */
const SAMPLED = 12;

export const dealsOf = (state, player) => (state.pile.length === 1 ? pileDeals(state, player) : Array.from({ length: SAMPLED }, (_, k) => determinize(state, player, createRng(k + 1))));

/** Each move's deals won at `claim-end`, and how many deals the solver finished within `nodes`. */
export function wonByMove(deals, moves, nodes) {
  const wins = new Map(moves.map((move) => [moveKey(move), 0]));
  let solved = 0;
  for (const deal of deals) {
    const solution = solveEndgame(Object.assign(deal, { endMode: "claim-end" }), { moves, maxNodes: nodes });
    if (!solution.complete) continue;
    solved += 1;
    for (const entry of solution.moves) if (entry.value > 0) wins.set(moveKey(entry.move), wins.get(moveKey(entry.move)) + 1);
  }
  return { wins, solved };
}
