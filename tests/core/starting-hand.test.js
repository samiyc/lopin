import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS, JOKER_RULES } from "../../src/config/decks.js";
import { PATTERNS } from "../../src/config/formations.js";
import { createRng } from "../../src/core/random.js";
import { outsTable, sampleStartingHands } from "../../src/core/starting-hand.js";

const { free, onePerBorder } = JOKER_RULES;

describe("outsTable", () => {
  const byId = (rows) => Object.fromEntries(rows.map((row) => [row.id, row]));

  it("a pair has colours − 2 real outs: 4 in the original, 2 in four colours", () => {
    assert.equal(byId(outsTable(DECKS.original, free)).pair.real, 4);
    assert.equal(byId(outsTable(DECKS.classique, free)).pair.real, 2);
    assert.equal(byId(outsTable(DECKS.tarot, free)).pair.real, 3);
  });

  it("counts the jokers apart, and only where they may sit", () => {
    const rows = byId(outsTable(DECKS.classique, onePerBorder));
    assert.equal(rows.suitedOpen.real, 2);
    assert.equal(rows.suitedOpen.jokers, 2);
    assert.equal(rows.open.real, 8);
    assert.equal(rows.suited.real, 8);
    assert.equal(rows.pair.unseen, 40);
  });
});

describe("outsTable with a colourless joker", () => {
  it("counts the jokers for trips and runs, never for a colour", () => {
    const rows = Object.fromEntries(
      outsTable(DECKS.classique, JOKER_RULES.colorless).map((row) => [row.id, row.jokers]),
    );
    assert.deepEqual(rows, { pair: 2, suitedOpen: 0, suitedGap: 0, suited: 0, open: 2, gap: 2 });
  });
});

describe("sampleStartingHands", () => {
  const run = (spec, jokerRule, seed) =>
    sampleStartingHands(spec, { jokerRule, samples: 3000, rng: createRng(seed) });

  it("is reproducible from its seed", () => {
    assert.deepEqual(run(DECKS.classique, free, 7), run(DECKS.classique, free, 7));
  });

  it("returns shares between 0 and 1, a start always at least as likely as a finish", () => {
    const result = run(DECKS.tarot, free, 3);
    for (const f of PATTERNS) {
      assert.ok(result.complete[f] >= 0 && result.complete[f] <= 1);
      assert.ok(result.start[f] >= result.complete[f], f);
    }
  });

  it("two jokers stop making a trio on their own under one joker per border", () => {
    const loose = run(DECKS.classique, free, 11);
    const strict = run(DECKS.classique, onePerBorder, 11);
    assert.ok(strict.complete.straightFlush < loose.complete.straightFlush);
  });
});

describe("createRng", () => {
  it("replays the same sequence from the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 5; i += 1) assert.equal(a.next(), b.next());
  });
});
