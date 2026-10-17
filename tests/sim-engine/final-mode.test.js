import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { BOTS } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves, playGame } from "../../src/sim/engine/game.js";

const spec = DECKS.classique;
const rules = { order: ORDERS.original, jokerRule: JOKER_RULES.colorless };

function play(seed, endMode, players = ["strategist", "greedy"]) {
  const rng = createRng(seed);
  const bots = players.map((id) => BOTS[id](rng));
  return playGame(spec, { ...rules, rng, bots, endMode });
}

describe("endMode: final", () => {
  it("names the same winner as the early mode, game after game", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const early = play(seed, "early");
      const final = play(seed, "final");
      assert.equal(final.winner, early.winner, `seed ${seed}`);
      assert.equal(final.winType, early.winType, `seed ${seed}`);
    }
  });

  it("plays every card, then settles all seven borders in the order they filled", () => {
    const state = play(7, "final");
    assert.equal(state.pile.length, 0);
    assert.ok(state.hands.every((hand) => hand.length === 0));
    assert.equal(state.resolved.length, 7);
    assert.ok(state.borders.every((border) => border.owner !== null));
    const order = state.resolved.map((entry) => entry.filledAt);
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
  });

  it("leaves every border unsettled until the last card", () => {
    const rng = createRng(3);
    const bots = [BOTS.greedy(rng), BOTS.greedy(rng)];
    const state = createGame(spec, { ...rules, rng, endMode: "final" });
    while (state.hands.some((hand) => hand.length > 0)) {
      assert.equal(state.resolved.length, 0);
      applyMove(state, bots[state.current].choose(state, legalMoves(state)));
    }
    assert.ok(state.over);
  });
});

describe("createGame with an imposed deck", () => {
  it("deals exactly the given order, so a game can be replayed", () => {
    const first = createGame(spec, { ...rules, rng: createRng(11) });
    const again = createGame(spec, { ...rules, rng: createRng(99), deck: first.deck });
    assert.deepEqual(again.hands, first.hands);
    assert.deepEqual(again.pile, first.pile);
    assert.deepEqual(again.deck, first.deck);
  });
});
