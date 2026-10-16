import { replayStates } from "../../src/replay/log.js";
import { $ } from "./dom.js";
import { renderExplain } from "./explain.js";
import { START, endOf, isAtEnd, stepBack, stepForward } from "./steps.js";
import { followHands, sortBySuit, sortByValue } from "./hand.js";
import { SPEC, playerName } from "./runner.js";
import { renderTable } from "./table.js";
import { settledAtEnd, tableView } from "./view.js";

/**
 * The player of logged games, shared by "Observer" (a bot game generated on
 * the spot) and "Replays" (a saved log). Both hands are shown. Stepping past
 * the last move settles the borders one by one, as in a real game. Human
 * moves are weighed against what the Stratège 2.1 would have played: too slow
 * to compute as a replay opens, that opinion comes from a worker, move by
 * move, and the panel says "réfléchit…" until it lands.
 */
const viewer = { log: null, frames: [], index: 0, shown: 0, timer: null, sorts: new Map(), orders: [[], []], advisor: null };

/** Asks a fresh worker for the Stratège 2.1's opinion on each human move of `log`; a replay opened since stops the last one. */
function askAdvice(log) {
  viewer.advisor?.terminate();
  viewer.advisor = new Worker(new URL("./advice-worker.js", import.meta.url), { type: "module" });
  viewer.frames.forEach((frame) => {
    if (frame.entry?.move && !frame.entry.candidates) frame.advicePending = true;
  });
  viewer.advisor.onmessage = ({ data }) => {
    if (viewer.log !== log || data.done) return;
    Object.assign(viewer.frames[data.index], data.opinion, { advicePending: false });
    if (data.index === viewer.index) render();
  };
  viewer.advisor.postMessage({ id: 1, log });
}

/** Both hands' order at every position, from the deal and the sorts asked for. */
function arrangeHands() {
  viewer.orders = [0, 1].map((seat) => followHands(SPEC, viewer.frames.map((frame) => frame.state.hands[seat]), viewer.sorts));
}

/** "Tour 12": the move on show, as the log and the explain panel number it. */
function turnText(frame) {
  if (!frame.entry) return "Distribution";
  return frame.state.over ? `Tour ${frame.entry.turn} · partie terminée` : `Tour ${frame.entry.turn}`;
}

const last = () => viewer.frames.length - 1;
const settledCount = () => (viewer.frames[last()] ? settledAtEnd(viewer.frames[last()].state).length : 0);
const atEnd = () => isAtEnd(viewer, last(), settledCount());
const moveTo = ({ index, shown }) => {
  [viewer.index, viewer.shown] = [index, shown];
};

function lastMoveOf(frame) {
  const entry = frame.entry;
  if (!entry?.move) return null;
  return { border: entry.move.border - 1, side: entry.player === 0 ? "bottom" : "top" };
}

export function render() {
  const { log, frames, index, timer } = viewer;
  if (log === null) return;
  const frame = frames[index];
  const lastMove = lastMoveOf(frame);
  const shown = index === last() ? viewer.shown : 0;
  const [handOrder, topOrder] = viewer.orders.map((orders) => orders[index]);
  const view = tableView(SPEC, frame.state, { bottom: 0, reveal: true, shown, lastMove, handOrder, topOrder });
  const names = { bottom: playerName(log.players[0]), top: playerName(log.players[1]) };
  renderTable(view, { status: timer ? "Lecture…" : "En pause.", names, lastMove, showTools: true });
  $("turn").textContent = turnText(frame);
  $("frame").textContent = `Coup ${index} / ${last()}`;
  $("btn-toggle").textContent = timer ? "❚❚" : "▶";
  $("btn-toggle").setAttribute("aria-label", timer ? "Pause" : "Lecture");
  renderExplain(log, frame);
}

export function pause() {
  clearInterval(viewer.timer);
  viewer.timer = null;
}

function next() {
  moveTo(stepForward(viewer, last(), settledCount()));
  if (atEnd()) pause();
  render();
}

function prev() {
  moveTo(stepBack(viewer));
  render();
}

/** Back to the deal. */
function first() {
  moveTo(START);
  render();
}

/** The final table, every border settled: the result at a glance. */
function end() {
  moveTo(endOf(last(), settledCount()));
  render();
}

function play() {
  pause();
  if (atEnd()) moveTo(START);
  viewer.timer = setInterval(next, Number($("speed").value));
  render();
}

export function load(log, { autoplay = false } = {}) {
  pause();
  viewer.log = log;
  viewer.frames = replayStates(log);
  askAdvice(log);
  viewer.sorts = new Map();
  arrangeHands();
  moveTo(START);
  if (autoplay) play();
  else render();
}

export const loaded = () => viewer.log !== null;

/** "Trier" in the player: both hands, from the position on show onwards. */
function sortFromHere(sort) {
  if (viewer.log === null || $("player").hidden) return;
  viewer.sorts.set(viewer.index, sort);
  arrangeHands();
  render();
}
export const currentLog = () => viewer.log;

const STEPS = { "btn-first": first, "btn-prev": prev, "btn-next": next, "btn-last": end };
const KEYS = { Home: first, End: end, ArrowLeft: prev, ArrowRight: next };

/** Home and End jump to either end, the arrows step a move, while a game is loaded in the player. */
function onKey(event) {
  const step = KEYS[event.key];
  if (!step || $("player").hidden || viewer.log === null || event.target.closest?.("input, select, dialog")) return;
  event.preventDefault();
  pause();
  step();
}

export function wirePlayer() {
  for (const [id, step] of Object.entries(STEPS)) {
    $(id).addEventListener("click", () => {
      pause();
      step();
    });
  }
  document.addEventListener("keydown", onKey);
  $("sort-suit").addEventListener("click", () => sortFromHere(sortBySuit));
  $("sort-value").addEventListener("click", () => sortFromHere(sortByValue));
  $("btn-toggle").addEventListener("click", () => {
    if (!viewer.timer) return play();
    pause();
    return render();
  });
  $("speed").addEventListener("change", () => {
    if (viewer.timer) play();
  });
}
