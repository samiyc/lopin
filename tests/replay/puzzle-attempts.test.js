import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { closeAttempt, createAttempt, isAttempt, noteMove, noteReveal, resultOf, summarize } from "../../src/replay/stats/puzzle-attempts.js";

const begin = (id = 7) => createAttempt({ id }, "2026-10-07T10:00:00.000Z");

describe("puzzle attempts (src/replay/stats/puzzle-attempts.js, Sami 07/10)", () => {
  it("call an attempt solved only without slip nor reveal", () => {
    const clean = begin();
    noteMove(clean, { move: "5♣→7", thinkMs: 9000, winning: true });
    assert.equal(resultOf(clean, true), "solved");
    const slipped = begin();
    noteMove(slipped, { move: "2♦→3", thinkMs: 4000, winning: false, winners: ["5♣→7"] });
    assert.equal(slipped.slips, 1);
    assert.equal(resultOf(slipped, true), "helped");
    const revealed = begin();
    noteReveal(revealed, 12000);
    noteReveal(revealed, 20000);
    assert.equal(revealed.revealedAtMs, 12000, "the first reveal counts");
    assert.equal(resultOf(revealed, true), "helped");
  });

  it("tell a lost attempt from one left, after a move or before any", () => {
    const left = begin();
    assert.equal(resultOf(left, undefined), "skipped");
    noteMove(left, { move: "5♣→7", thinkMs: 1000, winning: true });
    assert.equal(resultOf(left, undefined), "abandoned");
    assert.equal(resultOf(left, false), "lost");
  });

  it("close into a record the server accepts, and nothing else", () => {
    const closed = closeAttempt(begin(), true, 41_234.6);
    assert.equal(closed.activeMs, 41_235);
    assert.ok(isAttempt(closed));
    assert.ok(!isAttempt({ ...closed, result: "won" }));
    assert.ok(!isAttempt({ ...closed, id: "7" }));
    assert.ok(!isAttempt({ ...closed, format: "lopin-replay/1" }));
    assert.ok(!isAttempt(null));
  });

  it("sum up per puzzle: attempts, solved alone, best time when solved alone", () => {
    const solvedIn = (ms) => closeAttempt(begin(), true, ms);
    const lost = closeAttempt(begin(), false, 5000);
    const other = closeAttempt(begin(9), undefined, 0);
    const summary = summarize([solvedIn(60_000), lost, solvedIn(42_000), other]);
    assert.deepEqual(summary[7], { attempts: 3, solved: 2, bestMs: 42_000, lastSlips: 0 });
    assert.deepEqual(summary[9], { attempts: 1, solved: 0, bestMs: null, lastSlips: 0 });
  });
});
