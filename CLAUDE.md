# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

Schotten Totten adapted to a classic 52-card deck or a French tarot deck, plus
the statistics that justify the adaptation, and a web game to play it
against bots (`npm run play`). Outputs: an exact /
simulated statistics report (`out/deck-options.{md,html}`, « Deck options »), a printable rules
sheet (`regles/regles.{html,pdf}`, read by the owner's grandmother, so large
type and plain French), and name proposals (`docs/noms.md`). The game is
called **Bornage** (rules sheet `<title>`, masthead, footers, README); the
project folder is **`Lopin n°742`** (7 borders, 42 cards).

The folder name holds a space and a non-ASCII `°`: keep going through
`pathToFileURL` / `fileURLToPath` / `new URL(..., import.meta.url)` for every
path, as the scripts do, and never build a `file://` URL by string
concatenation.

Prose docs are in French, matching how the owner works. Code, comments and
identifiers are English. Node 20.10 on this machine; no Python.

## Commands

```bash
npm run play                  # web game, http://127.0.0.1:4742/ (add ?debug for window.__lopin)
npm run duel -- a b [--long] [--page]  # duel, mirrored decks, stops when clear; quick ≤ 5 min, long ≤ 20;
                              # early rule by default (every Elo line), --page = the page's claim rule, same cost
npm run policy                # rollout policy vs the solver on self-play endgames: the yardstick before a duel
npm run fingerprint -- a,b n  # hash of every move in seeded games: optimisations must keep it
npm run replays               # summary of replays/ + data/replays/
npm run build                 # all statistics → out/ + rules stats box (thread pool, ~3 min)
npm run build:quick           # small samples, for iterating on report layout
node scripts/build.js --reports-only   # re-render reports from out/data.json
npm run pdf                   # headless Edge/Chrome prints regles/regles.html
npm test                      # node --test
npm run lint                  # ESLint 9 + sonarjs, same budget as the Halloween game
npm run check                 # lint + test; run before committing
```

## Layout

```
src/config/   decks.js (decks + joker rules), formations.js (orders),
              simulations.js (what gets played, sample sizes, seed),
              bots.js (the public line-up + versions), rules.js (the sheet's rules)
src/core/     cards, formations (classify, brute-force reference),
              evaluator (O(1) lookup tables), stand-ins (what a joker may
              become), combinatorics (3-card hands), starting-hand, random,
              partition (exact best split of ≤ 21 cards into trios),
              notation ("7♥" ↔ id, shared by logs, real games and the page)
src/sim/      game (rules engine, endMode early|final|claim-end|claim), settle, bots (random, greedy,
              strategist + one-habit and one-idea variants, experimental),
              strategist (Sami's three habits), ideas (his later ideas),
              principles (his rules from reading Stratège 2 replays), the
              ones kept listed in STRATEGIST_IDEAS; lookahead (rollouts: the
              line-up's Stratège 2), experimental (the sandbox),
              potential (the bots'
              estimate), simulate (two-player tallies), solo (Sami's solo test
              protocol, same tally for bots and real games)
src/irl/      cards (reads data/irl/essais.json), analysis (tallies the real
              games, Wilson intervals)
src/report/   data (exact + starting hands), tasks (pool tasks: rows, duels,
              solo), analysis + analysis-play (findings + narrative checks),
              ascii/ + markdown.js, html/ + page/, rules-stats (the rules box)
src/replay/   log (write a game log, replay it frame by frame), summary
web/          index.html, style.css, app/: main (tabs), play (Jouer) + play-game (a new game), viewer +
              panels (Observer, Replays), view + hand (PURE, tested), table
              (DOM), drag (input), runner (games as the page plays them),
              clock (PURE timer, paused out of focus), steps (PURE replay
              player moves), explain, replays-api, dom
data/irl/     essais.json: the 10 real games, transcribed from the photos
data/replays/ kept replays (versioned); replays/ holds the rest (ignored)
tmp/          working files a script can write again (ignored): raw dumps, rebuilt
              benches, exports a report is made from — through tmpFile() (scripts/lib/tmp.js)
scripts/      build.js (+ lib/pool.js, lib/sim-worker.js), pdf.js,
              play-server.js (+ lib/replay-files.js), duel.js, replays.js
```

## Rules that everything follows

- **`data/` is versioned, `tmp/` is not.** A file a script can regenerate goes to
  `tmp/` via `tmpFile()`; `data/` keeps facts and summaries, each under 500 KB
  (`tests/data-budget.test.js`). Never add a `.gitignore` line for one export:
  a 24 MB tree dump landed in `data/` on 10/10 and went into git.
- **No number is typed by hand into a report.** `src/report/data.js` computes,
  `analysis.js` derives findings, renderers only format. A rule change is an
  edit to `src/config/` followed by a rebuild.
- **The prose is checked against the data.** `assertNarrative()` stops the
  build if the numbers stop supporting the verdict the reports tell (colourless
  joker wins, free joker paradox, one-joker-per-player stalls). Change the prose
  and the assertion together.
