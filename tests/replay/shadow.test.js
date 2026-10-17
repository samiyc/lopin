import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { playRecordedBatch } from "../../src/replay/core/bot-games.js";
import { stateAt } from "../../src/replay/core/log.js";
import { oracleMoves, shadowRow, shareOf, summarizeShadow } from "../../src/replay/oracle/shadow.js";
import { engineFor } from "../../src/sim/bots.js";
import { legalMoves } from "../../src/sim/engine/game.js";

const SEARCH = "ismcts+widen=3+depth=5@40";
const batch = playRecordedBatch(DECKS.classique, {
  games: 2,
  seed: 17,
  players: [SEARCH, "greedy"],
  ids: { deck: "classique", jokerRule: "colorless", order: "original" },
  order: ORDERS.original,
  jokerRule: JOKER_RULES.colorless,
  deals: 400,
});

describe("the oracle's games read by another bot", () => {
  it("keeps a search's candidates in the replay, and nothing for a bot without scores", () => {
    const [log] = batch.logs;
    const search = log.players.find((player) => player.bot === SEARCH).seat;
    const kept = log.turns.filter((entry) => entry.move && entry.candidates);
    assert.ok(kept.length > 0);
    assert.ok(kept.every((entry) => entry.player === search));
    // The move played is the candidate with the most visits.
    for (const entry of kept) assert.equal(entry.candidates[0].card, entry.move.card);
  });

  it("picks the move it would choose", () => {
    const [log] = batch.logs;
    const state = stateAt(log, 6);
    const moves = legalMoves(state);
    const picked = engineFor(SEARCH)(createRng(5)).pick(state, moves);
    assert.deepEqual(picked.move, engineFor(SEARCH)(createRng(5)).choose(state, moves));
    assert.ok(picked.scored.length > 1);
  });

  it("reads the oracle's moves from its seats only", () => {
    const [log] = batch.logs;
    const moves = oracleMoves(log, SEARCH);
    assert.ok(moves.length > 0);
    assert.deepEqual(oracleMoves(log, "lookahead"), []);
    assert.ok(moves.every((move) => move.candidates.some((candidate) => candidate.move === move.move)));
  });

  it("weighs the V1's move by the oracle's visits", () => {
    const candidates = [{ move: "a", gain: 60 }, { move: "b", gain: 30 }, { move: "c", gain: 10 }];
    assert.equal(shareOf(candidates, "b"), 0.3);
    assert.equal(shareOf(candidates, "z"), 0);
    const oracle = { turn: 6, move: "a", candidates };
    assert.deepEqual(shadowRow(oracle, { coreRank: 4, searched: "b" }), { turn: 6, move: "a", searched: "b", coreRank: 4, agrees: false, lost: 0.6 - 0.3 });
    assert.equal(shadowRow(oracle, { coreRank: 1, searched: "a" }).lost, 0);
  });

  it("sums up by group of turns, the clearest disagreements first", () => {
    const rows = [
      { turn: 2, agrees: true, coreRank: 1, lost: 0 },
      { turn: 3, agrees: false, coreRank: 9, lost: 0.5 },
      { turn: 14, agrees: false, coreRank: 2, lost: 0.1 },
    ];
    const summary = summarizeShadow(rows);
    assert.deepEqual(summary.groups.map((group) => [group.turns, group.moves]), [["1-4", 2], ["13-16", 1]]);
    assert.equal(summary.groups[0].agrees, 0.5);
    assert.equal(summary.groups[0].core8, 0.5);
    assert.deepEqual(summary.clearest.map((row) => row.turn), [3, 14]);
  });
});
