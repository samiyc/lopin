import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { statsOf } from "../../src/replay/stats/stats.js";

const log = ({ seat, winner, borders = [], activeMs, thinkMs }) => ({
  players: [
    { seat, kind: "human", name: "Sami" },
    { seat: 1 - seat, kind: "bot", bot: "experimental", version: "0.6.0" },
  ],
  turns: thinkMs === undefined ? [] : [{ player: seat, thinkMs }, { player: 1 - seat }],
  result: { winner, borders, activeMs },
});

describe("the stats tab", () => {
  const stats = statsOf([
    log({ seat: 0, winner: 0, activeMs: 300000, thinkMs: 20000, borders: [{ winner: 0, formations: ["straightFlush", "flush"] }, { winner: 1, formations: ["sum", "threeOfAKind"] }] }),
    log({ seat: 1, winner: 0 }),
    log({ seat: 1, winner: 1 }),
  ]);

  it("counts games and wins by seat against each bot version", () => {
    const [line] = stats.lines;
    assert.equal(line.opponent, "experimental@0.6");
    assert.deepEqual([line.games, line.won], [3, 2]);
    assert.deepEqual(line.first, { games: 1, won: 1 });
    assert.deepEqual(line.second, { games: 2, won: 1 });
    assert.deepEqual([line.timedGames, line.activeMs, line.timedMoves, line.thinkMs], [1, 300000, 1, 20000]);
  });

  it("counts the formation that won each border, for the human and for the bots", () => {
    assert.equal(stats.formations.human.straightFlush, 1);
    assert.equal(stats.formations.bot.threeOfAKind, 1);
    assert.equal(stats.formations.bot.sum, 0);
  });
});
