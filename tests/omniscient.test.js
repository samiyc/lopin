import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../src/config/decks.js";
import { ORDERS } from "../src/config/formations.js";
import { createRng } from "../src/core/random.js";
import { BOTS, engineFor } from "../src/sim/bots.js";
import { exactApplies } from "../src/sim/exact.js";
import { applyMove, createGame, legalMoves } from "../src/sim/game.js";
import { cloneState, seeAll } from "../src/sim/lookahead.js";

/** A game a few moves in, under the claim rule. */
function position() {
  const rng = createRng(17);
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng, endMode: "claim-end" });
  const bot = BOTS.greedy(rng);
  for (let turn = 0; turn < 10; turn += 1) applyMove(state, bot.choose(state, legalMoves(state)));
  return state;
}

/** The same position for the player to move, the opponent's first card swapped with the pile's first. */
function swapped(state) {
  const copy = cloneState(state);
  const opponent = 1 - state.current;
  [copy.hands[opponent][0], copy.pile[0]] = [copy.pile[0], copy.hands[opponent][0]];
  return copy;
}

const keyed = (scored) => scored.map(({ move, gain }) => `${move.card}@${move.border}:${gain}`).join(" ");
const search = (engine, state) => engineFor(engine)(createRng(3)).scoreMoves(state, legalMoves(state));

describe("Omniscient 1.0: the true deal, both hands and the pile seen", () => {
  const state = position();

  it("plays every iteration on the game as it is", () => {
    const seen = seeAll(state, createRng(1));
    assert.deepEqual(seen.hands, state.hands);
    assert.deepEqual(seen.pile, state.pile);
    assert.equal(seen.endMode, "final", "rollouts settle borders at the end, as from a deal");
  });

  it("hands its solver the pile too: hands and pile counted together, since the draws are known", () => {
    const late = { hands: [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]], pile: [11, 12, 13] };
    assert.equal(exactApplies(late, 12), false, "the pile hidden, the solver waits for it to be empty");
    assert.equal(exactApplies(late, 12, true), false, "13 cards left");
    assert.equal(exactApplies(late, 13, true), true);
    assert.equal(exactApplies({ ...late, pile: [] }, 12), true);
  });

  it("tells apart two positions the bot cannot: the opponent's hand and the pile it sees", () => {
    const other = swapped(state);
    const plain = "ismcts+widen=7+depth=5+core=stfig6@120";
    assert.equal(keyed(search(plain, state)), keyed(search(plain, other)), "without it, the search sees the same thing");
    const omniscient = `${plain.replace("@", "+omniscient=1@")}`;
    assert.notEqual(keyed(search(omniscient, state)), keyed(search(omniscient, other)));
  });
});
