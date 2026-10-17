import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { cardOf } from "../../src/core/cards.js";
import { createRng } from "../../src/core/random.js";
import { BOTS } from "../../src/sim/bots.js";
import { STATUS, boardStatus, borderStatus } from "../../src/sim/eval/certainty.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";

const spec = DECKS.classique;
const newGame = (seed) => createGame(spec, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, endMode: "final", rng: createRng(seed) });

/** A whole game, with every won or lost claim made along the way. */
function claimsOverGame(seed) {
  const state = newGame(seed);
  const rng = createRng(seed + 1000);
  const bots = [BOTS.random(rng), BOTS.greedy(rng)];
  const said = [];
  while (!state.over) {
    for (const player of [0, 1]) {
      boardStatus(state, player).forEach((status, border) => {
        if (status !== STATUS.open) said.push({ player, border, status, turn: state.turn });
      });
    }
    const moves = legalMoves(state);
    applyMove(state, moves.length ? bots[state.current].choose(state, moves) : null);
  }
  return { state, said };
}

describe("certain borders", () => {
  it("never claim what the end of the game contradicts, over 60 whole games", () => {
    let claims = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const { state, said } = claimsOverGame(seed);
      for (const { player, border, status, turn } of said) {
        const owner = state.borders[border].owner;
        assert.equal(owner === player ? STATUS.won : STATUS.lost, status, `game ${seed}, turn ${turn}, border ${border + 1}`);
        claims += 1;
      }
    }
    assert.ok(claims > 500, `only ${claims} claims were checked`);
  });

  it("see a complete straight flush as won against an empty side, and an open border as open", () => {
    const state = newGame(3);
    const top = [cardOf(spec, 0, 10), cardOf(spec, 0, 9), cardOf(spec, 0, 8)];
    state.borders[0].sides[0] = top;
    state.borders[0].completedAt[0] = 0;
    for (const card of top) {
      for (const holder of [state.pile, ...state.hands]) {
        const at = holder.indexOf(card);
        if (at !== -1) holder.splice(at, 1);
      }
    }
    assert.equal(borderStatus(state, 0, 0), STATUS.won, "10-9-8 of spades cannot be beaten");
    assert.equal(borderStatus(state, 0, 1), STATUS.lost);
    assert.equal(borderStatus(state, 1, 0), STATUS.open);
  });
});

describe("the search, pruned by certainties", () => {
  it("keeps one candidate at most for a border already lost", async () => {
    const { engineFor } = await import("../../src/sim/bots.js");
    const state = newGame(5);
    // Seat 1 finishes border 1 with the best straight flush there is; seat 0 is to move.
    const top = [cardOf(spec, 0, 10), cardOf(spec, 0, 9), cardOf(spec, 0, 8)];
    for (const card of top) {
      for (const holder of [state.pile, ...state.hands]) {
        const at = holder.indexOf(card);
        if (at !== -1) holder.splice(at, 1);
      }
    }
    state.borders[0].sides[1] = top;
    state.borders[0].completedAt[1] = 0;
    assert.equal(borderStatus(state, 0, 0), STATUS.lost);
    const bot = engineFor("experimental:40")(createRng(2));
    const moves = legalMoves(state);
    assert.ok(moves.filter((move) => move.border === 0).length > 1, "several cards could go there");
    const searched = bot.scoreMoves(state, moves).filter((entry) => entry.rollouts > 0);
    assert.ok(searched.filter(({ move }) => move.border === 0).length <= 1);
  });
});
