import { parentPort } from "node:worker_threads";
import { createRng } from "../../../src/core/random.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { strategistBot } from "../../../src/sim/bots.js";
import { solveEndgame } from "../../../src/sim/eval/endgame.js";
import { coreOf } from "../../../src/sim/heuristics/experimental.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { trapOf } from "../../../src/sim/puzzles/traps.js";

/**
 * Trap hunting (src/sim/puzzles/traps.js): each endgame given (`log`, `turn`) is
 * solved exactly, then the core of the 1.1's rollouts ranks its moves. A won
 * position where the core's favourite loses is a trap; the others are only
 * counted, to give the core's error rate.
 */
// The core judged: the 1.1's by default, another to compare (`--core`), set by the first task.
let core = null;
// A solve's memory grows with its positions: past this many, the endgame is left out as too deep
// (07/10: unbounded, 18 threads of 12-card solves took 11 GB).
const MAX_NODES = 400_000;

function examine(log, turn) {
  const state = stateAt(log, turn);
  const moves = legalMoves(state);
  if (state.pile.length > 0 || state.over || moves.length < 2) return { won: false, trap: null };
  const solution = solveEndgame(state, { maxNodes: MAX_NODES });
  if (!solution.complete) return { won: false, trap: null, tooDeep: true };
  if (solution.value !== 1) return { won: false, trap: null };
  const ranked = core.scoreMoves(state, moves, { keepAll: true }).sort((a, b) => b.gain - a.gain).map(({ move }) => move);
  return { won: true, trap: trapOf(state, solution, ranked) };
}

/** One game's endgame turns, added to `result`. */
function examineGame({ ref, log, turns }, result) {
  for (const turn of turns) {
    const { won, trap, tooDeep } = examine(log, turn);
    result.examined += 1;
    if (tooDeep) result.tooDeep += 1;
    if (won) result.won += 1;
    if (trap) result.traps.push({ ...ref, turn, ...trap });
  }
}

parentPort.on("message", ({ items, until, coreName }) => {
  core ??= strategistBot(createRng(1), coreOf(coreName));
  const result = { examined: 0, won: 0, tooDeep: 0, traps: [] };
  for (const item of items) {
    if (Date.now() > until) break;
    examineGame(item, result);
  }
  parentPort.postMessage(result);
});
