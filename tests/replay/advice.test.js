import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { adviseMove, createAdvisor } from "../../src/replay/stats/advice.js";
import { stateAt } from "../../src/replay/core/log.js";

const dir = new URL("../fixtures/replays/", import.meta.url);
const log = JSON.parse(readFileSync(new URL(readdirSync(dir).find((name) => name.endsWith(".json")), dir), "utf8"));

describe("the Stratège 2.1's opinion on a human move", () => {
  it("judges the move played on the same endgames as its own best moves", () => {
    const entry = log.turns.find((turn) => turn.move && !turn.candidates && !turn.joker);
    const opinion = adviseMove(createAdvisor(), stateAt(log, entry.turn), entry);
    assert.ok(opinion.advice.length >= 4 && opinion.advice.length <= 5);
    assert.ok(opinion.playedRate >= 0 && opinion.playedRate <= 1);
    assert.ok(opinion.advice.some((c) => c.card === entry.move.card && c.border === entry.move.border), "the move played is among the judged");
    assert.ok(Math.abs(opinion.adviceGap - Math.max(0, opinion.advice[0].gain - opinion.playedRate)) < 1e-3);
  });
});
