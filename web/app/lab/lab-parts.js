import { interval } from "../../../src/sim/mcts/tree-snapshot.js";
import { el } from "../board/dom.js";
import { SPEC } from "../replays/runner.js";
import { tonedCandidates } from "./confidence.js";
import { keyName, lineText, moveName, percent } from "./lab-text.js";
import { diagnose } from "./tree-diagnosis.js";
import { bandLabel, nodeAt, pathTo, visitBuckets } from "./tree-layout.js";

/**
 * The pieces of the Labo's panel (lab-panel.js puts them together): the header, the candidates' bars, the findings,
 * the levels, and the detail of a tree node or ply. Each builds DOM from a decision and draws nothing itself.
 */
const count = (value) => value.toLocaleString("fr-FR");
const seconds = (ms) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
const keyOfMove = (move) => (move ? `${move.card}@${move.border}` : "pass");

/** « Tour 12 · Expérimental 1.2 joue 7♥ → 3 · 2 000 itérations en 3,1 s », or « … réfléchit… » live. */
export function header(decision, who, played) {
  if (decision.live) {
    const progress = decision.progress;
    const facts = progress ? ` · ${count(progress.rollouts)} itérations · ${seconds(progress.elapsedMs)}` : "";
    return el("h2", {}, `Tour ${decision.turn} · ${who} réfléchit…`, el("small", {}, facts));
  }
  const iterations = (decision.lab?.root ?? []).reduce((sum, entry) => sum + entry.visits, 0);
  const thought = typeof decision.entry.thinkMs === "number" ? ` en ${seconds(decision.entry.thinkMs)}` : "";
  const facts = iterations > 0 ? ` · ${count(iterations)} itérations${thought}` : thought;
  return el("h2", {}, `Tour ${decision.turn} · ${who} joue ${moveName(SPEC, played)}`, el("small", {}, facts));
}

function candidateRow(entry, { played, top, focus }) {
  const chosen = keyOfMove(played) === entry.key;
  const classes = ["lab-bar", `tone-${entry.tone}`, chosen ? "chosen" : "", focus !== null && focus === entry.move?.card ? "focused" : ""].filter(Boolean).join(" ");
  const facts = entry.rate === null ? "pas visité" : `${percent(entry.rate)} (${percent(entry.low)} – ${percent(entry.high)}) · ${count(entry.visits)} visites`;
  const refused = entry.refused ? " (refusé par le cœur)" : "";
  return el(
    "button",
    { type: "button", class: classes, dataset: { card: entry.move ? entry.move.card : "", key: entry.key }, title: `Rang du cœur : ${entry.coreRank}${refused}` },
    el("span", { class: "lab-move" }, moveName(SPEC, entry.move)),
    el("span", { class: "lab-track" }, el("span", { class: "lab-fill", style: `width: ${Math.round((100 * entry.share) / top)}%` })),
    el("span", { class: "lab-facts" }, facts, el("small", {}, ` · cœur n° ${entry.coreRank}`)),
  );
}

/** One bar per root candidate, the most visited first: its share of the visits, coloured by its tone, rate and interval written. */
export function candidateBars(decision, played, focus) {
  const root = decision.lab?.root ?? [];
  if (root.length === 0) {
    const text = decision.lab?.exact ? "Fin de partie résolue exactement : le solveur a prouvé le coup, sans arbre." : "Pas de candidats enregistrés pour ce coup.";
    return el("p", { class: "hint" }, text);
  }
  const toned = tonedCandidates(root, played);
  const top = Math.max(...toned.map((entry) => entry.share), 0.001);
  const rows = [...toned].sort((a, b) => b.visits - a.visits).map((entry) => candidateRow(entry, { played, top, focus }));
  return el("div", { class: "lab-bars" }, ...rows);
}

export function findings(decision, played, depth) {
  const list = diagnose(decision.lab, played, { name: (move) => moveName(SPEC, move), depth });
  if (list.length === 0) return el("p", { class: "hint" }, decision.live ? "Diagnostic à la fin de la réflexion." : "Rien d'anormal dans cet arbre.");
  return el("ul", { class: "lab-findings" }, ...list.map((finding) => el("li", { class: finding.level }, finding.text)));
}

