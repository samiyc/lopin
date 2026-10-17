import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { valueOf } from "../../src/core/cards.js";
import { exposurePenalty, holdsOne, outbidBonus } from "../../src/sim/heuristics/outbid.js";

const spec = DECKS.classique;
/** The first card of the deck's order with value `value`. */
const cardOf = (value, skip = 0) => Array.from({ length: 54 }, (_, card) => card).filter((card) => valueOf(spec, card) === value)[skip];
const weights = { outbid: 0.2, outbidWide: 0, exposure: 0.2 };

describe("Sami's first-card ideas", () => {
  it("answer a lone card one notch higher, and only one notch", () => {
    const context = { spec, weights, mySides: [[], []], theirSides: [[cardOf(2)], []] };
    assert.equal(outbidBonus(context, 0, cardOf(3)), 0.2);
    assert.equal(outbidBonus(context, 0, cardOf(4)), 0);
    assert.equal(outbidBonus(context, 1, cardOf(3)), 0);
  });

  it("with outbidWide, only while the opponent has started more borders", () => {
    const wide = { ...weights, outbidWide: 1 };
    const even = { spec, weights: wide, mySides: [[], [cardOf(5)]], theirSides: [[cardOf(2)], []] };
    const behind = { spec, weights: wide, mySides: [[], []], theirSides: [[cardOf(2)], [cardOf(7)]] };
    assert.equal(outbidBonus(even, 0, cardOf(3)), 0);
    assert.equal(outbidBonus(behind, 0, cardOf(3)), 0.2);
  });

  it("price an untouched border by the odds that the opponent holds the card one notch above", () => {
    assert.equal(holdsOne(0, 30, 6), 0);
    assert.ok(Math.abs(holdsOne(1, 30, 6) - 0.2) < 1e-9);
    const unseen = { entries: [[cardOf(4), 1], [cardOf(4, 1), 1], [cardOf(8), 1]], total: 30 };
    const context = { spec, weights, unseen, theirSides: [[], [cardOf(1)]], theirHand: 6 };
    assert.ok(exposurePenalty(context, 0, cardOf(3)) < 0);
    assert.equal(exposurePenalty(context, 0, cardOf(5)), 0);
    assert.equal(exposurePenalty(context, 0, cardOf(spec.values)), 0);
    assert.equal(exposurePenalty(context, 1, cardOf(3)), 0);
  });
});
