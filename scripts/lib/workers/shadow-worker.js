import { parentPort } from "node:worker_threads";
import { formatCard } from "../../../src/core/notation.js";
import { createRng } from "../../../src/core/random.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { coreRanking } from "../../../src/replay/oracle/oracle.js";
import { oracleMoves, shadowRow } from "../../../src/replay/oracle/shadow.js";
import { engineFor, strategistBot } from "../../../src/sim/bots.js";
import { EXPERIMENT, coreOf } from "../../../src/sim/heuristics/experimental.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { loadGame } from "../domain/game-index.js";

/**
 * One game of the oracle read by another bot (`npm run shadow`): at each of
 * the oracle's moves, the rank its core gives the oracle's move and the move
 * its search plays (src/replay/oracle/shadow.js).
 */
const labelOf = (spec, move) => `${formatCard(spec, move.card)}→${move.border + 1}`;
/** The core of an engine id (`…+core=stfig6@800`), the 0.9's when it names none. */
const coreIn = (engine) => {
  const name = /core=(\w+)/.exec(engine)?.[1];
  return name ? coreOf(name) : EXPERIMENT;
};

parentPort.on("message", async ({ row, oracle, engine }) => {
  const log = await loadGame(row);
  const core = coreIn(engine);
  const rows = [];
  for (const move of oracleMoves(log, oracle)) {
    const state = stateAt(log, move.turn);
    const moves = legalMoves(state);
    const ranking = coreRanking(strategistBot(createRng(1), core).scoreMoves(state, moves, { keepAll: true })).map((candidate) => labelOf(state.spec, candidate));
    const searched = labelOf(state.spec, engineFor(engine)(createRng(Math.imul(row.game ?? 0, 101) + move.turn)).choose(state, moves));
    rows.push({ key: row.key, ...shadowRow(move, { coreRank: ranking.indexOf(move.move) + 1, searched }) });
  }
  parentPort.postMessage(rows);
});
