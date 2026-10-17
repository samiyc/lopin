import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { SEAT_VARIANTS } from "../../src/config/seats.js";
import { createRng } from "../../src/core/random.js";
import { playRecordedBatch } from "../../src/replay/core/bot-games.js";
import { replayStates } from "../../src/replay/core/log.js";
import { BOTS } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { determinize } from "../../src/sim/search/lookahead.js";
import { coreCounts } from "../../src/sim/engine/peek.js";
import { unseenCards } from "../../src/sim/eval/potential.js";
import { parseSeat } from "../../src/sim/engine/seat-rules.js";

const spec = DECKS.classique;
const rules = { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, endMode: "claim-end" };
const game = (seat, seed = 5) => createGame(spec, { ...rules, rng: createRng(seed), seat: parseSeat(seat) });

/** Plays `moves` greedy moves (or passes). */
function play(state, moves, seed = 9) {
  const bot = BOTS.greedy(createRng(seed));
  for (let i = 0; i < moves && !state.over; i += 1) {
    const legal = legalMoves(state);
    applyMove(state, legal.length > 0 ? bot.choose(state, legal) : null);
  }
  return state;
}

describe("seat compensations: the rules", () => {
  it("reads an id or a name, and refuses what it does not know", () => {
    assert.equal(parseSeat(null), null);
    assert.deepEqual(parseSeat("Peek1"), parseSeat(SEAT_VARIANTS.Peek1.id));
    assert.deepEqual(parseSeat("PeekTurns12"), parseSeat("peek=1+turns=12"));
    assert.deepEqual(parseSeat("PeekInPlay24"), parseSeat("peek=1+inplay=24"));
    assert.deepEqual(parseSeat("Hand7Skip2"), parseSeat("hands=7/6+skip=2"));
    assert.deepEqual(parseSeat("peek=1+turns=3").peek, { cards: 1, turns: 3, untilClaim: false, inPlay: Infinity });
    assert.deepEqual(parseSeat("hands=7/6").handSizes, [7, 6]);
    assert.equal(parseSeat("hands=7/6+skip=2").skipDraw, 2);
    assert.throws(() => parseSeat("peek=0"));
    assert.throws(() => parseSeat("turns=3"), /sans peek/);
    assert.throws(() => parseSeat("skip=1"), /sans hands/);
    assert.throws(() => parseSeat("look=1"), /inconnue/);
  });

  it("deals the hands it says, the rest in the pile", () => {
    const state = game("hands=7/6");
    assert.deepEqual(state.hands.map((hand) => hand.length), [7, 6]);
    assert.equal(state.pile.length, 42 - 13);
  });

  it("skips the first player's draw after their N-th move, and only that one", () => {
    const state = play(game("hands=7/6+skip=2"), 4);
    assert.deepEqual(state.hands.map((hand) => hand.length), [6, 6]);
    play(state, 2);
    assert.deepEqual(state.hands.map((hand) => hand.length), [6, 6]);
  });

  it("leaves the printed game alone: no knowledge, the counts the core always made", () => {
    const state = play(game(null), 7);
    assert.equal(state.known, null);
    const counts = coreCounts(state, state.current);
    assert.deepEqual(counts.unseen, unseenCards(state, state.current));
    assert.deepEqual([counts.next, counts.theirHand, counts.draws], [undefined, [], Math.ceil(state.pile.length / 2)]);
  });
});

describe("seat compensations: what the first player sees", () => {
  it("looks at the top card before every move, and draws it", () => {
    const state = game("PeekAll");
    for (let move = 0; move < 12; move += 1) {
      if (state.current === 0) {
        assert.equal(state.known[0].top, 1);
        const top = state.pile.at(-1);
        play(state, 1);
        assert.equal(state.hands[0].at(-1), top, "the card seen is the card drawn");
      } else play(state, 1);
    }
    assert.equal(state.known[1].top, 0, "the second player never looks");
  });

  it("stops after N turns, at the first claim, or once enough cards are in play", () => {
    assert.equal(play(game("peek=1+turns=2"), 2).known[0].top, 1, "second turn");
    assert.equal(play(game("peek=1+turns=2"), 4).known[0].top, 0, "third turn");
    const claimed = game("peek=1+claim=1");
    while (!claimed.borders.some((border) => border.owner !== null)) play(claimed, 1);
    while (claimed.current !== 0 && !claimed.over) play(claimed, 1);
    assert.equal(claimed.known[0].top, 0);
    assert.equal(play(game("peek=1+inplay=4"), 4).known[0].top, 0, "four cards on the table");
  });

  it("knows the card the opponent drew after a look at two, until they lay it", () => {
    const state = game("Peek2First");
    const second = state.pile.at(-2);
    play(state, 2);
    assert.deepEqual(state.known[0], { top: 0, held: [second] });
    assert.ok(state.hands[1].includes(second));
    const bot = BOTS.greedy(createRng(1));
    const lay = legalMoves(state).find((move) => move.card === second);
    applyMove(state, lay ?? bot.choose(state, legalMoves(state)));
    while (state.current !== 1) play(state, 1);
    const laid = lay ? [] : [second];
    assert.deepEqual(state.known[0].held, state.hands[1].includes(second) ? [second] : laid);
  });

  it("keeps what it saw where it is in every deal of its search, and nothing for the other seat", () => {
    // The first player drew the first card seen; the second one is the second player's next draw.
    const state = play(game("Peek2First"), 1);
    const theirs = state.pile.at(-1);
    play(state, 1);
    const rng = createRng(3);
    for (let deal = 0; deal < 20; deal += 1) {
      const copy = determinize(state, 0, rng);
      assert.ok(copy.hands[1].includes(theirs), "the card the second player drew stays in their hand");
      assert.ok(!copy.pile.includes(theirs));
    }
    const fresh = game("PeekAll");
    const next = fresh.pile.at(-1);
    for (let deal = 0; deal < 20; deal += 1) assert.equal(determinize(fresh, 0, rng).pile.at(-1), next, "the top card stays on top");
    const tops = new Set(Array.from({ length: 20 }, () => determinize(fresh, 1, rng).pile.at(-1)));
    assert.ok(tops.size > 1, "the second player saw nothing: the top is dealt at random for them");
  });

  it("counts the card it will draw as its own, and no longer as unseen", () => {
    const state = game("PeekAll");
    const next = state.pile.at(-1);
    const counts = coreCounts(state, 0);
    assert.deepEqual(counts.next, [next]);
    assert.equal(counts.unseen.total, unseenCards(state, 0).total - 1);
    assert.equal(counts.draws, Math.ceil(state.pile.length / 2) - 1);
  });
});

describe("seat compensations: kept games", () => {
  it("write the compensation into the rules, so the replay deals and draws as played", () => {
    const batch = playRecordedBatch(spec, { ...rules, games: 2, seed: 4, players: ["greedy", "greedy"], ids: { deck: "classique", jokerRule: "colorless", order: "original" }, deals: 30, seat: "hands=7/6+skip=1" });
    for (const log of batch.logs) {
      assert.equal(log.rules.seat, "hands=7/6+skip=1");
      assert.equal(replayStates(log).at(-1).state.winner, log.result.winner);
    }
  });
});
