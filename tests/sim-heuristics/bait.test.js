import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { cardOf } from "../../src/core/cards.js";
import { baitBonus, baitBorders } from "../../src/sim/heuristics/bait.js";

const spec = DECKS.classique;
const c = (color, value) => cardOf(spec, color, value);

describe("Sami's bait", () => {
  it("keeps to the borders outside both sides' best run of three", () => {
    // Mine: borders 0-2 (high odds); theirs: borders 4-6 (low odds); border 3 is in neither.
    assert.deepEqual(baitBorders([0.9, 0.9, 0.9, 0.5, 0.1, 0.1, 0.1]), [false, false, false, true, false, false, false]);
  });

  it("rewards a low pair or a low suited start there, and nothing high", () => {
    const context = (mySides) => ({ spec, ideas: new Set(["bait"]), weights: { bait: 0.2 }, chances: [0.9, 0.9, 0.9, 0.5, 0.1, 0.1, 0.1], mySides });
    const sides = (side) => [[], [], [], side, [], [], []];
    assert.equal(baitBonus(context(sides([c(0, 2)])), 3, c(1, 2)), 0.2);
    assert.equal(baitBonus(context(sides([c(0, 2)])), 3, c(0, 3)), 0.2);
    assert.equal(baitBonus(context(sides([c(0, 2)])), 3, c(1, 8)), 0);
    assert.equal(baitBonus(context(sides([c(0, 2)])), 0, c(1, 2)), 0);
  });
});
