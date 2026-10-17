import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { createGame } from "../../src/sim/engine/game.js";
import { createPairMemo, createValuer, sidePotential, unseenCards } from "../../src/sim/eval/potential.js";

/** A view of player 0 at the start of a seeded game, with or without a pair memo. */
function viewOf(seed, memo) {
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed) });
  return { state, view: { valuer: createValuer(state), unseen: unseenCards(state, 0), hand: state.hands[0], draws: 10, jokerAllowed: () => true, memo } };
}

describe("the pair memo of the side potential (potential.js, 05/10)", () => {
  it("answers as the computation would, twice in a row", () => {
    const { state, view } = viewOf(4, createPairMemo());
    const plain = viewOf(4, undefined).view;
    for (const card of state.hands[0]) {
      const side = [card];
      assert.equal(sidePotential(side, view), sidePotential(side, plain));
      assert.equal(sidePotential(side, view), sidePotential(side, plain));
    }
  });

  it("keeps two scorings apart, even one inside the other", () => {
    const outer = viewOf(5, createPairMemo());
    const inner = { ...outer.view, draws: 2, memo: createPairMemo() };
    const side = [outer.state.hands[0][0], outer.state.hands[0][1]];
    const before = sidePotential(side, outer.view);
    sidePotential(side, inner);
    assert.equal(sidePotential(side, outer.view), before);
    assert.equal(sidePotential(side, inner), sidePotential(side, { ...inner, memo: undefined }));
  });
});
