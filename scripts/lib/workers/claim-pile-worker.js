import { performance } from "node:perf_hooks";
import { parentPort } from "node:worker_threads";
import { formatCard } from "../../../src/core/notation.js";
import { createRng } from "../../../src/core/random.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { engineFor } from "../../../src/sim/bots.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { moveKey } from "../../../src/sim/search/search.js";
import { dealsOf, wonByMove } from "../domain/claim-end-deals.js";

/**
 * A « sure » endgame searched again (scripts/archive/claim-pile.js): each engine picks a move from `seeds` seeds,
 * timed, and every move picked is judged at the game's rule over the mover's deals (claim-end-deals.js) — unless
 * `known` already has its share (sure-lost-moves.js solved every move of the positions lost to the rules' gap).
 */
const nameOf = (state, move) => `${formatCard(state.spec, move.card)} ${move.border + 1}`;

function picked(state, engine, seed) {
  const bot = engineFor(engine)(createRng(seed));
  const started = performance.now();
  const move = bot.choose(state, legalMoves(state));
  return { move, ms: Math.round(performance.now() - started) };
}

function measured({ log, turn, nodes, engines, seeds, known }) {
  const state = stateAt(log, turn);
  const picks = Object.fromEntries(Object.entries(engines).map(([label, engine]) => [label, Array.from({ length: seeds }, (_, k) => picked(state, engine, k + 1))]));
  const chosen = new Map(Object.values(picks).flat().map(({ move }) => [moveKey(move), move]));
  const unknown = [...chosen.values()].filter((move) => !(nameOf(state, move) in known));
  const shares = { ...known };
  let deals = null;
  if (unknown.length > 0) {
    const { wins, solved } = wonByMove(dealsOf(state, state.current), unknown, nodes);
    deals = solved;
    for (const move of unknown) shares[nameOf(state, move)] = solved > 0 ? wins.get(moveKey(move)) / solved : null;
  }
  const named = Object.fromEntries(Object.entries(picks).map(([label, list]) => [label, list.map(({ move, ms }) => ({ move: nameOf(state, move), ms }))]));
  return { deals, picks: named, shares };
}

parentPort.on("message", (task) => parentPort.postMessage(measured(task)));
