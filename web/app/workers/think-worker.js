import { createRng } from "../../../src/core/random.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { engineFor } from "../../../src/sim/bots.js";
import { partBudget } from "../../../src/sim/mcts/choice.js";
import { budgetOf } from "../../../src/sim/heuristics/experimental.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { CREDIT, createPonder } from "../../../src/sim/search/ponder.js";
import { treeStats } from "../../../src/sim/mcts/tree-stats.js";
import { addRootStats, rootStats, snapshotTree } from "../../../src/sim/mcts/tree-snapshot.js";

/**
 * The experimental bot's own thread (`thinker.js` talks to it). It searches
 * without freezing the page, and during the human's turn it ponders its
 * reply (`src/sim/search/ponder.js`). A move stops at the engine's own iterations
 * (`@2000`: the bot of the duels and the Elo, Sami 11/10 — it ran to the
 * clock before, so the page played a stronger bot than the one rated), and
 * within `limitMs` of thought minus `CREDIT` of the time pondered, but never
 * less than `minMs`: a human who thought 20 s gets an answer at once.
 * Only a bot whose search takes that head start (`bot.warms`, the flat
 * search) ponders: an ISMCTS ignores `warm`, and crediting its time cut the
 * 1.2 to 1 178 of its 2 000 iterations after 20 s of human thought (16/10).
 *
 * An ensemble (`+trees=k`, the Oracle light) runs one tree per worker: `part`
 * of `workers` searches its share of the iterations with the seed it has in
 * Node, and `thinker.js` adds the trees' scores up (`addScores`).
 *
 * Messages in: `init { engine, seed, limitMs, minMs, part, workers }`, `ponder { log }` (the
 * human is to move), `decide { log }` (the bot is to move), `stop`.
 * `decide` carries an `id`, echoed in the answer, so that the page drops an
 * answer that comes back after it gave up waiting (thinker.js).
 * Message out: `move { id, move, scored, pondered, rollouts, thoughtMs }`.
 *
 * The Labo (Sami, 17/10) inits with `lab: true`: a tree search then posts `progress { id, rollouts, elapsedMs, root }`
 * every `PROGRESS_MS` while it searches, and its `move` carries `lab: { root, trees: [{ levels, snapshot }] }`, the
 * root's candidates and the pruned trees (tree-snapshot.js). Read between steps only: the move is the same.
 */
const SLICE_MS = 25;
const PROGRESS_MS = 250;
let bot = null;
let lab = false;
let limits = { limitMs: 10000, minMs: 400, iterations: Infinity };
let share = {};
let ponder = null;

const now = () => performance.now();
const current = (log) => stateAt(log, log.turns.length + 1);
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Works on `mine` a slice at a time, until it is replaced or has nothing left to do. */
async function keepPondering(mine) {
  while (ponder === mine && mine.work(SLICE_MS)) await breathe();
}

/** The root's candidates of every tree a search holds, added up (an ensemble in one worker has several). */
const labRoot = (search) => addRootStats(search.trees().map((tree) => rootStats(tree, search.candidates(), search.core())));

/** What the Labo reads of a finished search, or null for a search without a tree (the flat 0.7). */
function labOf(search, state) {
  if (!search.trees) return null;
  return { root: labRoot(search), trees: search.trees().map((tree) => ({ levels: treeStats(tree), snapshot: snapshotTree(tree, { rootPlayer: state.current }) })) };
}

/** Searches the reply, starting from what pondering learned (`taken`: `{ warm, spentMs }`). */
function searchReply(state, moves, { warm, spentMs }, id) {
  const started = now();
  const search = bot.searchFor(state, moves, {}, { warm, ...share });
  const budget = Math.max(limits.minMs, limits.limitMs - CREDIT * spentMs);
  const tells = lab && Boolean(search.trees);
  let told = started;
  while (!search.done() && search.rollouts() < limits.iterations && now() - started < budget) {
    search.step();
    if (tells && now() - told >= PROGRESS_MS) {
      told = now();
      postMessage({ type: "progress", id, rollouts: search.rollouts(), elapsedMs: Math.round(told - started), root: labRoot(search) });
    }
  }
  const reply = { move: search.best(), scored: search.scored(), pondered: Math.round(spentMs), rollouts: search.rollouts(), thoughtMs: Math.round(now() - started) };
  return lab ? { ...reply, lab: labOf(search, state) } : reply;
}

/** A small endgame, solved exactly (Expérimental 0.7): no search, no clock. */
function solvedReply(state, moves) {
  const started = now();
  const scored = bot.scoreMoves(state, moves);
  const best = scored.reduce((a, b) => (b.gain > a.gain ? b : a));
  const reply = { move: best.move, scored, pondered: 0, rollouts: 0, thoughtMs: Math.round(now() - started) };
  return lab ? { ...reply, lab: { exact: true } } : reply;
}

function decide(log, id) {
  const state = current(log);
  const moves = legalMoves(state);
  const taken = ponder?.take() ?? { warm: null, spentMs: 0 };
  ponder = null;
  if (bot.solves?.(state, moves)) return solvedReply(state, moves);
  if (moves.length > 1) return searchReply(state, moves, taken, id);
  return { move: moves[0] ?? null, scored: bot.scoreMoves(state, moves), pondered: 0, rollouts: 0, thoughtMs: 0 };
}

const HANDLERS = {
  init({ engine, seed, limitMs, minMs, part = 0, workers = 1, lab: labOn = false }) {
    bot = engineFor(engine)(createRng(seed));
    lab = Boolean(labOn);
    const budget = budgetOf(engine.split("@")[1]).budget ?? Infinity;
    share = workers > 1 ? { part } : {};
    limits = { limitMs, minMs, iterations: workers > 1 ? partBudget(budget, workers, part) : budget };
  },
  ponder({ log }) {
    if (!bot.warms) return;
    try {
      ponder = createPonder(current(log), bot, { limitMs: limits.limitMs / CREDIT, seed: log.turns.length + 1 });
      keepPondering(ponder);
    } catch (err) {
      console.error("Worker ponder error:", err);
    }
  },
  decide({ log, id }) {
    try {
      postMessage({ type: "move", id, ...decide(log, id) });
    } catch (err) {
      console.error("Worker decide error:", err);
      try {
        const state = current(log);
        const moves = legalMoves(state);
        const scored = bot.scoreMoves(state, moves);
        const best = scored.reduce((a, b) => (b.gain > a.gain ? b : a), scored[0]);
        postMessage({ type: "move", id, move: best?.move ?? moves[0] ?? null, scored, pondered: 0, rollouts: 0, thoughtMs: 0 });
      } catch (recoveryErr) {
        console.error("Worker recovery error:", recoveryErr);
        postMessage({ type: "error", id, error: err.message });
      }
    }
  },
  stop() {
    ponder = null;
  },
};

onmessage = ({ data }) => HANDLERS[data.type]?.(data);
