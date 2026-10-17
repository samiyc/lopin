import { colorOf, isJoker, valueOf } from "../../core/cards.js";
import { figureOf, isFigure, withoutFigures } from "../../core/figures.js";

/**
 * What the core thinks a figure move is worth (the extension, docs/extension.md):
 * a rough change of its odds on the borders touched, on the same scale as a
 * card move's gain (border odds after minus before). Rough on purpose — the
 * tree plays the figures out in its rollouts under the real rules
 * (border-rules.js) and corrects these first guesses; the core only has to
 * put the good figure moves among its candidates.
 *
 * `chances[b]`: the player's odds on border b as things stand.
 */
const KEEP = 0.05;
const odds = (diff, scale) => 1 / (1 + Math.exp(-diff / scale));
const realOf = (side) => side.filter((card) => !isJoker(card));

/** The sum a side may reach: its cards (a joker as a 10) plus the average for the cards still to come. */
function likelySum(spec, side) {
  const placed = side.reduce((sum, card) => sum + (isJoker(card) ? spec.values : valueOf(spec, card)), 0);
  return placed + ((spec.values + 1) / 2) * (3 - side.length);
}

/** A side that is still an odd colour: every real card odd and of one suit, at least one of them. */
function oddColourStart(spec, side) {
  const real = realOf(side);
  return real.length === side.length && real.length > 0 && real.every((card) => valueOf(spec, card) % 2 === 1 && colorOf(spec, card) === colorOf(spec, real[0]));
}

/** A side that is still a run: distinct values within a span of three. */
function runStart(spec, side) {
  const values = realOf(side).map((card) => valueOf(spec, card));
  return values.length > 0 && new Set(values).size === values.length && Math.max(...values) - Math.min(...values) <= 2;
}

/** The longest run of borders `owned` marks. */
function longest(owned) {
  let best = 0;
  let run = 0;
  for (const flag of owned) {
    run = flag ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** The Dame de Cœur: only the « 3 côte à côte » can change — what the likely owners' longest runs gain or lose. */
function swapGain(chances, { border, target }) {
  const after = [...chances];
  [after[border], after[target]] = [after[target], after[border]];
  const mine = (list) => longest(list.map((c) => c > 0.5));
  const theirs = (list) => longest(list.map((c) => c < 0.5));
  return 0.15 * (mine(after) - mine(chances)) - 0.15 * (theirs(after) - theirs(chances));
}

const GAINS = {
  minusTen: (state, border, c, { move } = {}) => {
    let gain = -0.04 * c;
    if (move?.discard !== undefined && move?.discard !== null) {
      if (isFigure(move.discard)) gain -= 0.3;
      else if (isJoker(move.discard)) gain -= 0.15;
      else {
        const val = valueOf(state.spec, move.discard);
        gain += 0.04 + ((5.5 - val) / 10) * 0.05;
      }
    }
    return gain;
  },
  weakest: (state, border, c, ctx) => GAINS.minusTen(state, border, c, ctx),
  sum: (state, border, c, { player }) => {
    const [mine, theirs] = border.sides.map((side) => likelySum(state.spec, side));
    return odds(player === 0 ? mine - theirs : theirs - mine, 4) - c;
  },
  oddFlush: (state, border, c, { player }) => {
    const [mine, theirs] = [border.sides[player], border.sides[1 - player]];
    return 0.5 * Number(oddColourStart(state.spec, mine)) * (1 - c) - 0.5 * Number(oddColourStart(state.spec, theirs)) * c;
  },
  plusTen: (state, border, c, { player }) => (runStart(state.spec, border.sides[player]) ? 0.3 * (1 - c) : 0),
  // Taking back a card is worth it on a border going badly; the card comes back to play elsewhere.
  recall: (state, border, c, { player }) => {
    const card = border.sides[player].at(-1);
    const back = isJoker(card) ? 0.1 : (0.05 * valueOf(state.spec, card)) / state.spec.values;
    return (c < 0.35 ? 0.35 - c : -0.05) + back;
  },
};

/** The core's gain for figure move `move` (`{ card, border, target? }`) of the player to move. */
export function figureGain(state, move, chances) {
  const { key } = figureOf(move.card);
  if (key === "swap") return swapGain(chances, move) - KEEP;
  const border = state.borders[move.border];
  return GAINS[key](state, border, chances[move.border], { player: state.current, move }) - KEEP;
}

/** The hand the core weighs: the figures left out, which no side takes. */
export const handOf = (state, player) => (state.withFigures ? withoutFigures(state.hands[player]) : state.hands[player]);

/**
 * The core's scoring with the extension: figure moves get their rough gain,
 * the card moves are scored as always (`scoreCards`). `chancesOf()`: the
 * player's odds on each border, worked out only when a figure can be played.
 */
export function withFigureMoves(state, moves, chancesOf, scoreCards) {
  const figures = state.withFigures ? moves.filter((move) => isFigure(move.card)) : [];
  if (figures.length === 0) return scoreCards(moves);
  const cards = moves.filter((move) => !isFigure(move.card));
  const chances = chancesOf();
  return [...(cards.length > 0 ? scoreCards(cards) : []), ...figures.map((move) => ({ move, gain: figureGain(state, move, chances) }))];
}
