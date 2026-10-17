import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROFILES, duelVerdict, isSlowEngine, pairedInterval, pointsOf } from "../../scripts/lib/domain/duel-plan.js";

describe("duel plans", () => {
  it("tell the searching engines from the fast ones", () => {
    assert.ok(isSlowEngine("lookahead"));
    assert.ok(isSlowEngine("experimental:400"));
    assert.ok(!isSlowEngine("strategist"));
    assert.ok(!isSlowEngine("idea:middle"));
  });

  it("keep the quick profile quick, and the long one longer", () => {
    for (const scale of ["fast", "slow"]) assert.ok(PROFILES.quick[scale].max < PROFILES.long[scale].max);
  });

  it("stop early only once the minimum is played and the result is clear", () => {
    assert.equal(duelVerdict({ wins: 70, games: 50, min: 100, max: 400 }).stop, false, "too early");
    const clear = duelVerdict({ wins: 280, games: 200, min: 100, max: 400 });
    assert.ok(clear.stop && clear.clear && clear.low > 0.5);
    const even = duelVerdict({ wins: 204, games: 200, min: 100, max: 400 });
    assert.equal(even.stop, false);
    const capped = duelVerdict({ wins: 408, games: 400, min: 100, max: 400 });
    assert.ok(capped.stop && !capped.clear && capped.low < 0.5);
    assert.ok(duelVerdict({ wins: 40, games: 30, min: 100, max: 400, outOfTime: true }).stop, "the clock stops it too");
    for (const name of ["quick", "long"]) assert.ok(PROFILES[name].seconds <= 1200);
  });

  it("measure by deck pairs: shared pairs carry no luck, and the interval is centred on the mean", () => {
    assert.deepEqual(pairedInterval(Array(50).fill(0.5)), [0.5, 0.5], "every pair shared: nothing to doubt");
    assert.deepEqual(pairedInterval(Array(50).fill(1)), [1, 1]);
    const [low, high] = pairedInterval([...Array(30).fill(1), ...Array(20).fill(0.5), ...Array(10).fill(0)]);
    assert.ok(low > 0.5 && high < 1 && Math.abs((low + high) / 2 - 40 / 60) < 1e-9);
    assert.deepEqual(pairedInterval([1]), [0, 1], "one pair says nothing");
  });

  it("count the points of a game from the seat A sat in", () => {
    assert.equal(pointsOf(0, 0), 1);
    assert.equal(pointsOf(1, 0), 0);
    assert.equal(pointsOf(null, 1), 0.5);
  });

  it("decide on the pairs when they are given, and keep Wilson's beside them", () => {
    const pairs = Array(100).fill(0.5);
    const verdict = duelVerdict({ wins: 100, games: 100, min: 50, max: 400, pairs, outOfTime: true });
    assert.deepEqual([verdict.low, verdict.high], [0.5, 0.5]);
    assert.ok(verdict.wilson[0] < 0.45 && verdict.wilson[1] > 0.55, "game by game, the same duel looks uncertain");
    assert.equal(PROFILES.screen.seconds, 600);
  });
});
