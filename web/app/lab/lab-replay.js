import { BOT_IDS, BOT_LINEUP } from "../../../src/config/bots.js";
import { $, el } from "../board/dom.js";
import { createThinker } from "../play/thinker.js";
import { SPEC, enginePlayer } from "../replays/runner.js";
import { render as renderViewer } from "../replays/viewer.js";
import { LAB_LIMIT_MS, thinkOf } from "./engine-builder.js";
import { addVariant, removeVariant, variants } from "./lab-builder.js";
import { candidateBars } from "./lab-parts.js";
import { moveName, sameMove } from "./lab-text.js";

/**
 * « Rejouer ce coup avec… » (the Labo, lot 2): the position on show searched again by 1 to 4 variants — line-up tree
 * bots, or configs from « Régler un robot » — one after the other in workers, their candidates side by side and a
 * word when the move chosen changes. With « la graine du coup joué » a variant gets the seed the bot of the game had
 * (seed + 1 + seat, lab-game.js), so the same engine finds the same move: a control for the others.
 */
const OTHER_SEED = 7919;
const replay = { key: null, results: [], sameSeed: true, running: false };

/** The searches of the decision on show; another decision starts empty. */
function enterDecision(key) {
  if (key === replay.key) return;
  Object.assign(replay, { key, results: [] });
}

const capOf = () => Math.max(1, Number.parseInt($("lab-workers").value, 10) || 1);

/** One variant's search of the position; its bars move while it searches. */
async function searchOne(result, { log, turn, state, seed }) {
  const think = thinkOf(result.engine, { cap: capOf(), limitMs: LAB_LIMIT_MS });
  const onProgress = (progress) => {
    result.progress = progress;
    renderViewer();
  };
  const thinker = createThinker(enginePlayer(result.engine, seed), think, seed, { lab: true, onProgress });
  try {
    result.reply = await thinker.decide(state, { ...log, turns: log.turns.slice(0, turn - 1), result: null, endedAt: null });
  } finally {
    thinker.stop();
  }
}

/** Every variant, one after the other (each takes its workers under the Labo's cap). */
async function searchAll(context) {
  if (replay.running || variants().length === 0) return;
  const key = replay.key;
  replay.running = true;
  replay.results = variants().map((variant) => ({ ...variant, reply: null, progress: null }));
  renderViewer();
  try {
    for (const [index, result] of replay.results.entries()) {
      if (replay.key !== key) break;
      const seed = context.seed + (replay.sameSeed ? 0 : OTHER_SEED * (index + 1));
      await searchOne(result, { ...context, seed });
      renderViewer();
    }
  } finally {
    replay.running = false;
    renderViewer();
  }
}

/** A variant's card: its name, what it chose against the move played, its candidates. */
function resultCard(result, played) {
  return result.reply ? doneCard(result, played) : pendingCard(result, played);
}

/** A variant still waiting, or searching: its bars move. */
function pendingCard({ label, progress }, played) {
  const done = progress ? `${progress.rollouts.toLocaleString("fr-FR")} itérations…` : "en attente";
  return el("div", { class: "lab-variant-card" }, el("h4", {}, label), el("p", { class: "hint" }, done), progress ? candidateBars({ lab: { root: progress.root } }, played, null) : null);
}

const replyFacts = (reply) => (reply.lab?.exact ? "résolu par le solveur exact" : `${(reply.rollouts ?? 0).toLocaleString("fr-FR")} itérations en ${((reply.thoughtMs ?? 0) / 1000).toFixed(1).replace(".", ",")} s`);

function doneCard(result, played) {
  const reply = result.reply;
  const same = sameMove(reply.move, played);
  const verdict = el("p", { class: same ? "same" : "changed" }, same ? `Même coup : ${moveName(SPEC, reply.move)}` : `Autre coup : ${moveName(SPEC, reply.move)} (au lieu de ${moveName(SPEC, played)})`);
  const facts = el("p", { class: "hint" }, replyFacts(reply));
  return el("div", { class: `lab-variant-card${same ? "" : " changed"}`, title: result.engine }, el("h4", {}, result.label), verdict, facts, reply.lab?.root?.length ? candidateBars({ lab: reply.lab }, played, null) : null);
}

/** The line-up's tree bots, to add as variants without building them. */
const lineupOptions = () => BOT_IDS.filter((id) => BOT_LINEUP[id].think).map((id) => el("option", { value: BOT_LINEUP[id].engine }, `${BOT_LINEUP[id].label} ${BOT_LINEUP[id].version}`));

/**
 * The section for the decision on show: `{ key, log, turn, state, seat, played }`. A decision searched by a human, or
 * the end of the game, has none.
 */
export function replaySection({ key, log, turn, state, seat, played }) {
  enterDecision(key);
  replay.context = { log, turn, state, seed: (log.seed ?? 0) + 1 + seat };
  const chips = variants().map((variant, index) => el("span", { class: "chip", title: variant.engine }, variant.label, el("button", { type: "button", class: "quiet", dataset: { dropVariant: index }, "aria-label": `Retirer ${variant.label}` }, "×")));
  const add = el("select", { id: "lab-add-variant", "aria-label": "Ajouter une variante de la gamme" }, el("option", { value: "" }, "+ un robot de la gamme"), ...lineupOptions());
  const seedBox = el("label", { class: "check" }, el("input", { type: "checkbox", id: "lab-same-seed", checked: replay.sameSeed }), "la graine du coup joué");
  const go = el("button", { type: "button", id: "btn-lab-replay", disabled: replay.running || variants().length === 0 }, replay.running ? "Recherche…" : `Chercher (${variants().length})`);
  const hint = variants().length === 0 ? el("p", { class: "hint" }, "Ajoute des variantes : un robot de la gamme, ou « Variante » dans « Régler un robot ».") : null;
  const results = replay.results.length > 0 ? el("div", { class: "lab-variant-grid" }, ...replay.results.map((result) => resultCard(result, played))) : null;
  return el("section", { class: "lab-replay" }, el("h3", {}, `Rejouer ce coup avec… (tour ${turn})`), el("div", { class: "lab-variants" }, ...chips, add), el("div", { class: "lab-replay-go" }, seedBox, go), hint, results);
}

/** The section's input, delegated from the panel (redrawn on every change). */
export function wireReplay() {
  $("lab-view").addEventListener("click", (event) => {
    const drop = event.target.closest("[data-drop-variant]");
    if (drop) removeVariant(Number(drop.dataset.dropVariant));
    if (event.target.closest("#btn-lab-replay") && replay.context) searchAll(replay.context);
  });
  $("lab-view").addEventListener("change", (event) => {
    if (event.target.id === "lab-same-seed") replay.sameSeed = event.target.checked;
    if (event.target.id === "lab-add-variant" && event.target.value) addVariant(event.target.value);
  });
}
