import { readFile, writeFile } from "node:fs/promises";
import { FIGURES } from "../src/core/figures.js";
import { applyThreadsOption, runPool } from "./lib/cli/pool.js";

/**
 * `npm run extension -- [--games 400] [--engine core:stfig6] [--threads N|max]`:
 * the extension's balance (docs/extension.md, Sami 07/10). Whole games at the
 * page's rule, the same engine on both sides, for eight piles: no figure (the
 * control), each figure alone, and all six. For each figure: how often it is
 * laid, when, and how often whoever laid it wins the border and the game —
 * above 60 % it is too strong. For each pile: the first player's share and
 * the length of a game.
 *
 * Writes data/extension.json and the page out/extension.html (with its
 * artifact copy), from src/report/extension.html.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
applyThreadsOption(args);
const games = Number(option("--games", 400));
const engine = option("--engine", "core:stfig6");
// `--only sum`: the control pile and that figure's alone. A side measure (another engine, or one
// figure) goes to data/extension-<tag>.json and leaves the page alone, which shows the main one.
const only = option("--only", null);
const tag = [only, engine === "core:stfig6" ? null : "tree"].filter(Boolean).join("-");
const ROOT = new URL("../", import.meta.url);
const CHUNK = 20;

const ALL_CONFIGS = [
  { config: "none", label: "sans figure", figures: [] },
  ...FIGURES.map((figure) => ({ config: figure.key, label: `${figure.text} seul`, figures: [figure.id] })),
  { config: "all", label: "les six", figures: FIGURES.map((figure) => figure.id) },
];
const CONFIGS = only ? ALL_CONFIGS.filter((config) => config.config === "none" || config.config === only) : ALL_CONFIGS;

const share = (part, whole) => (whole > 0 ? part / whole : null);
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
/** The 95 % half-width of a share over `n` games. */
const margin = (p, n) => (n > 0 && p !== null ? 1.96 * Math.sqrt((p * (1 - p)) / n) : null);

/** One pile: the first player's share, the length, and every figure laid in it. */
function pileOf(config, list) {
  const firstWins = list.filter((game) => game.winner === 0).length;
  return { config: config.config, label: config.label, games: list.length, firstPlayer: share(firstWins, list.length), turns: mean(list.map((game) => game.turns)) };
}

/** One figure, over every pile it was in: laid how often, when, and what came of it for whoever laid it. */
function figureOf(figure, results) {
  const piles = results.filter(({ config }) => CONFIGS.find((c) => c.config === config).figures.includes(figure.id));
  const gamesIn = piles.reduce((sum, { games: list }) => sum + list.length, 0);
  const laid = piles.flatMap(({ games: list }) => list).flatMap((game) => game.laid).filter((entry) => entry.key === figure.key);
  const wonGame = share(laid.filter((entry) => entry.wonGame).length, laid.length);
  return {
    key: figure.key,
    text: figure.text,
    name: figure.name,
    rule: figure.rule,
    gamesIn,
    laid: laid.length,
    laidRate: share(laid.length, gamesIn),
    meanTurn: mean(laid.map((entry) => entry.turn)),
    wonBorder: share(laid.filter((entry) => entry.wonBorder).length, laid.length),
    wonGame,
    margin: margin(wonGame, laid.length),
    tooStrong: wonGame !== null && wonGame > 0.6,
  };
}

const started = Date.now();
/** The seeds of chunk `k` of pile `c`: every pile has its own deals. */
const seedsOf = (c, k) => Array.from({ length: Math.min(CHUNK, games - k * CHUNK) }, (_, i) => 100_000 * (c + 1) + k * CHUNK + i);
const tasks = CONFIGS.flatMap((config, c) => Array.from({ length: Math.ceil(games / CHUNK) }, (_, k) => ({ config: config.config, figures: config.figures, engine, seeds: seedsOf(c, k) })));
const chunks = await runPool(new URL("./lib/workers/extension-worker.js", import.meta.url), tasks);
const results = CONFIGS.map((config) => ({ config: config.config, games: chunks.filter((chunk) => chunk.config === config.config).flatMap((chunk) => chunk.games) }));
const data = {
  built: new Date().toISOString(),
  engine,
  gamesPerPile: games,
  minutes: +((Date.now() - started) / 60000).toFixed(1),
  piles: results.map(({ config, games: list }) => pileOf(CONFIGS.find((c) => c.config === config), list)),
  figures: FIGURES.filter((figure) => !only || figure.key === only).map((figure) => figureOf(figure, results)),
};
const OUT_NAME = tag ? "extension-" + tag : "extension";
await writeFile(new URL(`data/${OUT_NAME}.json`, ROOT), `${JSON.stringify(data, null, 1)}\n`);

/** As the changelogs: the page without its skeleton for the artifact, wrapped for out/ (the Versions menu). */
async function writePage() {
  const template = await readFile(new URL("src/report/extension.html", ROOT), "utf8");
  // The data lands inside a <script>: "</" is escaped so no text in it can close the tag.
  const page = template.replace("/*__DATA__*/null", JSON.stringify(data).replaceAll("</", "<\\/"));
  await writeFile(new URL("out/artifact/extension.html", ROOT), page);
  const cut = page.indexOf('<header class="band">');
  const head = '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n';
  await writeFile(new URL("out/extension.html", ROOT), `${head}${page.slice(0, cut)}</head>\n<body>\n${page.slice(cut)}</body>\n</html>\n`);
}
if (!tag) await writePage();

const pct = (x) => (x === null ? "—" : `${(100 * x).toFixed(1).replace(".", ",")} %`);
console.log(`${games} parties par pioche, ${CONFIGS.length} pioches, ${engine} des deux côtés — ${data.minutes} min`);
for (const pile of data.piles) console.log(`  ${pile.label.padEnd(12)} premier joueur ${pct(pile.firstPlayer)} · ${pile.turns.toFixed(1)} tours`);
for (const f of data.figures) console.log(`  ${f.text} ${f.rule.padEnd(22)} posée ${pct(f.laidRate)} des parties, au tour ${f.meanTurn?.toFixed(0) ?? "—"} · borne gagnée ${pct(f.wonBorder)} · partie gagnée ${pct(f.wonGame)} ± ${pct(f.margin)}${f.tooStrong ? "  ← trop forte" : ""}`);
console.log(tag ? `→ data/extension-${tag}.json` : "→ data/extension.json, out/extension.html");
