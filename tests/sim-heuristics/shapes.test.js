import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { JOKER, cardOf } from "../../src/core/cards.js";
import { runsCut, shapeOf, shapesBonus } from "../../src/sim/eval/shapes.js";

const spec = DECKS.classique;
const c = (color, value) => cardOf(spec, color, value);
const weights = { plan: 0.2, ends: 0.2, midRuns: 0.2, weakRuns: 0.2 };
const context = (ideas, mySides = []) => ({ spec, weights, ideas: new Set(ideas), mySides });

describe("choosing a game: trips or suited runs", () => {
  it("reads a side's shape once a second real card shows it", () => {
    assert.deepEqual(shapeOf(spec, [c(0, 5), c(2, 5)]), { kind: "trips", value: 5 });
    assert.deepEqual(shapeOf(spec, [c(1, 4), c(1, 6)]), { kind: "run", low: 4, high: 6 });
    assert.equal(shapeOf(spec, [c(1, 4), JOKER]), null);
    assert.equal(shapeOf(spec, [c(1, 4), c(2, 5)]), null);
  });

  it("counts the suited runs a value cuts: none at the ends, all in the middle", () => {
    assert.deepEqual([1, 2, 3, 5, 9, 10].map((value) => runsCut(value, spec.values)), [0, 0.5, 1, 1, 0.5, 0]);
  });

  it("sends real trips to the ends and the joker to mid-range trips", () => {
    assert.ok(shapesBonus(context(["ends"]), [c(0, 5)], c(1, 5)) < 0);
    assert.equal(shapesBonus(context(["ends"]), [c(0, 10)], c(1, 10)), 0);
    assert.ok(shapesBonus(context(["ends"]), [c(0, 5), c(1, 5)], JOKER) > 0);
  });

  it("prefers mid-range runs, and makes a low run pay", () => {
    assert.ok(shapesBonus(context(["midRuns"]), [c(0, 4)], c(0, 5)) > 0);
    assert.ok(shapesBonus(context(["midRuns"]), [c(0, 1)], c(0, 2)) < 0);
    assert.ok(shapesBonus(context(["weakRuns"]), [c(0, 1)], c(0, 2)) < shapesBonus(context(["weakRuns"]), [c(0, 8)], c(0, 9)));
  });

  it("follows the plan of my complete sides", () => {
    const trips = [[c(0, 2), c(1, 2), c(2, 2)], []];
    assert.equal(shapesBonus(context(["plan"], trips), [c(0, 7)], c(3, 7)), 0.2);
    assert.equal(shapesBonus(context(["plan"], trips), [c(0, 7)], c(0, 8)), -0.2);
    assert.equal(shapesBonus(context(["plan"], [[], []]), [c(0, 7)], c(3, 7)), 0);
  });
});
