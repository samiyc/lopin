import { finishLog, playLogged, snapshot } from "../../../src/replay/core/log.js";
import { legalMoves } from "../../../src/sim/engine/game.js";
import { clockLine, watchFocus } from "../board/clock.js";
import { $, freshSeed, toast, wait } from "../board/dom.js";
import { clearDrag } from "../board/drag.js";
import { moveCard, sortBySuit, sortByValue, syncOrder } from "../board/hand.js";
import { saveReplay } from "../replays/replays-api.js";
import { SPEC } from "../replays/runner.js";
import { wireGameDialogs } from "./play-dialogs.js";
import { createPlayGame } from "./play-game.js";
import { keepSelection, planPremove, resolvePremove } from "./premove.js";
import { awaitsDiscard, bordersFor, discardMove, figureMarks, stepOf } from "../board/figure-input.js";
import { statusLine } from "./play-status.js";
import { clearTable, renderTable } from "../board/table.js";
import { settledAtEnd, tableView } from "../replays/view.js";

/**
 * "Jouer": the human against a bot of the line-up, on the official rules.
 * Borders are settled only once every card is down, then revealed one by one
 * in the order they filled. The game's log is saved when it ends — never
 * after "Recommencer". One game at a time, so its state lives here.
 *
 * Each human move is timed (`thinkMs` in the log) by a clock that stops
 * while the page is hidden or out of focus, or the "Jouer" tab is not shown.
 */
/** How long a bot turn lasts at least; its thinking time counts toward it. */
const BOT_DELAY = 700;
const PAINT = 30;
const REVEAL_DELAY = 650;

const play = { game: null, generation: 0, visible: true, syncFocus: () => {} };

const alive = (id) => play.game !== null && id === play.generation;
const active = () => play.game !== null && !play.game.state.over;
const humanTurn = () => active() && play.game.state.current === play.game.human;
const canPass = () => humanTurn() && legalMoves(play.game.state).length === 0;

const status = () => statusLine(play.game, humanTurn(), canPass());

export function legalFor(index) {
  if (!humanTurn()) return new Set();
  // The extension: a figure's borders, or the Dame de Cœur's second border (figure-input.js).
  return bordersFor(legalMoves(play.game.state), play.game.order[index], play.game.pending);
}

function renderClock() {
  if (play.game !== null && play.visible) $("clock").textContent = clockLine(play.game.clock, { humanTurn: humanTurn(), over: play.game.state.over });
}

export function render() {
  const { game } = play;
  if (game === null || !play.visible) return;
  renderClock();
  const view = tableView(SPEC, snapshot(game.state), { bottom: game.human, handOrder: game.order, shown: game.shown, lastMove: game.lastMove, reveal: Boolean(game.openHands) });
  renderTable(view, {
    status: status(),
    names: { bottom: game.name, top: game.opponentName },
    interactive: active(),
    selected: game.selected,
    legalBorders: game.selected === null ? new Set() : legalFor(game.selected),
    lastMove: game.lastMove,
    premove: game.premove?.border ?? null,
    marks: humanTurn() ? figureMarks(legalMoves(game.state), game.order[game.selected], game.pending) : undefined,
    showTools: true,
    canPass: canPass(),
  });
}

function afterMove(player, entry) {
  const { game } = play;
  const previous = game.order;
  game.order = syncOrder(game.order, game.state.hands[game.human]);
  game.lastMove = entry.move ? { border: entry.move.border - 1, side: player === game.human ? "bottom" : "top" } : null;
  game.selected = keepSelection(game.selected, previous, game.order, player === game.human);
  if (player === game.human) game.premove = null;
  else if (!entry.move) toast(`${game.opponentName} passe son tour : aucun coup possible. À toi de rejouer.`); // nothing moved: it looked like a bug
  render();
}

const PREMOVE_DELAY = 250;

/** During the bot's turn: the card at `index` is programmed for `border` (premove.js). */
function programMove(index, border) {
  if (index === null) return;
  play.game.premove = planPremove(play.game.order, index, border);
  play.game.selected = index;
  render();
}

/** The human's turn has come: a move programmed during the bot's turn goes now, if still legal. */
async function playPremove(id) {
  const outcome = resolvePremove(play.game.premove, play.game.order, legalFor);
  play.game.premove = null;
  if (outcome?.cancel) play.game.selected = outcome.index;
  if (!outcome || outcome.cancel) return render();
  await wait(PREMOVE_DELAY);
  if (alive(id) && humanTurn()) playCard(outcome, outcome.border);
}

async function save(id) {
  try {
    const saved = await saveReplay(play.game.log);
    if (!alive(id)) return;
    play.game.saved = `Partie enregistrée : ${saved.path}`;
    toast(play.game.saved);
  } catch (error) {
    if (alive(id)) play.game.saved = `Replay non enregistré (${error.message}).`;
  }
  render();
}

async function finish(id) {
  const { game } = play;
  game.clock.pause();
  finishLog(game.log, game.state);
  game.log.result.activeMs = Math.round(game.clock.active());
  game.revealing = true;
  for (game.shown = 0; game.shown < settledAtEnd(game.state).length; game.shown += 1) {
    render();
    await wait(REVEAL_DELAY);
    if (!alive(id)) return;
  }
  game.revealing = false;
  game.shown = Infinity;
  render();
  await save(id);
}

