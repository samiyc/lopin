import { execFile } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { RULES_LINE } from "./lib/cli-view.js";

/**
 * `npm run llm-play -- [--games 10] [--model llama3.2] [--host http://127.0.0.1:11434] [--bot experimental] [--seed 50000] [--out duels/agents/llama]`:
 * a local model (Ollama) plays Bornage against a line-up bot through the CLI's
 * step mode (Sami, 12/10: the Sonnet agents cost too much of the quota). Each
 * move: the screen and the legal moves go to the model, which answers
 * `{"coup": "8♠ 4", "raison": "…"}`; an answer outside the legal moves is
 * asked again (3 tries), then the first legal move is played and the note says
 * so. Game n starts with the model when n is odd. Timings per move (model,
 * CLI and bot) go to tmp/llm-play.jsonl, to see where the time goes.
 *
 * `--parallel N` plays N games at once (the bot's search uses one core each;
 * Ollama answers several requests at once only with OLLAMA_NUM_PARALLEL set).
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const games = Number(option("--games", 10));
const model = option("--model", "llama3.2");
const host = option("--host", "http://127.0.0.1:11434");
const bot = option("--bot", "experimental");
const seed0 = Number(option("--seed", 50000));
const out = option("--out", "duels/agents/llama");
const parallel = Math.max(1, Number(option("--parallel", 1)));
const run = promisify(execFile);
const CLI = fileURLToPath(new URL("./cli.js", import.meta.url));
const TMP = fileURLToPath(new URL("../tmp/llm-play/", import.meta.url));
const TIMES = fileURLToPath(new URL("../tmp/llm-play.jsonl", import.meta.url));
const name = `${model.replaceAll(/[^a-z0-9.]+/gi, "-")}`;

const SYSTEM = [
  "Tu joues à Bornage (Schotten Totten) contre un robot. Tu poses une carte de ta main sur ton côté d'une borne.",
  RULES_LINE,
  "Conseils : compte les cartes encore dehors avant de viser une combinaison ; garde le joker pour finir un Brelan ou une Suite ; ne jette pas de carte sur une borne déjà perdue ; défends la borne qui donnerait au robot 3 bornes voisines.",
  'Réponds uniquement en JSON : {"coup": "<exactement un coup de la liste>", "raison": "<une phrase>"}.',
].join("\n");

/** One CLI command (step mode, compact JSON): its last line, parsed, and how long it took. */
async function cli(extra) {
  const started = performance.now();
  const { stdout } = await run(process.execPath, [CLI, ...extra, "--machine", "--compact", "--out", out, "--model", model], { encoding: "utf8" });
  return { view: JSON.parse(stdout.trim().split("\n").at(-1)), ms: performance.now() - started };
}

/** The model's answer to one position: `{ coup, raison }` (or null), and its time. */
async function ask(view, retry) {
  const started = performance.now();
  const warning = retry ? "\n\nAttention : " + retry : "";
  const user = `${view.board}\n\nCoups permis : ${JSON.stringify(view.moves)}${warning}\nTon coup ?`;
  const response = await fetch(`${host}/api/chat`, {
    method: "POST",
    body: JSON.stringify({ model, stream: false, format: "json", options: { temperature: 0.3 }, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }),
  });
  const body = await response.json();
  let answer = null;
  try {
    answer = JSON.parse(body.message?.content ?? "");
  } catch {
    answer = null;
  }
  return { answer, ms: performance.now() - started };
}

/** The model's move for this view: a legal one, after at most 3 tries; else the first legal move, said so in the note. */
async function chooseMove(view) {
  let retry = null;
  let llmMs = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { answer, ms } = await ask(view, retry);
    llmMs += ms;
    const coup = String(answer?.coup ?? "").trim().replaceAll(/\s+/g, " ");
    if (view.moves.includes(coup)) return { coup, why: String(answer.raison ?? "").replaceAll('"', "'").slice(0, 300), tries: attempt, llmMs };
    retry = `« ${coup || "?"} » n'est pas dans la liste. Choisis exactement un coup parmi : ${JSON.stringify(view.moves)}.`;
  }
  return { coup: view.moves[0], why: "(repli : aucune réponse valable en 3 essais)", tries: 4, llmMs };
}

async function playGame(n) {
  const file = join(TMP, `${name}-${n}.json`);
  const seed = seed0 + n;
  const first = n % 2 === 1 ? "me" : "bot";
  let { view } = await cli(["--new", file, "--name", name, "--bot", bot, "--seed", String(seed), "--first", first]);
  const stats = { n, seed, first, moves: 0, tries: 0, fallbacks: 0, llmMs: 0, cliMs: 0 };
  while (!view.over) {
    const choice = view.moves.length > 0 ? await chooseMove(view) : { coup: "p", why: "aucun coup possible", tries: 1, llmMs: 0 };
    const step = await cli(["--step", file, choice.coup, "--why", choice.why]);
    view = step.view;
    Object.assign(stats, { moves: stats.moves + 1, tries: stats.tries + choice.tries, fallbacks: stats.fallbacks + Number(choice.tries > 3), llmMs: stats.llmMs + choice.llmMs, cliMs: stats.cliMs + step.ms });
    appendFileSync(TIMES, `${JSON.stringify({ game: n, move: stats.moves, tries: choice.tries, llmMs: Math.round(choice.llmMs), cliMs: Math.round(step.ms) })}\n`);
  }
  return { ...stats, end: view.end, replay: view.replay };
}

mkdirSync(TMP, { recursive: true });
mkdirSync(resolve(process.cwd(), out), { recursive: true });
const results = [];
const started = performance.now();
let next = 1;

/** One lane of `--parallel`: plays the next game not yet taken until none is left. */
async function lane() {
  while (next <= games) {
    const n = next;
    next += 1;
    const result = await playGame(n);
    results.push(result);
    const perMove = (ms) => (ms / Math.max(1, result.moves) / 1000).toFixed(1);
    console.log(`Partie ${n} (${result.first === "me" ? "le modèle commence" : "le robot commence"}) : ${result.end} — ${result.moves} coups, ${result.tries} essais, ${result.fallbacks} replis, modèle ${perMove(result.llmMs)} s / coup, console + robot ${perMove(result.cliMs)} s / coup`);
  }
}

await Promise.all(Array.from({ length: Math.min(parallel, games) }, lane));
const won = results.filter((result) => result.end?.startsWith("Gagné")).length;
const minutes = ((performance.now() - started) / 60000).toFixed(1);
console.log(`\n${won} victoires sur ${results.length} parties en ${minutes} min (${parallel} à la fois) ; le détail des temps : tmp/llm-play.jsonl`);
