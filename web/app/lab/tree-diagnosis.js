import { referenceOf } from "./confidence.js";

/**
 * What looks odd in a search's tree (the Labo, Sami 17/10), PURE: a few rules read from the root's candidates
 * (`rootStats`), the levels (`treeStats`) and the snapshot. Each finding: `{ id, level: "warn" | "info", text }`;
 * `name(move)` writes a move (« 7♥ → borne 3 »). Thresholds are named in `DIAGNOSIS` and tested.
 */
export const DIAGNOSIS = Object.freeze({ starved: 0.02, coreRank: 5, flat: 0.6, refutation: 0.15, refutationVisits: 10, rateVisits: 30 });

const percent = (value) => `${Math.round(100 * value)} %`;

const byVisits = (root) => [...root].sort((a, b) => b.visits - a.visits);

function uncertain(root, name) {
  const [first, second] = byVisits(root);
  if (!second || second.visits === 0 || second.high < first.low) return null;
  return { id: "uncertain", level: "warn", text: `Coup incertain : ${name(first.move)} et ${name(second.move)} ne se départagent pas (intervalles qui se chevauchent : ${percent(first.rate)} et ${percent(second.rate)}).` };
}

function visitsVsRate(root, name) {
  const [first] = byVisits(root);
  const rated = root.filter((entry) => entry.visits >= DIAGNOSIS.rateVisits);
  const best = rated.reduce((a, b) => (b.rate > a.rate ? b : a), rated[0]);
  if (!best || best.key === first.key) return null;
  return { id: "visits-vs-rate", level: "info", text: `Le plus visité (${name(first.move)}, ${percent(first.rate)}) n'a pas le meilleur taux : ${name(best.move)} fait ${percent(best.rate)} sur ${best.visits} visites.` };
}

function starved(root, name) {
  const few = root.filter((entry) => entry.share < DIAGNOSIS.starved);
  if (few.length === 0) return null;
  return { id: "starved", level: "info", text: `Candidats presque pas explorés (moins de ${percent(DIAGNOSIS.starved)} des visites) : ${few.map((entry) => name(entry.move)).join(", ")}.` };
}

function coreDislike(root, played, name) {
  const entry = referenceOf(root, played);
  if (!entry || entry.coreRank < DIAGNOSIS.coreRank) return null;
  return { id: "core-dislike", level: "info", text: `Le cœur classait ${name(entry.move)} n° ${entry.coreRank} sur ${root.length} : c'est l'arbre qui l'a choisi.` };
}

function flat(levels) {
  const third = levels?.[2];
  if (!third || third.nodes === 0) return null;
  const share = third.one / third.nodes;
  if (share <= DIAGNOSIS.flat) return null;
  return { id: "flat", level: "info", text: `Arbre plat au pli 3 : ${percent(share)} des nœuds n'ont qu'une visite (on y juge sur une seule partie simulée).` };
}

function shallow(levels, depth) {
  if (!depth || !levels || levels.length >= depth) return null;
  return { id: "shallow", level: "info", text: `Profondeur jamais atteinte : l'arbre s'arrête au pli ${levels.length}, pour ${depth} demandés.` };
}

/** Under the move played, an opponent's reply whose rate (theirs) stands well above the other tried replies'. */
function refutation(snapshot, played, name) {
  const key = played ? `${played.card}@${played.border}` : null;
  const node = snapshot?.children.find((child) => child.key === key);
  const replies = (node?.children ?? []).filter((child) => child.visits >= DIAGNOSIS.refutationVisits);
  if (replies.length < 2) return null;
  const rated = replies.map((child) => ({ child, rate: child.wins / child.visits }));
  const best = rated.reduce((a, b) => (b.rate > a.rate ? b : a));
  const others = rated.filter((entry) => entry !== best);
  const mean = others.reduce((sum, entry) => sum + entry.rate, 0) / others.length;
  if (best.rate - mean < DIAGNOSIS.refutation) return null;
  const [card, border] = best.child.key.split("@").map(Number);
  return { id: "refutation", level: "warn", text: `Réplique dangereuse : ${name({ card, border })} gagne ${percent(best.rate)} pour l'adversaire, contre ${percent(mean)} en moyenne pour ses autres réponses.` };
}

/** Every finding on one move: `lab` is the worker's report, `played` the move, `depth` the engine's (optional). */
const plainName = (move) => (move ? `${move.card}@${move.border}` : "passe");
const EXACT = Object.freeze([{ id: "exact", level: "info", text: "Fin de partie résolue exactement : pas d'arbre, le solveur a prouvé le coup." }]);

/** A report's candidates and first tree, empty when it has none. */
function partsOf(lab) {
  if (!lab) return { root: [], tree: {} };
  return { root: lab.root ?? [], tree: lab.trees?.[0] ?? {} };
}

export function diagnose(lab, played, { name = plainName, depth = null } = {}) {
  if (lab && lab.exact) return EXACT;
  const { root, tree } = partsOf(lab);
  if (root.length === 0) return [];
  return [uncertain(root, name), refutation(tree.snapshot, played, name), visitsVsRate(root, name), coreDislike(root, played, name), starved(root, name), flat(tree.levels), shallow(tree.levels, depth)].filter(Boolean);
}
