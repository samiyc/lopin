import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor } from "../../src/sim/bots.js";
import { untriedScore } from "../../src/sim/mcts/first-play.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { ismctsSettings } from "../../src/sim/mcts/ismcts.js";

const TREE = "ismcts+widen=7+depth=5+core=stfig6";

/** A position a few moves in, the same at every run. */
function position(seed, plies) {
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed) });
  for (let i = 0; i < plies; i += 1) applyMove(state, legalMoves(state)[0]);
  return state;
}

/** The root of a search of `n` iterations from `state`. */
function rootOf(id, state, n) {
  const search = engineFor(id)(createRng(3)).searchFor(state, legalMoves(state), {});
  for (let i = 0; i < n; i += 1) search.step();
  return search.tree();
}

const tried = (node) => [...node.children.values()].filter((child) => child.visits > 0);
/** The opponent's replies tried at least once, over every root candidate. */
const repliesTried = (root) => tried(root).reduce((sum, child) => sum + tried(child).length, 0);

const node = (visits, wins, avail = 10) => ({ child: { visits, wins, avail } });

describe("ReplyFpu: an untried reply scored from its siblings (ismcts+fpu)", () => {
  it("reads its value, 0 included", () => {
    assert.equal(ismctsSettings(`${TREE}+fpu=0`).fpu, 0);
    assert.equal(ismctsSettings(`${TREE}+fpu=1`).fpu, 1);
  });

  it("keeps +∞ when off or when nothing is tried yet", () => {
    const bonus = () => 0.5;
    assert.equal(untriedScore([node(2, 1)], undefined, bonus)(node(0, 0).child, 0), Infinity);
    assert.equal(untriedScore([node(0, 0), node(0, 0)], 1, bonus)(node(0, 0).child, 0), Infinity);
  });

  it("scores an untried move at the tried mean minus fpu / 10, plus one visit's bonus", () => {
    const bonus = (child) => child.avail / 100 + child.visits;
    const score = untriedScore([node(3, 2), node(1, 1), node(0, 0)], 1, bonus);
    assert.ok(Math.abs(score(node(0, 0, 20).child, 2) - (3 / 4 - 0.1 + 0.2 + 1)) < 1e-12);
  });

  it("still tries every root candidate, and opens fewer replies below them", () => {
    const state = position(5, 12);
    const plain = rootOf(`${TREE}@400`, state, 400);
    const fpu = rootOf(`${TREE}+fpu=0@400`, state, 400);
    assert.equal(tried(fpu).length, tried(plain).length);
    assert.ok(repliesTried(fpu) < repliesTried(plain), `${repliesTried(fpu)} replies against ${repliesTried(plain)}`);
  });
});
