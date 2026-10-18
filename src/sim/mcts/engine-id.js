import { ISMCTS, ismctsSettings } from "./ismcts.js";
import { PW_LEVELS } from "./widening.js";

/**
 * Engine ids compared as configs (the Labo, lot 2): an ISMCTS id names the same bot whatever the order of its
 * settings, and a setting at its default (`+candidates=8`, `+trees=1`) or a missing budget (400) changes nothing.
 * `normalizeEngine` writes the one spelling — settings sorted, defaults dropped, the budget always written — under
 * which the duels' configs are filed (`npm run lab-index`). Any other engine id (`greedy`, `lookahead`, `phase:…`) is
 * its own spelling. The obsolete `+pw=k` is written as the level that plays the same moves (`pw=1` → `pwl=4`, `pw=2` →
 * `pwl=2`, `pw=3` → `pwl=1`, widening.js), so a config's duels under both names are one config's.
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

/** `pw=k` as its level when k is one (`pwl` given too: `pw` is ignored by the tree, so it goes). */
function asLevel([key, value], changes) {
  if (key !== "pw") return [key, value];
  if (changes.some(([other]) => other === "pwl")) return null;
  const level = PW_LEVELS.indexOf(Number(value));
  return level > 0 ? ["pwl", String(level)] : [key, value];
}

/** The one spelling of `id`: « ismcts+core=stfig6+depth=5+exact=12+widen=7@2000 ». */
export function normalizeEngine(id) {
  const parts = engineParts(id);
  if (!parts) return id;
  const levels = parts.changes.map((change) => asLevel(change, parts.changes)).filter(Boolean);
  const kept = levels.filter((change) => !isDefault(change)).sort(([a], [b]) => (a < b ? -1 : 1));
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