/** One bot move: paint "réfléchit…", think, then let the rest of `BOT_DELAY` pass. */
async function botTurn(id) {
  render();
  const started = performance.now();
  await wait(PAINT);
  if (!alive(id)) return;
  const { game } = play;
  const { move, scored } = await game.thinker.decide(game.state, game.log);
  await wait(Math.max(0, BOT_DELAY - (performance.now() - started)));
  if (!alive(id)) return;
  const player = game.state.current;
  afterMove(player, playLogged(game.log, game.state, move, scored));
}

async function botTurns(id) {
  while (alive(id) && active() && !humanTurn()) await botTurn(id);
  if (!alive(id)) return;
  if (humanTurn()) {
    play.game.clock.mark();
    play.game.thinker.ponder(play.game.log);
    await playPremove(id);
  } else if (play.game.state.over) await finish(id);
}

/**
 * Where the card of `grip` sits now: its own index if the card is still
 * there, else wherever it went, else null. A grip without a card (a click on
 * the current selection) is taken at its word.
 */
function locate({ index, card }) {
  const { order } = play.game;
  if (card === undefined || order[index] === card) return index;
  const found = order.indexOf(card);
  return found === -1 ? null : found;
}

function executeMove(move) {
  const { game } = play;
  Object.assign(game, { pending: null, selected: null });
  const thinkMs = Math.round(game.clock.mark());
  const entry = playLogged(game.log, game.state, move);
  entry.thinkMs = thinkMs;
  afterMove(game.human, entry);
  botTurns(play.generation);
}

/** The Valet de Trèfle waiting for its discard, a card picked (or none, or the Valet on a border): play it, or cancel the wait. */
function resolveDiscard(index, border = null) {
  const move = discardMove(play.game.pending, index === null ? null : play.game.order[index], border);
  if (move) return executeMove(move);
  play.game.pending = null;
  render();
}

export function playCard(grip, border) {
  if (!active()) return;
  const index = locate(grip);
  if (!humanTurn()) return programMove(index, border);
  if (index === null) return;
  if (awaitsDiscard(play.game.pending)) return resolveDiscard(index, border);
  if (!legalFor(index).has(border)) return;
  const step = stepOf(play.game.order[index], border, play.game.pending, { pile: play.game.state.pile.length });
  play.game.pending = step.pending ?? null;
  if (!step.pending) return executeMove(step.move);
  play.game.selected = index; // kept: the Dame de Cœur's second click, or the Valet de Trèfle's border again (no discard)
  render();
}

/** No legal move left to the human: the turn passes, as it does for a bot. */
const pass = () => canPass() && executeMove(null);

/** `{ first, opponent, name, bonus, openHands }`: the answers of "Nouvelle partie" (play-dialogs.js). */
export function start(choices) {
  play.generation += 1;
  clearDrag();
  play.game?.thinker.stop();
  play.game = createPlayGame(choices, freshSeed());
  play.syncFocus();
  render();
  botTurns(play.generation);
}

/** Drops the game in progress; nothing is saved. */
export function abandon() {
  play.generation += 1;
  clearDrag();
  play.game?.thinker.stop();
  play.game = null;
  if (play.visible) {
    clearTable("Partie abandonnée, rien n'a été enregistré.");
    $("clock").textContent = "";
  }
}

export const hasGame = () => play.game !== null;

/** Only the visible tab may draw on the shared table. */
export function setVisible(visible) {
  play.visible = visible;
  $("clock").textContent = "";
  if (!visible) play.game?.clock.pause();
  else play.syncFocus();
}

/** Rearranges the hand; a selected card stays selected wherever it lands. */
function reorderWith(transform) {
  if (!active() || !play.visible) return;
  const { game } = play;
  const picked = game.selected === null ? null : game.order[game.selected];
  game.order = transform(game.order);
  if (picked !== null) game.selected = game.order.indexOf(picked);
  render();
}

/** The dialogs and buttons of the "Jouer" panel. */
export function wirePlayControls() {
  wireGameDialogs({ start, abandon, active });
  play.syncFocus = watchFocus(() => (active() && play.visible ? play.game.clock : null), renderClock);
  setInterval(renderClock, 1000);
  $("sort-suit").addEventListener("click", () => reorderWith((order) => sortBySuit(SPEC, order)));
  $("sort-value").addEventListener("click", () => reorderWith((order) => sortByValue(SPEC, order)));
  $("btn-pass").addEventListener("click", pass);
}

/**
 * Input controller for `drag.js`: the hand can be arranged at any time during
 * a game; a card can only be played on the human's turn (`legalFor` is empty
 * otherwise).
 */
export const playInput = {
  enabled: () => play.visible && active(),
  selected: () => play.game?.selected ?? null,
  select(index) {
    if (awaitsDiscard(play.game.pending)) return resolveDiscard(index);
    const { game } = play;
    game.selected = index;
    game.pending = null;
    if (index === null) game.premove = null;
    render();
  },
  play: playCard,
  pass,
  reorder(grip, to) {
    const from = active() ? locate(grip) : null;
    if (from !== null) reorderWith((order) => moveCard(order, from, to));
  },
  legalFor,
  /** For `?debug`: how the thinker reached its last answer (time pondered, rollouts, time thought). */
  thinking: () => play.game?.thinker.last ?? null,
};
