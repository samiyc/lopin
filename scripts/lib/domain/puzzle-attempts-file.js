import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * The puzzle attempts (Sami, 07/10; src/replay/stats/puzzle-attempts.js): one JSON
 * line each in data/puzzle-attempts.jsonl, kept in git. The play server
 * appends to it, `npm run puzzle-stats` reads it back.
 */
// `LOPIN_ATTEMPTS_FILE`: another file, to try the page without touching Sami's attempts.
export const ATTEMPTS_FILE = process.env.LOPIN_ATTEMPTS_FILE ?? fileURLToPath(new URL("../../../data/puzzle-attempts.jsonl", import.meta.url));

const parsed = (line) => {
  try {
    return [JSON.parse(line)];
  } catch {
    return [];
  }
};

/** Every stored attempt, an unreadable line skipped; none when the file does not exist yet. */
export async function readAttempts(file = ATTEMPTS_FILE) {
  const text = await readFile(file, "utf8").catch(() => "");
  return text.split(/\r?\n/).filter(Boolean).flatMap(parsed);
}
