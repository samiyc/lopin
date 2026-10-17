import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { JOKER, cardOf } from "../../src/core/cards.js";
import { minedBonus } from "../../src/sim/heuristics/mined.js";

const spec = DECKS.classique;
const c = (color, value) => cardOf(spec, color, value);
const weights = { junk: 0.2, facing: 0.1, underbid: 0.1, nextToWon: 0.1 };
const context = (ideas, mySides, theirSides, owners = [null, null, null]) => ({ spec, weights, ideas: new Set(ideas), mySides, theirSides, owners, me: 0 });

describe("rules mined from the kept games", () => {
  it("make a side that is neither trips nor a suited run pay, and nothing else", () => {
    const sides = [[c(0, 4)], [], []];
    assert.equal(minedBonus(context(["junk"], sides, [[], [], []]), 0, c(1, 7)), -0.2);
    assert.equal(minedBonus(context(["junk"], sides, [[], [], []]), 0, c(2, 4)), 0);
    assert.equal(minedBonus(context(["junk"], sides, [[], [], []]), 0, c(0, 5)), 0);
    assert.equal(minedBonus(context(["junk"], sides, [[], [], []]), 0, JOKER), 0);
    assert.equal(minedBonus(context(["junk"], sides, [[], [], []]), 1, c(1, 7)), 0);
  });

  it("read the opponent's side and the borders already won", () => {
    const theirs = [[c(0, 6)], [c(0, 1), c(1, 1), c(2, 1)], []];
    assert.equal(minedBonus(context(["underbid"], [[], [], []], theirs), 0, c(1, 5)), -0.1);
    assert.equal(minedBonus(context(["underbid"], [[], [], []], theirs), 0, c(1, 7)), 0);
    assert.equal(minedBonus(context(["facing"], [[], [], []], theirs), 1, c(1, 7)), 0.1);
    assert.equal(minedBonus(context(["nextToWon"], [[], [], []], theirs, [0, null, null]), 1, c(1, 7)), 0.1);
    assert.equal(minedBonus(context(["nextToWon"], [[], [], []], theirs, [1, null, null]), 1, c(1, 7)), 0);
  });
});
