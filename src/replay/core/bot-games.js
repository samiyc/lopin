import { createRng } from "../../core/random.js";
import { engineFor } from "../../sim/bots.js";
import { createGame, legalMoves } from "../../sim/engine/game.js";
import { gameRules } from "../../sim/engine/simulate.js";
import { analyseGame } from "./game-analysis.js";
import { candidatesOf, finishLog, playLogged, startLog } from "./log.js";

/**
 * Duels between bots, kept as replays (`npm run duel -- … --save`, and every
 * long or full-strength duel), so later tests can start from them instead of
 * replaying whole games (Sami, after merlin-is-dead).
 *
 * Each game is an ordinary replay log — deck, every move — plus `analysis`
 * (`game-analysis.js`): starting hands, turning points, who holds the game
 * at turn 30.
 *
 * Each game builds its own bots from its own seed (`log.seed`, and the seat:
 * `seatRng`), so that `branch.js` can build them again and replay any game
 * from any turn — same deck, same pile, same bots.
 */

/** The random stream a seat's bot is built from, in game `log.seed`. */
export const seatRng = (seed, seat) => createRng((Math.imul(seed, 2) + seat + 1) >>> 0);

/**
 * A bot's move, with the scores it chose from when it has them (`pick`, the
 * searches): the replay keeps its best candidates, so a game played by the
 * oracle carries its opinion at every move (Sami, 03/10).
 */
// A duel keeps 12 candidates a move, the page 5: the oracle's games then carry most of its opinion (banc.js).
const DUEL_CANDIDATES = 12;
const choice = (bot, state, moves) => (bot.pick ? bot.pick(state, moves) : { move: bot.choose(state, moves), scored: null });

/** One game between `players` (engine ids), logged, with its analysis. */
function recordedGame(spec, rules, { players, seats, seed }) {
  const bots = players.map((id, seat) => engineFor(id)(seatRng(seed, seat)));
  const state = createGame(spec, { ...rules, rng: createRng(seed) });
  const log = startLog(state, { rules: rules.ids, players: seats, seed });
  while (!state.over) {
    const moves = legalMoves(state);
    const { move, scored } = moves.length > 0 ? choice(bots[state.current], state, moves) : { move: null, scored: null };
    const entry = playLogged(log, state, move, scored);
    if (entry.candidates) entry.candidates = candidatesOf(spec, scored, DUEL_CANDIDATES);
  }
  finishLog(log, state);
  log.analysis = analyseGame(log);
  return log;
}

/**
 * `playBatch` (`simulate.js`) for duels to keep: the same decks, but every
 * game logged, with bots of its own. `labels`: how each seat is named in the
 * logs (a line-up tag such as "experimental@0.9", or the engine id); `ids`:
 * the rules as ids (deck, jokerRule, order). Returns `{ wins, winners, logs }`.
 */
export function playRecordedBatch(spec, { games, seed, players, labels, ids, ...options }) {
  const seats = players.map((engine, seat) => ({ seat, kind: "bot", bot: engine, version: labels?.[seat] ?? engine }));
  const result = { wins: [0, 0], draws: 0, winners: [], logs: [] };
  for (let g = 0; g < games; g += 1) {
    const rules = gameRules(spec, options, g);
    // A seat compensation (seat-rules.js) is written into the rules, so the replay deals and peeks as played.
    const seat = rules.seat ? { seat: rules.seat.id } : {};
    const log = recordedGame(spec, { ...rules, ids: { ...ids, endMode: rules.endMode, ...seat } }, { players, seats, seed: seed + g });
    const { winner } = log.result;
    if (winner === null) result.draws += 1;
    else result.wins[winner] += 1;
    result.winners.push(winner);
    result.logs.push(log);
  }
  return result;
}

/** The games whose two starting hands are both medium: a middle game balanced enough to compare one change. */
export const balancedGames = (logs) => logs.filter((log) => log.analysis?.handClasses.every((kind) => kind === "medium"));
