import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { backlogFiles, outputUrl } from "../../scripts/lib/domain/backlog-files.js";

const job = (id, status, doneAt) => ({ id, command: "npm run duel", status, ...(doneAt && { doneAt }) });

/** A throwaway folder with a data/backlog.json holding `jobs`. */
async function sandbox(jobs) {
  const dir = await mkdtemp(join(tmpdir(), "lopin-backlog-"));
  await mkdir(join(dir, "data"));
  await writeFile(join(dir, "data", "backlog.json"), JSON.stringify({ note: "la file", jobs }));
  return { dir, files: backlogFiles({ root: pathToFileURL(`${dir}/`), machineHome: null }) };
}

describe("the backlog keeps only the jobs to come, the finished ones go to data/backlog-done/ (backlog-files.js)", () => {
  it("moves every finished job to its month's file and leaves todo and scheduled in the queue", async () => {
    const { dir, files } = await sandbox([job("a", "done", "2026-10-30T23:10"), job("b", "todo"), job("c", "skipped", "2026-11-01T02:00"), job("d", "scheduled"), job("e", "timeout", "2026-11-01T04:00")]);
    try {
      assert.equal(await files.archiveFinished(), 3);
      const queue = await files.readQueue();
      assert.equal(queue.note, "la file");
      assert.deepEqual(queue.jobs.map((entry) => entry.id), ["b", "d"]);
      assert.deepEqual(await readdir(join(dir, "data", "backlog-done")), ["2026-10.json", "2026-11.json"]);
      assert.deepEqual((await files.readArchive()).map((entry) => entry.id), ["a", "c", "e"]);
      assert.equal(await files.archiveFinished(), 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("appends to a month already archived, without doubling a job a stopped run left in both places", async () => {
    const { dir, files } = await sandbox([job("a", "done", "2026-10-02T01:00")]);
    try {
      await files.archiveFinished();
      await files.saveQueue({ jobs: [job("a", "done", "2026-10-02T01:00"), job("b", "failed", "2026-10-03T01:00")] });
      await files.archiveFinished();
      const month = JSON.parse(await readFile(join(dir, "data", "backlog-done", "2026-10.json"), "utf8"));
      assert.deepEqual(month.jobs.map((entry) => entry.id), ["a", "b"]);
      assert.deepEqual((await files.readQueue()).jobs, []);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reads lopin's jobs in the machine's archive too, after its own, their outputs absolute (mcts-backlog, Sami 26/10)", async () => {
    const { dir } = await sandbox([]);
    const home = await mkdtemp(join(tmpdir(), "machine-"));
    try {
      await mkdir(join(dir, "data", "backlog-done"));
      await writeFile(join(dir, "data", "backlog-done", "2026-10.json"), JSON.stringify({ jobs: [job("old", "done", "2026-10-20T01:00")] }));
      await mkdir(join(home, "done"));
      const elsewhere = { ...job("cuisine", "done", "2026-10-26T22:00"), cwd: join(tmpdir(), "mcts-cuisine") };
      const duel = { ...job("DUEL_1", "done", "2026-10-26T23:00"), cwd: `${dir}/`, output: join("runs", "2026-10-26-22-00_DUEL_1.txt") };
      await writeFile(join(home, "done", "2026-10.json"), JSON.stringify([elsewhere, duel]));
      const archive = await backlogFiles({ root: pathToFileURL(`${dir}/`), machineHome: home }).readArchive();
      assert.deepEqual(archive.map((entry) => entry.id), ["old", "DUEL_1"]);
      assert.equal(archive[1].output, join(home, "runs", "2026-10-26-22-00_DUEL_1.txt"));
      assert.equal(fileURLToPath(outputUrl(archive[1])), archive[1].output);
      assert.equal(fileURLToPath(outputUrl({ output: "backlog-runs/x.txt" }, pathToFileURL(`${dir}/`))), join(dir, "backlog-runs", "x.txt"));
    } finally {
      await rm(dir, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
    }
  });
});
