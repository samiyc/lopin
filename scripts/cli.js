import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { BOT_IDS, BOT_LINEUP } from "../src/config/bots.js";
import { finishLog, playLogged, startLog, stateAt } from "../src/replay/log.js";
import { RULES, botEntry, botPlayer, humanEntry, newGame, playBot } from "../web/app/runner.js";
import { isClaimable } from "../src/sim/certainty.js";
import { HELP, claimText, endText, handOrder, machineView, parseInput, textView } from "./lib/cli-view.js";
import { REPLAY_DIRS, replayFileName } from "./lib/replay-files.js";

/**
 * `npm run cli`: Bornage in a terminal, against a bot of the line-up (Sami,
 * 12/10; docs/cli.md). The base game only, at the page's claim rule; a move is
 * typed « card border » (« 3 5 »). The finished game is a replay in replays/,
 * as from the page.
 *
 *   npm run cli -- [--bot experimental] [--first me|bot] [--seed N] [--name sami] [--machine]
 *   npm run cli -- --new partie.json [the same options]      (one move a command, for an agent)
 *   npm run cli -- --step partie.json "3 5"
 *
 * `--machine`: one JSON object a line (cli-view.js `machineView`) instead of
 * the board, for a program or an agent. `--new` / `--step`: the game lives in
 * a file (the replay itself); each command plays one move, lets the bot answer,
 * and writes the file back.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const machine = args.includes("--machine");
const REPLAYS = new URL(`../${REPLAY_DIRS.recent}/`, import.meta.url);
const stepping = args.includes("--new") || args.includes("--step");
const interactiveMode = machine ? "machine" : "interactive";
const CLIENT_MODE = stepping ? "step" : interactiveMode;

/** The options of a new game from the command line; the seed defaults to the clock. */
const sessionOptions = (name) => ({ botId: option("--bot"), first: option("--first"), seed: option("--seed") === undefined ? undefined : Number(option("--seed")), name: option("--name") ?? name });

function newSession({ botId = "experimental", first = "me", seed = Date.now() % 2 ** 31, name = "sami" } = {}) {
  if (!BOT_IDS.includes(botId)) throw new Error(`Robot inconnu : « ${botId} » (${BOT_IDS.join(", ")})`);
  const state = newGame(seed);
  const me = first === "bot" ? 1 : 0;
  const players = [humanEntry(me, name), botEntry(1 - me, botId)].sort((a, b) => a.seat - b.seat);
  const log = startLog(state, { rules: RULES, players, seed });
  // Where the game was played (Sami, 12/10): the page writes no `client`; the CLI says so, and how it was driven.
  log.client = { app: "cli", mode: CLIENT_MODE };
  return { state, me, bot: botPlayer(botId, seed + 1), log, sort: "suit", last: null };
}

/** A game saved by `--new` / `--step`: the replay is the save. */
function loadSession(log) {
  const human = log.players.find((player) => player.kind === "human");
  const bot = log.players.find((player) => player.kind === "bot");
  return { state: stateAt(log, log.turns.length + 1), me: human.seat, bot: botPlayer(bot.bot, log.seed + 1), log, sort: "suit", last: null };
}

const moveText = (state, entry) => (entry.pass ? "passe" : `${entry.move.card} → borne ${entry.move.border}`);

/** The borders `before` did not own and the state now does, said in words (none: an empty list). */
function claims(session, before) {
  const { state, me } = session;
  const news = state.borders.map((border, index) => ({ index, owner: border.owner })).filter(({ index, owner }) => owner !== null && owner !== undefined && owner !== before[index]);
  return news.length > 0 ? [claimText(news, me)] : [];
}

const owners = (state) => state.borders.map((border) => border.owner);

/** The bot plays until it is the human's turn or the game is over; `last` says what it did. */
function botTurns(session) {
  const { state, me, log, bot } = session;
  const said = [];
  while (!state.over && state.current !== me) {
    const before = owners(state);
    const entry = playBot(log, state, bot);
    said.push(`${BOT_LINEUP[bot.id].label} : ${moveText(state, entry)}`, ...claims(session, before));
  }
  session.last = said.length > 0 ? said.join(" · ") : session.last;
}

