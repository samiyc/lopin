import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `npm run agents -- [<dossier>]`: the summary of a batch of agents' games
 * against the bots (Sami, 12/10; docs/agents/). Reads every replay under the
 * folder (by default duels/agents/), and prints, per player: games, wins
 * against the bot, by seat (first / second), how the wins came (three
 * adjacent, majority), and the share of moves with a reason (`note`, from
 * `--why`); then the games the agents won, the ones to diagnose (piste 3).
 */
const root = fileURLToPath(new URL("../duels/agents/", import.meta.url));
const dir = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : root;

async function replaysUnder(folder) {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => replaysUnder(join(folder, entry.name))));
  return [...entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => join(folder, entry.name)), ...nested.flat()];
}

const pct = (part, whole) => (whole === 0 ? "—" : `${((100 * part) / whole).toFixed(0)} %`);

const rows = new Map();
const wins = [];
for (const path of await replaysUnder(dir)) {
  const log = JSON.parse(await readFile(path, "utf8"));
  if (!log.result) continue;
  const human = log.players.find((player) => player.kind === "human");
  const bot = log.players.find((player) => player.kind === "bot");
  const key = `${human.name} contre ${bot.bot}@${bot.version}`;
  const row = rows.get(key) ?? { games: 0, won: 0, first: [0, 0], second: [0, 0], adjacent: 0, majority: 0, moves: 0, notes: 0 };
  const won = log.result.winner === human.seat;
  const seat = human.seat === 0 ? row.first : row.second;
  seat[0] += Number(won);
  seat[1] += 1;
  row.games += 1;
  row.won += Number(won);
  if (won) row[log.result.winType === "adjacent" ? "adjacent" : "majority"] += 1;
  const turns = log.turns.filter((turn) => turn.player === human.seat && !turn.pass);
  row.moves += turns.length;
  row.notes += turns.filter((turn) => turn.note).length;
  rows.set(key, row);
  if (won) wins.push(path);
}

console.log(`# Les parties d'agents (${dir})\n`);
console.log("| Joueur | Parties | Gagnées | En commençant | En second | 3 voisines / 4 bornes | Coups avec une raison |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const [key, row] of [...rows].sort((a, b) => b[1].won / b[1].games - a[1].won / a[1].games)) {
  console.log(`| ${key} | ${row.games} | ${row.won} (${pct(row.won, row.games)}) | ${row.first[0]}/${row.first[1]} | ${row.second[0]}/${row.second[1]} | ${row.adjacent} / ${row.majority} | ${pct(row.notes, row.moves)} |`);
}
const total = [...rows.values()].reduce((sum, row) => ({ games: sum.games + row.games, won: sum.won + row.won }), { games: 0, won: 0 });
console.log(`\nEn tout : ${total.won} victoires sur ${total.games} parties (${pct(total.won, total.games)}).`);
if (wins.length > 0) console.log(["", "Les parties gagnées, à diagnostiquer (piste 3) :", ...wins.map((path) => "- " + path)].join("\n"));
