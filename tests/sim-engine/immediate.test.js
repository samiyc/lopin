import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatCard } from "../../src/core/notation.js";
import { createRng } from "../../src/core/random.js";
import { stateAt } from "../../src/replay/core/log.js";
import { engineFor } from "../../src/sim/bots.js";
import { exactApplies } from "../../src/sim/eval/exact.js";
import { applyMove, legalMoves } from "../../src/sim/engine/game.js";
import { determinize } from "../../src/sim/search/lookahead.js";

const { puzzles } = JSON.parse(readFileSync(new URL("../../web/data/puzzles.json", import.meta.url), "utf8"));
const text = (state, move) => `${formatCard(state.spec, move.card)}→${move.border + 1}`;
const find = (state, solution) => legalMoves(state).find((move) => text(state, move) === solution);

describe("gain immédiat puzzles", () => {
  const immediate = puzzles.filter((puzzle) => puzzle.kind === "immediate");

  it("exist, under the claim rule, with a pile left", () => {
    // 8 since 06/10: Sami kept only his favourites (40 before).
    assert.ok(immediate.length >= 5);
    for (const puzzle of immediate) {
      assert.equal(puzzle.log.rules.endMode, "claim-end");
      assert.ok(stateAt(puzzle.log, puzzle.turn).pile.length > 0, `puzzle ${puzzle.id}`);
    }
  });

  /** One deal of the hidden cards, then the solution: who has won, once the move is over. */
  function playDeal(position, solution, rng) {
    // determinize() plays out in "final": the claim rule is the point here.
    const state = { ...determinize(position, position.current, rng), endMode: "claim-end" };
    applyMove(state, find(state, solution));
    return state.over ? state.winner : null;
  }

  it("win on the move itself, whatever the hidden cards, over 20 deals each", () => {
    for (const puzzle of immediate) {
      const position = stateAt(puzzle.log, puzzle.turn);
      const rng = createRng(puzzle.id);
      for (const solution of puzzle.solutions) {
        for (let deal = 0; deal < 20; deal += 1) assert.equal(playDeal(position, solution, rng), position.current, `puzzle ${puzzle.id}, ${solution}, deal ${deal}`);
      }
    }
  });
});

describe("the experimental bot's exact endgame", () => {
  it("plays a winning move in every endgame puzzle of 8 cards or fewer", () => {
    let checked = 0;
    for (const puzzle of puzzles.filter((p) => p.kind !== "immediate")) {
      const state = stateAt(puzzle.log, puzzle.log.turns.length + 1);
      if (!exactApplies(state)) continue;
      const move = engineFor("experimental")(createRng(1)).choose(state, legalMoves(state));
      assert.ok(puzzle.solutions.includes(text(state, move)), `puzzle ${puzzle.id}: ${text(state, move)}`);
      checked += 1;
    }
    // 22 since 06/10: the new puzzles are deeper (7 to 12 cards), the shallow ones were not favourites.
    assert.ok(checked >= 20, `only ${checked} puzzles`);
  });
});
