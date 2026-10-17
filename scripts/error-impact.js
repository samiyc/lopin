import { readIndex, startTurn } from "./lib/domain/game-index.js";
import { runPool } from "./lib/cli/pool.js";

/**
 * `npm run error-impact -- [--turns 18-29 | --turns 2,6,10] [--points]
 * [--games 120] [--player experimental@0.9] [--explain]`: at which turn
 * does an error cost the most? (Sami, evol-exp-090)
 *
 * On kept games where both seats are that player and both starting hands are
 * medium (duels/), a random legal move other than the one played is forced on
 * the player to move at turn T; the same bots play on to turn 30, and the
 * exact solver says who holds the game then. Two controls play on from the
 * same position with no error, only the bots' seed changed (`reseed` 1 and
 * 2): early in a game any change reshuffles what follows, and comparing with
 * the kept game would measure that chaos, not the error. The impact at T is
 * how much less often the player who erred holds the game than in the
 * controls (their mean), game by game, with its 95 % interval.
 *
 * `--points` adds two turning points: the move that puts a player on all
 * seven borders, and the move that wins the first border. `--explain`
 * compares a few traits of the position between the errors that turned the
 * game and those that did not.
 */
const args = process.argv.slice(2);
const option = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const player = option("--player", "experimental@0.9");
const games = Number(option("--games", 120));
const explain = args.includes("--explain");

/** "18-29" → every turn of the range; "2,6,10" → those turns. */
function turnsOf(text) {
  if (text.includes("-")) {
    const [from, to] = text.split("-").map(Number);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
  return text.split(",").map(Number);
}

const series = [
  ...turnsOf(option("--turns", "2,6,10,14,18,22,26,29")).map((turn) => ({ label: `tour ${turn}`, from: String(turn) })),
  ...(args.includes("--points") ? [{ label: "7 bornes entamées", from: "columns" }, { label: "1re borne gagnée", from: "first-border" }] : []),
];
const started = Date.now();
const rows = (await readIndex()).filter(
  (row) => row.players.every((name) => name === player) && row.handClasses.every((kind) => kind === "medium") && !row.advantage.ended && Number.isInteger(row.advantage.value),
);
const cases = series.flatMap(({ label, from }) =>
  rows
    .map((row) => ({ label, row, turn: startTurn(row, from) }))
    .filter(({ turn }) => turn !== null && turn >= 1 && turn <= 30)
    .slice(0, games),
);
// Three runs per case: the error, and two controls without it.
const tasks = cases.flatMap(({ row, turn }) => [{ row, turn, force: "random", explain }, { row, turn, reseed: 1 }, { row, turn, reseed: 2 }]);
const results = await runPool(new URL("./lib/workers/branch-worker.js", import.meta.url), tasks);

// The player to move before move T is the one who erred: seat 0 moves first.
const done = cases.map((entry, i) => {
  const mover = (entry.turn - 1) % 2;
  const [error, ...controls] = results.slice(3 * i, 3 * i + 3);
  const holds = (result) => Number(result.holder === mover);
  return { ...entry, error: holds(error), control: (holds(controls[0]) + holds(controls[1])) / 2, traits: error.traits };
});

const pct = (share) => `${(100 * share).toFixed(1).replace(".", ",")} %`;
const meanOf = (values) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
console.log(`# Le prix d'une erreur, tour par tour — ${player} contre lui-même, mains moyennes, ${rows.length} parties gardées\n`);
console.log("| Erreur au tour | Parties | Le fautif tient la partie au tour 30 : témoins sans erreur | avec l'erreur | Impact (± 95 %) |");
console.log("| --- | --- | --- | --- | --- |");
for (const { label } of series) {
  const list = done.filter((entry) => entry.label === label);
  const diffs = list.map((entry) => entry.control - entry.error);
  const mean = meanOf(diffs);
  const sd = Math.sqrt(diffs.reduce((sum, d) => sum + (d - mean) ** 2, 0) / Math.max(1, diffs.length - 1));
  console.log(`| ${label} | ${list.length} | ${pct(meanOf(list.map((e) => e.control)))} | ${pct(meanOf(list.map((e) => e.error)))} | ${pct(mean)} ± ${pct((1.96 * sd) / Math.sqrt(Math.max(1, list.length)))} |`);
}

if (explain) {
  // An error "turned" the game when both controls held it and the error did not.
  const turned = done.filter((entry) => entry.control === 1 && entry.error === 0);
  const harmless = done.filter((entry) => entry.control === entry.error);
  console.log(`\n## Ce qui distingue une erreur qui fait basculer la partie (${turned.length}) d'une erreur sans effet (${harmless.length})\n`);
  console.log("| Trait de la position, pour le fautif | Erreur qui fait basculer | Erreur sans effet |");
  console.log("| --- | --- | --- |");
  const labels = { contested: "bornes disputées (2 cartes de chaque côté)", chasing: "bornes où il est à 2 cartes, l'adversaire complet", open: "bornes encore ouvertes de son côté", jokers: "jokers en main", pile: "cartes dans la pioche" };
  for (const [key, label] of Object.entries(labels)) {
    const avg = (list) => meanOf(list.map((entry) => entry.traits[key])).toFixed(2).replace(".", ",");
    console.log(`| ${label} | ${avg(turned)} | ${avg(harmless)} |`);
  }
}
console.log(`\nDurée : ${((Date.now() - started) / 60000).toFixed(1)} min`);
