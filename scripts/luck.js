import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DUEL_ROW } from "../src/config/simulations.js";
import { parseCards } from "../src/core/notation.js";
import { rulesOf } from "../src/replay/core/log.js";
import { runPool } from "./lib/cli/pool.js";
import { REPLAY_DIRS, isSafeName } from "./lib/domain/replay-files.js";
import { playerTag } from "../src/config/bots.js";

/**
 * `npm run luck`: was it the cards? In this game each seat's cards are fixed
 * by the deck — players draw in turn from a pile whose order does not depend
 * on the moves — so a game's luck lives entirely in its deck. Each saved
 * game's deck is replayed `GAMES` times between two equal bots (Stratège 2.1
 * on both seats): the share won by the human's seat is that deck's luck for
 * them. Summed over their games, it is the score they were dealt; the rest is
 * how they played.
 */
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const GAMES = 16;
const DIRS = [REPLAY_DIRS.recent, `${REPLAY_DIRS.recent}/OLD`, REPLAY_DIRS.kept];

async function readLogs(dir) {
  const names = await readdir(join(ROOT, dir)).catch(() => []);
  const logs = await Promise.all(names.filter(isSafeName).map(async (name) => ({ name, log: JSON.parse(await readFile(join(ROOT, dir, name), "utf8")) })));
  return logs.filter(({ log }) => log.result && log.players.some((player) => player.kind === "human"));
}

const started = Date.now();
const games = (await Promise.all(DIRS.map(readLogs))).flat();
const tasks = games.flatMap(({ log }, index) => {
  const deck = parseCards(rulesOf(log.rules).spec, log.deck);
  return [0, 1].map((half) => ({ ...DUEL_ROW, players: ["lookahead", "lookahead"], games: GAMES / 2, seed: 7000 + 97 * index + half, fixedDeck: deck }));
});
const results = await runPool(new URL("./lib/workers/sim-worker.js", import.meta.url), tasks);

const rows = games.map(({ log }, index) => {
  const human = log.players.find((player) => player.kind === "human");
  const bot = log.players.find((player) => player.kind === "bot");
  const won = results[2 * index].wins[human.seat] + results[2 * index + 1].wins[human.seat];
  return { date: log.startedAt.slice(0, 16), opponent: playerTag(bot), seat: human.seat, luck: won / GAMES, won: log.result.winner === human.seat };
});

const pct = (x) => `${(100 * x).toFixed(0)} %`;
const lines = [`Chance des paquets : ${games.length} parties, chaque paquet rejoué ${GAMES} fois entre deux Stratège 2.1 (${((Date.now() - started) / 1000).toFixed(0)} s)`, ""];
for (const opponent of [...new Set(rows.map((row) => row.opponent))]) {
  const mine = rows.filter((row) => row.opponent === opponent);
  const expected = mine.reduce((sum, row) => sum + row.luck, 0);
  const actual = mine.filter((row) => row.won).length;
  const mean = (list) => (list.length ? list.reduce((sum, row) => sum + row.luck, 0) / list.length : NaN);
  lines.push(
    `Contre ${opponent} : ${mine.length} parties, ${actual} gagnées, ${expected.toFixed(1)} attendues d'après les paquets (écart ${(actual - expected).toFixed(1)})`,
    `  chance moyenne des parties gagnées : ${pct(mean(mine.filter((row) => row.won)))} · des parties perdues : ${pct(mean(mine.filter((row) => !row.won)))}`,
  );
}
lines.push("", "Partie par partie (chance = part gagnée par ta place avec ce paquet, entre robots égaux) :");
for (const row of rows.sort((a, b) => a.date.localeCompare(b.date))) {
  lines.push(`  ${row.date}  ${row.opponent.padEnd(20)} ${row.seat === 0 ? "premier" : "second "}  chance ${pct(row.luck).padStart(5)}  ${row.won ? "gagnée" : "perdue"}`);
}
process.stdout.write(`${lines.join("\n")}\n`);
