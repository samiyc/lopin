import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fitElo, resultsFromLogs } from "../../src/replay/stats/elo.js";

describe("Elo ratings", () => {
  it("place a 76 % winner about 200 points above, and chain through a common opponent", () => {
    const ratings = fitElo(
      [
        { a: "B", b: "A", score: 760, games: 1000 },
        { a: "C", b: "B", score: 760, games: 1000 },
      ],
      { anchor: "A" },
    );
    assert.equal(ratings.A.elo, 500);
    assert.ok(Math.abs(ratings.B.elo - 700) < 15, `B ${ratings.B.elo}`);
    assert.ok(Math.abs(ratings.C.elo - 900) < 25, `C ${ratings.C.elo}`);
    assert.ok(ratings.C.margin > ratings.B.margin, "further from the anchor, less certain");
  });

  it("keep a player with a single won game finite", () => {
    const ratings = fitElo([{ a: "lucky", b: "A", score: 1, games: 1 }], { anchor: "A" });
    assert.ok(Number.isFinite(ratings.lucky.elo) && ratings.lucky.elo < 900);
  });

  it("read human results from replay logs, old three-number versions and new ones as one player", () => {
    const log = (winner, version = "2.1") => ({ players: [{ seat: 0, kind: "human", name: "Sami" }, { seat: 1, kind: "bot", bot: "stratege", version }], result: { winner } });
    assert.deepEqual(resultsFromLogs([log(0, "2.1.0"), log(1), log(null)]), [{ a: "Sami", b: "stratege@2.1", score: 1.5, games: 3 }]);
  });
});