- **The formation order is a parameter, not a constant.** With wild cards the
  best formation a hand can make depends on the ranking, and the ranking is
  exactly what the study questions.
- **Evaluator tables must match `bestByBruteForce`.** The tests compare them
  cell by cell for every order and both joker kinds. A colourless joker is a
  set of stand-in ids `n .. n + values - 1` that `colorOf` reads as a phantom
  suit; see `stand-ins.js`.
- **Randomness is seeded**, and pool tasks carry their own seed derived from the
  task index, so `out/data.json` does not depend on thread scheduling.
- **The HTML report works over `file://`.** Its script is inlined as a classic
  `<script>` with the data inlined as JSON; `src/report/page/*.js` is linted as
  a browser script. `out/artifact/deck-options.html` is the same page without
  the doctype/html/head/body skeleton, for publishing as an Artifact.
- **The reference bot is `strategist`** (`REFERENCE_BOT` in
  `src/config/simulations.js`), version 1.2: the three habits plus the
  `middle`, `spread` and `connector` ideas (`STRATEGIST_IDEAS`). Earlier
  generations stay as engines for the report (`strategist:habits` = 1.0,
  `strategist:1.1`). **The line-up's Stratège is 2.1**, engine `lookahead`:
  the 1.2 shortlists 4 moves, each is played out 16 times on random deals of
  the unseen cards, and a candidate scores its won share plus `prior` (0.3)
  times its core score. Deals and the rollout policy are re-seeded from the
  turn at every scoring, so a position always scores the same — a policy
  that kept its own rng made `choose` disagree with `scoreMoves`. It thinks
  ~0.4 s a move, far too slow for the build, so the report keeps the core and
  the replay advisor too; `greedy` is still played on
  `PREVIOUS_BOT_ROWS` so the report shows old and new. Changing the reference
  bot moves every resemblance figure: rerun the build and let
  `assertNarrative` say which sentence no longer holds (it caught two).
- **The engine runs in Node and in the browser.** `src/core`, `src/sim`,
  `src/config` and `src/replay` must not import `node:*` (ESLint enforces it);
  the page imports them directly as ES modules, no build step.
- **The page stays thin.** What decides — the view model (`web/app/view.js`),
  the hand order (`hand.js`) — is pure and tested under Node; the DOM layer
  only draws and listens. Input goes through event delegation (the table is
  redrawn on every change), and only the visible tab may draw on the table.
- **The web game plays the printed claim rule** (`endMode: "claim-end"`,
  `OFFICIAL_RULES`): right after each move the mover, then the opponent, claims
  every border `isClaimable` proves (their side complete, no finish of the other side
  beats it using only cards off the table — their own hand counts as possibly
  the opponent's). A claimed border is closed; the game stops at the first
  victory; unclaimed full borders settle at the end in fill order.
  Settlement lives in `src/sim/settle.js`. `determinize` switches rollouts to
  `final`, since proving claims per simulated move costs speed. It can change
  the winner vs `final` (91 % agreement over 1000 games), so tests written
  against a full 42-card game pin `endMode: "final"`; old replays keep theirs.
  The view shows claimed entries (`claimedAt`, the move that proved them) at
  once and reveals only the end-settled ones (`settledAtEnd`) one by one.
  `endMode: "claim"` (claimed at the start of the claimer's next turn, a move
  late) is the rule of 30/09, kept only so those replays read back;
  `tests/fixtures/replays/claim-start-of-turn.json` holds one.
- **Bots have names and versions** (`src/config/bots.js`). Any change of
  behaviour bumps the version; replays record `id@version`. New ideas go into
  `src/sim/experimental.js` or `src/sim/ideas.js` first and are measured with
  `npm run duel` (which also takes engine ids such as `idea:counter`). Every bot
  exposes `scoreMoves` (logged as its best candidates); `{ keepAll: true }`
  keeps the moves it refuses, marked `refused`, so the replay advisor can find a
  human's joker played off a pair instead of crashing on it.
- **Drag and drop never trusts `dataTransfer`.** The dragged card lives in
  `drag.js` as `{ index, card }`, cleared on dragend and on every new or
  abandoned game, and `play.js` re-locates the card before playing it. Reading
  the index back from `dataTransfer` played the wrong card: any foreign drop
  carries text too, and `Number("")` is 0.
- **Sami's strategy cases are tests** (`tests/strategy-cases.test.js`):
  positions replayed with `stateAt(log, turn)` from `tests/fixtures/replays/`,
  each asserting what the core and Stratège 2 must NOT play. A rule that lost
  in duels stays `todo` with its number; `docs/strategie.md` is the ledger.
  Turn numbers are the logs' (the player's counter now matches them).
- **Time budget: a whole task in under 30 min** (`docs/validation.md`). Sort
  ideas with the quick duel profile (on the core when possible), run `--long`
  once for a version, rebuild the report only when `strategist` changes its
  moves. Speed work must keep `npm run fingerprint` unchanged.
