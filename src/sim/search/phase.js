/**
 * A bot in two phases: one engine until the switch, another after it. The
 * question it answers (02/10): should the start of a game, where the tree
 * cannot see the end, get a richer core, and the end, where the tree decides,
 * a faster core and a deeper tree?
 *
 * The id is `phase:<switch>:<early engine>/<late engine>`, each engine an
 * ordinary id with its own budget:
 *
 *   phase:20:ismcts+core=nb1@t1400/ismcts+core=plain+depth=7@t1400
 *
 * The switch is a turn (`20`: the late engine from turn 20 on, `state.turn`
 * as `LATE_TURN` counts it), or an event of the game, each of which stays true
 * once it has happened:
 * - `border`: a first border is won;
 * - `board`: both players have started all seven borders;
 * - `pileN`: N cards or fewer are left in the pile (`pile10`).
 */
const SWITCHES = Object.freeze({
  border: () => (state) => state.borders.some((border) => border.owner !== null),
  board: () => (state) => state.borders.every((border) => border.sides.every((side) => side.length > 0)),
  pile: (n) => (state) => state.pile.length <= n,
});

/** The test `switch` names: is it the late phase? */
export function switchOf(name) {
  if (/^\d+$/.test(name)) return (state) => state.turn >= Number(name);
  const [, kind, n] = /^([a-z]+)(\d*)$/.exec(name) ?? [];
  if (!Object.hasOwn(SWITCHES, kind ?? "")) throw new Error(`Bascule inconnue : « ${name} »`);
  return SWITCHES[kind](Number(n));
}

/** `{ switchName, early, late }` for a `phase:` id, or null. */
export function phaseSettings(id) {
  const match = /^phase:([^:]+):([^/]+)\/(.+)$/.exec(id);
  if (!match) return null;
  const [, switchName, early, late] = match;
  return { switchName, early, late };
}

/** The two-phase bot, from two engine factories (`engineFor`). */
export const phaseBot = ({ switchName, early, late }) => {
  const isLate = switchOf(switchName);
  return (rng) => {
    const [first, second] = [early(rng), late(rng)];
    const now = (state) => (isLate(state) ? second : first);
    return {
      name: "phase",
      base: first.base,
      scoreMoves: (state, moves, options) => now(state).scoreMoves(state, moves, options),
      choose: (state, moves) => now(state).choose(state, moves),
      pick: (state, moves) => (now(state).pick ? now(state).pick(state, moves) : { move: now(state).choose(state, moves), scored: null }),
    };
  };
};
