# La revue qualité de Lopin (30/10)

> La grille de la semaine du 2/11 (`mcts-commun/docs/feuille-de-route.md` § 2.A), passée sur Lopin le 30/10 au soir,
> à la demande de Sami. Les écarts sont classés comme dans `docs/ecarts-spec-dev-test.md` (17/10) :
> - **P0** : un résultat faux ou une donnée perdue ;
> - **P1** : une information fausse pour le joueur ou le chercheur, ou une erreur à l'usage ;
> - **P2** : un manque qui gêne la suite ;
> - **P3** : à noter.
>
> Les P0 et P1 sont corrigés, les P2 et P3 listés. Les commits sont `5a61233` (la doc, les IHM) et celui de cette page
> (la lib, le code mort, les tests).

## En bref

- **Aucun P0.** Les empreintes notées dans les docs se retrouvent à l'identique : la 1.0 `152e2a9c9d66170c`, la 1.2
  `1d041613cd7bcd8d`, Oracle v1 `c87b8b524dede38b`, `pwl=4` `afcf0cce6dde1a56`, et celle par défaut
  `abf3bc51801c81b4`.
- **Quatre P1 corrigés** : l'en-tête de la page qui débordait, deux libellés faux de l'Ordonnanceur, et la pile de node
  affichée par `npm run cli` pour un robot inconnu.
- **Une copie de la lib retirée** : les gardes de chaleur et de mémoire, des copies conformes de `mcts-commun/machine.js`.
- **Les tests** : 531 tests (524 passent, 7 « todo » voulus), 6 de moins qu'avant la revue : ceux des gardes copiées, que la
  lib teste déjà. La couverture des fichiers chargés est de **96,3 % des
  lignes et 92,5 % des branches**. 86 modules sur 224 ne sont chargés par aucun test, surtout la couche DOM de la page
  et les workers des pools, comme prévu.

## 1. La doc contre le code

**Vérifié par script** (les commandes sont plus bas) :
- chaque fichier cité entre backticks dans `CLAUDE.md`, `README.md` et `docs/` existe. Les exceptions sont des fichiers
  créés à la demande (`data/lab-presets.json`, `data/puzzle-stats.json`), des motifs (`AAAA-MM.jsonl`) et des pages
  d'histoire (`docs/strategie/01-…`, `docs/ismcts-ailleurs/`) ;
- chaque `npm run X` cité existe dans `package.json`. La seule exception, `npm run diagnose`, est une suggestion de
  `docs/cli.md` ;
- `docs/commandes.md` liste chaque script npm (`tests/web-cli/docs.test.js`), et aucun `.md` ne dépasse 800 lignes
  (`tests/web-cli/md-budget.test.js`).

**Écarts** :

| Rang | Écart | Suite |
|---|---|---|
| P1 | La doc de `ismctsSettings` ne citait pas 9 des 35 options acceptées (`candidates`, `diverse`, `rootDiverse`, `trunc`, `simExact`, `margin`, `reuse`, `simCertain`, `omniscient`) | corrigé (`5a61233`) |
| P3 | Le glossaire n'a pas d'entrée pour d'anciennes options : `sample`, `pivot`, `hope`, `rave`, `late`, `early`, `trunc`, `rootDiverse` | listé |
| P3 | CLAUDE.md (598 lignes sur 600) ne parle ni de `ClaimPile2` ni de `docs/priorites-1.3-suite.md` | à faire en retirant d'autres lignes, avec la version de la line-up |
| P3 | `docs/ismcts-ailleurs/feuille-de-route.md` cite des chemins d'avant la lib (`src/schedule.js`, `node/machine.js`, `bin/backlog.js`) | c'est son histoire, laissé tel quel |

**Les IHM** (sur un serveur de test, port 4743, avec des fichiers à part) : les six onglets, une partie, le Labo, un
replay jusqu'au bout, le menu Versions, les Règles et `npm run cli`. Aucune erreur de console, et tous les liens
répondent.

| Rang | Écart | Suite |
|---|---|---|
| P1 | Entre 900 et ~1 030 px, l'en-tête débordait de 8 px sur les onglets qui défilent : une barre horizontale, « 4 couleurs » au-delà du bord et « Versions ▾ » sur deux lignes | corrigé : la barre passe à la ligne |
| P1 | L'Ordonnanceur citait `--fifo` et « npm run backlog » comme file de nuit | corrigé : « premier entré, premier servi », `mcts-backlog` |
| P1 | `npm run cli -- --bot basic` affichait la pile de node | corrigé : une ligne, code 1 |
| P2 | L'Ordonnanceur simule une nuit de l'ancienne file, qui s'arrête quand il n'y a plus de jobs, et pas le lanceur permanent (`--stay`, 30/10) | listé : l'outil de comparaison marche toujours |

## 2. Le code contre les tests

`npm run test:coverage`, sous `mcts-backlog --slot 4`, avant le retrait des copies : 537 tests, 530 passent, 0 échec, 7 « todo ». Ces 7 sont les cas
de stratégie de Sami que les duels ont refusés, chacun avec sa raison
(`tests/sim-heuristics/strategy-cases.test.js`).

