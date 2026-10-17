import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor } from "../../src/sim/bots.js";
import { visitRng } from "../../src/sim/mcts/common-deals.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { ismctsSettings } from "../../src/sim/mcts/ismcts.js";
import { moveKey } from "../../src/sim/search/search.js";

const TREE = "ismcts+widen=7+depth=5+core=stfig6";

/** A position a few moves in, the same at every run. */
function position(seed, plies) {
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed) });
  for (let i = 0; i < plies; i += 1) applyMove(state, legalMoves(state)[0]);
  return state;
}

/** A search of `n` iterations from `state` among `moves`, stepped by hand (a search of one move says it is done at once). */
function searched(id, state, moves, n) {
  const search = engineFor(id)(createRng(3)).searchFor(state, moves, {});
  for (let i = 0; i < n; i += 1) search.step();
  return search;
}

/** How many nodes hang below `node`. */
const sizeOf = (node) => [...node.children.values()].reduce((size, child) => size + 1 + sizeOf(child), 0);

/** A node's visits, wins and number of descendants. */
const statsOf = (node) => ({ visits: node.visits, wins: node.wins, size: sizeOf(node) });

/** Each root candidate searched alone for as many visits as it had in the full search, against what it had there: equal or not. */
function aloneAsInFull(id, state) {
  const moves = legalMoves(state);
  const full = searched(id, state, moves, 300).tree();
  return moves
    .filter((move) => full.children.get(moveKey(move))?.visits > 0)
    .map((move) => {
      const inFull = statsOf(full.children.get(moveKey(move)));
      const alone = statsOf(searched(id, state, [move], inFull.visits).tree().children.get(moveKey(move)));
      return JSON.stringify(alone) === JSON.stringify(inFull);
    });
}

describe("CommonDeals: the root's candidates on common deals (ismcts+crn)", () => {
  it("reads its value", () => {
    assert.equal(ismctsSettings(`${TREE}+crn=1`).crn, 1);
  });

  it("gives a visit the same deal and rollout stream whoever asks, another visit others", () => {
    const ctx = { crnSeed: 42, rolloutRng: createRng(0) };
    const draws = (visit) => [visitRng(ctx, visit).int(2 ** 30), ctx.rolloutRng.int(2 ** 30)];
    assert.deepEqual(draws(3), draws(3));
    assert.notDeepEqual(draws(3)[0], draws(4)[0]);
    assert.notDeepEqual(draws(3)[1], draws(4)[1]);
  });

  // The property that makes the comparison paired: a candidate's k-th visit sees the search's k-th deal, however UCB
  // interleaves the candidates, so its subtree is the same searched alone as among the others.
  it("makes a candidate's results depend on its own visits only", () => {
    const same = aloneAsInFull(`${TREE}+crn=1@300`, position(5, 12));
    assert.ok(same.length >= 4, "several candidates visited");
    assert.ok(same.every(Boolean));
  });

  it("is what makes them so: without it, a candidate searched alone sees other deals", () => {
    assert.ok(aloneAsInFull(`${TREE}@300`, position(5, 12)).some((same) => !same));
  });
});
