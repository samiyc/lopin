import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { BOTS, engineFor } from "../../src/sim/bots.js";
import { partBudget } from "../../src/sim/mcts/choice.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { rootStats, snapshotTree } from "../../src/sim/mcts/tree-snapshot.js";
import { joinLab, joinProgress, joinReplies } from "../../web/app/workers/think-join.js";

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

  it("adds the workers' trees up for the Labo as the ensemble adds its scores", () => {
    const engine = "ismcts+widen=7+depth=5+core=stfig6+exact=12+trees=2@60";
    const labOf = (part) => {
      const bot = engineFor(engine)(createRng(7));
      const search = bot.searchFor(state, moves, {}, { part });
      while (!search.done() && search.rollouts() < partBudget(60, 2, part)) search.step();
      return { root: rootStats(search.tree(), search.candidates(), search.core()), trees: [{ snapshot: snapshotTree(search.tree()) }] };
    };
    const replies = [0, 1].map((part) => ({ ...workerReply(engine, state, moves, { part, workers: 2 }), lab: labOf(part) }));
    const joined = joinReplies(replies);
    assert.equal(joined.lab.trees.length, 2);
    assert.equal(joined.lab.root.reduce((sum, entry) => sum + entry.visits, 0), 60);
    const best = joined.lab.root.reduce((a, b) => (b.visits > a.visits ? b : a));
    assert.equal(best.key, `${joined.move.card}@${joined.move.border}`);
    const progress = joinProgress([{ rollouts: 10, elapsedMs: 250, root: replies[0].lab.root }, { rollouts: 12, elapsedMs: 260, root: replies[1].lab.root }]);
    assert.deepEqual([progress.rollouts, progress.elapsedMs], [22, 260]);
    assert.deepEqual(joinLab([{ exact: true }, { exact: true }]), { exact: true });
  });

  it("takes the first worker's answer for a position it did not search", () => {
    const solved = { type: "move", move: moves[0], scored: [{ move: moves[0], gain: 1 }], rollouts: 0, thoughtMs: 3, pondered: 0 };
    assert.equal(joinReplies([solved, { ...solved, thoughtMs: 9 }]), solved);
  });
});
