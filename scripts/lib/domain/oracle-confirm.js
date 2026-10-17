import { appendFile, readFile, writeFile } from "node:fs/promises";
import { meanAndHalf } from "../../../src/replay/oracle/oracle.js";
import { runPool } from "../cli/pool.js";

/**
 * The oracle's gaps confirmed by play (`npm run oracle -- --confirm`,
 * scripts/lib/workers/confirm-worker.js). The gaps of oracle/positions.jsonl, the
 * last-column ones first, then the clearest (widest margin) first; each
 * result is appended to oracle/confirm.jsonl as it lands and a new run skips
 * the gaps already there. The verdict goes to data/oracle-confirm.json.
 *
 * `out` (Sami, 14/10: the 1.2's games read by Oracle2): another corpus,
 * oracle/positions-<out>.jsonl, confirmed into oracle/confirm-<out>.jsonl
 * and data/oracle-confirm-<out>.json.
 */
const ROOT = new URL("../../../", import.meta.url);
const filesOf = (out) => {
  const suffix = out ? `-${out}` : "";
  return { positions: new URL(`oracle/positions${suffix}.jsonl`, ROOT), confirmed: new URL(`oracle/confirm${suffix}.jsonl`, ROOT), summary: new URL(`data/oracle-confirm${suffix}.json`, ROOT) };
};

const readLines = async (url) =>
  (await readFile(url, "utf8").catch(() => ""))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const keyOf = (entry) => `${entry.key}|${entry.turn}`;
const pts = (x) => `${x >= 0 ? "+" : ""}${(100 * x).toFixed(1).replace(".", ",")}`;

/** The gaps still to play out, in the order they are worth it. */
async function gapsToConfirm(files) {
  const done = new Set((await readLines(files.confirmed)).map(keyOf));
  const gaps = (await readLines(files.positions)).filter((entry) => entry.gap && !done.has(keyOf(entry)));
  const lastColumn = (entry) => (entry.at === "last-column" ? 0 : 1);
  return gaps.sort((a, b) => lastColumn(a) - lastColumn(b) || b.share - b.runnerUp - (a.share - a.runnerUp));
}

export async function confirmGaps({ minutes = Infinity, seeds = 6, out = null } = {}) {
  const files = filesOf(out);
  const gaps = await gapsToConfirm(files);
  const started = Date.now();
  let done = 0;
  const cap = Number.isFinite(minutes) ? `${minutes} min au plus` : "sans limite";
  console.log(`${gaps.length} écarts à confirmer, ${seeds} graines par coup, ${cap}`);
  await runPool(new URL("../workers/confirm-worker.js", import.meta.url), gaps.map((entry) => ({ entry, seeds })), {
    shouldStop: () => Date.now() - started > minutes * 60_000,
    onResult: (result) => {
      done += 1;
      appendFile(files.confirmed, `${JSON.stringify(result)}\n`);
      if (done % 25 === 0) console.log(`  ${done} écarts, ${((Date.now() - started) / 1000 / done).toFixed(1)} s par écart (sur tous les fils), ${((Date.now() - started) / 60_000).toFixed(0)} min`);
    },
  });
  console.log(`${done} écarts confirmés en ${((Date.now() - started) / 60_000).toFixed(1)} min.\n`);
}

/** The verdict over a group of play-outs: the oracle's lead over the core's favourite and over the 0.9's move. */
function verdictOf(rows) {
  const lead = (field) => meanAndHalf(rows.map((row) => row[field]).filter((x) => x !== null && x !== undefined));
  return { gaps: rows.length, vsCore: lead("vsCore"), vsPlayed: lead("vsPlayed") };
}

function printVerdict(label, verdict) {
  const line = ({ mean, half, count }) => `${pts(mean)} ± ${(100 * half).toFixed(1).replace(".", ",")} pts (${count})`;
  console.log(`  ${label.padEnd(34)} contre le cœur ${line(verdict.vsCore)} ; contre le coup joué ${line(verdict.vsPlayed)}`);
}

export async function summarizeConfirm({ out = null } = {}) {
  const files = filesOf(out);
  const rows = await readLines(files.confirmed);
  if (rows.length === 0) return;
  const groups = {
    "tous les écarts": rows,
    "dernière colonne": rows.filter((row) => row.at === "last-column"),
    "tours fixes": rows.filter((row) => row.at !== "last-column"),
    "marge de l'oracle ≥ 0,15": rows.filter((row) => row.margin >= 0.15),
    "marge de l'oracle < 0,15": rows.filter((row) => row.margin < 0.15),
    // Sami, 14/10: outside the top 8, the root's selection never shows the move; inside it, the search chose another.
    "hors du top 8 du cœur": rows.filter((row) => row.rank > 8),
    "dans le top 8 (rangs 4 à 8)": rows.filter((row) => row.rank <= 8),
  };
  console.log(`Confirmation par le jeu : ce que le coup de l'oracle tient de plus au tour 30`);
  const summary = { built: new Date().toISOString().slice(0, 10), groups: {} };
  for (const [label, group] of Object.entries(groups)) {
    if (group.length === 0) continue;
    summary.groups[label] = verdictOf(group);
    printVerdict(label, summary.groups[label]);
  }
  await writeFile(files.summary, `${JSON.stringify(summary, null, 1)}\n`);
}
