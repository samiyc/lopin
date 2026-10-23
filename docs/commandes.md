# Les commandes npm

Toutes les commandes du projet (`package.json`), rangées par usage. Les mots (validation courte ou longue, noms des versions et des jobs) sont dans le [glossaire](glossaire.md). Chaque
script décrit ses options en détail dans son en-tête (`scripts/<nom>.js`) ; les
recettes de mesure sont dans [validation.md](validation.md). Un test
(`tests/web-cli/docs.test.js`) échoue si une commande de `package.json` manque ici.

## Où écrire un fichier

- **`data/`** est dans git : les faits et les résumés que lisent les pages et les docs (carnets, `elo-duels.json`,
  `backlog.json`, résultats d'un banc…). Chaque fichier y reste **sous 500 Ko** : `tests/web-cli/data-budget.test.js`
  échoue sinon.
- **`tmp/`** est hors de git, une fois pour toutes : tout ce qu'un script peut réécrire (dumps bruts d'arbres,
  bancs reconstruits, exports dont on tire un rapport). Un script y écrit par `tmpFile("nom.json")`
  (`scripts/lib/domain/tmp.js`), qui crée le dossier ; aucune ligne à ajouter au `.gitignore`.
- Les autres dossiers hors git gardent leur rôle : `replays/`, `selfplay/`, `duels/`, `backlog-runs/`, `oracle/`.

## Le parcours d'une idée

1. **Cœur contre cœur** (quelques secondes) : `npm run duel -- core:<idée> core:stfig6`. Écarte ce qui
   perd nettement ; un gain du cœur seul ne passe pas toujours dans l'arbre.
2. **Le banc de similitude** (moins de 10 min, un indice : sa valeur aux tours 4-10) : `npm run banc -- "ismcts+widen=3+depth=5+core=<idée>@800"`.
   Ses coups jugés par les visites de l'oracle, contre le 1.0 sur les mêmes positions :
   « à pousser », « neutre » ou « à écarter ».
3. **Les duels qui décident** (1 000 parties) : `npm run banc -- <moteur> --queue --against <V1>`, puis
   `npm run backlog` — quatre duels longs de 250 parties, avec la règle d'arrêt. Depuis le 04/10, le labo
   joue à 2 000 itérations. La version à battre est l'Expérimental 1.2 depuis le 08/10
   (`ismcts+widen=7+depth=5+core=stfig6+exact=12@2000`) ; le V1 (`ismcts+widen=3+depth=5+core=stfig6@2000`)
   reste la référence de la base de l'oracle et du banc (`V1_ENGINE`).
4. **Le verdict** : `npm run versus -- <moteur> <moteur du 1.0>` réunit les quatre duels par paires ;
   une version se décide sur une fourchette basse au-dessus de 50 %.

Les identifiants de moteur : un robot de la gamme (`oracle-light`, `experimental`, `stratege`, `basique`), un cœur
seul (`core:<nom>`, les cœurs de `CORES` dans `src/sim/heuristics/experimental.js`), ou un arbre
(`ismcts+widen=3+depth=5+core=<nom>@800` : 800 itérations ; `@t800` : 800 ms par coup).

## Jouer

