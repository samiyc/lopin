import { isJoker } from "../../core/cards.js";
import { jokerWinOf } from "./joker-win.js";

/** `context.jokerWin` (joker-win.js) when the `jokerWin` idea is on: may a joker go on that border? Only to win the game. */
export const jokerWinGate = (state, player, ideas) => (ideas.has("jokerWin") ? jokerWinOf(state, player) : null);

/** May one more joker join `side`? Asked once per side, not once per card (bots.js). */
export function jokerGate(state, player) {
  const { maxPerSide, maxPerPlayer } = state.jokerRule;
  const underPlayerCap = state.jokersPlayed[player] < maxPerPlayer;
  // Counted by hand: asked for every side judged, an array per call added up.
  return (side) => {
    if (!underPlayerCap) return false;
    let jokers = 0;
    for (const card of side) jokers += isJoker(card) ? 1 : 0;
    return jokers < maxPerSide;
  };
}