- **Tree budgets by time of day** (Sami, 03/10): daytime tests of a tree
  engine run at **400 iterations at most** unless Sami asks otherwise; **800 is
  for validation**, and those duels and simulations go to the night backlog
  (`data/backlog.json`, `"status": "scheduled"`). Core-against-core duels take
  seconds and are not concerned. Night jobs stay under 2 h each.
- **Threads** (Sami, 07/10): every pool takes `workerCount()`
  (`scripts/lib/pool.js`) — half the logical cores up to 6, every core but 3
  above, **18 at most**, day and night, so the PC stays usable.
  `LOPIN_THREADS=N` or `--threads N` forces a count, `max` takes every core but
  one (to go faster, or on a server). No pause jobs between heavy jobs any more
  (the 15-minute `cooldown` is gone).
- **A 400 screen rejects, it never promotes** (Sami, 03/10): three 10-minute
  screens promoted ideas that did not hold (stay 0.4 at 58.3 %, connector from
  turn 15 at 54.5 %, stay4e10 at 55.4 % — 48.5 % and 50.6 % once measured
  properly). A version is decided on **4 deck sets of long duels**
  (`--long --games 125 --page --offset 0` to `3`, 1 000 games), pooled over
  the deck pairs with `npm run versus`, the lower bound above 50 %. **Since
  04/10 the lab plays at 2 000 iterations** (Sami: the core got faster), both
  sides: `…stfig6@2000` was the V1 to beat; the 1.0's own figures stay at 800. **Since 08/10
  the Expérimental 1.2 (`ismcts+widen=7+depth=5+core=stfig6+exact=12@2000`, ExactEnd12: the 1.1 plus
  the exact solver at the root up to 12 cards) is the version to beat** (the 1.1, Tree-7w, was until then); the 1.0 stays the reference of the oracle base and the banc (`V1_ENGINE`). Before spending those, ask the
  oracle: `npm run oracle -- --disagree <core>` says which of the two cores'
  favourites it plays where they differ, `--summary --core <core>` whether the
  oracle's move entered the core's top 8 (stfig6: 54 % → 66 %).
  `npm run oracle -- --bench <core>,<core>…` lines that up for every core with
  long duels: on the 03/10 cores the top-8 agreement ranked them as the duels
  did (rank correlation 0.93). Its positions are turns 14-26 only, so it is
  blind to an idea that acts earlier (stay4e10).
- **The shared vocabulary is `docs/glossaire.md`** (Sami, 05/10): how the tree
  uses the core, the validation steps (`VALIDATE_CORE` / `_BANC` / `_SHRT` /
  `_LONG`, « 1k@2k »), and how versions under test are named — by what they
  change, in CamelCase, no version number (`B1Lite1`, `DistOracle1Root`,
  `NoConnector`). Validation jobs run as a group are named with fixed-width
  columns on the left and the version on the right
  (`VALIDATE_LONG_1_B1Lite1`, `@` for an empty column); never rename a job the
  runner has started, it looks it up by id when it ends. Use those words in
  replies, and add a term there before using a new one.
- **Every npm script is listed in `docs/commandes.md`** (French, by use, with the
  path of an idea); `tests/docs.test.js` fails when a script of `package.json`
  is missing from it, so a new script comes with its line there.
- **The similarity bench** (`npm run banc`, Sami, 04/10): an idea is sorted in under
  10 minutes by how close its moves come to the oracle's on the bench's
  positions (each searched twice by the oracle, its 12 most visited moves kept),
  paired against the 1.0; `--queue` then sends its four long duels to the
  backlog, which decide. Whether the bench ranks versions as the duels do is
  `npm run banc -- --calibrate`. It answered no on 04/10 (rank correlation 0.32
  over 13 versions, 0.61 on turns 4-10; it does not tell the 0.9 from the 1.0):
  its verdict is a hint, never a filter, and an idea still goes to a tree screen.
- **The oracle is frozen as version 1** (`ORACLE.version`, written into every
  line it produces): its games and opinions are the reference for the V1 and
  later. A speed-up keeps the version only if its fingerprint is unchanged
  (`npm run fingerprint -- "ismcts+candidates=99+widen=6+depth=5+smart=1@300,greedy" 6`
  → `c87b8b524dede38b`, 03/10);
  anything that changes a move (a bug fixed, an idea) raises it, and the
  reference is relabelled.
- **Equal iterations or equal time** (Sami, 03/10): measure first what a
  variant costs per iteration against the 1.0. Over about 3 %, duel it at
  equal time (`@tMS`; at ~1 000 iterations a second, `@400` ≈ `@t400`), since in
  a real game the clock decides; otherwise at equal iterations, which are
  reproducible and load-free. **Never trust a single-thread speed bench for an
  adjusted budget** (05/10): B1Lite1 was 31 % faster on the bench and 10 % faster
  in an 18-thread duel, so its 2 620-against-2 000 screen (55.8 %) was a gift and
  its equal-time long duels lost (47.0 %). Duel speed variants at `@t` on both
  sides, or check the iterations per move in a first duel's replays (the
  candidates' visits). Each of the 0.9's bonuses costs 5-14 % an
  iteration, all six 25 %. A profile (`node --cpu-prof`) often finds the cost
  is code, not idea: stfig cost 24.5 % through `shapeOf`, 2 % once
  `keepsFigure` read the side in place with the same moves.
