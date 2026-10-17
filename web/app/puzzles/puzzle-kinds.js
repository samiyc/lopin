/**
 * The two kinds of puzzle, and what differs between them. An endgame (the
 * default) has an empty pile and every card known: the page plays it out
 * against the solver. A "gain immédiat" (`kind: "immediate"`, from
 * `npm run puzzles:immediate`) keeps the opponent's hand hidden: one move
 * makes the win certain at the next claim, whatever they hold, and the
 * puzzle ends on that move.
 */
export const isImmediate = (current) => current.kind === "immediate";

/**
 * A "double menace" (`kind: "fork"`, `npm run puzzles -- --fork`, Sami 11/10)
 * is an endgame like the others, played out against the solver; every winning
 * move plays for a border that wins the game or would leave two threats.
 */
export const isFork = (current) => current.kind === "fork";

/**
 * A "double tour" (`kind: "pass"`, `npm run puzzles -- --pass`, Sami 16/10, after #313): a winning move
 * leaves the opponent without a legal move; they pass, and the side to move plays twice in a row.
 */
export const isDoubleTurn = (current) => current.kind === "pass";

const ENDGAME_LABELS = { fork: "double menace, ", pass: "double tour, " };

/** What the title says of the puzzle: "gain immédiat, pioche 12", "double menace, tour 33", "double tour, tour 33" or "tour 33". */
export function kindLabel(current) {
  if (isImmediate(current)) return `gain immédiat, pioche ${current.cardsLeft}`;
  return `${ENDGAME_LABELS[current.kind] ?? ""}tour ${current.turn}`;
}

/** Every legal move with its value for the side to move: 1 for a solution, -1 otherwise. */
export function solutionOf(current, legal, text) {
  const wins = current.solutions.map((solution) => ({ card: solution.split("→")[0], border: Number(solution.split("→")[1]), value: 1 }));
  const others = legal.filter((move) => !current.solutions.includes(text(move)));
  return [...wins, ...others.map((move) => ({ card: text(move).split("→")[0], border: move.border + 1, value: -1 }))];
}

export function openingMessage(current) {
  const count = current.solutions.length;
  const found = `${count} coup${count > 1 ? "s gagnent" : " gagne"} sur ${current.moves}`;
  if (isFork(current)) return `Double menace : joue pour la borne qui te laisse deux façons de gagner — l'adversaire ne peut pas parer les deux (${found}).`;
  if (isDoubleTurn(current)) return `Double tour : trouve le coup qui laisse l'adversaire sans coup possible — il passe, et tu rejoues (${found}).`;
  if (!isImmediate(current)) return `Trouve le coup gagnant : ${found}.`;
  return `Gain immédiat : trouve le coup qui te fait revendiquer la victoire tout de suite, quoi que tienne l'adversaire (${found}).`;
}

export function immediateMessage(slip, helped) {
  if (slip) return slip;
  if (helped) return "Gagné, mais avec de l'aide.";
  return "Résolu ! Ce coup prouve assez de bornes, avec les seules cartes de la table, pour les revendiquer et gagner tout de suite.";
}

export function hintOf(current) {
  if (isImmediate(current)) return "La main adverse et la pioche restent cachées. Une borne se revendique quand tes 3 cartes battent tout ce que l'adversaire pourrait encore y poser, preuve faite avec les seules cartes de la table.";
  if (isFork(current)) return "Comme au Puissance 4 : autour de deux bornes gagnées, chacune des bornes voisines fait trois à la suite. Pioche vide, toutes les cartes sont connues, l'adversaire joue parfaitement.";
  if (isDoubleTurn(current)) return "Regarde où l'adversaire peut encore poser : une borne qu'il pourrait revendiquer ne lui sert que s'il a une carte à y jouer. Pioche vide, toutes les cartes sont connues, l'adversaire joue parfaitement.";
  return "Pioche vide : toutes les cartes sont connues. Joue le camp du bas contre un adversaire parfait.";
}

export const namesOf = (current) => ({ bottom: "Toi (au trait)", top: isImmediate(current) ? "Adversaire — main cachée" : "Adversaire — jeu parfait" });

/** A random order, the puzzles not yet solved first. */
export function randomOrder(list, solved, rng) {
  const indices = list.map((_, i) => i);
  const fresh = rng.shuffle(indices.filter((i) => !solved.has(list[i].id)));
  return [...fresh, ...rng.shuffle(indices.filter((i) => solved.has(list[i].id)))];
}

/**
 * Where a puzzle stands (Sami, 03/10): "playing" until it is over, then
 * "solved", "helped" (won after a slip or a reveal) or "lost".
 */
export function puzzleStatus(result) {
  if (!result) return "playing";
  if (!result.won) return "lost";
  return result.helped ? "helped" : "solved";
}

/** Which buttons stand out, green: "next" once the puzzle is won; "reveal" and "retry" once it is lost. */
export const buttonsFor = (status) => ({ next: status === "solved" || status === "helped", reveal: status === "lost", retry: status === "lost" });

/** The line under the board once a puzzle is over: its text and its colour ("won" or "lost"). */
export function statusLine(status) {
  if (status === "solved") return { text: "Résolu ✓", tone: "won" };
  if (status === "helped") return { text: "Gagné, avec de l'aide", tone: "won" };
  return status === "lost" ? { text: "Perdu — révèle le coup gagnant ou recommence", tone: "lost" } : null;
}

/** The favourites with `id` added, or taken out if it was there. */
export function toggleFavorite(favorites, id) {
  const next = new Set(favorites);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return [...next];
}

/** The order kept to the puzzles that pass `test` — or left whole when none does. */
function keptOr(order, test) {
  const kept = order.filter(test);
  return kept.length > 0 ? kept : order;
}

/** The order kept to the favourites — or left whole when none of them is in it. */
export const favoritesOnly = (order, list, favorites) => keptOr(order, (index) => favorites.has(list[index].id));

/** The order kept to the puzzles not yet solved — or left whole once every one is. */
export const unsolvedOnly = (order, list, solved) => keptOr(order, (index) => !solved.has(list[index].id));

/**
 * How many of `ids` (solved, favourites: kept in the browser) are puzzles of
 * `list`: an id whose puzzle left the file still sits in the browser, and must
 * not count (06/10: 140 solved shown out of 145, 95 of them gone).
 */
export const countIn = (list, ids) => list.filter((puzzle) => ids.has(puzzle.id)).length;
