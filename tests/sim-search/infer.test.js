import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { createReader, inferredHands, pickHand } from "../../src/sim/search/infer.js";
import { determinize, withoutCards } from "../../src/sim/search/lookahead.js";
import { unseenCards } from "../../src/sim/eval/potential.js";

const freshGame = (seed) => createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed) });
const hiddenOf = (state, player) => unseenCards(state, player).entries.flatMap(([card, count]) => Array.from({ length: count }, () => card));
/** A move on border `n` (one border per move, so none fills up and is claimed: a claimed border's move is not read). */
const spread = (state, n) => legalMoves(state).find((move) => move.border === n) ?? legalMoves(state)[0];
const sorted = (cards) => [...cards].sort((a, b) => a - b);

/** A judge that likes one card above all: the opponent who held it and played something else did not hold it. */
const fondOf = (card) => ({ scoreMoves: (position, moves) => moves.map((move) => ({ move, gain: move.card === card ? 1 : 0 })) });

describe("guessing the opponent's hand (infer.js, ismcts+infer)", () => {
  it("deals a given hand to the opponent and the rest of the unseen cards to the pile", () => {
    const state = freshGame(7);
    const hidden = hiddenOf(state, 0);
    const hand = hidden.slice(3, 3 + state.hands[1].length);
    const game = determinize(state, 0, createRng(1), hand);
    assert.deepEqual(game.hands[1], hand);
    assert.deepEqual(sorted([...game.hands[1], ...game.pile]), sorted(hidden));
    assert.deepEqual(sorted(withoutCards([1, 2, 2, 3], [2, 3])), [1, 2]);
  });

  it("reads nothing before the opponent has moved", () => {
    assert.equal(inferredHands(freshGame(8), fondOf(0), createRng(1), { size: 16 }), null);
  });

  it("weighs the hands: one that holds the card the opponent would have played is unlikely", () => {
    const state = freshGame(9);
    const opening = legalMoves(state)[0];
    applyMove(state, opening);
    const reply = legalMoves(state).find((move) => move.card !== opening.card);
    applyMove(state, reply);
    const unseen = hiddenOf(state, 0).filter((card) => card !== reply.card);
    const tempting = unseen[0];
    const pool = inferredHands(state, fondOf(tempting), createRng(2), { size: 64 });
    assert.ok(pool, "a pool of hands");
    assert.ok(Math.abs(pool.at(-1).upTo - 1) < 1e-9);
    const draws = Array.from({ length: 400 }, (_, i) => pickHand(pool, createRng(100 + i)));
    const holding = draws.filter((hand) => hand.includes(tempting)).length / draws.length;
    assert.ok(holding < 0.05, `${holding}`);
    assert.ok(draws.every((hand) => hand.length === state.hands[1].length));
  });

  it("remembers the opponent's moves, each with the cards they played after it (memory)", () => {
    const state = freshGame(11);
    const reader = createReader();
    const played = [];
    for (let move = 0; move < 6; move += 1) {
      if (state.current === 0) reader.observe(state);
      const next = spread(state, move);
      if (state.current === 1) played.push(next.card);
      applyMove(state, next);
    }
    reader.observe(state);
    const readings = reader.readings(3);
    assert.equal(readings.length, 3);
    assert.deepEqual(readings.map(({ move }) => move.card), played);
    assert.deepEqual(readings[0].later, played.slice(1));
    assert.deepEqual(readings.at(-1).later, []);
    assert.equal(reader.readings(1).length, 1);
  });

  it("reads several moves: a hand that explains all of them is preferred", () => {
    const state = freshGame(12);
    const reader = createReader();
    for (let move = 0; move < 6; move += 1) {
      if (state.current === 0) reader.observe(state);
      applyMove(state, spread(state, move));
    }
    reader.observe(state);
    const tempting = hiddenOf(state, 0)[0];
    const pool = inferredHands(state, fondOf(tempting), createRng(3), { size: 64, readings: reader.readings(3) });
    assert.ok(pool);
    const holding = Array.from({ length: 200 }, (_, i) => pickHand(pool, createRng(300 + i))).filter((hand) => hand.includes(tempting)).length;
    assert.ok(holding < 10, `${holding}`);
  });
});
