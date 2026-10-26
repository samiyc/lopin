import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { stopReason } from "../src/schedule/stop.js";

/**
 * `node scripts/stop-check.js ID`: the `skipIf` of a lopin job in the machine's queue (Sami, 26/10/2026: lopin's
 * backlog runs on mcts-commun's mcts-backlog, its stopIf stays lopin's). mcts-backlog runs it in lopin's folder just
 * before the job: it reads the job and the duels its `stopIf` names through `mcts-backlog --status --json`
 * (mcts-commun's docs/backlog.md), their outputs, and src/schedule/stop.js decides. It prints the reason and exits 0
 * to cancel the job; it exits 1 to let it run.
 */
const BACKLOG = fileURLToPath(new URL("../node_modules/mcts-commun/bin/backlog.js", import.meta.url));
const run = promisify(execFile);

/** A job as the machine's queue holds it, its output's path absolute; null when unknown (`--status` exits 3). */
async function statusOf(id) {
  const { stdout } = await run(process.execPath, [BACKLOG, "--status", id, "--json"]).catch((error) => error);
  return JSON.parse(stdout || "null");
}

const [id] = process.argv.slice(2);
const job = await statusOf(id);
if (!job?.stopIf?.length) process.exit(1);
const duels = (await Promise.all([...new Set(job.stopIf.flatMap((condition) => condition.after))].map(statusOf))).filter(Boolean);
const outputs = new Map(await Promise.all(duels.map(async (duel) => [duel.id, duel.output ? await readFile(duel.output, "utf8").catch(() => "") : ""])));
const reason = stopReason(job, duels, (duel) => outputs.get(duel.id) ?? "");
if (!reason) process.exit(1);
console.log(reason);
