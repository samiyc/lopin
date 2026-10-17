import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { JOKER, cardOf } from "../../src/core/cards.js";
import { jokerBonus, jokerCompletesRun, jokerTrapBonus } from "../../src/sim/heuristics/joker-ideas.js";
import { strategistAdjust } from "../../src/sim/heuristics/strategist.js";

const spec = DECKS.classique;
const c = (color, value) => cardOf(spec, color, value);
const weights = { jokerFull: 0.1, jokerWait: 0.3, jokerMid: 0.1 };
const context = (ideas, theirs) => ({ spec, weights, ideas: new Set(ideas), theirSides: [theirs], habits: new Set(["joker"]) });

describe("where to put a joker", () => {
  it("rewards a full opposing side, and makes an open one wait", () => {
    const full = [c(0, 1), c(1, 1), c(2, 1)];
    assert.equal(jokerBonus(context(["jokerFull"], full), [c(0, 5), c(1, 5)], 0), 0.1);
    assert.equal(jokerBonus(context(["jokerFull"], [c(0, 1)]), [c(0, 5), c(1, 5)], 0), 0);
    assert.ok(Math.abs(jokerBonus(context(["jokerWait"], []), [c(0, 5), c(1, 5)], 0) + 0.3) < 1e-9);
    assert.equal(jokerBonus(context(["jokerWait"], full), [c(0, 5), c(1, 5)], 0), 0);
  });

  it("rewards mid-range trips only", () => {
    assert.equal(jokerBonus(context(["jokerMid"], []), [c(0, 5), c(1, 5)], 0), 0.1);
    assert.equal(jokerBonus(context(["jokerMid"], []), [c(0, 9), c(1, 9)], 0), 0);
  });

  it("lets a joker complete a suited run only with jokerRuns", () => {
    const side = [c(2, 4), c(2, 6)];
    assert.equal(jokerCompletesRun(spec, side), true);
    assert.equal(jokerCompletesRun(spec, [c(2, 4), c(1, 5)]), false);
    assert.equal(strategistAdjust(side, JOKER, context([], []), 0).allowed, false);
    assert.equal(strategistAdjust(side, JOKER, context(["jokerRuns"], []), 0).allowed, true);
  });

  it("springs the trap only on a dead pair, with a joker in hand", () => {
    const trap = (hand, boardCards) => jokerTrapBonus({ spec, ideas: new Set(["jokerTrap"]), weights: { jokerTrap: 0.2 }, hand, boardCards }, [c(0, 6)], c(1, 6));
    const dead = [c(0, 6), c(2, 6), c(3, 6)];
    assert.equal(trap([c(1, 6), JOKER], dead), 0.2);
    assert.equal(trap([c(1, 6), c(0, 2)], dead), 0);
    assert.equal(trap([c(1, 6), JOKER], [c(0, 6), c(2, 6)]), 0);
  });
});
