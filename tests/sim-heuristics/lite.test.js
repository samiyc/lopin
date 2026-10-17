import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor, strategistBot } from "../../src/sim/bots.js";
import { coreOf } from "../../src/sim/heuristics/experimental.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { ismctsSettings } from "../../src/sim/mcts/ismcts.js";
import { createValuer, sidePotential, unseenCards } from "../../src/sim/eval/potential.js";

const freshGame = (seed) => createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed) });

describe("B1: a lighter core for the rollouts (lite)", () => {
  it("values a one-card side by its card alone, and nothing else differently", () => {
    const state = freshGame(6);
    const view = { valuer: createValuer(state), unseen: unseenCards(state, 0), hand: state.hands[0], draws: 10, jokerAllowed: () => true };
    const [a, b] = state.hands[0];
    assert.equal(sidePotential([a], { ...view, lite: true }), view.valuer.single(a));
    assert.ok(sidePotential([a], view) >= view.valuer.single(a));
    assert.equal(sidePotential([a, b], { ...view, lite: true }), sidePotential([a, b], view));
    assert.equal(sidePotential([], { ...view, lite: true }), view.valuer.empty);
  });

  it("changes the core's scores only through one-card sides", () => {
    const state = freshGame(7);
    for (let i = 0; i < 6; i += 1) applyMove(state, legalMoves(state)[0]);
    const score = (core) => strategistBot(createRng(1), core).scoreMoves(state, legalMoves(state), { keepAll: true }).map(({ gain }) => gain);
    assert.notDeepEqual(score(coreOf("v1lite")), score(coreOf("stfig6")));
  });

  it("reads +lite in an engine id, and plays", () => {
    assert.equal(ismctsSettings("ismcts+widen=3+lite=1").lite, 1);
    const state = freshGame(8);
    for (const level of [1, 2]) assert.ok(engineFor(`ismcts+widen=3+depth=5+core=stfig6+lite=${level}@30`)(createRng(1)).choose(state, legalMoves(state)));
  });
});
