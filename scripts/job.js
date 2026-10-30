import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { localTimestamp } from "../src/replay/core/log.js";
import { applyThreadsOption, workerCount } from "./lib/cli/pool.js";
import { heatSettings, watchHeat, watchMemory } from "mcts-commun/machine.js";
import { runCommand } from "./lib/cli/run-command.js";
import { appendJobLog, jobKind, jobLine } from "./lib/domain/job-log.js";
import { readFileSync } from "node:fs";

/**
 * `npm run job -- [--threads N] [--id name] <command>` (Sami, 22/10): runs a job started by hand, by day
 * as by night, and writes its line to the job log (data/job-log/, scripts/lib/domain/job-log.js) as the
 * backlog does for its own. The command is one quoted argument or the rest of the line:
 *
 *   npm run job -- --threads 6 "npm run duel -- ismcts@400 strategist --games 50 --page"
 *
 * Its output goes to the screen and to backlog-runs/<date>_<id>.txt (ignored by git). The CPU's temperature is
 * logged when readable; no heat guard here: a job started by hand has someone to watch it.
 */
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
applyThreadsOption(args);
const flagged = new Set(["--threads", "--id"].flatMap((flag) => (args.includes(flag) ? [args.indexOf(flag), args.indexOf(flag) + 1] : [])));
const words = args.filter((_, i) => !flagged.has(i));
const command = words.map((word) => (words.length > 1 && /\s/.test(word) ? `"${word}"` : word)).join(" ");
if (!command) {
  process.stderr.write('Usage : npm run job -- [--threads N] [--id nom] "<commande>"\n');
  process.exit(1);
}
const stamp = localTimestamp().slice(0, 16).replace(/[:T]/g, "-");
const id = args.includes("--id") ? args[args.indexOf("--id") + 1] : `${jobKind(command)}-${stamp}`;
const output = `backlog-runs/${stamp}_${id}.txt`;
await mkdir(`${ROOT}backlog-runs/`, { recursive: true });
const memory = watchMemory();
const temperature = watchHeat({ settings: { ...heatSettings(), alert: 0 } });
const started = new Date();
const code = await runCommand(command, { outFile: `${ROOT}${output}` });
const status = code === 0 ? "done" : "failed";
const text = readFileSync(`${ROOT}${output}`, "utf8");
const line = jobLine({ id, command, threads: workerCount(), started, ended: new Date(), status, output: text, memory: memory.stop(), temperature: temperature.stop(), source: "job" });
await appendJobLog(line);
console.log(`■ ${id} : ${status}, ${line.minutes} min, ${line.threads} fils → ${output} (journal : data/job-log/)`);
process.exit(typeof code === "number" ? code : 1);
