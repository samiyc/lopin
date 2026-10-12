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

// `--view` (Sami, 12/10): how the position reaches the model — `grid` the CLI's screen, `list` one line a
// border, `json` the CLI's own objects. qwen2.5:7b misread the grid's seven columns (cards it named were not there).
const viewMode = option("--view", "grid");
// `--think on|off` (Sami, 12/10): a thinking model (qwen3.5) reasons before it answers when on; left out, Ollama decides.
const thinkOption = option("--think");
const thinking = thinkOption === undefined ? {} : { think: thinkOption === "on" };

const SYSTEM = [
  "Tu joues à Bornage (Schotten Totten) contre un robot. Tu poses une carte de ta main sur ton côté d'une borne.",
  RULES_LINE,
  "Conseils : compte les cartes encore dehors avant de viser une combinaison ; garde le joker pour finir un Brelan ou une Suite, mais pose-le : un joker gardé jusqu'à la fin ne sert à rien ; ne jette pas de carte sur une borne déjà perdue ; défends la borne qui donnerait au robot 3 bornes voisines.",
  'Réfléchis d\'abord, puis choisis. Réponds uniquement en JSON : {"raison": "<une phrase sur la position>", "coup": "<exactement un coup de la liste>"}.',
].join("\n");

const owner = (won) => ({ me: "à toi", opponent: "au robot" })[won] ?? "libre";
const cards = (list) => (list.length > 0 ? list.join(" ") : "—");
const headerOf = (view) => view.board.split("\n\n")[0];

/** The position as the model reads it, in the `--view` chosen. */
function positionText(view) {
  if (viewMode === "json") {
    return JSON.stringify({ tour: view.turn, pioche: view.pile, mainDuRobot: view.opponentHand, dernierCoup: view.last, vues: view.seen, main: view.hand.map((entry) => entry.card), bornes: view.borders.map((border) => ({ borne: border.n, toi: border.mine, robot: border.theirs, gagnee: owner(border.won) })) });
  }
  if (viewMode === "list") {
    const lines = view.borders.map((border) => `Borne ${border.n} : toi ${cards(border.mine)} | robot ${cards(border.theirs)} | ${owner(border.won)}`);
    return [headerOf(view), ...lines, `Ta main : ${cards(view.hand.map((entry) => entry.card))}`].join("\n");
  }
  return view.board;
}

/** One CLI command (step mode, compact JSON): its last line, parsed, and how long it took. */
async function cli(extra) {
  const started = performance.now();
  const { stdout } = await run(process.execPath, [CLI, ...extra, "--machine", "--out", out, "--model", model], { encoding: "utf8" });
  return { view: JSON.parse(stdout.trim().split("\n").at(-1)), ms: performance.now() - started };
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * One Ollama request, tried again on a dropped connection (5 times, 5 s
 * apart): restarting the service (to set OLLAMA_NUM_PARALLEL, 12/10) cut a
 * request mid-game and stopped the whole batch.
 */
async function chat(body) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(`${host}/api/chat`, { method: "POST", body });
      return await response.json();
    } catch (error) {
      if (attempt >= 6) throw error;
      await pause(5000);
    }
  }
}

/** The model's answer to one position: `{ coup, raison }` (or null), and its time. */
async function ask(view, retry) {
  const started = performance.now();
  const warning = retry ? "\n\nAttention : " + retry : "";
  const user = `${positionText(view)}\n\nCoups permis : ${JSON.stringify(view.moves)}${warning}\nTon coup ?`;
  const body = await chat(JSON.stringify({ model, stream: false, format: "json", ...thinking, options: { temperature: 0.3 }, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }] }));
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
  const stats = { n, seed, first, moves: 0, tries: 0, fallbacks: 0, llmMs: 0, cliMs: 0, jokers: 0, offBorder: 0 };
  while (!view.over) {
    const choice = view.moves.length > 0 ? await chooseMove(view) : { coup: "p", why: "aucun coup possible", tries: 1, llmMs: 0 };
    const step = await cli(["--step", file, choice.coup, "--why", choice.why]);
    view = step.view;
    // How the model reads the table: a reason that names another border than the one played is a likely misreading.
    const played = choice.coup.split(" ")[1];
    const named = [...choice.why.matchAll(/borne (\d)/g)].map((match) => match[1]);
    Object.assign(stats, { jokers: stats.jokers + Number(choice.coup.startsWith("JK")), offBorder: stats.offBorder + Number(named.length > 0 && !named.includes(played)) });
    Object.assign(stats, { moves: stats.moves + 1, tries: stats.tries + choice.tries, fallbacks: stats.fallbacks + Number(choice.tries > 3), llmMs: stats.llmMs + choice.llmMs, cliMs: stats.cliMs + step.ms });
    appendFileSync(TIMES, `${JSON.stringify({ game: n, move: stats.moves, tries: choice.tries, llmMs: Math.round(choice.llmMs), cliMs: Math.round(step.ms) })}\n`);
  }
  return { ...stats, end: view.end, replay: view.replay, bordersWon: view.borders.filter((border) => border.won === "me").length };
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
const sum = (key) => results.reduce((total, result) => total + result[key], 0);
const moves = Math.max(1, sum("moves"));
console.log(`\n${won} victoires sur ${results.length} parties en ${minutes} min (${parallel} à la fois, vue ${viewMode}, thinking ${thinkOption ?? "par défaut"}) ; le détail des temps : tmp/llm-play.jsonl`);
console.log(`Bornes gagnées par partie : ${(sum("bordersWon") / results.length).toFixed(2)} ; jokers posés : ${sum("jokers")} ; raisons qui citent une autre borne que celle jouée : ${((100 * sum("offBorder")) / moves).toFixed(0)} % ; essais par coup : ${(sum("tries") / moves).toFixed(2)} ; modèle ${(sum("llmMs") / moves / 1000).toFixed(1)} s / coup`);
