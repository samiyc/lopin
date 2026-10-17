import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { JOKER, cardOf } from "../../src/core/cards.js";
import { getEvaluator } from "../../src/core/evaluator.js";
import { bestPartition, trioValue } from "../../src/core/partition.js";
import { createRng } from "../../src/core/random.js";

const spec = DECKS.classique;
const options = { order: ORDERS.original, jokerRule: JOKER_RULES.colorless };
const value = trioValue(getEvaluator(spec, options.order, options.jokerRule), spec);
const at = (value_, suit) => cardOf(spec, suit, value_);

/** Every way to split `cards` into trios, by brute force. */
function bruteForce(cards) {
  if (cards.length === 0) return 0;
  const [first, ...rest] = cards;
  let best = -Infinity;
  for (let j = 0; j < rest.length; j += 1) {
    for (let k = j + 1; k < rest.length; k += 1) {
      const remaining = rest.filter((_, i) => i !== j && i !== k);
      best = Math.max(best, value(first, rest[j], rest[k]) + bruteForce(remaining));
    }
  }
  return best;
}

describe("bestPartition", () => {
  it("finds the obvious split: three straight flushes", () => {
    const cards = [at(1, 0), at(5, 1), at(9, 2), at(2, 0), at(6, 1), at(10, 2), at(3, 0), at(7, 1), at(8, 2)];
    const { total, trios } = bestPartition(spec, cards, options);
    const formations = trios.map((trio) => getEvaluator(spec, options.order, options.jokerRule).formation(trio));
    assert.deepEqual(formations, ["straightFlush", "straightFlush", "straightFlush"]);
    assert.equal(total, bruteForce(cards));
  });

  it("matches brute force on random nine-card sets, jokers included", () => {
    const rng = createRng(9);
    const pool = [...Array(40).keys(), JOKER, JOKER];
    for (let round = 0; round < 25; round += 1) {
      const cards = rng.shuffle([...pool]).slice(0, 9);
      const { total, trios } = bestPartition(spec, cards, options);
      assert.ok(Math.abs(total - bruteForce(cards)) < 1e-9, `round ${round}`);
      assert.ok(Math.abs(trios.reduce((sum, trio) => sum + value(...trio), 0) - total) < 1e-9);
      assert.deepEqual([...trios.flat()].sort((a, b) => a - b), [...cards].sort((a, b) => a - b));
    }
  });

  it("refuses a set that does not split into trios", () => {
    assert.throws(() => bestPartition(spec, [0, 1, 2, 3], options));
  });
});
