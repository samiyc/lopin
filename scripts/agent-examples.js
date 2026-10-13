import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ORACLE } from "../src/replay/oracle.js";
import { formatJson, handOrder, jsonView, parseInput } from "./lib/cli-view.js";
import { exchangeBefore, inputOf, oracleChoices, puzzleChoices } from "./lib/example-positions.js";

/**
 * `npm run agent-examples -- [--count 6] [--puzzles 2] [--oracle a.jsonl,b.jsonl] [--duels duels] [--out docs/agents/exemples.md]`:
 * the worked examples of the agents' rules (Sami, 13/10: « pas de partie complète, quelques coups joués, avec
 * input/output »). Each is a position as the CLI's `--json` shows it (the same `jsonView`, `dernier_echange`
 * rebuilt from the game's log) and the perfect move: the oracle's clear choice, or the solver's win in a
 * puzzle where the core's move loses (scripts/lib/example-positions.js). Generated, never typed by hand.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const count = Number(option("--count", 6));
const puzzleCount = Number(option("--puzzles", 2));
const ROOT = new URL("../", import.meta.url);
const fromRoot = (path) => (path === undefined ? undefined : pathToFileURL(resolve(process.cwd(), path)));
const ORACLE_FILES = (option("--oracle") ?? "").split(",").filter(Boolean).map(fromRoot);
if (ORACLE_FILES.length === 0) ORACLE_FILES.push(new URL("oracle/positions.jsonl", ROOT), new URL("oracle/positions-early.jsonl", ROOT));
const DUELS = fileURLToPath(fromRoot(option("--duels")) ?? new URL("duels/", ROOT));
const OUT = fileURLToPath(fromRoot(option("--out")) ?? new URL("docs/agents/exemples.md", ROOT));
const PUZZLES = new URL("web/data/puzzles.json", ROOT);

const phaseOf = (turn) => {
  if (turn <= 12) return "début de partie";
  return turn <= 24 ? "milieu de partie" : "fin de partie";
};

/** One example: the input the agent receives, the move expected, a title saying where it comes from. */
function exampleOf(choice) {
  const { state } = choice;
  const me = state.current;
  const input = jsonView(state, me, { order: handOrder(state, me), last: exchangeBefore(choice.log, choice.turn, me) });
  const output = inputOf(choice.label);
  const ok = input.main.some((card) => output.startsWith(`${card} `)) && input.bornes_jouables.includes(Number(output.split(" ")[1]));
  if (!ok || !parseInput(output, state, handOrder(state, me)).move) throw new Error(`Coup hors des coups permis : ${choice.source} ${output}`);
  const title = choice.kind === "puzzle" ? `${phaseOf(choice.turn)}, pioche vide : le solveur prouve ce coup gagnant` : `${phaseOf(choice.turn)} : le coup de l'oracle`;
  const trap = choice.kind === "puzzle" && choice.coreMove ? `Le coup qui paraît naturel, \`${inputOf(choice.coreMove)}\`, perd.` : null;
  return { title, input: formatJson(input), output, trap };
}

const choices = [
  ...oracleChoices({ files: ORACLE_FILES, duels: DUELS, total: count - puzzleCount }),
  ...puzzleChoices({ file: PUZZLES, total: puzzleCount }),
];
// The CLI plays the claim rule: a position from a game under another end rule would show borders it could not.
const other = choices.filter((choice) => choice.log.rules?.endMode !== "claim-end");
if (other.length > 0) throw new Error("Parties à une autre règle de fin que la revendication : " + other.map((choice) => `${choice.source} (${choice.log.rules?.endMode})`).join(" ; "));
const examples = choices.map(exampleOf);

const budget = ORACLE.budget.toLocaleString("fr-FR");
const blocks = examples.map((example, index) => [
  `## Exemple ${index + 1} — ${example.title}`,
  "",
  "INPUT :",
  "",
  "```json",
  example.input,
  "```",
  "",
  `OUTPUT : \`${example.output}\``,
  ...(example.trap ? ["", example.trap] : []),
].join("\n"));

const text = [
  "# Exemples : une position, le coup parfait",
  "",
  `Quelques vraies positions, telles que tu les reçois (\`INPUT\`, le JSON de \`--json\`), avec le coup parfait (\`OUTPUT\`) :`,
  `celui de l'oracle (une recherche de ${budget} itérations, bien plus longue que celle du robot) ou, une fois la pioche`,
  "vide, celui que le solveur prouve gagnant. Réponds de la même façon : « carte borne ».",
  "",
  "*Ce fichier est généré (`npm run agent-examples`) : ne le modifie pas à la main.*",
  "",
  ...blocks.flatMap((block) => [block, ""]),
].join("\n");

writeFileSync(OUT, text);
console.log(`${examples.length} exemples (${examples.length - puzzleCount} de l'oracle, ${puzzleCount} puzzles) → ${OUT}`);
