import { parentPort } from "node:worker_threads";
import { TURNING_TURN, branchFrom, holderAt } from "../../../src/replay/core/branch.js";
import { rulesOf } from "../../../src/replay/core/log.js";
import { confirmVerdict, meanOf, moveOfLabel, movesToConfirm, pointsFor } from "../../../src/replay/oracle/oracle.js";
import { loadGame } from "../domain/game-index.js";

/**
 * One gap of the oracle played out (`npm run oracle -- --confirm`): from its
 * position, each move of `movesToConfirm` is forced, then the game's own bots
 * (the 0.9 on both sides) play on from `seeds` seeds; the exact solver says
 * at turn 30 who holds the game. Returns each move's mean for the mover and
 * the oracle's lead over the core's favourite and over the 0.9's move.
 */
parentPort.on("message", async ({ entry, seeds }) => {
  const started = Date.now();
  const log = await loadGame(entry);
  const { spec } = rulesOf(log.rules);
  const until = entry.turn <= TURNING_TURN ? TURNING_TURN : Infinity;
  const means = {};
  for (const label of movesToConfirm(entry)) {
    const force = moveOfLabel(spec, label);
    const points = [];
    for (let reseed = 1; reseed <= seeds; reseed += 1) {
      const holder = holderAt(branchFrom(log, entry.turn, { force, reseed, until }));
      const value = pointsFor(holder, entry.mover);
      if (value !== null) points.push(value);
    }
    means[label] = meanOf(points);
  }
  parentPort.postMessage({
    key: entry.key,
    turn: entry.turn,
    at: entry.at ?? "tours fixes",
    rank: entry.rank,
    margin: entry.share - entry.runnerUp,
    playedIsOracle: entry.played === entry.move,
    means,
    ...confirmVerdict(entry, means),
    seeds,
    ms: Date.now() - started,
  });
});
