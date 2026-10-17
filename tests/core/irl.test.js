import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DECKS } from "../../src/config/decks.js";
import { JOKER, buildDeck, cardOf } from "../../src/core/cards.js";
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
