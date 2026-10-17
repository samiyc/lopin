import { rebuildIndex } from "./lib/domain/game-index.js";
import { pickGames, readFilters } from "./lib/domain/game-filters.js";

/**
 * `npm run games -- [filters]`: the kept bot games (duels/) that match, with
 * the turn each would restart from — what `npm run branch` takes. Filters:
 * `scripts/lib/domain/game-filters.js`. `--reindex` rebuilds duels/index.json from
 * the duel files first.
 *
 *   npm run games -- --lost-by experimental@0.9 --from first-border --limit 100
 */
const args = process.argv.slice(2);
if (args.includes("--reindex")) process.stderr.write(`Index refait : ${(await rebuildIndex()).length} parties\n`);
const filters = readFilters(args);
const picked = await pickGames(filters);
const turns = picked.map(({ turn }) => turn).sort((a, b) => a - b);
const span = turns.length ? ", tours " + turns[0] + " à " + turns.at(-1) : "";
console.log(`${picked.length} parties (départ : ${filters.from}${span})`);
for (const { row, turn } of picked.slice(0, 20)) {
  const result = row.winner === null ? "nul" : `gagnée par ${row.players[row.winner]}`;
  console.log(`  ${row.file}#${row.game} — ${row.players.join(" contre ")}, ${result}, mains ${row.handClasses.join("/")}, départ au tour ${turn}`);
}
if (picked.length > 20) console.log(`  … et ${picked.length - 20} autres`);
