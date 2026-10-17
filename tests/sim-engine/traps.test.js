import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FAMILIES, familyOf } from "../../src/sim/puzzles/traps.js";

/** A move's effect on the board, as effectOf reads it: nothing special by default. */
const effect = (changes = {}) => ({ joker: false, sideBefore: 1, landsOnLost: false, lostBefore: 0, lostAfter: 0, borderLostAfter: false, fork: 0, ...changes });

describe("the endgame traps (src/sim/puzzles/traps.js, Sami 07/10)", () => {
  it("name an error by the first board rule that tells the two moves apart", () => {
    assert.equal(familyOf(effect({ joker: true }), effect()), "jokerSpent");
    assert.equal(familyOf(effect(), effect({ joker: true })), "jokerKept");
    assert.equal(familyOf(effect({ landsOnLost: true }), effect()), "deadBorder");
    assert.equal(familyOf(effect({ sideBefore: 2, borderLostAfter: true }), effect()), "completesLoser");
    assert.equal(familyOf(effect({ lostAfter: 1 }), effect()), "givesBorder");
    assert.equal(familyOf(effect(), effect({ fork: 0.5 })), "fork", "the winning move plays for a double threat");
    assert.equal(familyOf(effect({ sideBefore: 0 }), effect({ sideBefore: 1 })), "opensBorder");
  });

  it("leave to placement what the board does not tell apart", () => {
    assert.equal(familyOf(effect(), effect()), null);
    assert.equal(familyOf(effect({ lostAfter: 1 }), effect({ lostAfter: 1 })), null, "both moves lose a border");
    assert.equal(familyOf(effect({ sideBefore: 0 }), effect({ sideBefore: 0 })), null, "both open a border");
  });

  it("label every family in French", () => {
    for (const label of Object.values(FAMILIES)) assert.match(label, /\p{L}/u);
    assert.deepEqual(Object.keys(FAMILIES).slice(-3), ["wrongBorder", "wrongCard", "other"]);
  });
});
