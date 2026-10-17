import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { playRecordedBatch } from "../../src/replay/core/bot-games.js";
import { PHASES, pairScores, readGame, seatOf, summarize } from "../../src/replay/oracle/versus.js";

const batch = playRecordedBatch(DECKS.classique, {
  games: 4,
  seed: 31,
  players: ["greedy", "strategist"],
  labels: ["basique@1.0", "strategist"],
  ids: { deck: "classique", jokerRule: "colorless", order: "original" },
  order: ORDERS.original,
  jokerRule: JOKER_RULES.colorless,
  deals: 400,
});

describe("two engines compared on their games", () => {
  it("reads a game from A's side, by engine id or tag", () => {
    const [log] = batch.logs;
    assert.equal(seatOf(log, "strategist"), log.players.findIndex((player) => player.bot === "strategist"));
    assert.equal(seatOf(log, "basique@1.0"), log.players.findIndex((player) => player.bot === "greedy"));
    assert.equal(readGame(log, "lookahead"), null, "an engine that did not play");
    const game = readGame(log, "strategist");
    assert.equal(game.points, log.result.winner === null ? 0.5 : Number(log.result.winner === game.seat));
    const moves = (side) => Object.values(game.sides[side].moves).reduce((sum, phase) => sum + phase.moves, 0);
    const played = (seat) => log.turns.filter((entry) => entry.player === seat && entry.move).length;
    assert.equal(moves(0), played(game.seat));
    assert.equal(moves(1), played(1 - game.seat));
    assert.ok(game.sides[0].end.noFigure <= game.sides[0].end.complete);
  });

  it("scores a deck only when it was played from both seats", () => {
    const games = [
      { deck: "x", points: 1 },
      { deck: "x", points: 0 },
      { deck: "y", points: 1 },
      { deck: "y", points: 0.5 },
      { deck: "z", points: 1 },
    ];
    assert.deepEqual(pairScores(games), [0.5, 0.75]);
  });

  it("pools the games: score, seats, jokers, every phase", () => {
    const games = batch.logs.map((log) => readGame(log, "strategist"));
    const summary = summarize(games);
    assert.equal(summary.games, 4);
    assert.equal(Object.values(summary.bySeat).reduce((sum, group) => sum + group.games, 0), 4);
    assert.deepEqual(Object.keys(summary.traits), PHASES.map(([phase]) => phase));
    for (const list of Object.values(summary.traits)) for (const t of list) assert.ok(t.a >= 0 && t.a <= 1 && t.b >= 0 && t.b <= 1);
  });
});
