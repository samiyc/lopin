import { parseCard } from "../../../src/core/notation.js";
import { stateAt } from "../../../src/replay/core/log.js";
import { $, el } from "../board/dom.js";
import { SPEC, playerName } from "../replays/runner.js";
import { render as renderViewer, setLabHooks } from "../replays/viewer.js";
import { decisionAt, expandLab, labMarks } from "./lab-text.js";
import { BOT_LINEUP } from "../../../src/config/bots.js";
import { normalizeEngine } from "../../../src/sim/mcts/engine-id.js";
import { labConfigs } from "./lab-builder.js";
import { bandDetail, candidateBars, findings, header, levelRows, nodeDetail, probeRows, seenRows } from "./lab-parts.js";
import { judgesSection, wireJudges } from "./lab-judges.js";
import { keepSection, wireKeep } from "./lab-keep.js";
import { replaySection, wireReplay } from "./lab-replay.js";
import { createTreeView } from "./tree-view.js";

/**
 * The Labo's panel under the table (Sami, 17/10): for the position on show, the decision of the player to move — its
 * candidates with visits, win rate and interval, coloured as the cards are; what looks odd in its tree; the tree's
 * levels; the tree itself, navigable, with the detail of a node or a ply. While a bot thinks, the bars move live.
 * Clicking a card of the mover's hand (or a candidate) lights the borders it goes to.
 *
 * It reads the reports the Labo's game keeps (`recordLab`) or a replay's `lab` / `tree`, and colours the table
 * through the viewer's hooks; it draws only when the viewer draws, and only on the Labo's tabs.
 */
const panel = { labs: new Map(), game: null, thinking: null, focus: null, tree: 0, decisionKey: null, selection: null, treeState: {}, active: () => false, depthOf: () => null };

/** A full report (with its trees) for decision `turn`, from the Labo's game. */
export function recordLab(turn, lab) {
  panel.labs.set(turn, lab);
}

/** Forgets the reports: a new game, `log`, the only one they (and a live search) belong to. */
export function clearLabs(log) {
  panel.labs.clear();
  panel.thinking = null;
  panel.game = log;
}

const NO_LABS = new Map();

/** `thinking`: `{ turn, name, progress }` while a bot searches decision `turn`, null once it has played. */
export function setThinking(thinking) {
  panel.thinking = thinking;
}

/** A worker's progress: the bars and the cards move, the tree waits for the move. */
export function showProgress(progress) {
  if (!panel.thinking) return;
  panel.thinking.progress = progress;
  if (panel.active()) renderViewer();
}

const playedOf = (entry) => (entry?.move ? { card: parseCard(SPEC, entry.move.card), border: entry.move.border - 1 } : null);

/** A duel's replay keeps only the levels of its tree (`entry.tree`): the panel shows them, without candidates. */
function labOfEntry(entry) {
  if (entry.lab) return expandLab(entry.lab);
  if (entry.tree) return { root: [], trees: [{ levels: entry.tree.levels, snapshot: null }] };
  return null;
}

/** The decision being searched, live, at the last position. */
function liveDecision(index) {
  const thinking = panel.thinking;
  if (!thinking || thinking.turn !== index + 1) return null;
  const lab = thinking.progress ? { root: thinking.progress.root, trees: [] } : null;
  return { entry: null, turn: thinking.turn, lab, live: true, progress: thinking.progress };
}

/** The decision on show: a finished one (the Labo's report, or a replay's), or the one being searched. */
function currentDecision(log, frames, index) {
  const ours = log === panel.game;
  const labs = ours ? panel.labs : NO_LABS;
  const done = decisionAt(frames, index, labs);
  if (!done) return ours ? liveDecision(index) : null;
  return { ...done, lab: labs.get(done.turn) ?? labOfEntry(done.entry), live: false };
}

function marksFor(log, index, frames) {
  if (!panel.active() || !frames[index]) return undefined;
  const decision = currentDecision(log, frames, index);
  const root = decision?.lab?.root;
  if (!root?.length) return undefined;
  const { state } = frames[index];
  return labMarks({ root, played: playedOf(decision.entry), hand: state.hands[state.current], mover: state.current, focus: panel.focus });
}

