import { BOT_IDS, BOT_LINEUP } from "../../../src/config/bots.js";
import { startLog } from "../../../src/replay/core/log.js";
import { $, el, recall, remember, toast } from "../board/dom.js";
import { createThinker } from "../play/thinker.js";
import { fetchLabConfigs, fetchLabPresets, saveLabPreset } from "../replays/replays-api.js";
import { RULES, enginePlayer, newGame } from "../replays/runner.js";
import {
  BASE_ENGINE,
  FIELDS,
  costOf,
  costText,
  engineChoice,
  engineFromForm,
  formFromEngine,
  guardsOf,
  labelOf,
  measuredOf,
  neighboursOf,
  optionsOf,
  readChoice,
} from "./engine-builder.js";

/**
 * The Labo's bot builder (lot 2, Sami 17/10), in the sidebar: a form from the 1.2 (or a line-up bot, or a config the
 * duels named) gives an engine id; under it what the config costs (from the 1.2's speed, measured once in a worker),
 * the guards, and what the duels already measured of it or of its neighbours. « En bas » / « En haut » put it in a
 * bot list, « Variante » in « Rejouer ce coup avec… ». The saved settings keep both bots, a seed and a note.
 */
const SPEED_KEY = "lopin.labSpeed";
const SPEED_ENGINE = BASE_ENGINE.replace("@2000", "@300");
const VARIANTS_MAX = 4;
const builder = { configs: { names: {}, pairs: [] }, presets: [], perSecond: Number(recall(SPEED_KEY, "0")) || null, measuring: false, engine: BASE_ENGINE, variants: [], onVariants: () => {} };

const pct = (value) => `${(100 * value).toFixed(1).replace(".", ",")} %`;
const count = (value) => value.toLocaleString("fr-FR");

/** The configs the duels measured, for every list and verdict; the page works without them. */
export const labConfigs = () => builder.configs;

/** The 1.2's iterations a second in a worker: 300 iterations of the first move, once per page (then remembered). */
async function measureSpeed() {
  if (builder.measuring) return;
  builder.measuring = true;
  showCost();
  const thinker = createThinker(enginePlayer(SPEED_ENGINE, 1), { limitMs: 30_000, minMs: 0 }, 1);
  try {
    const state = newGame(1);
    const reply = await thinker.decide(state, startLog(state, { rules: RULES, players: [], seed: 1 }));
    if (reply?.rollouts > 0 && reply.thoughtMs > 0) {
      builder.perSecond = Math.round((1000 * reply.rollouts) / reply.thoughtMs);
      remember(SPEED_KEY, String(builder.perSecond));
    }
  } finally {
    thinker.stop();
    builder.measuring = false;
    showCost();
  }
}

const workers = () => Number.parseInt($("lab-workers").value, 10) || 1;

/** The form's values, read from its inputs. */
function readForm() {
  const values = Object.fromEntries(FIELDS.map((field) => [field.key, $(`lab-f-${field.key}`).value]));
  return { values, extra: builder.extra ?? [], budget: $("lab-budget").value.trim(), timed: $("lab-timed").checked };
}

function fieldInput(field, value) {
  const id = `lab-f-${field.key}`;
  if (field.kind === "number") return el("input", { type: "number", id, min: field.min, max: field.max, value, inputmode: "numeric" });
  return el("select", { id }, ...optionsOf(field).map(([option, text]) => el("option", { value: option, selected: option === value }, text)));
}

/** Fills the form from `engine`; settings it does not show are kept aside and written back. */
function fillForm(engine) {
  const form = formFromEngine(engine);
  builder.extra = form.extra;
  $("lab-fields").replaceChildren(...FIELDS.map((field) => el("label", { title: field.hint }, el("span", {}, field.label), fieldInput(field, form.values[field.key]))));
  $("lab-budget").value = form.budget;
  $("lab-timed").checked = form.timed;
  update();
}

