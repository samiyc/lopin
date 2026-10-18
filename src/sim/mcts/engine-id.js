import { ISMCTS, ismctsSettings } from "./ismcts.js";

/**
 * Engine ids compared as configs (the Labo, lot 2): an ISMCTS id names the same bot whatever the order of its
 * settings, and a setting at its default (`+candidates=8`, `+trees=1`) or a missing budget (400) changes nothing.
 * `normalizeEngine` writes the one spelling — settings sorted, defaults dropped, the budget always written — under
 * which the duels' configs are filed (`npm run lab-index`). Any other engine id (`greedy`, `lookahead`, `phase:…`) is
 * its own spelling.
 */
const DEFAULT_BUDGET = String(ISMCTS.budget);

/** `{ changes: [[key, value]…], budget }` of an ISMCTS id (settings checked by `ismctsSettings`), or null for another engine. */
export function engineParts(id) {
  const at = id.lastIndexOf("@");
  const name = at < 0 ? id : id.slice(0, at);
  if (ismctsSettings(name) === null) return null;
  const changes = name.split("+").slice(1).map((change) => change.split("="));
  return { changes, budget: at < 0 ? DEFAULT_BUDGET : id.slice(at + 1) };
}

const isDefault = ([key, value]) => key in ISMCTS && typeof ISMCTS[key] === "number" && Number(value) === ISMCTS[key];

/** The one spelling of `id`: « ismcts+core=stfig6+depth=5+exact=12+widen=7@2000 ». */
export function normalizeEngine(id) {
  const parts = engineParts(id);
  if (!parts) return id;
  const kept = parts.changes.filter((change) => !isDefault(change)).sort(([a], [b]) => (a < b ? -1 : 1));
  return ["ismcts", ...kept.map(([key, value]) => `${key}=${value}`)].join("+") + `@${parts.budget}`;
}

/** The settings two ids differ by (« @ » for the budget), or null when one is not an ISMCTS. */
export function engineDiff(a, b) {
  const [left, right] = [engineParts(normalizeEngine(a)), engineParts(normalizeEngine(b))];
  if (!left || !right) return null;
  const [l, r] = [new Map(left.changes), new Map(right.changes)];
  const keys = [...new Set([...l.keys(), ...r.keys()])].filter((key) => l.get(key) !== r.get(key)).sort();
  return left.budget === right.budget ? keys : [...keys, "@"];
}
