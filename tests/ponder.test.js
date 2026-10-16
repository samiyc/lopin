import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../src/config/decks.js";
import { ORDERS } from "../src/config/formations.js";
import { createRng } from "../src/core/random.js";
import { BOTS, engineFor } from "../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../src/sim/game.js";
import { cloneState } from "../src/sim/lookahead.js";
import { createPonder } from "../src/sim/ponder.js";

/** A game a few moves in, the human (seat 0) to move. */
function position() {
  const rng = createRng(21);
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng });
  const bot = BOTS.greedy(rng);
  for (let turn = 0; turn < 6; turn += 1) applyMove(state, bot.choose(state, legalMoves(state)));
  return state;
}

it("only the flat search takes pondering's head start, so the page ponders for it alone", () => {
  assert.equal(engineFor("experimental:50")(createRng(1)).warms, true);
  assert.equal(engineFor("ismcts+widen=7+depth=5+core=stfig6+exact=12@2000")(createRng(1)).warms, undefined);
});

describe("thinking during the human's turn", () => {
  const state = position();
  const bot = engineFor("experimental:50")(createRng(4));
  const counting = () => {
    let clock = 0;
    return () => (clock += 1);
  };

  it("searches the bot's replies without looking at the human's real hand", () => {
    const run = (game) => {
      const ponder = createPonder(game, bot, { now: counting() });
      ponder.work(60);
      return [...ponder.take().warm];
    };
    const other = cloneState(state);
    other.hands[0] = [...other.hands[0]].reverse().map((card, i) => (i === 0 ? other.pile[0] : card));
    assert.deepEqual(run(other), run(state), "another human hand, the same pondering");
  });

  it("hands the real search a head start and the time it took", () => {
    const ponder = createPonder(state, bot, { now: counting() });
    ponder.work(100);
    const { warm, spentMs } = ponder.take();
    assert.ok(warm.size > 0 && spentMs >= 100);
    const after = cloneState(state);
    applyMove(after, legalMoves(after)[0]);
    const moves = legalMoves(after);
    const cold = bot.searchFor(after, moves, {});
    const warmed = bot.searchFor(after, moves, {}, { warm });
    const started = (search) => search.scored().filter((entry) => entry.rollouts > 0).length;
    assert.equal(started(cold), 0);
    assert.ok(started(warmed) > 0, "some candidates start with pondered rollouts");
  });

  it("stops once the time allowed is spent", () => {
    const ponder = createPonder(state, bot, { now: counting(), limitMs: 30 });
    assert.equal(ponder.work(1000), false);
  });
});