function showCost() {
  const box = $("lab-cost");
  if (builder.measuring) return box.replaceChildren("Mesure de la vitesse de la 1.2…");
  if (!builder.perSecond) return box.replaceChildren(el("button", { type: "button", class: "quiet", id: "btn-lab-speed" }, "Mesurer la vitesse"), " pour estimer la durée");
  const cost = costOf(builder.engine, { perSecond: builder.perSecond, workers: workers() });
  return box.replaceChildren(`${costText(cost)} (la 1.2 fait ${count(builder.perSecond)} itérations/s ici)`);
}

/** The guards for the config on show; at least its iterations when the speed is not measured yet. */
const guardsNow = (engine) => guardsOf(engine, costOf(engine, { perSecond: builder.perSecond ?? 1000, workers: workers() }));

function showGuards() {
  const list = guardsNow(builder.engine).filter((guard) => builder.perSecond || guard.level !== "warn" || !/par partie/.test(guard.text));
  $("lab-guards").replaceChildren(...list.map((guard) => el("li", { class: guard.level }, guard.text)));
}

const resultLine = (entry) => `${pct(entry.score)} (${pct(entry.low)} – ${pct(entry.high)}) sur ${count(entry.games)} parties contre ${entry.name ?? labelOf(entry.opponent, builder.configs)} : ${entry.verdict}`;

function showMeasured() {
  const measured = measuredOf(builder.engine, builder.configs);
  if (measured.length > 0) {
    return $("lab-measured").replaceChildren(el("p", {}, "Déjà mesurée :"), el("ul", {}, ...measured.slice(0, 4).map((entry) => el("li", { title: `dernier duel le ${entry.last}` }, resultLine(entry)))));
  }
  const near = neighboursOf(builder.engine, builder.configs).slice(0, 6);
  const buttons = near.map((entry) => el("button", { type: "button", class: "quiet chip", dataset: { load: entry.engine }, title: entry.engine }, `${entry.name ?? labelOf(entry.engine, builder.configs)} (${entry.differs[0]})`));
  return $("lab-measured").replaceChildren(el("p", {}, near.length > 0 ? "Jamais mesurée. Ses voisines mesurées (un réglage de différence) :" : "Jamais mesurée, ni ses voisines."), ...buttons);
}

/** Reads the form, writes the engine id, and what it costs and what is known of it. */
function update() {
  const built = engineFromForm(readForm());
  $("lab-engine").textContent = built.engine ?? built.error;
  $("lab-engine").classList.toggle("wrong", Boolean(built.error));
  for (const id of ["btn-lab-bottom", "btn-lab-top", "btn-lab-variant"]) $(id).disabled = Boolean(built.error);
  if (built.error) return;
  builder.engine = built.engine;
  showCost();
  showGuards();
  showMeasured();
}

/** The bases the form starts from: the line-up's tree bots, then every ISMCTS config the duels named. */
function fillBases() {
  const lineup = BOT_IDS.filter((id) => BOT_LINEUP[id].think).map((id) => [BOT_LINEUP[id].engine, `${BOT_LINEUP[id].label} ${BOT_LINEUP[id].version}`]);
  const named = Object.entries(builder.configs.names)
    .filter(([engine, name]) => engine.startsWith("ismcts") && !lineup.some(([, label]) => label === name))
    .sort(([, a], [, b]) => a.localeCompare(b, "fr"));
  $("lab-base").replaceChildren(el("option", { value: "" }, "—"), ...[...lineup, ...named].map(([engine, name]) => el("option", { value: engine }, name)));
}

/** Makes sure the bot list `select` offers `value` (a built engine gets its option), then selects it. */
export function selectChoice(select, value) {
  if (![...select.options].some((option) => option.value === value)) {
    const { engine } = readChoice(value);
    select.append(el("option", { value, title: engine }, `${labelOf(engine, builder.configs)} (réglé)`));
  }
  select.value = value;
}

/** The guards a game between these bot choices trips that need a confirmation, as text, or null. */
export function blockedBy(values) {
  if ($("lab-confirm").checked) return null;
  const stops = values.map(readChoice).filter((choice) => choice.engine && guardsNow(choice.engine).some((guard) => guard.level === "stop"));
  return stops.length > 0 ? `${labelOf(stops[0].engine, builder.configs)} passe 50 000 itérations par coup : coche « J'accepte une partie très longue » dans « Régler un robot ».` : null;
}

