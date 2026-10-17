import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jokersOf } from "../../src/replay/core/jokers-held.js";

const rules = { deck: "classique", jokerRule: "colorless", order: "original", endMode: "claim-end" };
const deck = ["1♠", "JK", "3♠", "4♠", "5♠", "6♠", "1♥", "2♥", "3♥", "4♥", "5♥", "6♥", "JK"];

describe("the jokers each player got", () => {
  it("counts the starting hands from the deal and the draws from the log", () => {
    const turns = [
      { player: 0, drew: "7♠" },
      { player: 1, drew: "JK" },
      { player: 0, pass: true },
    ];
    assert.deepEqual(jokersOf({ rules, deck, turns }), { start: [1, 0], drawn: [0, 1], total: [1, 1] });
  });
});