| Commande | Ce qu'elle fait | Écrit |
| --- | --- | --- |
| `npm run play` | le serveur local du jeu, http://127.0.0.1:4742/ ; sert aussi les pages de `out/` | `replays/` (les parties jouées) |
| `npm run llm-play -- [--games 10] [--model llama3.2] [--host http://127.0.0.1:11434] [--bot experimental] [--seed 50000] [--out duels/agents/llama] [--parallel 8] [--view grid\|list\|json] [--think on\|off] [--examples tmp/llm-examples.json]` | un modèle local (Ollama) joue contre un robot par la console pas à pas, sans agent Claude : il reçoit l'écran et les coups permis, répond `{"coup","raison"}` (schéma JSON : un coup permis, une raison courte ; 3 essais, puis repli noté) ; `--examples` lui montre d'abord des coups commentés ; temps par coup dans `tmp/llm-play.jsonl` ; chaque partie laisse un journal texte à côté de son replay (`<replay>.log.txt` : le JSON de la console, la question, la réponse brute d'Ollama, la commande jouée) | `duels/agents/llama/` (replays et journaux) |
| `npm run llm-examples -- [--count 12] [--puzzles 4] [--oracle oracle/positions.jsonl,oracle/positions-early.jsonl] [--duels duels]` | les exemples de `llm-play --examples` : des choix nets de l'oracle (30 % des visites au moins, 15 points devant le 2e), répartis entre début, milieu et fin, et des puzzles où le coup du cœur perd ; la raison est calculée (traits du coup, part de l'oracle, piège) | `tmp/llm-examples.json` |
| `npm run agent-examples -- [--count 6] [--puzzles 2] [--oracle …] [--duels duels] [--out docs/agents/exemples.md]` | les exemples du dossier des agents (`docs/agents/`) : pour chaque position, le JSON de `--json` (INPUT) et le coup parfait (OUTPUT) — un choix net de l'oracle, ou la victoire prouvée d'un puzzle où le coup du cœur perd ; sans partie complète. Parties à la règle de revendication seulement | `docs/agents/exemples.md` |
| `npm run agents -- [dossier]` | le bilan d'un lot de parties d'agents (`duels/agents/` par défaut) : par joueur, les victoires contre le robot, par siège, par type de victoire, la part des coups avec une raison ; puis les parties gagnées, à diagnostiquer | la sortie |
| `npm run cli -- [--bot experimental] [--first me\|bot] [--seed N] [--name sami] [--json] [--machine]` | le jeu dans la console (`docs/cli.md`) : « 7h4 » (ou « 7h 4 ») pose le 7♥ sur la borne 4, couleurs P H T C (S H C D avec `--gb`) ; « 3 5 », la 3e carte de la main sur la borne 5, est encore lu ; `--json` l'état en vrai JSON (bornes, côtés, main, coups ; le format d'un agent) ; `--machine` une ligne JSON plate, pour `llm-play` ; `--new partie.json` puis `--step partie.json "7h4"` un coup par commande, pour un agent ; `--out <dossier>`, `--why "…"`, `--model <nom>` pour un lot d'agents (`docs/agents/`) | `replays/` ou `--out` |

## Vérifier

| Commande | Ce qu'elle fait | Écrit |
| --- | --- | --- |
| `npm run check` | lint puis tests : avant chaque commit | — |
| `npm run test` | les tests (`node --test tests/`) | — |
| `npm run test:coverage` | les tests avec la couverture du code | — |
| `npm run lint` | ESLint sur tout le projet (limites de complexité, voir `CLAUDE.md`) | — |
| `npm run lint:fix` | ESLint, en corrigeant ce qui peut l'être tout seul | les fichiers corrigés |
| `npm run fingerprint -- <moteur>,<moteur> [parties]` | une empreinte de tous les coups de parties fixes : une optimisation doit la laisser identique. Ex. `npm run fingerprint -- "ismcts+widen=3+depth=5+core=stfig6@150,greedy" 40` | — |

## Mesurer un robot

