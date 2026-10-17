import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { backlogFiles } from "../../scripts/lib/domain/backlog-files.js";

const job = (id, status, doneAt) => ({ id, command: "npm run duel", status, ...(doneAt && { doneAt }) });

/** A throwaway folder with a data/backlog.json holding `jobs`. */
async function sandbox(jobs) {
  const dir = await mkdtemp(join(tmpdir(), "lopin-backlog-"));
  await mkdir(join(dir, "data"));
  await writeFile(join(dir, "data", "backlog.json"), JSON.stringify({ note: "la file", jobs }));
  return { dir, files: backlogFiles({ root: pathToFileURL(`${dir}/`) }) };
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
});