**Moins de 80 % des lignes**, parmi les fichiers chargés :

| Lignes | Fichier | Rang |
|---|---|---|
| 36,7 % | `src/report/rules-stats.js` | P3 : le bloc des règles, vérifié par `assertNarrative` au build |
| 48,0 % | `scripts/lib/cli/pool.js` | P3 : le pool de workers, exercé par chaque script |
| 58,0 % | `src/sim/puzzles/traps.js` | P2, corrigé le 30/10 : `trapOf` testé sur un puzzle résolu (95,0 %) |
| 60,0 % | `src/report/format.js` | P3 |
| 61,0 % | `scripts/lib/domain/example-positions.js` | P3 |
| 61,5 % | `src/report/html/markup.js` | P3 |
| 63,6 % | `src/irl/analysis.js` | P2, corrigé le 30/10 : `tallyEssais` testé, avec les notes du domaine de CLAUDE.md (100 %) |
| 66,3 % | `web/app/lab/lab-text.js` | P3 |
| 66,7 % / 76,2 % | `src/sim/heuristics/end-joker.js`, `end-urgency.js` | P3 : des cœurs écartés |
| 78,6 % | `web/app/replays/runner.js` | P2 : les parties comme la page les joue |

**Jamais chargés par un test** (86 sur 224) :
- **voulu** :
  - la couche DOM de la page (`web/app/**` hors des modules purs) : « la page reste mince », ce qui décide est pur et
    testé ;
  - les 24 workers des pools (`scripts/lib/workers/`) ;
  - le rendu du rapport (`src/report/ascii/`, `html/`), gardé par `assertNarrative` au build ;
- **P2, de la logique sans test** :
  - `src/sim/eval/immediate.js` : les puzzles « gain immédiat ». Corrigé le 30/10 : `winsAtOnce` est testé sur chaque
    puzzle, et ne trouve que ses solutions parmi tous les coups (100 %) ;
  - `src/replay/oracle/joker-features.js` ;
  - `src/report/analysis.js` et `data.js` : seulement gardés au build ;
- **P3** : `scripts/lib/domain/` (`elo-data.js`, `game-filters.js`, `game-index.js`, `oracle-cores.js`, …), exercés
  par leurs commandes.

