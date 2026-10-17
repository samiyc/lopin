import { parentPort } from "node:worker_threads";
import { formatCard } from "../../../src/core/notation.js";
import { createRng } from "../../../src/core/random.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { traitsOf } from "../../../src/replay/oracle/move-features.js";
import { ORACLE, favouriteOf } from "../../../src/replay/oracle/oracle.js";
import { engineFor } from "../../../src/sim/bots.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { loadGame } from "../domain/game-index.js";

/**
 * One position where two cores' favourites differ (`npm run oracle --
 * --disagree`, scripts/lib/domain/oracle-cores.js): the oracle searches it twice,
 * from two seeds, and says which favourite it plays — when both runs agree.
 */
function seedOf(text, run) {
  let hash = 0x811c9dc5 ^ run;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash;
}

const labelOf = (spec, move) => `${formatCard(spec, move.card)}→${move.border + 1}`;

/** "alt", "base", "other", or "unstable" when the two runs disagree. */
function verdictOf(runs, labels) {
  if (runs[0] !== runs[1]) return "unstable";
  if (runs[0] === labels.alt) return "alt";
  return runs[0] === labels.base ? "base" : "other";
}

parentPort.on("message", async ({ row, turn, budget, favourites }) => {
  const started = Date.now();
  const state = stateAt(await loadGame(row), turn);
  const moves = legalMoves(state);
  const { spec } = state;
  const scored = [1, 2].map((run) => engineFor(`${ORACLE.engine}@${budget}`)(createRng(seedOf(`${row.key}|${turn}`, run))).scoreMoves(state, moves, { keepAll: true }));
  const favourites2 = scored.map(favouriteOf);
  const runs = favourites2.map(({ move }) => labelOf(spec, move));
  const mover = state.current;
  const hand = [...state.hands[mover]];
  const traitsFor = (label) => traitsOf(state, mover, hand, moves.find((move) => labelOf(spec, move) === label));
  parentPort.postMessage({
    key: row.key,
    file: row.file,
    game: row.game,
    turn,
    legal: moves.length,
    ...favourites,
    oracle: runs[0],
    other: runs[1],
    share: favourites2[0].share,
    verdict: verdictOf(runs, favourites),
    traits: { alt: traitsFor(favourites.alt), base: traitsFor(favourites.base) },
    ms: Date.now() - started,
  });
});
