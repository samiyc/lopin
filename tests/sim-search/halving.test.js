import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { engineFor } from "../../src/sim/bots.js";
import { applyMove, createGame, legalMoves } from "../../src/sim/engine/game.js";
import { createHalving, parseHalving } from "../../src/sim/mcts/halving.js";
import { ismctsSettings } from "../../src/sim/mcts/ismcts.js";

/** Stats where candidate `i` wins `rates[i]` of its visits, counted as `pick` hands them out. */
function race(moves, rates, phases) {
  const stats = new Map(moves.map((move) => [move, { visits: 0, wins: 0 }]));
  const halving = createHalving(phases, moves);
  const statsOf = (move) => stats.get(move);
  const total = phases.reduce((sum, n) => sum + n, 0);
  for (let i = 0; i < total; i += 1) {
    const move = halving.pick(i, statsOf);
    const entry = stats.get(move);
    entry.visits += 1;
    entry.wins += rates[moves.indexOf(move)];
  }
  return { halving, stats, statsOf };
}

describe("RootHalving: the root's candidates by halving (halving.js, ismcts+halving)", () => {
  it("reads its phases", () => {
    assert.deepEqual(parseHalving("1000-500-500"), [1000, 500, 500]);
    assert.equal(parseHalving(undefined), null);
    assert.equal(parseHalving("1000-x"), null);
    assert.equal(ismctsSettings("ismcts+widen=3+halving=1000-500-500").halving, "1000-500-500");
  });

  it("shares the visits evenly: 125, then 250, then 500 for the finalists", () => {
    const moves = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const { halving, stats } = race(moves, [0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25], [1000, 500, 500]);
    assert.deepEqual(moves.map((move) => stats.get(move).visits), [500, 500, 250, 250, 125, 125, 125, 125]);
    assert.deepEqual(halving.alive(), ["a", "b"]);
  });

  it("plays the finalist with the best win rate", () => {
    const moves = ["a", "b", "c", "d"];
    const { halving, statsOf } = race(moves, [0.4, 0.7, 0.6, 0.2], [400, 200]);
    assert.deepEqual(halving.alive(), ["b", "c"]);
    assert.equal(halving.best(statsOf), "b");
  });

  it("plays a whole move in the tree", () => {
    const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, rng: createRng(4) });
    for (let i = 0; i < 6; i += 1) applyMove(state, legalMoves(state)[0]);
    const bot = engineFor("ismcts+widen=3+depth=5+core=stfig6+halving=40-20-20@80")(createRng(1));
    const move = bot.choose(state, legalMoves(state));
    assert.ok(legalMoves(state).some((legal) => legal.card === move.card && legal.border === move.border));
  });
});