- **The experimental bot searches deeper** (`src/sim/search.js`): 8 candidates,
  successive halving on common deals, early stop on a clear leader; a rollout
  budget in Node (`experimental:N`), a clock in the page. There it runs in a
  worker (`web/app/think-worker.js` via `thinker.js`, where the page's tree bots
  run too, without pondering) and, this flat search only, ponders during the
  human's turn (`src/sim/ponder.js`): it searches its reply averaged over the
  human's possible moves (guessing their exact move fails: it names a card the
  bot cannot see), then warm-starts the real search and credits half the time.
  Only the flat search reads that head start (`bot.warms`): an ISMCTS does not
  ponder (16/10: crediting its time cut the page's 1.2 to 1 178 of its 2 000
  iterations after 20 s of human thought). **The Oracle light 1.0**
  (`oracle-light`, 16/10) is an ensemble (`+trees=2`) searched one tree per
  worker (`think.workers`, `part` in `createEnsemble`), the scores added up by
  `web/app/think-join.js` as in Node, so it plays the duels' moves
  (`tests/think-join.test.js`); the Observer goes through the same thinkers.
- **Certainties are theorems** (`src/sim/certainty.js`): a border is `won` /
  `lost` for a player when no finish of the other side (enumerated over every
  card they cannot see) changes it. Tested over whole games. The experimental
  core uses them (`certain`: a move onto a lost border is worth the card
  thrown away) and its search prunes on them (`prune`). `npm run selfplay`
  (20 min max, `selfplay/`, ignored) and `npm run mine` measure the patterns.
- **Elo** (`src/replay/elo.js`, pure): Bradley-Terry fitted on human replays
  and `data/elo-duels.json` together, anchored on Basique = 500, one virtual
  draw per player against the anchor so a lone win stays finite. Served by
  `/api/elo` (`scripts/lib/elo-data.js`) and shown in the Stats tab, beside
  `/api/stats` (`src/replay/stats.js`, pure: record per opponent, formation
  shares of won borders);
  `npm run elo -- --duels` refreshes the duel lines it has engines for.
- **Speed (0.7)**: `npm run bench` searches the 20 hardest endgame puzzles
  and 12 mid-game positions, several seeds, medians. Rollouts are 93 % the
  strategist core; `potential.js` now counts unseen cards in a flat array (in
  deck order: the float sums downstream depend on it), caches the valuer per
  evaluator, skips the paired card by index and keys its memo by number;
  `bots.js` builds `boardCards` without `flat()` and keeps `withoutCard` views
  in their own Map. ×1.8 on the experimental bot, every fingerprint identical.
- **Expérimental 0.9 is the 0.8's ISMCTS, narrower and deeper**
  (`ismcts+widen=3+depth=5@800`): 3 replies a node instead of 4 buys 5 plies
  instead of 3 at the same speed; 55.3 % (50.7-59.9) over 432 games at equal
  time. Narrower (2 replies), RAVE, exact solving from the empty pile and ×4
  budgets on turning points all failed (`docs/strategie.md`).
- **Expérimental 0.8 is an ISMCTS** (`src/sim/ismcts.js`, lineup engine
  `ismcts@800`): every iteration deals the unseen cards, walks a 3-ply tree
  (UCB1 on availability, the core's shortlist), then rolls out with the 0.7
  policy. `createIsmcts` has `createSearch`'s interface, so the worker and
  pondering run it unchanged. It beat the 0.7 only once both had 800
  rollouts (56.3 %, 51.2-62.7 over two runs, `--offset 1`); at 400 it was
  49 %. The `experimental` engine id is still the 0.7 search (bench, policy,
  duels); `experimental:0.7` names it explicitly.
- **Engine ids stack**: `experimental+sample=0.05+prior=0.15`, `@N` budgets
  (`@t1400`: 1.4 s a move, for variants of unequal speed), `ismcts+depth=2`;
  `--hands weak|strong` deals only such starting hands (`src/sim/hand-classes.js`).
- **Kept bot games restart from any turn** (`src/replay/`: `bot-games.js`,
  `game-analysis.js`, `branch.js`; `npm run games|branch|error-impact`). Each
  game builds its bots from its own seed (`seatRng`), so a replay from turn T
  gives back the same moves (100 / 100 checked). Judge a change at turn 30
  with the exact solver, and against a `reseed` control: early in a game any
  perturbation reshuffles the rest, so comparing with the kept game measures
  chaos, not the change.
- **The search budget lives in `src/sim/budget.js`** (`+late`/`+early` by
  phase, `+smart` by uncertainty, at equal cost per game, with `usage` to check
  it). Neither beat the 0.9: its limit is what it evaluates, not how much.
- **A screen only names a candidate.** Six variants screened on the same 144
  games produced 57-60 % winners that fell to 49 % on fresh decks: confirm with
  `--long --offset 1` before believing it.
- **Failed attempts are listed, not kept** (`docs/strategie.md`, « Tentatives
  écartées »): their code was removed on 01/10 and lives at commit eb9d1c0.
  Do not reintroduce one without a new reason to expect a different result.
  Screen with `--screen` (10 min), confirm with `--long` (20 min), always
  `--page`; pool two runs with `--offset K` (pair statistics printed).
- **The experimental bot solves small endgames** (0.7, `src/sim/exact.js`):
  pile empty and at most 8 cards, it asks the solver instead of searching,
  root moves in the core's order with `keepAll` (a joker the core refuses may
  be the only win), first win kept. The page's worker goes through
  `bot.solves()`, since it calls `searchFor` itself. The solver key includes
  border owners: under the claim rule a claimed border is closed.
