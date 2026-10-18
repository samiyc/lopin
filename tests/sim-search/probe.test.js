import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { newProbe, probeSummary } from "../../src/sim/mcts/probe.js";

const fresh = (seed) => createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed) });

/** The visits of every root candidate after `n` iterations from turn 5 of game `seed`, with or without a probe. */
function visits(engine, seed, n, probe) {
  const state = fresh(seed);
  for (let turn = 0; turn < 4; turn += 1) applyMove(state, legalMoves(state)[0]);
  const search = engineFor(engine)(createRng(3)).searchFor(state, legalMoves(state), {}, probe ? { probe } : {});
  for (let i = 0; i < n; i += 1) search.step();
  return search.scored().map((entry) => `${entry.move.card}@${entry.move.border}:${entry.gain}`);
}

describe("the Labo's profiler (probe.js)", () => {
  for (const engine of ["ismcts+widen=7+depth=5+core=stfig6+exact=12", "ismcts+widen=7+depth=5+core=stfig6+exact=12+trees=2"]) {
    it(`leaves the search unchanged and fills its counters (${engine.includes("trees") ? "two trees" : "one tree"})`, () => {
      const probe = newProbe();
      assert.deepEqual(visits(engine, 11, 150, probe), visits(engine, 11, 150, null));
      assert.equal(probe.iterations, 150);
      assert.ok(probe.coreCalls > 0 && probe.rolloutPlies > 150 && probe.treePlies >= 150);
      const summary = probeSummary(probe);
      assert.ok(Math.abs(Object.values(summary.share).reduce((a, b) => a + b, 0) - 1) < 1e-9);
      assert.ok(summary.rolloutPlies > 1);
    });
  }

  it("says nothing of an empty probe", () => {
    assert.equal(probeSummary(newProbe()), null);
  });
});
