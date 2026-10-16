import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DECKS } from "../src/config/decks.js";
import { DUEL_ROW } from "../src/config/simulations.js";
import { parseCards } from "../src/core/notation.js";

/**
 * `npm run deal-pool -- [--min-games 10] [--band 0.3,0.7] [--with-verdicts] [--duels dir]`: the pools of disputed deals, from
 * the kept duels (duels/, Sami 16/10). Every game of two tree bots at 2 000 iterations or more, at the page's
 * rule, is grouped by deck; a deck played at least `--min-games` times whose first seat won within `--band` is
 * disputed in the real game — both seats can win it, so a mirrored pair of it can tell two versions apart.
 * Omniscient 1.0 could not pick those (docs/1.3-to-oracle-shift.md: it sees who a deal favours, not whether it
 * is disputed); the real games can, and their pool grows with every duel kept.
 *
 * The deals of the version duels (offsets 0 to 3, the 1k@2k) are left out unless `--with-verdicts`: a pool
 * screens ideas, the verdict stays on those decks. The deals go one in two to data/deal-pools/pool-a.json and
 * reserve.json, as decks (card ids in order), for `npm run duel -- a b --pool <file>`.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const MIN = Number(option("--min-games", 10));
const [LOW, HIGH] = option("--band", "0.3,0.7").split(",").map(Number);
const WITH_VERDICTS = args.includes("--with-verdicts");
const ROOT = new URL("../", import.meta.url);
// `--duels <dir>`: another folder of kept duels (a worktree reads the main checkout's).
const DIR = args.includes("--duels") ? pathToFileURL(`${option("--duels", "")}/`) : new URL("duels/", ROOT);
const spec = DECKS[DUEL_ROW.deck];

const strong = (engine) => /^ismcts/.test(engine) && Number((engine.match(/@(\d+)$/) ?? [0, 0])[1]) >= 2000;
const decks = new Map();
const verdictDecks = new Set();
let duels = 0;
for (const name of (await readdir(DIR)).filter((file) => file.endsWith(".json"))) {
  const duel = JSON.parse(await readFile(new URL(name, DIR), "utf8"));
  const forVerdicts = (duel.offset ?? 0) <= 3;
  for (const game of duel.games ?? []) if (forVerdicts) verdictDecks.add(game.deck.join(" "));
  if (duel.endMode !== "claim-end" || !(duel.engines ?? []).every(strong)) continue;
  duels += 1;
  for (const game of duel.games ?? []) {
    const key = game.deck.join(" ");
    const entry = decks.get(key) ?? { deck: game.deck, games: 0, first: 0 };
    entry.games += 1;
    entry.first += game.result.winner === null ? 0.5 : Number(game.result.winner === 0);
    decks.set(key, entry);
  }
}
const played = [...decks.entries()].filter(([, entry]) => entry.games >= MIN);
const eligible = played.filter(([key]) => WITH_VERDICTS || !verdictDecks.has(key));
const disputed = eligible.filter(([, { games, first }]) => first / games >= LOW && first / games <= HIGH).map(([, entry]) => entry);
const toPool = (entries, name) => ({ name, source: "duels/", minGames: MIN, band: [LOW, HIGH], withVerdicts: WITH_VERDICTS, decks: entries.map((entry) => parseCards(spec, entry.deck)), shares: entries.map((entry) => Number((entry.first / entry.games).toFixed(3))), games: entries.map((entry) => entry.games) });
const out = new URL("data/deal-pools/", ROOT);
await mkdir(out, { recursive: true });
await writeFile(new URL("pool-a.json", out), `${JSON.stringify(toPool(disputed.filter((_, i) => i % 2 === 0), "DealsA"))}\n`);
await writeFile(new URL("reserve.json", out), `${JSON.stringify(toPool(disputed.filter((_, i) => i % 2 === 1), "DealsReserve"))}\n`);
console.log(`${duels} duels (arbres @2000+, règle de la page), ${decks.size} donnes, ${played.length} jouées au moins ${MIN} fois, ${eligible.length} hors verdicts${WITH_VERDICTS ? " (verdicts compris)" : ""}`);
console.log(`${disputed.length} disputées (${LOW * 100}-${HIGH * 100} % pour le premier joueur) → ${fileURLToPath(new URL("pool-a.json", out))} (${Math.ceil(disputed.length / 2)}) et reserve.json (${Math.floor(disputed.length / 2)})`);
