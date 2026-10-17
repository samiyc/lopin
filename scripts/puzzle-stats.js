import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { readAttempts } from "./lib/domain/puzzle-attempts-file.js";

/**
 * `npm run puzzle-stats`: Sami's puzzle attempts (data/puzzle-attempts.jsonl,
 * written by the play server; src/replay/stats/puzzle-attempts.js), puzzle by
 * puzzle — solved at the first try or not, the time it took, the slips, and
 * whether a slip was the core's own favourite move (the trap the core falls
 * in too). The hardest first: a measured difficulty, to tell the simple
 * puzzles from the really hard ones. Writes data/puzzle-stats.json.
 */
const PUZZLES = fileURLToPath(new URL("../web/data/puzzles.json", import.meta.url));
const OUT = fileURLToPath(new URL("../data/puzzle-stats.json", import.meta.url));

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/** One puzzle's line: its attempts in order of time. */
function rowOf(id, attempts, puzzle) {
  const first = attempts[0];
  const slips = attempts.flatMap((attempt) => attempt.moves.filter((move) => move.winning === false).map((move) => move.move));
  const solvedTimes = attempts.filter((attempt) => attempt.result === "solved").map((attempt) => attempt.activeMs);
  return {
    id,
    kind: first.kind,
    attempts: attempts.length,
    firstTry: first.result,
    solvedAlone: solvedTimes.length,
    bestMs: solvedTimes.length ? Math.min(...solvedTimes) : null,
    firstMs: first.activeMs,
    slips: slips.length,
    coreTrap: puzzle ? slips.filter((move) => move === puzzle.coreMove).length : 0,
    reveals: attempts.filter((attempt) => attempt.revealedAtMs !== null).length,
    skipped: attempts.filter((attempt) => attempt.result === "skipped").length,
  };
}

/** The hardest first: not solved at the first try, then the most slips, then the longest first attempt. */
const hardestFirst = (a, b) => Number(a.firstTry === "solved") - Number(b.firstTry === "solved") || b.slips - a.slips || b.firstMs - a.firstMs;

const attempts = (await readAttempts()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
const puzzles = new Map(JSON.parse(await readFile(PUZZLES, "utf8")).puzzles.map((puzzle) => [puzzle.id, puzzle]));
const byId = new Map();
for (const attempt of attempts) byId.set(attempt.id, [...(byId.get(attempt.id) ?? []), attempt]);
const rows = [...byId].map(([id, list]) => rowOf(id, list, puzzles.get(id))).sort(hardestFirst);
const played = rows.filter((row) => row.firstTry !== "skipped");
const summary = {
  built: new Date().toISOString(),
  attempts: attempts.length,
  puzzles: rows.length,
  firstTrySolved: played.filter((row) => row.firstTry === "solved").length,
  played: played.length,
  medianFirstMs: median(played.map((row) => row.firstMs)),
  slips: rows.reduce((sum, row) => sum + row.slips, 0),
  coreTraps: rows.reduce((sum, row) => sum + row.coreTrap, 0),
};
await writeFile(OUT, `${JSON.stringify({ note: "npm run puzzle-stats : les tentatives de Sami, puzzle par puzzle, les plus durs d'abord.", summary, rows }, null, 1)}\n`);

const seconds = (ms) => (ms === null ? "—" : `${Math.round(ms / 1000)} s`);
console.log(`${summary.attempts} tentatives sur ${summary.puzzles} puzzles ; ${summary.firstTrySolved} / ${summary.played} résolus seuls du premier coup ; temps médian du premier essai ${seconds(summary.medianFirstMs)}`);
console.log(`${summary.slips} faux pas, dont ${summary.coreTraps} sur le coup favori du cœur (le même piège)`);
for (const row of rows.slice(0, 15)) {
  console.log(`  #${row.id} ${row.kind} · 1er essai ${row.firstTry} en ${seconds(row.firstMs)} · ${row.attempts} essai(s), ${row.slips} faux pas (${row.coreTrap} piège du cœur), ${row.reveals} révélé(s) · meilleur ${seconds(row.bestMs)}`);
}
console.log(`→ data/puzzle-stats.json`);
