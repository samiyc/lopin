import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_THREADS, defaultThreads, threadsFrom } from "../../scripts/lib/cli/pool.js";

describe("the worker threads (scripts/lib/cli/pool.js, Sami 07/10)", () => {
  it("take half the cores up to 6, every core but 3 above, 18 at most", () => {
    const cases = { 1: 1, 2: 1, 4: 2, 6: 3, 8: 5, 10: 7, 12: 9, 16: 13, 24: 18, 64: MAX_THREADS };
    for (const [cores, threads] of Object.entries(cases)) assert.equal(defaultThreads(Number(cores)), threads, `${cores} cores`);
  });

  it("follow LOPIN_THREADS: a count, max for every core but one, the default otherwise", () => {
    assert.equal(threadsFrom("4", 24), 4);
    assert.equal(threadsFrom("max", 24), 23);
    assert.equal(threadsFrom("max", 1), 1);
    assert.equal(threadsFrom(undefined, 24), 18);
    assert.equal(threadsFrom("0", 8), 5);
  });
});
