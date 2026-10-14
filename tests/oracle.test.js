import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../src/config/decks.js";
import { ORDERS } from "../src/config/formations.js";
import { createRng } from "../src/core/random.js";
import { ORACLE, ORACLES, oracleOf, confirmVerdict, coreRanking, favouriteOf, meanAndHalf, moveOfLabel, movesToConfirm, needsSecondRun, pointsFor, rankOf, verdictOf } from "../src/replay/oracle.js";
import { BOTS, engineFor } from "../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../src/sim/game.js";

const m = (card, border) => ({ card, border });

describe("the oracles by version (Sami, 14/10)", () => {
  it("keeps Oracle1 frozen, names a known engine for each version, and refuses an unknown one", () => {
    assert.equal(oracleOf(), ORACLE, "version 1 by default, the frozen one");
    assert.equal(ORACLE.engine, "ismcts+candidates=99+widen=6+depth=5+smart=1");
    for (const [version, oracle] of Object.entries(ORACLES)) {
      assert.equal(oracle.version, Number(version));
      assert.ok(engineFor(`${oracle.engine}@${oracle.budget}`), `version ${version}: a known engine`);
    }
    assert.equal(oracleOf(3).engine, "ismcts+widen=7+depth=10+core=stfig6+exact=12+pw=1", "Oracle3 is the deep oracle, Depth10Pw");
    assert.throws(() => oracleOf(9), /Oracle inconnu/);
  });
});

describe("the oracle", () => {
  it("ranks the core's moves, those its habits refuse last", () => {
    const ranking = coreRanking([{ move: m(1, 0), gain: 0.1 }, { move: m(2, 0), gain: 0.9, refused: true }, { move: m(3, 1), gain: 0.5 }]);
    assert.deepEqual(ranking, [m(3, 1), m(1, 0), m(2, 0)]);
    assert.equal(rankOf(ranking, m(2, 0)), 3);
  });

  it("calls a gap only when both runs agree on a move outside the core's top 3", () => {
    const ranking = [m(1, 0), m(2, 0), m(3, 0), m(4, 0), m(5, 0)];
    const runOn = (move) => [{ move, gain: 600 }, { move: m(1, 0), gain: 400 }];
    assert.equal(favouriteOf(runOn(m(5, 0))).share, 0.6);
    const agreed = verdictOf(ranking, [runOn(m(5, 0)), runOn(m(5, 0))]);
    assert.equal(agreed.gap, true);
    assert.equal(agreed.rank, 5);
    assert.equal(verdictOf(ranking, [runOn(m(5, 0)), runOn(m(4, 0))]).gap, false);
    assert.equal(verdictOf(ranking, [runOn(m(2, 0)), runOn(m(2, 0))]).gap, false);
    assert.equal(verdictOf(ranking, [runOn(m(5, 0))]).stable, null, "one run alone confirms nothing");
    assert.equal(verdictOf(ranking, [runOn(m(5, 0))]).gap, false);
  });

  it("asks for a second run only when the first leaves the core's top 3", () => {
    const ranking = [m(1, 0), m(2, 0), m(3, 0), m(4, 0)];
    assert.equal(needsSecondRun(ranking, [{ move: m(4, 0), gain: 9 }, { move: m(1, 0), gain: 1 }]), true);
    assert.equal(needsSecondRun(ranking, [{ move: m(2, 0), gain: 9 }, { move: m(4, 0), gain: 1 }]), false);
  });

  it("searches every legal move at the root", () => {
    const rng = createRng(4);
    const bots = [BOTS.strategist(rng), BOTS.strategist(rng)];
    const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng, endMode: "claim-end" });
    while (state.turn < 6) applyMove(state, bots[state.current].choose(state, legalMoves(state)));
    const moves = legalMoves(state);
    const scored = engineFor(`${ORACLE.engine}@${moves.length * 3}`)(createRng(1)).scoreMoves(state, moves, { keepAll: true });
    assert.ok(moves.length > ORACLE.shortlist);
    assert.equal(scored.length, moves.length);
  });

  it("reads its move labels back, and plays each move of a gap once", () => {
    assert.deepEqual(moveOfLabel(DECKS.classique, "7♥→1"), { card: 16, border: 0 });
    assert.equal(moveOfLabel(DECKS.classique, "JK→3").border, 2);
    assert.deepEqual(movesToConfirm({ move: "a", core: ["b", "c"], played: "b" }), ["a", "b"]);
    assert.deepEqual(movesToConfirm({ move: "a", core: ["b"], played: "c" }), ["a", "b", "c"]);
  });

  it("weighs a gap by what each move holds at turn 30", () => {
    assert.equal(pointsFor(1, 1), 1);
    assert.equal(pointsFor(0, 1), 0);
    assert.equal(pointsFor(null, 1), 0.5);
    assert.equal(pointsFor(undefined, 1), null);
    const entry = { move: "a", core: ["b"], played: "a" };
    assert.deepEqual(confirmVerdict(entry, { a: 0.75, b: 0.25 }), { vsCore: 0.5, vsPlayed: null });
    const { mean, count } = meanAndHalf([0.5, -0.5, 0.25]);
    assert.equal(count, 3);
    assert.ok(Math.abs(mean - 1 / 12) < 1e-12);
  });
});
