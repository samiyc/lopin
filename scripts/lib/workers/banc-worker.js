import { parentPort } from "node:worker_threads";
import { formatCard } from "../../../src/core/notation.js";
import { createRng } from "../../../src/core/random.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { coreRanking } from "../../../src/replay/oracle/oracle.js";
import { engineFor, strategistBot } from "../../../src/sim/bots.js";
import { EXPERIMENT, coreOf } from "../../../src/sim/heuristics/experimental.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { loadGame } from "../domain/game-index.js";

/**
 * A batch of the bench's positions for one version (`npm run banc`,
 * src/replay/oracle/banc.js): the move its search plays — from a seed drawn from
 * the position, so a version always plays the same move there — and its
 * core's top 8, for the coverage of the oracle's favourite.
 */
const labelOf = (spec, move) => `${formatCard(spec, move.card)}→${move.border + 1}`;

/** The core named in an engine id (`…+core=stfig6@800`, or in a `phase:` id's late engine), the 0.9's when none is. */
const coreIn = (engine) => {
  const names = [...engine.matchAll(/core=(\w+)/g)].map((match) => match[1]);
  return names.length > 0 ? coreOf(names.at(-1)) : EXPERIMENT;
};

function seedOf(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash;
}

parentPort.on("message", async ({ entries, engine }) => {
  const core = coreIn(engine);
  const results = [];
  for (const entry of entries) {
    const state = stateAt(await loadGame(entry), entry.turn);
    const moves = legalMoves(state);
    const move = engineFor(engine)(createRng(seedOf(`${entry.key}|${entry.turn}`))).choose(state, moves);
    const coreTop = coreRanking(strategistBot(createRng(1), core).scoreMoves(state, moves, { keepAll: true })).slice(0, 8).map((candidate) => labelOf(state.spec, candidate));
    results.push({ key: entry.key, turn: entry.turn, move: labelOf(state.spec, move), coreTop });
  }
  parentPort.postMessage(results);
});
