import { SEAT_VARIANTS } from "../config/seats.js";

/**
 * A seat compensation from its id (`peek=1+turns=3`, `hands=7/6`) or its name in `SEAT_VARIANTS` (`Peek1`), PURE:
 * `{ id, peek: { cards, turns, untilClaim, inPlay } | null, handSizes: [first, second] | null }`, or null for none —
 * the printed game. `createGame` takes it as `seat`; a log keeps its id in `rules.seat`.
 */
const KEYS = new Set(["peek", "turns", "claim", "inplay", "hands", "skip"]);

const count = (text, key, id) => {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1) throw new Error(`Compensation « ${id} » : ${key} doit être un entier positif`);
  return value;
};

function fieldsOf(id) {
  const fields = Object.fromEntries(id.split("+").map((part) => part.split("=")));
  for (const key of Object.keys(fields)) if (!KEYS.has(key)) throw new Error(`Compensation inconnue : « ${key} » dans « ${id} »`);
  const peekOnly = ["turns", "claim", "inplay"].filter((key) => key in fields);
  if (peekOnly.length > 0 && !fields.peek) throw new Error(`Compensation « ${id} » : ${peekOnly.join(", ")} sans peek`);
  if (fields.skip && !fields.hands) throw new Error(`Compensation « ${id} » : skip sans hands`);
  return fields;
}

/**
 * `hands=7/6+skip=N`: the first player does not draw after their N-th move, and plays on with one card fewer —
 * the extra card for N turns only. Their N-th move is the one made after `2 (N - 1)` moves (passes aside).
 */
export const skipsDraw = (state, player) => player === 0 && state.seat?.skipDraw === Math.floor(state.turn / 2) + 1;

const peekOf = (fields, id) =>
  fields.peek
    ? Object.freeze({
        cards: count(fields.peek, "peek", id),
        turns: fields.turns ? count(fields.turns, "turns", id) : Infinity,
        untilClaim: fields.claim === "1",
        inPlay: fields.inplay ? count(fields.inplay, "inplay", id) : Infinity,
      })
    : null;

function handSizesOf(fields, id) {
  if (!fields.hands) return null;
  const sizes = fields.hands.split("/").map((size) => count(size, "hands", id));
  if (sizes.length !== 2) throw new Error(`Compensation « ${id} » : hands=a/b, les mains des deux joueurs`);
  return Object.freeze(sizes);
}

export function parseSeat(text) {
  if (!text) return null;
  if (typeof text === "object") return text;
  const id = SEAT_VARIANTS[text]?.id ?? text;
  const fields = fieldsOf(id);
  return Object.freeze({ id, peek: peekOf(fields, id), handSizes: handSizesOf(fields, id), skipDraw: fields.skip ? count(fields.skip, "skip", id) : null });
}
