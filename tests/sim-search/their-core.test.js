import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bySeat } from "../../src/sim/mcts/their-core.js";

describe("theirs: the searcher's opponent played by another core", () => {
  const policy = (name) => ({ name, choose: () => name, scoreMoves: () => [name] });

  it("asks each seat's own policy", () => {
    const seats = bySeat(policy("mine"), policy("theirs"), 0);
    assert.equal(seats.choose({ current: 0 }, []), "mine");
    assert.equal(seats.choose({ current: 1 }, []), "theirs");
    assert.deepEqual(seats.scoreMoves({ current: 1 }, []), ["theirs"]);
  });

  it("is the plain policy when off", () => {
    const mine = policy("mine");
    assert.equal(bySeat(mine, undefined, 0), mine);
  });
});
