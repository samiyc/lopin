import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOT_LINEUP } from "../../src/config/bots.js";
import { parseSeat } from "../../src/sim/engine/seat-rules.js";

const scripts = Object.keys(JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).scripts);
const glossary = readFileSync(new URL("../../docs/commandes.md", import.meta.url), "utf8");

describe("the glossary of npm commands (docs/commandes.md)", () => {
  it("lists every script of package.json", () => {
    // Each command sits in a table row as `npm run <name>`, followed by a space, its options or the closing backtick.
    const missing = scripts.filter((name) => !new RegExp(`\`npm run ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\` ]`).test(glossary));
    assert.deepEqual(missing, [], "add them to docs/commandes.md");
  });
});

describe("the docs against the code", () => {
  it("present every robot of the line-up in docs/jouer.md, each but the first with its score against the one below", () => {
    const play = readFileSync(new URL("../../docs/jouer.md", import.meta.url), "utf8");
    const bots = Object.values(BOT_LINEUP);
    assert.deepEqual(bots.filter((bot) => !play.includes(`**${bot.label}**`)).map((bot) => bot.label), [], "add them to the table of docs/jouer.md");
    assert.deepEqual(bots.slice(1).filter((bot) => !bot.vsLower).map((bot) => bot.label), [], "give them a vsLower in src/config/bots.js");
  });

  it("name only seat compensations that parseSeat reads (docs/sieges.md, docs/glossaire.md)", () => {
    for (const doc of ["sieges", "glossaire"]) {
      const text = readFileSync(new URL(`../../docs/${doc}.md`, import.meta.url), "utf8");
      // `PeekTurnsN` names a family: N stands for a number.
      const names = [...text.matchAll(/`((?:Peek|Hand)[A-Za-z0-9]+)`/g)].map(([, name]) => name.replace(/N$/, "2"));
      for (const name of names) assert.doesNotThrow(() => parseSeat(name), `${name} in docs/${doc}.md`);
    }
  });
});