| Commande | Ce qu'elle fait | Écrit |
| --- | --- | --- |
| `npm run duel -- <A> <B> [--quick \| --screen \| --long] [--games N] [--page] [--offset K] [--save]` | A contre B, chaque donne jouée des deux côtés, avec la fourchette à 95 % par paires ; s'arrête dès que c'est clair. `--page` : la règle du jeu (claim-end) ; `--offset` : d'autres donnes | `duels/` (les parties longues ou à pleine force) |
| `npm run duel:long -- <A> <B>` | le même, profil long (20 min au plus) | `duels/` |
| `npm run tree-stats -- <duels…> \| --last N` | la forme de l'arbre des robots à arbre dans des duels gardés (Sami, 14/10) : par moteur et par niveau, la part des coups qui l'atteignent, les nœuds, ceux à 0 et 1 visite, le plus visité — de quoi choisir une formule de `pw` | la console (lit le `tree` de chaque coup, `src/sim/mcts/tree-stats.js`) |
| `npm run versus -- <A> <B> [--label nom]` | toutes les parties de A contre B gardées dans `duels/`, réunies par paires : score, par siège, par jokers, ce que A joue autrement | `data/versus.json` (avec `--label`) |
| `npm run lab-index` | les duels de `duels/` regroupés par paire de configs (une seule écriture par config : réglages triés, valeurs par défaut ôtées), score et fourchette par paires de donnes, et leurs noms ; le Labo s'en sert pour dire si une config est « déjà mesurée » (environ 25 s) | `data/lab-configs.json` |
| `npm run position -- <replay> <tour> [--engine A]… [--seeds 3]` | la position d'avant le coup `tour` d'un replay cherchée par chaque moteur, sur plusieurs graines (la première est celle que le Labo donnait au robot au trait) : « Rejouer ce coup avec… » en Node ; le Labo la donne toute prête (« Copier les commandes ») | la console |
| `npm run elo [-- --duels]` | le classement Elo des joueurs et de chaque version | — (lit `data/elo-duels.json`) |
| `npm run bench [-- budget seeds moteur]` | l'étalon de la recherche : les puzzles les plus durs, trouvés ou non, en combien d'itérations | — |
| `npm run ab -- <référence> <variante>… [--vs stratege] [--pairs 200]` | plusieurs moteurs contre le même adversaire, sur les mêmes donnes : l'écart de chaque variante | — |
| `npm run core-test -- <moteur> [--from 23] [--games 200]` | un changement de jugement testé à partir d'un tour décisif de parties gardées | `data/core-tests.json` |
| `npm run selfplay -- [moteur] [--minutes N]` | le moteur contre lui-même sur tous les cœurs, 20 min au plus | `selfplay/<moteur>.json` |
| `npm run time-study` | plus de temps de réflexion donne-t-il un meilleur coup ? | — |
| `npm run features -- [--games 40] [--budget 300] [--core v1nc]` | ce que coûte chaque feature du cœur du 1.0 (profil CPU : temps propre par fonction, dans les simulations, à la racine, sur une itération entière) et combien de fois elle agit (éteinte, les mêmes coups notés à nouveau) ; sur une machine au repos | `data/core-features.json` (le changelog le trace) |

## L'oracle et le banc

| Commande | Ce qu'elle fait | Écrit |
| --- | --- | --- |
| `npm run oracle -- [--minutes N] [--turns 15,16 \| 1-30] [--source A,B;C,D] [--out nom] [--runs 1\|2] [--keep 12] [--spread] [--rank cœur]` | l'oracle (un arbre sur tous les coups, 20 000 itérations) sur des positions de parties gardées. Aussi : `--summary`, `--confirm` (ses écarts rejoués jusqu'au tour 30), `--disagree <cœur>`, `--bench <cœur>,…` (le banc du cœur) | `oracle/positions*.jsonl`, `data/oracle-diffs*.json`, `data/oracle-confirm.json`, `data/oracle-bench.json` |
| `npm run banc -- [<moteur>] [--against <moteur>] [--name B1Lite1] [--positions banc \| games] [--turns 1-12] [--threads N\|max] [--queue] [--calibrate]` | le banc de similitude : une version jugée en minutes par les visites de l'oracle sur ses coups, contre le 1.0 sur les mêmes positions. `--positions games` : les coups de l'oracle dans ses parties entières | `data/banc.json`, `oracle/banc-cache.json` |
| `npm run shadow -- [<moteur oracle>] [--engine <V1>]` | le V1 relit les parties de l'oracle : même coup, top 1/3/8 de son cœur, par tranche de tours | `data/oracle-shadow.json` |
| `npm run distill -- [--minutes 15] [--threads N\|max] [--rebuild] [--keys pairDiscount] [--name pair]` | le cœur du 1.0 réglé sur l'oracle : tous ses poids bougent ensemble (SPSA) pour mettre le coup de l'oracle dans son top 8, jugé sur un quart des parties gardé de côté ; le résultat est le cœur `dist1` | `src/sim/heuristics/distilled-core.js`, `data/distill.json`, `oracle/distill-cache.json` |

