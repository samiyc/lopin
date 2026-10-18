import { formatCard } from "../../../src/core/notation.js";
import { $, el } from "../board/dom.js";
import { SPEC } from "../replays/runner.js";
import { render as renderViewer } from "../replays/viewer.js";
import { JUDGES, judgeSummary, solverJudges, solverSummary, valueWord } from "./judges.js";
import { candidateBars } from "./lab-parts.js";
import { searchPosition } from "./lab-search.js";
import { moveName, percent } from "./lab-text.js";

/**
 * « L'avis des juges » (the Labo, lot 3): under « Rejouer ce coup avec… », a button per judge (judges.js) searches the
 * position on show — the oracles with what the bot knew, the omniscient with every card seen — and, the pile empty at
 * 12 cards or fewer, the exact solver (solve-worker.js) gives every move's verdict. Each answer stays with its
 * decision; another decision starts empty. A judge's seed is the game's own plus 101, the same for every move.
 */
const JUDGE_SEED = 101;
const judges = { key: null, answers: new Map(), running: new Set() };

function enterDecision(key) {
  if (key === judges.key) return;
  Object.assign(judges, { key, answers: new Map(), running: new Set() });
}

/** One judge's search; its bars move while it searches. */
async function runJudge(judge, context) {
  const key = judges.key;
  const answer = { reply: null, progress: null };
  judges.answers.set(judge.id, answer);
  judges.running.add(judge.id);
  renderViewer();
  const onProgress = (progress) => {
    answer.progress = progress;
    if (judges.key === key) renderViewer();
  };
  try {
    answer.reply = await searchPosition({ ...context, engine: judge.engine, seed: (context.log.seed ?? 0) + JUDGE_SEED, onProgress });
  } finally {
    judges.running.delete(judge.id);
    if (judges.key === key) renderViewer();
  }
}

/** The exact solver on the position (solve-worker.js): every move's value. */
function runSolver({ log, turn }) {
  const key = judges.key;
  const answer = { moves: null };
  judges.answers.set("solver", answer);
  judges.running.add("solver");
  renderViewer();
  const worker = new Worker(new URL("../workers/solve-worker.js", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }) => {
    answer.moves = data.moves;
    judges.running.delete("solver");
    worker.terminate();
    if (judges.key === key) renderViewer();
  };
  worker.postMessage({ id: 1, log: { ...log, turns: log.turns.slice(0, turn - 1), result: null, endedAt: null } });
}

const pct1 = (value) => `${(100 * value).toFixed(1).replace(".", ",")} %`;

/** What the judge says of the move played, in a sentence. */
function playedLine(summary, played) {
  if (summary.exact) return `Son solveur a tranché : le coup joué ${valueWord(summary.exact.played)}, ${summary.exact.winning} coup(s) prouvé(s) gagnant(s).`;
  if (!summary.played) return `Le coup joué (${moveName(SPEC, played)}) n'est pas parmi ses candidats.`;
  return `Le coup joué : son n° ${summary.played.rank}, ${pct1(summary.played.share)} des visites, taux ${percent(summary.played.rate)}.`;
}

function verdictLine(summary, played) {
  const chosen = moveName(SPEC, summary.chosen);
  if (summary.same) return el("p", { class: "same" }, `Même coup : ${chosen}`);
  const best = summary.best ? ` (${pct1(summary.best.share)} des visites, taux ${percent(summary.best.rate)})` : "";
  return el("p", { class: "changed" }, `Il joue ${chosen}${best}, au lieu de ${moveName(SPEC, played)}`);
}

/** A judge still searching: its bars move. */
function pendingCard(head, progress, played) {
  const doing = progress ? `${progress.rollouts.toLocaleString("fr-FR")} itérations…` : "réfléchit…";
  return el("div", { class: "lab-variant-card" }, head, el("p", { class: "hint" }, doing), progress ? candidateBars({ lab: { root: progress.root } }, played, null) : null);
}

function judgeCard(judge, played) {
  const answer = judges.answers.get(judge.id);
  const head = el("h4", {}, judge.label, el("small", {}, ` · ${judge.cost}`));
  if (!answer.reply) return pendingCard(head, answer.progress, played);
  const summary = judgeSummary(answer.reply, played);
  const bars = answer.reply.lab?.root?.length ? candidateBars({ lab: answer.reply.lab }, played, null) : null;
  return el("div", { class: `lab-variant-card${summary.same ? "" : " changed"}`, title: judge.engine }, head, verdictLine(summary, played), el("p", {}, playedLine(summary, played)), bars);
}

const bestWord = (best) => `, alors que le meilleur ${valueWord(best)}.`;

const solverWords = (moves) => moves.map((move) => `${move.card} → ${move.border}`).join(", ");

function solverCard(played) {
  const answer = judges.answers.get("solver");
  const head = el("h4", {}, "Solveur exact", el("small", {}, " · la pioche vide : la vérité sur chaque coup"));
  if (!answer?.moves) return el("div", { class: "lab-variant-card" }, head, el("p", { class: "hint" }, "Calcul… (jusqu'à quelques dizaines de secondes à 11-12 cartes)"));
  const shown = played ? { card: formatCard(SPEC, played.card), border: played.border + 1 } : null;
  const summary = solverSummary(answer.moves, shown);
  const ok = summary.played === summary.best;
  const lines = [
    el("p", { class: ok ? "same" : "changed" }, `Le coup joué ${valueWord(summary.played)}${ok ? " : c'était le mieux possible." : bestWord(summary.best)}`),
    el("p", {}, summary.winning.length > 0 ? `Coups gagnants (${summary.winning.length} sur ${summary.moves}) : ${solverWords(summary.winning)}.` : `Aucun coup gagnant ; ${summary.drawing} font nul sur ${summary.moves}.`),
  ];
  return el("div", { class: `lab-variant-card${ok ? "" : " changed"}` }, head, ...lines);
}

const judgeButton = (id, label) => el("button", { type: "button", class: "quiet", dataset: { judge: id }, disabled: judges.running.has(id) }, label);

/** The section for the decision on show (`{ key, log, turn, state, played }`). */
export function judgesSection({ key, log, turn, state, played }) {
  enterDecision(key);
  judges.context = { log, turn, state };
  const solver = solverJudges(state);
  const buttons = [...JUDGES.map((judge) => judgeButton(judge.id, judge.label)), solver ? judgeButton("solver", "Solveur exact") : null];
  const cards = [...JUDGES.filter((judge) => judges.answers.has(judge.id)).map((judge) => judgeCard(judge, played)), judges.answers.has("solver") ? solverCard(played) : null].filter(Boolean);
  const hint = el("p", { class: "hint" }, "Les oracles jugent la décision avec ce que le robot savait ; l'omniscient juge la donne, toutes les cartes vues : un coup que lui seul refuse a perdu à cause des cartes cachées.");
  return el("section", { class: "lab-replay" }, el("h3", {}, "L'avis des juges"), el("div", { class: "lab-variants" }, ...buttons.filter(Boolean)), hint, cards.length > 0 ? el("div", { class: "lab-variant-grid" }, ...cards) : null);
}

/** The section's buttons, delegated from the panel. */
export function wireJudges() {
  $("lab-view").addEventListener("click", (event) => {
    const button = event.target.closest("[data-judge]");
    if (!button || !judges.context || judges.running.has(button.dataset.judge)) return;
    if (button.dataset.judge === "solver") return runSolver(judges.context);
    const judge = JUDGES.find((entry) => entry.id === button.dataset.judge);
    if (judge) runJudge(judge, judges.context);
  });
}
