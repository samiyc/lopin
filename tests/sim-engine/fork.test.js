import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { forkValue, forkValues, isForkBorder, threatsOf, winsWith } from "../../src/sim/eval/fork.js";

const spec = DECKS.classique;
/** Owners of the seven borders from a string: "0" mine, "1" theirs, "." undecided. */
const owners = (text) => [...text].map((c) => (c === "." ? null : Number(c)));

describe("the double threat (src/sim/eval/fork.js, Sami 11/10)", () => {
  it("wins with three adjacent or the majority", () => {
    assert.equal(winsWith([false, true, true, true, false, false, false], spec), true);
    assert.equal(winsWith([true, false, true, false, true, false, true], spec), true);
    assert.equal(winsWith([true, true, false, true, true, false, false], spec), true, "four borders");
    assert.equal(winsWith([true, true, false, false, true, false, false], spec), false);
  });

  it("finds the threats: borders 3 and 4 won, borders 2 and 5 each win", () => {
    assert.deepEqual(threatsOf(owners("..00..."), 0, spec), [1, 4]);
    assert.deepEqual(threatsOf(owners("..00..."), 1, spec), []);
    assert.deepEqual(threatsOf(owners(".1001.."), 0, spec), [], "both ends taken: no run, and two borders are far from four");
  });

  it("values a border 1 when it wins at once, ½ when it leaves a double threat", () => {
    const board = owners("...0...");
    assert.equal(forkValue(board, 0, spec, 3), 0, "a decided border");
    assert.equal(forkValue(board, 0, spec, 2), 0.5, "winning 3 next to 4 leaves 2 and 5");
    assert.ok(isForkBorder(board, 0, spec, 4));
    assert.equal(forkValue(board, 0, spec, 0), 0);
    assert.equal(forkValue(owners("..00..."), 0, spec, 1), 1);
  });

  it("adds three quarters of the opponent's value: taking a border they need", () => {
    const values = forkValues(owners("..11..."), 0, spec);
    assert.equal(values[1], 0.75);
    assert.equal(values[4], 0.75);
    assert.equal(values[0], 0.375, "border 1 would give them a third border, and two threats: ½ × ¾");
  });
});
