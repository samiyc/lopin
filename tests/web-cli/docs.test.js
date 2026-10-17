import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const scripts = Object.keys(JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).scripts);
const glossary = readFileSync(new URL("../../docs/commandes.md", import.meta.url), "utf8");

describe("the glossary of npm commands (docs/commandes.md)", () => {
  it("lists every script of package.json", () => {
    // Each command sits in a table row as `npm run <name>`, followed by a space, its options or the closing backtick.
    const missing = scripts.filter((name) => !new RegExp(`\`npm run ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\` ]`).test(glossary));
    assert.deepEqual(missing, [], "add them to docs/commandes.md");
  });
});
