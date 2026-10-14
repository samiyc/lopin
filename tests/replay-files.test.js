import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { REPLAY_DIRS, isReplayDir, isSafeName, replayFileName, replayHeader, scoreTag } from "../scripts/lib/replay-files.js";

const log = {
  startedAt: "2026-09-24T10:15:30.123Z",
  players: [
    { seat: 1, kind: "bot", bot: "stratege", version: "1.0.0" },
    { seat: 0, kind: "human", name: "Sami" },
  ],
  turns: [{}, {}],
  result: { winner: 0, winType: "adjacent" },
};

describe("replay file names", () => {
  it("are dated and name both seats, first player first", () => {
    assert.equal(replayFileName(log), "2026-09-24_10-15-30_sami-vs-stratege.json");
  });

  it("end with the score once the game is over, B for three adjacent borders", () => {
    const borders = (...winners) => winners.map((winner) => ({ winner }));
    const finished = { ...log, result: { winner: 0, winType: "majority", borders: borders(0, 1, 0, 0, 1, 1, 0) } };
    assert.equal(replayFileName(finished), "2026-09-24_10-15-30_sami-vs-stratege_4-3.json");
    assert.equal(scoreTag({ winner: 0, winType: "majority", borders: borders(0, 0, 1, 0, 0, 1, 0) }), "5-2");
    assert.equal(scoreTag({ winner: 0, winType: "adjacent", borders: borders(0, 0, 0, 1, 0, 1, 1) }), "B-3");
    assert.equal(scoreTag({ winner: 1, winType: "adjacent", borders: borders(0, 1, 1, 1, 0, 1, 0) }), "3-B");
    assert.equal(scoreTag(null), "");
    assert.ok(isSafeName(replayFileName(finished)));
  });

  it("are safe to serve and nothing else is", () => {
    assert.ok(isSafeName(replayFileName(log)));
    for (const bad of ["../package.json", "a/b.json", "..json", "x.txt", "", "x.json/..", null]) {
      assert.equal(isSafeName(bad), false, String(bad));
    }
  });

  it("live in two known folders only", () => {
    assert.deepEqual(REPLAY_DIRS, { recent: "replays", kept: "data/replays" });
    assert.ok(isReplayDir("kept"));
    assert.ok(!isReplayDir("../src"));
    assert.ok(!isReplayDir("toString"));
  });

  it("list with a small header, not the whole log", () => {
    assert.deepEqual(replayHeader("recent", "x.json", log), {
      dir: "recent",
      name: "x.json",
      startedAt: log.startedAt,
      players: log.players,
      turns: 2,
      winner: 0,
      winType: "adjacent",
      borders: null,
      durationMs: null,
      bonus: 0,
      client: null,
    });
    assert.equal(replayHeader("recent", "x.json", { ...log, client: { app: "cli", mode: "interactive" } }).client, "cli", "a game played in the terminal says so");
    const withBonus = { ...log, rules: { bonus: 6 } };
    assert.equal(replayHeader("recent", "x.json", withBonus).bonus, 6);
    const withDeckFigures = { ...log, deck: ["1♠", "V♣", "D♥", "2♠"] };
    assert.equal(replayHeader("recent", "x.json", withDeckFigures).bonus, 2);
  });

  it("count the borders and the time played, the clock first, the wall clock else", () => {
    const borders = [0, 1, 0, 0, 1, 1, 0].map((winner) => ({ winner }));
    const timed = { ...log, endedAt: "2026-09-24T10:35:30.123Z", result: { winner: 0, winType: "majority", borders, activeMs: 1260000 } };
    assert.deepEqual(replayHeader("recent", "x.json", timed).borders, [4, 3]);
    assert.equal(replayHeader("recent", "x.json", timed).durationMs, 1260000);
    const older = { ...timed, result: { ...timed.result, activeMs: undefined } };
    assert.equal(replayHeader("recent", "x.json", older).durationMs, 1200000);
  });
});
