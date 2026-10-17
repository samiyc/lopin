import { filterRows, readIndex, startTurn } from "./game-index.js";

/**
 * The filters `npm run games`, `npm run branch` and `npm run error-impact`
 * share, read from the command line:
 *
 *   --lost-by experimental@0.9   games that player lost (or --won-by)
 *   --hands weak|medium|strong     that player's starting hand
 *   --balanced                     both starting hands medium
 *   --vs experimental@0.9        games where both seats are that player
 *   --from first-border|columns|N  the turn to start from (default 15)
 *   --limit 100                    how many games at most
 */
export function readFilters(args) {
  const value = (flag, fallback = null) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  return {
    lostBy: value("--lost-by"),
    wonBy: value("--won-by"),
    hands: value("--hands"),
    balanced: args.includes("--balanced"),
    vs: value("--vs"),
    from: value("--from", "15"),
    limit: Number(value("--limit", "100")),
  };
}

/** The matching rows, each with the turn to start from; games without that turn (no border won…) are left out. */
export async function pickGames(filters) {
  const rows = filterRows(await readIndex(), filters).filter((row) => !filters.vs || row.players.every((player) => player === filters.vs));
  return rows
    .map((row) => ({ row, turn: startTurn(row, filters.from) }))
    .filter(({ row, turn }) => turn !== null && turn >= 1 && turn <= row.turns)
    .slice(0, filters.limit);
}
