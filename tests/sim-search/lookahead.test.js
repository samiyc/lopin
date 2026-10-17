import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { BOTS } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { cloneState, determinize, lookaheadBot } from "../../src/sim/search/lookahead.js";
import { unseenCards } from "../../src/sim/eval/potential.js";

const sorted = (cards) => [...cards].sort((a, b) => a - b);

/** A game a few moves in, so the board is not empty. */
function midGame(seed) {
  const rng = createRng(seed);
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng });
  const bot = BOTS.greedy(rng);
  for (let turn = 0; turn < 10; turn += 1) applyMove(state, bot.choose(state, legalMoves(state)));
  return state;
}

describe("looking ahead", () => {
  const state = midGame(8);
  const player = state.current;

  it("copies a game deeply enough to play on it", () => {
    const copy = cloneState(state);
    applyMove(copy, legalMoves(copy)[0]);
    assert.equal(state.turn, 10);
    assert.notDeepEqual(copy.borders, state.borders);
  });

  it("deals only the cards the player cannot see, keeping theirs and the board", () => {
    const deal = determinize(state, player, createRng(3));
    assert.deepEqual(deal.hands[player], state.hands[player]);
    assert.deepEqual(deal.borders, state.borders);
    assert.equal(deal.hands[1 - player].length, state.hands[1 - player].length);
    const hidden = unseenCards(state, player).entries.flatMap(([card, count]) => Array(count).fill(card));
    assert.deepEqual(sorted([...deal.hands[1 - player], ...deal.pile]), sorted(hidden));
  });

  it("rates its candidates by won rollouts, the same way every time", () => {
    const rng = createRng(5);
    const bot = lookaheadBot(rng, { base: BOTS.strategist(rng), policy: (seeded) => BOTS.strategist(seeded), candidates: 3, rollouts: 4, prior: 0 });
    const moves = legalMoves(state);
    const first = bot.scoreMoves(state, moves);
    assert.deepEqual(bot.scoreMoves(state, moves), first);
    const rated = first.filter((entry) => entry.gain >= 0);
    assert.equal(rated.length, 3);
    assert.ok(rated.every((entry) => entry.gain <= 1));
    assert.ok(first.filter((entry) => entry.gain < 0).length === moves.length - 3);
  });
});
