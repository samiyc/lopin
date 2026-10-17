# La stratégie des robots, et tes principes

Ce que Sami a relevé en relisant ses parties contre les robots, principe par
principe. Chaque principe donne :
- où il se voit (replay et coup du journal) ;
- sa traduction dans le code ;
- son test ;
- ce qu'il a donné en duel.

**Règle de décision** (choix de Sami) : **la mesure tranche**.
- Un principe qui fait gagner le robot entre dans le Stratège.
- Un principe neutre ou perdant reste dans le code comme interrupteur, mais pas
  dans le Stratège.
- Son test de cas reste alors « à faire » (`todo`), avec la raison.

## Tentatives écartées (le code est retiré, git le garde)

Tout ce qui a été essayé pour dépasser le 0.7 puis le 0.8, et n'a pas passé la
règle. Le code a été retiré le 01/10 (« merlin-is-dead ») : `git show eb9d1c0:<fichier>`
le retrouve tel qu'il était, le commit d'origine dit comment il a été fait. Les
mesures détaillées sont plus bas, section par section.

| Idée | Date | Mesure (fourchette à 95 % par paires) | Verdict | Commit d'origine |
| --- | --- | --- | --- | --- |
| Plus de simulations pour le 0.7 (4 000 contre 400) | 30/09 | 37,5 % | sa recherche plafonne ; c'est ce qui a mené à ISMCTS | ffc7267 |
| Simulations à la règle de revendication (0.8-early) | 30/09 | 47,9 % contre le 0.7 | écarté | 0c0f1cf |
| Simulations qui voient une borne perdue (`certainLite`, 0.8-lite) | 30/09 | 53,1 % (47,4 – 58,8) contre le 0.7 | pas net, écarté | 975fc24 |
| Modèle de l'adversaire (donnes pondérées par son dernier coup) | 30/09 | +4,3 % de cartes devinées seulement ; repris en duel sous `infer=48` (49,5 %, 05/10) et `infer=48+memory=3`, ses 3 derniers coups (46,3 %) | écarté | f14548e |
| Mixture d'experts par phase | 01/10 | 45,8 % (38,4 – 53,3) contre ISMCTS partout | écarté | 28c9ccb |
| Simulations tirées au sort (TLC) | 01/10 | 51,4 % à 400, 50,0 % à 800 | écarté | 52f702a |
| Cas difficiles comme banc d'essai | 01/10 | 5 cas nets en 20 min, sans vérité indépendante | écarté | 52f702a |
| Profondeur 4 et 5 de l'arbre (duels de Sami) | 01/10 | 53,5 % (47,2 – 59,7) chacune ; le 5e coup n'est atteint que par 0,2 % des itérations | la profondeur 3 reste | — |
| Valeur de position apprise, dans l'arbre | 01/10 | 40,3 % (33,1 – 47,4) dès le tour 1 ; 43,8 % dès le tour 15 | écarté | e8dceea |
| Cœur réglé par auto-jeu (SPSA) | 01/10 | 52,9 % seul, mais 50,7 % (42,8 – 58,6) dans l'arbre | écarté | 2207a8d |
| Répertoire d'ouvertures complet (plafond : 1er coup à 5 000) | 01/10 | 45,1 % (37,8 – 52,4) | écarté | 9a8b980, 6c0e13a |
| Répertoire ciblé, mains faibles / fortes | 01/10 | 47,9 % (39,8 – 56,0) / 44,4 % (38,5 – 50,4) | écarté ; le suivi des mains de départ reste | eb9d1c0 |
| Solveur exact dès la pioche vide (+ chercher s'il ne voit pas de victoire) | 01/10 | 47,2 % (40,0 – 54,4) ; 48,6 % | écarté, l'option reste (`+exact`, `+hope`) | bbc1c7e |
| Budget ×4 au point charnière (7 bornes adverses entamées) | 01/10 | 44,8 % (36,4 – 53,2) | écarté, l'option reste (`+pivot`) | bbc1c7e |
| 2 réponses, 5 coups ; RAVE | 01/10 | 47,2 % ; 44,4 % | écartés | bbc1c7e |
| Élargissement progressif sur le 0.9 (6 réponses, 6 coups) | 02/10 | 60,4 % au tri, puis 49,0 % (43,2 – 54,7) au duel long | écarté : le tri était un coup de chance | — |
| Élargissement progressif sur la 1.2 (`PW-ExactEnd12`, 7 réponses, 5 coups, 2 000 itérations) | 11/10 | 46,4 % (41,2 – 51,6) au 1er duel long, arrêté | écarté : l'arbre est plus propre, pas plus fort ; l'option reste (`+pw`) | b86a59e |
| Exploration 0,5 sur le 0.9 | 02/10 | 56,9 % au tri, puis 49,0 % (43,5 – 54,5) au duel long | écarté, même leçon | — |
| Élargissement progressif (4 réponses, 5 coups) ; exploration 1,0 ; 6 ou 12 candidats | 02/10 | 45,8 % ; 52,8 % ; 51,4 % ; 47,9 % | écartés | — |
| Deux fois plus d'itérations pour le 0.9 (1 600 contre 800) | 02/10 | 52,1 % (42,9 – 61,3) | pas net : pas de workers dans la page pour l'instant | — |
| Plus de budget après le tour 22, moins avant (au même total) | 02/10 | 45,8 % (×2 / ×0,5) ; 48,6 % (×1,5 / ×0,75) | écarté, l'option reste (`+late`, `+early`) | a1b3de5 |
| Temps qui suit l'incertitude (au même total) | 02/10 | 54,2 % puis 50,0 % ; ≈ 51,7 % réunis | écarté, l'option reste (`+smart`) | a1b3de5 |
| Juger une borne avec ses voisines (`neighbors`) | 02/10 | seul 47,0 % ; depuis le tour 23 +0,8 ± 2,4 ; partie entière 46,9 % | écarté, l'idée reste (`+core=nb1`) | b9cbecc |
| L'arbre sans les bonus du cœur | 02/10 | depuis le tour 23 +0,3 ± 2,6 ; partie entière 42,4 % | les bonus restent : ils servent avant la fin | b9cbecc |
| Fin de partie : cœur nu et 7 coups d'avance, à temps égal (880 itérations) | 02/10 | depuis le tour 22 +0,0 ± 3,3 ; 20 : +1,3 ± 3,2 ; 18 : −2,0 ± 3,5 | écarté ; la bascule reste (`phase:`), le début de partie est au backlog | — |
| Choisir son jeu : brelans ou suites (`plan`, `ends`, `midRuns`, `weakRuns`) | 02/10 | cœur seul de 45,9 % (les quatre) à 50,6 % (joker seul) | écarté sans duel long, les idées restent (`shapes.js`) | — |
| Règles des replays : face à un côté plein, répondre plus bas, à côté d'une borne gagnée | 02/10 | cœur seul 48,0 – 50,6 % | écartées ; `junk` (53 %) va au duel long | — |
| Placer le joker (face à un côté plein, attendre, brelan du milieu) ; `deepen` | 02/10 | cœur seul 49,5 – 50,3 % | écartés : le cœur le fait déjà ; `jokerRuns` +0,8, rien de plus avec `jkx` | — |
| Le piège du joker : une paire morte, joker en main (`jokerTrap`) | 02/10 | cœur seul 49,7 – 50,3 % | neutre entre robots : ils ne lisent pas le signal ; le cœur le joue déjà (2 323 fois dans les replays) | — |
| L'appât : débuts bas hors des zones qui comptent (`bait`) | 02/10 | cœur seul 49,5 – 51,0 % | neutre : l'adversaire mord à peine, la borne appât se perd plus | — |
| `junk`, `obex` et les deux (`jkx`) dans l'arbre du 0.9 | 03/10 | 52,4 % ; 50,5 % ; 51,7 % (deux jeux de donnes réunis) | pas net ; `jkx` prolongé au backlog | — |
| Deux phases (voisinage au début, cœur nu et 7 coups à la fin), partie entière contre le Stratège | 03/10 | −1,3 ± 4,2 pts (bascule au tour 20) ; −2,0 ± 4,3 (1re borne) | écarté | — |
| Imiter l'oracle : répondre moins, ouvrir sans figure, côtés sans figure, jokers libres | 03/10 | cœur seul 38,8 – 50,4 % | écartés ; seul `stay` 0,4 reste (jkxs, au duel long) | — |
| Bonus seulement aux tours 1-10 : junk, obex, jkx, whole, stfig | 03/10 | 47,9 – 52,1 % (arbre, 400 itérations, 10 min) | écartés ; seul stay (55,4 %) va en validation de nuit | — |
| Les bonus du 0.9 (middle, spread, connector, joker, opening, suited) coupés après le tour 10 | 03/10 | 49,0 – 50,9 % (arbre, 400 itérations, 10 min) | neutres : après le tour 10 l'arbre décide | — |
| Les bonus du 0.9 à partir du tour 15 ; connector à partir du tour 11, 15 ou 19 (à temps égal) | 03/10 | 49,0 – 50,9 % ; connector 48,5 – 48,9 % ; suited seulement après 15 : 41,1 % | neutres, sauf suited, qui sert au début | — |
| Simulations tronquées à la première borne décidée (`trunc=5`, `trunc=8`, à temps égal) | 03/10 | 41,1 % ; 45,6 % | écartées : l'estimation au point d'arrêt coûte plus que le temps gagné ; l'option reste (`+trunc`) | — |
| EPIMC (Arjonilla, Saffidine et Cazenave, 2024 : retarder la résolution en information parfaite) | 14/10 | pas codé | rejeté sur le papier : EPIMC améliore PIMC, que l'ISMCTS dépasse déjà (son arbre est fait d'ensembles d'information, ce qui limite la fusion de stratégies), et la fin de partie est en information parfaite (pioche vide : les cartes non vues sont la main adverse). Il ne resterait que les simulations, l'endroit où `trunc` a perdu | — |
| MO-ISMCTS (un arbre par joueur, Cowling, Powley et Whitehouse 2012), retenu par le panel du 16/10 | 16/10 | pas codé | rejeté sur le papier (`docs/priorites-1.3.md`) : il sert quand un coup cache quelque chose à l'adversaire. Ici, un coup (une carte sur une borne) est public ; seuls la donne et les pioches sont cachées, et l'ISMCTS les tire à la racine. Avec des coups publics, les arbres de chaque joueur sont celui de la 1.2. Et il ne sépare pas les mains de l'adversaire à sa première réponse, là où est la fusion de stratégies : sa racine les regroupe aussi | — |
| Retirer la chance des jokers des résultats (variable de contrôle) | 16/10 | jokers de la main adverse tirée : corrélation −0,04 avec le résultat ; jokers de mes pioches : +0,12 (30 positions, 300 donnes chacune) | écarté par la mesure : au plus 1,5 % de la variance des résultats | — |
| `CommonDeals` : les candidats de la racine comparés sur les mêmes donnes (`+crn=1`) | 16-17/10 | tri à 400 : 55,3 % (50,5 – 60,0) ; 1k@2k : **50,7 % (48,2 – 53,2)** sur 1 000 parties | écarté : le regret de la racine baissait à 400 (−0,43 point), rien à 2 000. Le bruit qui coûte des points est celui du chemin de chaque arbre, pas des donnes de la racine : deux arbres de 2 000 indépendants font 54,6 %, autant qu'un arbre de 4 000 (`docs/priorites-1.3.md`, § 6). L'option reste (`+crn=1`) | — |
| `ReplyFpu` : sous la racine, une réponse jamais essayée vaut la moyenne de ses sœurs essayées moins d / 10 (`+fpu=d`) | 17/10 | 250 parties à 2 000 contre la 1.2@2000 : `fpu=0` 45,6 %, `fpu=1` 53,6 %, `fpu=2` 48,4 %, `fpu=3` 45,6 % ; 1k@2k de `fpu=1` : **51,5 % (49,0 – 54,0)** | écarté : le pic de `fpu=1` était du bruit. L'adversaire modélisé ne gagne rien à revenir plus tôt à ses réponses connues (`docs/priorites-1.3.md`, § 2). L'option reste (`+fpu=d`) | — |

## Comment le Stratège choisit un coup

Le Stratège 2 a deux étages :
1. **Le cœur** (`strategist`, version 1.2) note chaque coup possible. Il estime ce
   que devient la borne jouée, face à ce que l'adversaire y construit.
   - Estimation : `sidePotential` dans `src/sim/eval/potential.js`, `moveGain` dans
     `src/sim/bots.js`.
   - La note reçoit ensuite des bonus : les trois habitudes
     (`src/sim/heuristics/strategist.js`), les idées (`src/sim/heuristics/ideas.js`) et les principes
     (`src/sim/heuristics/principles.js`).
2. **L'anticipation** (`src/sim/search/lookahead.js`) prend les 4 meilleurs coups du
   cœur. Pour chacun, elle rejoue 16 fois la fin de la partie, en distribuant au
   hasard les cartes invisibles, puis garde celui qui gagne le plus souvent.

Depuis la version 2.1, l'anticipation garde aussi une part de l'avis du cœur :
la note d'un candidat est sa part de fins de partie gagnées, plus 0,3 fois sa note
du cœur (`prior`). Seize fins de partie départagent mal deux coups proches, et la
note du cœur porte les habitudes et les principes. Mesure : 54,1 % contre la même
version sans cette part (800 parties, ±3,5).

**Conséquence importante.** Une règle du cœur agit de deux façons sur le 2 :
- elle choisit les 4 candidats ;
- elle fait jouer les fins de partie simulées, où le cœur tient les deux côtés.

Mais une fois les candidats choisis, seules les fins de partie tranchent. Le
Stratège 2 peut donc encore jouer un coup que son cœur évite : un 10 au milieu,
par exemple.

**Protocole des duels.**

| Duel | Parties | Fourchette | Durée |
|---|---|---|---|
| Cœur contre cœur | 8 000 (4 000 de chaque côté) | ±1,1 point | quelques secondes |
| Finalistes, cœur contre cœur | 24 000 | ±0,6 point | — |
| Stratège 2 contre Stratège 2 | 800 | ±3,5 points | environ 20 minutes |

## Les principes

### 1. Une paire de même couleur ne se sépare pas — `connector` ✅ retenu (1.2)

- **Replay** : 12-05, coup 5. Le 8♠ est seul sur la borne 4, le 9♠ en main. Le
  robot ouvre la borne 5 avec le 9♠.
- **Pourquoi c'est grave** : 8♠ 9♠ ouvre 7-8-9 et 8-9-10 à pique, le meilleur score
  possible. Ce sont les meilleures cartes de la main. Garder le 9♠ en main est
  acceptable, et cache la Suite couleur à l'adversaire. Le poser ailleurs la
  détruit.
- **À ne pas confondre** : 9♥ 10♥ n'attend qu'une seule carte, le 8♥.
- **Code** : une pénalité pour poser une carte loin de sa voisine de même couleur
  restée seule sur une autre borne, tant que les deux bouts sont encore possibles.
- **Cause** : l'estimation ne mesure que la borne jouée. Elle ne voit pas que le
  9♠ valait une Suite couleur à la borne 4.
- **Mesure** : 53,9 % contre le Stratège 1.1 (24 000 parties, ±0,6). Le Stratège
  2.1, qui l'embarque, bat le 2.0 dans 55,4 % des parties (800 parties, ±3,4).
- **Test** : réussi par le cœur et par le Stratège 2.

### 2. Les Brelans se jouent — `trips` ✗ non retenu

- **Replay** : 11-28, coups 2 à 16. Le robot a 2♠ 2♥ JK en main dès le départ, puis
  3♠ 3♣ et deux jokers. Il ne joue aucun Brelan.
- **Principe** : jouer un Brelan vide la main et fait piocher.
  - Brelans sur les bornes 2, 3, 5 et 6.
  - Suites couleur au milieu, sur les bornes 3, 4 et 5.
  - Suites et Sommes aux bords, sur les bornes 1 et 7.
- **Rappel** : le joker n'a pas de couleur, il n'aide jamais une Suite couleur.
- **Code** : un bonus pour une carte qui rejoint sa jumelle seule, ou qui ouvre une
  borne 2, 3, 5 ou 6 quand la main tient déjà le Brelan.
- **Mesure** : 51,2 % seul (±1,1), mais 52,6 % avec `connector` contre 53,9 %
  sans. Il affaiblit le cœur.
- **Test** : « à faire ». Piste : le bonus s'applique aussi à des Brelans faibles ;
  ta nuance sur les petites valeurs (principe 6) n'est pas encore codée.

### 3. Pas de bout au milieu — `ends` ✗ non retenu

- **Replay** : 11-28, coup 8. Le 10♥ ouvre la borne 4.
- **Principe** : 10 est un bout, comme 1. Sa Suite couleur ne peut venir que de
  8-9. Au milieu, il faut deux cartes de même couleur qui se suivent, de 2-3 à
  8-9, et leurs deux voisines ne doivent pas être déjà en jeu. Si ces cartes
  partent chez l'adversaire, on se rabat sur une Couleur simple.
- **Code** : une pénalité pour un 1 ou un 10 qui ouvre les bornes 3, 4 ou 5. La
  règle `middle` du Stratège 1.1 couvre déjà le cas des deux cartes qui se
  suivent.
- **Mesure** : 49,9 %, neutre. Avec `connector`, 53,3 % contre 53,9 %.
- **Test** : le cœur l'évite déjà, grâce à `middle`. Le Stratège 2.1 le joue
  encore 4 fois sur 10 (10 graines essayées) : les fins de partie choisissent parmi
  les 4 candidats, et le 10♥ y figure. « À faire » pour lui.

### 4. Garder des bornes libres — `reserve` ✗ non retenu

- **Replay** : 12-05, coup 13. Les 7 bornes du robot sont occupées.
- **Principe** : garder deux bornes vides en début et milieu de partie, une seule
  vers la fin. La pioche peut apporter un Brelan ou une Suite couleur qui ne
  s'accorde avec aucune borne déjà ouverte.
- **Code** : une pénalité pour ouvrir une borne quand il en resterait moins de deux
  libres (moins d'une quand la pioche passe sous 10 cartes).
- **Mesure** : 50,3 %, neutre. Au poids essayé, il ne change pas ce coup-là.
- **Test** : « à faire ».

### 5. Garder l'estimation entière — `whole` (mesuré, non retenu)

- **Principe** (pas de replay précis) : juger un coup sur tout le plateau. Une
  carte qui quitte la main emporte ce qu'elle promettait aux autres bornes.
- **Mesure** : 51,3 % seul. Avec `connector`, 54,4 % contre 53,9 % : l'écart est
  dans le bruit, et le calcul est plus lourd.
- **Suite** : c'est la cause générale du principe 1. Il reste un interrupteur, à
  remesurer avec le Stratège 2.

### 6. Le Brelan avec un joker : bord ou milieu ? — cas « à faire »

- **Replay** : 12-50, coup 10. La main est 4♠ 1♥ 8♥ 1♦ 2♦ JK. Le robot ouvre la
  borne 5 avec le 1♥, pour un Brelan 1-1-JK.
- **Principe** : un Brelan faible ne doit pas bloquer une borne du milieu.
  - **Mieux** : 2♦ vers le 2♠ de la borne 1, pour vider la main. On garde les 8,
    utiles pour départager une Couleur contre une Couleur.
  - **Sinon** : 8♥ vers le 8♣ de la borne 6, si les 6♣ et 9♣ sont déjà joués. La
    Suite couleur est alors impossible, et le Brelan devient la meilleure ligne de
    cette borne.
- **Code** : `ends` (1 au milieu) et `trips` (rejoindre la jumelle) couvrent ce cas.
- **Test** : « à faire ». `trips` affaiblit le cœur, et `ends` seul ne suffit pas à
  changer ce coup.

## Les tests

- **`tests/sim-heuristics/strategy-cases.test.js`** : chaque cas est rejoué depuis
  `tests/fixtures/replays/`, et vérifié pour le cœur et pour le Stratège 2 (graine
  fixe).
  - On vérifie ce que le robot **ne doit pas** faire, pas un coup unique.
  - Un cas encore raté est `todo` : il s'affiche dans `npm test` sans le faire
    échouer.
- **`tests/sim-heuristics/ideas.test.js`** : chaque principe sur une position construite à la
  main.

Les numéros de coup sont ceux des journaux. Le compteur du lecteur de replays
affichait le tour suivant ; il affiche maintenant le coup montré.

## Le journal, par chapitre

Les essais et leurs mesures, dans l'ordre où ils ont eu lieu, sont dans `docs/strategie/`, un
fichier par période (800 lignes au plus chacun, `tests/web-cli/md-budget.test.js`). Un essai
nouveau s'ajoute à la fin du dernier chapitre ; s'il lui faisait passer 800 lignes, il ouvre le
chapitre suivant, ajouté ici. Le tableau des tentatives écartées, plus haut, reste le registre.

1. [Du 0.6 au 0.8 : motifs prouvés, fin exacte, première recherche en arbre](strategie/01-du-0.6-au-0.8.md) (30/09 – 01/10)
   - Les motifs gagnants prouvés (Expérimental 0.6)
   - Expérimental 0.7 : plus vite, et la fin de partie exacte
   - Cacher son jeu ? (`npm run hiding`)
   - Expérimental 0.8 : ce qui n'a pas marché
   - La soirée du 30/09 : tous les leviers au banc
   - Expérimental 0.8 : la recherche en arbre, à 800 simulations (01/10)
   - L'étape 2 : apprendre l'évaluation par auto-jeu (01/10, evol-exp-080)
   - Le répertoire d'ouvertures : le plafond d'abord (01/10)
   - Le répertoire ciblé : les mains faibles et les fortes (01/10)
   - Les points charnières et l'élagage (01/10, merlin-is-dead)
   - Le classement stabilisé (01/10, duels directs gardés en replays)
2. [Le 0.9 : rejouer, les pistes, les règles tirées des replays](strategie/02-le-0.9.md) (02/10)
   - Rejouer depuis le milieu, et le prix d'une erreur (02/10, evol-exp-090)
   - Les pistes du 0.9 (02/10, evol-exp-090)
   - Le tour critique, avec 4 fois plus de parties (02/10)
   - Changer le cœur : voisinage et bonus (02/10, après la rétrospective)
   - Deux phases : un cœur riche au début, un arbre profond à la fin (02/10)
   - La première carte : surenchérir d'un cran, payer une ouverture (02/10)
   - Choisir son jeu : brelans ou suites de couleur (02/10)
   - Des règles tirées des replays (02/10)
   - Les jokers dans les replays, et « présent chez les gagnants, absent chez les perdants » (02/10)
   - Le piège du joker (02/10)
   - Les bornes gagnées avec des cartes faibles : des pièges ? (02/10)
   - L'appât : des suites et brelans faibles pour vider la main adverse (02/10)
   - Le prix d'une erreur aux tours 6 à 14 (backlog de nuit, 02/10)
3. [L'oracle, `stfig` et l'Expérimental 1.0](strategie/03-oracle-et-1.0.md) (03/10 – 04/10)
   - L'oracle sur les replays (03/10, en cours)
   - Les résultats de la nuit du 03/10
   - Pousser le cœur dans le sens de l'oracle (03/10)
   - `stay` dans l'arbre, et la variante gagnante : `stfig` (03/10)
   - Des bonus seulement aux tours 1 à 10 (03/10)
   - Les bonus du 0.9 limités aux tours 1 à 10 (03/10)
   - Les bonus du 0.9 à partir du tour 15, connector, et les simulations tronquées (03/10)
   - La chance des jokers (03/10)
   - Expérimental 1.0 : rester sur ses côtés tant qu'une figure y est possible (03/10)
   - La base de référence V1 + Oracle : les pilotes de la nuit (04/10)
   - Trois variantes du 1.0 pour le début de partie (04/10, après-midi)
   - La calibration du banc : il ne trie pas (04/10, soir)
4. [Le labo à 2 000 itérations : V1, coût du cœur, RootHalving, FirstExplo](strategie/04-labo-a-2000.md) (04/10 – 06/10)
   - Vers 55 % contre la V1 : le labo à 2 000 itérations (04/10, nuit)
   - Le coût du cœur, feature par feature (05/10, Sami)
   - RootHalving : éliminer des candidats à la racine (05/10, soir)
   - FirstExplo : moins d'exploration pour le premier joueur (06/10, après-midi)
5. [La 1.1, la 1.2, le Borné et la feuille de route 1.3](strategie/05-de-la-1.1-a-la-feuille-1.3.md) (06/10 – 12/10)
   - Expérimental 1.1 : 7 réponses par étage (06/10)
   - Les pièges de fin de partie (07/10, feuille de route 1.2)
   - EndJoker : le joker en fin de partie (07/10, cœur 1.2 en essai)
   - Ce qui reste à traiter (feuille de route 1.2, 07/10)
   - L'arbre et les pièges, le solveur et le banc de pièges (07/10, soir)
   - Le banc de pièges complet et les essais CriticalEnd (08/10, matin)
   - L'extension consolidée avec l'arbre : 4 000 parties (08/10, 05 h 43)
   - RolloutCrit-Exact12 : 1 000 parties (08/10, 11 h 17)
   - Le Borné 1.0 : la canalisation de l'arbre et la fin de la saturation (09/10)
   - L'extension après la refonte du Valet de Trèfle (10/10)
   - Le cœur `stfig6crit` : une branche morte (relecture du 10/10)
   - `PW-ExactEnd12` : l'élargissement progressif sur la 1.2 (11/10)
   - Feuille de route 1.3 (11/10)
   - Un cœur allégé pour plus d'itérations ? Non (12/10)
   - Des simulations plus justes, à temps égal (12/10)
   - Les quatre pistes du 12/10
6. [La nuit du 14/10 et les oracles : profond, Oracle3, Oracle light, CommonDeals, ReplyFpu](strategie/06-les-oracles.md) (14/10 – 17/10)
   - La nuit du 14/10 : Oracle2, et la 1.2 relue par l'oracle
   - Le budget des couleurs (14/10)
   - La double menace dans les simulations (14/10)
   - L'hybride MCTS-minimax : les sauvegardes implicites (14/10)
   - L'oracle profond : un juge plus fort que la 1.2 (14/10)
   - La formule de `pw` à 2 000 itérations : `1+`, `2+`, `3+` (14/10, soir)
   - Oracle3 : la 1.2 relue par l'oracle profond (nuit du 14/10, fin le 15/10)
   - Le choix final à la racine : `FinalMean`, `FinalLcb1` (15/10)
   - La soirée du 15/10 : les « dernière chance » et l'Oracle light
   - `pwl` : l'élargissement progressif en niveaux (Sami, 16/10)
   - Les donnes communes : `CommonDeals` (16/10, `docs/priorites-1.3.md`)
