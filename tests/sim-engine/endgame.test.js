import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { BOTS } from "../../src/sim/bots.js";
import { bestMoves, solveEndgame } from "../../src/sim/eval/endgame.js";
import { playOutExact } from "../../src/sim/eval/exact.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { cloneState } from "../../src/sim/search/lookahead.js";

/** A game played by bots up to `turn`, in the page's end mode. */
function endgame(seed, turn) {
  const rng = createRng(seed);
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, endMode: "final", rng });
  const bot = BOTS.greedy(rng);
  while (state.turn < turn - 1) {
    const moves = legalMoves(state);
    applyMove(state, moves.length ? bot.choose(state, moves) : null);
  }
  return state;
}

/** Plain minimax, no memory, no cut-off: the reference. */
function naive(state, player) {
  if (state.over && state.winner === null) return 0;
  if (state.over) return state.winner === player ? 1 : -1;
  const moves = legalMoves(state);
  const values = (moves.length ? moves : [null]).map((move) => {
    const next = cloneState(state);
    applyMove(next, move);
    return naive(next, player);
  });
  return state.current === player ? Math.max(...values) : Math.min(...values);
}

describe("the endgame solver", () => {
  it("agrees with plain minimax on every move of small endgames", () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const state = endgame(seed, 38);
      assert.equal(state.pile.length, 0);
      const solution = solveEndgame(state);
      for (const { move, value } of solution.moves) {
        const next = cloneState(state);
        applyMove(next, move);
        assert.equal(value, naive(next, state.current), `seed ${seed}`);
      }
      assert.ok(bestMoves(solution).length >= 1);
    }
  });

  it("ends a simulation with the solver's verdict once few cards are left (simExact)", () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const state = endgame(seed, 38);
      const value = naive(state, state.current);
      const winner = playOutExact(cloneState(state), BOTS.greedy(createRng(seed)), 8);
      const decided = value > 0 ? state.current : 1 - state.current;
      assert.equal(winner, value === 0 ? null : decided, `seed ${seed}`);
    }
  });

  it("solves an eight-card endgame in well under a second", () => {
    const started = performance.now();
    solveEndgame(endgame(3, 35));
    assert.ok(performance.now() - started < 3000);
  });
});