/** The variants « Rejouer ce coup avec… » searches: `[{ engine, label }]`. */
export const variants = () => builder.variants;

export function removeVariant(index) {
  builder.variants.splice(index, 1);
  builder.onVariants();
}

export function addVariant(engine) {
  if (builder.variants.length >= VARIANTS_MAX) return toast(`${VARIANTS_MAX} variantes au plus.`);
  builder.variants.push({ engine, label: labelOf(engine, builder.configs) });
  return builder.onVariants();
}

function fillPresets() {
  $("lab-preset").replaceChildren(el("option", { value: "" }, builder.presets.length ? "—" : "aucun pour l'instant"), ...builder.presets.map((preset, index) => el("option", { value: String(index), title: preset.note }, preset.name)));
}

async function savePreset() {
  const name = $("lab-preset-name").value.trim();
  if (!name) return toast("Donne un nom au réglage.");
  const typed = Number.parseInt($("observe-seed").value, 10);
  const preset = { name, bots: [$("observe-bottom").value, $("observe-top").value], seed: Number.isInteger(typed) && typed >= 0 ? typed : null, note: $("lab-preset-note").value.trim() };
  try {
    await saveLabPreset(preset);
    builder.presets = (await fetchLabPresets()).presets;
    fillPresets();
    return toast(`Réglage « ${name} » sauvé dans data/lab-presets.json.`);
  } catch (error) {
    return toast(`Sauvegarde impossible : ${error.message}`);
  }
}

function loadPreset(index) {
  const preset = builder.presets[Number(index)];
  if (!preset) return;
  selectChoice($("observe-bottom"), preset.bots[0]);
  selectChoice($("observe-top"), preset.bots[1]);
  $("observe-seed").value = preset.seed === null ? "" : String(preset.seed);
  $("lab-preset-name").value = preset.name;
  $("lab-preset-note").value = preset.note;
  toast(preset.note ? `« ${preset.name} » : ${preset.note}` : `« ${preset.name} » repris : « Nouvelle partie » pour la lancer.`);
}

const put = (select) => () => {
  selectChoice($(select), engineChoice(builder.engine));
  toast(`${labelOf(builder.engine, builder.configs)} : ${select === "observe-bottom" ? "en bas" : "en haut"} à la prochaine partie.`);
};

function wireInput() {
  $("lab-builder").addEventListener("input", (event) => (event.target.closest("#lab-fields, #lab-budget, #lab-timed") ? update() : undefined));
  $("lab-builder").addEventListener("toggle", () => $("lab-builder").open && !builder.perSecond && measureSpeed());
  $("lab-builder").addEventListener("click", (event) => {
    const load = event.target.closest("[data-load]");
    if (load) fillForm(load.dataset.load);
    if (event.target.closest("#btn-lab-speed")) measureSpeed();
  });
  $("lab-base").addEventListener("change", () => $("lab-base").value && fillForm($("lab-base").value));
  $("btn-lab-bottom").addEventListener("click", put("observe-bottom"));
  $("btn-lab-top").addEventListener("click", put("observe-top"));
  $("btn-lab-variant").addEventListener("click", () => addVariant(builder.engine));
  $("lab-workers").addEventListener("change", update);
  $("lab-preset").addEventListener("change", () => loadPreset($("lab-preset").value));
  $("btn-lab-preset-save").addEventListener("click", savePreset);
}

/** `onVariants()`: the variants changed (the panel redraws). */
export async function wireBuilder({ onVariants }) {
  builder.onVariants = onVariants;
  wireInput();
  fillForm(BASE_ENGINE);
  fillPresets();
  const [configs, presets] = await Promise.allSettled([fetchLabConfigs(), fetchLabPresets()]);
  if (configs.status === "fulfilled") builder.configs = configs.value;
  if (presets.status === "fulfilled") builder.presets = presets.value.presets;
  fillBases();
  fillPresets();
  update();
}
