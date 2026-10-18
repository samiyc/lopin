import { CORES } from "../../../src/sim/heuristics/experimental.js";
import { engineDiff, engineParts, normalizeEngine } from "../../../src/sim/mcts/engine-id.js";
import { ISMCTS, ismctsSettings } from "../../../src/sim/mcts/ismcts.js";

/**
 * The Labo's bot builder (lot 2, Sami 17/10), PURE: a form's values ↔ an ISMCTS engine id, the guards on what a
 * config costs, and what the duels already measured of it (data/lab-configs.json, `npm run lab-index`).
 *
 * The form starts from the Expérimental 1.2 and writes its settings in the line-up's order (widen, depth, core,
 * exact, then the others), so the untouched form is the 1.2's own id: the same bot, the same moves. A setting left
 * at « off » is not written.
 */
export const BASE_ENGINE = "ismcts+widen=7+depth=5+core=stfig6+exact=12@2000";

/** A Labo bot searches its engine's iterations; the clock only bounds a runaway (3 min a move). */
export const LAB_LIMIT_MS = 180_000;

const toggle = (key, label, hint) => ({ key, label, kind: "select", options: [["0", "non"], ["1", "oui"]], off: "0", hint });
const coreNames = () => ["stfig6", "exp", ...Object.keys(CORES).filter((name) => name !== "stfig6" && name !== "exp").sort()];

/** Each field: its key in the engine id, how it is typed, the value that leaves it out of the id (`off`). */
export const FIELDS = Object.freeze([
  { key: "widen", label: "Réponses par nœud (widen)", kind: "number", min: 1, max: 16, off: null, hint: "les coups gardés sous chaque nœud de l'arbre" },
  { key: "depth", label: "Profondeur (depth)", kind: "number", min: 1, max: 14, off: null, hint: "les plis de l'arbre avant la simulation" },
  { key: "core", label: "Cœur (core)", kind: "select", options: null, off: null, hint: "l'heuristique qui classe les coups et joue les simulations" },
  { key: "exact", label: "Solveur exact (exact)", kind: "number", min: 0, max: 12, off: "0", hint: "cartes au plus (mains + pioche vide) où le solveur remplace l'arbre ; 0 : jamais" },
  { key: "candidates", label: "Candidats à la racine", kind: "number", min: 2, max: 16, off: String(ISMCTS.candidates), hint: "8 par défaut" },
  { key: "pwl", label: "Élargissement progressif (pwl)", kind: "number", min: 0, max: 5, off: "0", hint: "0 aucun à 5 le plus profond" },
  { key: "trees", label: "Arbres (trees)", kind: "number", min: 1, max: 4, off: "1", hint: "le budget partagé entre k arbres, un worker chacun" },
  { key: "final", label: "Choix final (final)", kind: "select", options: [["", "le plus visité"], ["0", "meilleur taux (0)"], ["1", "taux − 1/√visites (1)"]], off: "", hint: "final-choice.js" },
  { key: "fpu", label: "Réponse jamais essayée (fpu)", kind: "number", min: 0, max: 3, off: "0", hint: "0 : avant toutes ; d : la moyenne des sœurs moins d/10" },
  { key: "puct", label: "Prior du cœur (puct)", kind: "number", min: 0, max: 4, off: "0", hint: "0 : UCB1" },
  toggle("crn", "Donnes communes (crn)", "les candidats comparés sur les mêmes donnes"),
  toggle("mirror", "Coups miroirs (mirror)", "plateau symétrique : les bornes 1 à 4 seulement"),
]);

/** A field's choices, the cores' list read when asked (CORES is large). */
export const optionsOf = (field) => field.options ?? coreNames().map((name) => [name, name]);

/** The form of an engine id (the 1.2's when `engine` is not an ISMCTS): `{ values: { key: string }, budget, timed }`. */
export function formFromEngine(engine = BASE_ENGINE) {
  const at = engine.lastIndexOf("@");
  const settings = ismctsSettings(at < 0 ? engine : engine.slice(0, at));
  if (!settings) return formFromEngine(BASE_ENGINE);
  const budget = at < 0 ? String(ISMCTS.budget) : engine.slice(at + 1);
  const raw = Object.fromEntries((at < 0 ? engine : engine.slice(0, at)).split("+").slice(1).map((change) => change.split("=")));
  const values = Object.fromEntries(FIELDS.map((field) => [field.key, raw[field.key] ?? field.off ?? defaultOf(field)]));
  // Settings the form does not show (diverse, rave, …) are kept as they are.
  const extra = Object.entries(raw).filter(([key]) => !FIELDS.some((field) => field.key === key));
  return { values, extra, budget: budget.replace(/^t/, ""), timed: budget.startsWith("t") };
}

