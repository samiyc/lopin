import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { JOKER, cardOf } from "../../src/core/cards.js";
import { keepsFigure, oracleBonus } from "../../src/sim/heuristics/oracle-ideas.js";
import { shapeOf } from "../../src/sim/eval/shapes.js";

const spec = DECKS.classique;
const c = (color, value) => cardOf(spec, color, value);
const weights = { stay: 0.4, noAnswer: 0.1, noBlindOpen: 0.2 };
const DEFAULTS = { mine: [], theirs: [], hand: [], extra: {}, turn: 10 };
function context(ideas, options = {}) {
  const o = { ...DEFAULTS, ...options };
  return { spec, weights: { ...weights, ...o.extra }, ideas: new Set(ideas), mySides: o.mySides ?? [o.mine], theirSides: o.theirSides ?? [o.theirs], hand: o.hand, turn: o.turn };
}

describe("bonuses that follow the oracle", () => {
  it("reward a card on a side already started, and only there", () => {
    assert.equal(oracleBonus(context(["stay"], { mine: [c(0, 5)] }), 0, c(1, 5)), 0.4);
    assert.equal(oracleBonus(context(["stay"]), 0, c(1, 5)), 0);
  });

  it("make answering an opposing card pay", () => {
    assert.equal(oracleBonus(context(["noAnswer"], { theirs: [c(2, 7)] }), 0, c(1, 8)), -0.1);
    assert.equal(oracleBonus(context(["noAnswer"]), 0, c(1, 8)), 0);
  });

  it("make opening an untouched border pay when nothing in hand would build on it", () => {
    const card = c(0, 5);
    assert.equal(oracleBonus(context(["noBlindOpen"], { hand: [card, c(2, 9)] }), 0, card), -0.2);
    assert.equal(oracleBonus(context(["noBlindOpen"], { hand: [card, c(3, 5)] }), 0, card), 0, "a pair in hand");
    assert.equal(oracleBonus(context(["noBlindOpen"], { hand: [card, c(0, 6)] }), 0, card), 0, "a suited neighbour in hand");
    assert.equal(oracleBonus(context(["noBlindOpen"], { hand: [JOKER] }), 0, JOKER), 0);
  });

  it("make any opening of an untouched border pay with noOpen, a plan in hand or not", () => {
    const card = c(0, 5);
    const extra = { noOpen: 0.15 };
    assert.equal(oracleBonus(context(["noOpen"], { hand: [card, c(2, 9)], extra }), 0, card), -0.15);
    assert.equal(oracleBonus(context(["noOpen"], { hand: [card, c(1, 5)], extra }), 0, card), -0.15, "a pair in hand does not spare it");
    assert.equal(oracleBonus(context(["noOpen"], { theirs: [c(2, 7)], extra }), 0, card), 0, "answering is not opening");
    assert.equal(oracleBonus(context(["noOpen"], { mine: [c(1, 5)], extra }), 0, card), 0);
  });

  it("make building a suited run pay with noRun, and not trips", () => {
    const extra = { noRun: 0.1 };
    assert.equal(oracleBonus(context(["noRun"], { mine: [c(0, 5)], extra }), 0, c(0, 6)), -0.1);
    assert.equal(oracleBonus(context(["noRun"], { mine: [c(0, 5)], extra }), 0, c(1, 5)), 0, "trips");
    assert.equal(oracleBonus(context(["noRun"], { mine: [c(0, 5)], extra }), 0, c(1, 6)), 0, "not suited");
    assert.ok(Math.abs(oracleBonus(context(["noRun", "stay"], { mine: [c(0, 5)], extra }), 0, c(0, 6)) - 0.3) < 1e-12, "with stay, both count");
  });

  it("cost nothing when none of them is on", () => {
    assert.equal(oracleBonus(context([], { mine: [c(0, 5)] }), 0, c(1, 5)), 0);
  });

  it("narrow stay: which card, a figure kept, when, and behind on borders", () => {
    const pair = { mine: [c(0, 5)] };
    assert.equal(oracleBonus(context(["stay"], { ...pair, extra: { stayCard: 3 } }), 0, c(1, 5)), 0, "a 2nd card when only the 3rd counts");
    assert.equal(oracleBonus(context(["stay"], { ...pair, extra: { stayCard: 2 } }), 0, c(1, 5)), 0.4);
    assert.equal(oracleBonus(context(["stay"], { ...pair, extra: { stayFigure: 1 } }), 0, c(1, 9)), 0, "5 and 9 of two suits: no figure left");
    assert.equal(oracleBonus(context(["stay"], { ...pair, extra: { stayFigure: 1 } }), 0, c(0, 6)), 0.4, "a suited start");
    assert.equal(oracleBonus(context(["stay"], { ...pair, extra: { stayUntil: 20 }, turn: 25 }), 0, c(1, 5)), 0);
    assert.equal(oracleBonus(context(["stay"], { ...pair, extra: { stayFrom: 20 }, turn: 25 }), 0, c(1, 5)), 0.4);
    const ahead = { mySides: [[c(0, 5)], [c(0, 8)]], theirSides: [[], []] };
    assert.equal(oracleBonus(context(["stay"], { ...ahead, extra: { stayBehind: 1 } }), 0, c(1, 5)), 0, "I have started more borders");
    const behind = { mySides: [[c(0, 5)], []], theirSides: [[c(2, 2)], [c(2, 9)]] };
    assert.equal(oracleBonus(context(["stay"], { ...behind, extra: { stayBehind: 1 } }), 0, c(1, 5)), 0.4);
  });
});

describe("a side that keeps a figure (stfig)", () => {
  it("answers as shapeOf on every side of up to three cards, jokers included", () => {
    const spec = DECKS.classique;
    const cards = [...Array.from({ length: spec.colors * spec.values }, (_, card) => card), JOKER];
    const expected = (side) => side.filter((card) => card !== JOKER).length < 2 || shapeOf(spec, side) !== null;
    const sides = cards.flatMap((a) => cards.filter((b) => b !== a || a === JOKER).map((b) => [a, b]));
    for (const [a, b] of sides) {
      assert.equal(keepsFigure(spec, [a], b), expected([a, b]));
      for (const c of [cardOf(spec, 0, 5), cardOf(spec, 1, 5), cardOf(spec, 0, 6), cardOf(spec, 0, 8), JOKER]) {
        if (c !== a && c !== b) assert.equal(keepsFigure(spec, [a, b], c), expected([a, b, c]), `${a} ${b} ${c}`);
      }
    }
  });
});
