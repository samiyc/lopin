import { BOT_LINEUP } from "../../../src/config/bots.js";
import { startLog } from "../../../src/replay/core/log.js";
import { createClock } from "../board/clock.js";
import { sortBySuit } from "../board/hand.js";
import { RULES, SPEC, botEntry, botPlayer, humanEntry, newGame, playerName } from "../replays/runner.js";
import { createThinker } from "./thinker.js";

/**
 * What a "Jouer" game holds when it starts (play.js drives it): the state, the
 * seats, the bot's thinker, the log, the hand's order and the input in
 * progress. `bonus` figures of the extension join the pile; `openHands` shows
 * both hands, and is written into the log's rules so the replay shows them too.
 */
export function createPlayGame({ first, opponent, name, bonus = 0, openHands = false }, seed) {
  const state = newGame(seed, bonus, openHands);
  const human = first === "me" ? 0 : 1;
  const players = [humanEntry(human, name), botEntry(1 - human, opponent)].sort((a, b) => a.seat - b.seat);
  const rules = { ...RULES, ...(bonus > 0 ? { bonus } : {}), ...(openHands ? { openHands: true } : {}) };
  return {
    state,
    human,
    openHands: Boolean(openHands),
    name,
    opponentName: playerName(botEntry(1 - human, opponent)),
    thinker: createThinker(botPlayer(opponent, seed + 1), BOT_LINEUP[opponent].think, seed + 1),
    log: startLog(state, { rules, players, seed }),
    order: sortBySuit(SPEC, state.hands[human]),
    selected: null,
    // The Dame de Cœur's first border, or the Valet de Trèfle waiting for its discard (figure-input.js).
    pending: null,
    premove: null,
    shown: 0,
    lastMove: null,
    revealing: false,
    saved: null,
    clock: createClock(() => performance.now()),
  };
}
