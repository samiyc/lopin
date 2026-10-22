import { DEFAULT_KNOBS, comparePolicies, drawScenario, simulateNight } from "../../../src/schedule/night.js";
import { NIGHT_START, PRESETS } from "../../../src/schedule/presets.js";
import { $, el } from "../board/dom.js";
import { STATUS_LABELS, comparisonRows, ganttRows, gapText, scaleOf, summaryOf, weightLabel } from "./scheduler-view.js";

/**
 * The Ordonnanceur tab (Sami, 22/10): example backlogs played as simulated nights
 * (src/schedule/night.js), the file order against Smith's rule on the same night, then on 500 drawn
 * nights. The queue can be edited as JSON, in data/backlog.json's format. What it shows is computed in
 * scheduler-view.js; this module only draws and listens (event delegation on the tab's section).
 */
const START = Date.parse(NIGHT_START);
const NIGHTS = 500;
const copy = (jobs) => JSON.parse(JSON.stringify(jobs));
const state = { preset: PRESETS[0].id, jobs: copy(PRESETS[0].jobs), hours: 8, spread: 11, failRate: 1, seed: 1, compared: null, error: "" };
let wired = false;

const knobs = () => ({ ...DEFAULT_KNOBS, spread: state.spread / 100, failRate: state.failRate / 100 });
const presetOf = (id) => PRESETS.find((preset) => preset.id === id);

function option(value, label, selected) {
  return el("option", { value, selected: selected || null }, label);
}

function numberField(label, name, value, { min, max }) {
  return el("label", {}, label, el("input", { type: "number", "data-knob": name, value: String(value), min: String(min), max: String(max), inputmode: "numeric" }));
}

function controls() {
  return el(
    "div",
    { class: "scheduler-controls" },
    el("label", {}, "Exemple ", el("select", { "data-knob": "preset" }, ...PRESETS.map((preset) => option(preset.id, preset.label, preset.id === state.preset)))),
    el("label", {}, "Nuit ", el("select", { "data-knob": "hours" }, ...[6, 8, 10].map((hours) => option(String(hours), `${hours} h`, hours === state.hours)))),
    numberField("Variabilité des durées (%) ", "spread", state.spread, { min: 0, max: 60 }),
    numberField("Échecs (%) ", "failRate", state.failRate, { min: 0, max: 50 }),
    numberField("Nuit n° ", "seed", state.seed, { min: 1, max: 999999 }),
    el("button", { type: "button", class: "quiet", "data-action": "next" }, "Nuit suivante"),
    el("button", { type: "button", "data-action": "compare" }, `Comparer sur ${NIGHTS} nuits`),
  );
}

function chart(rows, scale) {
  const axis = el("div", { class: "gantt-row gantt-axis" }, el("span", { class: "gantt-label" }), el("div", { class: "gantt-track" }, ...scale.ticks.map((tick) => el("span", { class: "gantt-tick", style: `left:${tick.left}%` }, tick.label))));
  const morning = `left:${scale.at(scale.morning)}%`;
  const lines = rows.map((row) => {
    const bar = row.bar && el("span", { class: `gantt-bar ${row.bar.status}${row.bar.late ? " late" : ""}`, style: `left:${row.bar.left}%;width:${row.bar.width}%`, title: row.bar.title });
    const due = row.due === null ? null : el("span", { class: "gantt-due", style: `left:${row.due}%`, title: "échéance" });
    return el(
      "div",
      { class: "gantt-row" },
      el("span", { class: `gantt-label p${row.priority}`, title: weightLabel(state.jobs.find((job) => job.id === row.id)) }, row.id),
      el("div", { class: "gantt-track" }, el("span", { class: "gantt-morning", style: morning }), bar, due, row.note ? el("small", { class: "gantt-note" }, row.note) : null),
    );
  });
  return el("div", { class: "gantt" }, axis, ...lines);
}

function legend() {
  const swatch = (status) => el("span", { class: "legend-item" }, el("span", { class: `gantt-bar ${status}` }), STATUS_LABELS[status]);
  return el(
    "p",
    { class: "scheduler-legend hint" },
    ...["done", "skipped", "failed", "timeout"].map(swatch),
    el("span", { class: "legend-item" }, el("span", { class: "gantt-due" }), "échéance"),
    el("span", { class: "legend-item" }, el("span", { class: "gantt-morning" }), "le matin"),
    " Libellé en gras : urgent ; en clair : peut attendre.",
  );
}

