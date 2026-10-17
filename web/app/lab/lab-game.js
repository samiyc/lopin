import { BOT_IDS, BOT_LINEUP, DEFAULT_OPPONENT } from "../../../src/config/bots.js";
import { finishLog, playLogged, startLog } from "../../../src/replay/core/log.js";
import { ISMCTS, ismctsSettings } from "../../../src/sim/mcts/ismcts.js";
import { $, el, freshSeed, recall, remember, toast } from "../board/dom.js";
import { createThinker } from "../play/thinker.js";
import { saveReplay } from "../replays/replays-api.js";
import { RULES, botEntry, botPlayer, newGame, playerName } from "../replays/runner.js";
import { currentLog, follow, goTo, loaded, position } from "../replays/viewer.js";
import { compactLab } from "./lab-text.js";
import { clearLabs, recordLab, setThinking, showProgress, wireLabPanel } from "./lab-panel.js";

/**
 * The Labo's game (Sami, 17/10): the Observer's bots now play move by move, live — « Coup suivant », or « En continu »
 * until paused — and every tree bot reports its tree (think-worker.js `lab`), drawn under the table by lab-panel.js.
 * The bots are the duels' own: seeded as the old whole-game Observer seeded them (seed + 1, seed + 2), each searching its engine's iterations (the
 * line-up's clock only bounds a runaway), so a Labo game plays the moves of the same game in Node.
 *
 * The workers are capped (Sami, 17/10: 4 by default, up to the cores minus 3), split per bot: an Oracle light held to
 * one worker searches both its trees there, with the same moves.
 */
const WORKERS_KEY = "lopin.labWorkers";
const DEFAULT_WORKERS = 4;
const LIMIT_MS = 180_000;
const AUTO_GAP_MS = 250;

const game = { log: null, state: null, thinkers: null, auto: false, busy: false, ids: null, active: () => false };

/** The most workers the Labo may take: every logical core but 3, at least one. */
const maxWorkers = () => Math.max(1, (navigator.hardwareConcurrency || 4) - 3);

function workerCap() {
  const typed = Number.parseInt($("lab-workers").value, 10);
  const cap = Number.isInteger(typed) ? Math.min(Math.max(typed, 1), maxWorkers()) : DEFAULT_WORKERS;
  $("lab-workers").value = String(cap);
  remember(WORKERS_KEY, String(cap));
  return cap;
}

/** A line-up bot's thinking in the Labo: its own worker count under the cap, its iterations rather than the clock. */
function labThink(id, cap) {
  const think = BOT_LINEUP[id].think;
  if (!think) return null;
  return { ...think, limitMs: LIMIT_MS, minMs: 0, workers: Math.min(think.workers ?? 1, cap) };
}

/** The depth a log's player searches (its engine's `depth`), for the « depth never reached » finding. */
export function depthOf(player) {
  const engine = BOT_LINEUP[player?.bot]?.engine;
  const settings = engine ? ismctsSettings(engine.split("@")[0]) : null;
  return settings ? (settings.depth ?? ISMCTS.depth) : null;
}

function fillBotSelect(select, chosen) {
  select.replaceChildren(...BOT_IDS.map((id) => el("option", { value: id, selected: id === chosen }, `${BOT_LINEUP[id].label} ${BOT_LINEUP[id].version}`)));
}

function seedFromInput() {
  const typed = Number.parseInt($("observe-seed").value, 10);
  const seed = Number.isInteger(typed) && typed >= 0 ? typed : freshSeed();
  $("observe-seed").value = String(seed);
  return seed;
}

function stopThinkers() {
  game.thinkers?.forEach((thinker) => thinker.stop());
  game.thinkers = null;
}

function refreshButtons() {
  const over = !game.state || game.state.over;
  $("btn-lab-step").disabled = over || game.busy;
  $("btn-lab-auto").disabled = over;
  $("btn-lab-auto").textContent = game.auto ? "Pause" : "En continu";
  $("btn-lab-auto").setAttribute("aria-pressed", String(game.auto));
}

/** Draws the game; `jump` (see `follow`): to the last move while a bot thinks, to stay on the decision just made after it. */
const show = (status = null, jump = undefined) => follow(game.log, { status, draw: game.active(), jump });

