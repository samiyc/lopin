import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { ismctsSettings } from "../../src/sim/mcts/ismcts.js";

/** A position a few moves in, the same at every run. */
function position(seed, plies) {
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed) });
  for (let i = 0; i < plies; i += 1) applyMove(state, legalMoves(state)[0]);
  return state;
}

/** Every node's visits after a search of `n` iterations, depth first. */
function visits(id, state, n = 300) {
  const bot = engineFor(id)(createRng(3));
  const search = bot.searchFor(state, legalMoves(state), {});
  for (let i = 0; i < n && !search.done(); i += 1) search.step();
  const all = [];
  const walk = (node) => node.children.forEach((child) => all.push(child.visits) && walk(child));
  walk(search.tree());
  return all;
}

describe("FirstExplo: UCB's exploration at the first player's nodes (ismcts+firstExploration)", () => {
  it("reads its value", () => {
    assert.equal(ismctsSettings("ismcts+widen=7+firstExploration=0.6").firstExploration, 0.6);
  });

  it("changes nothing when it equals the exploration", () => {
    const state = position(5, 8);
    assert.deepEqual(visits("ismcts+widen=7+depth=5+core=stfig6+firstExploration=0.7@300", state), visits("ismcts+widen=7+depth=5+core=stfig6@300", state));
  });

  // With 7 replies a node, UCB chooses at the root and the first ply below it, hardly further:
  // the first player's own candidates when they search, the replies they are expected to make otherwise.
  it("changes the search of either seat", () => {
    for (const plies of [8, 9]) {
      const state = position(5, plies);
      assert.notDeepEqual(visits("ismcts+widen=7+depth=5+core=stfig6+firstExploration=0.2@1000", state, 1000), visits("ismcts+widen=7+depth=5+core=stfig6@1000", state, 1000));
    }
  });
});
