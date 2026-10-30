import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatCard } from "../../src/core/notation.js";
import { stateAt } from "../../src/replay/core/log.js";
import { legalMoves } from "../../src/sim/engine/game.js";
import { solveEndgame } from "../../src/sim/eval/endgame.js";
import { FAMILIES, familyOf, trapOf } from "../../src/sim/puzzles/traps.js";

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

describe("trapOf on solved endgames (src/sim/puzzles/traps.js)", () => {
  const { puzzles } = JSON.parse(readFileSync(new URL("../../web/data/puzzles.json", import.meta.url), "utf8"));
  /** A small endgame puzzle, solved, with a losing and a winning move: the trap a core would fall into. */
  function smallTrap() {
    for (const puzzle of puzzles.filter((p) => p.kind !== "immediate" && p.cardsLeft <= 8)) {
      const state = stateAt(puzzle.log, puzzle.log.turns.length + 1);
      const solution = solveEndgame(state, { maxNodes: 400_000 });
      const losing = solution.moves.find((entry) => entry.value === -1);
      if (solution.complete && solution.value === 1 && losing) return { state, solution, losing: losing.move, winning: solution.moves.filter((entry) => entry.value === 1).map((entry) => entry.move) };
    }
    throw new Error("no small puzzle with a losing move");
  }
  const { state, solution, losing, winning } = smallTrap();
  const others = legalMoves(state).filter((move) => !winning.some((win) => win.card === move.card && win.border === move.border) && !(move.card === losing.card && move.border === losing.border));

  it("files the core's losing favourite against the best-ranked winning move", () => {
    const ranked = [losing, ...others, ...winning];
    const trap = trapOf(state, solution, ranked);
    assert.ok(Object.hasOwn(FAMILIES, trap.family), trap.family);
    assert.equal(trap.coreMove, `${formatCard(state.spec, losing.card)}→${losing.border + 1}`);
    assert.equal(trap.winMove, `${formatCard(state.spec, winning[0].card)}→${winning[0].border + 1}`);
    assert.equal(trap.winRank, others.length + 2);
    assert.equal(trap.moves, ranked.length);
    assert.equal(trap.winners, winning.length);
  });

  it("is no trap when the core's favourite wins, the position is not won, or no move is ranked", () => {
    assert.equal(trapOf(state, solution, [winning[0], losing]), null);
    assert.equal(trapOf(state, { ...solution, value: -1 }, [losing, winning[0]]), null);
    assert.equal(trapOf(state, solution, []), null);
    assert.equal(trapOf(state, solution, [losing, ...others]), null, "no winning move among those ranked");
  });
});