function levelRow(level, most) {
  const rest = level.nodes - level.zero - level.one;
  const scale = level.nodes > 0 ? 1 / level.nodes : 0;
  const width = `${(100 * Math.log1p(level.nodes)) / Math.log1p(most)}%`;
  return el(
    "button",
    { type: "button", class: "lab-level", dataset: { depth: level.depth } },
    el("span", { class: "lab-level-name" }, `Pli ${level.depth}`),
    el("span", { class: "lab-level-track", style: `width: ${width}` }, el("span", { class: "seg rest", style: `flex: ${rest * scale}` }), el("span", { class: "seg one", style: `flex: ${level.one * scale}` }), el("span", { class: "seg zero", style: `flex: ${level.zero * scale}` })),
    el("span", { class: "lab-level-facts" }, `${count(level.nodes)} nœuds · ${percent(level.nodes ? level.one / level.nodes : 0)} à 1 visite · max ${level.max}`),
  );
}

/** The tree's levels as stacked bars (log scale): nodes visited several times, once, never. */
export function levelRows(levels) {
  if (!levels?.length) return null;
  const most = Math.max(...levels.map((level) => level.nodes), 1);
  const legend = el("p", { class: "lab-legend" }, el("i", { class: "seg rest" }), " plusieurs visites ", el("i", { class: "seg one" }), " une seule ", el("i", { class: "seg zero" }), " jamais");
  return el("div", { class: "lab-levels" }, el("h3", {}, "Les étages de l'arbre"), ...levels.map((level) => levelRow(level, most)), legend);
}

/** What follows a node: its tried moves, how many seen once, what the drawing left out. */
function followText(node) {
  const tried = node.children.length + (node.hidden?.count ?? 0);
  if (tried === 0) return "aucune (une simulation joue la suite)";
  const singles = node.children.filter((child) => child.visits === 1).length + (node.hidden?.ones ?? 0);
  const left = node.hidden ? `, ${node.hidden.count} non dessinés (${node.hidden.visits} visites)` : "";
  return `${tried} coups essayés, ${singles} vus une seule fois${left}`;
}

const fact = (term, value) => [el("dt", {}, term), el("dd", {}, value)];

/** A node's detail: the line of play it stands for, its rate and interval, visits, availability, what follows. */
export function nodeDetail(snapshot, id, names) {
  const node = nodeAt(snapshot, id);
  if (!node) return [el("p", { class: "hint" }, "Ce nœud n'est plus dans l'arbre.")];
  if (id === "") return [el("h3", {}, "La position"), el("p", {}, `${count(node.visits)} itérations · ${node.size} nœuds gardés pour le dessin.`)];
  const path = pathTo(snapshot, id);
  const parent = path.length > 1 ? path[path.length - 2] : snapshot;
  const [low, high] = interval(node.wins, node.visits);
  const rate = node.visits ? node.wins / node.visits : null;
  return [
    el("h3", {}, keyName(SPEC, node.key)),
    el("p", { class: "lab-line" }, lineText(SPEC, path, names)),
    el(
      "dl",
      {},
      ...fact("Taux pour qui joue", `${percent(rate)} (${percent(low)} – ${percent(high)})`),
      ...fact("Visites", `${count(node.visits)} · ${percent(parent.visits ? node.visits / parent.visits : 0)} de son parent`),
      ...fact("Disponible", `${count(node.avail)} fois (les donnes où ce coup était possible)`),
      ...fact("Suites", followText(node)),
    ),
  ];
}

const bucketText = (bucket, previous) => (bucket.below === Infinity ? `${previous} visites et plus` : `moins de ${bucket.below} visites`);

/** A ply's detail: its counts in the whole tree, and how the drawn nodes spread over visits. */
export function bandDetail(snapshot, levels, depth) {
  const level = levels?.find((entry) => entry.depth === depth);
  const facts = level ? `${count(level.nodes)} nœuds dans l'arbre entier, ${level.zero} jamais visités, ${level.one} visités une fois, ${level.max} visites au plus.` : "";
  const buckets = snapshot ? visitBuckets(snapshot, depth) : [];
  const rows = buckets.map((bucket, index) => ({ bucket, previous: index > 0 ? buckets[index - 1].below : 1 })).filter(({ bucket }) => bucket.count > 0);
  const list = rows.map(({ bucket, previous }) => el("li", {}, `${bucketText(bucket, previous)} : ${bucket.count} nœuds dessinés`));
  return [el("h3", {}, bandLabel(depth)), el("p", {}, facts), ...(list.length > 0 ? [el("ul", {}, ...list)] : [])];
}
