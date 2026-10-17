import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { againstBase, bancVerdict, judge, mergedVisits, pairedDiff, rankCorrelation, referenceOf, summarizeBanc, valueOf } from "../../src/replay/oracle/banc.js";

const entry = (turn, first, second) => ({ turn, visits: [first, second] });
const sure = entry(15, [{ move: "a", share: 0.6 }, { move: "b", share: 0.3 }], [{ move: "a", share: 0.5 }, { move: "b", share: 0.4 }]);
const torn = entry(5, [{ move: "a", share: 0.12 }, { move: "b", share: 0.1 }], [{ move: "b", share: 0.11 }, { move: "a", share: 0.1 }]);

describe("the similarity bench", () => {
  it("adds both searches up and finds the oracle's favourite", () => {
    const shares = mergedVisits(sure);
    assert.ok(Math.abs(shares.get("a") - 0.55) < 1e-12);
    assert.ok(Math.abs(shares.get("b") - 0.35) < 1e-12);
    assert.deepEqual([referenceOf(sure).best, referenceOf(sure).stable], ["a", true]);
    assert.equal(referenceOf(torn).stable, false, "its two searches chose differently");
  });

  it("values a move by its visits over the favourite's: a near choice costs little, a move outside the 12 nothing", () => {
    const reference = referenceOf(torn);
    assert.equal(valueOf(reference, reference.best), 1);
    assert.ok(valueOf(reference, reference.best === "a" ? "b" : "a") > 0.9, "early, two moves the oracle hesitated between are worth about the same");
    assert.equal(valueOf(reference, "z"), 0);
    assert.ok(Math.abs(valueOf(referenceOf(sure), "b") - 0.35 / 0.55) < 1e-12);
  });

  it("judges a version's move, the agreement counted on stable positions only", () => {
    const rows = [judge(sure, { move: "a", coreTop: ["a"] }), judge(torn, { move: "z", coreTop: [] })];
    assert.deepEqual(rows.map((row) => [row.agrees, row.top8]), [[true, true], [false, false]]);
    const summary = summarizeBanc(rows);
    assert.equal(summary.positions, 2);
    assert.equal(summary.agrees, 1, "the torn position does not count for agreement");
    assert.equal(summary.value, 0.5);
    assert.deepEqual(summary.phases.map((phase) => phase.positions), [1, 1, 0]);
  });

  it("compares two versions position by position", () => {
    const same = [{ value: 1 }, { value: 0.5 }, { value: 0 }];
    assert.deepEqual([pairedDiff(same, same).mean, pairedDiff(same, same).differ], [0, 0]);
    assert.equal(bancVerdict(pairedDiff(same, same)), "neutre");
    const better = Array.from({ length: 200 }, (_, i) => ({ value: i % 4 === 0 ? 1 : 0.5 }));
    const worse = better.map(() => ({ value: 0.5 }));
    const gap = pairedDiff(better, worse);
    assert.ok(gap.mean > 0.1 && gap.low > 0);
    assert.equal(bancVerdict(gap), "à pousser");
    assert.equal(bancVerdict(pairedDiff(worse, better)), "à écarter");
  });

  it("ranks like the duels or not, and brings a score against the 1.0 to the 0.9's scale", () => {
    assert.equal(rankCorrelation([1, 2, 3, 4], [10, 20, 30, 40]), 1);
    assert.equal(rankCorrelation([1, 2, 3, 4], [40, 30, 20, 10]), -1);
    assert.ok(Math.abs(againstBase(0.5, 0.56) - 0.56) < 1e-12, "even with the 1.0 is the 1.0's own score");
    assert.ok(againstBase(0.4, 0.56) < 0.5 && againstBase(0.4, 0.56) > 0.4);
  });
});
