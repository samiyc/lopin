import { pickGames, readFilters } from "./lib/domain/game-filters.js";
import { runPool } from "./lib/cli/pool.js";

/**
 * `npm run branch -- [filters] [--check | --force random | --engine A]`:
 * kept bot games played again from a turn (`src/replay/core/branch.js`), on every
 * core. Filters and the starting turn: `scripts/lib/domain/game-filters.js`.
 *
 * - `--check`: the unchanged replay must give back every logged move;
 * - `--force random`: a random error at the starting turn;
 * - `--engine A`: engine A plays, from that turn, the seat of `--lost-by`
 *   (or `--won-by`), or both seats otherwise.
 *
 * With a change, the measure is who holds the game at turn 30 (exact play
 * from there), against what the kept game said (`analysis.advantage`): how
 * often the change turned it, for or against that seat.
 *
 *   npm run branch -- --lost-by experimental@0.9 --from first-border --engine ismcts+pw=1+widen=4+depth=5@800
 */
const args = process.argv.slice(2);
const filters = readFilters(args);
const check = args.includes("--check");
const force = args.includes("--force") ? args[args.indexOf("--force") + 1] : null;
const engine = args.includes("--engine") ? args[args.indexOf("--engine") + 1] : null;
const started = Date.now();
const picked = await pickGames(filters);
const who = filters.lostBy ?? filters.wonBy;
const seatOf = (row) => (who ? row.players.indexOf(who) : 0);
const enginesFor = (row) => engine && row.players.map((_, seat) => (!who || seat === seatOf(row) ? engine : null));
const tasks = picked.map(({ row, turn }) => ({ row, turn, check, force, engines: enginesFor(row) }));
const results = await runPool(new URL("./lib/workers/branch-worker.js", import.meta.url), tasks);
const minutes = `${((Date.now() - started) / 60000).toFixed(1)} min`;
const pct = (part, whole) => `${whole ? ((100 * part) / whole).toFixed(1).replace(".", ",") : "0"} %`;

if (check) {
  const same = results.filter((result) => result.reproduced).length;
  console.log(`${same} / ${results.length} parties rejouées à l'identique depuis ${filters.from} (${pct(same, results.length)}), ${minutes}`);
} else {
  const holds = (holder, row) => holder === seatOf(row);
  let [before, after] = [0, 0];
  picked.forEach(({ row }, i) => {
    before += Number(holds(row.advantage.winner, row));
    after += Number(holds(results[i].holder, row));
  });
  const change = [force && `coup forcé (${force})`, engine && `moteur ${engine}`].filter(Boolean).join(", ") || "rien";
  console.log(`${picked.length} parties depuis ${filters.from}, changement : ${change}, ${minutes}`);
  console.log(`  le joueur suivi (${who ?? "siège 1"}) tient la partie au tour 30 : ${pct(before, picked.length)} dans les parties gardées, ${pct(after, picked.length)} après le changement`);
}
