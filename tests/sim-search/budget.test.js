import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LATE_TURN, SMART, createBudget } from "../../src/sim/mcts/budget.js";

/** A stand-in search: each step gives one visit to a root move, by `share` (the leader's part of the visits). */
function fakeSearch(share) {
  const visits = [0, 0];
  let steps = 0;
  return {
    done: () => false,
    step() {
      steps += 1;
      visits[Math.floor(steps * share) > Math.floor((steps - 1) * share) ? 0 : 1] += 1;
    },
    rollouts: () => steps,
    scored: () => visits.map((gain) => ({ gain })),
  };
}

describe("the search budget", () => {
  it("spends the plain budget by default, whatever the turn", () => {
    const { run, usage } = createBudget({ budget: 400 });
    assert.equal(run(fakeSearch(0.5), 3).rollouts(), 400);
    assert.equal(run(fakeSearch(0.5), 25).rollouts(), 400);
    assert.deepEqual(usage, { moves: 2, iterations: 800 });
  });

  it("moves budget from before the late turn to after it", () => {
    const { run } = createBudget({ budget: 400, late: 2, early: 0.5 });
    assert.equal(run(fakeSearch(0.5), LATE_TURN - 1).rollouts(), 200);
    assert.equal(run(fakeSearch(0.5), LATE_TURN).rollouts(), 800);
  });

  it("stops a settled move early, and lends what it saved to a close call", () => {
    const { run, usage } = createBudget({ budget: 800, smart: 1 });
    const clear = run(fakeSearch(0.95), 10).rollouts();
    assert.ok(clear >= SMART.min && clear < 800, `a clear leader stops at ${clear}`);
    const close = run(fakeSearch(0.5), 12).rollouts();
    assert.ok(close > 800 && close <= 800 + (800 - clear), `a close call draws on the reserve: ${close}`);
    assert.equal(usage.iterations, clear + close);
  });
});
