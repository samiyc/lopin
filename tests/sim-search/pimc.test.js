import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { strategistBot } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { ismctsSettings } from "../../src/sim/mcts/ismcts.js";
import { dealShares, pileDeals, pimcOf, pimcRated } from "../../src/sim/mcts/pimc.js";
import { unseenList } from "../../src/sim/search/lookahead.js";

const NODES = 20_000;

/** A game played by the strategist until one card is left in the pile (seed 19: its solves are quick). */
function pileOne(seed = 19) {
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed), endMode: "claim-end" });
  const bot = strategistBot(createRng(seed));
  while (!state.over && state.pile.length > 1) {
    const moves = legalMoves(state);
    applyMove(state, moves.length > 0 ? bot.choose(state, moves) : null);
  }
  return state;
}

/** The move a rating plays: its highest gain. */
const played = (rated) => rated.reduce((a, b) => (b.gain > a.gain ? b : a)).move;

describe("EndPimc (+pimc=k)", () => {
  it("is read from an engine id", () => {
    assert.deepEqual(ismctsSettings("ismcts+exact=12+pimc=3"), { exact: 12, pimc: 3 });
  });

  it("deals every unseen card to the pile once, the rest to the opponent", () => {
    const state = pileOne();
    const deals = pileDeals(state, state.current);
    const unseen = unseenList(state, state.current);
    assert.equal(deals.length, unseen.length);
    assert.deepEqual(deals.map((deal) => deal.pile[0]).sort((a, b) => a - b), [...unseen].sort((a, b) => a - b));
    for (const deal of deals) assert.deepEqual(deal.hands[state.current], state.hands[state.current]);
  });

  it("plays the candidate that wins the most deals among the k most visited, ties to the most visited", () => {
    const state = pileOne();
    assert.equal(state.pile.length, 1);
    const moves = legalMoves(state).slice(0, 4);
    const shares = dealShares(pileDeals(state, state.current), moves, NODES);
    const loser = moves.findIndex((_, k) => shares[k] < Math.max(...shares));
    const winners = moves.map((_, k) => k).filter((k) => shares[k] === Math.max(...shares));
    assert.ok(loser >= 0 && winners.length >= 2, "the seed must give a loser and two equal winners");
    // The tree's favourite loses more deals; two winners follow it, the more visited first.
    const visits = new Map([[loser, 50], [winners[0], 30], [winners[1], 20]]);
    const rated = moves.map((move, k) => ({ move, gain: visits.get(k) ?? 0 }));
    const rerated = pimcRated(state, rated, 3, { maxNodes: NODES });
    assert.equal(played(rerated), moves[winners[0]]);
    assert.equal(rerated.find((entry) => entry.move === moves[loser]).pimc, shares[loser]);
    // With k = 1 there is nothing to choose between: the tree's move stands.
    assert.equal(pimcRated(state, rated, 1, { maxNodes: NODES }), null);
  });

  it("leaves the tree's move when the pile does not hold one card, or a solve runs past its cap", () => {
    const state = pileOne();
    const rated = legalMoves(state).map((move, k) => ({ move, gain: 10 - k }));
    assert.equal(pimcRated(state, rated, 3, { maxNodes: 1 }), null);
    const start = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(1) });
    const opening = legalMoves(start).map((move, k) => ({ move, gain: 10 - k }));
    assert.equal(pimcRated(start, opening, 3), null);
    assert.equal(pimcOf(0)(start, opening), opening);
    assert.equal(pimcOf(3)(start, opening), opening);
  });
});
