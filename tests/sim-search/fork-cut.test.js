import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor } from "../../src/sim/bots.js";
import { forkHolder, playOutForkCut } from "../../src/sim/mcts/fork-cut.js";
import { createGame } from "../../src/sim/engine/game.js";
import { playOut } from "../../src/sim/search/lookahead.js";

/** A game under the simulations' `final` rule and a policy, both from `seed`: built twice, they play the same moves. */
function setup(seed) {
  const rng = createRng(seed);
  const game = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng, endMode: "final" });
  return { game, policy: engineFor("greedy")(createRng(seed + 1)) };
}

describe("the double threat in the simulations (fork-cut.js, Sami 14/10)", () => {
  it("level 1 stops at a victory on the filled borders and finds the full play-out's winner, every time", () => {
    let shorter = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const full = setup(seed);
      const cut = setup(seed);
      const winner = playOut(full.game, full.policy);
      assert.equal(playOutForkCut(cut.game, cut.policy, 1), winner, `seed ${seed}`);
      if (cut.game.turn < full.game.turn) shorter += 1;
    }
    assert.ok(shorter > 200, `most play-outs end sooner (${shorter} of 300)`);
  });

  it("names the player with two threats or more against none", () => {
    const { spec } = setup(1).game;
    // Borders 2 and 3 are player 0's: winning 1 or 4 makes three in a row; player 1 owns border 7 alone.
    assert.equal(forkHolder([null, 0, 0, null, null, null, 1], spec), 0);
    assert.equal(forkHolder([null, null, null, null, null, null, null], spec), null, "nobody threatens anything");
    assert.equal(forkHolder([null, 0, 0, null, null, 1, 1], spec), null, "player 1 threatens border 5 too: no free win");
    assert.equal(forkHolder([null, 0, null, 0, null, null, 1], spec), null, "borders 2 and 4: one threat only (border 3)");
  });
});
