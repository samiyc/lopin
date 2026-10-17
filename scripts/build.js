import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SAMPLE_SIZES, SEED } from "../src/config/simulations.js";
import { analyze, assertNarrative } from "../src/report/analysis.js";
import { computeExact, computeOuts, computeStartingHands } from "../src/report/data.js";
import { assembleResults, simulationTasks } from "../src/report/tasks.js";
import { tallyEssais } from "../src/irl/analysis.js";
import { renderDocument, renderFragment } from "../src/report/html/page.js";
import { renderMarkdown } from "../src/report/markdown.js";
import { injectRulesStats, renderRulesStats } from "../src/report/rules-stats.js";
import { runPool } from "./lib/cli/pool.js";

/**
 * `npm run build`: every number of every report, from scratch.
 * `--quick` shrinks the samples for iterating on the report layout.
 * `--reports-only` re-renders the reports from the existing out/data.json.
 */
const quick = process.argv.includes("--quick");
const reportsOnly = process.argv.includes("--reports-only");
const sizes = quick ? SAMPLE_SIZES.quick : SAMPLE_SIZES.full;
const outDir = fileURLToPath(new URL("../out/", import.meta.url));
const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;
const log = (message) => process.stdout.write(`${message}\n`);
const write = (name, content) => writeFileSync(join(outDir, name), content);

async function compute() {
  log(`Build ${quick ? "rapide" : "complet"} — graine ${SEED}`);
  const exact = computeExact();
  log(`  mains de 3 cartes : énumération exacte (${elapsed()})`);
  const outs = computeOuts();
  const startingHands = computeStartingHands(sizes.startingHands);
  log(`  mains de départ : ${sizes.startingHands} tirages par paquet (${elapsed()})`);
  const tasks = simulationTasks(sizes);
  const results = await runPool(new URL("./lib/workers/sim-worker.js", import.meta.url), tasks, {
    onProgress: (done, total) => {
      if (done % 100 === 0 || done === total) log(`  parties : ${done}/${total} lots (${elapsed()})`);
    },
  });
  const { simulations, duels, solo } = assembleResults(tasks, results);
  const irl = tallyEssais();
  log(`  parties réelles : ${irl.games} photos, optimum de chaque ligne (${elapsed()})`);
  return {
    generatedAt: new Date().toISOString(),
    seed: SEED,
    quick,
    sizes,
    exact,
    outs,
    startingHands,
    simulations,
    duels,
    solo,
    irl,
  };
}

mkdirSync(join(outDir, "artifact"), { recursive: true });
const data = reportsOnly ? JSON.parse(readFileSync(join(outDir, "data.json"), "utf8")) : await compute();
if (!reportsOnly) write("data.json", JSON.stringify(data, null, 1));

const findings = assertNarrative(analyze(data));
write("deck-options.md", renderMarkdown(findings, data));
write("deck-options.html", renderDocument(findings, data));
write(join("artifact", "deck-options.html"), renderFragment(findings, data));

// The rules sheet carries a statistics box; only the block between its markers is rewritten.
const rulesPath = fileURLToPath(new URL("../regles/regles.html", import.meta.url));
const rules = readFileSync(rulesPath, "utf8");
const updated = injectRulesStats(rules, renderRulesStats(findings));
if (updated !== rules) writeFileSync(rulesPath, updated);
log(`Terminé en ${elapsed()} → out/deck-options.md, out/deck-options.html, regles/regles.html`);
