import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { JOKER, cardOf } from "../../src/core/cards.js";
import { IDEA_WEIGHTS, borderFactors, ideasBonus, solidStart } from "../../src/sim/heuristics/ideas.js";

const spec = DECKS.classique;
const at = (value, suit) => cardOf(spec, suit, value);
const HEART = 1;
const SPADE = 0;

/** A board seen from one player: seven borders, `mine` and `theirs` by index. */
function contextOf({ ideas, hand = [], mine = {}, theirs = {} }) {
  const sides = (spread) => Array.from({ length: 7 }, (_, i) => spread[i] ?? []);
  const mySides = sides(mine);
  const theirSides = sides(theirs);
  return {
    spec,
    ideas: new Set(ideas),
    weights: IDEA_WEIGHTS,
    hand,
    mySides,
    theirSides,
    boardCards: [...mySides, ...theirSides].flat(),
  };
}

describe("a solid start", () => {
  it("is three of a kind in hand, a joker counting as one", () => {
    const hand = [at(7, HEART), at(7, SPADE), JOKER, at(2, 3)];
    assert.ok(solidStart(contextOf({ ideas: [], hand }), at(7, HEART)));
    assert.ok(!solidStart(contextOf({ ideas: [], hand: [at(7, HEART), at(7, SPADE)] }), at(7, HEART)));
  });

  it("is two suited cards in a row with both ends unseen", () => {
    const hand = [at(4, HEART), at(5, HEART), at(9, SPADE)];
    assert.ok(solidStart(contextOf({ ideas: [], hand }), at(4, HEART)));
    const sixOut = contextOf({ ideas: [], hand, theirs: { 2: [at(6, HEART)] } });
    assert.ok(!solidStart(sixOut, at(4, HEART)), "6♥ already on the board closes the top end");
    const edge = [at(1, HEART), at(2, HEART)];
    assert.ok(!solidStart(contextOf({ ideas: [], hand: edge }), at(1, HEART)), "no card below the ace");
  });
});

describe("the ideas", () => {
  it("spread: no second lone 7", () => {
    const context = contextOf({ ideas: ["spread"], hand: [at(7, HEART)], mine: { 0: [at(7, SPADE)] } });
    assert.equal(ideasBonus(context, 5, at(7, HEART)), -IDEA_WEIGHTS.spread);
    assert.equal(ideasBonus(context, 5, at(8, HEART)), 0);
    assert.equal(ideasBonus(context, 0, at(7, HEART)), 0, "joining the 7 is not opening a new one");
  });

  it("middle: only a solid start opens the three central borders", () => {
    const weak = contextOf({ ideas: ["middle"], hand: [at(7, HEART), at(2, SPADE)] });
    assert.equal(ideasBonus(weak, 3, at(7, HEART)), -IDEA_WEIGHTS.middleWeak);
    assert.equal(ideasBonus(weak, 0, at(7, HEART)), 0);
    const solid = contextOf({ ideas: ["middle"], hand: [at(4, HEART), at(5, HEART)] });
    assert.equal(ideasBonus(solid, 2, at(4, HEART)), IDEA_WEIGHTS.middleSolid);
  });

  it("edges: a weak start goes to the sides", () => {
    const weak = contextOf({ ideas: ["edges"], hand: [at(7, HEART), at(2, SPADE)] });
    assert.equal(ideasBonus(weak, 6, at(7, HEART)), IDEA_WEIGHTS.edges);
    assert.equal(ideasBonus(weak, 3, at(7, HEART)), 0);
  });

  it("counter: the same shape one notch higher", () => {
    const theirs = { 4: [at(4, SPADE), at(5, SPADE), at(6, SPADE)] };
    const context = contextOf({ ideas: ["counter"], mine: { 4: [at(5, HEART)] }, theirs });
    assert.equal(ideasBonus(context, 4, at(6, HEART)), IDEA_WEIGHTS.counter);
    assert.equal(ideasBonus(context, 4, at(4, HEART)), 0, "lower does not counter");
    const empty = contextOf({ ideas: ["counter"] });
    assert.equal(ideasBonus(empty, 1, at(6, HEART)), -IDEA_WEIGHTS.exposed);
  });
});

