/**
 * Playing ahead: during the bot's turn the human may pick a card and a border;
 * the move goes as soon as their turn comes, if it is still legal. Pure,
 * tested under Node; `play.js` holds the state.
 *
 * The card is kept by id, not by index: the hand may be rearranged meanwhile.
 */

/** The move programmed from the card at `index` of `order`. */
export const planPremove = (order, index, border) => ({ card: order[index], border });

/**
 * What to do with `premove` when the human's turn comes. `legalFor(index)`
 * gives the borders the card at `index` may go to. Returns the move to play
 * (`{ index, card, border }`), or `{ cancel: true, index }` — `index` being
 * where the card now sits, to keep it selected — or null when nothing was
 * programmed.
 */
export function resolvePremove(premove, order, legalFor) {
  if (!premove) return null;
  const index = order.indexOf(premove.card);
  if (index === -1) return { cancel: true, index: null };
  if (!legalFor(index).has(premove.border)) return { cancel: true, index };
  return { index, card: premove.card, border: premove.border };
}

/**
 * The selection after a move: cleared after the human's own move, kept —
 * following its card — after the bot's, so the next move can be prepared
 * during the bot's turn.
 */
export function keepSelection(selected, previousOrder, order, byHuman) {
  if (byHuman || selected === null) return null;
  const index = order.indexOf(previousOrder[selected]);
  return index === -1 ? null : index;
}
