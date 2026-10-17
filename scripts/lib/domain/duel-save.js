import { mkdir, writeFile } from "node:fs/promises";
import { BOT_LINEUP } from "../../../src/config/bots.js";
import { localTimestamp } from "../../../src/replay/core/log.js";
import { isSlowEngine } from "./duel-plan.js";
import { DUELS_DIR, readIndex, rowOf, writeIndex } from "./game-index.js";

/**
 * Keeping a duel's games as replays (`src/replay/core/bot-games.js`), in duels/
 * (ignored by git): one file per duel, its settings and every new game, and
 * a row per game in duels/index.json (`game-index.js`). A game already kept —
 * same rules, deck, players and seed (`gameKey`) — is not written twice.
 *
 * Saved when asked (`--save`), and whenever the games are solid enough to
 * build on: a long duel, or one where every bot plays at full strength — a
 * line-up version, or a search of 800 iterations or more, or on a clock
 * (`@t`). A core alone, which plays thousands of games, is kept only when asked.
 */
const LINEUP_ENGINES = new Set(Object.values(BOT_LINEUP).map((bot) => bot.engine));

const solid = (engine) => {
  if (LINEUP_ENGINES.has(engine)) return true;
  // A core alone (`core:nb1`, `strategist`…) plays thousands of games in seconds: kept only with --save.
  if (!isSlowEngine(engine)) return false;
  const budget = /@(t?)(\d+)/.exec(engine);
  return Boolean(budget) && (budget[1] === "t" || Number(budget[2]) >= 800);
};

export const shouldSave = ({ asked, profileName, engines }) => asked || profileName === "long" || engines.every(solid);

/** How often the side holding the game once the pile is empty went on to win it. */
function advantageSummary(logs) {
  const advantages = logs.map((log) => ({ advantage: log.analysis.advantage, winner: log.result.winner }));
  const ended = advantages.filter(({ advantage }) => advantage.ended).length;
  const solved = advantages.filter(({ advantage }) => !advantage.ended && Number.isInteger(advantage.value));
  const held = solved.filter(({ advantage, winner }) => advantage.winner === winner).length;
  const pct = solved.length ? Math.round((100 * held) / solved.length) : 0;
  return `${ended} finies avant le tour 30 ; sur les ${solved.length} résolues au tour 30, le camp en avance gagne dans ${pct} %`;
}

/** Writes the duel's new games and their index rows, and returns a line for the report. */
export async function saveDuel({ a, b, engines, settings, logs }) {
  await mkdir(DUELS_DIR, { recursive: true });
  const rows = await readIndex();
  const known = new Set(rows.map((row) => row.key));
  const name = `${localTimestamp().slice(0, 19).replace(/[:T]/g, "-")}_${a}_vs_${b}.json`.replace(/[^\w.@+=-]/g, "_");
  const fresh = [];
  for (const log of logs) {
    const row = rowOf(name, fresh.length, log);
    if (known.has(row.key)) continue;
    known.add(row.key);
    fresh.push(log);
    rows.push(row);
  }
  const duplicates = logs.length - fresh.length;
  const skipped = duplicates ? `, ${duplicates} doublons ignorés` : "";
  if (fresh.length === 0) return `  replays : aucune partie nouvelle (${duplicates} doublons ignorés)`;
  await writeFile(`${DUELS_DIR}${name}`, JSON.stringify({ format: "lopin-duel/1", a, b, engines, ...settings, games: fresh }));
  await writeIndex(rows);
  return `  replays : ${fresh.length} parties → duels/${name}${skipped} (${advantageSummary(fresh)})`;
}
