import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor } from "../../src/sim/bots.js";
import { createGame, legalMoves } from "../../src/sim/engine/game.js";
import { addRootStats, interval, keyMove, rootStats, snapshotTree } from "../../src/sim/mcts/tree-snapshot.js";

const node = (visits, wins, children = {}) => ({ visits, wins, avail: visits, children: new Map(Object.entries(children)) });

const freshGame = (seed) => createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed) });

/** A search run to `iterations`, as the page's worker runs it. */
function searched(engine, seed, iterations) {
  const state = freshGame(seed);
  const bot = engineFor(engine)(createRng(seed + 1));
  const search = bot.searchFor(state, legalMoves(state));
  while (!search.done() && search.rollouts() < iterations) search.step();
  return { state, search };
}

describe("what the Labo reads of a tree (tree-snapshot.js, 17/10)", () => {
  it("gives a Wilson interval that holds the rate and narrows with visits", () => {
    const [low, high] = interval(6, 10);
    assert.ok(low < 0.6 && high > 0.6);
    const [low2, high2] = interval(60, 100);
    assert.ok(high2 - low2 < high - low);
    assert.deepEqual(interval(0, 0), [0, 1]);
  });

  it("reads a move key back", () => {
    assert.deepEqual(keyMove("12@3"), { card: 12, border: 3 });
    assert.equal(keyMove("pass"), null);
  });

  it("keeps the most visited children, sums the rest, and alternates the mover", () => {
    const root = node(0, 0, {
      "1@0": node(10, 6, { "5@1": node(6, 2, { "2@2": node(3, 2) }), "6@1": node(3, 1), "7@1": node(1, 1) }),
      "2@0": node(4, 1),
    });
    const snap = snapshotTree(root, { rootPlayer: 1, perNode: 1, minVisits: 2 });
    assert.equal(snap.visits, 14, "the root's visits are its children's");
    assert.deepEqual(snap.children.map((child) => [child.key, child.mover]), [["1@0", 1], ["2@0", 1]]);
    const [first] = snap.children;
    assert.deepEqual(first.children.map((child) => [child.key, child.mover]), [["5@1", 0]]);
    assert.deepEqual(first.hidden, { count: 2, ones: 1, visits: 4, wins: 2 });
    assert.equal(first.children[0].children[0].mover, 1);
    assert.equal(snap.size, 5);
  });

  it("stops at maxNodes, the shallow plies first", () => {
    const root = node(0, 0, { a: node(5, 2, { c: node(3, 1, { e: node(2, 1) }) }), b: node(5, 3, { d: node(3, 1) }) });
    const snap = snapshotTree(root, { maxNodes: 4 });
    assert.equal(snap.size, 4);
    assert.deepEqual(snap.children.map((child) => child.children.length), [1, 0]);
    assert.equal(snap.children[1].hidden.count, 1);
  });

  it("reads a real search without changing its move", () => {
    const engine = "ismcts+widen=3+depth=3@80";
    const plain = searched(engine, 7, 80).search.best();
    const { state, search } = searched(engine, 7, 80);
    const stats = rootStats(search.tree(), search.candidates(), search.core());
    snapshotTree(search.tree(), { rootPlayer: state.current });
    assert.deepEqual(search.best(), plain);
    assert.equal(stats.length, 8);
    assert.equal(stats.reduce((sum, entry) => sum + entry.visits, 0), 80);
    assert.deepEqual(stats.map((entry) => entry.coreRank), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.ok(stats.every((entry) => entry.coreGain !== null));
    const best = stats.reduce((a, b) => (b.visits > a.visits ? b : a));
    assert.equal(best.move.card, search.best().card);
  });

  it("adds an ensemble's trees up as its scores do", () => {
    const { search } = searched("ismcts+widen=3+depth=3+trees=2@80", 9, 80);
    const parts = search.trees().map((tree) => rootStats(tree, search.candidates(), search.core()));
    const added = addRootStats(parts);
    const gains = new Map(search.scored().map((entry) => [`${entry.move.card}@${entry.move.border}`, entry.gain]));
    assert.equal(added.reduce((sum, entry) => sum + entry.visits, 0), 80);
    for (const entry of added) assert.ok(Math.abs(gains.get(entry.key) - entry.visits) <= 2, entry.key);
  });
});
