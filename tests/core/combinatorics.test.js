import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, DECK_IDS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import {
  choose,
  closedFormCounts,
  enumerateTriples,
  inversions,
  rarityOrder,
} from "../../src/core/combinatorics.js";

const { free, onePerBorder } = JOKER_RULES;

describe("choose", () => {
  it("matches known values", () => {
    assert.equal(choose(42, 3), 11480);
    assert.equal(choose(54, 3), 24804);
    assert.equal(choose(4, 3), 4);
    assert.equal(choose(3, 5), 0);
  });
});

describe("formulas and enumeration agree on every deck without jokers", () => {
  for (const id of DECK_IDS.filter((deckId) => DECKS[deckId].jokers === 0)) {
    it(id, () => {
      const counted = enumerateTriples(DECKS[id], ORDERS.original, free);
      const formula = closedFormCounts(DECKS[id]);
      assert.equal(counted.total, formula.total);
      assert.deepEqual(counted.best, formula.best);
    });
  }
});

describe("known counts", () => {
  it("original Schotten Totten: 42 / 180 / 462 / 1470 / 22650 of 24804", () => {
    const { total, best } = enumerateTriples(DECKS.original, ORDERS.original, free);
    assert.equal(total, 24804);
    assert.deepEqual(best, {
      straightFlush: 42, threeOfAKind: 180, flush: 462, straight: 1470, sum: 22650,
    });
  });

  it("tarot with free jokers keeps the original order", () => {
    const { total, best } = enumerateTriples(DECKS.tarot, ORDERS.original, free);
    assert.equal(total, 11480);
    assert.deepEqual(best, {
      straightFlush: 200, threeOfAKind: 240, flush: 400, straight: 1240, sum: 9400,
    });
    assert.deepEqual(inversions(best, ORDERS.original), []);
  });
});

describe("the wild-card paradox in 4 colours × 1-10 + 2 jokers", () => {
  const classique = DECKS.classique;

  it("under the original order a straight flush is commoner than trips", () => {
    const { best } = enumerateTriples(classique, ORDERS.original, free);
    assert.equal(best.straightFlush, 208);
    assert.equal(best.threeOfAKind, 160);
    assert.deepEqual(inversions(best, ORDERS.original), [
      { stronger: "straightFlush", weaker: "threeOfAKind" },
    ]);
  });

  it("swapping the two turns the double-joker hands into trips, and it flips back", () => {
    const { best } = enumerateTriples(classique, ORDERS.swapped, free);
    assert.equal(best.straightFlush, 168);
    assert.equal(best.threeOfAKind, 200);
    assert.deepEqual(inversions(best, ORDERS.swapped), [
      { stronger: "threeOfAKind", weaker: "straightFlush" },
    ]);
  });

  it("one joker per border makes the counts independent of the order", () => {
    const original = enumerateTriples(classique, ORDERS.original, onePerBorder);
    const swapped = enumerateTriples(classique, ORDERS.swapped, onePerBorder);
    assert.equal(original.total, 11480 - 40);
    assert.equal(original.excluded, 40);
    assert.deepEqual(original.best, swapped.best);
    assert.equal(original.best.straightFlush, 168);
    assert.equal(original.best.threeOfAKind, 160);
    assert.deepEqual(inversions(swapped.best, ORDERS.swapped), []);
  });
});

describe("a colourless joker in 4 colours × 1-10", () => {
  it("restores the original order, whichever order is played", () => {
    for (const order of Object.values(ORDERS)) {
      const { best } = enumerateTriples(DECKS.classique, order, JOKER_RULES.colorless);
      assert.deepEqual(best, {
        straightFlush: 32, threeOfAKind: 200, flush: 448, straight: 1024, sum: 9776,
      });
    }
    const { best } = enumerateTriples(DECKS.classique, ORDERS.original, JOKER_RULES.colorless);
    assert.deepEqual(inversions(best, ORDERS.original), []);
  });

  it("but not in 5 colours × 1-8, where trips outnumber flushes", () => {
    const { best } = enumerateTriples(DECKS.tarot, ORDERS.original, JOKER_RULES.colorless);
    assert.equal(best.threeOfAKind, 280);
    assert.equal(best.flush, 250);
    assert.deepEqual(inversions(best, ORDERS.original), [
      { stronger: "threeOfAKind", weaker: "flush" },
    ]);
  });
});

describe("rarityOrder", () => {
  it("sorts the patterns from rarest to commonest, the sum last", () => {
    const counts = { straightFlush: 208, threeOfAKind: 160, flush: 672, straight: 888, sum: 9552 };
    assert.deepEqual(rarityOrder(counts), ["threeOfAKind", "straightFlush", "flush", "straight", "sum"]);
  });
});

describe("reachable counts", () => {
  it("are non-exclusive: a straight flush is also counted as a flush and a straight", () => {
    const { best, reachable } = enumerateTriples(DECKS.original, ORDERS.original, free);
    assert.equal(reachable.flush, best.flush + best.straightFlush);
    assert.equal(reachable.straight, best.straight + best.straightFlush);
  });
});