function nightsBlock() {
  const scenario = drawScenario(state.jobs, state.seed, knobs());
  const options = { start: START, nightMinutes: state.hours * 60 };
  const fifo = simulateNight(state.jobs, scenario, { ...options, fifo: true });
  const smith = simulateNight(state.jobs, scenario, options);
  const scale = scaleOf(START, options.nightMinutes, [fifo, smith]);
  const block = (title, night) => [el("h3", {}, title), el("p", { class: "hint" }, summaryOf(night.metrics, scale)), chart(ganttRows(state.jobs, night, scale), scale)];
  return [...block("L'ordre du fichier (--fifo)", fifo), ...block("La règle de Smith, avec prérequis et échéances", smith), legend()];
}

function comparisonBlock() {
  if (!state.compared) return [];
  const rows = comparisonRows(state.compared).map((row) => el("tr", {}, el("td", {}, row.label), el("td", { class: "num" }, row.fifo), el("td", { class: "num" }, row.smith)));
  const table = el("table", {}, el("thead", {}, el("tr", {}, el("th", {}, `Moyenne sur ${state.compared.nights} nuits`), el("th", {}, "Ordre du fichier"), el("th", {}, "Règle de Smith"))), el("tbody", {}, ...rows));
  return [el("h3", {}, "Sur beaucoup de nuits"), el("p", {}, gapText(state.compared)), el("div", { class: "scroll" }, table)];
}

function editorBlock() {
  return el(
    "details",
    { class: "scheduler-editor" },
    el("summary", {}, "Modifier la file (JSON)"),
    el("p", { class: "hint" }, "Le format de data/backlog.json : id, estimate, priority (1 à 3), due, after, stopIf, notBefore avec status « scheduled ». En plus pour la simulation : version (un duel de cette version), arrivesAt (minutes après le début), failRate."),
    el("textarea", { id: "scheduler-json", rows: "16", spellcheck: "false" }, JSON.stringify(state.jobs, null, 1)),
    el("div", { class: "scheduler-actions" }, el("button", { type: "button", "data-action": "apply" }, "Appliquer"), el("button", { type: "button", class: "quiet", "data-action": "reset" }, "Revenir à l'exemple")),
    state.error ? el("p", { class: "scheduler-error", role: "alert" }, state.error) : null,
  );
}

/** Reads the edited queue: an array of jobs, each with an id and an estimate. */
function parseJobs(text) {
  const jobs = JSON.parse(text);
  if (!Array.isArray(jobs) || jobs.some((job) => typeof job?.id !== "string" || !job.estimate)) throw new Error("une liste de jobs, chacun avec un id et une estimate");
  return jobs.map((job) => ({ status: "todo", ...job }));
}

const ACTIONS = {
  next: () => {
    state.seed += 1;
  },
  compare: () => {
    state.compared = comparePolicies(state.jobs, { nights: NIGHTS, seed: 1, knobs: knobs(), start: START, nightMinutes: state.hours * 60 });
  },
  apply: () => {
    try {
      state.jobs = parseJobs($("scheduler-json").value);
      state.error = "";
      state.compared = null;
    } catch (error) {
      state.error = `File illisible : ${error.message}`;
    }
  },
  reset: () => {
    state.jobs = copy(presetOf(state.preset).jobs);
    state.error = "";
    state.compared = null;
  },
};

function onKnob(name, value) {
  if (name === "preset") {
    state.preset = value;
    state.jobs = copy(presetOf(value).jobs);
    state.error = "";
  } else {
    state[name] = Math.max(0, Number(value) || 0);
  }
  state.compared = null;
}

function wire(view) {
  view.addEventListener("change", (event) => {
    const name = event.target.dataset?.knob;
    if (!name) return;
    onKnob(name, event.target.value);
    renderScheduler();
  });
  view.addEventListener("click", (event) => {
    const action = event.target.closest?.("[data-action]")?.dataset.action;
    if (!ACTIONS[action]) return;
    ACTIONS[action]();
    renderScheduler();
  });
}

/** Draws the tab into #scheduler-view. */
export function renderScheduler() {
  const view = $("scheduler-view");
  if (!wired) {
    wire(view);
    wired = true;
  }
  const open = view.querySelector(".scheduler-editor")?.open ?? false;
  view.replaceChildren(
    el("h2", {}, "Ordonnanceur"),
    el("p", { class: "hint" }, "La file de nuit (npm run backlog) jouée en simulation : chaque nuit tire la durée réelle des jobs, leurs échecs et les scores des duels, donc les stopIf. Les deux ordres jouent la même nuit."),
    controls(),
    el("p", { class: "scheduler-note" }, presetOf(state.preset)?.note ?? ""),
    ...nightsBlock(),
    ...comparisonBlock(),
    editorBlock(),
  );
  if (open) view.querySelector(".scheduler-editor").open = true;
}
