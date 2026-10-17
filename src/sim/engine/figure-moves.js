import { isJoker, valueOf } from "../../core/cards.js";
import { figureOf, isFigure } from "../../core/figures.js";

/**
 * The extension's moves (docs/extension.md, Sami 07/10): laying a figure is
 * the turn's move. Beside an undecided border only, one per border and
 * player. The Dame de Cœur names a second undecided border to swap with; the
 * Dame de Pique takes back the last card its player laid on that border, and
 * the hand stays at 6 (no draw). The others change the border's rule
 * (border-rules.js) and do nothing else when laid.
 */
const undecided = (border) => border.owner === null;

/** The weakest card in hand to discard when playing Valet de Trèfle: plain cards with lowest value first, then joker, then figure. */
export function weakestCard(spec, hand, figureCard) {
  const candidates = hand.filter((c) => c !== figureCard);
  if (candidates.length === 0) return null;
  const plains = candidates.filter((c) => !isFigure(c) && !isJoker(c));
  if (plains.length > 0) {
    return plains.reduce((weakest, c) => (valueOf(spec, c) < valueOf(spec, weakest) ? c : weakest));
  }
  const nonFigures = candidates.filter((c) => !isFigure(c));
  if (nonFigures.length > 0) return nonFigures[0];
  return candidates[0];
}

function swapMoves(state, card, index) {
  const moves = [];
  state.borders.forEach((other, target) => {
    if (target !== index && undecided(other)) moves.push({ card, border: index, target });
  });
  return moves;
}

function minusTenMoves(state, player, card, index) {
  const moves = [{ card, border: index }];
  if (state.pile.length > 0) {
    const hand = state.hands[player];
    const weakest = weakestCard(state.spec, hand, card);
    if (weakest !== null) moves.push({ card, border: index, discard: weakest });
    const others = [...new Set(hand.filter((c) => c !== card))];
    for (const discard of others) {
      if (discard !== weakest) moves.push({ card, border: index, discard });
    }
  }
  return moves;
}

/** The legal moves of figure `card` for `player`: `{ card, border }`, plus `target` for the swap and `discard` for minusTen. */
export function figureMoves(state, player, card) {
  const { key } = figureOf(card);
  const moves = [];
  state.borders.forEach((border, index) => {
    if (!undecided(border) || border.figures[player] !== null) return;
    if (key === "recall" && border.sides[player].length === 0) return;
    if (key === "swap") {
      moves.push(...swapMoves(state, card, index));
      return;
    }
    if (key === "minusTen" || key === "weakest") {
      moves.push(...minusTenMoves(state, player, card, index));
      return;
    }
    moves.push({ card, border: index });
  });
  return moves;
}

/** The Dame de Pique: the last card `player` laid on `border` goes back to the hand; a full side is full no more. */
function recall(state, player, border) {
  const card = border.sides[player].pop();
  state.hands[player].push(card);
  if (isJoker(card)) state.jokersPlayed[player] -= 1;
  border.completedAt[player] = Infinity;
}

function cycleHand(state, hand, discard, legacy = false) {
  const at = hand.indexOf(discard);
  if (at < 0) return;
  hand.splice(at, 1);
  if (state.pile.length > 0) hand.push(state.pile.pop());
  if (!legacy && state.pile.length > 0) hand.push(state.pile.pop());
  state.pile.push(discard);
  const rng = state.pileRng ?? state.rng;
  if (rng) rng.shuffle(state.pile);
}

const isMinusTen = (key) => key === "minusTen" || key === "weakest";

function applyMinusTen(state, hand, discard, legacy) {
  if (discard !== undefined && discard !== null && state.pile.length > 0) {
    cycleHand(state, hand, discard, legacy);
    return Boolean(legacy);
  }
  return true;
}

/** Lays figure `move.card` beside `move.border`; true when the player draws after it (all but the Rappel and minusTen with discard). */
export function playFigure(state, player, { card, border: index, target, discard, legacy = false }) {
  const hand = state.hands[player];
  hand.splice(hand.indexOf(card), 1);
  const border = state.borders[index];
  border.figures[player] = card;
  state.lastMoves = state.lastMoves.map((last, seat) => (seat === player ? { card, border: index } : last));
  const { key } = figureOf(card);
  if (key === "recall") {
    recall(state, player, border);
    return false;
  }
  // The Dame de Cœur stays with the border she was laid beside: both move whole, figures included.
  if (key === "swap") [state.borders[index], state.borders[target]] = [state.borders[target], state.borders[index]];
  // Valet de Trèfle: discard a card, draw replacements, shuffle discard into pile, no draw after (except legacy).
  if (isMinusTen(key)) return applyMinusTen(state, hand, discard, legacy);
  return true;
}
