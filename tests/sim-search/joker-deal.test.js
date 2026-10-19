import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { isJoker } from "../../src/core/cards.js";
import { createRng } from "../../src/core/random.js";
import { strategistBot } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { dealFor } from "../../src/sim/mcts/deal.js";
import { unseenList } from "../../src/sim/search/lookahead.js";

/** A game played by the strategist until both jokers are still unseen by player 0 and the pile is short. */
function lateGame() {
  for (let seed = 1; seed < 200; seed += 1) {
    const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed), endMode: "final" });
    const bot = strategistBot(createRng(seed));
    while (!state.over && state.pile.length > 4) applyMove(state, bot.choose(state, legalMoves(state)));
    if (!state.over && state.current === 0 && unseenList(state, 0).filter(isJoker).length === 2) return state;
  }
  throw new Error("no such game");
}

describe("jkHand: the hidden jokers dealt into the opponent's hand", () => {
  const state = lateGame();
  const ctx = (jkHand) => ({ state, player: 0, unseen: unseenList(state, 0), hands: null, omniscient: false, jkHand: jkHand ? 40 : 0 });

  it("never leaves a joker in the pile, and deals the same cards", () => {
    const sorted = (cards) => [...cards].sort((a, b) => a - b);
    for (let k = 1; k <= 200; k += 1) {
      const game = dealFor(ctx(true), createRng(k));
      assert.equal(game.pile.filter(isJoker).length, 0);
      assert.equal(game.hands[1].filter(isJoker).length, 2);
      assert.deepEqual(sorted([...game.hands[1], ...game.pile]), sorted(unseenList(state, 0)));
    }
  });

  it("leaves the deal untouched when off", () => {
    const inPile = Array.from({ length: 200 }, (_, k) => dealFor(ctx(false), createRng(k + 1)).pile.filter(isJoker).length).reduce((a, b) => a + b, 0);
    assert.ok(inPile > 0);
  });
});
