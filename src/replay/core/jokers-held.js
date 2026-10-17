import { JOKER_TEXT } from "../../core/notation.js";
import { rulesOf } from "./log.js";

/**
 * The jokers each player got in a logged game (Sami, 03/10): in the starting
 * hand — the first `handSize` cards of the deck for seat 0, the next ones for
 * seat 1, as `createGame` deals them — and drawn afterwards (each turn logs
 * the card drawn). Jokers still in the pile when the game ends count for
 * nobody.
 */
export function jokersOf(log) {
  const { spec } = rulesOf(log.rules);
  const start = [0, 1].map((seat) => log.deck.slice(seat * spec.handSize, (seat + 1) * spec.handSize).filter((card) => card === JOKER_TEXT).length);
  const drawn = [0, 0];
  for (const turn of log.turns) if (turn.drew === JOKER_TEXT) drawn[turn.player] += 1;
  return { start, drawn, total: [start[0] + drawn[0], start[1] + drawn[1]] };
}
