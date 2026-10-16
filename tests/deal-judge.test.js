import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { judgeDeals } from "../scripts/lib/deal-judge.js";
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
