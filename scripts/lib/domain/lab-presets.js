import { readFile, writeFile } from "node:fs/promises";

/**
 * The Labo's saved settings (lot 2, `/api/lab/presets`): a name, the two bots (a line-up id or `engine:<id>`), a seed
 * (null: at random) and a note, kept in data/lab-presets.json. A preset saved under a name already there replaces it.
 * `LOPIN_LAB_PRESETS` points the server elsewhere, to try the page without touching Sami's file.
 */
export const PRESETS_FILE = process.env.LOPIN_LAB_PRESETS ?? new URL("../../../data/lab-presets.json", import.meta.url);
const LIMITS = { name: 60, bot: 400, note: 500, presets: 200 };

const isText = (value, max) => typeof value === "string" && value.length > 0 && value.length <= max;

/** Is `preset` one to keep: a name, two bots, a seed (a natural number or null), a note (possibly empty)? */
export function isPreset(preset) {
  if (!preset || !isText(preset.name, LIMITS.name)) return false;
  return botsOk(preset.bots) && seedOk(preset.seed) && noteOk(preset.note ?? "");
}

const botsOk = (bots) => Array.isArray(bots) && bots.length === 2 && bots.every((bot) => isText(bot, LIMITS.bot));
const seedOk = (seed) => seed === null || (Number.isInteger(seed) && seed >= 0);
const noteOk = (note) => typeof note === "string" && note.length <= LIMITS.note;

/** `presets` with `preset` added, replacing one of the same name, the most recent first, at most 200. */
export function withPreset(presets, preset) {
  const kept = { name: preset.name, bots: preset.bots, seed: preset.seed, note: preset.note ?? "", savedAt: preset.savedAt };
  return [kept, ...presets.filter((other) => other.name !== preset.name)].slice(0, LIMITS.presets);
}

export const readPresets = () => readFile(PRESETS_FILE, "utf8").then((text) => JSON.parse(text).presets ?? [], () => []);

export const writePresets = (presets) => writeFile(PRESETS_FILE, `${JSON.stringify({ note: "Les réglages sauvés du Labo (/api/lab/presets).", presets }, null, 1)}\n`);