- **Endgames are solved exactly** once the pile is empty (`src/sim/endgame.js`):
  negamax with memory, keyed on the ORDER sides filled (only order matters),
  cut at the first win. ~0.2 s at 8 cards, seconds at 9-10: in the page it
  runs in `solve-worker.js`. `npm run puzzles` keeps self-play endgames won
  through at most half the moves (strong games are rarely delicate: 30 %
  gave 19 of 4 544) into `web/data/puzzles.json`. The table's input is
  routed to the tab on show (`main.js`): play or puzzles.
- **"Gain immédiat" puzzles** (`kind: "immediate"`, `npm run puzzles:immediate`,
  `src/sim/immediate.js`, ids from 201): under `claim-end`, a move that wins at
  once — the borders it proves already make a win, and proofs rest on the
  table alone, so the hidden hand cannot matter. The page
  hides that hand and ends the puzzle on the first move (`puzzle-kinds.js`);
  the bench skips them (the solver cannot see through a pile), and
  `npm run puzzles` keeps them when it rewrites the file.
- **The extension** (Sami, 07/10, `docs/extension.md`): six figures (ids from 100,
  `src/core/figures.js`) join the pile with `createGame`'s `figures`; laying one is
  the turn's move (`figure-moves.js`). **`evaluatorFor(state, border, player)`**
  (`border-rules.js`) is the one place a side is judged under figures; it returns
  `state.evaluator` itself when none is laid, so **the base game must not change by
  a move** — check the 1.0 fingerprint after any change there. Hands, pools and the
  core leave figures out (`handOf`, `withoutFigures`, `unseenCards`). Balance:
  `npm run extension`; the page: `web/app/figure-input.js`.
- **The endgame cores under test** (`src/sim/end-urgency.js`, `withEndgame`): `stfig6ej`
  (`endJoker`, `end-joker.js`: pile empty, a joker priced by its best use elsewhere) and
  `stfig6crit` (`endUrgency`: completion priority, match point, anti-overkill). Neither beat the
  plain core in duels; the 1.2 won with the solver instead. `npm run trap-bench` screens a core on
  the kept endgame traps in seconds, never a verdict.
