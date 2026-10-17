# Écarts constatés entre Spécifications (Docs), Code (Dev), Données et Tests

*Audit complet réalisé le 17/10/2026 sur `Lopin n°742` (Bornage).*

Ce document recense l'ensemble des divergences, contradictions, valeurs obsolètes et bugs latents identifiés en croisant :
- la documentation (`CLAUDE.md`, `README.md`, `docs/*.md`, `docs/agents/*.md`, `regles/regles.html`),
- le code source (`src/`, `web/`, `scripts/`),
- les données versionnées (`data/`, `web/data/`, `out/`),
- et la suite de tests (`tests/*.test.js`).

Les écarts sont classés par **priorité / gravité** (`P0` à `P3`) pour faciliter le plan d'action de la phase 2.

## Avancement (branche `refactor/quality-perf-docs`, 17/10)

Les chemins cités plus bas sont ceux d'après la réorganisation en sous-dossiers.

- **Corrigés** : P0-1 (`main` contient les commits de `priorites-1.3`), P0-2 (`decidedBy` lit le
  rang encodé dans le score sous les figures ; test dans `tests/sim-engine/extension.test.js`), P1-4
  (`parseSeat` lit `PeekTurnsN`, `PeekInPlayN`, `Hand7SkipN` ; `PeekInPlay24` nommé), P1-6
  (`vsLower` d'`oracle-light`), P2-8 (ligne `oracle-light@1.0` dans `data/elo-duels.json`), P3-1
  (section *Layout* de `CLAUDE.md`).
- **Réorganisation faite** (§ 2 du rapport) : sous-dossiers de `src/sim/`, `src/replay/`, `web/app/`,
  `scripts/lib/`, `tests/` ; les 10 scripts ponctuels dans `scripts/archive/` ; les changelogs 1.1 à
  1.3 partagent `src/report/changelog/style.css` et `v1-sections.html`, et chaque page n'embarque
  plus que les données qu'elle lit. Empreintes inchangées.
- **Corrigés ensuite** (17/10 après-midi) : P1-1, P1-2, P1-3, P1-5, P1-7, P2-1 à P2-7, P3-2 ; P3-3
  (`tests/web-cli/docs.test.js` vérifie la gamme de `jouer.md`, les `vsLower` et les noms de sièges
  des docs). `npm run build` mesuré à 77 s sur 18 fils, `out/data.json` inchangé au chiffre près.
- **Vitesse (§ 3 du rapport), mesurée** : un profil de la 1.2 à 2 000 itérations (`node --cpu-prof`)
  met le temps dans le cœur des simulations : `drawPotentialOf` 19 %, `pairPotential` 15 %,
  `ideasBonus` 8 % ; les points A1 à A3 du rapport (`determinize`, `ideasContext`, `placeCard`,
  `cloneState`) pèsent ensemble environ 4 %. Faits : `valuer.value3` lu dans une table par évaluateur
  (remplie à la demande, mêmes valeurs au bit près) et la liste des cartes invisibles construite une
  fois par recherche au lieu d'une fois par itération : **25,9 → 24,9 s par partie à 2 000
  (≈ −4,5 %)**. Neuf empreintes inchangées (strategist, 1.0, 1.2, `pwl=4`, `fpu=1`, Oracle v1,
  Omniscient, `lookahead`, `experimental:200`). `/api/stats` ne lit plus les replays deux fois
  (réponses identiques) ; le `bot` jamais lu de `play-game.js` est retiré. Écartés après mesure :
  `advice-worker` (rejouer depuis le début coûte 111 ms sur une relecture d'environ 6 s), le
  `solve-worker` (déjà créé à l'ouverture des puzzles seulement).
- **Non faits, à décider** : le code des idées écartées et `ponder.js` restent (les anciens moteurs
  doivent rejouer leurs replays ; la recherche plate du 0.7 réfléchit encore pendant le tour humain) ;
  la réorganisation des `.md` en documents numérotés (§ 4A du rapport) change les liens de tous les
  documents et des prompts : à valider avant. Les pages `out/changelog-exp-0.6.html` et `0.8.html`
  sont des sorties figées, sans source : gardées telles quelles.

---

## Synthèse par niveau de priorité

| Priorité | Catégorie | Nombre d'écarts | Impact principal |
| :---: | :--- | :---: | :--- |
| **P0** | Synchronisation Git (`main` vs worktree `priorites-1.3`) & Bug logique (`settle.js`) | **2** | Désynchronisation de 13 jobs de nuit + `ReplyFpu` ; `decidedBy` erroné avec l'extension |
| **P1** | Écarts fonctionnels Docs ↔ Code / UI (`BOT_LINEUP`, `vsLower`, `seats`, `ponder`, `regles.html`) | **7** | Infos fausses pour le joueur/chercheur ou erreur runtime sur un nom court documenté (`PeekInPlay24`) |
| **P2** | Valeurs numériques, versions ou compteurs obsolètes dans les `.md` et `data/` | **8** | Chiffres contradictoires entre deux docs ou avec les données réelles (`puzzles.json`, `elo-duels.json`) |
| **P3** | Commentaires JSDoc obsolètes dans le code et trous de couverture dans `tests/` | **6** | Maintenance et lisibilité du code pour des contributeurs externes |

---

## P0 — Synchronisation Git & Bugs logiques dans le code

### P0-1. Désynchronisation entre la branche `main` et le worktree `.claude/worktrees/sidebar-collapse` (`priorites-1.3`)
- **Constat** :
  - Le répertoire principal (`E:\Dev\My projects\Lopin n°742`) est sur la branche `main` au commit `a897e37` (16/10 au soir), avec `data/backlog.json` modifié localement par le runner de nuit (les 13 jobs de la nuit du 16–17/10 y sont marqués `"status": "done"`, terminés le 17/10 à 09h17, et leurs traces sont dans `backlog-runs/2026-10-17-*`).
  - Parallèlement, le worktree `.claude/worktrees/sidebar-collapse` (branche `priorites-1.3`, poussée sur `origin/priorites-1.3`) possède **2 commits d'avance** réalisés ce matin (17/10) :
    1. `239e4b7` (17/10 à 09h47) : dépouillement complet des 13 jobs de la nuit (`CommonDeals` à 50,7 %, `Ensemble2x2000` à 54,6 %, `OracleLight-Pwl3-Trees2` à 53,6 %, `OracleLight-Pwl2-Trees2` à 57,9 %, `Oracle3-Pwl3-Trees2` à 55,4 %) dans `docs/priorites-1.3.md`, `docs/1.3-to-oracle-shift.md`, `docs/strategie.md`, `CLAUDE.md`, `data/changelog-exp-1.3.json`, `data/changelog-oracle.json` et `data/backlog.json`.
    2. `94d9335` (17/10 à 11h00) : implémentation de `ReplyFpu` (`src/sim/mcts/first-play.js`, `+fpu=d`, `tests/sim-search/first-play.test.js`), exécution des duels de jour (`ReplyFpu0` 45,6 %, `ReplyFpu1` 53,6 % dont le log `backlog-runs/2026-10-17-10-57_VALIDATE_LONG_1_ReplyFpu1.txt` est écrit dans le dossier principal), et mise en file des 12 jobs de la nuit du 17–18/10.
- **Écart sur `main`** :
  - Sur `main`, `CLAUDE.md` (L412), `docs/1.3-to-oracle-shift.md` (L21–24, L31–53), `docs/priorites-1.3.md` (L33–36, L330–346), `docs/strategie.md` (L3669–3673, L3695–3698) et `docs/glossaire.md` (L485) présentent encore ces 13 jobs au futur (*« en file pour cette nuit »*), et le moteur `+fpu=d` mentionné dans `backlog-runs/2026-10-17-10-57_VALIDATE_LONG_1_ReplyFpu1.txt` n'existe pas encore dans `src/sim/` sur `main`.
- **Correction prévue** :
  - Réinitialiser la modification locale de `data/backlog.json` sur `main` (déjà committée dans `239e4b7`) et fusionner `priorites-1.3` (`94d9335`) dans `main` (`git merge --ff-only priorites-1.3`), puis supprimer les worktrees résiduels de `.claude/worktrees/`.

---

### P0-2. Bug dans `src/sim/engine/settle.js` : `decidedBy` ignore les règles des figures de l'extension (`evaluatorFor`)
- **Fichier & lignes** : `src/sim/engine/settle.js` (lignes 20–24 et 27–42) vs `src/sim/engine/border-rules.js` (lignes 44–52, 87).
- **Code actuel** :
  ```js
  function decidedBy(state, border, formations) {
    if (formations[0] !== formations[1]) return "formation";
    const sums = border.sides.map((side) => state.evaluator.sum(side));
    return sums[0] === sums[1] ? "first" : "sum";
  }
  ```
- **Nature du bug** :
  - Dans `resolveBorder` (ligne 30), le vainqueur de la borne est calculé avec `scores = border.sides.map((side, player) => evaluatorFor(state, index, player).score(side))` qui applique correctement les figures posées sur la borne (`V♦` *La Somme*, `V♣` *Le Dix de moins*, `R♦` *Le Dix de plus*, `R♠` *La Couleur impaire*).
  - En revanche, `decidedBy(state, border, formations)` utilise les formations et sommes de base (`state.evaluator.formation` et `state.evaluator.sum`) sans tenir compte des figures ni de `scores` :
    1. **Cas du Valet de Trèfle (`V♣`, `-10`) ou du Roi de Carreau (`R♦`, `+10`)** : Si les deux côtés ont la même combinaison et la même somme faciale (ex. deux suites de somme 18, cas exact de `tests/sim-engine/extension.test.js` L36–40), `scores[0] !== scores[1]` (8 contre 18), donc la borne est gagnée à la somme modifiée (`"sum"`). Or `decidedBy` compare `sums[0] === sums[1]` (`18 === 18`) et retourne **`"first"`** (premier à avoir posé sa 3e carte) au lieu de **`"sum"`** !
    2. **Cas du Valet de Carreau (`V♦`, *La Somme*)** : La figure annule la hiérarchie des combinaisons (seule la somme compte). Si un joueur a un Brelan de 2 (somme 6) et l'autre une Somme de 20, le joueur à 20 gagne par la somme (`"sum"`), mais `decidedBy` voit `formations[0] !== formations[1]` et retourne **`"formation"`** !
    3. **Cas du Roi de Pique (`R♠`, *La Couleur impaire*)** : Une couleur impaire bat un brelan ou une couleur paire. Si une couleur impaire bat une couleur paire, `formations[0] === "flush"` et `formations[1] === "flush"`, donc `decidedBy` retourne **`"sum"`** (ou **`"first"`** à somme égale) au lieu de **`"formation"`** !
- **Correction prévue** :
  - Dans `settle.js`, déterminer `"first"` dès que `scores[0] === scores[1]`, et tenir compte de `rulesOf(border, player)` (ou comparer les rangs effectifs `Math.floor(score / 64)`) pour distinguer `"formation"` de `"sum"`. Ajouter l'assertion sur `decidedBy` dans `tests/sim-engine/extension.test.js`.

---

## P1 — Contradictions fonctionnelles entre Documentation, Code et Interface

### P1-1. Réflexion pendant le tour humain (*pondering*) annoncée active dans `docs/jouer.md` mais désactivée dans le code
- **Documentation (`docs/jouer.md`, L201–202 et L208–218)** :
  - L201–202 (section *« Ce que fait l'Expérimental »*, à propos de `ismcts+widen=7+depth=5+core=stfig6+exact=12@2000`) : *« Seule différence : dans la page, il réfléchit aussi pendant ton tour. »*
  - L208–218 : Décrit en détail le mécanisme de réflexion anticipée pendant le tour humain et le crédit de la moitié du temps (`budget − min(attendu / 2, budget × 3/4)`).
- **Code (`web/app/workers/think-worker.js` L17–19, `src/sim/mcts/ismcts.js` L293, `src/config/bots.js` L42)** :
  - `startPonder` vérifie `if (!bot.warms) return;`. Seul l'ancien moteur plat `searchBot` (`src/sim/search/search.js` L121, utilisé par `experimental` 0.6/0.7) possède `warms`.
  - Aucun bot ISMCTS (`experimental` 1.2 ni `oracle-light` 1.0) ne possède `warms`. Le *pondering* a été volontairement coupé le 16/10 (`CLAUDE.md` L241–243, `docs/strategie.md` L3660–3664) car il amputait le budget de la 1.2 sans réutiliser l'arbre.

---

### P1-2. Règle de revendication sur la fiche imprimée (`docs/jouer.md` vs `regles/regles.html`)
- **Documentation (`docs/jouer.md`, L23–25)** :
  - Affirme : *« La fiche imprimée n'en parle pas : elle règle une borne dès que ses deux côtés ont 3 cartes, ce qui évite aux débutants de devoir prouver une borne à voix haute. La revendication d'une borne inachevée reste une finesse du jeu en ligne. »*
- **Fiche imprimable (`regles/regles.html`, L288–291, page 2/3)** :
  - Contient au contraire un encadré explicite : *« **Pour les habitués : prendre une borne plus tôt.** Dès que tu as posé tes 3 cartes sur une borne, si tu peux montrer — rien qu'avec les cartes déjà posées sur la table — que l'autre ne pourra plus te battre sur cette borne [...] tu la gagnes tout de suite »*.

---

### P1-3. Nombre de pages de la fiche imprimable (2 pages recto-verso vs 3 pages avec l'extension)
- **Réalité (`regles/regles.html` L232, L297, L362 ; `docs/extension.md` L124)** :
  - La fiche compte **3 pages A4** (`1 / 3`, `2 / 3`, et `3 / 3` pour l'extension des 6 figures).
- **Docs et commentaires indiquant encore 2 pages** :
  - `README.md` (L46) : `la fiche de règles à imprimer (A4 recto-verso)`
  - `CLAUDE.md` (L488) : `After editing the sheet, check both pages still fit A4`
  - `docs/sieges.md` (L238) : `vérifier que les deux pages tiennent en A4`
  - `regles/regles.html` (L15) : `/* Printed sheet: two A4 pages. */`

---

### P1-4. Noms courts des compensations de siège : `PeekInPlay24` et `Hand7SkipN` (`docs/sieges.md` vs `src/config/seats.js`)
- **Documentation (`docs/sieges.md` L136–137 ; `docs/glossaire.md` L317, L319, L323)** :
  - Le tableau de `docs/sieges.md` (L136) nomme la variante D **`PeekInPlay24`** (*« Tant qu'il y a moins de 24 cartes posées... »*).
  - La ligne L137 (et `docs/glossaire.md` L323) nomme la variante H **`Hand7SkipN`** (`Hand7Skip1`, `Hand7Skip2`, `Hand7Skip3`).
- **Code (`src/config/seats.js` L12–21 ; `src/sim/engine/seat-rules.js` L48–54)** :
  - `SEAT_VARIANTS` définit **`PeekInPlay20`** (`id: "peek=1+inplay=20"`, *« moins de 20 cartes posées »*), et **aucune** clé `PeekInPlay24` ni `Hand7Skip1/2/3`.
  - Appeler `parseSeat("PeekInPlay24")` ou `parseSeat("Hand7Skip2")` lève une exception `Error: Compensation inconnue` !

---

### P1-5. Définition contradictoire d'`Oracle light` dans `docs/1.3-to-oracle-shift.md` (`pwl=2` vs `pwl=3+trees=2`)
- **Code (`src/config/bots.js` L45–57) & Tests (`tests/sim-engine/lineup.test.js` L12, L34)** :
  - `oracle-light` (`1.0`) est configuré avec `ismcts+widen=7+depth=10+core=stfig6+exact=12+pwl=3+trees=2@10000` (**`pwl=3`**, 2 arbres de 5 000).
- **Documentation (`docs/1.3-to-oracle-shift.md`)** :
  - **Ligne 88** (tableau *« Deux versions »*) : définit **Oracle light** comme `la même base, pwl=2 (OracleLight-Pw2) | 10 000 | 54,5 % contre la 1.2 sur 420 parties`.
  - **Lignes 24 et 122** du même fichier : indiquent que c'est `pwl=3` (56,0 %) puis `OracleLight-Pwl3-Trees2` qui a été mis dans la gamme.
  - *(Note additionnelle suite aux runs de la nuit du 17/10 : `OracleLight-Pwl2-Trees2` a fait 57,9 % contre 53,6 % pour `OracleLight-Pwl3-Trees2` : il faudra décider si `oracle-light` passe en 1.1 avec `pwl=2+trees=2`, et aligner le tableau L88 en conséquence).*

---

### P1-6. Propriété `vsLower` manquante sur `oracle-light` dans `src/config/bots.js`
- **Documentation (`docs/jouer.md`, L46)** :
  - *« Au-dessus du plateau, quatre boutons choisissent l'adversaire [...] avec sa version et son score contre le robot du dessous. »*
- **Code (`src/config/bots.js`, L29, L41, L45–57 ; `web/app/play/play.js`)** :
  - `stratege` a `vsLower: "85 % vs Basique"` (L29).
  - `experimental` a `vsLower: "76 % vs Stratège"` (L41).
  - `oracle-light` (L45–57) n'a **pas** de champ `vsLower` (ex. `"54 % vs Expérimental"` pour la 1.0 `pwl=3+trees=2`, ou `"58 % vs Expérimental"` si passage en 1.1 `pwl=2+trees=2`), et le commentaire L48–49 dit encore *« The two trees are measured by the night duels »*.

---

### P1-7. Omission d'`Oracle light 1.0` dans la gamme documentée (`README.md`, `docs/jouer.md`, `docs/commandes.md`, `docs/cli.md`)
- **Code (`src/config/bots.js`, L13–58)** :
  - La gamme publique `BOT_LINEUP` compte **4 robots** : `basique`, `stratege`, `experimental`, `oracle-light`.
- **Fichiers documentaires qui n'en listent encore que 3** :
  - `README.md` (L37) : *« contre le robot Basique, Stratège ou Expérimental »*.
  - `docs/jouer.md` (L220–226, tableau *« Les robots »* et L192–206) : omet `Oracle light 1.0` et son architecture à 2 Web Workers (`think-join.js`).
  - `docs/commandes.md` (L31) : *« un robot de la gamme (`experimental`, `stratege`, `basique`) »*.
  - `docs/cli.md` (L63) : *« le robot par les trois premières lettres de son nom : `EXP`, `STR`, `BAS` »* (omet `ORA`).

---

## P2 — Valeurs numériques, versions ou compteurs obsolètes dans les Docs et `data/`

### P2-1. Version de référence à battre obsolète dans `docs/commandes.md` et `docs/glossaire.md`
- **`docs/commandes.md` (L27)** :
  - Écrit encore : *« Depuis le 04/10, le labo joue à 2 000 itérations : le V1 à battre est `ismcts+widen=3+depth=5+core=stfig6@2000` »*, alors que depuis le 08/10 la version à battre est l'**Expérimental 1.2** (`ismcts+widen=7+depth=5+core=stfig6+exact=12@2000`, `CLAUDE.md` L184).
- **`docs/glossaire.md` (L255–257)** :
  - La ligne L255–256 qualifie encore `V1.1` de *« la version à battre depuis [le 06/10] »* juste au-dessus de la ligne `V1.2` (sortie le 08/10).

---

### P2-2. Nombre et familles de puzzles obsolètes dans `docs/jouer.md`
- **Documentation (`docs/jouer.md`, L172–180)** :
  - Indique **145 puzzles** dans `web/data/puzzles.json` et ne mentionne que **2 familles** (*Fins de partie exactes* et *Gains immédiats*).
- **Données & Code (`web/data/puzzles.json`, `web/app/puzzles/puzzle-kinds.js` L1–46)** :
  - `web/data/puzzles.json` contient **212 puzzles** répartis en **4 familles** : `endgame` (163), `immediate` (8), `fork` / *Double menace* `#401–421` (21), et `pass` / *Double tour* `#422+` / `#501+` (20).

---

### P2-3. Version du Stratège dans `npm run replays` (`docs/jouer.md` vs `scripts/replays.js`)
- **Documentation (`docs/jouer.md`, L168–169 et L295–299)** :
  - Mentionne 4 fois le **Stratège 1.1** (*« Coups humains identiques au meilleur choix du Stratège 1.1 »*).
- **Code (`scripts/replays.js`, L40, L46)** :
  - Compare au **Stratège 1.2** (`BOTS.strategist` avec `STRATEGIST_IDEAS = ["middle", "spread", "connector"]`) et affiche `Stratège 1.2`.

---

### P2-4. Saisie des coups dans `npm run cli` (`docs/commandes.md` vs `scripts/cli.js`)
- **Documentation (`docs/commandes.md`, L44)** :
  - Documente uniquement l'ancienne saisie par indice de main : *« `3 5` pose la 3e carte de la main sur la borne 5 »*.
- **Code (`scripts/cli.js` L16, `scripts/lib/cli/cli-screen.js` L126–138) & `docs/cli.md` (L25–29)** :
  - Depuis le 14/10, la saisie principale affichée par le prompt est par nom de carte et borne (`7h4` ou `7h 4`), les indices de 1 à 6 n'étant plus affichés sous la main (bien que toujours acceptés en fallback par `cli-view.js`).

---

### P2-5. Mention contradictoire sur `Omniscient 1.0` dans `docs/glossaire.md`
- **Documentation (`docs/glossaire.md`, L414–418)** :
  - Conserve la mention *« **Omniscient 1.0** (Sami, 15/10, **à construire plus tard**) »* suivie quelques lignes plus bas de *« **Construit le 16/10** »*.
  - *(De plus, vérifier toute référence éventuelle à un chemin `src/players/omniscient.js` alors que l'option `+omniscient=1` est implémentée dans `src/sim/search/lookahead.js` L72 `seeAll` et `src/sim/mcts/ismcts.js` L161).*

---

### P2-6. `README.md` incomplet sur les fichiers `out/` et `docs/`
- **`README.md` (L50–61)** :
  - Présente `out/changelog-exp-1.2.html` comme *« en cours »* et omet `out/changelog-exp-1.3.html` ainsi que `out/changelog-oracle.html` (qui sont pourtant dans le menu de `web/index.html` L24–26).
  - Ne liste que 5 fichiers sur les 15 présents dans `docs/` (omet `commandes.md` et `glossaire.md` de la table L44–61, ainsi que `cli.md`, `extension.md`, `sieges.md`, `validation.md`, `cloud.md`, `1.3-to-oracle-shift.md`, `priorites-1.3.md`, `analyse-arbre-ismcts.md`).

---

### P2-7. Durée de `npm run build` divergente selon les fichiers
- `docs/methode.md` (L5) : *« environ **1 min 30** »*.
- `CLAUDE.md` (L33) et `README.md` (L72) : *« **~3 min** »*.
- `docs/validation.md` (L10) : *« **3,5 min** »*.

---

### P2-8. Données `data/elo-duels.json` : absence d'`oracle-light@1.0`
- **Code (`src/config/bots.js`, L81)** :
  - `KEPT_VERSIONS` inclut `"oracle-light": Object.freeze(["1.0"])` pour l'afficher dans le classement Elo et l'onglet Stats.
- **Données (`data/elo-duels.json`)** :
  - Ne contient encore aucune ligne de duel pour `oracle-light@1.0`, si bien que tant qu'aucune partie humaine ou ligne de duel n'est enregistrée sous le tag `oracle-light@1.0`, il n'apparaît pas (ou sans ses 420 duels contre `experimental@1.2`) dans la table Elo.
  - **Suggestion Backlog / Script** : Mettre à jour `data/elo-duels.json` avec le résultat des duels d'`oracle-light@1.0` vs `experimental@1.2` (ou via `npm run elo -- --duels`).

---

## P3 — Commentaires de code obsolètes & Couverture de tests

### P3-1. Section `Layout` de `CLAUDE.md` en retard sur l'arborescence réelle
- **`CLAUDE.md` (L44–79)** :
  - `src/config/` omet `seats.js`.
  - `src/core/` omet `figures.js`.
  - `src/sim/` omet `ismcts.js`, `widening.js`, `choice.js`, `final-choice.js`, `common-deals.js`, `seat-rules.js`, `peek.js`, `figure-moves.js`, `figure-gains.js`, `border-rules.js`, `fork.js`, `exact.js`, `endgame.js`, etc.
  - `src/replay/` ne cite que `log` et `summary` (omet les 15 autres fichiers : `elo.js`, `stats.js`, `oracle.js`, `banc.js`, `shadow.js`, `versus.js`, `advice.js`, `bot-games.js`, `branch.js`, etc.).
  - `web/app/` omet `puzzles.js`, `puzzle-controls.js`, `puzzle-kinds.js`, `puzzle-tracker.js`, `stats.js`, `premove.js`, `figure-input.js`, `deck-colors.js`, `thinker.js`, `think-worker.js`, `think-join.js`, `solve-worker.js`, `advice-worker.js`.

### P3-2. Commentaires JSDoc obsolètes dans `src/` et `web/`
1. **`src/sim/mcts/ismcts.js` (L300)** : Le commentaire mentionne `+pwl=0..3` alors que `src/sim/mcts/widening.js` (L4, L15 : `PW_LEVELS`) supporte **`+pwl=0..5`**.
2. **`src/sim/heuristics/experimental.js` (L13–16)** : Le commentaire d'en-tête décrit encore l'Expérimental 0.7 (`search.js`, *successive halving*, *pondering* dans la page) comme étant l'expérience courante.
3. **`src/sim/eval/endgame.js` (L10)** : Le commentaire indique *« `endMode: final`, as in the page »* alors que la page joue en `endMode: "claim-end"` depuis le 01/10.
4. **`web/app/play/play.js` (L19–20)** : Le commentaire indique *« Borders are settled only once every card is down »*, obsolète depuis `claim-end`.
5. **`src/sim/engine/settle.js` (L5–8)** : Le commentaire d'en-tête parle des *« three end modes of `game.js`: `early`, `final`, `claim` »* alors qu'il y en a quatre (`early`, `final`, `claim`, `claim-end`).

### P3-3. Tests de cohérence documentaire (`tests/web-cli/docs.test.js`) et d'extension (`tests/sim-engine/extension.test.js`) à enrichir
- **`tests/web-cli/docs.test.js`** (15 lignes actuellement) vérifie uniquement que chaque script de `package.json` est cité dans `docs/commandes.md`. Il pourrait utilement vérifier en quelques millisecondes :
  1. Que tous les bots de `BOT_LINEUP` (`src/config/bots.js`) sont mentionnés dans `docs/jouer.md` et ont un champ `vsLower` (hors `basique`).
  2. Que toutes les clés de `SEAT_VARIANTS` (`src/config/seats.js`) correspondent aux noms documentés dans `docs/sieges.md`.
- **`tests/sim-engine/extension.test.js` (L36–40)** : Vérifie uniquement `border.owner` lors de la résolution d'une borne avec le Valet de Trèfle (`V♣`), mais pas `state.resolved[0].decidedBy` (ce qui a laissé passer le bug **P0-2**).
