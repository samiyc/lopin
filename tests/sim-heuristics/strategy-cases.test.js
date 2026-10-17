import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { valueOf } from "../../src/core/cards.js";
import { formatCard } from "../../src/core/notation.js";
import { createRng } from "../../src/core/random.js";
import { stateAt } from "../../src/replay/core/log.js";
import { BOTS } from "../../src/sim/bots.js";
import { legalMoves } from "../../src/sim/engine/game.js";

/**
 * Sami's reading of three games against Stratège 2.0 (docs/strategie.md,
 * docs/Prompt/replay check prompt.md), as positions replayed from the logs in
 * tests/fixtures/replays/. Each test states what the bot must NOT do there,
 * for its fast core (`strategist`) and for Stratège 2 itself (`lookahead`).
 * Turn numbers are the logs' (the replay player's counter used to read one
 * ahead of them). A case the bot still gets wrong stays `todo`, with the
 * measurement that kept the fix out (docs/strategie.md).
 */
const fixture = (name) => JSON.parse(readFileSync(new URL(`../fixtures/replays/${name}.json`, import.meta.url), "utf8"));
const GAMES = {
  trips: fixture("2026-09-24_11-28-41_sami-vs-stratege_B-3"),
  connector: fixture("2026-09-24_12-05-14_stratege-vs-sami_3-B"),
  joker: fixture("2026-09-24_12-50-13_sami-vs-stratege_3-B"),
};

const MIDDLE = new Set([2, 3, 4]);

/** What each bot plays at `turn` of `log`, as "9♠→5" (border 1-based) plus the move itself. */
function choices(log, turn) {
  const state = stateAt(log, turn);
  const moves = legalMoves(state);
  const core = BOTS.strategist(createRng(1));
  const scored = core.scoreMoves(state, moves);
  const top = [...scored].sort((a, b) => b.gain - a.gain);
  const played = {
    core: top[0].move,
    lookahead: BOTS.lookahead(createRng(1)).choose(state, moves),
  };
  return { state, played, shortlist: top.slice(0, 4).map(({ move }) => move) };
}

const text = (state, move) => `${formatCard(state.spec, move.card)}→${move.border + 1}`;
const mySide = (state, move) => state.borders[move.border].sides[state.current];

/** One test per bot for a position; `todo` names the bots still failing it. */
function caseFor(title, { log, turn, rule, todo = {} }) {
  const position = choices(log, turn);
  describe(title, () => {
    for (const bot of ["core", "lookahead"]) {
      const move = position.played[bot];
      it(`${bot} (joue ${text(position.state, move)})`, { todo: todo[bot] }, () => rule(position.state, move, position));
    }
  });
}

caseFor("11-28, coup 8 — un Brelan en main se joue : 2♥ vers le 2♠ de la borne 5, ou 3♠ vers le 3♣ de la borne 6", {
  log: GAMES.trips,
  turn: 8,
  todo: { core: "trips mesuré : 52,6 % avec connector contre 53,9 % sans, il affaiblit le cœur (docs/strategie.md)", lookahead: "trips mesuré : 52,6 % avec connector contre 53,9 % sans, il affaiblit le cœur (docs/strategie.md)" },
  rule: (state, move) => {
    const side = mySide(state, move);
    const joinsTwin = side.length === 1 && valueOf(state.spec, side[0]) === valueOf(state.spec, move.card);
    assert.ok(joinsTwin, "the move should build a pair on the way to three of a kind");
  },
});

caseFor("11-28, coup 8 — pas de 1 ni de 10 pour ouvrir une borne du milieu", {
  log: GAMES.trips,
  turn: 8,
  todo: { lookahead: "le cœur l'évite, mais les fins de partie simulées choisissent encore un 10 au milieu avec 4 graines sur 10" },
  rule: (state, move) => {
    const value = valueOf(state.spec, move.card);
    const endInMiddle = mySide(state, move).length === 0 && MIDDLE.has(move.border) && (value === 1 || value === state.spec.values);
    assert.ok(!endInMiddle, "an end card (1 or 10) opened a middle border");
  },
});

caseFor("12-05, coup 5 — le 9♠ ne quitte pas le 8♠ de la borne 4", {
  log: GAMES.connector,
  turn: 5,
  rule: (state, move) => {
    const splits = formatCard(state.spec, move.card) === "9♠" && move.border !== 3;
    assert.ok(!splits, "9♠ went to another border than the 8♠");
  },
});

caseFor("12-05, coup 13 — la dernière borne libre reste libre", {
  log: GAMES.connector,
  turn: 13,
  todo: { core: "reserve mesuré neutre (50,3 %) ; au poids essayé il ne change pas ce coup", lookahead: "reserve mesuré neutre (50,3 %) ; au poids essayé il ne change pas ce coup" },
  rule: (state, move) => {
    const empty = state.borders.filter((border) => border.sides[state.current].length === 0).length;
    const closesLast = empty === 1 && mySide(state, move).length === 0;
    assert.ok(!closesLast, "the last free border was opened while other moves existed");
  },
});

caseFor("12-50, coup 10 — pas de 1-1-JK au milieu : 2♦ vers le 2♠ de la borne 1, ou 8♥ vers le 8♣ de la borne 6", {
  log: GAMES.joker,
  turn: 10,
  todo: { core: "ends ne suffit pas à changer ce coup, trips affaiblit le cœur (docs/strategie.md)", lookahead: "ends ne suffit pas à changer ce coup, trips affaiblit le cœur (docs/strategie.md)" },
  rule: (state, move, { shortlist }) => {
    const value = valueOf(state.spec, move.card);
    assert.ok(!(value === 1 && MIDDLE.has(move.border)), "a pair of aces started in the middle");
    const better = shortlist.map((candidate) => text(state, candidate));
    assert.ok(better.includes("2♦→1") || better.includes("8♥→6"), `neither 2♦→1 nor 8♥→6 among ${better.join(", ")}`);
  },
});