**Après les tests du 30/10 au soir** (Sami : « ajoute les tests aujourd'hui ») : 537 tests, 530 passent, 0 échec,
7 « todo » ; 96,8 % des lignes et 92,5 % des branches. Les nouveaux tests sont dans `tests/sim-engine/immediate.test.js`
(`winsAtOnce`), `tests/sim-engine/traps.test.js` (`trapOf`) et `tests/core/irl.test.js` (`tallyEssais` : 140 colonnes,
28,6 % de suites couleur, 89,8 % de l'optimum exact, tous les jokers dans des brelans).

## 3. Le lint

Un seul `eslint-disable` dans le dépôt, avec sa raison (`scripts/changelog.js` : git est cherché dans le PATH, comme
npm). Les tests sont seulement exemptés des limites de longueur (`eslint.config.js`). Rien à corriger.

## 4. Le code mort

Sur 873 exports de `src/`, `web/` et `scripts/` :
- **2 n'étaient importés nulle part** : `FORMATION_SHORT` (`src/config/formations.js`) et la ré-exportation de
  `FINISHED` (`scripts/lib/domain/backlog-files.js`). Ils sont retirés ;
- **46 ne servent que dans leur fichier** (P3) : des constantes de réglage (`INFER`, `PONDER`, `LOOKAHEAD`, …)
  exportées pour être lues. Laissés ;
- **56 ne servent qu'aux tests** (P3) : souvent un morceau pur testé seul (`isPivot`, `widenOffset`, `dealShares`…).
  Les gardes de `machine.js` étaient de ceux-là ; elles sont passées à la lib (point 5).

## 5. La lib

| Rang | Écart | Suite |
|---|---|---|
| P2 | `scripts/lib/cli/machine.js` (la chaleur du CPU) et `watchMemory` / `memoryFloorGb` de `scripts/lib/domain/job-log.js` étaient des copies conformes de `mcts-commun/machine.js`, qui lit aussi les noms `LOPIN_*` | corrigé : `npm run job` et `scripts/archive/thread-bench.js` importent `mcts-commun/machine.js` ; la copie et ses tests sont retirés (la lib a les siens, `tests/backlog.test.js`) |

Ce que Lopin prend déjà à la lib : l'ordre de la file (`src/schedule/order.js` reprend `schedule`), `progress()` (`trace.js`)
dans les jobs, `mcts-backlog` pour la file et les créneaux. `docs/projets.md` de commun (ligne lopin) : Node 24,
`node --test "tests/**/*.js"`, sans mondes communs ni A*. Il ne demande rien de plus.

## 6. Les mesures

- **Les duels** : chaque partie est semée et rejouable (les replays ont leur graine, `--offset K`). `npm run versus`
  donne l'intervalle de Wilson apparié. Les versions se jugent sur la borne basse.
- **Les bancs hors ligne** gardent leurs positions (`tmp/*.jsonl`, une ligne par unité) et leurs graines (1 à 12 pour
  les donnes, `scripts/lib/domain/claim-end-deals.js` ; 1 à 3 pour les moteurs du banc `ClaimPile2`).
- **P3 corrigé** : le banc `ClaimPile2` (`scripts/archive/claim-pile.js --summary`) donnait des moyennes sans
  intervalle. Il imprime maintenant l'écart à la 1.2 position par position, avec son intervalle à 95 % :
  +21,0 points (+13,2 à +28,8), et sur les témoins +0,7 (−0,3 à +1,7). C'est noté dans
  `docs/priorites-1.3-suite.md` § 16.
- **P3** : `scripts/archive/sure-lost.js` et `sure-lost-moves.js` (§ 15) donnent des parts sans intervalle ; leurs
  effectifs (166, 86, 76) sont dans le texte.

## Les commandes de la revue

Les scripts de la revue sont restés hors du dépôt (« on n'ajoute pas d'outil »). Pour la refaire :
- `npm run test:coverage`, sous `npx mcts-backlog --slot 4 --id lopin-couverture --` si la file tourne ;
- `npm run fingerprint` et les empreintes ci-dessus, chacune avec sa commande (`CLAUDE.md`, `docs/labo.md`) ;
- une recherche des fichiers et des `npm run` cités dans les `.md`, puis des exports que personne n'importe, avec
  `grep -rn` ou un court script Node.

## Les suites du 31/10 (Sami : « ok pour 1 à 5 »)

Cinq idées venues des messages de commun du 30-31/10, chacune essayée sur Lopin.

1. **Des planchers de couverture** : `npm run test:coverage` échoue sous 95 % des lignes, 90 % des branches ou
   90 % des fonctions (`COVERAGE_FLOORS`, `scripts/test.js`). Les tests sont exclus du calcul. Lopin est à
   96,7 / 92,5 / 93,8 % (537 tests, 0 échec, sous `--slot 4`, 3 min 15). Commun a les siens à 95 / 85 / 88.
2. **`--min-threads`** : `npm run backlog` donne à chaque job un `minThreads` de deux tiers de ses fils (12 sur 18,
   `scripts/lib/domain/machine-job.js`, testé). Quand il manque des fils, le job part sur ceux qui sont libres au
   lieu d'attendre, et son pool lit `MCTS_THREADS`. Un duel dure alors au plus une fois et demie plus longtemps, sous
   sa limite de 2 h. Un job peut garder ses fils fixes avec `minThreads` égal à `threads`.
3. **Le SPRT** (`sprt`, `mcts-commun/measure.js`), rejoué sur les 22 duels de `data/versus.json`, paire après paire
   dans l'ordre où elles ont été jouées. h0 vaut 50 %, et h1 vaut 52 % ou 53 % (`scripts/archive/sprt-replay.js`) :

   | h1 | Duels tranchés | D'accord avec la règle des 1 000 parties | Paires épargnées |
   |---|---|---|---|
   | 52 % | 6 sur 22 : stfig6, tree7w, rhtree5w, ExactEnd12 (gain) ; nobonus, lean (non) | 6 sur 6 | 1 886 sur 11 289 (17 %) |
   | 53 % | 11 sur 22 | 10 sur 11 : **tree6w déclaré gagnant à 174 paires (55,5 %)**, fourchette basse finale 49,9 % | plus, mais pas sûr |

   Les autres duels restent indécis jusqu'au bout. C'est le cas de presque toutes les tentatives de la 1.3, qui
   tournent entre 50 et 52 % : la zone où le SPRT ne tranche pas. **Pas adopté** pour les duels de Lopin : à 52 %,
   il épargne 17 % des parties ; à 53 %, il s'est déjà trompé une fois. Le `stopIf` coupe déjà les séries mauvaises,
   sous 47 % après un duel. Le terme est dans le glossaire.
4. **La jeune génération du ramasse-miettes fixée à 64 Mo** (`--min-semi-space-size=64 --max-semi-space-size=64`,
   −10 % chez urgences). Sur Lopin : 1.3@400 contre elle-même, 4 parties, 3 manches de 2 processus normaux et 2 réglés
   côte à côte sous `--slot 4`. Résultat : 17,39 s contre 17,29 s par partie, **−0,6 %** (−1,2, +0,8 et −1,3 % par
   manche, donc du bruit), avec la même empreinte `4f4654f30afd08dc`. **Pas adopté** : Lopin passe son temps à
   calculer, pas à ramasser la mémoire.
5. **Des budgets de travail plutôt que des temps** : un seul test de Lopin chronométrait, le solveur sur une fin à
   8 cartes en moins de 3 s (`tests/sim-engine/endgame.test.js`). Il compte maintenant ses nœuds, 4 096 au plus
   (2 048 le 31/10). Un temps échoue sous la charge de la file ; le nombre de nœuds est le même sur toute machine.
