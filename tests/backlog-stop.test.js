import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pairsOf, pooledMean, stopIfFor, stopReason } from "../scripts/lib/backlog-stop.js";

const duel = (id, mean, status = "done") => ({ id, status, output: `${id}.txt`, text: `  paires : n = 125, moyenne ${mean.toFixed(4)}, écart-type 0.3100 (donnes décalées de 1)` });
const outputOf = (job) => job.text ?? "";

describe("stopIf: a series of long duels that starts badly stops there (backlog-stop.js)", () => {
  it("reads a duel's pairs and pools several", () => {
    assert.deepEqual(pairsOf("  paires : n = 125, moyenne 0.4840, écart-type 0.3171"), { n: 125, mean: 0.484 });
    assert.equal(pairsOf("rien"), null);
    assert.equal(pooledMean([{ n: 125, mean: 0.48 }, { n: 125, mean: 0.52 }]), 0.5);
    assert.equal(pooledMean([{ n: 125, mean: 0.48 }, null]), null);
  });

  it("gives the n-th duel the rules that apply before it", () => {
    const ids = ["d1", "d2", "d3", "d4"];
    assert.deepEqual(stopIfFor(ids, 1), []);
    assert.deepEqual(stopIfFor(ids, 2), [{ after: ["d1"], below: 0.47 }]);
    assert.deepEqual(stopIfFor(ids, 3), [{ after: ["d1"], below: 0.47 }, { after: ["d1", "d2"], below: 0.5 }]);
  });

  it("cancels the third duel when the first two pool under 50 %, not when they clear it", () => {
    const third = { id: "d3", stopIf: stopIfFor(["d1", "d2", "d3", "d4"], 3) };
    assert.match(stopReason(third, [duel("d1", 0.488), duel("d2", 0.488), third], outputOf), /48,8|48\.8/);
    assert.equal(stopReason(third, [duel("d1", 0.536), duel("d2", 0.488), third], outputOf), null);
  });

  it("cancels after one duel under 47 %, and waits while the earlier duels are not done", () => {
    const second = { id: "d2", stopIf: stopIfFor(["d1", "d2"], 2) };
    assert.ok(stopReason(second, [duel("d1", 0.46), second], outputOf));
    assert.equal(stopReason(second, [duel("d1", 0.46, "todo"), second], outputOf), null);
    assert.equal(stopReason({ id: "x" }, [], outputOf), null);
  });

  it("runs exactly one branch of a choice: `atLeast` cancels the loser's job, `below` the winner's (Sami, 14/10)", () => {
    const after = ["o1", "o2"];
    const ifWins = { id: "read2", stopIf: [{ after, below: 0.5 }] };
    const ifLoses = { id: "read1", stopIf: [{ after, atLeast: 0.5 }] };
    for (const [first, second] of [[0.53, 0.51], [0.47, 0.49], [0.5, 0.5]]) {
      const jobs = [duel("o1", first), duel("o2", second), ifWins, ifLoses];
      const skipped = [ifWins, ifLoses].filter((job) => stopReason(job, jobs, outputOf) !== null);
      assert.equal(skipped.length, 1, `${first} / ${second}: one branch skipped`);
    }
    assert.match(stopReason(ifLoses, [duel("o1", 0.53), duel("o2", 0.51), ifLoses], outputOf), /52\.0 % réunis, 50 % ou plus/);
  });
});
