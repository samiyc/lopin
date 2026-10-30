import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appendJobLog, enginesOf, gamesOf, jobKind, jobLine, readJobLog } from "../../scripts/lib/domain/job-log.js";

const DUEL = 'npm run duel -- "ismcts+widen=7+depth=5+core=stfig6+exact=12@400" "ismcts+widen=7+depth=5+core=stfig6+exact=12@400" --games 125 --page --offset 0';
const OUTPUT = "A contre B — 250 parties (125 de chaque côté), règle claim-end, profil 125 parties, 360.0 s";

describe("the job log: one line per job, by day or by night (scripts/lib/domain/job-log.js, Sami 22/10)", () => {
  it("reads a job's kind, a duel's engines and its games", () => {
    assert.equal(jobKind(DUEL), "duel");
    assert.equal(jobKind("npm run versus -- a b"), "versus");
    assert.equal(jobKind("node scripts/archive/endgame-moves.js --per 50"), "analysis");
    assert.equal(jobKind("npm test"), "other");
    assert.deepEqual(enginesOf(DUEL), ["ismcts+widen=7+depth=5+core=stfig6+exact=12@400", "ismcts+widen=7+depth=5+core=stfig6+exact=12@400"]);
    assert.deepEqual(enginesOf("npm run duel -- idea:middle strategist --long"), ["idea:middle", "strategist"]);
    assert.equal(enginesOf("npm run versus -- a b"), null);
    assert.equal(gamesOf(OUTPUT), 250);
    assert.equal(gamesOf("rien"), null);
  });

  it("writes a line with the minutes, the games an hour and the memory, then reads it back by month", async () => {
    const started = new Date("2026-10-22T20:00:00Z");
    const ended = new Date("2026-10-22T20:30:00Z");
    const memory = { freeGbStart: 16.2, freeGbLow: 12.4 };
    const line = jobLine({ id: "D1", command: DUEL, threads: 12, started, ended, status: "done", output: OUTPUT, memory, source: "bench" });
    assert.equal(line.kind, "duel");
    assert.equal(line.minutes, 30);
    assert.equal(line.gamesPerHour, 500);
    assert.equal(line.threads, 12);
    assert.equal(line.freeGbLow, 12.4);
    const dir = await mkdtemp(path.join(os.tmpdir(), "job-log-"));
    const root = pathToFileURL(`${dir}/`);
    try {
      await appendJobLog(line, { root });
      await appendJobLog({ ...line, id: "D2" }, { root });
      assert.deepEqual((await readJobLog({ root })).map((one) => one.id), ["D1", "D2"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
