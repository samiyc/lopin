
# ----------- PROMPT -----------

-je voudrais que tu analyse le projet et que tu compare les docs, le code et les tests, et verifier si il y a des écarts dans les définitions/valeurs associés au même termes.
-Normalement le projet est plutot bien structuré, et bien testé, cependant je voie que certains dossier commence à contenir +15 fichiers et je me demande si il ne serai pas temps d'ajouter des sous dossier
par catégories.
-tu peut rédiger une nouvelle docs ecarts-spec-dev-test.md avec tous les écarts constaté. Dans un deuxième temps on corrigera les écarts.
-recherche le code mort qui ralentirai l'application.
-recherche si il y a de la duplication d'infos entre les différent .md des docs. proposer de réorganiser les md
-idem entre les différents changlogs html

pour ce premier prompts on reste principalement en lecture seul avec un report md a la fin.
dans un deuxième temps on passe à l'action en fonction de la priorité gravité des écarts/bugs trouvé dans l'application.

-long terme le projet doit rester maintenable est utilisable/compréhensible par d'autre utilisateur.
-c'est un répo github public que je compte bien partager avec des chercheurs en ISMCTS.

tu peut lancer plusieur analyse en parallele, jusqu'a 4 fils/threads max, j'utilise de jour le CPU jusqu'a 18threads / 24 pour valider des nouvelles version pour le bot experimental 1.3 ; en terme de budget
temps, pas de limite particulière.

idéalement ne lance pas des duels longs en journée, sur plus de 20-30 min ce sont plutots des taches que je lance dans la backlog la nuit quand le PC est libre. tu peut faire des suggestions d'ajout à la
backlogs si des données te semble obselète/éronné dans les docs/devs/tests.

si tu as besoin de faire des modifications dans le code pour tester des choses, utilise un branche à par de main que l'on mergera à la fin, post vérif/tests.

-j'aimerai aussi avoir ton ressenti par rapport à l'historiques du projet et la roadmap. quel sont les prochaines étapes intéressante que je n'aurais pas encore explorer qui serais un vrai plus pour ce
projet