const defaultOf = (field) => (field.key === "core" ? "exp" : String(ISMCTS[field.key] ?? ""));

/** The engine id a form names; `{ engine }` or `{ error }` when a value is off its range or unknown to the engine. */
export function engineFromForm({ values, extra = [], budget, timed = false }) {
  const changes = FIELDS.map((field) => changeOf(field, String(values[field.key] ?? "").trim()));
  const wrong = changes.find((change) => change?.error);
  if (wrong) return wrong;
  const count = budgetOf(budget, timed);
  if (count.error) return count;
  const written = [...changes.filter(Boolean), ...extra.map(([key, value]) => `${key}=${value}`)];
  const engine = `${["ismcts", ...written].join("+")}@${timed ? "t" : ""}${count}`;
  try {
    ismctsSettings(engine.split("@")[0]);
  } catch (error) {
    return { error: error.message };
  }
  return { engine };
}

/** The budget typed (iterations, or ms with `timed`), or `{ error }` under 50. */
function budgetOf(budget, timed) {
  const count = Number(budget);
  if (Number.isInteger(count) && count >= 50) return count;
  return { error: timed ? "Temps par coup : 50 ms au moins" : "Itérations : 50 au moins" };
}

/** A field's part of the id: « key=value », null when left out, or `{ error }`. */
function changeOf(field, value) {
  if (value === "") return field.off === null ? { error: `${field.label} : une valeur est attendue` } : null;
  if (value === field.off) return null;
  if (field.kind === "number" && !inRange(value, field)) return { error: `${field.label} : entre ${field.min} et ${field.max}` };
  return `${field.key}=${value}`;
}

const inRange = (value, { min, max }) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;

/** What a config costs, then what the guards say of it. */
export const GUARDS = Object.freeze({ warnIterations: 10_000, stopIterations: 50_000, warnGameMs: 300_000, noteDepth: 10, searchedMoves: 16 });

/**
 * `{ iterations, moveMs, gameMs }` of `engine`: its iterations a move (a clock `@t` counts as its time), the time a move
 * takes at `perSecond` iterations a second (the 1.2's, measured in a worker) on `workers` workers sharing its trees,
 * and a game's: `searchedMoves` searched moves (the last ones go to the solver).
 */
export function costOf(engine, { perSecond, workers = 1 }) {
  const [name, budget = String(ISMCTS.budget)] = engine.split("@");
  const trees = Number(ismctsSettings(name)?.trees ?? 1);
  const timed = budget.startsWith("t");
  const iterations = timed ? Math.round((Number(budget.slice(1)) / 1000) * perSecond * Math.min(trees, workers)) : Number(budget);
  const moveMs = timed ? Number(budget.slice(1)) : (1000 * iterations) / (perSecond * Math.max(1, Math.min(trees, workers)));
  return { iterations, moveMs, gameMs: moveMs * GUARDS.searchedMoves, timed };
}

/** The guards' findings for a config: `{ level: "stop" | "warn" | "note", text }`, worst first. */
export function guardsOf(engine, cost) {
  const settings = ismctsSettings(engine.split("@")[0]) ?? {};
  const found = [];
  if (cost.iterations > GUARDS.stopIterations) found.push({ level: "stop", text: `${count(cost.iterations)} itérations par coup : au-delà de ${count(GUARDS.stopIterations)}, il faut confirmer avant de lancer la partie.` });
  else if (cost.iterations > GUARDS.warnIterations) found.push({ level: "warn", text: `${count(cost.iterations)} itérations par coup : plus de ${count(GUARDS.warnIterations)}, la partie sera longue.` });
  if (cost.gameMs > GUARDS.warnGameMs) found.push({ level: "warn", text: `Environ ${minutes(cost.gameMs)} par partie pour ce robot (plus de 5 min).` });
  if ((settings.depth ?? ISMCTS.depth) > GUARDS.noteDepth) {
    found.push({ level: "note", text: "Au-delà du pli 8, l'arbre ne descend presque jamais : pli 6 dans 3 à 48 % des coups tant que la pioche a 10 cartes ou plus, dans 64 à 100 % avec 1 à 3, pli 8 dans 17 à 60 % à la fin." });
  }
  return found;
}

