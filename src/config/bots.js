/**
 * The bot line-up players see: in the web game, the replays and `npm run
 * duel`. Each entry names a bot engine id (`engineFor` in `src/sim/bots.js`).
 *
 * Versioning (Sami, 03/10): two numbers, major.minor — minor for any change
 * of behaviour, major for a new way of thinking. A version only moves once
 * the change is validated (long duels on several deck sets), so the third
 * number a tuned value used to take never served: games saved before it
 * still carry it, always 0, and `shortTag` reads them as the same version.
 * Every replay records `id@version`, so games stay comparable across
 * generations.
 */
export const BOT_LINEUP = Object.freeze({
  basique: Object.freeze({
    engine: "greedy",
    version: "1.0",
    label: "Basique",
    description: "Le meilleur coup immédiat",
    examines: "tous les coups, un seul coup d'avance",
    pace: "instantané",
  }),
  stratege: Object.freeze({
    engine: "lookahead",
    version: "2.1",
    label: "Stratège",
    description: "Il anticipe",
    examines: "4 coups × 16 fins de partie",
    pace: "≈ 0,5 s par coup",
    vsLower: "85 % vs Basique",
  }),
  experimental: Object.freeze({
    // 1.2 (ExactEnd12, 08/10): 1.1 + exact solver at the root when <= 12 cards remain in (hand + pile).
    // 52.7 % (50.5-54.8) over 1 500 games against 1.1 across 4 datasets, strictly above 50% lower-bound.
    // The 1.1 was `ismcts+widen=7+depth=5+core=stfig6@2000`, the 1.0 `V1_ENGINE` below.
    engine: "ismcts+widen=7+depth=5+core=stfig6+exact=12@2000",
    version: "1.2",
    label: "Expérimental",
    description: "Il cherche en arbre",
    examines: "5 coups d'avance, la fin de partie calculée exactement",
    pace: "2 000 itérations (2 à 4 s), et pendant ton tour",
    vsLower: "76 % vs Stratège",
    // In the page: a worker, the engine's 2 000 iterations a move (10 s at most), pondering during the human's turn (web/app/thinker.js).
    think: Object.freeze({ limitMs: 10000, minMs: 400 }),
  }),
  "oracle-light": Object.freeze({
    // Oracle light 1.0 (Sami, 16/10): Oracle3's tree at 10 000 iterations, pwl=3 (56.0 %, 52.0-59.9, over 420 games
    // against the Expérimental 1.2 as a single tree), shared between two trees (`trees=2`), one per worker in the page:
    // the opening's 13.6 s a move on one thread back under 10 s. The two trees are measured by the night duels
    // (LIGHT_DUEL_*_OracleLight-Pwl3-Trees2).
    engine: "ismcts+widen=7+depth=10+core=stfig6+exact=12+pwl=3+trees=2@10000",
    version: "1.0",
    label: "Oracle light",
    description: "L'oracle de l'atelier, allégé",
    examines: "10 coups d'avance, deux arbres de 5 000 itérations",
    pace: "10 000 itérations (2 à 7 s, sur deux fils)",
    think: Object.freeze({ limitMs: 10000, minMs: 400, workers: 2 }),
  }),
});
// Le Borné 1.0 (`borne`, `ismcts+widen=5+depth=5+core=stfig6+exact=12+diverse=2@2000`) left the
// line-up on 11/10: 45.9 % (43.3-48.5) against the 1.2 over 1 000 games. Its replays still read back.

export const BOT_IDS = Object.freeze(Object.keys(BOT_LINEUP));

/**
 * The Expérimental 1.0, the « V1 »: the reference of the oracle base (`npm run
 * shadow`) and of the similarity bench (`npm run banc`, its cache), which a
 * new line-up version does not move. Its own figures were taken at 800.
 */
export const V1_ENGINE = "ismcts+widen=3+depth=5+core=stfig6@800";

/**
 * The versions still shown — in the Elo table and the Stats tab — three at
 * most per bot (Sami, merlin-is-dead): with the human players, ten rows at
 * most. Older versions' games still count in the Elo fit; their engines are
 * in git history.
 */
export const KEPT_VERSIONS = Object.freeze({
  basique: Object.freeze(["1.0"]),
  stratege: Object.freeze(["2.1", "2.0", "1.1"]),
  experimental: Object.freeze(["1.2", "1.1", "1.0"]),
  "oracle-light": Object.freeze(["1.0"]),
});

/** "2.1.0" → "2.1": the version a game saved with three numbers stands for. */
export function shortVersion(version) {
  const parts = String(version).split(".");
  return parts.length === 3 && parts[2] === "0" ? `${parts[0]}.${parts[1]}` : String(version);
}

/** "stratege@2.1.0" → "stratege@2.1"; humans and engine ids ("ismcts…@800") are left as they are. */
export function shortTag(tag) {
  const at = tag.lastIndexOf("@");
  return at < 0 ? tag : `${tag.slice(0, at)}@${shortVersion(tag.slice(at + 1))}`;
}

/** How a logged bot (`{ bot, version }`, the web game's way) is named: "stratege@2.1". */
export const playerTag = (player) => `${player.bot}@${shortVersion(player.version)}`;

/** Is `player` ("Sami", "stratege@2.1") one to show? Humans always are. */
export function isShownPlayer(player) {
  const [id, version] = shortTag(player).split("@");
  return version === undefined || Boolean(KEPT_VERSIONS[id]?.includes(version));
}

export const DEFAULT_OPPONENT = "stratege";

/** "stratege@2.1": how a bot is named in replays. */
export const botTag = (id) => `${id}@${BOT_LINEUP[id].version}`;

export function engineOf(id) {
  if (!(id in BOT_LINEUP)) throw new Error(`Robot inconnu : « ${id} » (connus : ${BOT_IDS.join(", ")})`);
  return BOT_LINEUP[id].engine;
}
