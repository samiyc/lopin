import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCard, parseCards } from "../src/core/notation.js";
import { legalMoves } from "../src/sim/game.js";
import { SPEC, newGame } from "../web/app/runner.js";
import { claimText, endText, handOrder, machineView, parseInput, textView } from "../scripts/lib/cli-view.js";

/** A game of the page's rules where player 0 holds `hand`, with a few cards and owners set by hand. */
function position() {
  const state = newGame(5);
  state.hands[0] = parseCards(SPEC, ["7♦", "3♠", "JK", "10♥", "2♠", "8♣"]);
  state.borders[0].sides[0] = parseCards(SPEC, ["9♠", "9♥", "9♣"]);
  state.borders[0].owner = 0;
  state.borders[1].owner = 1;
  state.borders[2].sides[1] = parseCards(SPEC, ["4♦"]);
  return state;
}

describe("Bornage in a terminal (scripts/lib/cli-view.js, Sami 12/10)", () => {
  it("shows the header, seven columns on seven lines, and the hand sorted by suit and numbered", () => {
    const state = position();
    const lines = textView(state, 0).split("\n");
    assert.match(lines[0], /^Tour 1 · pioche \d+ · main du robot 6 · bornes : toi 1, robot 1$/);
    assert.equal(lines[1], "Vues : ♠ 3/10 · ♥ 2/10 · ♣ 2/10 · ♦ 2/10 · JK 1/2", "the board and the hand, as the page's suit bar");
    const board = lines.slice(3, 10);
    assert.equal(board.length, 7);
    assert.match(board[2], /^ {10}4♦$/, "the opponent's first card sits on the line just above the borders");
    assert.equal(board[3], "1A   2B   3-   4-   5-   6-   7-");
    assert.deepEqual([board[4], board[5], board[6]], ["9♠", "9♥", "9♣"]);
    assert.equal(lines.at(-1), "Main : 1:2♠  2:3♠  3:10♥  4:8♣  5:7♦  6:JK");
  });

  it("reads « card border » with any simple separator, and says plainly what is wrong", () => {
    const state = position();
    const order = handOrder(state, 0);
    for (const text of ["5 4", "5,4", "5-4", " 5  4 "]) assert.deepEqual(parseInput(text, state, order).move, { card: order[4], border: 3 }, text);
    assert.match(parseInput("9 4", state, order).error, /Carte 9 : ta main en a 6/);
    assert.match(parseInput("1 8", state, order).error, /Borne 8 : il y en a 7/);
    assert.match(parseInput("1 1", state, order).error, /ne peut pas aller sur la borne 1/);
    assert.match(parseInput("p", state, order).error, /on ne passe que sans coup/);
    assert.match(parseInput("bonjour", state, order).error, /Je n'ai pas compris/);
    assert.deepEqual(parseInput("t", state, order), { sort: true });
    assert.deepEqual(parseInput("Q", state, order), { quit: true });
  });

  it("says who claims, and how the game ended (Sami's second game, 12/10)", () => {
    assert.equal(claimText([{ index: 6, owner: 0 }], 0), "tu revendiques la borne 7");
    assert.equal(claimText([{ index: 1, owner: 1 }, { index: 3, owner: 1 }], 0), "le robot revendique les bornes 2 et 4");
    const state = newGame(5);
    [1, 2, 3].forEach((index) => (state.borders[index].owner = 1));
    [0, 4, 6].forEach((index) => (state.borders[index].owner = 0));
    Object.assign(state, { over: true, winner: 1, winType: "adjacent" });
    const canClaim = (index, player) => index === 5 && player === 0;
    assert.equal(endText(state, 0, { canClaim }), "Perdu : le robot l'emporte, bornes 2-3-4 à la suite. La borne 6 était à toi, mais celui qui vient de jouer revendique en premier, et la partie s'arrête à la première victoire.");
    Object.assign(state, { winner: 0, winType: "majority" });
    state.borders[1].owner = null;
    assert.equal(endText(state, 0), "Gagné : tu gagnes, 3 bornes (1, 5 et 7).");
  });

  it("gives an agent the same position as JSON, with exactly the legal moves", () => {
    const state = position();
    const view = machineView(state, 0);
    assert.equal(view.legal.length, legalMoves(state).length);
    assert.ok(view.legal.every((text) => parseInput(text, state, handOrder(state, 0)).move));
    assert.deepEqual(view.borders[0], { n: 1, mine: ["9♠", "9♥", "9♣"], theirs: [], won: "me" });
    assert.equal(view.borders[1].won, "opponent");
    assert.deepEqual(view.hand.map((entry) => entry.card), handOrder(state, 0).map((card) => formatCard(SPEC, card)));
    assert.equal(view.over, false);
    assert.deepEqual(view.seen, { "♠": "3/10", "♥": "2/10", "♣": "2/10", "♦": "2/10", JK: "1/2" });
    assert.equal(view.board, textView(state, 0), "the screen as text, for an agent to read");
    assert.match(view.rules, /3 bornes voisines ou 4 bornes/, "the rules in one line on the first turn");
  });
});