/** A fresh game between the two bots chosen, nothing played yet. */
function startGame() {
  stopThinkers();
  const seed = seedFromInput();
  const ids = [$("observe-bottom").value, $("observe-top").value];
  const cap = workerCap();
  game.state = newGame(seed);
  game.ids = ids;
  const players = [botPlayer(ids[0], seed + 1), botPlayer(ids[1], seed + 2)];
  game.thinkers = players.map((player, seat) => createThinker(player, labThink(ids[seat], cap), seed + 1 + seat, { lab: true, onProgress: showProgress }));
  game.log = startLog(game.state, { rules: RULES, players: [botEntry(0, ids[0]), botEntry(1, ids[1])], seed });
  clearLabs(game.log);
  game.at = null;
  game.auto = false;
  game.busy = false;
  show("Prêt : « Coup suivant » ou « En continu ».");
  refreshButtons();
}

/** The bot to move searches (its bars move live) and plays; its report is kept for that decision, in full and in the log. */
async function playTurn(log, state) {
  const turn = log.turns.length + 1;
  const name = playerName(log.players[state.current]);
  setThinking({ turn, name, progress: null });
  show(`${name} réfléchit…`, true);
  const started = performance.now();
  const reply = await game.thinkers[state.current].decide(state, log);
  if (game.log !== log) return;
  const entry = playLogged(log, state, reply.move, reply.scored);
  entry.thinkMs = Math.round(reply.thoughtMs ?? performance.now() - started);
  if (reply.lab) {
    recordLab(turn, reply.lab);
    entry.lab = compactLab(reply.lab);
  }
  if (state.over) finishLog(log, state);
}

const canStep = () => Boolean(game.state) && !game.state.over && !game.busy;
const goesOn = (log) => game.auto && game.log === log && !log.result;

/** One move, then the next after a breath while « En continu » holds. */
async function step() {
  if (!canStep()) return;
  const { log, state } = game;
  game.busy = true;
  refreshButtons();
  try {
    await playTurn(log, state);
  } finally {
    if (game.log === log) {
      setThinking(null);
      game.busy = false;
      // Step by step, the player stays on the position the bot thought about: its tree on show, « > » shows the move.
      show(goesOn(log) ? "En continu…" : null, game.auto);
      refreshButtons();
    }
  }
  if (goesOn(log)) setTimeout(() => game.auto && step(), AUTO_GAP_MS);
}

function toggleAuto() {
  game.auto = !game.auto;
  refreshButtons();
  if (game.auto) step();
}

/** Back on the tab: the viewer, shared with Replays, takes the Labo's game again (the tab then draws it). */
export function showLab() {
  if (!game.log) return;
  follow(game.log, { draw: false, jump: false });
  goTo(game.at ?? Infinity);
}

/** Leaving the tab pauses a continuous game (the move under way finishes, nothing is drawn meanwhile) and remembers the move on show. */
export function pauseLab() {
  game.auto = false;
  if (game.log && currentLog() === game.log) game.at = position();
  if (game.state) refreshButtons();
}

export function wireLab({ active }) {
  game.active = active;
  fillBotSelect($("observe-bottom"), DEFAULT_OPPONENT);
  fillBotSelect($("observe-top"), "basique");
  $("lab-workers").max = String(maxWorkers());
  $("lab-workers").value = recall(WORKERS_KEY, String(Math.min(DEFAULT_WORKERS, maxWorkers())));
  wireLabPanel({ active, depthOf });
  $("btn-observe").addEventListener("click", startGame);
  $("btn-lab-step").addEventListener("click", step);
  $("btn-lab-auto").addEventListener("click", toggleAuto);
  $("lab-workers").addEventListener("change", workerCap);
  $("btn-observe-save").addEventListener("click", async () => {
    if (!loaded()) return toast("Lance d'abord une partie.");
    try {
      toast(`Partie enregistrée : ${(await saveReplay(currentLog())).path}`);
    } catch (error) {
      toast(`Enregistrement impossible : ${error.message}`);
    }
    return undefined;
  });
  refreshButtons();
}
