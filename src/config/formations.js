/**
 * The five formations of Schotten Totten and the orders the study compares.
 *
 * An order is a list, strongest first. It is a parameter everywhere because
 * with wild cards the best formation a hand can make depends on the ranking —
 * and the ranking is exactly what this project questions.
 */
export const FORMATIONS = Object.freeze([
  "straightFlush",
  "threeOfAKind",
  "flush",
  "straight",
  "sum",
]);

export const FORMATION_LABELS = Object.freeze({
  straightFlush: "Suite couleur",
  threeOfAKind: "Brelan",
  flush: "Couleur",
  straight: "Suite",
  sum: "Somme",
});

/**
 * `swapped` exchanges the two strongest, `straightUp` the two middle ones
 * (in four colours a flush is easier to hold than a run), `bothSwapped`
 * does both.
 */
export const ORDERS = Object.freeze({
  original: Object.freeze([...FORMATIONS]),
  swapped: Object.freeze(["threeOfAKind", "straightFlush", "flush", "straight", "sum"]),
  straightUp: Object.freeze(["straightFlush", "threeOfAKind", "straight", "flush", "sum"]),
  bothSwapped: Object.freeze(["threeOfAKind", "straightFlush", "straight", "flush", "sum"]),
});

export const ORDER_IDS = Object.freeze(Object.keys(ORDERS));

export const ORDER_LABELS = Object.freeze({
  original: "Ordre d'origine",
  swapped: "Brelan avant Suite couleur",
  straightUp: "Suite avant Couleur",
  bothSwapped: "Les deux échanges",
});

/** The formations that are a real pattern, i.e. everything but the sum. */
export const PATTERNS = Object.freeze(FORMATIONS.filter((f) => f !== "sum"));
