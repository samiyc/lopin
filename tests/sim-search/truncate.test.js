import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { BOTS, engineFor, winOdds } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { gameOdds } from "../../src/sim/mcts/truncate.js";

const close = (a, b) => Math.abs(a - b) < 1e-9;

describe("rollouts cut short", () => {
  it("turn the odds on each border into the odds of the game: four borders, or three side by side", () => {
    assert.equal(gameOdds([1, 1, 0, 1, 1, 0, 0]), 1, "four borders, no three side by side for either");
    assert.equal(gameOdds([0, 0, 1, 0, 0, 1, 1]), 0);
    assert.equal(gameOdds([1, 0, 1, 0, 1, 0, 1]), 1, "four borders, none adjacent");
    assert.equal(gameOdds([1, 1, 1, 0, 0, 1, 0]), 1, "three side by side");
    assert.equal(gameOdds([1, 1, 1, 0, 0, 0, 0]), 0.5, "both reach a goal: which comes first decides, the odds alone cannot say");
    assert.ok(close(gameOdds([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]), 0.5));
    assert.ok(gameOdds([0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]) > 0.6, "a small edge on every border is a bigger edge on the game");
  });

  it("read the core's odds for the player to move, and play a whole game", () => {
    const rng = createRng(2);
    const bots = [engineFor("ismcts+widen=3+depth=5+trunc=5@60")(rng), BOTS.greedy(rng)];
    const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng, endMode: "claim-end" });
    while (!state.over) {
      const odds = winOdds(state);
      assert.ok(odds >= 0 && odds <= 1);
      const moves = legalMoves(state);
      applyMove(state, moves.length > 0 ? bots[state.current].choose(state, moves) : null);
    }
    assert.ok(state.winner === 0 || state.winner === 1 || state.winner === null);
  });
});
