import { createRng } from "../../core/random.js";
import { parseCard } from "../../core/notation.js";
import { engineFor } from "../../sim/bots.js";
import { solveEndgame } from "../../sim/eval/endgame.js";
import { EXACT } from "../../sim/eval/exact.js";
import { applyMove, legalMoves } from "../../sim/engine/game.js";
import { seatRng } from "./bot-games.js";
import { TURNING_TURN } from "./game-analysis.js";
import { stateAt } from "./log.js";

/**
 * A kept bot game played again from one of its turns (Sami, evol-exp-090):
 * same deck, same pile, the same bots built again from the game's seed
 * (`seatRng`), so that the rest of the game repeats — or, with one change,
 * shows what that change does. No need to replay the start of the game.
 *
 * - `force: "random"`: the first move is a random legal move other than the
 *   one played — an error, to see what it costs; `force: { card, border }`:
 *   that move, to weigh it against another (the oracle, scripts/oracle.js);
 * - `engines`: other engines for one or both seats from that turn on — a new
 *   strategy tried on the same positions;
 * - `reseed`: the same bots with another seed — no change of play, only of
 *   the searches' luck: the control that tells a change from chaos, since
 *   early in a game any perturbation reshuffles what follows;
 * - `until`: stop after that many moves. Stopping at `TURNING_TURN`, once the
 *   pile is empty, and solving the rest exactly says who holds the game
 *   without playing it out.
 */

/** The move logged at turn `turn` (1-based), as a move object, or null for a pass. */
function loggedMove(state, entry) {
  return entry?.move ? { card: parseCard(state.spec, entry.move.card), border: entry.move.border - 1 } : null;
}

const same = (a, b) => a && b && a.card === b.card && a.border === b.border;

/** A random legal move of `state` other than `played` (the played one when it is the only move). */
function otherMove(state, played, rng) {
  const moves = legalMoves(state).filter((move) => !same(move, played));
  return moves.length > 0 ? moves[rng.int(moves.length)] : played;
}

/** The game's bots built again from its seed (shifted by `reseed`), or `engines` in their place where given. */
const botsFor = (log, engines, reseed = 0) => log.players.map((player, seat) => engineFor(engines?.[seat] ?? player.bot)(seatRng(log.seed + 1_000_003 * reseed, seat)));

/** Plays, at `turn`, a random legal move other than the logged one, and returns it. */
function forceError(log, turn, state) {
  const move = otherMove(state, loggedMove(state, log.turns[turn - 1]), createRng((log.seed ^ Math.imul(turn, 2654435761)) >>> 0));
  applyMove(state, move);
  return move;
}

/** The first move `force` asks for, played: none, a random error, or the move given. */
function forcedMoves(log, turn, state, force) {
  if (force === "random") return [forceError(log, turn, state)];
  if (!force) return [];
  applyMove(state, force);
  return [force];
}

/** Lets `bots` play `state` on until it is over or `until` moves are played, noting each move. */
function playOn(state, bots, until, moves) {
  while (!state.over && state.turn < until) {
    const legal = legalMoves(state);
    const move = legal.length > 0 ? bots[state.current].choose(state, legal) : null;
    applyMove(state, move);
    moves.push(move);
  }
}

/**
 * The game of `log` from turn `turn` (the position before logged move `turn`).
 * Returns `{ state, moves }`: the position reached, and the moves played from
 * `turn` on.
 */
export function branchFrom(log, turn, { force = null, engines = null, reseed = 0, until = Infinity } = {}) {
  const state = stateAt(log, turn);
  const bots = botsFor(log, engines, reseed);
  const moves = forcedMoves(log, turn, state, force);
  playOn(state, bots, until, moves);
  return { state, moves };
}

/** Does replaying `log` from `turn`, unchanged, give back every logged move after it? */
export function reproduces(log, turn) {
  const { state, moves } = branchFrom(log, turn);
  const logged = log.turns.slice(turn - 1);
  return state.winner === log.result.winner && moves.length === logged.length && moves.every((move, i) => (move === null ? logged[i].pass === true : same(move, loggedMove(state, logged[i]))));
}

/**
 * Who holds the game after `branchFrom(…, until: TURNING_TURN)`: the winner
 * if it is over, else the winner under perfect play from there (null for a
 * draw, undefined if the solver ran out of positions).
 */
export function holderAt({ state }) {
  if (state.over) return state.winner;
  const solution = solveEndgame(state, { stopAtWin: true, maxNodes: EXACT.nodes });
  if (!solution.complete) return undefined;
  if (solution.value === 0) return null;
  return solution.value === 1 ? state.current : 1 - state.current;
}

export { TURNING_TURN };
