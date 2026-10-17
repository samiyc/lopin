import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { BOTS } from "../../src/sim/bots.js";
import { solveEndgame } from "../../src/sim/eval/endgame.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { packPosition, unpackPosition } from "../../src/sim/puzzles/trap-bench.js";

/** A core-against-core game of the page's rule, stopped once the pile is empty. */
function endgame(seed) {
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, endMode: "claim-end", rng: createRng(seed) });
  const bot = BOTS.strategist(createRng(seed));
  while (!state.over && state.pile.length > 0) applyMove(state, bot.choose(state, legalMoves(state)));
  return state;
}

describe("the trap bench's positions (trap-bench.js)", () => {
  it("unpack to the same endgame: same moves, same exact value", () => {
    let checked = 0;
    for (let seed = 1; seed <= 6; seed += 1) {
      const state = endgame(seed);
      if (state.over) continue;
      const copy = unpackPosition(JSON.parse(JSON.stringify(packPosition(state))));
      assert.deepEqual(legalMoves(copy), legalMoves(state), `seed ${seed}`);
      assert.equal(solveEndgame(copy, { stopAtWin: true }).value, solveEndgame(state, { stopAtWin: true }).value, `seed ${seed}`);
      checked += 1;
    }
    assert.ok(checked >= 3);
  });
});
