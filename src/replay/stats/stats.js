import { FORMATIONS } from "../../config/formations.js";
import { startingHandStats } from "./hand-stats.js";
import { playerTag } from "../../config/bots.js";

/**
 * What the "Stats" tab shows, from the saved games: for each human and each
 * bot version they met, games, wins (overall, first, second), time played
 * and thinking time; and, for the humans and for the bots, which of the five
 * formations won their borders. Pure, tested; the server feeds it the logs.
 */
const zero = () => Object.fromEntries(FORMATIONS.map((formation) => [formation, 0]));

function lineFor(lines, human, bot) {
  const key = `${human.name}|${playerTag(bot)}`;
  if (!lines.has(key)) {
    lines.set(key, { human: human.name, opponent: playerTag(bot), games: 0, won: 0, first: { games: 0, won: 0 }, second: { games: 0, won: 0 }, activeMs: 0, timedGames: 0, thinkMs: 0, timedMoves: 0 });
  }
  return lines.get(key);
}

function countGame(line, log, human) {
  const won = log.result.winner === human.seat;
  const seat = human.seat === 0 ? line.first : line.second;
  line.games += 1;
  seat.games += 1;
  if (won) {
    line.won += 1;
    seat.won += 1;
  }
  if (typeof log.result.activeMs === "number") {
    line.activeMs += log.result.activeMs;
    line.timedGames += 1;
  }
  for (const turn of log.turns) {
    if (turn.player !== human.seat || typeof turn.thinkMs !== "number") continue;
    line.thinkMs += turn.thinkMs;
    line.timedMoves += 1;
  }
}

function countBorders(formations, log, human) {
  for (const border of log.result.borders ?? []) {
    if (border.winner === null || border.winner === undefined) continue;
    const side = border.winner === human.seat ? formations.human : formations.bot;
    side[border.formations[border.winner]] += 1;
  }
}

/** `{ lines, formations: { human, bot }, hands }` from finished games between a human and a bot (`hands`: `hand-stats.js`). */
export function statsOf(logs) {
  const lines = new Map();
  const formations = { human: zero(), bot: zero() };
  for (const log of logs) {
    const human = log.players.find((player) => player.kind === "human");
    const bot = log.players.find((player) => player.kind === "bot");
    if (!human || !bot || !log.result) continue;
    countGame(lineFor(lines, human, bot), log, human);
    countBorders(formations, log, human);
  }
  return { lines: [...lines.values()], formations, hands: startingHandStats(logs) };
}
