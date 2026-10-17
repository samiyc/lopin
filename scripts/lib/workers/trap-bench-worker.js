import { parentPort } from "node:worker_threads";
import { DECKS, JOKER_RULES } from "../../../src/config/decks.js";
import { ORDERS } from "../../../src/config/formations.js";
import { formatCard } from "../../../src/core/notation.js";
import { createRng } from "../../../src/core/random.js";
import { rolloutPolicyOf } from "../../../src/sim/bots.js";
import { solveEndgame } from "../../../src/sim/eval/endgame.js";
import { coreOf } from "../../../src/sim/heuristics/experimental.js";
import { applyMove, createGame, legalMoves } from "../../../src/sim/engine/game.js";
import { cloneState } from "../../../src/sim/search/lookahead.js";
import { packPosition, unpackPosition } from "../../../src/sim/puzzles/trap-bench.js";
import { trapOf } from "../../../src/sim/puzzles/traps.js";

/**
 * The trap bench (scripts/trap-bench.js). `build`: core-against-core games of
 * the page's rule — the endgames the tree's rollouts play — and, once the
 * pile is empty, every position solved: won for the player to move, does the
 * core's favourite keep the win? A trap is kept with all its winning moves;
 * one sound position in three is kept as a control. `judge`: a core plays
 * the kept positions. Solves are capped: a position too deep is left out.
 */
const MAX_NODES = 400_000;
const cores = new Map();
const coreFor = (name) => {
  if (!cores.has(name)) cores.set(name, rolloutPolicyOf(coreOf(name))(createRng(1)));
  return cores.get(name);
};
const text = (state, move) => `${formatCard(state.spec, move.card)}→${move.border + 1}`;
const ranked = (core, state, moves) => core.scoreMoves(state, moves, { keepAll: true }).sort((a, b) => b.gain - a.gain).map(({ move }) => move);

/** Does `move` keep the win for the player to move? null when too deep to tell. */
function keepsWin(state, move) {
  const next = cloneState(state);
  applyMove(next, move);
  if (next.over) return next.winner === state.current;
  const reply = solveEndgame(next, { stopAtWin: true, maxNodes: MAX_NODES });
  return reply.complete ? reply.value !== 1 : null;
}

/** A trap kept whole: every winning move, and the family of the core's error (src/sim/puzzles/traps.js). */
function trapRecord(state, order, record) {
  const full = solveEndgame(state, { maxNodes: MAX_NODES });
  if (!full.complete) return { kind: "deep" };
  const trap = trapOf(state, full, order);
  const winners = full.moves.filter((entry) => entry.value === 1).map((entry) => text(state, entry.move));
  return { kind: "trap", record: { ...record, winners, family: trap?.family ?? "other", winRank: trap?.winRank ?? null } };
}

/** A won position: does the core's favourite keep the win (sound) or lose it (a trap)? */
function verdict(state, core, moves) {
  const order = ranked(core, state, moves);
  const keeps = keepsWin(state, order[0]);
  if (keeps === null) return { kind: "deep" };
  const record = { p: packPosition(state), core: text(state, order[0]) };
  return keeps ? { kind: "sound", record } : trapRecord(state, order, record);
}

/** One pile-empty position: not won, too deep, sound, or a trap. */
function examine(state, core) {
  const moves = legalMoves(state);
  if (moves.length < 2) return { kind: "skip" };
  const quick = solveEndgame(state, { stopAtWin: true, maxNodes: MAX_NODES });
  if (!quick.complete) return { kind: "deep" };
  return quick.value === 1 ? verdict(state, core, moves) : { kind: "lost" };
}

/** What an examined position adds to the tally: its count, and the trap or (one in three) the control kept. */
function note(found, tally) {
  tally[found.kind] = (tally[found.kind] ?? 0) + 1;
  if (found.kind === "trap") tally.traps.push(found.record);
  if (found.kind === "sound" && tally.sound % 3 === 0) tally.controls.push(found.record);
}

/** A core-against-core game from `seed`, every pile-empty position examined on the way. */
function buildFrom(seed, core, tally) {
  const state = createGame(DECKS.classique, { order: ORDERS.original, jokerRule: JOKER_RULES.colorless, endMode: "claim-end", rng: createRng(seed) });
  const players = [rolloutPolicyOf(coreOf("stfig6"))(createRng(seed * 2 + 1)), rolloutPolicyOf(coreOf("stfig6"))(createRng(seed * 2 + 2))];
  for (let guard = 0; !state.over && guard < 300; guard += 1) {
    if (state.pile.length === 0) note(examine(state, core), tally);
    const moves = legalMoves(state);
    applyMove(state, moves.length > 0 ? players[state.current].choose(state, moves) : null);
  }
}

/** A kept position judged for `core`: does its favourite win? */
function judgeOne(record, core) {
  const state = unpackPosition(record.p);
  const favourite = ranked(core, state, legalMoves(state))[0];
  const played = text(state, favourite);
  if (record.winners?.includes(played)) return true;
  if (played === record.core) return !record.winners;
  return keepsWin(state, favourite) !== false;
}

parentPort.on("message", (task) => {
  if (task.kind === "build") {
    const tally = { traps: [], controls: [] };
    for (const seed of task.seeds) {
      if (Date.now() > task.until) break;
      buildFrom(seed, coreFor("stfig6"), tally);
      tally.games = (tally.games ?? 0) + 1;
    }
    parentPort.postMessage(tally);
    return;
  }
  const core = coreFor(task.core);
  parentPort.postMessage(task.records.map((record) => judgeOne(record, core)));
});