const names = (log) => [playerName(log.players[0]), playerName(log.players[1])];

function renderDetail(log, tree) {
  const box = $("lab-detail");
  if (!panel.selection) {
    box.replaceChildren(el("p", { class: "hint" }, "Clique un nœud ou un étage pour son détail ; double-clic pour déplier un nœud (sur « +n » : tous ses fils, seuls les meilleurs sont dessinés) ; molette pour zoomer, glisser pour te déplacer, double-clic dans le vide (ou Échap) pour tout revoir."));
    return;
  }
  const parts = panel.selection.kind === "node" ? nodeDetail(tree.snapshot, panel.selection.id, names(log)) : bandDetail(tree.snapshot, tree.levels, panel.selection.depth);
  box.replaceChildren(...parts);
}

function treeChooser(trees) {
  if (trees.length < 2) return null;
  return el("div", { class: "lab-trees" }, "Arbres : ", ...trees.map((_, index) => el("button", { type: "button", class: index === panel.tree ? "" : "quiet", dataset: { tree: index } }, `${index + 1}`)));
}

const LEGEND = () => el("p", { class: "lab-legend" }, "Couleur : taux de victoire pour qui joue le coup, ", el("i", { class: "dot low" }), " 30 % ou moins → ", el("i", { class: "dot high" }), " 70 % ou plus ; taille : visites.");

/** The tree's section: its head, the SVG and the detail beside it; the view is drawn once the section is in place. */
function treeSection(decision, trees) {
  if (trees[panel.tree]?.snapshot) {
    return [el("div", { class: "lab-tree-head" }, el("h3", {}, "L'arbre"), treeChooser(trees), LEGEND()), el("div", { class: "lab-tree-wrap" }, el("div", { class: "lab-tree", id: "lab-tree" }), el("aside", { class: "lab-detail", id: "lab-detail" }))];
  }
  return decision.live ? [el("p", { class: "hint" }, "L'arbre s'affiche quand le coup est joué.")] : [];
}

function drawTree(log, decision, tree, key) {
  const view = createTreeView($("lab-tree"), {
    state: panel.treeState,
    onSelect: (id) => {
      panel.selection = { kind: "node", id };
      renderDetail(log, tree);
    },
    onBand: (depth) => {
      panel.selection = { kind: "band", depth };
      renderDetail(log, tree);
    },
  });
  view.show(tree.snapshot, { key: `${key}|${panel.tree}`, spec: SPEC, names: names(log), played: playedOf(decision.entry) });
  renderDetail(log, tree);
}

/** Is a log's player the Expérimental 1.2 (the line-up's, or its engine built or in a duel)? */
const engineOfPlayer = (player) => (player ? (player.engine ?? BOT_LINEUP[player.bot]?.engine ?? player.bot) : "");

function isV12(player) {
  try {
    return normalizeEngine(engineOfPlayer(player) ?? "") === normalizeEngine(BOT_LINEUP.experimental.engine);
  } catch {
    return false; // an old replay's engine with a setting since removed
  }
}

/** The candidates beside the findings and the levels. */
function columns(decision, { played, depth, levels, mover }) {
  return el(
    "div",
    { class: "lab-grid" },
    el("div", { class: "lab-col" }, el("h3", {}, "Ses candidats"), candidateBars(decision, played, panel.focus)),
    el("div", { class: "lab-col" }, el("h3", {}, "Diagnostic"), findings(decision, played, depth), seenRows(decision, labConfigs().norms, isV12(mover)), levelRows(levels), probeRows(decision.lab?.probe)),
  );
}

/** The last position of a game under way waits for « Coup suivant »; an older one simply kept no report. */
function emptyText(frames, index) {
  if (frames[index].state.over) return "Partie terminée.";
  return index === frames.length - 1 ? "Le prochain coup n'est pas encore cherché." : "Pas de réflexion enregistrée pour cette position.";
}

