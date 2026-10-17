import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCards } from "../../src/core/notation.js";
import { unseenCards } from "../../src/sim/eval/potential.js";
import { suitBudgetBonus } from "../../src/sim/heuristics/suit-budget.js";
import { SPEC, newGame } from "../../web/app/replays/runner.js";

/**
 * Hearts almost gone: my border 1 holds 2♥ 3♥, the opponent shows 4♥ to 9♥, the 10♥ is in my hand — one heart
 * (the 1♥) is still unseen. Weight 1, so a bonus reads in cards of shortfall.
 */
function position() {
  const state = newGame(5);
  state.hands[0] = parseCards(SPEC, ["10♥", "1♠", "2♠", "3♣", "4♦", "5♦"]);
  state.borders[0].sides[0] = parseCards(SPEC, ["2♥", "3♥"]);
  state.borders[1].sides[1] = parseCards(SPEC, ["4♥", "5♥"]);
  state.borders[2].sides[1] = parseCards(SPEC, ["6♥", "7♥"]);
  state.borders[3].sides[1] = parseCards(SPEC, ["8♥", "9♥"]);
  return {
    spec: state.spec,
    mySides: state.borders.map((border) => border.sides[0]),
    owners: state.borders.map((border) => border.owner),
    hand: state.hands[0],
    unseen: unseenCards(state, 0),
    pile: state.pile.length,
    weights: { suitBudget: 1 },
    memo: new Map(),
  };
}
const card = (text) => parseCards(SPEC, [text])[0];

describe("the suit budget (suit-budget.js, Sami 14/10)", () => {
  it("penalises opening a second border on a suit that is almost gone, not one on a suit still plentiful", () => {
    const context = position();
    const heart = suitBudgetBonus(context, 4, card("10♥"));
    assert.ok(heart < -1, `a second heart border wants cards that will not come (${heart})`);
    assert.equal(suitBudgetBonus(context, 4, card("1♠")), 0, "spades: plenty left");
  });

  it("does not penalise finishing a side on the suit, and frees the need when the side is decided", () => {
    const context = position();
    assert.equal(suitBudgetBonus(context, 0, card("10♥")), 0, "the third heart on the heart side: need and supply both drop by one");
    const decided = { ...position(), owners: [1, null, null, null, null, null, null] };
    assert.ok(suitBudgetBonus(decided, 4, card("10♥")) > suitBudgetBonus(position(), 4, card("10♥")), "a decided border needs no more hearts");
  });

  it("is worked out once per scoring", () => {
    const context = position();
    suitBudgetBonus(context, 4, card("1♠"));
    assert.ok(context.memo.has("suitBudget"));
  });
});
