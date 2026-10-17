import { wireDeckColors } from "./board/deck-colors.js";
import { $, openDialog } from "./board/dom.js";
import { setupInput } from "./board/drag.js";
import { wireReplays } from "./replays/panels.js";
import { pauseLab, showLab, wireLab } from "./lab/lab-game.js";
import { hasGame, playInput, render as renderPlay, setVisible, wirePlayControls } from "./play/play.js";
import { puzzleInput, render as renderPuzzle, showPuzzles, wirePuzzles } from "./puzzles/puzzles.js";
import { renderStats } from "./stats.js";
import { clearTable, wireSuitBar } from "./board/table.js";
import { loaded, pause, render as renderViewer, wirePlayer } from "./replays/viewer.js";

/**
 * Boot: four tabs over one table. "Jouer" and "Puzzles" take input — routed
 * to the tab on show; "Observer" and "Replays" drive the shared viewer. Only
 * the visible tab draws on the table: a bot still thinking in "Jouer" waits
 * for its tab to come back.
 */
wireDeckColors();
const replays = wireReplays();

wirePlayer();
wirePlayControls();
const INPUTS = { play: playInput, puzzles: puzzleInput };
let mode = "play";
// The Labo (the Observer, 17/10) draws its panel under the table on its own tab and in Replays.
wireLab({ active: () => mode === "observe" || mode === "replays" });
/** The table's input goes to the tab on show; the others ignore it. */
const routed = Object.fromEntries(Object.keys(playInput).map((name) => [name, (...args) => (INPUTS[mode] ? INPUTS[mode][name](...args) : undefined)]));
routed.enabled = () => Boolean(INPUTS[mode]?.enabled());
setupInput(routed);
wireSuitBar();
wirePuzzles();

const PANELS = {
  play: ["panel-play"],
  observe: ["panel-observe", "player", "explain", "lab-view"],
  replays: ["panel-replays", "player", "explain", "lab-view"],
  puzzles: ["panel-puzzles"],
  stats: [],
};

const EMPTY_MESSAGES = {
  play: "Lance une nouvelle partie.",
  observe: "Choisis deux robots et lance une nouvelle partie : ils jouent coup par coup, leur arbre sous la table.",
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
  if (tab === "observe") showLab();
  else pauseLab();
  redraw(tab);
  if (tab === "replays") replays.refresh();
}

document.querySelectorAll(".tabs [role=tab]").forEach((tab) => tab.addEventListener("click", () => show(tab.dataset.mode)));
// C and V sort the hand by colour or by value, as the buttons do wherever they are on show (Sami, 16/10).
const SORT_KEYS = { c: "sort-suit", v: "sort-value" };
const typing = (event) => event.ctrlKey || event.metaKey || event.altKey || Boolean(event.target.closest?.("input, select, textarea, dialog"));
const onShow = (button) => button !== null && button.closest("[hidden]") === null && button.offsetParent !== null;
document.addEventListener("keydown", (event) => {
  const id = SORT_KEYS[event.key?.toLowerCase()];
  if (!id || typing(event) || !onShow($(id))) return;
  event.preventDefault();
  $(id).click();
});
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
