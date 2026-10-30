import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { JOKER, buildDeck, cardOf } from "../../src/core/cards.js";
import { tallyEssais } from "../../src/irl/analysis.js";
import { loadEssais, parseCard } from "../../src/irl/cards.js";

const classique = DECKS.classique;

describe("parseCard", () => {
  it("reads values, suits and jokers", () => {
    assert.equal(parseCard(classique, "10♥"), cardOf(classique, 1, 10));
    assert.equal(parseCard(classique, "1♠"), cardOf(classique, 0, 1));
    assert.equal(parseCard(classique, "JK"), JOKER);
  });

  it("refuses what is not a card of the deck", () => {
    assert.throws(() => parseCard(classique, "11♥"));
    assert.throws(() => parseCard(classique, "7x"));
  });
});

describe("the transcribed photos", () => {
  const { games } = loadEssais();
  const sorted = (cards) => [...cards].sort((a, b) => a - b);

  it("are ten games of two lines of seven columns of three", () => {
    assert.equal(games.length, 10);
    for (const { photo, lines } of games) {
      for (const line of [lines.haut, lines.bas]) {
        assert.equal(line.length, 7, photo);
        for (const column of line) assert.equal(column.length, 3, photo);
      }
    }
  });

  it("each hold the 42 cards exactly once: a misread card fails here", () => {
    const deck = sorted(buildDeck(classique));
    for (const { photo, lines } of games) {
      const cards = [...lines.haut, ...lines.bas].flat();
      assert.deepEqual(sorted(cards), deck, photo);
    }
  });

  it("put the two jokers anywhere but never twice in one column", () => {
    for (const { photo, lines } of games) {
      for (const column of [...lines.haut, ...lines.bas]) {
        assert.ok(column.filter((card) => card === JOKER).length <= 1, photo);
      }
    }
  });
});

describe("the real games tallied like the bots' solo games (tallyEssais, src/irl/analysis.js)", () => {
  const tally = tallyEssais();
  const formations = (line) => Object.values(line).reduce((sum, count) => sum + count, 0);

  it("count every column of the ten games, and solve every line exactly", () => {
    assert.equal(tally.games, 10);
    assert.equal(formations(tally.lines.haut), 70);
    assert.equal(formations(tally.lines.bas), 70);
    assert.equal(tally.optimum.lines, 20);
    assert.ok(tally.optimum.value <= tally.optimum.optimum, "no line beats its exact optimum");
  });

  it("hold the domain notes: ~29 % straight flushes, ~90 % of the optimum, every joker in trips (CLAUDE.md)", () => {
    const straightFlushes = (tally.lines.haut.straightFlush + tally.lines.bas.straightFlush) / 140;
    assert.ok(straightFlushes > 0.25 && straightFlushes < 0.33, `straight flushes ${straightFlushes}`);
    const reached = tally.optimum.value / tally.optimum.optimum;
    assert.ok(reached > 0.85 && reached < 0.95, `optimum ${reached}`);
    const { threeOfAKind, ...others } = tally.jokers;
    assert.ok(threeOfAKind > 0);
    assert.deepEqual(Object.values(others), [0, 0, 0, 0]);
  });
});
