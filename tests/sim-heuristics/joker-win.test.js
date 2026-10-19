import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { JOKER, cardOf, isJoker } from "../../src/core/cards.js";
import { createRng } from "../../src/core/random.js";
import { strategistBot } from "../../src/sim/bots.js";
import { createGame, legalMoves } from "../../src/sim/engine/game.js";
import { coreOf } from "../../src/sim/heuristics/experimental.js";
import { jokerWinsGame } from "../../src/sim/heuristics/joker-win.js";

const spec = DECKS.classique;
const c = (color, value) => cardOf(spec, color, value);

/**
 * Player 0 to move, a joker in hand, the 10♠ 10♥ pair on border 3 (index 2) against two loose cards, borders 1-2
 * either claimed by player 0 (`owned`) or still empty; `theirs` replaces the opposing side of border 3.
 */
const OWNED = [
  [[c(0, 6), c(1, 6), c(2, 6)], [c(0, 2), c(1, 3), c(3, 9)]],
  [[c(0, 7), c(1, 7), c(2, 7)], [c(2, 2), c(1, 4), c(3, 8)]],
];

function fill(state, index, sides, owner) {
  Object.assign(state.borders[index], { sides, owner, completedAt: sides.map((side) => (side.length === 3 ? 1 : Infinity)) });
}

function position({ owned = true, mine = [c(0, 10), c(1, 10)], theirs = [c(2, 1), c(3, 5)] } = {}) {
  const state = createGame(spec, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(1), endMode: "claim-end" });
  for (const index of [0, 1]) fill(state, index, owned ? OWNED[index] : [[], []], owned ? 0 : null);
  fill(state, 2, [mine, theirs], null);
  state.hands[0] = [JOKER, c(0, 3), c(1, 8), c(2, 9), c(3, 3), c(3, 4)];
  state.current = 0;
  const seen = [...state.hands[0], ...state.borders.flatMap((border) => border.sides.flat())].filter((card) => !isJoker(card));
  assert.equal(new Set(seen).size, seen.length, "a card twice in the test position");
  return state;
}

describe("jokerWin: a joker only where it wins the game", () => {
  it("plays the joker that makes unbeatable trips and three borders in a row", () => {
    assert.equal(jokerWinsGame(position(), 0, 2), true);
  });

  it("keeps it when the border is won but the game is not", () => {
    assert.equal(jokerWinsGame(position({ owned: false }), 0, 2), false);
  });

  it("keeps it when the trips can still be beaten (a straight flush is open to them)", () => {
    assert.equal(jokerWinsGame(position({ theirs: [c(2, 4), c(2, 5)] }), 0, 2), false);
  });

  it("keeps it when the side would not be complete", () => {
    assert.equal(jokerWinsGame(position({ mine: [c(0, 10)] }), 0, 2), false);
  });

  it("the stfig6jw core offers no joker move but the winning one", () => {
    const jokers = (state) =>
      strategistBot(createRng(1), coreOf("stfig6jw"))
        .scoreMoves(state, legalMoves(state))
        .filter((entry) => isJoker(entry.move.card))
        .map((entry) => entry.move.border);
    assert.deepEqual(jokers(position()), [2]);
    assert.deepEqual(jokers(position({ owned: false })), []);
  });
});
