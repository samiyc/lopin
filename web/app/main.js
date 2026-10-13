import { $, openDialog } from "./dom.js";
import { setupInput } from "./drag.js";
import { wireObserve, wireReplays } from "./panels.js";
import { hasGame, playInput, render as renderPlay, setVisible, wirePlayControls } from "./play.js";
import { puzzleInput, render as renderPuzzle, showPuzzles, wirePuzzles } from "./puzzles.js";
import { renderStats } from "./stats.js";
import { clearTable, wireSuitBar } from "./table.js";
import { loaded, pause, render as renderViewer, wirePlayer } from "./viewer.js";

/**
 * Boot: four tabs over one table. "Jouer" and "Puzzles" take input — routed
 * to the tab on show; "Observer" and "Replays" drive the shared viewer. Only
 * the visible tab draws on the table: a bot still thinking in "Jouer" waits
 * for its tab to come back.
 */
const replays = wireReplays();

wirePlayer();
wirePlayControls();
wireObserve();
const INPUTS = { play: playInput, puzzles: puzzleInput };
let mode = "play";
/** The table's input goes to the tab on show; the others ignore it. */
const routed = Object.fromEntries(Object.keys(playInput).map((name) => [name, (...args) => (INPUTS[mode] ? INPUTS[mode][name](...args) : undefined)]));
routed.enabled = () => Boolean(INPUTS[mode]?.enabled());
setupInput(routed);
wireSuitBar();
wirePuzzles();

const PANELS = {
  play: ["panel-play"],
  observe: ["panel-observe", "player", "explain"],
  replays: ["panel-replays", "player", "explain"],
  puzzles: ["panel-puzzles"],
  stats: [],
};

const EMPTY_MESSAGES = {
  play: "Lance une nouvelle partie.",
  observe: "Choisis deux robots et lance une partie.",
  replays: "Choisis une partie dans la liste.",
  puzzles: "Chargement des puzzles…",
  stats: "",
};

/** Folding the sidebar (« / »): Jouer only, remembered in this browser. */
const FOLD_KEY = "lopin.sidebarFolded";
let folded = false;
try { folded = localStorage.getItem(FOLD_KEY) === "1"; } catch { /* storage blocked: start unfolded */ }

function applyFold() {
  const on = folded && mode === "play";
  document.querySelector(".layout").classList.toggle("folded", on);
  const button = $("btn-fold");
  button.hidden = mode !== "play";
  button.textContent = on ? "»" : "«";
  button.title = on ? "Déplier le panneau" : "Replier le panneau";
  button.setAttribute("aria-expanded", String(!on));
}

$("btn-fold").addEventListener("click", () => {
  folded = !folded;
  try { localStorage.setItem(FOLD_KEY, folded ? "1" : "0"); } catch { /* storage blocked: this visit only */ }
  applyFold();
});

function redraw(tab) {
  if (tab === "stats") return renderStats();
  if (tab === "puzzles") return renderPuzzle();
  const live = tab === "play" ? hasGame() : loaded();
  if (!live) return clearTable(EMPTY_MESSAGES[tab]);
  return tab === "play" ? renderPlay() : renderViewer();
}

function show(tab) {
  mode = tab;
  clearTable(EMPTY_MESSAGES[tab]);
  document.querySelectorAll(".tabs [role=tab]").forEach((button) => button.setAttribute("aria-selected", String(button.dataset.mode === tab)));
  const visible = new Set(PANELS[tab]);
  for (const id of new Set(Object.values(PANELS).flat())) $(id).hidden = !visible.has(id);
  pause();
  // Stats take the table's place and the sidebar's: no board, no pile, no
  // turn counter, and no empty 300px column pushing them to the right.
  $("table").hidden = tab === "stats";
  $("counters").hidden = tab === "stats";
  document.querySelector(".sidebar").hidden = tab === "stats";
  $("stats-view").hidden = tab !== "stats";
  applyFold();
  setVisible(tab === "play");
  showPuzzles(tab === "puzzles");
  redraw(tab);
  if (tab === "replays") replays.refresh();
}

document.querySelectorAll(".tabs [role=tab]").forEach((tab) => tab.addEventListener("click", () => show(tab.dataset.mode)));
// The Versions menu closes once a page is opened, or on a click anywhere else.
document.addEventListener("click", (event) => {
  const menu = $("versions");
  if (menu.open && (!menu.contains(event.target) || event.target.closest("a"))) menu.open = false;
});
show("play");
openDialog($("dialog-new"));

// `?debug` exposes the play controls, to drive a game from the console or a
// browser-automation tool. Off by default.
if (new URLSearchParams(location.search).has("debug")) window.__lopin = { play: playInput, puzzles: puzzleInput, show };
