import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { ORDERS } from "../../src/config/formations.js";
import { balancedGames, playRecordedBatch } from "../../src/replay/core/bot-games.js";
import { branchFrom, reproduces } from "../../src/replay/core/branch.js";
import { TURNING_TURN, gameKey } from "../../src/replay/core/game-analysis.js";
import { formatCard } from "../../src/core/notation.js";
import { replayStates, stateAt } from "../../src/replay/core/log.js";
import { legalMoves } from "../../src/sim/engine/game.js";

const spec = DECKS.classique;
const batch = playRecordedBatch(spec, {
  games: 6,
  seed: 11,
  players: ["greedy", "strategist"],
  labels: ["basique@1.0.0", "strategist"],
  ids: { deck: "classique", jokerRule: "colorless", order: "original" },
  order: ORDERS.original,
  jokerRule: JOKER_RULES.colorless,
  deals: 400,
  endMode: "claim-end",
});

describe("duels kept as replays", () => {
  it("log every game, replayable to its end with the same result", () => {
    assert.equal(batch.logs.length, 6);
    assert.equal(batch.wins[0] + batch.wins[1] + batch.draws, 6);
    for (const log of batch.logs) {
      const frames = replayStates(log);
      assert.equal(frames.at(-1).state.winner, log.result.winner);
      assert.deepEqual(log.players.map((player) => player.version), ["basique@1.0.0", "strategist"]);
    }
  });

  it("name who holds the game once the pile is empty, by exact play", () => {
    for (const log of batch.logs) {
      const { advantage, handClasses } = log.analysis;
      assert.equal(handClasses.length, 2);
      if (advantage.ended) continue;
      assert.equal(stateAt(log, TURNING_TURN + 1).pile.length, 0);
      assert.ok([1, 0, -1].includes(advantage.value));
      assert.ok(advantage.winner === null || advantage.winner === 0 || advantage.winner === 1);
    }
  });

  it("keep only games where both starting hands are medium, when asked", () => {
    for (const log of balancedGames(batch.logs)) assert.deepEqual(log.analysis.handClasses, ["medium", "medium"]);
  });
});

describe("kept games restart from any turn", () => {
  const tree = playRecordedBatch(spec, {
    games: 2,
    seed: 21,
    players: ["ismcts@30", "ismcts@30"],
    ids: { deck: "classique", jokerRule: "colorless", order: "original" },
    order: ORDERS.original,
    jokerRule: JOKER_RULES.colorless,
    deals: 900,
    endMode: "claim-end",
  });

  it("note the turning points: seven borders started, first border won", () => {
    for (const log of tree.logs) {
      const { columns, firstBorder } = log.analysis;
      assert.equal(columns.length, 2);
      for (const turn of columns) assert.ok(turn === null || (turn >= 7 && turn <= log.turns.length));
      assert.ok(firstBorder === null || [0, 1].includes(firstBorder.seat));
    }
  });

  it("key a game by its rules, deck, players and seed", () => {
    const [a, b] = tree.logs;
    assert.equal(gameKey(a), gameKey(structuredClone(a)));
    assert.notEqual(gameKey(a), gameKey(b));
  });

  it("replay unchanged move for move, and differently after a forced error", () => {
    for (const log of tree.logs) {
      assert.ok(reproduces(log, 12), "the same bots, built again from the seed, play the same moves");
      const { moves } = branchFrom(log, 12, { force: "random", until: 13 });
      const logged = log.turns[11].move;
      assert.ok(moves[0].border !== logged.border - 1 || formatCard(spec, moves[0].card) !== logged.card, "the forced move is another move");
    }
  });

  it("start from a move given, then let the game's bots play on", () => {
    const [log] = tree.logs;
    const [move] = legalMoves(stateAt(log, 12)).slice(-1);
    const { moves } = branchFrom(log, 12, { force: move, until: 13 });
    assert.deepEqual(moves[0], move);
    assert.equal(moves.length, 2, "one move forced, then one played by the bot to move");
  });
});
