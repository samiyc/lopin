import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { judgeDeals, nearestMedian } from "../scripts/lib/deal-judge.js";

describe("a pool of the most disputed deals", () => {
  it("keeps the deals nearest the median share, in deal order, whatever the estimate's bias", () => {
    // A judge that overrates the first player: the median is 0.65, not 0.5.
    const { picked, median, band } = nearestMedian([0.95, 0.6, 0.66, 0.2, 0.72, 0.65, 0.1], 3);
    assert.equal(median, 0.65);
    assert.deepEqual(picked, [1, 2, 5]);
    assert.deepEqual(band, [0.6, 0.66]);
  });
});
import { DECKS } from "../src/config/decks.js";
import { gameRules } from "../src/sim/simulate.js";

describe("a pool of deals", () => {
  it("deals game g from the pool's seed g, the deck the judge saw", () => {
    const spec = DECKS.classique;
    // The judge's deal d is `deals` + 7919 d: seed 6 is deal 0 of a batch dealt from 6.
    assert.deepEqual(gameRules(spec, { dealSeeds: [5, 6] }, 1).deck, gameRules(spec, { deals: 6 }, 0).deck);
    assert.notDeepEqual(gameRules(spec, { dealSeeds: [5, 6] }, 0).deck, gameRules(spec, { deals: 6 }, 0).deck);
  });
});

describe("judging deals between omniscients", () => {
  it("tells decided deals from balanced ones, and gives the first player's share", () => {
    // Ten games a deal: won 10, 9, 5, 4 and 0 times by the first player.
    const judged = judgeDeals([10, 9, 5, 4, 0], 10);
    assert.ok(Math.abs(judged.first - 28 / 50) < 1e-12);
    assert.equal(judged.decided, 3 / 5, "10, 9 and 0 wins out of 10: decided whoever plays");
    assert.equal(judged.balanced, 2 / 5, "5 and 4 out of 10");
    assert.deepEqual(judged.tenths, [1, 0, 0, 0, 1, 1, 0, 0, 0, 2]);
    assert.ok(judged.firstInterval[0] < judged.first && judged.first < judged.firstInterval[1]);
  });
});