## Relire les replays

| Commande | Ce qu'elle fait | Écrit |
| --- | --- | --- |
| `npm run replays` | le bilan des parties enregistrées (`replays/`, `data/replays/`), tes coups comparés au Stratège | — |
| `npm run games -- [filtres] [--reindex]` | les parties de robots gardées qui correspondent aux filtres ; `--reindex` reconstruit `duels/index.json` | `duels/index.json` (avec `--reindex`) |
| `npm run branch -- [filtres] [--check \| --force random \| --engine A]` | des parties gardées rejouées à partir d'un tour | — |
| `npm run error-impact -- [--turns 18-29] [--points]` | à quel tour une erreur coûte le plus | `data/error-impact.json` |
| `npm run rules -- [--min 0.7]` | des règles tirées des parties : ce que font plus les gagnants que les perdants | `data/rules-mining.json` |
| `npm run jokers` | où sont allés les jokers, et ce qu'il en est sorti | `data/jokers-mining.json` |
| `npm run weak-wins` | les bornes gagnées avec des cartes faibles : des pièges ? | `data/weak-wins.json` |
| `npm run luck` | était-ce les cartes ? Chaque donne rejouée par des robots | — |
| `npm run pivots` | quand viennent les tournants d'une partie | — |
| `npm run hiding` | l'Expérimental cache-t-il son jeu ? | — |
| `npm run policy` | que vaut le robot qui joue les simulations de la recherche ? | — |
| `npm run deals -- [--deals N] [--plays K \| --root I] [--engine E] [--offset K] [--pool fichier]` | Omniscient 1.0 (`+omniscient=1`, les deux mains et la pioche vues) juge N donnes : l'avantage du premier joueur entre omniscients (la part des règles), les donnes décidées d'avance (la chance), les donnes équilibrées (40-60 %). `--plays K` rejoue chaque donne K fois en entier (K parties par donne) ; `--root I` lit la racine d'une recherche de I itérations au tour 1, 2 graines (quelques coups par donne : 20 donnes en 7 s à 400, mais la racine surestime le premier joueur) ; `--pool` écrit les graines des donnes équilibrées ; `scripts/deals.js`, @400 par défaut. **L'avantage du siège** (`docs/sieges.md`) : `--engine E --plays 1` joue n'importe quel moteur contre lui-même, une partie par donne neuve ; `--seat <id ou nom>` y ajoute une compensation pour le premier joueur (`src/config/seats.js`, `PeekAll`, `peek=1+turns=12`, `hands=7/6`…) ; `--paired fichier` donne son effet contre une course sans elle sur les mêmes donnes (même `--offset`), donne par donne ; `--out fichier` nomme la sortie. Une ligne dit aussi la durée des parties et la part des victoires à la majorité. `--compare a.json[,a2.json] b.json[,b2.json]` ne joue rien : il réunit les courses de chaque côté (des offsets différents) et donne les deux parts du premier joueur et l'effet apparié | `tmp/deals-<offset>[-<compensation>].json` ou `--out`, le fichier de `--pool` |
| `npm run deal-pool -- [--min-games 10] [--band 0.3,0.7] [--with-verdicts] [--duels dossier]` | les pools de donnes disputées tirés des vraies parties (duels gardés d'arbres @2000+, règle de la page) : une donne jouée au moins 10 fois où le premier joueur gagne entre 30 et 70 %, hors donnes des verdicts (offsets 0-3) ; une sur deux dans le pool A, l'autre dans la réserve ; `scripts/deal-pool.js` | `data/deal-pools/pool-a.json`, `reserve.json` |
| `npm run seats -- [--dir dossier] [--group trees\|exact12\|older] [--claims] [--tempo N]` | d'où vient l'avantage du second joueur, lu dans les duels gardés (lecture seule) : la part du premier joueur par phase (finies avant la pioche vide, position au coup 30 selon le solveur, jeu de la fin), par borne (qui l'ouvre, qui complète en dernier, comment elle se décide), les fins de partie (sur quel coup, les passes, un intervalle par donne) ; `--claims` l'ordre des revendications (une minute), `--tempo N` le trait au coup 30 résolu deux fois (une seconde par position) ; `--dir` lit un autre `duels/` (un worktree n'en a que quelques-uns) ; `scripts/seats.js`, `docs/sieges.md` | — |
| `npm run duel -- a b --pool fichier` | le duel sur les donnes d'un pool (`npm run deals -- --pool`), dans l'ordre, des deux côtés ; il s'arrête au bout du pool | comme `npm run duel` |
| `npm run mine -- [fichier d'auto-jeu]` | les parties d'auto-jeu suivent-elles déjà les règles prouvées ? | — |

## Puzzles

| Commande | Ce qu'elle fait | Écrit |
| --- | --- | --- |
| `npm run puzzles -- [--minutes N] [--count 50] [--add] [--source duels] [--min-moves N] [--core-fails] [--unique] [--keep 2,3,…] [--fork] [--pass]` | des fins de partie résolues exactement, gagnées par peu de coups ; `--min-moves`, `--core-fails`, `--unique` choisissent le genre (les favoris de Sami : beaucoup de coups, le coup du cœur perd), `--keep` ne garde que ces numéros ; `--fork` ne garde que les « doubles menaces » (chaque coup gagnant vise une borne décisive ou de fourchette, `src/sim/eval/fork.js`), ajoutées à partir de l'id 401 ; `--pass` les « doubles tours » (un coup gagnant laisse l'adversaire sans coup, il passe et tu rejoues, comme le #313 ; `src/sim/engine/double-turn.js`), à partir de l'id 501 | `web/data/puzzles.json` |
| `npm run puzzle-stats` | tes tentatives de puzzles, puzzle par puzzle, les plus durs d'abord : résolu du premier coup ou non, le temps, les faux pas (et s'ils tombent dans le piège du cœur), « Révéler » | `data/puzzle-stats.json` (lit `data/puzzle-attempts.jsonl`) |
| `npm run traps -- [--minutes 20] [--threads N|max]` | les pièges de fin de partie : les fins de partie des duels gardés, résolues exactement ; là où le joueur au trait gagne mais où le favori du cœur des simulations du 1.1 perd, l'erreur est classée par famille (joker, borne perdue, côté complété, borne ouverte, bonne carte et mauvaise borne…) | `data/traps.json`, `data/traps-list.json` |
| `npm run trap-bench -- [<cœur>] [--build --games N --from S --minutes M]` | le banc de pièges : `--build` tire des parties cœur contre cœur (les fins de partie que jouent les simulations de l'arbre) et garde entières les positions pioche vide où le cœur du 1.1 se trompe, avec leurs coups gagnants, plus des positions saines ; sans `--build`, un cœur y joue : pièges évités par famille, positions saines cassées, en secondes | `tmp/trap-bench.json`, `data/trap-bench-results.json` |
| `npm run puzzles:immediate` | des puzzles de milieu de partie, gagnés tout de suite par revendication | `web/data/puzzles.json` |

## La nuit

| Commande | Ce qu'elle fait | Écrit |
| --- | --- | --- |
| `npm run backlog [-- --list \| --archive \| --fifo \| --threads N\|max]` | les longs traitements de `data/backlog.json`, l'un après l'autre, 2 h au plus chacun. **L'ordre** (Sami, 22/10, `src/schedule/order.js`) : un job attend ses prérequis (`after`, et les duels que lit son `stopIf`) ; un job qui manquerait son échéance (`due`) passe devant s'il peut encore la tenir ; sinon la règle de Smith, le plus de poids par minute (`priority` 1, 2 ou 3, la durée lue dans `estimate`) ; `--fifo` garde l'ordre du fichier ; un job `scheduled` attend son `notBefore`. Par défaut, chaque job prend tous les fils moins 3, 18 au plus (la moitié jusqu'à 6 fils) : le PC reste utilisable, jour et nuit ; `--threads N` en force N, `--threads max` les prend tous moins un. **Le lanceur s'arrête s'il n'y a rien de prêt** : le lancer après l'heure. Un job peut porter un `stopIf` : annulé avant de partir si les duels qu'il nomme, finis, se réunissent sous un seuil (`npm run banc -- --queue` le pose : après un duel sous 47 %, ou deux réunis sous 50 %, la série s'arrête). **La file ne garde que les jobs à venir** : un job fini (done, failed, timeout, skipped) part aussitôt dans `data/backlog-done/`, un fichier par mois ; `--list` montre les 3 derniers finis, puis l'ordre prévu avec les heures si chaque job tient son estimation, et ce qui attend ou est bloqué ; `--archive` range ceux qu'une édition à la main y aurait laissés. **La garde thermique** (22/10) : avec le serveur web de LibreHardwareMonitor, un job est arrêté à 90 °C (deux lectures de suite) et la file repart sous 75 °C ; `LOPIN_HEAT_ALERT=0` la coupe (`docs/ismcts-ailleurs/backlog.md` § 9.8). **La garde mémoire** (23/10) : sous 5 Go de RAM libre deux lectures de suite (toutes les 5 s), le job est arrêté et finit `failed` avec sa raison, la file continue ; `LOPIN_RAM_FLOOR=N` change le seuil, 0 la coupe | `backlog-runs/`, `data/backlog-done/AAAA-MM.json` |
| `npm run job -- [--threads N] [--id nom] "<commande>"` | lance un job à la main, de jour comme de nuit, et l'écrit au **journal de jobs** comme la backlog le fait pour les siens (Sami, 22/10, `scripts/lib/domain/job-log.js`) : le type (duel, versus, oracle, analyse…), les moteurs d'un duel, les fils, les minutes, les parties et les parties par heure, la RAM libre au plus bas. Un job de la backlog peut aussi porter `threads` (son propre `LOPIN_THREADS`) | `data/job-log/AAAA-MM.jsonl`, `backlog-runs/` |

## Pages et documents

| Commande | Ce qu'elle fait | Écrit |
| --- | --- | --- |
| `npm run build` | toutes les statistiques des rapports, à partir de zéro (environ 3 min) ; `--reports-only` refait seulement les pages | `out/data.json`, `out/deck-options.html` |
| `npm run build:quick` | le même, sur de petits échantillons, pour travailler la mise en page | `out/` |
| `npm run changelog -- [1.2]` | le changelog d'une version de l'Expérimental (la page `src/report/changelog/<version>.html`) | `out/changelog-exp-<version>.html` et `out/artifact/` |
| `npm run changelog -- oracle` | le carnet des oracles (Sami, 16/10) : juges, oracle profond, Oracle light, sa place dans la page ; essais dans `data/changelog-oracle.json`, page `src/report/changelog/oracle.html` | `out/changelog-oracle.html` et `out/artifact/` |
| `npm run retrospective` | la rétrospective du robot, archivée | `out/OLD/retrospective.html` |
| `npm run pdf` | les règles en PDF, avec Edge ou Chrome sans fenêtre | `regles/regles.pdf` |
| `npm run extension -- [--games 400] [--engine core:stfig6] [--threads N|max]` | l'extension (`docs/extension.md`) : des parties robot contre robot à la règle de la page, pour huit pioches (sans figure, chaque figure seule, les six) ; pour chaque figure, posée combien et quand, et combien de fois qui la pose gagne la borne et la partie (au-delà de 60 %, trop forte) | `data/extension.json`, `out/extension.html` |
| `npm run bretagne` | une proposition de paquet (« Les 7 Menhirs ») : ses combinaisons énumérées | `out/lore-exploration.json` |
