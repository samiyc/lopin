import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runPool, workerCount } from "./lib/cli/pool.js";

/**
 * `npm run selfplay -- [engine] [--minutes N]`: the engine plays itself on
 * every core for N minutes (20 at most), and the games are written, as
 * replay logs, to selfplay/<engine>.json (ignored by git). They feed the
 * pattern mining (docs/strategie.md) and the endgame puzzles.
 */
const args = process.argv.slice(2);
const engine = args.find((arg) => !arg.startsWith("--") && !/^\d+$/.test(arg)) ?? "experimental:80";
const minutes = Math.min(20, Number(args[args.indexOf("--minutes") + 1]) || 20);
const threads = workerCount();
const started = Date.now();
const tasks = Array.from({ length: threads }, (_, i) => ({ engine, seconds: minutes * 60, seed: 424242 + 104729 * i }));
const logs = (await runPool(new URL("./lib/workers/selfplay-worker.js", import.meta.url), tasks)).flat();
const dir = fileURLToPath(new URL("../selfplay/", import.meta.url));
await mkdir(dir, { recursive: true });
const file = `${dir}${engine.replace(/[^\w-]/g, "_")}.json`;
await writeFile(file, JSON.stringify(logs));
process.stdout.write(`${logs.length} parties ${engine} contre lui-même en ${((Date.now() - started) / 60000).toFixed(1)} min → ${file}\n`);
