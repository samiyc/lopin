import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor } from "../../src/sim/bots.js";
import { createGame, legalMoves } from "../../src/sim/engine/game.js";
import { treeStats } from "../../src/sim/mcts/tree-stats.js";

const node = (visits, children = []) => ({ visits, children: new Map(children.map((child, i) => [String(i), child])) });

describe("the tree's shape by level (tree-stats.js, Sami 14/10)", () => {
  it("counts each level's nodes, those with 0 and 1 visit, and the most visited", () => {
    const root = node(0, [node(5, [node(1), node(0), node(3, [node(0)])]), node(1), node(0)]);
    assert.deepEqual(treeStats(root), [
      { depth: 1, nodes: 3, zero: 1, one: 1, max: 5 },
      { depth: 2, nodes: 3, zero: 1, one: 1, max: 3 },
      { depth: 3, nodes: 1, zero: 1, one: 0, max: 0 },
    ]);
  });

  it("comes with a tree bot's scores, no deeper than its depth, every iteration through level 1", () => {
    const rng = createRng(3);
    const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng });
    const bot = engineFor("ismcts+widen=3+depth=3@60")(createRng(4));
    const scored = bot.scoreMoves(state, legalMoves(state));
    assert.equal(scored.tree.iterations, 60);
    assert.ok(scored.tree.levels.length >= 2 && scored.tree.levels.length <= 3, `levels: ${scored.tree.levels.length}`);
    const [first] = scored.tree.levels;
    assert.equal(first.nodes, 8, "the root's 8 candidates");
    assert.ok(first.max >= 60 / 8, "the most visited candidate has at least its share");
  });
});
