import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readSlots, takeSlot } from "../../scripts/lib/cli/machine-slots.js";

describe("the machine's slots, shared with mcts-commun's runner (scripts/lib/cli/machine-slots.js, Sami 23/10)", () => {
  it("lends threads while they fit, runs a job bigger than the budget alone, forgets dead processes", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "slots-"));
    // mcts-backlog's two single-thread measures, then lopin's 18-thread duel waits for them.
    const measures = [await takeSlot({ home, id: "ent-sami", threads: 1, budget: 18, runner: "mcts-backlog" }), await takeSlot({ home, id: "cuisine", threads: 1, budget: 18, runner: "mcts-backlog" })];
    assert.equal(await takeSlot({ home, id: "duel", threads: 18, budget: 18 }), null);
    for (const slot of measures) await slot.release();
    const duel = await takeSlot({ home, id: "duel", threads: 18, budget: 18 });
    assert.ok(duel);
    assert.deepEqual((await readSlots(home)).map((slot) => [slot.id, slot.runner, slot.threads]), [["duel", "lopin", 18]]);
    assert.equal(await takeSlot({ home, id: "other", threads: 1, budget: 18 }), null, "18 fils pris");
    await duel.release();
    assert.ok(await takeSlot({ home, id: "ghost", threads: 18, budget: 18, pid: 2 ** 22 + 4321 }));
    assert.ok(await takeSlot({ home, id: "after-ghost", threads: 18, budget: 18 }), "un processus mort ne compte pas");
    await rm(home, { recursive: true, force: true });
  });
});
