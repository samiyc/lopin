import { DECKS, JOKER_RULES } from "../../config/decks.js";
import { ORDERS } from "../../config/formations.js";
import { createGame } from "../engine/game.js";

/**
 * The trap bench (Sami, 07/10): endgame positions kept whole, so that any core
 * can be judged on them in seconds, on any machine, whatever games they came
 * from. A position is packed down to what decides its end — hands, sides, the
 * order the sides filled, owners, whose turn — under the page's rule
 * (claim-end), the pile empty; unpacking gives back a state the solver and
 * the cores play from.
 */
const RULES = Object.freeze({ spec: DECKS.classique, order: ORDERS.original, jokerRule: JOKER_RULES.colorless, endMode: "claim-end" });

/** `state` (pile empty) as plain data: `{ h, b, c, t, j }`. */
export function packPosition(state) {
  return {
    h: state.hands.map((hand) => [...hand]),
    b: state.borders.map((border) => ({ s: border.sides.map((side) => [...side]), f: border.completedAt.map((at) => (Number.isFinite(at) ? at : null)), o: border.owner })),
    c: state.current,
    t: state.turn,
    j: [...state.jokersPlayed],
  };
}

/** The state `packed` stands for: a game of the page's rule, its pile empty. */
export function unpackPosition(packed) {
  const state = createGame(RULES.spec, { order: RULES.order, jokerRule: RULES.jokerRule, endMode: RULES.endMode, deck: [] });
  state.pile = [];
  state.hands = packed.h.map((hand) => [...hand]);
  state.borders = packed.b.map((border) => ({ sides: border.s.map((side) => [...side]), completedAt: border.f.map((at) => at ?? Infinity), owner: border.o, figures: [null, null] }));
  state.current = packed.c;
  state.turn = packed.t;
  state.jokersPlayed = [...packed.j];
  return state;
}
