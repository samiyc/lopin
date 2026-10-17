import { BOT_PARAMS } from "../../../src/sim/bots.js";

/**
 * The features of the 1.0's core, for `npm run features` (Sami, 05/10: which
 * of them cost the most and serve the least?). A CPU profile names functions;
 * `FEATURES` says which feature each function belongs to, by file and, where
 * a file holds several, by function name. `ABLATIONS` says how to switch a
 * feature off, to measure how often it changes a score (pure: the script
 * applies them to the core's settings).
 */
export const FAMILIES = Object.freeze({
  valeur: "La valeur d'un coup",
  habitudes: "Les habitudes",
  idees: "Les idées",
  certitudes: "Les certitudes",
  moteur: "Le moteur de la recherche",
  autre: "Autre",
});

const fileOf = (url) => url.split("/").pop();
const named = (...names) => (fn) => names.includes(fn);

/** Each feature: its id, label, family, and the files (and functions) that are its own. First match wins. */
export const FEATURES = Object.freeze([
  { id: "unseen", label: "Les cartes invisibles (comptées une fois par évaluation)", family: "valeur", file: "potential.js", fn: named("unseenCards", "listUnseen", "columns", "createValuer", "buildValuer") },
  { id: "potential", label: "Le potentiel d'un côté (paires, pioche, figures possibles)", family: "valeur", file: "potential.js" },
  { id: "evaluator", label: "L'évaluateur de figures", family: "valeur", file: ["evaluator.js", "formations.js", "combinatorics.js", "partition.js", "stand-ins.js", "cards.js"] },
  { id: "price", label: "Le prix d'une carte (joker, carte haute)", family: "valeur", file: "bots.js", fn: named("cardCost") },
  { id: "gain", label: "Le gain d'un coup (chances avant/après, menace)", family: "valeur", file: "bots.js", fn: named("moveGain", "winChance", "withoutCard", "aloneOf", "views", "borderChances", "ownedOdds", "boardCards", "ideasContext", "scoreStrategist", "certaintyOf", "plainGain", "gainOf") },
  { id: "jokerGate", label: "La porte du joker (peut-il encore servir ?)", family: "habitudes", file: "joker-gate.js" },
  { id: "opening", label: "Habitude : ouvrir au milieu, une nouvelle couleur", family: "habitudes", file: "strategist.js", fn: named("openingBonus", "openedSuits") },
  { id: "suited", label: "Habitude : départ assorti (suite de couleur encore possible)", family: "habitudes", file: "strategist.js", fn: named("suitedBonus", "suitedOutLeft", "suitedConnector") },
  { id: "joker", label: "Habitude : le joker seulement pour un brelan", family: "habitudes", file: "strategist.js", fn: named("jokerCompletesTrips", "jokerBonus", "jokerCompletesRun") },
  { id: "dispatch", label: "L'aiguillage des bonus (habitudes et idées appelées par coup)", family: "idees", file: ["strategist.js", "tuning.js", "bots.js", "ideas.js"], fn: (fn, file) => file !== "ideas.js" || ["ideasBonus", "familiesBonus", "gatesOf"].includes(fn) },
  { id: "middle", label: "Idée : le milieu, solide ou faible", family: "idees", file: "ideas.js", fn: named("placeBonus", "solidStart", "openConnector", "isMiddle", "firstCardBonus") },
  { id: "spread", label: "Idée : ne pas séparer une paire (spread)", family: "idees", file: "ideas.js", fn: named("spreadPenalty") },
  { id: "connector", label: "Idée : garder un connecteur assorti (connector)", family: "idees", file: "principles.js" },
  { id: "stay", label: "Idée : rester sur ses côtés tant qu'une figure y est possible (stay)", family: "idees", file: "oracle-ideas.js" },
  { id: "idle", label: "Idées éteintes : appelées pour rien", family: "idees", file: ["ideas.js", "mined.js", "shapes.js", "joker-ideas.js", "bait.js", "outbid.js", "gates.js"] },
  { id: "certain", label: "Les certitudes (bornes déjà perdues ou gagnées)", family: "certitudes", file: "certainty.js" },
  { id: "pick", label: "Le choix du coup (tirage pondéré des simulations)", family: "moteur", file: "pick.js" },
  { id: "rules", label: "Les règles (coups légaux, poser, revendiquer)", family: "moteur", file: ["game.js", "settle.js", "rules.js"] },
  { id: "deal", label: "Le tirage des cartes cachées", family: "moteur", file: ["lookahead.js", "random.js", "infer.js"] },
  { id: "tree", label: "L'arbre (sélection, visites)", family: "moteur", file: ["ismcts.js", "budget.js", "phase.js", "search.js"] },
  { id: "exact", label: "La fin de partie exacte", family: "moteur", file: ["exact.js", "endgame.js"] },
  { id: "gc", label: "Le ramasse-miettes (la mémoire que tout cela alloue)", family: "autre", file: "", fn: named("(garbage collector)") },
]);

