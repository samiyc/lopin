import { parseCards } from "../../core/notation.js";
import { HAND_CLASS_IDS, handClass, startingHands } from "../../sim/eval/hand-classes.js";
import { rulesOf } from "../core/log.js";
import { playerTag } from "../../config/bots.js";

/**
 * Games and wins by starting hand, for every player of the saved games: the
 * humans, and each bot version they met. A log keeps its deck, so the two
 * starting hands — and their class, weak, medium or strong
 * (`src/sim/eval/hand-classes.js`) — come back from any game, old ones included.
 * What the "Stats" tab's "Mains de départ" table shows, to see whether the
 * weak hands lose and the strong ones win as they should.
 */
const empty = () => Object.fromEntries(HAND_CLASS_IDS.map((id) => [id, { games: 0, won: 0 }]));
const playerName = (player) => (player.kind === "human" ? player.name : playerTag(player));

/** Adds one finished game to `rows`, once per player. */
function countGame(rows, log) {
  const { spec } = rulesOf(log.rules);
  const hands = startingHands(spec, parseCards(spec, log.deck));
  for (const player of log.players) {
    const key = playerName(player);
    if (!rows.has(key)) rows.set(key, { player: key, human: player.kind === "human", ...empty() });
    const cell = rows.get(key)[handClass(spec, hands[player.seat])];
    cell.games += 1;
    cell.won += Number(log.result.winner === player.seat);
  }
}

/** `[{ player, human, weak: { games, won }, medium, strong }]`, humans first, then by games. */
export function startingHandStats(logs) {
  const rows = new Map();
  for (const log of logs) if (log.result && Array.isArray(log.deck) && log.rules) countGame(rows, log);
  const games = (row) => HAND_CLASS_IDS.reduce((sum, id) => sum + row[id].games, 0);
  return [...rows.values()].sort((a, b) => Number(b.human) - Number(a.human) || games(b) - games(a));
}
