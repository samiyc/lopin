import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCard } from "../src/core/notation.js";
import { stateAt } from "../src/replay/log.js";
import { traitsOf } from "../src/replay/move-features.js";
import { machineView } from "./lib/cli-view.js";
import { tmpFile } from "./lib/tmp.js";

/**
 * `npm run llm-examples -- [--count 12] [--puzzles 4] [--oracle oracle/positions.jsonl,oracle/positions-early.jsonl] [--duels duels]`:
 * worked examples for `llm-play --examples` (Sami, 13/10: show the model good
 * moves before its game). Two sources, both with a move that is known to be
 * good: the oracle's clear choices (`oracle/positions.jsonl`, its move taken
 * by at least 30 % of the visits and 15 points ahead of the runner-up, spread
 * over the game's phases) and the puzzles (`web/data/puzzles.json`, the
 * solver's winning move, the core's losing one named as the trap). Each
 * example is the position as the CLI shows it to the mover (`machineView`),
 * the move as the model must answer it (« 9♦ 7 ») and a reason computed from
 * the move's traits, never typed by hand. Written to tmp/llm-examples.json.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const count = Number(option("--count", 12));
const puzzleCount = Number(option("--puzzles", 4));
const ROOT = new URL("../", import.meta.url);
const fromRoot = (path) => (path === undefined ? undefined : pathToFileURL(resolve(process.cwd(), path)));
// Turns 14-26 and the early turns (2-12): `positions.jsonl` alone left the opening without an example.
const ORACLE = (option("--oracle") ?? "").split(",").filter(Boolean).map(fromRoot);
if (ORACLE.length === 0) ORACLE.push(new URL("oracle/positions.jsonl", ROOT), new URL("oracle/positions-early.jsonl", ROOT));
const DUELS = fileURLToPath(fromRoot(option("--duels")) ?? new URL("duels/", ROOT));
const PUZZLES = new URL("web/data/puzzles.json", ROOT);

/** « 9♦→7 » as the CLI's input « 9♦ 7 », and as a move of the engine. */
const inputOf = (label) => label.replace("→", " ");
const moveOf = (spec, label) => {
  const [card, border] = label.split("→");
  return { card: parseCard(spec, card), border: Number(border) - 1 };
};

/** The reason given with an example: what the move does, and why it is known to be good. */
function reasonOf(state, label, known) {
  const move = moveOf(state.spec, label);
  const hand = state.hands[state.current];
  const traits = traitsOf(state, state.current, hand, move).slice(0, 3);
  return `${label.replace("→", " sur la borne ")} : ${traits.join(", ")}. ${known}`;
}

/** One example: the position seen by the mover, the move to answer, its reason. */
function exampleOf(state, label, known, source) {
  const view = machineView(state, state.current);
  return { source, view, coup: inputOf(label), raison: reasonOf(state, label, known) };
}

const duels = new Map();
const gameOf = (file, game) => {
  if (!duels.has(file)) duels.set(file, JSON.parse(readFileSync(resolve(DUELS, file), "utf8")));
  return duels.get(file).games[game];
};

/** The oracle's clear choices, the same number in each third of the game (turns ≤ 12, 13-24, 25+). */
function oracleExamples(total) {
  const rows = ORACLE.flatMap((file) => readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line)));
  const clear = rows.filter((row) => row.share >= 0.3 && row.share - (row.runnerUp ?? 0) >= 0.15 && row.move);
  const phases = [(turn) => turn <= 12, (turn) => turn > 12 && turn <= 24, (turn) => turn > 24];
  const picked = [];
  phases.forEach((inPhase, index) => {
    const pool = clear.filter((row) => inPhase(row.turn));
    const wanted = Math.round(((index + 1) * total) / 3) - Math.round((index * total) / 3);
    // Evenly through the file, so one duel does not supply them all.
    for (let k = 0; k < wanted && pool.length > 0; k += 1) picked.push(pool[Math.floor(((k + 0.5) * pool.length) / wanted)]);
  });
  return picked.flatMap((row) => {
    const log = gameOf(row.file, row.game);
    if (!log) return [];
    const state = stateAt(log, row.turn);
    const known = `L'oracle le joue dans ${Math.round(100 * row.share)} % de ses recherches, le coup suivant dans ${Math.round(100 * (row.runnerUp ?? 0))} %.`;
    return [exampleOf(state, row.move, known, `oracle ${row.file} #${row.game} tour ${row.turn}`)];
  });
}

/** Puzzles whose core move loses: the solver's win, and the trap named. */
function puzzleExamples(total) {
  const all = JSON.parse(readFileSync(PUZZLES, "utf8"));
  const list = (Array.isArray(all) ? all : all.puzzles).filter((puzzle) => puzzle.coreFails && puzzle.solutions?.length > 0);
  const picked = Array.from({ length: Math.min(total, list.length) }, (_, k) => list[Math.floor(((k + 0.5) * list.length) / total)]);
  return picked.map((puzzle) => {
    const state = stateAt(puzzle.log, puzzle.turn);
    const trap = puzzle.coreMove ? ` Piège : ${puzzle.coreMove.replace("→", " sur la borne ")} perd.` : "";
    return exampleOf(state, puzzle.solutions[0], `Pioche vide : le solveur prouve que ce coup gagne la partie.${trap}`, `puzzle #${puzzle.id}`);
  });
}

const examples = [...oracleExamples(count - puzzleCount), ...puzzleExamples(puzzleCount)];
// Every example must be a legal move of its own position, written as the model must write it.
const bad = examples.filter((example) => !example.view.moves.includes(example.coup));
if (bad.length > 0) throw new Error("Coups hors des coups permis : " + bad.map((example) => `${example.source} ${example.coup}`).join(" ; "));
const file = tmpFile("llm-examples.json");
writeFileSync(file, JSON.stringify(examples, null, 1));
console.log(`${examples.length} exemples (${examples.length - puzzleCount} de l'oracle, ${puzzleCount} puzzles) → tmp/llm-examples.json`);
for (const example of examples) console.log(`- ${example.source} : ${example.raison}`);
