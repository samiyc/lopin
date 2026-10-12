import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCard, parseCards } from "../src/core/notation.js";
import { legalMoves } from "../src/sim/game.js";
import { SPEC, newGame } from "../web/app/runner.js";
import { claimText, endText, formatJson, handOrder, jsonView, machineView, parseInput, textView } from "../scripts/lib/cli-view.js";

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
    const seven = { card: parseCards(SPEC, ["7♦"])[0], border: 3 };
    for (const text of ["7♦ 4", "7d 4", "7D,4"]) assert.deepEqual(parseInput(text, state, order).move, seven, text);
    assert.equal(parseInput("JK 4", state, order).move.card, parseCards(SPEC, ["JK"])[0]);
    assert.equal(parseInput("9♥ 4", state, order).error, "9♥ n'est pas dans ta main : 2♠ 3♠ 10♥ 8♣ 7♦ JK.", "a card not in the hand says so, and shows the hand");
    assert.match(parseInput("9H 4", state, order).error, /^9♥ n'est pas dans ta main/);
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

  it("gives the position as a real JSON object: groups named, no board drawn in a string (Sami, 13/10)", () => {
    const state = position();
    const view = jsonView(state, 0, { last: { toi: "9♠ → borne 1", robot: "4♦ → borne 3", revendications: [] } });
    assert.deepEqual(view.dernier_echange, { toi: "9♠ → borne 1", robot: "4♦ → borne 3" }, "an object, claims only when there are some");
    assert.deepEqual(jsonView(state, 0, { last: { toi: "9♠ → borne 1", robot: null, revendications: ["tu revendiques la borne 1"] } }).dernier_echange, { toi: "9♠ → borne 1", revendications: ["tu revendiques la borne 1"] });
    assert.deepEqual(jsonView(state, 0).dernier_echange, {}, "nothing yet at the start");
    assert.equal(view.tour, 1);
    assert.equal(view.main_robot, 6);
    assert.deepEqual(view.bornes_gagnees, { toi: 1, robot: 1 });
    assert.deepEqual(view.cartes_vues, { "♠": "3/10", "♥": "2/10", "♣": "2/10", "♦": "2/10", JK: "1/2" });
    assert.equal(view.bornes.length, 7);
    assert.deepEqual(view.bornes[0], { borne: 1, toi: ["9♠", "9♥", "9♣"], robot: [], statut: "gagnée" });
    assert.deepEqual(view.bornes[1], { borne: 2, toi: [], robot: [], statut: "perdue" });
    assert.deepEqual(view.bornes[2], { borne: 3, toi: [], robot: ["4♦"], statut: "libre" });
    assert.deepEqual(view.main, ["2♠", "3♠", "10♥", "8♣", "7♦", "JK"]);
    // No list of every card × border (« 3♠ 1 », « 3♠ 2 »…): the playable borders say the same, and the hand is `main`.
    assert.equal(view.coups, undefined);
    assert.deepEqual(view.bornes_jouables, [3, 4, 5, 6, 7], "the two borders already claimed are not playable");
    assert.equal(legalMoves(state).length, view.main.length * view.bornes_jouables.length, "every card goes on every playable border");
    assert.deepEqual(jsonView({ ...state, over: true }, 0).bornes_jouables, []);
    assert.equal(view.terminee, false);
    assert.match(view.regles, /3 bornes voisines ou 4 bornes/);
    assert.match(view.regles, /« 7♠ 5 » pose le 7♠ sur la borne 5/, "a simple example of the answer, in the rules");
    // Real JSON: it reads back as the same object, and no string carries a line break.
    const text = formatJson(view);
    assert.deepEqual(JSON.parse(text), view);
    assert.ok(!JSON.stringify(view).includes("\\n"), "no line break inside a value");
    assert.equal(text.split("\n").filter((line) => line.startsWith('  {"borne"')).length, 7, "one border a line");
  });

  it("marks a border with both sides full and nobody able to claim it yet as « pleine »", () => {
    const state = position();
    state.borders[3].sides[0] = parseCards(SPEC, ["1♠", "2♠", "3♦"]);
    state.borders[3].sides[1] = parseCards(SPEC, ["5♥", "6♥", "7♣"]);
    assert.equal(jsonView(state, 0).bornes[3].statut, "pleine");
    assert.equal(jsonView(state, 1).bornes[0].statut, "perdue", "read from the robot's seat, the border you won is lost");
  });

  it("gives an agent the same position as JSON, with exactly the legal moves", () => {
    const state = position();
    const view = machineView(state, 0);
    assert.equal(view.moves.length, legalMoves(state).length);
    assert.ok(view.moves.every((text) => parseInput(text, state, handOrder(state, 0)).move), "each move is typed as « 7♠ 5 », the card named");
    assert.ok(view.moves.every((text) => /^(JK|\d+[♠♥♣♦]) \d$/.test(text)));
    assert.equal(view.legal, undefined, "no second list of moves by the hand's numbers (Sami, 13/10)");
    assert.deepEqual(view.borders[0], { n: 1, mine: ["9♠", "9♥", "9♣"], theirs: [], won: "me" });
    assert.equal(view.borders[1].won, "opponent");
    assert.deepEqual(view.hand.map((entry) => entry.card), handOrder(state, 0).map((card) => formatCard(SPEC, card)));
    assert.equal(view.over, false);
    assert.deepEqual(view.seen, { "♠": "3/10", "♥": "2/10", "♣": "2/10", "♦": "2/10", JK: "1/2" });
    assert.equal(view.board, textView(state, 0), "the screen as text, for an agent to read");
    assert.match(view.rules, /3 bornes voisines ou 4 bornes/, "the rules in one line on the first turn");
  });
});