const OTHER = { id: "other", label: "Autre (fonctions internes du moteur JavaScript)", family: "autre" };

/** Not the core's time: the thread waiting, and the measurement itself (the inspector's messages, Node's own clock and modules). */
const outside = ({ url = "", functionName }) => ["(idle)", "(program)"].includes(functionName) || (url === "" && functionName === "dispatch") || url.startsWith("node:");
const fileMatches = (feature, file) => (Array.isArray(feature.file) ? feature.file.includes(file) : feature.file === file);

/** The feature a profiled function belongs to: its file, then its name where the file is shared. */
export function featureOf({ url, functionName }) {
  const file = fileOf(url ?? "");
  return FEATURES.find((feature) => fileMatches(feature, file) && (!feature.fn || feature.fn(functionName, file))) ?? OTHER;
}

/**
 * A CPU profile (`Profiler.stop` of node:inspector) as milliseconds of self
 * time per feature, and their share of the total. The thread waiting and the
 * measurement itself (`outside`) are left out.
 */
export function timeByFeature({ nodes, samples, timeDeltas }) {
  const byNode = new Map(nodes.map((node) => [node.id, node]));
  const ms = new Map();
  let total = 0;
  samples.forEach((id, i) => {
    const frame = byNode.get(id).callFrame;
    if (outside(frame)) return;
    const feature = featureOf(frame);
    const delta = (timeDeltas[i] ?? 0) / 1000;
    ms.set(feature.id, (ms.get(feature.id) ?? 0) + delta);
    total += delta;
  });
  return { total, features: Object.fromEntries([...ms].map(([id, time]) => [id, { ms: time, share: total > 0 ? time / total : 0 }])) };
}

/**
 * How to switch a feature off in a core's settings, to see when it changes a
 * score. A feature with none (the potential, the evaluator) is always at work.
 */
export const ABLATIONS = Object.freeze({
  opening: (core) => ({ ...core, habits: core.habits.filter((habit) => habit !== "opening") }),
  suited: (core) => ({ ...core, habits: core.habits.filter((habit) => habit !== "suited") }),
  joker: (core) => ({ ...core, habits: core.habits.filter((habit) => habit !== "joker") }),
  middle: (core) => ({ ...core, ideas: core.ideas.filter((idea) => idea !== "middle") }),
  spread: (core) => ({ ...core, ideas: core.ideas.filter((idea) => idea !== "spread") }),
  connector: (core) => ({ ...core, ideas: core.ideas.filter((idea) => idea !== "connector") }),
  stay: (core) => ({ ...core, ideas: core.ideas.filter((idea) => idea !== "stay") }),
  certain: (core) => ({ ...core, ideas: core.ideas.filter((idea) => idea !== "certain") }),
  price: (core) => ({ ...core, params: { ...BOT_PARAMS, ...core.params, jokerCost: 0, cardCost: 0 } }),
});

/** Of two scorings of the same moves: how many gains differ, and whether the favourite moved. */
export function compareScorings(full, without) {
  const key = ({ move }) => `${move.card}:${move.border}`;
  const other = new Map(without.map((entry) => [key(entry), entry]));
  const changed = full.filter((entry) => {
    const twin = other.get(key(entry));
    return !twin || Math.abs(twin.gain - entry.gain) > 1e-9 || Boolean(twin.refused) !== Boolean(entry.refused);
  }).length;
  const best = (scored) => key(scored.filter((entry) => !entry.refused).reduce((a, b) => (b.gain > a.gain ? b : a)));
  return { moves: full.length, changed, favourite: best(full) !== best(without) };
}
