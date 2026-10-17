import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { BOTS, engineFor } from "../../src/sim/bots.js";
import { partBudget } from "../../src/sim/mcts/choice.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { joinReplies } from "../../web/app/workers/think-join.js";

/** A game a few moves in. */
function position() {
  const rng = createRng(33);
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng });
  const bot = BOTS.greedy(rng);
  for (let turn = 0; turn < 8; turn += 1) applyMove(state, bot.choose(state, legalMoves(state)));
  return state;
}

/** What worker `part` of `workers` answers (`think-worker.js`): its tree alone, its share of the iterations. */
function workerReply(engine, state, moves, { part, workers }) {
  const bot = engineFor(engine)(createRng(7));
  const search = bot.searchFor(state, moves, {}, { part });
  const share = partBudget(Number(engine.split("@")[1]), workers, part);
  while (!search.done() && search.rollouts() < share) search.step();
  return { type: "move", move: search.best(), scored: search.scored(), rollouts: search.rollouts(), thoughtMs: 1, pondered: 0 };
}

const keyed = (scored) => scored.map(({ move, gain }) => `${move.card}@${move.border}:${gain}`);

describe("an ensemble searched one tree per worker", () => {
  const state = position();
  const moves = legalMoves(state);

  for (const [trees, budget] of [
    [2, 60],
    [3, 61],
  ]) {
    it(`plays the duels' move: ${trees} trees, ${budget} iterations`, () => {
      const engine = `ismcts+widen=7+depth=5+core=stfig6+exact=12+trees=${trees}@${budget}`;
      const bot = engineFor(engine)(createRng(7));
      const whole = bot.scoreMoves(state, moves);
      const joined = joinReplies(Array.from({ length: trees }, (_, part) => workerReply(engine, state, moves, { part, workers: trees })));
      assert.deepEqual(keyed(joined.scored), keyed(whole));
      assert.deepEqual(joined.move, bot.choose(state, moves));
      assert.equal(joined.rollouts, budget);
    });
  }

  it("shares the iterations as the ensemble steps its trees in turn", () => {
    assert.deepEqual([0, 1].map((part) => partBudget(10000, 2, part)), [5000, 5000]);
    assert.deepEqual([0, 1, 2].map((part) => partBudget(10000, 3, part)), [3334, 3333, 3333]);
  });

  it("takes the first worker's answer for a position it did not search", () => {
    const solved = { type: "move", move: moves[0], scored: [{ move: moves[0], gain: 1 }], rollouts: 0, thoughtMs: 3, pondered: 0 };
    assert.equal(joinReplies([solved, { ...solved, thoughtMs: 9 }]), solved);
  });
});
