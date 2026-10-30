import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor, strategistBot } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { dealFor } from "../../src/sim/mcts/deal.js";
import { ismctsSettings } from "../../src/sim/mcts/ismcts.js";
import { unseenList } from "../../src/sim/search/lookahead.js";

/** A game at the page's rule, played by the strategist until the pile holds `pile` cards. */
function gameAt(pile) {
  for (let seed = 1; seed < 200; seed += 1) {
    const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(seed), endMode: "claim-end" });
    const bot = strategistBot(createRng(seed));
    while (!state.over && state.pile.length > pile) applyMove(state, bot.choose(state, legalMoves(state)));
    if (!state.over && legalMoves(state).length > 1) return state;
  }
  throw new Error("no such game");
}

describe("claimPile: the game's rule in the iterations once the pile is short", () => {
  const ctx = (state, claimPile) => ({ state, player: state.current, unseen: unseenList(state, state.current), hands: null, omniscient: false, jkHand: 0, claimPile });

  it("is read from the engine id", () => {
    assert.deepEqual(ismctsSettings("ismcts+claimPile=2"), { claimPile: 2 });
  });

  it("deals at claim-end with k cards or fewer in the pile, at final otherwise", () => {
    const short = gameAt(2);
    const long = gameAt(3);
    assert.equal(dealFor(ctx(short, 2), createRng(1)).endMode, "claim-end");
    assert.equal(dealFor(ctx(short, 0), createRng(1)).endMode, "final");
    assert.equal(dealFor(ctx(long, 2), createRng(1)).endMode, "final");
  });

  it("searches a short pile to a legal move", () => {
    const state = gameAt(1);
    const bot = engineFor("ismcts+widen=7+depth=5+core=stfig6+exact=12+claimPile=2@100")(createRng(3));
    const move = bot.choose(state, legalMoves(state));
    assert.ok(legalMoves(state).some((m) => m.card === move.card && m.border === move.border));
  });
});
