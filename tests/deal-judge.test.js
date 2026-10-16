import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { judgeDeals, nearestMedian, pairedDifference, poolRuns } from "../scripts/lib/deal-judge.js";

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

describe("the first player's share when deals are replayed", () => {
  it("counts the deals, not the games, once each deal is played several times", () => {
    // Ten deals played ten times each, five always won by the first player, five always lost: 100 games, 10 deals.
    const judged = judgeDeals([10, 10, 10, 10, 10, 0, 0, 0, 0, 0], 10);
    const [low, high] = judged.firstInterval;
    assert.ok(high - low > 0.5, "ten decided deals say little, however many games they hold");
    assert.ok(low < 0.5 && high > 0.5);
  });

  it("gives a rule's effect deal by deal, on the deals both runs played", () => {
    const base = { seeds: [1, 2, 3, 4], shares: [0, 1, 0, 1] };
    const effect = pairedDifference({ seeds: [2, 3, 4, 5], shares: [1, 1, 1, 0] }, base);
    assert.equal(effect.deals, 3, "seed 5 was not in the base run");
    assert.ok(Math.abs(effect.gap - 1 / 3) < 1e-12);
    assert.ok(effect.interval[0] < effect.gap && effect.gap < effect.interval[1]);
  });

  it("reads two runs on two offsets as one, deals put together", () => {
    const pooled = poolRuns([{ seeds: [1, 2], shares: [1, 0] }, { seeds: [7, 8, 9], shares: [1, 1, 0] }]);
    assert.deepEqual([pooled.deals, pooled.first], [5, 3 / 5]);
    assert.deepEqual(pooled.seeds, [1, 2, 7, 8, 9]);
  });
});
