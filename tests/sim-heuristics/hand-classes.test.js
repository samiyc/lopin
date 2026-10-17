import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { buildDeck } from "../../src/core/cards.js";
import { formatCards } from "../../src/core/notation.js";
import { createRng } from "../../src/core/random.js";
import { startingHandStats } from "../../src/replay/stats/hand-stats.js";
import { dealFor, handClass, startingHands } from "../../src/sim/eval/hand-classes.js";

const spec = DECKS.classique;

describe("starting hand classes", () => {
  it("put about a tenth of the hands at each end", () => {
    const rng = createRng(7);
    const counts = { weak: 0, medium: 0, strong: 0 };
    const samples = 100_000;
    for (let i = 0; i < samples; i += 1) counts[handClass(spec, rng.shuffle(buildDeck(spec)).slice(0, 6))] += 1;
    // The exact count over all 5 245 786 hands: 9.9 % weak, 8.9 % strong.
    assert.ok(Math.abs(counts.weak / samples - 0.099) < 0.004, `weak ${counts.weak}`);
    assert.ok(Math.abs(counts.strong / samples - 0.089) < 0.004, `strong ${counts.strong}`);
  });

  it("deal a deck whose first hand has the class asked, the same for the same seed", () => {
    for (const wanted of ["weak", "strong"]) {
      for (const seed of [1, 2, 3]) {
        const deck = dealFor(spec, seed, wanted);
        assert.equal(handClass(spec, startingHands(spec, deck)[0]), wanted);
        assert.deepEqual(dealFor(spec, seed, wanted), deck);
      }
    }
  });

  it("are counted from a saved game's deck, for each player", () => {
    const deck = dealFor(spec, 4, "weak");
    const log = {
      rules: { deck: "classique", jokerRule: "colorless", order: "original", endMode: "claim-end" },
      deck: formatCards(spec, deck),
      players: [
        { seat: 0, kind: "human", name: "Sami" },
        { seat: 1, kind: "bot", bot: "experimental", version: "0.8.0" },
      ],
      result: { winner: 1 },
    };
    const [sami, bot] = startingHandStats([log]);
    assert.equal(sami.player, "Sami");
    assert.deepEqual(sami.weak, { games: 1, won: 0 });
    assert.equal(bot.player, "experimental@0.8");
    assert.equal(bot[handClass(spec, startingHands(spec, deck)[1])].won, 1);
  });
});
