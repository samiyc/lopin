import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCard } from "../src/core/notation.js";
import { traitsOf } from "../src/replay/oracle/move-features.js";
import { machineView } from "./lib/cli/cli-view.js";
import { inputOf, oracleChoices, puzzleChoices } from "./lib/domain/example-positions.js";
import { tmpFile } from "./lib/domain/tmp.js";

/**
 * `npm run llm-examples -- [--count 12] [--puzzles 4] [--oracle oracle/positions.jsonl,oracle/positions-early.jsonl] [--duels duels]`:
 * worked examples for `llm-play --examples` (Sami, 13/10: show the model good
 * moves before its game). Two sources, both with a move that is known to be
 * good (scripts/lib/domain/example-positions.js): the oracle's clear choices and the
 * puzzles' winning moves, the core's losing one named as the trap. Each
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

/** The reason given with an example: what the move does, and why it is known to be good. */
function reasonOf(state, label, known) {
  const [card, border] = label.split("→");
  const move = { card: parseCard(state.spec, card), border: Number(border) - 1 };
  const traits = traitsOf(state, state.current, state.hands[state.current], move).slice(0, 3);
  return `${label.replace("→", " sur la borne ")} : ${traits.join(", ")}. ${known}`;
}

/** One example: the position seen by the mover, the move to answer, its reason. */
const exampleOf = (choice, known) => ({ source: choice.source, view: machineView(choice.state, choice.state.current), coup: inputOf(choice.label), raison: reasonOf(choice.state, choice.label, known) });

const oracle = oracleChoices({ files: ORACLE, duels: DUELS, total: count - puzzleCount }).map((choice) => {
  const known = `L'oracle le joue dans ${Math.round(100 * choice.share)} % de ses recherches, le coup suivant dans ${Math.round(100 * choice.runnerUp)} %.`;
  return exampleOf(choice, known);
});
const puzzles = puzzleChoices({ file: PUZZLES, total: puzzleCount }).map((choice) => {
  const trap = choice.coreMove ? ` Piège : ${choice.coreMove.replace("→", " sur la borne ")} perd.` : "";
  return exampleOf(choice, `Pioche vide : le solveur prouve que ce coup gagne la partie.${trap}`);
});

const examples = [...oracle, ...puzzles];
// Every example must be a legal move of its own position, written as the model must write it.
const bad = examples.filter((example) => !example.view.moves.includes(example.coup));
if (bad.length > 0) throw new Error("Coups hors des coups permis : " + bad.map((example) => `${example.source} ${example.coup}`).join(" ; "));
const file = tmpFile("llm-examples.json");
writeFileSync(file, JSON.stringify(examples, null, 1));
console.log(`${examples.length} exemples (${examples.length - puzzleCount} de l'oracle, ${puzzleCount} puzzles) → tmp/llm-examples.json`);
for (const example of examples) console.log(`- ${example.source} : ${example.raison}`);
