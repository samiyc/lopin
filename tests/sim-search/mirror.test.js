import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { isMirrored, withoutMirrors } from "../../src/sim/mcts/mirror.js";

const fresh = (seed) => createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed) });
const play = (state, border) => applyMove(state, legalMoves(state).find((move) => move.border === border));

/** Every node's key below `node`, depth first, with the board it stood on. */
function keysUnder(node, prefix = []) {
  return [...node.children.entries()].flatMap(([key, child]) => [[...prefix, key], ...keysUnder(child, [...prefix, key])]);
}

describe("mirror moves (mirror.js)", () => {
  it("holds while every card lies on the middle border, not after", () => {
    const state = fresh(1);
    assert.equal(isMirrored(state), true);
    play(state, 3);
    play(state, 3);
    assert.equal(isMirrored(state), true);
    assert.equal(withoutMirrors(state, legalMoves(state), (move) => move).every((move) => move.border <= 3), true);
    play(state, 5);
    assert.equal(isMirrored(state), false);
    assert.equal(withoutMirrors(state, legalMoves(state), (move) => move).length, legalMoves(state).length);
  });

  it("keeps borders 1-4 in the root's candidates and the tree's first plies, other cards in the freed slots", () => {
    const state = fresh(7);
    const search = engineFor("ismcts+widen=7+depth=5+core=stfig6+mirror=1")(createRng(3)).searchFor(state, legalMoves(state), {});
    for (let i = 0; i < 300; i += 1) search.step();
    const roots = search.candidates();
    assert.equal(roots.length, 8);
    assert.ok(roots.every((move) => move.border <= 3));
    const plain = engineFor("ismcts+widen=7+depth=5+core=stfig6")(createRng(3)).searchFor(state, legalMoves(state), {});
    plain.step();
    const cards = (moves) => new Set(moves.map((move) => move.card)).size;
    assert.ok(cards(roots) >= cards(plain.candidates()), "the freed slots go to other cards");
    // Under a middle move both players still stand on a mirrored board: the replies keep borders 1-4 too.
    for (const path of keysUnder(search.tree()).filter((keys) => keys.length === 2 && keys[0].endsWith("@3"))) {
      assert.ok(Number(path[1].split("@")[1]) <= 3, path.join(" / "));
    }
  });
});
