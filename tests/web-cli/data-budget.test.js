import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * data/ is versioned: the facts and the summaries the pages and docs read.
 * A file a script can write again — a raw dump, a rebuilt bench — goes to
 * tmp/ (scripts/lib/domain/tmp.js), which git ignores once and for all. This keeps
 * a 24 MB export from landing in git, as one did on 10/10.
 */
const DATA = fileURLToPath(new URL("../../data/", import.meta.url));
const DATA_FILE_LIMIT = 500 * 1024;

const filesUnder = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)]));

describe("the data/ budget", () => {
  it("keeps every file of data/ under 500 KB: a bigger one belongs in tmp/", () => {
    const heavy = filesUnder(DATA)
      .map((file) => ({ file, kb: Math.round(statSync(file).size / 1024) }))
      .filter(({ kb }) => kb * 1024 > DATA_FILE_LIMIT);
    const named = heavy.map(({ file, kb }) => file + " (" + kb + " Ko)").join(", ");
    assert.deepEqual(heavy, [], `trop lourds pour data/, à écrire dans tmp/ (scripts/lib/domain/tmp.js) : ${named}`);
  });
});