/** A new decision on show starts with nothing selected, the first tree, no card looked at. */
function enter(key) {
  if (key !== panel.decisionKey) Object.assign(panel, { decisionKey: key, selection: null, tree: 0, focus: null });
}

const position = { key: null, state: null };

/** The live game before decision `turn` (the viewer's frames are snapshots, without what a bot or the solver reads), kept per decision. */
function livePosition(key, log, turn) {
  if (position.key !== key) Object.assign(position, { key, state: stateAt(log, turn) });
  return position.state;
}

/** « Rejouer ce coup avec… », « L'avis des juges » and « Garder pour analyse » for a decision made (a live one is still searched). */
function replayOf(log, frames, index, decision) {
  if (decision.live || !decision.entry) return [];
  const key = `${log.startedAt}|${decision.turn}`;
  const state = livePosition(key, log, decision.turn);
  const context = { key, log, turn: decision.turn, state, seat: state.current, played: playedOf(decision.entry) };
  const keep = keepSection({ log, turn: decision.turn, entry: decision.entry, mover: state.current, editable: log === panel.game });
  return [replaySection(context), judgesSection(context), keep];
}

/** A move that left no tree: a human's, or a bot that does not search in a tree (Basique, Stratège). */
function renderBare(decision, mover, replay) {
  const why = mover.kind === "human" ? "un coup humain" : `${playerName(mover)} ne cherche pas en arbre`;
  $("lab-view").replaceChildren(header(decision, playerName(mover), playedOf(decision.entry)), el("p", { class: "hint" }, `Pas d'arbre pour ce coup : ${why}.`), ...replay);
}

function render({ log, frames, index }) {
  if (!panel.active()) return;
  const decision = currentDecision(log, frames, index);
  if (!decision) {
    $("lab-view").replaceChildren(el("p", { class: "hint" }, emptyText(frames, index)));
    return;
  }
  const mover = log.players[frames[index].state.current];
  const replay = replayOf(log, frames, index, decision);
  if (!decision.lab) return renderBare(decision, mover, replay);
  const key = `${log.startedAt}|${decision.turn}`;
  enter(key);
  const trees = decision.lab.trees ?? [];
  const tree = trees[panel.tree] ?? {};
  const played = playedOf(decision.entry);
  const parts = columns(decision, { played, depth: panel.depthOf(mover), levels: tree.levels, mover });
  $("lab-view").replaceChildren(header(decision, playerName(mover), played), parts, ...replay, ...treeSection(decision, trees));
  if (tree.snapshot) drawTree(log, decision, tree, key);
}

const CLICKS = [
  [".lab-bar[data-card]", (target) => target.dataset.card !== "" && toggleFocus(Number(target.dataset.card))],
  ["[data-tree]", (target) => Object.assign(panel, { tree: Number(target.dataset.tree), selection: null })],
  [".lab-level[data-depth]", (target) => Object.assign(panel, { selection: { kind: "band", depth: Number(target.dataset.depth) } })],
];

function toggleFocus(card) {
  panel.focus = panel.focus === card ? null : card;
  return true;
}

/** The panel's own clicks and the table's, through delegation (both are redrawn on every change). */
function wireInput() {
  $("lab-view").addEventListener("click", (event) => {
    for (const [selector, act] of CLICKS) {
      const target = event.target.closest(selector);
      if (target && act(target)) return renderViewer();
    }
    return undefined;
  });
  $("table").addEventListener("click", (event) => {
    const card = panel.active() && event.target.closest?.(".hand .card[data-card]");
    if (!card) return;
    toggleFocus(Number(card.dataset.card));
    renderViewer();
  });
}

/**
 * Hooks the panel to the viewer. `active()`: is a Labo tab on show (the Labo, Replays); `depthOf(playerEntry)`: the
 * depth of a log's player's engine when known, for the « depth never reached » finding.
 */
export function wireLabPanel({ active, depthOf = () => null }) {
  Object.assign(panel, { active, depthOf });
  setLabHooks({ marks: marksFor, after: render });
  wireInput();
  wireReplay();
  wireJudges();
  wireKeep();
}
