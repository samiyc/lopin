import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { JOKER, cardOf, cardLabel, realCardCount } from "../../src/core/cards.js";
import { getEvaluator, getReachability } from "../../src/core/evaluator.js";
import {
  FORMATION_BIT,
  bestByBruteForce,
  classify,
  formationOfScore,
  strengthScore,
} from "../../src/core/formations.js";

const classique = DECKS.classique;
const tarot = DECKS.tarot;
const card = (value, color) => cardOf(classique, color, value);
const [SPADE, HEART, DIAMOND] = [0, 1, 2];

describe("classify", () => {
  const cases = [
    [[card(3, HEART), card(4, HEART), card(5, HEART)], "straightFlush"],
    [[card(7, SPADE), card(7, HEART), card(7, DIAMOND)], "threeOfAKind"],
    [[card(2, HEART), card(9, HEART), card(5, HEART)], "flush"],
    [[card(8, SPADE), card(10, HEART), card(9, DIAMOND)], "straight"],
    [[card(1, SPADE), card(5, HEART), card(10, DIAMOND)], "sum"],
  ];
  for (const [cards, expected] of cases) {
    it(`${cards.map((c) => cardLabel(classique, c)).join(" ")} is ${expected}`, () => {
      assert.equal(classify(classique, cards), expected);
    });
  }

  it("does not wrap runs round: 9-10-1 is not a straight", () => {
    assert.equal(classify(classique, [card(9, SPADE), card(10, HEART), card(1, DIAMOND)]), "sum");
  });
});

describe("strength scores", () => {
  it("rank dominates the sum, and the order decides the rank", () => {
    const { original, swapped } = ORDERS;
    assert.ok(strengthScore(original, "straightFlush", 6) > strengthScore(original, "threeOfAKind", 30));
    assert.ok(strengthScore(swapped, "threeOfAKind", 3) > strengthScore(swapped, "straightFlush", 27));
    assert.ok(strengthScore(original, "sum", 20) > strengthScore(original, "sum", 19));
  });

  it("round-trips the formation", () => {
    for (const order of Object.values(ORDERS)) {
      for (const f of order) assert.equal(formationOfScore(order, strengthScore(order, f, 17)), f);
    }
  });
});

describe("the lookup-table evaluator matches the brute-force definition", () => {
  const { free, colorless } = JOKER_RULES;
  for (const spec of [classique, tarot]) {
    for (const rule of [free, colorless]) {
      for (const [orderId, order] of Object.entries(ORDERS)) {
        it(`${spec.id}, ${rule.id}, ${orderId} order, every hand with one or two jokers`, () => {
          const evaluator = getEvaluator(spec, order, rule);
          const n = realCardCount(spec);
          for (let a = 0; a < n; a += 1) {
            const twoJokers = [a, JOKER, JOKER];
            assert.equal(evaluator.score(twoJokers), bestByBruteForce(spec, twoJokers, order, rule));
            for (let b = a + 1; b < n; b += 1) {
              const oneJoker = [a, b, JOKER];
              assert.equal(evaluator.score(oneJoker), bestByBruteForce(spec, oneJoker, order, rule));
            }
          }
        });
      }
    }
  }

  it("a colourless joker never finishes a colour", () => {
    const evaluator = getEvaluator(classique, ORDERS.original, JOKER_RULES.colorless);
    assert.equal(evaluator.formation([card(4, HEART), card(5, HEART), JOKER]), "straight");
    assert.equal(evaluator.formation([card(2, HEART), card(9, HEART), JOKER]), "sum");
    assert.equal(evaluator.formation([card(7, HEART), card(7, SPADE), JOKER]), "threeOfAKind");
  });

  it("ignores card order inside a side", () => {
    const evaluator = getEvaluator(classique, ORDERS.original, JOKER_RULES.free);
    const hand = [card(4, HEART), JOKER, card(6, HEART)];
    assert.equal(evaluator.score(hand), evaluator.score([...hand].reverse()));
    assert.equal(evaluator.formation(hand), "straightFlush");
    assert.equal(evaluator.sum(hand), 15);
  });

  it("resolves a joker to the highest sum inside the best formation", () => {
    const evaluator = getEvaluator(classique, ORDERS.original, JOKER_RULES.free);
    assert.equal(evaluator.formation([card(9, HEART), card(10, HEART), JOKER]), "straightFlush");
    assert.equal(evaluator.sum([card(9, HEART), card(10, HEART), JOKER]), 27);
    assert.equal(evaluator.sum([card(1, SPADE), card(5, HEART), JOKER]), 16);
  });
});

describe("reachability", () => {
  const reach = getReachability(classique, JOKER_RULES.free);
  const has = (mask, f) => (mask & FORMATION_BIT[f]) !== 0;

  it("a pair is a start of three of a kind and nothing else", () => {
    const mask = reach.mask([card(7, SPADE), card(7, HEART)]);
    assert.ok(has(mask, "threeOfAKind"));
    assert.ok(!has(mask, "flush") && !has(mask, "straight") && !has(mask, "straightFlush"));
  });

  it("a straight flush also shows a flush and a straight", () => {
    const mask = reach.mask([card(3, HEART), card(4, HEART), card(5, HEART)]);
    for (const f of ["straightFlush", "flush", "straight"]) assert.ok(has(mask, f), f);
    assert.ok(!has(mask, "threeOfAKind"));
  });

  it("a card and a joker can still become anything", () => {
    const mask = reach.mask([card(10, DIAMOND), JOKER]);
    for (const f of ["straightFlush", "threeOfAKind", "flush", "straight"]) assert.ok(has(mask, f), f);
  });
});
