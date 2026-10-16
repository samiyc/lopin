import { createRng } from "../../src/core/random.js";
import { stateAt } from "../../src/replay/log.js";
import { engineFor } from "../../src/sim/bots.js";
import { partBudget } from "../../src/sim/choice.js";
import { budgetOf } from "../../src/sim/experimental.js";
import { legalMoves } from "../../src/sim/game.js";
import { CREDIT, createPonder } from "../../src/sim/ponder.js";

/**
 * The experimental bot's own thread (`thinker.js` talks to it). It searches
 * without freezing the page, and during the human's turn it ponders its
 * reply (`src/sim/ponder.js`). A move stops at the engine's own iterations
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
 */
const SLICE_MS = 25;
let bot = null;
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

/** Searches the reply, starting from what pondering learned (`taken`: `{ warm, spentMs }`). */
function searchReply(state, moves, { warm, spentMs }) {
  const started = now();
  const search = bot.searchFor(state, moves, {}, { warm, ...share });
  const budget = Math.max(limits.minMs, limits.limitMs - CREDIT * spentMs);
  while (!search.done() && search.rollouts() < limits.iterations && now() - started < budget) search.step();
  return { move: search.best(), scored: search.scored(), pondered: Math.round(spentMs), rollouts: search.rollouts(), thoughtMs: Math.round(now() - started) };
}

/** A small endgame, solved exactly (Expérimental 0.7): no search, no clock. */
function solvedReply(state, moves) {
  const started = now();
  const scored = bot.scoreMoves(state, moves);
  const best = scored.reduce((a, b) => (b.gain > a.gain ? b : a));
  return { move: best.move, scored, pondered: 0, rollouts: 0, thoughtMs: Math.round(now() - started) };
}

function decide(log) {
  const state = current(log);
  const moves = legalMoves(state);
  const taken = ponder?.take() ?? { warm: null, spentMs: 0 };
  ponder = null;
  if (bot.solves?.(state, moves)) return solvedReply(state, moves);
  if (moves.length > 1) return searchReply(state, moves, taken);
  return { move: moves[0] ?? null, scored: bot.scoreMoves(state, moves), pondered: 0, rollouts: 0, thoughtMs: 0 };
}

const HANDLERS = {
  init({ engine, seed, limitMs, minMs, part = 0, workers = 1 }) {
    bot = engineFor(engine)(createRng(seed));
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
      postMessage({ type: "move", id, ...decide(log) });
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
