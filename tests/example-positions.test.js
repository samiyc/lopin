import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stateAt } from "../src/replay/log.js";
import { exchangeBefore, inputOf } from "../scripts/lib/example-positions.js";
import { formatJson, handOrder, jsonView, parseInput } from "../scripts/lib/cli-view.js";

const raw = readFileSync(new URL("./fixtures/replays/claim-start-of-turn.json", import.meta.url), "utf8");
const log = JSON.parse(raw);

describe("worked examples for the agents (scripts/lib/example-positions.js, Sami 13/10)", () => {
  it("turns a move label into the answer typed: « 9♦→7 » is « 9♦ 7 »", () => {
    assert.equal(inputOf("9♦→7"), "9♦ 7");
    assert.equal(inputOf("JK→3"), "JK 3");
  });

  it("rebuilds `dernier_echange` from the log: the mover's previous move, then the opponent's answer", () => {
    for (const turn of [3, 8, 15]) {
      const mover = log.turns[turn - 1].player;
      const moved = (entry) => `${entry.move.card} → borne ${entry.move.border}`;
      const { toi, robot, revendications } = exchangeBefore(log, turn, mover);
      assert.equal(toi, moved(log.turns[turn - 3]), `turn ${turn}: the mover's move before`);
      assert.equal(robot, moved(log.turns[turn - 2]), `turn ${turn}: the opponent's answer`);
      assert.ok(Array.isArray(revendications));
    }
  });

  it("says nothing of an exchange that did not happen yet (the first turns)", () => {
    assert.deepEqual(exchangeBefore(log, 1, log.turns[0].player), { toi: null, robot: null, revendications: [] });
    assert.deepEqual(exchangeBefore(log, 2, log.turns[1].player), { toi: null, robot: null, revendications: [] });
  });

  it("makes an input the agent reads, and a move that input allows", () => {
    const turn = 15;
    const state = stateAt(log, turn);
    const view = jsonView(state, state.current, { order: handOrder(state, state.current), last: exchangeBefore(log, turn, state.current) });
    const played = log.turns[turn - 1].move;
    const answer = `${played.card} ${played.border}`;
    assert.ok(view.main.includes(played.card), "the card played is in the hand shown");
    assert.ok(view.bornes_jouables.includes(played.border), "the border played is playable");
    assert.ok(parseInput(answer, state, handOrder(state, state.current)).move, "and the CLI accepts it");
    assert.deepEqual(JSON.parse(formatJson(view)), view, "the input is plain JSON");
  });
});