- **The Valet de Trèfle** (Sami, 08/10 then 10/10) is no longer « the weakest wins »: -10 to the
  sum of its layer's side (`minusTen` in `border-rules.js`), and, pile not empty, an optional
  discard: `{ card, border, discard }` draws two, shuffles the discard back with `state.pileRng`
  (seeded from the game's `seed`, so replays and the worker shuffle alike), and skips the end of
  turn draw. The old key `weakest` is read as `minusTen`; logs of 09/10 where the Valet drew after
  the discard read back through `legacy` (`loggedMove`, `drawsAfter`;
  `tests/fixtures/replays/vclub-drew-after-laying.json`). In the page: `discardMove`
  (`figure-input.js`) — a card of the hand discards, the Valet again on its border lays it alone.
- **Le Borné 1.0** (`borne`, 09/10, **retired from the line-up on 11/10**): `ismcts+widen=5+depth=5+core=stfig6+exact=12+diverse=2@2000`.
  `diverse` (`pickCandidates`, `src/sim/pick.js`) caps the moves a card may take among the
  candidates (`2`, or `lead2`: 2 for the best card, 1 for the others), at the root and, since
  80d5951, in every `shortlist` of the tree. Its 81,2 % against the 1.2 (500 games, 09/10) did not
  hold: the protocol's 1k@2k (`VALIDATE_LONG_1..4_Borne10`, 10/10) gives **45,9 % (43,3 – 48,5)**.
  The 1.2 stays the version to beat. Its replays, duels and Elo lines are kept (hidden by
  `KEPT_VERSIONS`), its hand-typed page is gone; `diverse` stays (every tree goes through `pickCandidates`).
- **The 1.3 roadmap** (11/10, `docs/strategie.md` « Feuille de route 1.3 »): the tree's shape no
  longer pays (diversity, `pw`: 45.9-47.0 %); what is left is the root's **choice** and the **noise**
  of the move played. `+puct=c` (`select` in `ismcts.js`: AlphaZero's exploration term, the prior
  from the core's rank 1 / (k + 1)) and `+trees=k` (`createEnsemble`: the budget shared between k
  seeds, root visits added) are off by default — the 1.0 (`152e2a9c9d66170c`) and the 1.2
  (`"ismcts+widen=7+depth=5+core=stfig6+exact=12@150,greedy" 20` → `1d041613cd7bcd8d`)
  fingerprints did not move. `Budget4000` measures what doubling the budget is worth.
- **The 1.2 read by the oracle** (night of 14/10, `docs/strategie.md`): Oracle2 (`ORACLES[2]`,
  `npm run oracle -- --oracle 2`: the oracle's tree with `core=stfig6+exact=12+widen=7`) scored
  48.1 % against Oracle1 over 108 games, so Oracle1 stays version 1. Oracle1 read the 1.2's
  Budget4000 games (1 642 positions, 851 gaps) and every gap was confirmed by play: the oracle's
  move holds +0.7 ± 2.0 points over the move the 1.2 played, −0.2 ± 2.2 outside the core's top 8.
  **The root's 8 candidates are not the bottleneck**, and the oracle is no stronger judge than the
  1.2; only the top-8 group (ranks 4-8, +3.6 ± 4.7 over 153) is left open. `stopIf` takes
  `atLeast` too, so both branches of a choice can be queued; `--confirm` takes `--out`.
- **The deep oracle** (14/10, `docs/strategie.md`): against the 1.2@2000, the 1.2's own tree at 20 000
  iterations scores 55.7 % and `ismcts+widen=7+depth=10+core=stfig6+exact=12+pw=1@20000` (Depth10Pw) 61.4 %
  (55.1 – 67.8, 140 games), then 52.9 % on new decks: 57.1 % pooled over 280 games (≈ 52.0 – 62.3), the
  first judge stronger than the 1.2, short of the 60 % rule.
  Levels 6-10 are never reached: its gain is `pw` concentrating levels 3-4, not depth. **Each move of a
  tree bot carries `tree` in the replays** (`src/sim/tree-stats.js`: iterations, and per level the nodes,
  those with 0 and 1 visit, the most visits) — the tool to choose a `pw` formula; `npm run tree-stats`
  reads it from kept duels. **Progressive widening is named `+pwl=n`** (Sami, 16/10, `widening.js`): 0 none to 5
  the deepest (7 replies at 16 / 25 / 31 / 36 / 40 visits; the 5th level reached in 20.0 / 28.6 / 40.1 / 55.7 /
  67.6 % of the moves at 2 000); `+pw=k` is obsolete, kept for old engine ids (`pw=1` =
  `pwl=4`, `pw=2` = `pwl=2`, `pw=3` = `pwl=1`, same moves: `afcf0cce6dde1a56` with
  `"ismcts+widen=7+depth=5+core=stfig6+exact=12+pwl=4@150,greedy" 20`). `+pw=k` offers k + √visits replies: at 2 000 iterations no
  formula changes the 1.2's level (`pw=1` 51.1 %, `pw=2` 47.8 %, `Pw3-ExactEnd12` 51.2 % over 1 180 games,
  48.9 – 53.5), only the tree's shape — `k` trades depth for width; at 20 000 `pw=1` pays.
- **From the 1.3 to a playable oracle** (Sami, 15/10, `docs/1.3-to-oracle-shift.md`): the 1.2 is taken as the
  ceiling at 2 000 simulations — no variant passed the 1k@2k against it, only budget pays (Budget4000, Oracle3).
  Oracle3 reread the 1.2 (1 367 gaps confirmed): nothing outside its 8 candidates, +2.5 ± 2.4 points on ranks 4-8.
  `+final=c` (`final-choice.js`) plays the root candidate with the best win rate minus c / √visits instead of the
  most visited (off by default, fingerprints unchanged): noise at 800 (49.8 / 51.7 %); at 2 000 `FinalLcb1`
  (`final=1`) passed the 1k@2k by a hair (52.7 %, 50.1 – 55.3) and fell on its confirmation (50.4, 48.0 %):
  **51.5 % (49.4 – 53.7) over 1 500 games, no 1.3**; `FinalMean` (`final=0`) 51.9 % (49.3 – 54.5). An idea that
  changes how the tree reads its visits is judged at 2 000, never on a 400-800 screen. The **Oracle light**
  (`OracleLight-Pw2` = Oracle3's tree with `pwl=2` at 10 000) beats the 1.2@2000: 54.5 % (50.6 – 58.4) over 420
  games, ~5 s a move a thread; `pwl=3` kept (56.0 %, 52.0 – 59.9), the page's Oracle light 1.0 on two workers. The
  oracles have their own changelog (`npm run changelog -- oracle`, `data/changelog-oracle.json`, Sami 16/10); the
  1.3's stays as it is, its attempts were meant to move the 1.2. **Omniscient 1.0** (16/10): `+omniscient=1` on any
  ISMCTS tree plays every iteration on the true deal (`seeAll`, both hands and the pile seen; off by default,
  fingerprints unchanged) — a judge of the deal, not of the moves (it exploits the pile it sees). At 400 the
  omniscient 1.2 beats the 1.2 73.6 % (62.9 – 84.3); `npm run deals` plays it against itself: the first seat's
  share between omniscients, the decided and the balanced deals. Its solver counts the pile with the hands
  (`exactApplies(state, n, seen)`): 14 cards solve in 10 of 12 positions (3.7 s median). For a hidden pile `exact`
  past 12 is `exact=12` (the pile must be empty, 6 + 6 cards at most), so `exact=14`'s 47.5 % was noise.
- **The double threat** (Sami, 11/10, `src/sim/fork.js`, pure): a threat is an undecided border
  that wins the game (3 adjacent or the majority); `forkValue` is 1 for a threat, ½ for a border
  whose win leaves two threats. The `fork` idea (cores `stfig6fork1/2/4`), the `fork` trap family
  and `npm run puzzles -- --fork` (`kind: "fork"`, ids from 401, always added) read it.
- **A6** (`potential.js`, 11/10): `valuer.best3(a, b)`, a table per evaluator of the best value any
  third card gives a pair, lets `singlePotential` skip pairs that cannot raise its max (with a 1e-9
  margin for float means): every fingerprint unchanged.
- **Open hands** (`openHands` in `createGame`, `--open` in `npm run duel`, the « Mains
  découvertes » box of the page): both hands visible, the pile hidden; `determinize` then deals only
  the pile. Written into the log's rules, so the replay shows both hands.
- **Seat compensations** (16/10, `docs/sieges.md`): `createGame`'s `seat` (`src/sim/seat-rules.js`, named in
  `src/config/seats.js`, off by default) deals other hand sizes or lets the first player look at the top of the pile
  (`src/sim/peek.js`, `state.known`). Bots read a peek — `determinize` keeps the seen cards in place, the core counts
  its next draw as a hand card (`coreCounts`) — and claims never do. Fingerprints unchanged. The second player's edge
  shrinks with skill (same bot both seats, 40 000 deals: Basique 46.1 %, `strategist` 47.2 %, the core 49.2 %; the
  1.2's family 49.3 % in kept duels); `PeekAll` brings the three fast bots to 50 ± 1 %, a whole extra card (+14 points)
  is ten times too much. Measure with `npm run deals -- --engine E --plays 1 --seat X --paired base.json`; the
  kept duels with `npm run seats`.
- **Bornage in a terminal** (`npm run cli`, Sami 12/10, `docs/cli.md`): the base game at the claim
  rule against a line-up bot, a move typed « card border » (« 7h4 », Sami's screen of 14/10: suits
  P H T C, so `c` is carreau, or S H C D with `--gb`; cards right-aligned on 3 characters and a
  fixed-width header up to the exchange; « 3 5 » by hand position still reads). `--machine` keeps the old
  board (`boardText`) so llm-play's prompt does not move. It
  plays through `web/app/runner.js` like the page and writes the same replay to `replays/`. The
  screen and the input are pure (`scripts/lib/cli-view.js`, tested); `--json` (Sami, 13/10) prints
  the state as a real JSON object (`jsonView`: `bornes`, `main`, `bornes_jouables`, no board in a string),
  the format an agent reads; `--machine` is the flat one-line JSON kept for `llm-play`;
  `--new` / `--step` keep the game in a file (the replay itself) so an agent plays one move per
  command. No HTTP API: the command line serves a human and an agent alike.
- **No legal move**: the human passes with « Passer mon tour » (`btn-pass`), shown only then.
- **Puzzle attempts are tracked** (Sami, 07/10, `src/replay/puzzle-attempts.js`):
  `web/app/puzzle-tracker.js` times each attempt with the focus-aware clock and
  POSTs it on close to `/api/puzzles/attempts`, which appends one line to
  `data/puzzle-attempts.jsonl` (in git); `npm run puzzle-stats` reads it back.
  `LOPIN_ATTEMPTS_FILE` points the server elsewhere to try the page without
  touching Sami's data (`PORT=4743` beside his own server).
- **Puzzle ids are stable**: the browser keeps the solved ones and the
  favourites by id. Add puzzles with `--add` (both generators): new ones are
  numbered after the highest id, never renumbering the old (endgames #1-50
  from self-play, #221-270 from duels/ at the claim rule; immediate #201-220,
  #271-290). **On 06/10 Sami kept only his 45 favourites** (`--keep`) and got
  100 endgames like them, #291-390: his favourites have twice the legal
  moves and a strategist move that loses, hence `--min-moves 12 --core-fails`.
  A dropped id is never reused: the browser still counts it as solved. On
  16/10 (Sami nearly through them) more like his favourites joined from #422,
  and the **double turn** (`--pass`, `kind: "pass"`, from #501, after #313: a
  winning move leaves the opponent no legal move, so they pass and the mover
  plays again; `src/sim/double-turn.js`). The core does not know it; the
  solver does (a pass is a move to it), so the 1.2 plays it at 12 cards.
- **Anything that runs a look-ahead bot in the page yields between moves**
  (`generateBotGame` is async): a whole observer game computed in one go
  froze the page for several seconds.
- **The replay player keeps hands in order with `followHands()`** (`hand.js`):
  sorted at the deal, drawn cards appended, a sort applied from the position
  it was asked at. Both hands, via `handOrder` / `topOrder` of `tableView`.
- **The replay list label is `replayLabel()`** in `view.js` (pure, tested),
  fed by `replayHeader()` (borders won, `durationMs`). The second line must
  fit on one line at the sidebar's width; it was measured in the browser.
- **Dialogs are opened through `openDialog()`**, which resets `returnValue`:
  Escape closes a dialog without touching it, so dismissing "Nouvelle partie"
  replayed the previous answer.
- **The page is shown at 125 %** (`--ui-zoom` on `:root`, applied with CSS
  `zoom`), stepping down on narrow windows. Sizes stay in px at 1:1; change the
  factor, not every token.
- **Replays are `lopin-replay/1` JSON** with the full deck order;
  `replayStates` rebuilds a game and rejects illegal moves or wrong draws.
  Human turns may carry `thinkMs` and the result `activeMs` (both optional, so
  older logs stay valid). File names end with the score (`_4-3`, `B` for the
  winner of three adjacent borders), from `scoreTag()`.
  The server writes `replays/` (ignored) and copies kept ones to
  `data/replays/`; it serves only `web/`, `src/`, the rules' fonts and PDF, on
  127.0.0.1. Names go through `scripts/lib/replay-files.js`.
- **The rules sheet has a generated block.** Between `<!-- stats:début -->` and
  `<!-- stats:fin -->` in `regles/regles.html`, `scripts/build.js` writes the
  statistics table (`src/report/rules-stats.js`). Edit the rest of the sheet by
  hand; never that block.
- **Real games are data.** `data/irl/essais.json` is a transcription of 10
  photographed games; its test checks each holds the 42 cards once. The photos
  were not kept (heavy, some carried GPS metadata).
- **The rules sheet ships its fonts** (`regles/fonts/`, OFL). A headless print
  does not wait for Google Fonts: with remote fonts the PDF silently fell back
  to Times. After editing the sheet, check both pages still fit A4 — `.page` is
  `overflow: hidden` in print, so overflow is cut, not flowed.

## Domain notes

- Formations, strongest first in the original: straight flush ("suite
  couleur"), three of a kind ("brelan"), flush ("couleur"), straight
  ("suite"), sum ("somme"). Runs do not wrap (10-1-2 is not a run).
- Ties inside one formation: higher sum wins, then whoever completed first.
- **The wild-card paradox.** In 4×10 + 2 free jokers, under the original order
  a straight flush (208 hands of 11 480) is more common than three of a kind
  (160). Swap them and the two-joker hands become trips: 200 vs 168. No order
  is consistent with rarity (Gadbois 1996).
- **The fix is a colourless joker** (any value, no suit): 32 / 200 / 448 / 1024
  whatever the order, and with the strategist bot the game profile comes back
  to ~95 % of the original's — the most faithful variant tested (6×7: ~93 %,
  tarot: ~86 %; with the greedy bot tarot led, so the ranking of the runners-up
  depends on the bot). In 5 colours it slightly over-feeds trips on 3-card
  hands. The printed sheet no longer mentions tarot.
- **Real games vs bots** (solo protocol): Sami builds far more straight flushes
  than the bots (~29 % vs ~17 %), fewer sums, and reaches ~90 % of the exact
  optimum where the bots reach ~77 %. All his jokers went into trips.
- **How games end at the page's rule** (35 178 kept games of trees @2000+, 16/10):
  never by running out of cards; 48.5 % by three adjacent borders, 51.5 % by
  a majority. The first player wins 48.5 % (46.9 – 50.1 % counted by deal: the
  duels replay 1 951 decks; it depends on skill, `docs/sieges.md`), the gap sitting in majority wins
  (24.9 against 26.9 %); ties broken by first completion settle 0.2 % of
  borders, split evenly (`docs/agents/revue-2026-10-16.md`).
- "One joker per player" leaves a second joker stuck in hand: ~12 % of games
  end without a winner.
- In play, bots build flushes far more than straights even in the original:
  players chase what the order rewards. Games measure resemblance to the
  original, not rarity.
- The simulation resolves a border once both sides are full; it does not model
  early claims by proof. The report states it.
- `1 ** Infinity` is `NaN` in JavaScript: a "known pile" in the solo
  simulation uses a huge finite draw count instead.
