import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { placeDecision, quantiles, rankIn } from "../../src/replay/stats/tree-norms.js";
import { JUDGES, judgeSummary, solverSummary } from "../../web/app/lab/judges.js";
import { analysisCommands } from "../../web/app/lab/lab-text.js";

const root = (key, visits, rate) => {
  const [card, border] = key.split("@").map(Number);
  return { key, move: { card, border }, visits, rate };
};

describe("the judges (judges.js)", () => {
  it("names the oracles and the omniscient with their engines", () => {
    assert.deepEqual(JUDGES.map((judge) => judge.id), ["oracle-light", "oracle3", "omniscient"]);
    assert.match(JUDGES[1].engine, /depth=10.*@20000$/);
    assert.match(JUDGES[2].engine, /omniscient=1/);
  });

  it("reads a tree's reply against the move played", () => {
    const reply = { move: { card: 4, border: 1 }, lab: { root: [root("1@0", 300, 0.5), root("4@1", 600, 0.62), root("7@3", 100, 0.4)] } };
    const summary = judgeSummary(reply, { card: 1, border: 0 });
    assert.equal(summary.same, false);
    assert.deepEqual([summary.best.move, summary.best.share], [{ card: 4, border: 1 }, 0.6]);
    assert.deepEqual([summary.played.rank, summary.played.share, summary.played.rate], [2, 0.3, 0.5]);
    assert.equal(judgeSummary(reply, { card: 9, border: 6 }).played, null, "a move off its candidates");
  });

  it("reads a solved reply: the played move's value, the moves proved winning", () => {
    const scored = [{ move: { card: 1, border: 0 }, gain: 1.04, exact: true }, { move: { card: 2, border: 0 }, gain: -0.97, exact: true }, { move: { card: 3, border: 0 }, gain: -2.9, exact: false }];
    const reply = { move: { card: 1, border: 0 }, scored, lab: { exact: true } };
    assert.deepEqual(judgeSummary(reply, { card: 2, border: 0 }).exact, { played: -1, winning: 1 });
    assert.equal(judgeSummary(reply, { card: 3, border: 0 }).exact.played, null, "not examined past the first win");
  });

  it("reads the solver's verdict on every move", () => {
    const moves = [{ card: "7♥", border: 3, value: 1 }, { card: "2♠", border: 1, value: 0 }, { card: "9♣", border: 5, value: -1 }];
    assert.deepEqual(solverSummary(moves, { card: "9♣", border: 5 }), { played: -1, best: 1, winning: [moves[0]], drawing: 1, moves: 3 });
  });
});

describe("« Déjà rencontré » (tree-norms.js)", () => {
  it("keeps quantiles and places a value among them", () => {
    const points = quantiles(Array.from({ length: 101 }, (_, k) => k / 100));
    assert.equal(points.length, 21);
    assert.deepEqual([points[0], points[10], points[20]], [0, 0.5, 1]);
    assert.ok(Math.abs(rankIn(points, 0.3) - 0.3) < 1e-9);
    assert.deepEqual([rankIn(points, -1), rankIn(points, 2)], [0, 1]);
  });

  it("says how a decision's tree compares with the 1.2's of its turn", () => {
    const even = quantiles(Array.from({ length: 101 }, (_, k) => k / 100));
    const norms = { turns: { 18: { moves: 500, top: even, flat: even } } };
    const lab = { root: [root("1@0", 200, 0.5), root("2@0", 800, 0.5)], trees: [{ levels: [{}, { nodes: 100, one: 70 }] }] };
    const place = placeDecision(lab, norms, 18);
    assert.equal(place.top, 0.8);
    assert.ok(Math.abs(place.hesitates - 0.2) < 1e-9, "80 % of the visits on the favourite: more uncertain than 20 %");
    assert.ok(Math.abs(place.flatter - 0.7) < 1e-9);
    assert.equal(placeDecision(lab, norms, 3), null);
  });
});

describe("« Garder pour analyse » (lab-text.js)", () => {
  it("gives the position's command, and the duel when both seats are bots", () => {
    const commands = analysisCommands({ path: "replays/x.json", turn: 12, mover: 1, engines: ["A@400", "B@400"], oracle: "O@10000" });
    assert.deepEqual(commands, ['npm run position -- "replays/x.json" 12 --engine "B@400" --engine "O@10000"', 'npm run duel -- "A@400" "B@400" --long --page']);
    assert.equal(analysisCommands({ path: null, turn: 3, mover: 0, engines: [null, "B@400"], oracle: "O" }).length, 1);
  });
});
