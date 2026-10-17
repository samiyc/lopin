import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { strategistBot } from "../../src/sim/bots.js";
import { DISTILLED, LIMIT, clampUnits, coreWith, heldOut, scoreOfRank, valuesAt } from "../../src/sim/heuristics/distill.js";
import { CORES } from "../../src/sim/heuristics/experimental.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";

/** A position a few moves in, to rank moves on. */
function midGame(seed) {
  const rng = createRng(seed);
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng });
  for (let i = 0; i < 9; i += 1) applyMove(state, legalMoves(state)[0]);
  return state;
}
const ranking = (core, state) => strategistBot(createRng(1), core).scoreMoves(state, legalMoves(state), { keepAll: true }).map(({ move, gain }) => `${move.card}:${move.border}:${gain.toFixed(6)}`);

describe("npm run distill: the 1.0's core tuned on the oracle (distill.js)", () => {
  it("is the 1.0 itself at step 0: the ideas it adds start at weight 0", () => {
    const zero = coreWith(valuesAt(DISTILLED.map(() => 0)));
    for (const seed of [3, 4, 5]) {
      const state = midGame(seed);
      assert.deepEqual(ranking(zero, state), ranking(CORES.stfig6, state));
    }
  });

  it("moves each weight by its step, and no further than the limit", () => {
    const units = DISTILLED.map((_, i) => (i === 0 ? 2 : 0));
    const first = DISTILLED[0];
    assert.equal(valuesAt(units)[first.in][first.key], Number((valuesAt(DISTILLED.map(() => 0))[first.in][first.key] + 2 * first.step).toFixed(4)));
    assert.deepEqual(clampUnits([LIMIT + 3, -LIMIT - 1, 1]), [LIMIT, -LIMIT, 1]);
  });

  it("keeps about one game in four aside, always the same", () => {
    const keys = Array.from({ length: 2000 }, (_, i) => `game-${i}`);
    const aside = keys.filter(heldOut).length / keys.length;
    assert.ok(aside > 0.2 && aside < 0.3, `${aside}`);
    assert.equal(heldOut("abc-def"), heldOut("abc-def"));
  });

  it("scores the oracle's move in the top 8, a little more in first place", () => {
    assert.deepEqual([1, 2, 8, 9, 0].map(scoreOfRank), [1.25, 1, 1, 0, 0]);
  });

  it("names its core dist1 for the tree and core duels", () => assert.ok(CORES.dist1.ideas.includes("stay")));
});
