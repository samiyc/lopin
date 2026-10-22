import { execFile } from "node:child_process";
import { appendFileSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { RULES_LINE } from "./lib/cli/cli-view.js";

/**
 * `npm run llm-play -- [--games 10] [--model llama3.2] [--host http://127.0.0.1:11434] [--bot experimental] [--seed 50000] [--out duels/agents/llama]`:
 * a local model (Ollama) plays Lopin against a line-up bot through the CLI's
 * step mode (Sami, 12/10: the Sonnet agents cost too much of the quota). Each
 * move: the screen and the legal moves go to the model, which answers
 * `{"coup": "8♠ 4", "raison": "…"}`; an answer outside the legal moves is
 * asked again (3 tries), then the first legal move is played and the note says
 * so. Game n starts with the model when n is odd. Timings per move (model,
 * CLI and bot) go to tmp/llm-play.jsonl, to see where the time goes.
 *
 * `--examples tmp/llm-examples.json`: worked examples before each position (`npm run llm-examples`).
 *
 * Each game also leaves a text journal beside its replay (`<replay>.log.txt`, Sami, 13/10): the
 * console's JSON, the question put to the model, its raw answer (and its reasoning) and the
 * command played, move by move.
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
// `--examples <file>` (Sami, 13/10): worked examples (`npm run llm-examples`) shown before each position as past
// exchanges — the position, then the answer with its reason. They need a longer context than Ollama's 4 096 tokens.
const examplesFile = option("--examples");
const examples = examplesFile === undefined ? [] : JSON.parse(readFileSync(resolve(process.cwd(), examplesFile), "utf8"));
const contextSize = examples.length > 0 ? { num_ctx: 8192 } : {};

const SYSTEM = [
  "Tu joues à Lopin (Schotten Totten) contre un robot. Tu poses une carte de ta main sur ton côté d'une borne.",
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

/** The question for one position: the position, the legal moves, a warning after a wrong answer. */
const question = (view, warning = "") => `${positionText(view)}\n\nCoups permis : ${JSON.stringify(view.moves)}${warning}\nTon coup ?`;

/** The examples as past exchanges: a question, then the answer the model should have given. */
const shots = () =>
  examples.flatMap((example) => [
    { role: "user", content: question(example.view) },
    { role: "assistant", content: JSON.stringify({ raison: example.raison, coup: example.coup }) },
  ]);

/** One CLI command (step mode, compact JSON): its last line, that line parsed, and how long it took. */
async function cli(extra) {
  const started = performance.now();
  const { stdout } = await run(process.execPath, [CLI, ...extra, "--machine", "--out", out, "--model", model], { encoding: "utf8" });
  const line = stdout.trim().split("\n").at(-1);
  return { view: JSON.parse(line), line, ms: performance.now() - started };
}

/**
 * The text journal of one game (Sami, 13/10, beside the replay): for each move the
 * console's JSON, the question put to the model, its raw answer and the command
 * played. Written as it goes to tmp/llm-play/, copied next to the replay at the end.
 */
function journalOf(n, header) {
  const file = join(TMP, `${name}-${n}.log.txt`);
  writeFileSync(file, `${header}\n`);
  return { file, add: (text) => appendFileSync(file, `${text}\n`) };
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * The answer's JSON schema, which Ollama turns into a grammar (Sami, 13/10):
 * `coup` can only be one of the legal moves, `raison` holds 200 characters at
 * most. With a bare `"format": "json"`, qwen3.5:9b wrote 2 800 tokens of
 * reason (45 s a move) and answered outside the list once move in two.
 */
const answerSchema = (moves) => ({
  type: "object",
  properties: { raison: { type: "string", maxLength: 200 }, coup: { type: "string", enum: moves } },
  required: ["raison", "coup"],
});

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

/** The model's answer to one position: `{ coup, raison }` (or null), its time, and what was asked and answered, raw. */
async function ask(view, retry) {
  const started = performance.now();
  const warning = retry ? "\n\nAttention : " + retry : "";
  const messages = [{ role: "system", content: SYSTEM }, ...shots(), { role: "user", content: question(view, warning) }];
  const body = await chat(JSON.stringify({ model, stream: false, format: answerSchema(view.moves), ...thinking, options: { temperature: 0.3, num_predict: 200, ...contextSize }, messages }));
  return { answer: parsed(body.message?.content), ms: performance.now() - started, raw: rawOf(messages.at(-1).content, body) };
}

/** The model's answer as an object, or null when it is not JSON. */
function parsed(content) {
  try {
    return JSON.parse(content ?? "");
  } catch {
    return null;
  }
}

/** What the journal keeps of an exchange: the question sent, the answer as it came, its reasoning and its length. */
const rawOf = (sent, body) => ({ sent, content: body.message?.content ?? `(pas de réponse : ${body.error ?? "?"})`, thinking: body.message?.thinking ?? "", tokens: body.eval_count });

/** What the journal says of one try: the question the first time (a retry adds its warning), then the raw answer. */
function noteTry(journal, attempt, retry, { ms, raw }) {
  journal.add(attempt === 1 ? `Question :\n${raw.sent}` : `Attention ajoutée : ${retry}`);
  journal.add(`\nModèle ← essai ${attempt} · ${(ms / 1000).toFixed(1)} s · ${raw.tokens ?? "?"} tokens\n${raw.content}`);
  if (raw.thinking) journal.add(`Modèle ← réflexion :\n${raw.thinking}`);
}

/** The model's move for this view: a legal one, after at most 3 tries; else the first legal move, said so in the note. */
async function chooseMove(view, journal) {
  let retry = null;
  let llmMs = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const tried = await ask(view, retry);
    noteTry(journal, attempt, retry, tried);
    llmMs += tried.ms;
    const coup = String(tried.answer?.coup ?? "").trim().replaceAll(/\s+/g, " ");
    if (view.moves.includes(coup)) return { coup, why: String(tried.answer.raison ?? "").replaceAll('"', "'").slice(0, 300), tries: attempt, llmMs };
    retry = `« ${coup || "?"} » n'est pas dans la liste. Choisis exactement un coup parmi : ${JSON.stringify(view.moves)}.`;
  }
  return { coup: view.moves[0], why: "(repli : aucune réponse valable en 3 essais)", tries: 4, llmMs };
}

/** The journal's first lines: who plays what, then the system prompt the model got. */
const journalHeader = (n, seed, first) => [
  `# Partie ${n} · ${model} contre ${bot} · graine ${seed} · ${first === "me" ? "le modèle commence" : "le robot commence"}`,
  `# vue ${viewMode} · thinking ${thinkOption ?? "par défaut"} · ${examples.length} exemples · ${new Date().toISOString()}`,
  "# « CLI → » : le JSON de scripts/cli.js (--machine) ; « Question » : ce que reçoit Ollama après les exemples ; « Modèle ← » : sa réponse brute.",
  "",
  "## Consigne système",
  SYSTEM,
  "",
].join("\n");

/** One move's lines of the journal: the command played and what the console answered. */
function noteStep(journal, choice, step, moveNumber) {
  const how = choice.tries > 3 ? "repli" : "essai " + choice.tries;
  journal.add(`Coup ${moveNumber} joué : ${choice.coup} (${how})\n$ cli --step "${choice.coup}" --why "${choice.why}" · ${(step.ms / 1000).toFixed(1)} s\nCLI → ${step.line}\n`);
}

/** The journal goes next to the replay, `<replay>.log.txt`; returns its path. */
function keepJournal(journal, view) {
  journal.add(`Fin : ${view.end}\nReplay : ${view.replay}`);
  const kept = resolve(process.cwd(), view.replay).replace(/\.json$/, ".log.txt");
  copyFileSync(journal.file, kept);
  return kept;
}

/** What one move adds to the game's tallies: times, jokers, and reasons that name another border than the one played. */
function tally(stats, choice, step) {
  const named = [...choice.why.matchAll(/borne (\d)/g)].map((match) => match[1]);
  Object.assign(stats, {
    jokers: stats.jokers + Number(choice.coup.startsWith("JK")),
    offBorder: stats.offBorder + Number(named.length > 0 && !named.includes(choice.coup.split(" ")[1])),
    moves: stats.moves + 1,
    tries: stats.tries + choice.tries,
    fallbacks: stats.fallbacks + Number(choice.tries > 3),
    llmMs: stats.llmMs + choice.llmMs,
    cliMs: stats.cliMs + step.ms,
  });
}

async function playGame(n) {
  const file = join(TMP, `${name}-${n}.json`);
  const seed = seed0 + n;
  const first = n % 2 === 1 ? "me" : "bot";
  const journal = journalOf(n, journalHeader(n, seed, first));
  const start = await cli(["--new", file, "--name", name, "--bot", bot, "--seed", String(seed), "--first", first]);
  journal.add(`$ cli --new --seed ${seed} --first ${first}\nCLI → ${start.line}\n`);
  let { view } = start;
  const stats = { n, seed, first, moves: 0, tries: 0, fallbacks: 0, llmMs: 0, cliMs: 0, jokers: 0, offBorder: 0 };
  while (!view.over) {
    const choice = view.moves.length > 0 ? await chooseMove(view, journal) : { coup: "p", why: "aucun coup possible", tries: 1, llmMs: 0 };
    const step = await cli(["--step", file, choice.coup, "--why", choice.why]);
    view = step.view;
    noteStep(journal, choice, step, stats.moves + 1);
    tally(stats, choice, step);
    appendFileSync(TIMES, `${JSON.stringify({ game: n, move: stats.moves, tries: choice.tries, llmMs: Math.round(choice.llmMs), cliMs: Math.round(step.ms) })}\n`);
  }
  return { ...stats, end: view.end, replay: view.replay, journal: keepJournal(journal, view), bordersWon: view.borders.filter((border) => border.won === "me").length };
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
    console.log(`Partie ${n} (${result.first === "me" ? "le modèle commence" : "le robot commence"}) : ${result.end} — ${result.moves} coups, ${result.tries} essais, ${result.fallbacks} replis, modèle ${perMove(result.llmMs)} s / coup, console + robot ${perMove(result.cliMs)} s / coup ; journal ${relative(process.cwd(), result.journal).replaceAll("\\", "/")}`);
  }
}

await Promise.all(Array.from({ length: Math.min(parallel, games) }, lane));
const won = results.filter((result) => result.end?.startsWith("Gagné")).length;
const minutes = ((performance.now() - started) / 60000).toFixed(1);
const sum = (key) => results.reduce((total, result) => total + result[key], 0);
const moves = Math.max(1, sum("moves"));
console.log(`\n${won} victoires sur ${results.length} parties en ${minutes} min (${parallel} à la fois, vue ${viewMode}, thinking ${thinkOption ?? "par défaut"}, ${examples.length} exemples) ; le détail des temps : tmp/llm-play.jsonl`);
console.log(`Bornes gagnées par partie : ${(sum("bordersWon") / results.length).toFixed(2)} ; jokers posés : ${sum("jokers")} ; raisons qui citent une autre borne que celle jouée : ${((100 * sum("offBorder")) / moves).toFixed(0)} % ; essais par coup : ${(sum("tries") / moves).toFixed(2)} ; modèle ${(sum("llmMs") / moves / 1000).toFixed(1)} s / coup`);