#----------- REPONSE -----------

  ## 1. Synthèse des écarts Spec / Dev / Test (ecarts-spec-dev-test.md)

  Tous les écarts (avec numéros de lignes et valeurs comparées) sont consignés dans ecarts-spec-dev-test.md, classés de P0 à P3 :

  ### Priorité P0 — Synchronisation Git & Bug logique

  1. Désynchronisation entre main et le worktree .claude/worktrees/sidebar-collapse (priorites-1.3) :
      • La branche main du répertoire principal est au commit a897e37 (16/10 soir) avec backlog.json modifié localement par la fin des 13 jobs de la nuit (terminés ce matin 17/10 à 09h17).
      • Or la branche priorites-1.3 (dans .claude/worktrees/sidebar-collapse, poussée sur origin/priorites-1.3) possède 2 commits d'avance (239e4b7 à 09h47 et 94d9335 à 11h00) qui dépouillent les 13 jobs de
      la nuit, implémentent ReplyFpu (first-play.js) et planifient les 12 jobs de la nuit du 17–18/10.
  2. Bug dans decidedBy (settle.js:20-42) :
      • resolveBorder calcule bien le gagnant avec evaluatorFor (prenant en compte les figures de l'extension), mais decidedBy ignore les figures et compare state.evaluator.formation et state.evaluator.sum
      bruts :
          • Avec V♣ (Dix de moins, -10) ou R♦ (+10), deux côtés de même combinaison et même somme faciale (ex. 18 vs 18, donc 8 vs 18 après malus — cas exact de extension.test.js:36-40) retournent decidedBy:
          "first" au lieu de "sum".
          • Avec V♦ (La Somme), deux combinaisons différentes départagées à la somme retournent "formation" au lieu de "sum".
          • Avec R♠ (Couleur impaire), une couleur impaire battant une couleur paire retourne "sum" au lieu de "formation".



  ### Priorité P1 — Écarts fonctionnels Docs ↔ Code / UI

  • Pondering dans la page web : jouer.md:201-218 affirme que l'Expérimental réfléchit pendant le tour humain, alors que le pondering est désactivé pour tous les moteurs ISMCTS (bots.js:42,
  think-worker.js:17-19).
  • Règle de revendication sur la fiche imprimée : jouer.md:23-25 affirme que la fiche imprimée n'en parle pas, alors que regles.html:288-291 contient l'encadré « Pour les habitués : prendre une borne plus
  tôt ».
  • Nombre de pages de la fiche imprimée : 3 pages dans regles.html:232-362, mais toujours annoncé à 2 pages dans README.md:46, CLAUDE.md:488, sieges.md:238 et le commentaire CSS de regles.html:15.
  • Noms courts des compensations de siège : sieges.md:136-137 documente PeekInPlay24 (24 cartes) et Hand7SkipN, alors que SEAT_VARIANTS ne définit que PeekInPlay20 (20 cartes) et aucune clé Hand7Skip*
  (parseSeat lève une erreur sur PeekInPlay24).
  • Définition contradictoire d'Oracle light dans 1.3-to-oracle-shift.md:88 (pwl=2 à 54,5 % dans le tableau L88 vs pwl=3+trees=2 L24/L122 et dans BOT_LINEUP).
  • Propriété vsLower manquante sur oracle-light dans BOT_LINEUP et omission d'Oracle light 1.0 dans README.md:37, jouer.md:220-226, commandes.md:31 et cli.md:63.

  ### Priorité P2 & P3 — Valeurs obsolètes, données et commentaires

  • Référence à battre restée à la 1.0 dans commandes.md:27 et à la 1.1 dans glossaire.md:255-256.
  • Compteur de puzzles à 145 (2 familles) dans jouer.md:172-180 contre 212 puzzles (4 familles : endgame, immediate, fork, pass) dans puzzles.json.
  • Stratège 1.1 cité dans jouer.md:168-169 au lieu de Stratège 1.2 affiché par replays.js:40-46.
  • Absence de ligne oracle-light@1.0 dans elo-duels.json.
  ──────
  ## 2. Architecture des dossiers (>15 fichiers) : Proposition de découpage

  6 dossiers dépassent aujourd'hui le seuil de 15 fichiers :

  • tests/ : 79 fichiers .test.js
  • src/sim/ : 58 fichiers .js
  • scripts/ : 58 fichiers .js (dont 10 scripts one-shot hors package.json)
  • scripts/lib/ : 39 fichiers .js
  • web/app/ : 30 fichiers .js
  • src/replay/ : 17 fichiers .js

  ### Compatibilité technique (Node, Navigateur sans bundler, ESLint)

  • Serveur Web (play-server.js:15) : sert déjà récursivement tout chemin sous STATIC_PREFIXES = ["web/", "src/", ...]. Aucun bundler n'étant utilisé, le découpage en sous-dossiers fonctionne nativement dès
  lors que les imports relatifs sont mis à jour.
  • ESLint (eslint.config.js:5-64) : les globs utilisent déjà src/**/*.js, scripts/**/*.js, tests/**/*.js, web/**/*.js. Seule la liste explicite de la ligne 62 (web/app/dom.js, etc.) devra être remplacée par
  un glob.
  • Astuce anti-friction : conserver bots.js et game.js à la racine de src/sim/ (ou comme façades de ré-export) évite de modifier ~70 % des imports dans scripts/, tests/ et web/.

  ### Découpage proposé par dossier

   Dossier actuel    │ Sous-dossiers proposés                                                            │ Répartition des fichiers
  ───────────────────┼───────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────
   src/sim/ (58)     │ engine/ (9)eval/ (9)heuristics/ (16)mcts/ (15)search/ (5)puzzles/ (2)+ racine     │ • engine/ : game.js, settle.js, simulate.js, solo.js, border-rules.js, double-turn.js, figure-
                     │ bots.js                                                                           │ moves.js, peek.js, seat-rules.js• eval/ : potential.js, certainty.js, figure-gains.js, hand-
                     │                                                                                   │ classes.js, shapes.js, fork.js, immediate.js, endgame.js, exact.js• heuristics/ : strategist.js,
                     │                                                                                   │ experimental.js, principles.js, ideas.js, oracle-ideas.js, joker-ideas.js, joker-gate.js, gates.js,
                     │                                                                                   │ outbid.js, mined.js, bait.js, suit-budget.js, end-joker.js, end-urgency.js, tuning.js, distill.js•
                     │                                                                                   │ mcts/ : ismcts.js, choice.js, widening.js, rollouts.js, pick.js, budget.js, tree-stats.js, first-
                     │                                                                                   │ play.js, halving.js, common-deals.js, final-choice.js, implicit-minimax.js, fork-cut.js,
                     │                                                                                   │ truncate.js, reuse.js• search/ : lookahead.js, search.js, ponder.js, infer.js, phase.js• puzzles/ :
                     │                                                                                   │ traps.js, trap-bench.js
   src/replay/ (17)  │ core/ (5)stats/ (6)oracle/ (6)                                                    │ • core/ : log.js, bot-games.js, branch.js, game-analysis.js, jokers-held.js• stats/ : elo.js,
                     │                                                                                   │ stats.js, hand-stats.js, summary.js, puzzle-attempts.js, advice.js• oracle/ : oracle.js, banc.js,
                     │                                                                                   │ shadow.js, versus.js, move-features.js, joker-features.js
   web/app/ (30)     │ board/ (7)play/ (6)replays/ (7)puzzles/ (4)workers/ (4)+ main.js, stats.js        │ • board/ : dom.js, table.js, hand.js, drag.js, deck-colors.js, figure-input.js, clock.js• play/ :
                     │                                                                                   │ play.js, play-game.js, play-dialogs.js, play-status.js, premove.js, thinker.js• replays/ :
                     │                                                                                   │ viewer.js, view.js, steps.js, panels.js, explain.js, runner.js, replays-api.js• puzzles/ :
                     │                                                                                   │ puzzles.js, puzzle-controls.js, puzzle-kinds.js, puzzle-tracker.js• workers/ : think-worker.js,
                     │                                                                                   │ think-join.js, advice-worker.js, solve-worker.js
   scripts/lib/ (39) │ workers/ (16)cli/ (4)domain/ (19)                                                 │ • workers/ : les 16 fichiers *-worker.js• cli/ : cli-screen.js, cli-view.js, machine.js, pool.js•
                     │                                                                                   │ domain/ : les 19 modules métier (duel-plan.js, elo-data.js, oracle-confirm.js, seat-tally.js, etc.)
   tests/ (79)       │ core/ (6)sim-engine/ (10)sim-heuristics/ (15)sim-search/ (20)replay/ (15)web-cli/ │ Miroir direct des sous-dossiers de src/ et web/ (node --test tests/ parcourt récursivement les
                     │ (14)                                                                              │ sous-dossiers).
  ──────
  ## 3. Code mort et Ralentissements d'exécution

  ### A. Les 7 ralentissements identifiés au runtime (sans changer l'empreinte fingerprint !)

  1. Recalcul et allocations dans determinize à chaque itération d'ISMCTS (gain estimé : +10 à +18 % de vitesse ISMCTS) :
      • À chaque itération (2 000 à 10 000 fois par coup), determinize rappelle unseenCards(state, player), exécute .entries.flatMap(([card, count]) => Array.from({ length: count }, () => card)) (~35
      allocations de tableaux par itération, soit ~350 000 allocations pour un coup d'Oracle light) et hiddenFigures(state, player) qui filtre les 42 cartes de state.deck même quand state.withFigures ===
      false.
      • Or ctx.state et ctx.player sont invariants pendant toute la recherche d'un coup : précalculer une seule fois baseUnseen dans resolveCtx et copier [...baseUnseen] avant rng.shuffle(unseen) conserve
      strictement la même empreinte tout en supprimant ce coût.
  2. Surcharge du hot path de rollout dans scoreStrategist / ideasContext (gain estimé : +15 à +25 % sur les rollouts) :
      • Appelé ~200 000 fois pour un coup à 10 000 itérations :
          • ideasContext alloue à chaque pli owners: state.borders.map((border) => border.owner) qui n'est jamais lu par stfig6 ni strategist.
          • withEndgame et jokerBonus testent à chaque coup légal une quinzaine de ideas.has(...) pour des idées écartées (endJoker, endUrgency, jokerFull, jokerWait, jokerMid, outbid, bait, mined, etc.).
          • connectorPenalty réévalue mySides.some(...) pour chaque coup légal du pli au lieu de le mémoïser par carte en main.

  3. Allocations inutiles dans placeCard et cloneState pendant les rollouts (gain estimé : +5 à +8 %) :
      • placeCard alloue un nouveau tableau state.lastMoves.map(...) à chaque coup simulé alors qu'aucun bot actif ne lit state.lastMoves.
      • cloneState copie pile: [...state.pile] (immédiatement écrasé par determinize ligne 63) et clone chaque objet de state.resolved (state.resolved.map((entry) => ({ ...entry }))) alors que les rollouts
      ne lisent jamais state.resolved.
  4. **Double lecture disque sans cache des ~133 replays dans statsPage et eloTable** :
      • statsPage() appelle readAllLogs() puis eloTable() qui rappelle readAllLogs() : un clic sur l'onglet « Stats » lit et JSON.parse 266 fichiers JSON depuis le disque et relance 300 itérations de Newton-
      Raphson (fitElo) sans cache mémoire.
  5. **Reconstruction en 𝒪(N²) dans advice-worker.js:13-25** :
      • Appelle stateAt(log, entry.turn) (qui rejoue depuis le tour 1) sur chaque tour humain au lieu d'utiliser replayStates(log) en un seul passage linéaire 𝒪(N).
  6. **Double instanciation de botPlayer dans play-game.js:25-26** :
      • Crée bot: botPlayer(opponent, seed + 1) (jamais lu nulle part) en plus de thinker: createThinker(botPlayer(opponent, seed + 1), ...).
  7. Cascade de ~150 requêtes HTTP non cachées (no-store) au chargement de la page web :
      • main.js:30 instancie solve-worker.js dès l'ouverture de la page (même si l'onglet Puzzles n'est jamais ouvert), et experimental.js:1-205 force le navigateur et chaque worker à télécharger les 20
      modules d'idées rejetées.


  ### B. Inventaire du code mort / expérimental abandonné

  • Dans web/ et src/sim/ : ponder.js et toute la plomberie startPonder/stopPonder de thinker.js et think-worker.js sont inopérantes (bot.warms est undefined sur tous les bots de BOT_LINEUP).
  • Dans src/sim/ : 19 modules d'expériences rejetées (search.js, halving.js, common-deals.js, final-choice.js, implicit-minimax.js, fork-cut.js, truncate.js, infer.js, reuse.js, phase.js, outbid.js, mined.
  js, joker-ideas.js, bait.js, suit-budget.js, end-joker.js, end-urgency.js, distill*.js, tuning.js) et ~105 cœurs inutilisés dans CORES. (À isoler dans un registre d'archive ou sous-dossier
  heuristics/archive/ pour qu'ils ne soient plus chargés par le jeu web tout en gardant la reproductibilité des vieux scripts si besoin).
  • Dans scripts/ : 10 scripts one-shot absents de package.json (analyse-arbres.js, analyse-arbres-1000.js, eval-w6-d5-cap321-2.js, eval-w7-d3-cap321.js, eval-w7-d5-pw1.js, eval-w8-d4-root10-cap2.js,
  couverture-oracle-1000.js, calcul-statistiques.js, compile-stats-1000.js, generate-markdown-tables.js) + scripts/lib/tree-worker.js et scripts/lib/tree-inspector.js.
  • Dans .claude/worktrees/ : 2 copies complètes du dépôt (pw-exactend12-validate et sidebar-collapse), à nettoyer après merge de priorites-1.3.
  ──────
  ## 4. Duplications et réorganisation des .md et des Changelogs .html

  ### A. Fichiers Markdown (.md)

  L'audit des 38 fichiers .md montre 5 grands foyers de duplication :

  1. Règles de base et paradoxe de Gadbois (1996) : répétés dans 8 fichiers (README.md, CLAUDE.md, docs/methode.md, docs/jouer.md, docs/extension.md, docs/agents/regles.md, docs/cli.md, docs/1.3-to-oracle-
  shift.md).
  2. Fonctionnement d'ISMCTS et table des 5 étages de la 1.2 (22,2 % au pli 2, 65,1 % au pli 3) : répétés dans 6 fichiers (docs/priorites-1.3.md, docs/glossaire.md, docs/strategie.md, CLAUDE.md,
  docs/methode.md, docs/analyse-arbre-ismcts.md).
  3. Protocole 1k@2k, tri à 400, 18 fils et stopIf : répétés dans 7 fichiers (CLAUDE.md, docs/validation.md, docs/commandes.md, docs/glossaire.md, docs/cloud.md, et 2 prompts de docs/agents/).
  4. Catalogue des scripts npm run et contrat JSON --machine :
      • validation.md:220-258 duplique presque intégralement la table de commandes.md.
      • regles.md:54-112 copie mot pour mot l'exemple JSON et la table des 12 champs de cli.md:96-160.
  5. Résultats des campagnes 1.2 → 1.3 → Oracle → Sièges : recopiés simultanément dans strategie.md, 1.3-to-oracle-shift.md, priorites-1.3.md, analyse-arbre-ismcts.md, sieges.md, glossaire.md et CLAUDE.md.

  Organisation cible proposée pour un dépôt public destiné aux chercheurs ISMCTS :

  • README.md (vitrine à jour + lien vers un README.en.md académique) et CLAUDE.md allégé (~150 lignes de règles d'ingénierie, sans le journal chronologique des lignes 268–424).
  • docs/ structuré en 6 documents thématiques + reference/ + archive/ :
      1. 01-regles-et-combinatoire.md (règles, Gadbois 1996, claim-end, extension)
      2. 02-architecture-ismcts.md (cœur stfig6, potentiel, arbre ISMCTS, pwl, exact=12, Omniscient 1.0, PeekAll)
      3. 03-protocole-experimental.md (fusion de validation.md et cloud.md, sans la table des commandes)
      4. 04-resultats-et-campagnes.md (synthèse consolidée des campagnes 0.1 → 1.3 → Oracle → Sièges)
      5. 05-journal-de-labo.md (strategie.md conservé comme archive chronologique exhaustive)
      6. reference/ : commandes.md (source unique des scripts), glossaire.md (purgé des longs chapitres théoriques), jouer-et-cli.md (fusion de jouer.md, cli.md, noms.md)
      7. archive/ : docs/Prompt/ (14 prompts bruts) et notes d'étape déjà intégrées (prompt-fable-*, revue-2026-10-16.md).


  ### B. Changelogs HTML (src/report/changelog/ & out/)

  1. Clonage à 99,8 % des templates :
      • 1.1.html (1 375 lignes) et 1.2.html (1 375 lignes) ne diffèrent que sur 2 lignes (<h1> et sous-titre).
      • 1.3.html (1 377 lignes) ne diffère de 1.2.html que sur 4 endroits (titre, sous-titre, 3 lignes sur PUCT/Ensemble, 2 couleurs).
      • Résultat : les 5 sections III à VII (~720 lignes) — Base de référence, Banc de similitude, Coup pour coup Oracle/V1, Arbre du V1, Coût du cœur — sont répétées 3 fois à l'identique dans 1.1, 1.2 et 1.
      3 !
  2. **Sur-injection JSON dans changelog.js:71-88** :
      • Injecte les 16 fichiers JSON globaux et tout backlog-done.json dans chaque HTML : out/changelog-oracle.html pèse 144 Ko dont ~100 Ko de JSON jamais lu par la page.
  3. Doublons out/artifact/ (~1,1 Mo) et pages orphelines (0.6.html, 0.8.html) :
      • out/artifact/ duplique tous les HTML de out/.
      • out/changelog-exp-0.6.html et 0.8.html n'ont pas de source dans src/report/changelog/.
  4. Plan de factorisation : extraire le socle CSS/JS commun (~550 lignes) dans src/report/shared/, ne garder dans chaque changelog que ses sections propres (#reference/#banc/#compare/#cout dans 1.1, #arbre
  dans 1.2, plafond 1.3/bruit dans 1.3, échelle des oracles et sièges dans oracle), et filtrer DATA par version dans scripts/changelog.js.
  ──────
  ## 5. Ressenti sur l'historique, la Roadmap et les Pistes ISMCTS inexplorées

  ### A. Ce que révèlent les runs de cette nuit (16–17/10) et de ce matin

  Le croisement des résultats de la nuit est scientifiquement remarquable :

  • CommonDeals (+crn=1@2000) échoue à 50,7 % (48,2 – 53,2 % sur 1 000 parties) alors que Ensemble2x2000 (+trees=2@4000) réussit à 54,6 % (50,8 – 58,4 % sur 500 parties), faisant jeu égal avec un arbre
  unique de 4 000 itérations (Budget4000 : 54,4 % sur les mêmes donnes).
  • Conclusion théorique majeure : Le gain d'un budget doublé ne vient ni de la profondeur de l'arbre, ni de la variance d'échantillonnage des donnes à la racine (que CommonDeals annulait), mais de la
  réduction du bruit de trajectoire interne d'UCB au pli 2 (l'ordre chaotique dans lequel les ~55 réponses adverses sont ouvertes).
  • Par ailleurs, sur deux arbres de 5 000 (Oracle light), OracleLight-Pwl2-Trees2 (pwl=2) grimpe à 57,9 % contre 53,6 % pour pwl=3 : diviser un budget de 10 000 en deux arbres de 5 000 demande un
  élargissement progressif moins agressif (pwl=2 au lieu de pwl=3).
  • Enfin, ce matin, ReplyFpu1 (+fpu=1@2000, δ = 0, 1) a scoré 53,6 % sur 250 parties (tandis que ReplyFpu0 à δ = 0 perdait à 45,6 %) : c'est le seul candidat à budget égal (2 000 itérations) qui attaque
  directement la dispersion des 22 % de premiers essais au pli 2.

  ### B. Ressenti sur la démarche du projet

  La rigueur méthodologique de Lopin n°742 est exceptionnelle et dépasse largement la moyenne des implémentations académiques de MCTS :

  • Protection contre le winner's curse grâce au protocole séquentiel strict (tri à 400 qui n'a que le droit d'écarter → 1k@2k en donnes miroirs avec IC appariés → confirmation sur offsets 4–5 dès que la
  borne basse frôle 50 %).
  • Garantie déterministe par empreintes (npm run fingerprint) permettant d'empiler 15 leviers expérimentaux et des optimisations ×1, 8 sans altérer un seul coup de la 1.2.
  • Culture de l'autopsie mécaniste : chaque échec (Borné, pw à 2 000, FinalLcb1, CommonDeals) a donné naissance à un outil de mesure (tree-stats, confirmation par le jeu d'Oracle3 jusqu'au solveur exact au
  tour 30, Omniscient 1.0, analyse du siège) qui explique pourquoi l'intuition a échoué.

  ### C. 5 pistes algorithmiques nouvelles et inexplorées pour la suite

  1. RankFpu — First-Play Urgency décroissant selon le rang du cœur au Pli 2 (évolution directe de ReplyFpu1) :
      • Dans first-play.js, tous les coups non essayés d'un nœud reçoivent le même FPU wins / visits - fpu / 10. Or les 7 réponses de la shortlist adverse sont triées par le cœur (rank = 0..6) : la 2e
      réponse du cœur (rank = 1) a beaucoup plus de chances d'être une vraie réfutation tactique que la 7e (rank = 6).
      • Un FPU indexé sur le rang (wins / visits - d0 - d1 * rank) permettrait d'ouvrir rapidement les 2–3 meilleures répliques du cœur tout en bloquant l'ouverture des rangs 4–6 tant que les premières
      réponses tiennent.
  2. Table de transposition par Ensemble d'Information (DAG aux plis 1 à 3 au lieu d'arbre) :
      • Au pli 3 (mon 2e coup), 65,1 % des visites sont des singletons (visits === 1) parce que l'arbre sépare la séquence (mon coup A, réponse adverse R, mon coup B) de (mon coup B, réponse adverse R, mon
      coup A).
      • Or dans Bornage, poser A puis B produit exactement le même plateau que poser B puis A (à l'exception rarissime où une 3e carte est posée au même tour que R sur la même borne). Partager le nœud du pli
      3 via une clé canonique {min(A,B), max(A,B), R} double instantanément la densité de visites au pli 3 à coût CPU nul, sans le biais de RAVE (qui mélangeait tous les plis sans conditionner par la réponse
      R).
  3. Inférence négative dure dans determinize : le filtre de « Non-Victoire Immédiate » (NoMissedWin) :
      • L'inférence statistique douce (infer=48 par softmax du cœur) était trop bruitée. Mais la règle claim-end offre une contrainte logique dure : si l'adversaire n'a pas gagné la partie à son tour
      précédent, alors toute carte non vue c^* qui lui aurait donné un gain immédiat par preuve (immediate.js) au tour précédent n'était presque certainement pas dans sa main !
      • Forcer ces cartes c^* dans la pioche lors de determinize (via dealKnowing de peek.js) ne coûte que quelques microsecondes une seule fois avant la recherche et supprime les réfutations fantômes dans
      l'arbre.
  4. Résolution exacte aux nœuds internes à pioche vide (Tours 27–29) et PIMC exact au Tour 29 :
      • Aux tours 27 à 29 (1 à 3 cartes dans la pioche), la descente dans l'arbre aux plis 2–4 vide la pioche. Or ce sont les tours les plus décisifs de la partie (docs/sieges.md).
      • Plus fort : au tour 29 (1 seule carte dans la pioche, 6 dans la main adverse), il n'existe que **


    ⎛ 7 ⎞
    ⎝ 1 ⎠ = 7

  déterminisations possibles** ! Appeler solveEndgame sur ces 7 mondes en partageant la même table memo (puisque keyOf dans endgame.js ne dépend que des cartes restantes) permettrait de résoudre exactement
  le jeu dès le tour 29 en ~0,4 s.
  5. Passage à Oracle light 1.1 (pwl=2+trees=2) et parallélisme multi-workers (trees=4 ou SharedArrayBuffer) :

  • À court terme : si l'offset 14 confirme cette nuit les 57,9 % de OracleLight-Pwl2-Trees2, basculer oracle-light sur pwl=2+trees=2 (voire proposer un mode trees=4 sur 4 Web Workers pour les machines à 8+
  cœurs).
  • À moyen terme (vitrine R&D) : une table de nœuds ISMCTS dans un SharedArrayBuffer avec Atomics et virtual loss permettant à 4–8 Web Workers d'alimenter un unique arbre profond de 20 000+ itérations en ~2
  secondes dans le navigateur.

  ### D. 3 livrables à fort impact pour partager le dépôt avec des chercheurs ISMCTS

  1. Un README.en.md / article compagnon (docs/paper-companion.en.md) exposant les 4 contributions scientifiques majeures du dépôt :
      • Décomposition Deal Noise (CommonDeals 50,7 %) vs Trajectory Noise (Ensemble2x2000 54,6 %) en ISMCTS ;
      • Loi d'échelle conjointe Budget × Progressive Widening (pwl) × Ensemble (trees) ;
      • Anatomie de l'avantage du second joueur en information cachée vs Omniscient et compensation exacte par PeekAll ;
      • Protocole 1k@2k en donnes miroirs et catalogue complet des résultats négatifs à haute puissance statistique (PUCT, RAVE, Implicit Minimax, RootHalving, Margin Backup).
  2. Un inspecteur visuel de l'arbre ISMCTS dans l'UI Web (onglet Observer / Parties) : les replays contenant déjà scored et tree.levels, afficher visuellement la pyramide des 5 étages (nœuds, singletons,
  max visites) et les barres LCB des 8 candidats à chaque tour.
  3. Un point d'entrée de benchmark standardisé pour chercheurs externes documentant comment brancher un agent sur npm run cli -- --json --new / --step et l'évaluer sur les 212 puzzles exacts, le banc des 1
  000 positions d'Oracle3 et le pool de donnes data/deal-pools/.
  ──────
  ## Prochaine étape (Phase 2)

  Souhaites-tu que nous passions à l'action dans une branche dédiée (après fusion des 2 commits de
  priorites-1.3 sur main), et dans quel ordre de priorité préfères-tu procéder :

  1. Correction des écarts P0 / P1 / P2 listés dans ecarts-spec-dev-test.md (dont le bug decidedBy
  de settle.js et la mise à jour des docs/tests) ?
  2. Optimisations de vitesse sans changement d'empreinte (determinize, scoreStrategist, placeCard,
  cache /api/stats & /api/elo, advice-worker.js) ?
  3. Factorisation des changelogs HTML et réorganisation des dossiers / fichiers .md ?