describe("Sami's principles (principles.js)", () => {
  const withPile = (context, pile) => ({ ...context, pile });

  it("trips: a card joins its lone twin, or opens a trips border, when the hand holds the three", () => {
    const hand = [at(2, HEART), JOKER, at(9, SPADE)];
    const context = contextOf({ ideas: ["trips"], hand, mine: { 4: [at(2, SPADE)] } });
    assert.equal(ideasBonus(context, 4, at(2, HEART)), IDEA_WEIGHTS.trips, "2♥ joins the lone 2♠");
    assert.equal(ideasBonus(context, 0, at(9, SPADE)), 0);
    const trio = contextOf({ ideas: ["trips"], hand: [at(8, HEART), at(8, SPADE), JOKER] });
    assert.equal(ideasBonus(trio, 5, at(8, HEART)), IDEA_WEIGHTS.trips, "border 6 is a trips border");
    assert.equal(ideasBonus(trio, 0, at(8, HEART)), 0, "border 1 is not");
  });

  it("ends: no 1 or 10 opens a middle border", () => {
    const context = contextOf({ ideas: ["ends"], hand: [at(10, HEART), at(1, SPADE), at(5, SPADE)] });
    assert.equal(ideasBonus(context, 3, at(10, HEART)), -IDEA_WEIGHTS.ends);
    assert.equal(ideasBonus(context, 2, at(1, SPADE)), -IDEA_WEIGHTS.ends);
    assert.equal(ideasBonus(context, 0, at(10, HEART)), 0, "an edge border is fine");
    assert.equal(ideasBonus(context, 3, at(5, SPADE)), 0);
  });

  it("reserve: two free borders while the pile is thick, one near the end", () => {
    const five = { 0: [at(1, SPADE)], 1: [at(2, SPADE)], 2: [at(3, SPADE)], 3: [at(4, SPADE)], 4: [at(5, SPADE)] };
    const early = withPile(contextOf({ ideas: ["reserve"], mine: five }), 20);
    assert.equal(ideasBonus(early, 5, at(9, HEART)), -IDEA_WEIGHTS.reserve, "one free border would be left");
    assert.equal(ideasBonus(withPile(early, 4), 5, at(9, HEART)), 0, "near the end one is enough");
    assert.equal(ideasBonus(early, 0, at(9, HEART)), 0, "joining a started border keeps them free");
  });

  it("connector: a card does not leave its suited neighbour alone while both ends are open", () => {
    const context = contextOf({ ideas: ["connector"], hand: [at(9, SPADE)], mine: { 3: [at(8, SPADE)] } });
    assert.equal(ideasBonus(context, 4, at(9, SPADE)), -IDEA_WEIGHTS.connector, "9♠ leaves the 8♠");
    assert.equal(ideasBonus(context, 3, at(9, SPADE)), 0, "9♠ joins it");
    const closed = contextOf({ ideas: ["connector"], hand: [at(9, SPADE)], mine: { 3: [at(8, SPADE)] }, theirs: { 1: [at(7, SPADE)] } });
    assert.equal(ideasBonus(closed, 4, at(9, SPADE)), 0, "7♠ already played: one end left, no pair worth keeping");
    const hearts = contextOf({ ideas: ["connector"], hand: [at(10, HEART)], mine: { 3: [at(9, HEART)] } });
    assert.equal(ideasBonus(hearts, 4, at(10, HEART)), 0, "9♥ 10♥ has a single out, the 8♥");
  });
});

describe("judging a border with its neighbours (neighbors)", () => {
  const factorsOf = (chances, weight = 1) => borderFactors({ ideas: new Set(["neighbors"]), weights: { ...IDEA_WEIGHTS, neighbors: weight } }, chances.length, chances);

  it("weighs the centre, which three runs cross, above an edge, which one run crosses", () => {
    const factors = factorsOf([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    assert.ok(factors[3] > factors[1] && factors[1] > factors[0], factors.join(" "));
    assert.equal(factors[0], factors[6], "both edges alike");
  });

  it("weighs a border that would complete a run well under way above a lone one", () => {
    // Borders 1 and 2 nearly won: border 3 completes 1-2-3; border 6 has nothing around it.
    const factors = factorsOf([0.95, 0.95, 0.5, 0.5, 0.1, 0.5, 0.1]);
    assert.ok(factors[2] > factors[5], factors.join(" "));
  });

  it("does nothing when the idea is off", () => {
    const off = borderFactors({ ideas: new Set(), weights: IDEA_WEIGHTS }, 7, [0.9, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5]);
    assert.deepEqual(off, [1, 1, 1, 1, 1, 1, 1]);
  });
});
