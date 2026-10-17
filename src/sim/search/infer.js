import { legalMoves } from "../engine/game.js";
import { cloneState } from "./lookahead.js";
import { unseenCards } from "../eval/potential.js";

/**
 * Guessing the opponent's hand (`ismcts+infer=N`, Sami, 04/10: a version at
 * 55 % against the V1). A plain search deals the cards it cannot see at random
 * (`determinize`): every hand is as likely, whatever the opponent just played.
 * Here, at the start of a search, N hands are drawn for the opponent and each
 * is weighed by how likely their moves were had they held it — the core's
 * scores turned into odds (a softmax at `temperature`). Every iteration then
 * deals one of those hands, in proportion to its weight, and the pile from the
 * rest.
 *
 * What is read: their last move alone (`infer` v1), or with `+memory=K` their
 * last K moves (v2, 05/10), which the bot remembers from one move to the next
 * (`createReader`). At an earlier move, their hand is taken as the guessed hand
 * plus every card they played since: the cards they drew since are counted as
 * already in hand, an approximation that grows with K. A move that claimed a
 * border is not read (the board it changed is not rebuilt), nor a first move.
 */
// The core's first and eighth moves lie about 0.4 apart: at 0.2 an opponent who plays its 8th move is a few times less likely, not ruled out (a tree plays the core's favourite one time in ten).
export const INFER = Object.freeze({ temperature: 0.2 });

const hiddenOf = (state, player) => unseenCards(state, player).entries.flatMap(([card, count]) => Array.from({ length: count }, () => card));

/** Was the opponent's last move one this module can read? */
function readable(state, opponent) {
  const last = state.lastMoves[opponent];
  return Boolean(last) && state.borders[last.border].owner === null && state.borders[last.border].sides[opponent].includes(last.card);
}

/** The board the opponent faced before their last move (their hand left to fill in). */
function boardBefore(state, opponent) {
  const last = state.lastMoves[opponent];
  const board = cloneState(state);
  const side = board.borders[last.border].sides[opponent];
  side.splice(side.lastIndexOf(last.card), 1);
  board.current = opponent;
  board.turn = state.turn - 1;
  return board;
}

/** One move of the opponent, as remembered: the board before it (null when it cannot be read), the move, the pile then. */
const seenMove = (state, opponent) => ({ move: state.lastMoves[opponent], board: readable(state, opponent) ? boardBefore(state, opponent) : null, pile: state.pile.length });

/**
 * A bot's memory of the opponent's moves, for `+memory=K`: `observe(state)` at
 * each of its own moves notes the move the opponent just made (once); `readings(K)`
 * returns the last K readable ones, each with the cards played after it.
 */
export function createReader() {
  const seen = [];
  return {
    observe(state) {
      const last = state.lastMoves[1 - state.current];
      if (last && seen.at(-1)?.move !== last) seen.push(seenMove(state, 1 - state.current));
    },
    readings(memory) {
      const kept = seen.map((entry, i) => ({ ...entry, later: seen.slice(i + 1).map(({ move }) => move.card) })).filter(({ board }) => board);
      return kept.slice(-memory);
    },
  };
}

/** The odds the core (`judge`) gives one remembered move, had the opponent been dealt `deal` now. */
function likelihood(judge, reading, deal) {
  const { move, board, later } = reading;
  const position = { ...board, hands: board.hands.map((hand) => [...hand]), pile: deal.pile.slice(0, reading.pile) };
  position.hands[board.current] = [...deal.hand, move.card, ...later];
  const scored = judge.scoreMoves(position, legalMoves(position), { keepAll: true });
  const top = Math.max(...scored.map(({ gain }) => gain));
  const odds = (gain) => Math.exp((gain - top) / INFER.temperature);
  const played = scored.find((entry) => entry.move.card === move.card && entry.move.border === move.border);
  return played ? odds(played.gain) / scored.reduce((sum, { gain }) => sum + odds(gain), 0) : 0;
}

/**
 * `size` hands for the opponent of the player to move, each with its
 * cumulative weight (`{ hand, upTo }`, the last `upTo` being 1) — or null when
 * there is nothing to read, or no hand explains the moves. `readings`: the
 * remembered moves (`createReader`); without them, the last move alone.
 */
export function inferredHands(state, judge, rng, { size, readings = null }) {
  const opponent = 1 - state.current;
  const read = readings ?? (readable(state, opponent) ? [{ ...seenMove(state, opponent), later: [] }] : []);
  if (read.length === 0) return null;
  const hidden = hiddenOf(state, state.current);
  const count = state.hands[opponent].length;
  const drawn = Array.from({ length: size }, () => {
    const cards = rng.shuffle([...hidden]);
    const deal = { hand: cards.slice(0, count), pile: cards.slice(count) };
    return { hand: deal.hand, weight: read.reduce((product, reading) => product * likelihood(judge, reading, deal), 1) };
  });
  const total = drawn.reduce((sum, { weight }) => sum + weight, 0);
  if (total <= 0 || Number.isNaN(total)) return null;
  let running = 0;
  return drawn.map(({ hand, weight }) => {
    running += weight / total;
    return { hand, upTo: running };
  });
}

/** One of the inferred hands, drawn in proportion to its weight. */
export function pickHand(pool, rng) {
  const at = rng.next();
  return (pool.find(({ upTo }) => at < upTo) ?? pool.at(-1)).hand;
}