const count = (value) => Math.round(value).toLocaleString("fr-FR");
const minutes = (ms) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`);

/** « 2,6 s par coup, environ 42 s par partie » for a cost. */
export function costText(cost) {
  const iterations = cost.timed ? "" : `${count(cost.iterations)} itérations, `;
  return `${iterations}${(cost.moveMs / 1000).toFixed(1).replace(".", ",")} s par coup, environ ${minutes(cost.gameMs)} par partie`;
}

/**
 * A result's verdict from the side it is read, as the protocol reads it (`docs/validation.md`): ahead when the whole
 * interval is above 50 %, behind when it is below; under 1 000 games a lead only names a candidate.
 */
export function verdictOf({ low, high, games }) {
  if (low > 0.5) return games >= 1000 ? "devant" : "devant, à confirmer sur 1 000 parties";
  return high < 0.5 ? "derrière" : "pas d'écart net";
}

/** Every duel of `engine` in `configs`, from its side: `{ opponent, name, score, low, high, games, verdict }`, most games first. */
export function measuredOf(engine, configs) {
  const key = normalizeEngine(engine);
  return (configs?.pairs ?? [])
    .filter((pair) => pair.a === key || pair.b === key)
    .map((pair) => {
      const first = pair.a === key;
      const side = first ? { score: pair.score, low: pair.low, high: pair.high } : { score: 1 - pair.score, low: 1 - pair.high, high: 1 - pair.low };
      const opponent = first ? pair.b : pair.a;
      return { opponent, name: configs.names?.[opponent] ?? null, ...side, games: pair.games, last: pair.last, verdict: verdictOf({ ...side, games: pair.games }) };
    })
    .sort((a, b) => b.games - a.games);
}

/** The configs the duels measured that differ from `engine` by one setting (the budget counts as one): `{ engine, name, differs }`. */
export function neighboursOf(engine, configs) {
  const known = new Set((configs?.pairs ?? []).flatMap((pair) => [pair.a, pair.b]));
  const key = normalizeEngine(engine);
  return [...known]
    .filter((other) => other !== key)
    .map((other) => ({ engine: other, name: configs.names?.[other] ?? null, differs: engineDiff(key, other) }))
    .filter((entry) => entry.differs?.length === 1);
}

/** The name the duels or the line-up gave `engine`, or null. */
export const nameOf = (engine, configs) => configs?.names?.[normalizeEngine(engine)] ?? null;

/** The settings `engine` has that the 1.2 has not, or has with another value: « fpu=1 », « @4000 »… */
function changesFromBase(engine) {
  const [mine, base] = [engineParts(normalizeEngine(engine)), engineParts(normalizeEngine(BASE_ENGINE))];
  const theirs = new Map(base.changes);
  const ours = new Map(mine.changes);
  const changed = mine.changes.filter(([key, value]) => theirs.get(key) !== value).map(([key, value]) => `${key}=${value}`);
  const dropped = base.changes.filter(([key]) => !ours.has(key)).map(([key]) => `sans ${key}`);
  return [...changed, ...dropped, ...(mine.budget === base.budget ? [] : [`@${mine.budget}`])];
}

/** How the Labo names a bot it built: its duels' name, else the 1.2 and what it changes (« 1.2 fpu=1 »), else its id. */
export function labelOf(engine, configs) {
  const named = nameOf(engine, configs);
  if (named) return named;
  if (!engineParts(engine)) return engine;
  const changes = changesFromBase(engine);
  return changes.length === 0 ? "Expérimental 1.2" : `1.2 ${changes.join(" ")}`;
}

/** The value a built engine takes in the Labo's bot lists, and back: a line-up id stays as it is. */
export const ENGINE_PREFIX = "engine:";
export const engineChoice = (engine) => `${ENGINE_PREFIX}${engine}`;

/** A bot list's value: `{ lineup: id }` for a line-up bot, `{ engine }` for one built. */
export const readChoice = (value) => (value.startsWith(ENGINE_PREFIX) ? { engine: value.slice(ENGINE_PREFIX.length) } : { lineup: value });

/**
 * How a built ISMCTS thinks in the Labo's workers (think-worker.js): its iterations, a clock `@t` as its time, its
 * trees on `min(trees, cap)` workers. Null for an engine that answers at once (`greedy`, `lookahead`).
 */
export function thinkOf(engine, { cap, limitMs }) {
  const [name, budget = ""] = engine.split("@");
  const settings = ismctsSettings(name);
  if (!settings) return null;
  const clock = budget.startsWith("t") ? Number(budget.slice(1)) : limitMs;
  return { limitMs: clock, minMs: 0, workers: Math.max(1, Math.min(settings.trees ?? 1, cap)) };
}
