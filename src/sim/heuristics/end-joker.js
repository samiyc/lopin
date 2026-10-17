import { isJoker } from "../../core/cards.js";

/**
 * `endJoker` (core 1.2, Sami 07/10, from the endgame traps): once the pile is
 * empty, the joker's fixed price (`jokerCost`) says nothing — every card left
 * is known, and a joker kept is only worth what it would win elsewhere. Its
 * price becomes its best use on another border: laid on border b, a joker
 * gains what it wins there minus the most it would win on any other border
 * (nothing when no other border is better). `npm run traps`: 31 % of the
 * core's endgame errors were a joker laid or kept wrongly.
 *
 * `gainOf(move)`: the core's gain, its fixed card price already taken off;
 * `costOf(card)`: that price, added back to get what the joker wins; `on`:
 * the core's `endJoker` setting — off, `gainOf` is returned as it is.
 */
export function withEndJoker(state, moves, gainOf, { costOf, on }) {
  if (!on || state.pile.length > 0) return gainOf;
  const borders = moves.filter((move) => isJoker(move.card)).map((move) => move.border);
  if (borders.length === 0) return gainOf;
  const joker = moves.find((move) => isJoker(move.card)).card;
  const wins = new Map(borders.map((border) => [border, gainOf({ card: joker, border }) + costOf(joker)]));
  return (move) => {
    if (!isJoker(move.card)) return gainOf(move);
    const elsewhere = Math.max(0, ...borders.filter((border) => border !== move.border).map((border) => wins.get(border)));
    return wins.get(move.border) - elsewhere;
  };
}
