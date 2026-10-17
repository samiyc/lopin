import { parseCards } from "../../core/notation.js";
import { solveEndgame } from "../../sim/eval/endgame.js";
import { EXACT } from "../../sim/eval/exact.js";
import { handClass, startingHands } from "../../sim/eval/hand-classes.js";
import { replayStates, rulesOf, stateAt } from "./log.js";
import { jokersOf } from "./jokers-held.js";

/**
 * What a finished game says about itself, computed once when it is saved
 * (`bot-games.js`) so that later tests can pick games and starting turns
 * without replaying them (Sami, evol-exp-090):
 *
 * - `handClasses`: each seat's starting hand, weak, medium or strong;
 * - `columns`: the turn at which each seat had a card on all seven borders
 *   (null if never) — from then on no border of theirs starts from nothing;
 * - `firstBorder`: `{ seat, turn }`, the first border won and when;
 * - `jokers`: the jokers each seat got, in the starting hand and drawn
 *   (`jokers-held.js`);
 * - `advantage`: who holds the game once the pile is empty, after
 *   `TURNING_TURN` moves, by exact play.
 *
 * A turn is the number of moves played: turn T is the position after T moves,
 * the one `stateAt(log, T + 1)` rebuilds.
 */
export const TURNING_TURN = 30;

/** The winner under perfect play from the value `value` of the player `toMove`: a seat, or null for a draw. */
const perfectWinner = (value, toMove) => {
  if (value === 0) return null;
  return value === 1 ? toMove : 1 - toMove;
};

/**
 * Who holds the game after `turn` moves. The pile is empty then, nothing is
 * hidden, and the solver says it (`EXACT.nodes` at most): `{ turn, toMove,
 * value, winner }` — value 1, 0 or -1 for the player to move. A game over
 * before that turn reports its result (`ended: true`); a solve that runs out
 * of positions reports `value: null`.
 */
export function advantageAt(log, turn = TURNING_TURN) {
  if (log.turns.length <= turn) return { turn, ended: true, winner: log.result.winner };
  const state = stateAt(log, turn + 1);
  if (state.over || state.pile.length > 0) return { turn, ended: state.over, winner: state.winner };
  const solution = solveEndgame(state, { stopAtWin: true, maxNodes: EXACT.nodes });
  if (!solution.complete) return { turn, toMove: state.current, value: null };
  return { turn, toMove: state.current, value: solution.value, winner: perfectWinner(solution.value, state.current) };
}

/** The first turn at which `test(frame.state)` holds, or null. */
const firstTurn = (frames, test) => {
  const index = frames.findIndex(({ state }) => test(state));
  return index === -1 ? null : index;
};

/** The turning points of a game: seven borders started per seat, and the first border won. */
export function turningPoints(log) {
  const frames = replayStates(log);
  const started = (seat) => (state) => state.borders.every((border) => border.sides[seat].length > 0);
  const won = firstTurn(frames, (state) => state.borders.some((border) => border.owner !== null));
  const owner = won === null ? null : frames[won].state.borders.find((border) => border.owner !== null).owner;
  return { columns: [firstTurn(frames, started(0)), firstTurn(frames, started(1))], firstBorder: won === null ? null : { seat: owner, turn: won } };
}

/** Everything above, for one finished game. */
export function analyseGame(log) {
  const { spec } = rulesOf(log.rules);
  const handClasses = startingHands(spec, parseCards(spec, log.deck)).map((hand) => handClass(spec, hand));
  return { handClasses, ...turningPoints(log), jokers: jokersOf(log), advantage: advantageAt(log) };
}

/** 32-bit FNV-1a of `text`, in base 36: short enough to key thousands of games. */
function fnv(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(36);
}

/**
 * What makes a game the same game: its rules, its deck, its two players
 * (engine and version, by seat) and the bots' seed. Saving it twice is a
 * duplicate (`scripts/lib/domain/duel-save.js`).
 */
export function gameKey(log) {
  const players = log.players.map((player) => `${player.bot}=${player.version}`).join(",");
  const text = `${log.rules.deck}|${log.rules.jokerRule}|${log.rules.order}|${log.rules.endMode}|${players}|${log.seed}|${log.deck.join(" ")}`;
  return `${fnv(text)}-${fnv([...text].reverse().join(""))}`;
}