/** The human's move (or pass), then the bot's answer. */
function humanTurn(session, move, thinkMs) {
  const before = owners(session.state);
  const entry = playLogged(session.log, session.state, move);
  if (thinkMs !== undefined) entry.thinkMs = thinkMs;
  const won = claims(session, before);
  botTurns(session);
  // The claims right after the human's move: theirs, or the bot's (the opponent claims next under the page's rule).
  if (won.length > 0) session.last = [`Après ton coup : ${won.join(", ")}`, session.last].filter(Boolean).join(" · ");
}

/** The end in words, with the borders the loser could still have claimed (the engine's own proof). */
const endOf = ({ state, me }) => endText(state, me, { canClaim: (index, player) => isClaimable(state, index, player) });

/** Writes the finished game to replays/, as the page does; returns its path. */
async function saveReplay(session) {
  finishLog(session.log, session.state);
  await mkdir(REPLAYS, { recursive: true });
  const name = replayFileName(session.log);
  await writeFile(new URL(name, REPLAYS), JSON.stringify(session.log, null, 1));
  return `${REPLAY_DIRS.recent}/${name}`;
}

function show(session, extra = {}) {
  const order = handOrder(session.state, session.me, session.sort);
  if (machine) return console.log(JSON.stringify({ ...machineView(session.state, session.me, { order, last: session.last }), ...extra }));
  console.log(`\n${textView(session.state, session.me, { order, last: session.last })}`);
  if (extra.error) console.log(`! ${extra.error}`);
  if (extra.end) console.log(["", extra.end, extra.replay ? "Replay : " + extra.replay : ""].join("\n").trimEnd());
}

/** Applies one typed line; true when a move (or pass) was played. */
function apply(session, line, thinkMs) {
  const order = handOrder(session.state, session.me, session.sort);
  const read = parseInput(line, session.state, order);
  if (read.error) return { error: read.error };
  if (read.help) return { error: HELP };
  if (read.sort) session.sort = session.sort === "suit" ? "value" : "suit";
  if (read.move || read.pass) humanTurn(session, read.move ?? null, thinkMs);
  return read;
}

/** One typed line of the interactive game; true when the game is over or given up. */
async function onLine(session, line, thinkMs) {
  const read = apply(session, line, thinkMs);
  if (read.quit) return true;
  if (session.state.over) {
    show(session, { end: endOf(session), replay: await saveReplay(session) });
    return true;
  }
  // A mistake or the help: the message alone, the board is still on screen (machine mode repeats the state).
  if (read.error && !machine) console.log(`! ${read.error}`);
  else show(session, read.error ? { error: read.error } : {});
  return false;
}

/** The player's name: `--name`, or asked on the first line (Sami, 12/10); a program (`--machine`) is "agent". */
async function nameFrom(lines) {
  if (option("--name") !== undefined) return option("--name");
  if (machine) return "agent";
  process.stdout.write("Ton prénom ? ");
  const { value } = await lines.next();
  return value?.trim() || "joueur";
}

async function interactive() {
  const input = createInterface({ input: process.stdin, terminal: false });
  const lines = input[Symbol.asyncIterator]();
  const session = newSession({ ...sessionOptions("agent"), name: await nameFrom(lines) });
  if (!machine) console.log(`Bornage contre ${BOT_LINEUP[session.bot.id].label} ${BOT_LINEUP[session.bot.id].version}. ${HELP}`);
  botTurns(session);
  show(session);
  let asked = performance.now();
  for (let next = await lines.next(); !next.done; next = await lines.next()) {
    if (await onLine(session, next.value, Math.round(performance.now() - asked))) break;
    asked = performance.now();
  }
  input.close();
}

/** `--new`: a fresh game (the bot moves first if it starts); `--step`: the saved one. */
async function openSession(path) {
  if (!args.includes("--new")) return loadSession(JSON.parse(await readFile(path, "utf8")));
  const session = newSession(sessionOptions("agent"));
  botTurns(session);
  return session;
}

async function stepMode() {
  const path = resolve(process.cwd(), option("--new") ?? option("--step"));
  const session = await openSession(path);
  const line = args.includes("--step") ? args[args.indexOf("--step") + 2] : undefined;
  const read = line === undefined || session.state.over ? {} : apply(session, line);
  // Over: the replay is finished (its result written) before the save file is.
  const replay = session.state.over ? await saveReplay(session) : null;
  await writeFile(path, JSON.stringify(session.log, null, 1));
  if (replay) return show(session, { end: endOf(session), replay });
  show(session, read.error ? { error: read.error } : {});
}

if (args.includes("--new") || args.includes("--step")) await stepMode();
else await interactive();
