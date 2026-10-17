import { FIGURE_IDS, figureOf, isFigure } from "../../../src/core/figures.js";
import { createRng } from "../../../src/core/random.js";

/**
 * The extension in the page (docs/extension.md): which figures join a new
 * game, and how a figure is laid with the mouse. Every figure goes beside a
 * border like a card goes on it — but the Dame de Cœur, which takes two
 * clicks: her border, then the border she swaps it with. Pure, so tested.
 */
export const isSwap = (card) => isFigure(card) && figureOf(card).key === "swap";
/** A Valet de Trèfle laid beside `pending.border`, waiting for the card to discard (`discardMove`). */
export const awaitsDiscard = (pending) => pending?.action === "discard";
export const isMinusTen = (card) => isFigure(card) && (figureOf(card).key === "minusTen" || figureOf(card).key === "weakest");

/** The `bonus` figures (0 to 6) of a new game, drawn from its seed apart from the deal: none leaves the base game as it was. */
export const figuresFor = (seed, bonus) => (bonus > 0 ? createRng(seed ^ 0x2f6a).shuffle([...FIGURE_IDS]).slice(0, bonus) : []);

/** The borders `card` may go to now — or, a Dame de Cœur waiting beside `pending.border`, the borders she may swap it with. */
export function bordersFor(moves, card, pending) {
  if (awaitsDiscard(pending)) return new Set([pending.border]);
  const own = moves.filter((move) => move.card === card);
  if (pending && isSwap(card)) return new Set(own.filter((move) => move.border === pending.border).map((move) => move.target));
  return new Set(own.map((move) => move.border));
}

const stepSwap = (card, border, pending) => (!pending ? { pending: { border } } : { move: { card, border: pending.border, target: border } });

const stepMinusTen = (card, border, pending, ctx) => {
  if (ctx?.pile === 0) return { move: { card, border } };
  // A second click on the border plays the Valet without a discard; a card picked from the hand discards it (play.js).
  return pending ? { move: { card, border } } : { pending: { card, border, action: "discard" } };
};

/**
 * The Valet de Trèfle waiting beside `pending.border` for its discard, then
 * `card` played on `border` (null for a card picked in the hand): another card
 * is discarded; the Valet again on its border is laid without a discard; no
 * card, or the Valet anywhere else, cancels the wait (null).
 */
export function discardMove(pending, card, border = null) {
  if (card === null || card === undefined) return null;
  if (card !== pending.card) return { card: pending.card, border: pending.border, discard: card };
  return border === pending.border ? { card, border } : null;
}

const isRecall = (card) => isFigure(card) && figureOf(card).key === "recall";

/** The Dame de Pique in hand selected: the borders whose last card on the player's side she would take back. */
export const recallBorders = (moves, card) => (isRecall(card) ? new Set(moves.filter((move) => move.card === card).map((move) => move.border)) : new Set());

/** The Valet de Trèfle waiting for its discard: the cards of the hand it may discard (none once the pile is empty). */
export function discardables(moves, pending) {
  if (!awaitsDiscard(pending)) return new Set();
  const own = moves.filter((move) => move.card === pending.card && move.border === pending.border && move.discard !== undefined);
  return new Set(own.map((move) => move.discard));
}

/** The extension's hints in the page (table.js): the cards `card`, a selected Dame de Pique, would take back; the ones a waiting Valet de Trèfle may discard. */
export const figureMarks = (moves, card, pending) => ({ recall: recallBorders(moves, card), discard: discardables(moves, pending) });

/** A click on `border` with `card`: the move to play, or — Dame de Cœur / Valet de Trèfle — the pending step. */
export function stepOf(card, border, pending, ctx = null) {
  if (isSwap(card)) return stepSwap(card, border, pending);
  if (isMinusTen(card)) return stepMinusTen(card, border, pending, ctx);
  return { move: { card, border } };
}
