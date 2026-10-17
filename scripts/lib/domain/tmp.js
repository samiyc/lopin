import { mkdirSync } from "node:fs";

/**
 * `tmp/`: the working files a script can write again — raw search dumps,
 * benches rebuilt on demand, intermediate exports a report is made from.
 * Ignored by git once and for all (.gitignore), so a new export needs no
 * new line there. `data/` keeps what is versioned: the facts and the
 * summaries the pages and docs read, each file under `DATA_FILE_LIMIT`
 * (tests/web-cli/data-budget.test.js).
 */
export const TMP = new URL("../../../tmp/", import.meta.url);

/** The URL of `name` in `tmp/`, the folder created if it is missing. */
export function tmpFile(name) {
  mkdirSync(TMP, { recursive: true });
  return new URL(name, TMP);
}
