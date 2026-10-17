import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NO_REUSE, createReuse } from "../../src/sim/mcts/reuse.js";

/** A tree node with `visits` and the given children (key → node). */
const node = (visits, children = {}) => ({ visits, wins: 0, avail: visits, children: new Map(Object.entries(children)) });

describe("keeping the tree from one move to the next (src/sim/mcts/reuse.js, Sami 12/10)", () => {
  const reply = node(40);
  const root = node(2000, { "5@2": node(900, { "17@4": reply, pass: node(3) }) });
  const search = { tree: () => root };

  it("gives back the node under my move and their reply, two half-moves later", () => {
    const reuse = createReuse();
    const before = { turn: 10, current: 0, lastMoves: [null, { card: 30, border: 1 }] };
    assert.equal(reuse.remember(before, search), search);
    assert.deepEqual(reuse.played({ card: 5, border: 2 }), { card: 5, border: 2 });
    assert.equal(reuse.rootFor({ turn: 12, current: 0, lastMoves: [{ card: 5, border: 2 }, { card: 17, border: 4 }] }), reply);
  });

  it("reads an unchanged last move of theirs as a pass, and keeps nothing for another turn", () => {
    const reuse = createReuse();
    const theirs = { card: 30, border: 1 };
    reuse.remember({ turn: 10, current: 0, lastMoves: [null, theirs] }, search);
    reuse.played({ card: 5, border: 2 });
    assert.equal(reuse.rootFor({ turn: 12, current: 0, lastMoves: [null, { ...theirs }] }), root.children.get("5@2").children.get("pass"));
    reuse.remember({ turn: 10, current: 0, lastMoves: [null, null] }, search);
    reuse.played({ card: 5, border: 2 });
    assert.equal(reuse.rootFor({ turn: 14, current: 0, lastMoves: [null, { card: 17, border: 4 }] }), null, "not two half-moves later");
  });

  it("keeps nothing from a search it did not play from, nor when off", () => {
    const reuse = createReuse();
    reuse.played({ card: 5, border: 2 });
    assert.equal(reuse.rootFor({ turn: 2, current: 0, lastMoves: [null, null] }), null);
    assert.equal(NO_REUSE.rootFor(), null);
    assert.equal(NO_REUSE.remember({}, search), search);
  });
});
