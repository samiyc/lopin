import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clusteredInterval, emptyTally, endTable, phaseSplit, rowsOf, tallyGame } from "../../scripts/lib/domain/seat-tally.js";

const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/replays/${name}`, import.meta.url), "utf8"));

describe("the seat advantage read in kept games", () => {
  it("keeps the trees at 2 000 iterations and more, at the page's rule, and tells the 1.2's family apart", () => {
    const row = (engine, endMode = "claim-end") => ({ endMode, engines: [engine, engine] });
    const rows = [row("ismcts+widen=7+depth=5+core=stfig6+exact=12@2000"), row("ismcts+widen=3+depth=5@2000"), row("ismcts+widen=3+depth=5@800"), row("ismcts+widen=3+depth=5@t2000"), row("ismcts+widen=3+depth=5@2000", "final")];
    assert.equal(rowsOf(rows, "trees").length, 2);
    assert.equal(rowsOf(rows, "exact12").length, 1);
    assert.equal(rowsOf(rows, "older").length, 1);
  });

  it("splits the first player's points between the games over early, the position at move 30 and the play after", () => {
    const rows = [
      { winner: 1, advantage: { ended: true } },
      { winner: 0, advantage: { ended: false, value: 1, winner: 0, toMove: 0 } },
      { winner: 1, advantage: { ended: false, value: 1, winner: 0, toMove: 0 } },
      { winner: 1, advantage: { ended: false, value: -1, winner: 1, toMove: 0 } },
    ];
    const split = phaseSplit(rows);
    assert.equal(split.first, 1 / 4);
    assert.deepEqual([split.early.games, split.early.first, split.early.points], [1, 0, 0.5 / 4]);
    assert.equal(split.position.first, 2 / 3, "the solver gives the first player two of the three");
    assert.equal(split.play.first, 1 / 3);
    assert.deepEqual(split.play.thrown, [1, 0], "the first player lost one won endgame");
    assert.ok(Math.abs(split.early.points + split.position.points + split.play.points - (0.5 - split.first)) < 1e-12, "the phases add up to the gap");
  });

  it("counts every border settled, once, with its opener and how it was decided", () => {
    const log = fixture("2026-09-24_11-28-41_sami-vs-stratege_B-3.json");
    const tally = tallyGame(emptyTally(), log);
    const settled = log.result.borders.length;
    assert.equal(tally.opened[0] + tally.opened[1], settled);
    const decided = Object.values(tally.decidedBy).reduce((sum, [zero, one]) => sum + zero + one, 0);
    assert.equal(decided, settled);
    assert.equal(tally.winsOn.own[log.result.winner] + tally.winsOn.theirs[log.result.winner], 1);
    assert.deepEqual([...tally.ends.keys()], [log.turns.length]);
  });

  it("counts a deal played twice once in the interval", () => {
    const apart = clusteredInterval([{ games: 1, firstWins: 1 }, { games: 1, firstWins: 1 }, { games: 1, firstWins: 0 }, { games: 1, firstWins: 0 }]);
    const together = clusteredInterval([{ games: 2, firstWins: 2 }, { games: 2, firstWins: 0 }]);
    assert.equal(apart.share, 0.5);
    assert.equal(together.share, 0.5);
    assert.ok(together.high - together.low > apart.high - apart.low, "two mirrored deals say less than four deals");
  });

  it("gives the hazard of an end at each move among the games still running", () => {
    const table = endTable(new Map([[31, { games: 1, firstWins: 1 }], [30, { games: 3, firstWins: 0 }]]));
    assert.deepEqual(table.map((row) => [row.turns, row.mover, row.hazard]), [[30, 1, 3 / 4], [31, 0, 1]]);
  });
});
