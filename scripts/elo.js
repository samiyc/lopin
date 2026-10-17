import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DUELS_FILE, eloTable, readDuels } from "./lib/domain/elo-data.js";

/**
 * `npm run elo`: the Elo table of the human players and every bot version,
 * from the saved games and data/elo-duels.json (src/replay/stats/elo.js).
 * `npm run elo -- --duels` first replays, in the quick duel profile, the
 * duels it has engines for, and rewrites their lines (about 20 minutes).
 */
const RERUN = [
  { a: "stratege@1.1", b: "basique@1.0", engines: ["strategist:1.1", "greedy"] },
  { a: "stratege@2.1", b: "basique@1.0", engines: ["lookahead", "greedy"] },
  { a: "experimental@0.6", b: "stratege@2.1", engines: ["experimental:0.6", "lookahead"] },
  { a: "experimental@0.7", b: "experimental@0.6", engines: ["experimental:400", "experimental:0.6"] },
  { a: "experimental@0.8", b: "experimental@0.7", engines: ["ismcts@800", "experimental@800"] },
  { a: "experimental@0.9", b: "experimental@0.8", engines: ["ismcts+widen=3+depth=5@800", "ismcts@800"] },
  { a: "experimental@1.0", b: "experimental@0.9", engines: ["ismcts+widen=3+depth=5+core=stfig6@800", "ismcts+widen=3+depth=5@800"] },
  { a: "experimental@1.1", b: "experimental@1.0", engines: ["ismcts+widen=7+depth=5+core=stfig6@2000", "ismcts+widen=3+depth=5+core=stfig6@2000"] },
  { a: "experimental@1.2", b: "experimental@1.1", engines: ["ismcts+widen=7+depth=5+core=stfig6+exact=12@2000", "ismcts+widen=7+depth=5+core=stfig6@2000"] },
];

function duel([a, b]) {
  const script = fileURLToPath(new URL("./duel.js", import.meta.url));
  const out = spawnSync(process.execPath, [script, a, b], { encoding: "utf8" }).stdout;
  const games = Number(/— (\d+) parties/.exec(out)?.[1]);
  const share = Number(/gagne ([\d,]+) %/.exec(out)?.[1].replace(",", ".")) / 100;
  return { games, wins: Math.round(share * games) };
}

if (process.argv.includes("--duels")) {
  const file = await readDuels();
  for (const pair of RERUN) {
    const { games, wins } = duel(pair.engines);
    process.stderr.write(`  ${pair.a} contre ${pair.b} : ${wins} / ${games}\n`);
    const line = { a: pair.a, b: pair.b, wins, games, source: `npm run elo -- --duels, ${new Date().toISOString().slice(0, 10)}` };
    file.duels = [...file.duels.filter((d) => !(d.a === pair.a && d.b === pair.b)), line];
  }
  await writeFile(DUELS_FILE, `${JSON.stringify(file, null, 2)}\n`);
}

const rows = await eloTable();
process.stdout.write(["Classement Elo (Basique = 500, marge à 95 %)", ...rows.map((r) => `  ${String(r.elo).padStart(5)} ±${String(r.margin).padEnd(4)} ${r.player}${r.human ? " (humain)" : ""} — ${r.games} parties`), ""].join("\n"));
