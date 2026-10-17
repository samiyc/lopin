import { isJoker } from "../../core/cards.js";

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
