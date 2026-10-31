import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { machineJob, minThreadsOf } from "../../scripts/lib/domain/machine-job.js";

describe("a lopin job handed to the machine's queue", () => {
  it("may start on two thirds of its threads when fewer are free (mcts-backlog's --min-threads, 31/10)", () => {
    assert.deepEqual([18, 9, 6, 4, 1].map(minThreadsOf), [12, 6, 4, 3, 1]);
    const job = machineJob({ id: "VALIDATE_LONG_1_X", command: "npm run duel -- a b" }, 18);
    assert.equal(job.threads, 18);
    assert.equal(job.minThreads, 12);
    assert.equal(job.limit, 120);
    assert.ok(job.minThreads >= 1 && job.minThreads <= job.threads, "mcts-backlog refuses anything else");
  });

  it("keeps a job's own threads, floor, limit, and its stopIf as a skipIf", () => {
    const job = machineJob({ id: "J", command: "c", threads: 6, minThreads: 6, limit: 30, stopIf: [{ duel: "A", below: 0.47 }] }, 18);
    assert.deepEqual([job.threads, job.minThreads, job.limit, job.skipIf], [6, 6, 30, "node scripts/stop-check.js J"]);
  });
});
