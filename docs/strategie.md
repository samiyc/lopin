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
   - Estimation : `sidePotential` dans `src/sim/potential.js`, `moveGain` dans
     `src/sim/bots.js`.
   - La note reçoit ensuite des bonus : les trois habitudes
     (`src/sim/strategist.js`), les idées (`src/sim/ideas.js`) et les principes
     (`src/sim/principles.js`).
2. **L'anticipation** (`src/sim/lookahead.js`) prend les 4 meilleurs coups du
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

- **`tests/strategy-cases.test.js`** : chaque cas est rejoué depuis
  `tests/fixtures/replays/`, et vérifié pour le cœur et pour le Stratège 2 (graine
  fixe).
  - On vérifie ce que le robot **ne doit pas** faire, pas un coup unique.
  - Un cas encore raté est `todo` : il s'affiche dans `npm test` sans le faire
    échouer.
- **`tests/ideas.test.js`** : chaque principe sur une position construite à la
  main.

Les numéros de coup sont ceux des journaux. Le compteur du lecteur de replays
affichait le tour suivant ; il affiche maintenant le coup montré.

## Les motifs gagnants prouvés (Expérimental 0.6)

Sami demandait des conditions **déterministes** qui disent, sans calculer toute la
partie, qu'un coup est gagnant ou inutile sur une borne. Le sûr, ce sont les
**certitudes** : la « revendication » de la règle officielle de Schotten Totten,
calculée par énumération (`src/sim/certainty.js`).

- **Borne gagnée d'avance** : mon côté est complet, et aucune façon de finir le
  côté adverse ne le bat. On essaie toutes les cartes que je ne vois pas. En cas
  d'égalité, gagne celui qui a complété en premier, c'est-à-dire moi.
- **Borne perdue d'avance** : leur côté est complet, et aucune façon de finir le
  mien ne le bat, même avec ma main et toutes les cartes que je ne vois pas.

Ce sont des théorèmes, pas des estimations. Le test rejoue 60 parties entières et
vérifie plus de 500 affirmations « gagnée » ou « perdue » faites en cours de
partie : aucune n'est contredite par la fin.

**Ce que l'auto-jeu en dit** (`npm run selfplay` puis `npm run mine`) : 1 136
parties de l'Expérimental 0.5 contre lui-même, en 19 minutes, soit 47 712
décisions.

| Motif | Fréquence | Ce que faisait le 0.5 |
|---|---|---|
| Une borne perdue d'avance est jouable | 30 % des décisions | il y joue 42 % des fois, et **y gâche une carte qui n'est pas la moins chère 28 % des fois** |
| Un coup gagne une borne à coup sûr | 35 % des décisions | il le prend 45 % des fois : ce n'est pas toujours urgent, la borne peut attendre |
| Coup « évident » (le choisi devance le suivant de plus de 15 points) | 13 % des décisions | médiane de l'écart : 4,5 points. La plupart des coups sont serrés, et c'est là que le temps de recherche compte |

**Ce qui en est tiré** :
1. **`certain`, dans le cœur de l'Expérimental.** Sur une borne perdue d'avance, un
   coup ne change rien : il est jugé au prix de la carte jetée, donc la moins chère
   part. Mesure : 52,8 % contre le cœur 1.2 (8 000 parties, ±1,1). Le Stratège ne
   l'a pas encore, pour ne pas relancer le rapport. C'est le prochain candidat pour
   son cœur (1.3).
2. **L'élagage de la recherche** (`search.js`, `prune`) :
   - une seule candidate par borne perdue d'avance, puisque les autres ne font que
     jeter une carte plus chère ;
   - après chaque donne, un candidat dont la meilleure note plausible reste sous la
     pire note plausible du meneur (2,5 écarts-types) sort de la course, sans
     attendre la fin de sa ronde.

   Le temps économisé va aux coups serrés.

   **Un piège trouvé en route** : avec les certitudes aussi dans les fins de partie
   simulées, le 0.6 faisait 35 % de simulations en moins par seconde. Elles ne
   servent qu'à choisir le vrai coup, et les deux versions tournent maintenant à
   la même vitesse (296 simulations par seconde).

**Mesure du 0.6 contre le 0.5**, à budget égal (400 simulations par coup, profil
rapide) : 50 % sur 48 parties avant la correction de vitesse, puis **58 %** sur
72 parties (fourchette 47 – 69 %). Une tendance, pas encore une preuve : entre
deux robots aussi forts, 5 minutes ne suffisent pas.

**Duel long** (`npm run duel -- experimental:400 experimental:0.5 --long`, 240
parties en 23 minutes) : **50,4 %** (fourchette 44,1 – 56,7 %) ; 43 % en
commençant, 58 % en second. **Aucune différence** : à budget égal, le 0.6 est
aussi fort que le 0.5, pas plus. Le 58 % du profil rapide était du hasard. Le
0.6 reste en place pour son jeu plus propre sur les bornes perdues, qui ne coûte
rien. Les gains devront venir d'ailleurs : de plus de simulations par seconde,
ou d'une meilleure politique dans les fins de partie simulées.
3. **« Gagner une borne à coup sûr » n'est pas une priorité prouvée.** Le robot fort
   ne la prend qu'une fois sur deux. Elle reste une information pour le cœur, pas
   une règle.

## Expérimental 0.7 : plus vite, et la fin de partie exacte

Le 0.7 applique les deux pistes laissées par le 0.6 : plus de simulations par
seconde, et une fin de partie calculée au lieu d'être simulée. Tout est mesuré
par `npm run bench`, le nouveau banc d'essai. Il cherche sur les 20 puzzles les
plus difficiles et sur 12 positions de milieu de partie, avec 3 graines, et donne
des médianes.

**Plus vite, sans changer un seul coup.** Le profil montre que 93 % du temps de
recherche passe dans le cœur du Stratège qui joue les fins de partie simulées :
le potentiel des bornes (45 %), la vue de la table (18 %), le décompte des cartes
invisibles (10 %). Quatre corrections, sans toucher au jugement :
- les cartes invisibles comptées dans un tableau plutôt qu'en reconstruisant le
  paquet ;
- l'évaluateur de valeurs gardé d'un coup à l'autre ;
- la main sans la carte appariée lue par index au lieu d'être copiée ;
- des clés numériques pour les mémoires, et plus de `flat()` à chaque coup.

| Mesure | Avant | Après |
| --- | --- | --- |
| Stratège contre Basique, par partie | 8,2 ms | 4,9 ms |
| Expérimental (200 simulations) contre Stratège, par partie | 11,0 s | 6,2 s |
| Milieu de partie, tour 8 | ≈ 200 simul./s | ≈ 345 simul./s |
| Milieu de partie, médiane | 310 simul./s | 548 simul./s |

Les quatre empreintes (`npm run fingerprint`) sont identiques avant et après :
mêmes coups, **1,8 fois plus vite**. Dans les 10 s de la page, c'est 1,8 fois
plus de fins de partie rejouées.

**La fin de partie exacte.** Sur les 20 puzzles les plus difficiles, la recherche
ne trouve le coup gagnant que **30 fois sur 60**, et toujours 0/3 ou 3/3 selon le
puzzle. La pioche vide ne laisse plus rien au hasard des donnes : toutes les
simulations rejouent la même partie, et c'est la politique de simulation, pas le
budget, qui se trompe. Le solveur exact coûte :

| Cartes en main (les deux joueurs) | Règle de revendication | Bornes réglées à la fin |
| --- | --- | --- |
| 8 | 51 ms au plus | 97 ms au plus |
| 9 | 78 ms | 159 ms |
| 10 | 1,7 s | 10,9 s |

Le 0.7 s'en sert dès 8 cartes, avec un arrêt au premier coup gagnant, les coups
essayés dans l'ordre du cœur. Il joue alors le coup gagnant dans **les 44 puzzles
de 8 cartes ou moins** (un test le vérifie). Un premier essai en ratait un : le
cœur écarte d'office certains jokers, et le coup gagnant en était un. Le solveur
reçoit donc tous les coups.

**Mesure contre le 0.6**, profil rapide (400 simulations par coup, 72 parties) :
**56,9 %** (fourchette 45,4 – 67,7 %), 52,8 % en commençant, 61,1 % en second :
**pas de différence nette**. Peu de parties atteignent une fin de partie aussi petite, et le gain
de vitesse ne compte pas à budget de simulations égal. Le vrai gain du 0.7 est
dans la page : 1,8 fois plus de simulations dans les mêmes 10 s, et un jeu
parfait dans les derniers coups.

**Les puzzles « gain immédiat ».** Sous la règle de revendication, un coup peut
rendre la victoire certaine alors que la pioche n'est pas vide. Il faut que, après
ce coup, les bornes prouvables fassent déjà trois côte à côte ou quatre en tout, et
que l'adversaire n'ait pas gagné avant. La preuve n'utilise que les cartes de la
table, donc la main cachée n'y change rien. `npm run puzzles:immediate` en a
trouvé 20 dans l'auto-jeu du Stratège, qui ne voit le coup dans aucun d'eux. Un
test rejoue chaque solution sur 20 donnes différentes des cartes cachées, avec une
réponse au hasard : la victoire tombe à chaque fois.

## Cacher son jeu ? (`npm run hiding`)

**La question** (Sami, après le 0.6) : l'Expérimental cache-t-il sa stratégie en
gardant ses coups forts en main ?

**La réponse** : aucun robot ne se représente ce que l'adversaire devine de sa
main, donc aucun ne cache quoi que ce soit *exprès*. S'il garde une carte qui
finirait une suite couleur ou un brelan, c'est que la recherche juge un autre coup
meilleur maintenant, et que le coup fort restera possible.

**La mesure**, sur les 1 136 parties d'auto-jeu (0.6, bornes réglées à la fin).
À chaque première occasion de finir une borne en suite couleur ou en brelan :

| Choix | Occasions | Formation forte finie | Borne gagnée | Partie gagnée |
| --- | --- | --- | --- | --- |
| Jouée tout de suite | 2 411 | 100 % | 84,7 % | 57,5 % |
| Gardée pour plus tard | 4 627 | 75,1 % | 67,3 % | 55,1 % |
| … puis finie en forte | 3 474 | 100 % | 80,2 % | 57,1 % |
| … jamais finie en forte | 1 153 | 0 % | 28,5 % | 49,0 % |

**Lecture.**
- Il garde **deux occasions sur trois**.
- Quand il finit plus tard, il gagne la partie aussi souvent qu'en jouant tout de
  suite : attendre ne lui coûte presque rien. Cacher son jeu serait donc
  gratuit, mais il ne le fait que par accident.
- Une fois sur quatre, la formation ne se fait jamais, et la borne tombe
  rarement. C'est le vrai coût de l'attente, dans des positions qu'on ne sait pas
  distinguer ici.
- Ce sont des corrélations : il garde sa carte dans d'autres positions que
  celles où il la joue.
- Le vrai jeu caché demande de modéliser ce que l'autre croit : c'est un levier de
  la feuille de route (`out/OLD/roadmap-experimental.html`), pas un acquis du 0.6.
- À refaire sur un auto-jeu du 0.7 : avec la revendication, finir tôt ferme la
  borne et peut arrêter la partie.

## Expérimental 0.8 : ce qui n'a pas marché

La 0.8 travaille la **qualité des simulations**, pas leur nombre : 4 000
simulations par coup ne battent pas 400 (`docs/validation.md`). Chaque candidat
est jugé par un duel long **à la règle de la page** (`npm run duel -- … --long
--page`), et gardé seulement si la borne basse de la fourchette à 95 % dépasse
50 %.

**Candidat 1 : des simulations à la règle de la revendication**
(`experimental:0.8-early`).
- Les simulations réglaient les bornes à la fin (`final`). Elles les règlent
  maintenant dès qu'elles sont pleines et s'arrêtent à la première victoire
  (`early`), comme la revendication le fait pour les bornes pleines. Réglage de
  recherche `rolloutMode`, appliqué aussi pendant la réflexion au tour adverse.
- Solveur exact jusqu'à 9 cartes au lieu de 8.
- Banc d'essai : coup gagnant trouvé 33 fois sur 60 au lieu de 30, même vitesse.
- **Duel long contre le 0.7** : 288 parties en 18 minutes, **47,9 %** (fourchette
  42,2 – 53,7 %). Aucune différence : écarté.
- À noter : dans tous les duels à la règle `early` (toutes les lignes Elo), les
  simulations tournaient déjà en `early`. Ce candidat ne changeait donc que le jeu
  dans la page.

**Au passage**, les moteurs figés `experimental:0.5` et `experimental:0.6`
héritaient du solveur exact du 0.7, parce qu'ils copiaient les réglages courants.
Ils énumèrent maintenant chaque réglage qui les distingue (`FROZEN`, dans
`src/sim/bots.js`).

**Candidat 2 : des simulations qui voient une borne perdue d'un coup d'œil**
(`experimental:0.8-lite`).
- L'idée `certainLite` : une borne est perdue quand l'autre côté est complet, que
  le mien tient deux cartes, et qu'aucune carte encore possible ne finit le mien
  au-dessus. Un seul essai par carte, là où la certitude du 0.6 énumérait toutes
  les fins.
- Choisie par `npm run policy` parmi cinq variantes : elle garde le coup gagnant
  dans 95,3 % des fins de partie décisives (90,0 % des délicates), contre 94,3 %
  (87,5 %) pour le 0.7. La température, le coût des cartes et celui des jokers ne
  bougeaient rien.
- Banc d'essai : coup gagnant trouvé 33 fois sur 60 au lieu de 30, pour 7 % de
  vitesse en moins.
- **Duel long contre le 0.7**, à la règle de la page : 288 parties en 20 minutes,
  **53,1 %** (fourchette 47,4 – 58,8 %). La tendance est pour lui, mais la borne
  basse reste sous 50 % : écarté selon la règle, **le 0.7 reste en place**.

**Ce qu'on en retient.** Deux corrections de la politique, mesurables sur les fins
de partie, ne se voient pas en partie entière : +3 points au mieux. Les simulations
se trompent surtout ailleurs, en milieu de partie, où la politique joue les deux
camps sans rien savoir de la main adverse. La suite de la feuille de route est
donc de **modéliser l'adversaire** : pondérer les donnes par ce qu'il a joué.
`certainLite` reste disponible, et pourra être remesuré avec ce modèle.

## La soirée du 30/09 : tous les leviers au banc

Protocole (`docs/validation.md`) : tri en 10 minutes à 200 simulations, puis
confirmation en 20 minutes à 400 simulations, toujours à la règle de la page et
contre le 0.7. La version ne monte que si la borne basse de la fourchette par
paires dépasse 50 %.

**Tri** (288 parties chacun, 240 pour le modèle) :

| Candidat | Idée | Score | Fourchette par paires |
| --- | --- | --- | --- |
| `ismcts` | recherche en arbre sur 3 coups (levier 4) | 54,5 % | 50,3 – 58,7 % |
| `experimental+sample=0.05` | simulations qui tirent leur coup, peu | 52,8 % | 47,6 – 58,0 % |
| `experimental+model=0.02+tries=24` | modèle de l'adversaire (levier 5) | 51,7 % | 46,1 – 57,2 % |
| `experimental+lite` | borne perdue vue d'un coup d'œil | 51,4 % | 46,4 – 56,4 % |
| `experimental+candidates=12` | 12 coups examinés au lieu de 8 | 50,0 % | 44,8 – 55,2 % |
| `experimental+prior=0.15` | moins de poids au cœur | 49,3 % | 44,1 – 54,5 % |
| `experimental+sample=0.15` | simulations qui tirent leur coup, beaucoup | 47,2 % | 42,0 – 52,4 % |
| `experimental+prior=0.6` | plus de poids au cœur | 45,8 % | 40,9 – 50,8 % |

**Confirmation** (400 simulations, 20 minutes, 288 parties) :
- `ismcts` : **49,0 %** (43,7 – 54,2 %). Le 54,5 % du tri était de la chance :
  sur huit idées triées, une sort au-dessus de 54 % par hasard seul. C'est ce
  que la confirmation sert à attraper.
- `experimental+sample=0.05` : **51,4 %** (45,8 – 56,9 %).
- les trois petites tendances ensemble (`experimental+sample=0.05+model=0.02+tries=24+lite`,
  240 parties) : **44,6 %** (39,0 – 50,1 %). Elles ne s'additionnent pas ; réunies,
  elles nuisent.

**Le modèle de l'adversaire** devine mal la main cachée
(`npm run model`) : +4,3 % de cartes justes au mieux (2,52 sur 6 au lieu de
2,42). Un seul coup de l'adversaire, lu par un cœur qui n'est pas le sien, trahit trop
peu de sa main.

**Ce qu'on en retient.** Aucun levier ne dépasse l'écart que 300 parties
savent mesurer, environ ±5 points. Les leviers bon marché sont épuisés.
- Si le 0.7 peut encore progresser de beaucoup, ce sera par un changement de
  fond : une vraie évaluation apprise par auto-jeu au lieu du cœur écrit à la
  main, ou une recherche en arbre plus profonde et bien plus rapide.
- Sinon, la marge restante est plus petite que ce qu'un duel de 20 minutes
  sait voir.

## Expérimental 0.8 : la recherche en arbre, à 800 simulations (01/10)

**La question** (`evol-exp-070-prompt.md`) : les 400 simulations par coup des
duels brident-elles les nouveaux algorithmes, comme un plafond de verre ?
Personne ne l'avait mesuré pour eux : le duel 4000 contre 400 ne portait que sur
le 0.7, qui ne gagne rien à chercher plus.

| Candidat, contre le 0.7 au même budget | 400 simulations | 800 simulations |
| --- | --- | --- |
| ISMCTS (arbre sur 3 coups) | 49,0 % (43,7 – 54,2) | **56,3 % (51,2 – 62,7)**, 288 parties en deux duels |
| TLC, simulations qui tirent leur coup | 51,4 % (45,8 – 56,9) | 50,0 % (35,6 – 64,4), tri |

- **Le plafond existait pour l'arbre.** À 400, ISMCTS fait jeu égal. À 800, il
  gagne 56 % : son arbre s'approfondit avec les itérations, là où la recherche
  du 0.7 plafonne. Les deux duels de 20 minutes, sur des donnes différentes
  (`--offset 1`), donnent 55,6 % et 56,9 %. Mis en commun, la fourchette par
  paires est de 51,2 – 62,7 % : il passe la règle.
- **À vitesse égale** : 549 itérations par seconde pour ISMCTS, 508 simulations
  pour le 0.7. Dans les 10 s de la page, il en fait 3 000 à 4 500, au-delà des 800
  mesurés.
- **Expérimental 0.8.0 = ISMCTS à 800 itérations** (moteur `ismcts@800`), Elo
  **1504 ± 40** (≈ 1010 depuis que le Basique vaut 500). Le navigateur a trouvé une régression que les tests ne voyaient
  pas : la page cherchait le moteur dans `BOTS`. C'est corrigé (`engineFor`) et
  couvert par un test.

**La mixture d'experts** (moteur `mix:A,B,C`, un expert par phase) :
- ISMCTS au milieu seulement, et le 0.7 au début et à la fin : 62,5 % contre le
  0.7 au tri (48 parties), mais **45,8 % (38,4 – 53,3) contre ISMCTS partout**.
  L'arbre vaut aussi en début et en fin de partie.
- Et le calcul « en trop » est faible : habitudes et idées ne pèsent que 13 à
  16 % du temps du cœur, dans chaque phase. Les couper par phase ne ferait gagner
  que de la vitesse, qui n'est pas la limite.

**Les cas difficiles** (`npm run hard-cases`, `npm run cases`) :
- 20 minutes pour 5 cas nets seulement. Quand le 0.7 hésite, ses coups se valent
  presque toujours pour de bon : 24 fins de partie par coup ne les départagent pas.
- Et la référence vient des simulations de l'Expérimental : elle juge avec son
  regard, et ISMCTS y fait 0 %, alors qu'il gagne plus de parties.
- Un étalon de cas difficiles a besoin d'une vérité indépendante : le solveur en
  fin de partie (puzzles, `npm run policy`), ou des parties entières.

**Le répertoire d'ouvertures** (`npm run openings`, `data/openings/`, ignoré par
git) :
- Clé canonique sur les 24 permutations de couleurs et le miroir des bornes :
  aucun doublon de couleur, 85 µs par lecture.
- Coût : 24 s par ouverture à 2 000 simulations, soit ~56 h pour tout le 1er
  coup (~191 000 ouvertures, 2,2 Mo). Le temps de calcul est la limite, pas la
  taille : 500 Mo ne serviraient qu'aux coups suivants, bien plus nombreux.
- Son coup diffère de celui du jeu en direct dans 35 % des ouvertures, sans preuve
  qu'il soit meilleur. Pour le 0.7, chercher plus ne rapportait rien. Pour
  ISMCTS, qui gagne avec le budget, un répertoire calculé à 5 000 itérations
  restait à essayer : c'est fait plus bas (« Le répertoire : le plafond »), sans
  gain.

## L'étape 2 : apprendre l'évaluation par auto-jeu (01/10, evol-exp-080)

**Pousser l'arbre (étape 1), d'après tes duels longs :**
- Profondeur 4 à 800 itérations : 53,5 % (47,2 – 59,7). Profondeur 5 : 53,5 % aussi.
- Profondeur 4 à 1 600 itérations : 56,3 % (45,5 – 67,0), sur 48 parties.
- Rien n'est net : **la profondeur 3 reste**.
- Le même total (77/144) pour 4 et 5 n'est pas un hasard de code. L'arbre
  n'ajoute qu'un nœud par itération : à 800 itérations, 12 % d'entre elles
  atteignent le 4e coup, et **0,2 %** le 5e. Les deux moteurs jouent presque
  pareil.

**Lot 2 — une valeur de position apprise** (`npm run value`, `src/sim/value.js`) :
- Une régression logistique sur 47 712 positions d'auto-jeu. Elle lit les
  chances du cœur par borne (adoucies : il est trop sûr de lui), traduites en
  chances de gagner la partie, plus les bornes closes, les jokers et la phase.
- Jugée sur des parties qu'elle n'a pas vues (Brier, plus bas = mieux) :

| Prédicteur | tours 1-14 | tours 15-29 | tours 30+ |
| --- | --- | --- | --- |
| pile ou face | 0,250 | 0,250 | 0,250 |
| valeur apprise | 0,250 | 0,232 | 0,148 |
| 8 simulations | 0,288 | 0,227 | 0,025 |
| une simulation | 0,504 | 0,382 | 0,022 |

- Avant le tour 15, personne ne prédit rien. Entre 15 et 29, la valeur vaut
  8 simulations ; après, une seule simulation fait bien mieux.

**Lot 3 — la valeur dans l'arbre** (`ismcts+value=N`, à temps égal, `@t1400`) :
- Juger les feuilles par la valeur est 1,5 à 6 fois plus rapide, mais :
  - dès le tour 1 : **40,3 % (33,1 – 47,4)**, nettement moins bon ;
  - dès le tour 15 : 43,8 % (35,8 – 51,7).
- **Écartée.** Une valeur qui prédit bien en moyenne ne départage pas les coups :
  les simulations, même bruitées, voient les différences entre deux coups
  voisins, la valeur les lisse.

**Lot 4 — régler le cœur par auto-jeu** (`npm run tune`, SPSA) :
- Dix poids du cœur qui joue les simulations, déplacés dans les directions qui
  gagnent des parties cœur contre cœur, sur les mêmes donnes : 240 manches de
  23 sondes en 15 minutes.
- Ce qui bouge le plus :
  - la température, de 0,35 à **0,25** ; elle descendait encore à la fin ;
  - le départ assorti (`suitedStart`), de 0,2 à **0,285** ;
  - l'ouverture au milieu (`openMiddle`), de 0,1 à 0,057.
- Le cœur réglé bat le cœur actuel : **52,9 % (51,7 – 54,0)** sur 6 000 parties.
  Les réglages à la main plafonnaient à +3 points ; le SPSA les règle tous
  ensemble.
- En fin de partie, il ne garde pas mieux le coup gagnant (94,0 % contre
  94,3 %, `npm run policy`) : le gain vient du milieu de partie.

**Lot 5 — valider dans l'arbre** (`npm run duel -- ismcts+core=1@800 ismcts@800 --long --page`) :
- **50,7 % (42,8 – 58,6)**, 144 parties : pas de différence nette. **Le 0.8 reste.**
- Le cœur gagne 3 points quand il joue seul, l'arbre ne les voit pas. À 800
  itérations, ce n'est plus la politique des simulations qui limite : l'arbre
  corrige déjà ses erreurs de milieu de partie.
- Ce qui reste à essayer :
  - régler le cœur **dans l'arbre** (sondes ISMCTS à 200 itérations, bien plus
    lentes que cœur contre cœur) ;
  - laisser le SPSA converger : sa température descendait encore à la fin ;
  - et surtout des **workers dans la page**, puisque le budget, lui, paie.

## Le répertoire d'ouvertures : le plafond d'abord (01/10)

**L'idée de Sami** : faire jouer le Stratège contre le 0.8, calculer en
profondeur les ouvertures des parties que le 0.8 perd, recommencer sur d'autres
donnes, puis opposer un 0.8 avec répertoire au 0.8 sans.

**Le plafond, mesuré avant de calculer** (`ismcts+open=N`) :
- Un 0.8 qui cherche ses premiers coups à 5 000 itérations joue exactement comme
  un 0.8 qui lirait un répertoire **complet** calculé à 5 000.
- 1er coup à 5 000, contre le 0.8 : **45,1 % (37,8 – 52,4)**, 144 parties, règle de
  la page.
- 3 premiers coups de chaque joueur à 5 000 : 39,6 % (27,8 – 51,4), sur
  48 parties seulement : chaque partie coûte trois recherches de près d'une
  minute.
- Aucun gain, et plutôt une tendance contraire. Le coup profond diffère du coup à
  800 deux fois sur trois, sans gagner plus : **au premier coup, les bons coups se
  valent**. Le premier coup est le plus incertain, mais pas le plus décisif :
  presque tout reste à jouer.

**Un lot du processus, pour les vrais chiffres** (`npm run openings`, donnes 0) :
- En 20 minutes, 322 parties où le 0.8 commence contre le Stratège : **121
  perdues (37,6 %)**. À la règle de la page, le Stratège résiste mieux que ses
  Elo ne le disent (mesurés à la règle `early`).
- 121 entrées, 55 s chacune sur un fil quand les 23 tournent ensemble.
- **Recouvrement : 0,06 %** des donnes neuves. Il y a environ 191 000 ouvertures,
  toutes également probables : une position perdue ne revient pas, et le
  répertoire ne sert qu'en proportion de sa taille.
- Tout le 1er coup demanderait environ 130 h à ce rythme, pour un plafond qui ne
  gagne rien.

**Décision : le répertoire est abandonné.** Une erreur ne se reproduit pas parce
qu'on a mémorisé sa position, mais parce que le jugement du robot change : le
cœur, les simulations, ou le budget de l'arbre. Le livre du 0.7
(`data/openings/book-0.7.bin`) et celui de ce lot (`book.bin`, `entries.json`)
restent sur le disque, hors de git.

## Le répertoire ciblé : les mains faibles et les fortes (01/10)

**L'idée de Sami** : ne couvrir que les deux bouts du répertoire. D'un côté, les
mains les plus faibles ; de l'autre, les mains fortes que le robot a perdues
(avec un backlog). Puis en tirer des tendances, un « Merlin des ouvertures ».

**Les classes** (`src/sim/hand-classes.js`, environ 10 % à chaque bout, comptées
exactement sur les 5 245 786 mains) :
- La version stricte des mains faibles (tout sous 6, sans paire ni cartes qui se
  suivent) ne contient **aucune main** : six cartes de cinq valeurs font toujours
  une paire.
- **Faible, 9,9 %** : pas de joker, pas deux cartes de même couleur qui se
  suivent, pas trois d'une couleur, au plus une paire, somme ≤ 36.
- **Forte, 8,9 %** : un départ (paire, cartes de même couleur qui se suivent,
  trois d'une couleur, ou joker), somme ≥ 44.
- Elles prédisent bien : dans les duels ci-dessous, le joueur qui commence avec
  une main faible ne gagne qu'environ 40 % de ses parties.
- `npm run duel -- … --hands weak|strong` ne distribue que ces mains au 1er
  joueur. L'onglet Stats compte les victoires de chacun selon sa main de départ.

**Le plafond par classe** (1er coup à 5 000 itérations, le répertoire complet de
la classe, contre le 0.8 ; 144 parties chacun, règle de la page) :
- mains faibles : **47,9 % (39,8 – 56,0)** ;
- mains fortes : **44,4 % (38,5 – 50,4)**.
- Aucune classe ne gagne. Avec les 45,1 % sur toutes les mains, les trois mesures
  réunies donnent **45,8 % (41,7 – 50,0)** sur 432 parties : chercher le 1er coup
  plus longtemps n'aide pas, et nuit peut-être un peu. Le budget profite à
  l'arbre en milieu de partie, pas au 1er coup.

**Décision** : le répertoire ciblé est écarté, comme le complet. Le backlog des
mains fortes perdues et le Merlin ne sont pas construits : ils apprendraient d'un
coup profond qui ne gagne pas plus que le coup joué. **Reste le suivi des mains
de départ dans l'onglet Stats**, pour ajuster le tir plus tard, par exemple voir
si un robot perd ses mains fortes plus souvent qu'il ne devrait.

## Les points charnières et l'élagage (01/10, merlin-is-dead)

**Quand la partie bascule** (`npm run pivots`, 200 parties entre deux cœurs
expérimentaux, règle de la page) :

| Moment | Tour médian | 10 % – 90 % |
| --- | --- | --- |
| un joueur a une carte sur les 7 bornes | 13 | 13 – 15 |
| les deux joueurs l'ont | 14 | 14 – 18 |
| la 1re borne prouvée | 22 | 18 – 27 |
| le dernier joker posé (170 parties sur 200) | 30 | 22 – 36 |
| la pioche vide | 30 | 30 – 30 |

**Pioche vide = information complète** : la seule donne possible est la vraie.
Le solveur exact, qui ne jouait qu'à 8 cartes au plus (vers le tour 34),
règle en fait **toutes** les positions dès le tour 30 :

| Cartes en main (les deux) | Résolues (400 000 positions au plus) | Temps médian | 90 % sous |
| --- | --- | --- | --- |
| 12 | 100 % | 255 ms | 2,3 s |
| 11 | 100 % | 43 ms | 0,5 s |
| 10 | 100 % | 10 ms | 0,1 s |

**Ce que ça donne en duel** (contre le 0.8, `--long --page`, 20 min) :
- résoudre dès la pioche vide (`ismcts+exact=12@800`) : **47,2 % (40,0 – 54,4)** ;
- la même chose, mais chercher quand le solveur ne trouve pas de victoire
  (`+hope=1` : pour le solveur, tous les coups perdants se valent ; pour un
  adversaire qui peut encore se tromper, non) : 48,6 % (41,1 – 56,1) ;
- budget ×4 au coup qui suit les 7 bornes adverses entamées (`+pivot=4`) :
  44,8 % (36,4 – 53,2), sur 96 parties.
- **Aucun gain.** À 800 itérations, l'arbre joue déjà presque parfaitement la fin
  de partie à information complète : il n'y a rien à reprendre aux tours 30-33.
  Et au tour 13-15, quatre fois plus d'itérations ne changent pas le coup joué.

**Pourquoi les échecs voient 10 coups et plus, et pas nous** :
- Aux échecs, tout est visible. L'alpha-bêta élague à peu près la racine du
  nombre de branches, et une évaluation fiable juge chaque feuille.
- Ici, chaque réponse adverse dépend d'une main cachée, et chaque pioche est
  un tirage : il n'y a pas de valeur exacte à comparer pour élaguer. Et aucune
  évaluation ne prédit avant le tour 15 (mesuré : la valeur apprise ne fait pas
  mieux que pile ou face). L'arbre doit tirer des donnes et jouer jusqu'au bout.
- À 800 itérations, la profondeur 3 compte déjà 8 × 4 × 4 = 128 lignes,
  soit environ 6 visites chacune.

**Les élagages essayés** (tris de 10 min à temps égal, 1,4 s par coup, contre
`ismcts@t1400`) :

| Variante | Ce qu'elle fait | Résultat |
| --- | --- | --- |
| `widen=3+depth=5` | 3 réponses au lieu de 4 sous la racine, 5 coups d'avance | **54,2 % (46,0 – 62,3)** |
| `pw=1+widen=6+depth=5` | élargissement progressif : 1 + √visites réponses, jusqu'à 6 | 52,8 % (45,1 – 60,5) |
| `widen=2+depth=5` | 2 réponses seulement | 47,2 % (39,3 – 55,2) |
| `rave=300` | les statistiques d'un coup partagées partout où il était jouable | 44,4 % (36,3 – 52,6) |

- Élaguer à 2 réponses coupe trop : le bon coup adverse n'est pas toujours dans
  les deux préférés du cœur. À 3, on gagne deux coups de profondeur pour le même
  temps.
- RAVE perd : dans ce jeu, un coup ne vaut pas la même chose un tour plus tôt ou
  plus tard. Ce sont les cartes vues entre-temps qui décident.

**La confirmation** (`npm run duel -- ismcts+widen=3+depth=5@t1400 ismcts@t1400 --long --page --offset 1`) :
- **55,9 % (50,3 – 61,5)**, 288 parties, sur d'autres donnes que le tri.
- Mis en commun avec le tri : **55,3 % (50,7 – 59,9)**, 432 parties. La règle est
  passée : c'est l'**Expérimental 0.9.0** (`ismcts+widen=3+depth=5@800`).
- Même vitesse que le 0.8 (580 contre 588 itérations par seconde,
  `npm run bench`) : chaque itération descend plus loin, mais sur moins de
  branches.
- Classement : 0.9.0 à 1032 ± 33 ce jour-là, 920 après les duels directs (plus bas).
- Le reste du lot ne passe pas : élargissement progressif 52,8 % (proche, à
  retenter combiné au 0.9), RAVE, les points charnières.

## Le classement stabilisé (01/10, duels directs gardés en replays)

Trois duels de 100 parties entre les versions actuelles, à la règle de la page,
toutes gardées dans `duels/` (avec l'avantage au tour 30) :

| Duel | Score | Fourchette à 95 % par paires |
| --- | --- | --- |
| Stratège 2.1 contre Basique | 82 % | 74,2 – 89,8 |
| Expérimental 0.9 contre Basique | 92 % | 86,9 – 97,1 |
| Expérimental 0.9 contre Stratège 2.1 | 60 % | 50,3 – 69,7 |

- **Le classement descend pour les Expérimental** : 0.9.0 à **920 ± 29** (1032
  avant ces duels ; **978 ± 30** le 02/10, une fois les duels réenregistrés avec un
  robot par partie : Stratège–Basique 85 %, 0.9–Basique 95 %, 0.9–Stratège 68 %), 0.8.0 à 892, 0.7.0 à 862, Stratège 2.1 à 811. Ils n'étaient
  reliés aux Stratège que par une chaîne de duels anciens, à la règle `early` et
  à 400 simulations. Le duel direct, à la règle de la page, dit que l'écart est
  plus petit. C'est lui qu'il faut croire.
- **L'avantage au tour 30 décide presque tout** : quand la pioche est vide, le
  camp qui gagne en jeu parfait gagne la partie dans 95 à 99 % des cas, même
  entre robots imparfaits. Les parties se jouent avant le tour 30. C'est là
  qu'un rejeu « à partir du tour 15, un seul changement » a le plus de chances
  de montrer quelque chose.

## Rejouer depuis le milieu, et le prix d'une erreur (02/10, evol-exp-090)

**Le rejeu est fidèle.** Chaque partie gardée construit ses robots à partir de
sa graine. Rejouée depuis la première borne gagnée, elle redonne la même fin,
coup pour coup, dans **100 / 100** parties du 0.9 contre lui-même
(`npm run branch -- --check`). On peut donc changer un seul coup, ou un seul
moteur, sur une position réelle, sans rejouer le début.

**Le piège : le chaos du début de partie.** Forcer une erreur et comparer au
replay gardé donnait des effets absurdes : au tour 2, une erreur « aidait » le
fautif de 20 points. Au début, n'importe quel changement rebat la suite, et la
partie redevient presque pile ou face. Le bon témoin, c'est la même suite
**sans erreur**, avec seulement la graine des robots changée (`reseed`).

**Le prix d'une erreur au hasard** (`npm run error-impact`, 0.9 contre
lui-même, mains moyennes, 30 parties par tour ; qui tient la partie au tour 30,
par le solveur exact) :

| Erreur au tour | Le fautif tient la partie : témoin | avec l'erreur | Impact (± 95 %) |
| --- | --- | --- | --- |
| 2 | 36,7 % | 40,0 % | −3 ± 15 |
| 6 | 56,7 % | 23,3 % | 33 ± 25 |
| 10 | 53,3 % | 30,0 % | 23 ± 22 |
| 14 | 43,3 % | 40,0 % | 3 ± 20 |
| 18 | 26,7 % | 36,7 % | −10 ± 20 |
| 22 | 40,0 % | 20,0 % | **20 ± 15** |
| 26 | 40,0 % | 16,7 % | **23 ± 15** |
| 29 | 66,7 % | 46,7 % | **20 ± 15** |
| au coup qui entame la 7e borne | 53,3 % | 43,3 % | 10 ± 17 |
| au coup qui gagne la 1re borne | 46,7 % | 23,3 % | **23 ± 15** |

- **Au premier coup, une erreur ne coûte rien de mesurable**, comme l'avaient
  montré les essais de répertoire.
- **À partir du tour 22, et au coup qui gagne la première borne, une erreur
  coûte nettement** : un cinquième des parties changent de camp. C'est la
  phase où les bornes se décident. C'est là qu'un meilleur jugement paierait,
  et là qu'il faut tester les prochains changements (`npm run branch --
  --from first-border`).
- Entre les tours 6 et 18, 30 parties par tour ne suffisent pas à trancher : il
  en faudrait environ 120 pour une fourchette de ± 10.

## Les pistes du 0.9 (02/10, evol-exp-090)

**Tris de 10 min à temps égal (1,4 s par coup) contre le 0.9** :

| Variante | Tri | Duel long, autres donnes |
| --- | --- | --- |
| élargissement progressif, 6 réponses, 6 coups | 60,4 % (53,2 – 67,7) | **49,0 % (43,2 – 54,7)** |
| exploration 0,5 | 56,9 % (49,4 – 64,5) | **49,0 % (43,5 – 54,5)** |
| la même exploration, sur l'élargissement progressif | 56,9 % (50,7 – 63,2) | — |
| exploration 1,0 | 52,8 % | — |
| 6 candidats à la racine | 51,4 % | — |
| 12 candidats | 47,9 % | — |
| élargissement progressif, 4 réponses, 5 coups | 45,8 % | — |

- **La leçon** : en triant 6 variantes sur les mêmes 144 parties, la meilleure
  sort à 57-60 % par hasard. Les deux confirmations, sur d'autres donnes,
  retombent à 49 %. Un tri ne désigne qu'un candidat ; seul le duel long, sur
  d'autres donnes, décide. Le 0.9 reste.
- **Les workers dans la page attendent.** Deux fois plus d'itérations
  (`0.9@1600` contre `0.9@800`) ne font que 52,1 % (42,9 – 61,3), sur 96
  parties. Paralléliser la recherche sur 8 fils ne paierait pas plus : le 0.9
  plafonne déjà avec ses 800 itérations en duel, et les 10 s de la page lui en
  donnent beaucoup plus.
- **D'autres pistes encore jamais testées** :
  - un temps de réflexion qui suit l'incertitude : s'arrêter tôt quand un coup
    domine, chercher plus quand deux coups se valent ;
  - les transpositions dans l'arbre (deux ordres de coups, une même position) ;
  - un meilleur jugement autour des tours 22 à 29 et de la première borne,
    là où une erreur coûte le plus (`npm run error-impact`) : à tester avec
    `npm run branch -- --from first-border --engine <variante>`, sur les
    positions réelles où le 0.9 a perdu.

## Le tour critique, avec 4 fois plus de parties (02/10)

600 parties de plus du 0.9 contre lui-même, gardées (363 à mains moyennes et
résolues au tour 30). Pour chaque tour, 120 parties ; à chacune, une erreur au
hasard et **deux** témoins sans erreur (`npm run error-impact -- --turns 18-29
--games 120 --explain`).

| Erreur au tour | Le fautif tient la partie : témoins | avec l'erreur | Impact (± 95 %) | Part de son avantage perdue |
| --- | --- | --- | --- | --- |
| 1 | 50,0 % | 50,0 % | 0,0 ± 9,8 | 0 % |
| 2 | 47,1 % | 55,0 % | −7,9 ± 9,3 | — |
| 3 | 50,8 % | 45,8 % | 5,0 ± 10,3 | 10 % |
| 4 | 52,5 % | 50,8 % | 1,7 ± 9,8 | 3 % |
| 5 | 50,8 % | 47,5 % | 3,3 ± 10,0 | 6 % |
| 6 | 51,7 % | 39,2 % | 12,5 ± 9,4 | 24 % |
| 7 | 46,3 % | 40,0 % | 6,3 ± 9,7 | 14 % |
| 8 | 50,8 % | 41,7 % | 9,2 ± 9,5 | 18 % |
| 9 | 45,8 % | 39,2 % | 6,7 ± 10,2 | 15 % |
| 10 | 51,7 % | 33,3 % | **18,3 ± 9,6** | 35 % |
| 11 | 50,8 % | 33,3 % | **17,5 ± 8,6** | 34 % |
| 12 | 48,8 % | 43,3 % | 5,4 ± 9,8 | 11 % |
| 13 | 54,2 % | 36,7 % | **17,5 ± 10,1** | 32 % |
| 14 | 45,8 % | 32,5 % | 13,3 ± 9,7 | 29 % |
| 15 | 57,1 % | 29,2 % | **27,9 ± 9,3** | 49 % |
| 16 | 38,3 % | 25,8 % | 12,5 ± 8,1 | 33 % |
| 17 | 62,5 % | 35,8 % | **26,7 ± 8,9** | 43 % |
| 18 | 37,9 % | 35,0 % | 2,9 ± 8,1 | 8 % |
| 19 | 64,6 % | 35,8 % | **28,7 ± 8,7** | 44 % |
| 20 | 37,5 % | 24,2 % | 13,3 ± 8,2 | 35 % |
| 21 | 57,9 % | 38,3 % | **19,6 ± 7,6** | 34 % |
| 22 | 44,2 % | 29,2 % | 15,0 ± 8,1 | 34 % |
| 23 | 57,9 % | 33,3 % | **24,6 ± 8,6** | 42 % |
| 24 | 42,1 % | 24,2 % | 17,9 ± 8,1 | 43 % |
| 25 | 61,7 % | 30,8 % | **30,8 ± 8,1** | 50 % |
| 26 | 36,7 % | 27,5 % | 9,2 ± 7,1 | 25 % |
| 27 | 64,2 % | 31,7 % | **32,5 ± 8,7** | 51 % |
| 28 | 36,3 % | 28,3 % | 7,9 ± 5,7 | 22 % |
| 29 | 64,2 % | 42,5 % | **21,7 ± 7,4** | 34 % |
| au coup qui entame la 7e borne (100) | 48,0 % | 38,0 % | 10,0 ± 10,3 | 21 % |
| au coup qui gagne la 1re borne (100) | 51,0 % | 32,0 % | **19,0 ± 8,2** | 37 % |

- **Seules les toutes premières erreurs ne coûtent rien** (tour 2). Dès le
  tour 6, une erreur au hasard coûte 10 à 20 points. **La zone la plus chère va
  du tour 19 à la pioche vide**, avec un sommet aux tours 23-27 : le fautif y
  perd **un tiers à la moitié** de ses chances de tenir la partie au tour 30.
  Le coup qui gagne la 1re borne (19 ± 8) est un vrai tour charnière ; celui
  qui entame la 7e borne l'est moins (10 ± 10).
- Réunis par paires de tours, pour effacer l'effet du siège : 18-19 : 15,8 ;
  20-21 : 16,5 ; 22-23 : 19,8 ; 24-25 : 24,4 ; 26-27 : 20,9 ; 28-29 : 14,8.
- **Les tours impairs coûtent plus que les pairs** : ce sont ceux du joueur qui
  a commencé. Dans ces parties, il tient l'avantage plus souvent (58-65 % chez
  les témoins, contre 36-44 % pour l'autre), et l'on perd plus quand on a plus à
  perdre. Rapporté à son avantage, l'écart se resserre (34-51 % contre 22-43 %).
- **Ce qui distingue une erreur qui coûte** (`--explain`) : presque rien de
  visible dans les traits mesurés. Seul signe, un peu plus de jokers en main
  (0,80-0,85 contre 0,65-0,68) : une erreur au hasard gâche parfois un joker. Le
  coût vient du coup lui-même, pas d'un type de position qu'on saurait filtrer.

**Dépenser plus là où l'erreur coûte** (`+late=K+early=E`, au même budget total
par partie, vérifié : 6 667 itérations par partie à 200 comme le 0.9) :
- ×2 à partir du tour 22, ×0,5 avant : **45,8 % (38,4 – 53,3)** ;
- ×1,5 et ×0,75 : 48,6 % (40,9 – 56,4).
- **Écarté.** Les erreurs coûtent en fin de partie, mais le 0.9 n'en fait pas
  davantage là qu'ailleurs : 800 itérations suffisent déjà, et ce qu'on enlève
  au début se paie.

**Un temps qui suit l'incertitude** (`+smart=1` : un coup s'arrête dès que son
meilleur coup ne peut plus être rattrapé, et l'épargne va aux coups serrés ;
797 itérations par coup en moyenne, contre 800) :
- 54,2 % (45,5 – 62,8) sur 96 parties, puis 50,0 % (42,2 – 57,8) sur d'autres
  donnes ; réunis, environ 51,7 %. **Écarté, pas net.**

**Pour les versions futures** :
- Le 0.9 ne gagne plus rien à redistribuer son calcul (fin de partie, coups
  serrés, points charnières) ni à en ajouter (×2 : 52 %). Sa limite est dans
  ce qu'il évalue, pas dans combien il cherche.
- C'est entre les tours 19 et 29 qu'une erreur coûte le plus. Un nouveau
  jugement (cœur, politique de simulation) se teste d'abord là, sur les
  positions réelles : `npm run branch -- --vs experimental@0.9.0 --from 23
  --engine <variante>`.

## Changer le cœur : voisinage et bonus (02/10, après la rétrospective)

**Les questions de Sami** : juger une borne avec ses voisines aide-t-il l'arbre
à mieux jouer sur la durée ? Les bonus (habitudes, idées) orientent-ils trop la
recherche en amont ?

**Le voisinage** (`neighbors`, `src/sim/ideas.js`) : le gain d'une borne est
multiplié par 1 + λ × son enjeu, c'est-à-dire la somme, sur chaque série de
trois bornes qui la traverse, du produit des chances sur les deux autres. Le
centre et la borne qui complète une série bien partie comptent plus. Il coûte
environ 12 % de vitesse (0,14 ms au lieu de 0,13 pour noter tous les coups ;
500 itérations par seconde au lieu de 556).

**Les cœurs testés** (`CORES`, `src/sim/experimental.js`) : `nb1`, `nb2` (λ = 1, 2),
`runs`, `plain` (le cœur nu, sans habitudes, idées ni certitudes). Dans l'arbre :
`+core=X`, ou un seul rôle avec `+shortlist=X` (les coups examinés) et
`+rollout=X` (les simulations).

**Un nouveau banc d'essai, depuis le tour 23** (`npm run core-test`) : sur les
600 parties gardées du 0.9 contre lui-même, la variante joue un siège puis
l'autre à partir du tour 23 ; le témoin joue les mêmes positions avec le 0.9,
graine changée ; tout est jugé au tour 30 par le solveur exact. Environ 6 min
pour 200 parties. **Il voit une vraie différence** : le Basique, depuis le tour
23, perd 13,8 ± 3,3 points.

| Variante | Seul, contre le cœur du 0.9 | Dans l'arbre, depuis le tour 23 | Partie entière, contre le 0.9 |
| --- | --- | --- | --- |
| voisinage λ = 1 | 47,0 % | +0,8 ± 2,4 | 46,9 % (37,5 – 56,3), 96 parties |
| voisinage λ = 2 | 45,1 % | +1,3 ± 2,7 | — |
| `runs` | 49,2 % | −1,8 ± 2,6 | — |
| cœur nu | 33,2 % | +0,3 ± 2,6 | **42,4 % (34,9 – 49,8)** |
| sans bonus pour les coups examinés | — | −1,3 ± 2,8 | — |
| sans bonus dans les simulations | — | −1,8 ± 3,0 | — |

- **Les bonus n'orientent pas trop la recherche.** Sans eux, le cœur seul
  tombe à 33 %, et l'arbre perd sur une partie entière (42,4 %). En fin de
  partie, ils ne changent rien : depuis le tour 23, l'arbre décide seul, quel que
  soit le cœur.
- **Le voisinage ne paie pas** : moins bon seul, neutre en fin de partie, pas net
  sur une partie entière (en baisse).
- **Où le cœur pèse** : avant le tour 23, quand l'arbre ne voit pas encore la
  fin. C'est là qu'un meilleur jugement servirait ; le banc d'essai peut partir
  plus tôt (`--from 14`, `--from first-border`), au prix d'un bruit plus grand.

## Deux phases : un cœur riche au début, un arbre profond à la fin (02/10)

**L'idée de Sami** : jusqu'au tour 20 environ, un cœur plus riche, qui juge une
borne avec ses voisines, quitte à réduire l'arbre ; ensuite, un cœur aussi
rapide que possible pour que l'arbre aille à 6 ou 7 coups d'avance. Bascule
testée aux tours 18, 20 et 22.

**Le robot à deux phases** (`src/sim/phase.js`) : `phase:<bascule>:<début>/<fin>`,
chaque moitié un moteur ordinaire avec son budget. La bascule est un tour, ou
un événement de la partie : `border` (une première borne gagnée), `board`
(les deux joueurs ont entamé les 7 bornes), `pileN` (N cartes ou moins dans la
pioche).

**Ce que coûte une itération** (ms, positions à graine fixe) :

| Moteur | Tours 4 à 16 | Tours 20 à 26 |
| --- | --- | --- |
| le 0.9 (3 réponses, 5 coups) | 2,51 | 0,86 |
| voisinage, 3 × 5 | 2,79 | 0,98 |
| voisinage, 2 réponses, 4 coups | 2,79 | 0,98 |
| cœur nu, 7 coups | 2,23 | 0,78 |

- **Réduire l'arbre ne libère pas de temps** : presque tout est dans la
  simulation jouée jusqu'au bout, pas dans la largeur ni la profondeur.
- **Le cœur nu ne fait gagner que 9 %** en fin de partie. À temps égal : 720
  itérations au début avec le voisinage, 880 à la fin avec le cœur nu.

**La fin de partie, depuis le tour de bascule** (`npm run core-test`, 200 parties
× 2 sièges, contre le 0.9 au témoin) : depuis 22, +0,0 ± 3,3 ; depuis 20,
+1,3 ± 3,2 ; depuis 18, −2,0 ± 3,5. **Rien** : 10 % d'itérations en plus et
deux coups de profondeur ne changent pas qui tient la partie au tour 30.

**Le début de partie** ne se mesure que sur une partie entière. Le 0.9 et ses
variantes contre le Stratège (`npm run ab`, mêmes donnes, deux sièges) coûtent
un seul camp qui cherche, mais 24 donnes prennent 6 min : un écart de 3 points
demande de l'ordre de 1 000 donnes par variante. C'est au backlog de nuit
(`ab-phase`). Le voisinage sur toute la partie donnait déjà 46,9 %.

**Donner une main forte au Stratège et une faible au robot**, pour équilibrer
le match : écarté pour le test principal. Ramener 68 % à 50 % ne rend la mesure
que 7 % plus sensible, et l'échantillon ne serait plus le jeu normal (une donne
sur 100 environ remplit les deux conditions), justement sur le début de partie
que le nouveau cœur change. Utile en question secondaire : le cœur riche
récupère-t-il mieux d'une main faible ?

## La première carte : surenchérir d'un cran, payer une ouverture (02/10)

**L'idée de Sami, tirée de ses parties** : quand l'adversaire joue sur plus de
bornes que moi, je remplis mes côtés vides de ses bornes avec une carte un cran
au-dessus de la sienne (un 3 contre un 2). Si les deux côtés finissent avec la
même figure (deux brelans, deux suites de même couleur), la somme la plus
haute prend la borne. Et dans l'autre sens, ouvrir une borne vierge offre à
l'adversaire cette même réponse.

**Deux idées** (`src/sim/outbid.js`), qui ne jugent que la première carte de mon
côté. `counter`, plus ancienne, compare des figures et ne joue qu'à partir de
deux cartes :
- `outbid` : sur une borne où l'adversaire a une carte seule et moi aucune, la
  valeur juste au-dessus reçoit un bonus. Avec `outbidWide`, seulement quand
  l'adversaire a entamé plus de bornes que moi.
- `exposure` : ouvrir une borne vierge avec un v coûte en proportion de la
  chance que l'adversaire tienne un v + 1, lue sur les cartes encore invisibles.

**Le cœur seul, contre le cœur du 0.9** (8 000 parties par duel, règle de la
page, fourchette par paires) :

| Cœur | Donnes 0 | Donnes 1 | Donnes 2 |
| --- | --- | --- | --- |
| `ob1` (outbid 0,1) | 50,6 % | 50,5 % | 51,1 % |
| `ob2` (outbid 0,2) | 51,1 % (50,2 – 52,1) | 50,4 % | 51,2 % |
| `ob4` (outbid 0,4) | 50,3 % | — | — |
| `obw2`, `obw4` (seulement en retard de bornes) | 50,3 %, 50,5 % | — | — |
| `ex1`, `ex2`, `ex4` (exposure 0,1, 0,2, 0,4) | 50,3 %, 50,2 %, 48,9 % | ex2 : 49,8 % | ex2 : 50,2 % |
| **`obex`** (outbid 0,2 + exposure 0,2) | **51,2 % (50,2 – 52,2)** | **51,9 % (50,7 – 53,1)** | **51,2 % (50,3 – 52,2)** |

- **`obex` gagne sur les trois jeux de donnes**, environ +1,4 point : petit,
  mais régulier. Les deux idées vont ensemble : `exposure` seule ne fait rien,
  `outbid` seule moins bien.
- **Elles changent vraiment le jeu** (400 parties `obex` contre `exp`) :
  1,17 surenchère par partie au lieu de 0,20 ; 3,3 bornes ouvertes à vide
  au lieu de 3,7, dont 50 % avec un 5 ou moins au lieu de 54 %.
- **La restriction « en retard de bornes »** ne fait pas mieux que la règle
  générale.
- **Reste l'arbre** : un gain du cœur seul ne passe pas toujours dans l'arbre
  (SPSA : 52,9 % seul, 50,7 % dans l'arbre). Deux duels longs
  `ismcts+…+core=obex@800` contre le 0.9 sont au backlog (`duel-obex-0`,
  `duel-obex-1`).

## Choisir son jeu : brelans ou suites de couleur (02/10)

**Les remarques de Sami** :
- Dès qu'une borne est complète de mon côté, il faut choisir son jeu entre les
  suites de couleur et les brelans : on ne peut pas toujours avoir les deux, et
  il est plus facile de finir avec des brelans partout, ou des suites partout,
  qu'avec un mélange.
- Avec une main faible au début, mieux vaut partir sur des brelans que sur des
  suites de couleur basses, qu'une suite plus haute dépassera presque à coup
  sûr.
- Pour mélanger les deux, les brelans vont plutôt aux bouts (1-2, 9-10) et les
  suites au milieu (4-5-6). Un brelan de 5 coupe en deux toutes les suites qui
  passent par le 5 (3-4-5, 4-5-6, 5-6-7), et cela dans trois couleurs.
- Le joker se place plutôt sur un brelan du milieu : il y remplace une vraie
  carte, et le brelan ne bloque plus que deux couleurs.

**Quatre idées** (`src/sim/shapes.js`). Chacune juge un côté de deux ou trois
cartes, dès que sa figure se lit ; une carte seule, avec ou sans joker, peut
encore devenir l'une ou l'autre :
- `plan` : la figure la plus fréquente de mes côtés complets est le plan ; un
  côté qui la suit gagne le poids, un côté qui part dans l'autre sens le perd.
- `ends` : une vraie carte qui bâtit un brelan paie le poids × la part des
  suites qu'il coupe (0 pour 1 et 10, ½ pour 2 et 9, 1 de 3 à 8) ; un joker sur
  un brelan reçoit ce même montant. `endsReal: 0` ne garde que le joker.
- `midRuns` : une suite de couleur gagne le poids au centre des valeurs, et le
  perd autant aux deux bouts.
- `weakRuns` : une suite de couleur basse paie le poids × la hauteur qui lui
  manque (1 − carte haute / 10).

**Le cœur seul, contre le cœur du 0.9** (6 000 à 8 000 parties par duel,
règle de la page, fourchette par paires) :

| Cœur | Poids 0,1 | Poids 0,2 | Poids 0,4 |
| --- | --- | --- | --- |
| `plan` | 49,5 % | 48,0 % (47,0 – 49,1) | 47,7 % (46,6 – 48,7) |
| `ends` | 47,7 % (46,6 – 48,7) | 47,9 % | 47,2 % |
| `ends`, le joker seul | — | 50,6 % ; 50,5 % sur d'autres donnes | 50,2 % |
| `midRuns` | 50,5 % ; 50,3 % et 50,2 % sur d'autres donnes | 50,1 % | — |
| `weakRuns` | 49,5 % | 49,2 % | — |
| les quatre (0,15) | 45,9 % (44,8 – 47,1) | — | — |
| les quatre avec `obex` | 45,5 % (44,3 – 46,6) | — | — |

- **Écarté, pas de duel long.** `plan` et `ends` font nettement perdre ; le
  joker seul et `midRuns` restent dans le bruit (+0,2 à +0,6) ; ensemble, les
  quatre perdent 4 points, et ils effacent le gain de `obex`.
- **Pourquoi, sans doute** : le cœur estime déjà la chance de chaque côté face
  à ce que l'adversaire y bâtit, cartes invisibles comprises, et il sait qu'une
  suite de couleur bat un brelan. Une règle de forme le tire loin de ce calcul.
  Et une partie se gagne avec 4 bornes, ou 3 côte à côte : finir les 7 dans une
  même figure n'est pas le but.
- **Le temps d'un duel cœur contre cœur** : environ 15 ms pour une partie sur
  un fil, à la règle de la page ; 8 000 parties en 13 à 21 s sur les 23 fils,
  backlog de nuit en cours. Une idée à trois poids, confirmée sur deux autres
  jeux de donnes : environ 2 min.

## Des règles tirées des replays (02/10)

**La demande de Sami** : chercher dans les parties gardées des règles de haut
niveau, vraies dans 80 % des parties gagnées, ou des perdues (70 % à défaut).
Pas « un 7 de cœur », mais le moment du coup (la phase, après une borne gagnée
ou perdue, en retard de bornes ouvertes, la main de départ) et ce qu'il fait
(ouvrir une borne vierge, répondre, bâtir un brelan ou une suite de couleur,
jouer face à un côté plein).

**L'outil** : `npm run rules` (`scripts/rules.js`, traits dans
`src/replay/move-features.js`), 10 s sur les 3 248 parties décidées de
`duels/`. Deux lectures :
- **par paires** : dans la même partie, le gagnant le fait-il plus souvent que
  le perdant ? La donne est la même pour les deux, sa chance s'annule surtout ;
- **par partie** : vrai (au moins une fois, ou sur la plupart des coups du
  moment) dans X % des parties gagnées contre Y % des perdues. Une règle vraie
  dans 80 % des gagnées et 80 % des perdues ne dit rien : seul l'écart compte.

Les parties entre robots de même force (3 048) et de force inégale (200, où le
gagnant est surtout le plus fort) sont séparées. Résultats complets :
`data/rules-mining.json`.

**Ce qui ressort, à 70 % et plus** :
- **Aucune règle par paires n'atteint 80 %** ; une dizaine dépasse 70 %.
- **La plupart décrivent la chance ou l'avance, pas un choix** : jouer à côté
  d'une borne gagnée (96 % des gagnées, 69 % des perdues), c'est d'abord en
  avoir gagné une ; jouer un joker en fin de partie (78 % / 48 %), c'est en avoir
  pioché un.
- **Quatre sont des choix**, transformées en idées du cœur (`src/sim/mined.js`) :

| Règle (lecture par paires) | Idée | Poids 0,1 | Poids 0,2 |
| --- | --- | --- | --- |
| le perdant bâtit plus de côtés ni brelan ni suite de couleur (73 % des parties en fin de partie : 59 % de ses coups contre 41 %) | `junk` : un tel côté coûte le poids | 52,8 % | **53,6 % (52,5 – 54,6)** |
| le gagnant joue plus face à un côté adverse plein (92 % / 75 %) | `facing` : bonus | 48,0 % | 48,3 % |
| contre le 0.9, le perdant répond plus bas à une carte seule (73 % ; 25 % de ses coups du début contre 12 %) | `underbid` : malus | 50,3 % | 49,8 % |
| le gagnant joue plus à côté d'une borne gagnée (71 %) | `nextToWon` : bonus | 50,6 % | 50,0 % |

- **`junk` se confirme** : 53,6 %, 52,9 %, 53,0 % sur trois jeux de donnes (au
  poids 0,2 ; 0,3 à 0,6 ne font pas mieux, autour de 52,5 %). C'est le plus gros
  gain du cœur depuis `connector`.
- **Avec `obex`** (cœur `jkx` : junk 0,2, outbid 0,2, exposure 0,2) : 53,6 %,
  54,3 %, 54,7 %. Les deux s'additionnent.
- **`facing` fait perdre** : jouer face à un côté plein est surtout ce qui
  arrive au gagnant, pas ce qui le fait gagner — exactement le piège de la
  corrélation.
- **Au backlog** : deux duels longs pour `jkx`, deux pour `junk` seul, dans
  l'arbre du 0.9, avant ceux de `obex`.

## Les jokers dans les replays, et « présent chez les gagnants, absent chez les perdants » (02/10)

**La lecture de Sami** : une règle « vraie dans 80 % des cas » est un coup que
l'on trouve dans les parties gagnées et presque pas dans les perdues. La mesure
est donc la part des fois où celui qui joue le coup gagne la partie (50 % au
hasard entre robots de même force). `npm run rules` l'affiche en premier.

**Les jokers** (`npm run jokers`, `src/replay/joker-features.js`) : les 4 250
jokers posés dans les 3 048 parties entre robots de même force, lus par ce
qu'ils rejoignent (brelan, suite de couleur, carte seule ; milieu 4-7 ou
bouts), la borne (centre, bord), et ce qu'il y a en face.
- **Celui qui pose un joker gagne 62 % des parties** : tenir un joker est déjà
  un avantage. C'est la base à laquelle comparer un placement, pas 50 %.
- **Le cœur les pose déjà tard et sur des brelans** : 84 % en fin de partie, 92 %
  pour compléter un brelan. L'habitude `joker` ne l'autorise qu'à compléter une
  paire ; aucun joker sur une suite de couleur.
- **Le meilleur placement : face à un côté adverse plein** — la borne est gagnée
  99 % du temps, la partie 74 %. Face à une carte seule ou un début de suite
  adverse : 54 à 55 %. Un joker sur une carte seule, aux bouts : 41 %.
- **Brelan du milieu ou des bouts** : 64 % contre 63 % des parties, 94 % contre
  91 % des bornes. Un léger avantage au milieu, comme le pensait Sami.

**Les idées joker** (`src/sim/joker-ideas.js`) — les premiers bonus qu'un joker
reçoit : `ideasBonus` ne lisait que les vraies cartes. Le volet joker de `ends`,
testé plus haut, n'avait donc jamais joué.

| Idée | Cœur seul, contre le cœur du 0.9 |
| --- | --- |
| `jokerFull` : bonus face à un côté plein (0,1 / 0,2 / 0,4) | 50,0 % / 49,8 % / 49,9 % |
| `jokerWait` : malus tant que le côté adverse est ouvert | 50,0 % / 49,6 % / 49,5 % |
| `jokerMid` : bonus sur un brelan de 4 à 7 | 50,0 % / 49,7 % / 50,2 % |
| `jokerRuns` : le joker peut aussi compléter une suite de couleur | 50,7 %, 50,7 %, 51,0 % sur trois jeux de donnes |
| `jkx` + `jokerRuns` (cœur `jkxr`) | 53,7 %, 54,3 %, 54,2 % : comme `jkx` seul |

- **Le placement ne change rien** : le cœur fait déjà ce que les replays
  montrent (tard, sur un brelan, souvent face à un côté plein).
- **`jokerRuns`** gagne un peu, régulièrement (+0,8), mais n'ajoute rien à `jkx`.

**La lecture de Sami sur tous les coups** :
- **Entre robots de même force, aucune règle n'atteint 80 %, ni 70 % pour un
  choix.** Le plus haut côté gagnant : un joker après une borne gagnée (71 %),
  qui dit l'avance. Côté perdant : jouer à côté d'une borne perdue au milieu de
  la partie (65 %).
- **Entre robots de force inégale** (200 parties), on dépasse 80 % : avec moins
  de bornes ouvertes que l'adversaire, le gagnant pose une 2e carte ou bâtit
  une suite de couleur (80 à 83 %) ; le perdant ouvre encore avec une carte forte
  (86 %). Transformée en idée (`deepen` : une 2e carte quand l'adversaire a
  entamé plus de bornes), elle est neutre (50,0 à 50,3 %) : le 0.9 le fait déjà,
  la règle décrivait l'erreur du Basique.

## Le piège du joker (02/10)

**L'idée de Sami** : avec un joker en main, poser une paire dont les deux
autres cartes sont déjà en jeu. Pour l'adversaire, ce brelan n'aboutira
presque jamais : il part sur une couleur ou une suite. Puis le joker tombe, et
la borne est gagnée.

**Dans les replays** (`npm run jokers`, 3 048 parties entre robots de même
force) — une paire posée avec un joker en main :

| Paire | Nombre | Finie au joker | Borne gagnée | Partie gagnée |
| --- | --- | --- | --- | --- |
| morte (les 2 autres cartes déjà en jeu) | 2 323 | 57 % | 78 % | 60 % |
| vivante | 4 641 | 49 % | 74 % | 58 % |

Le piège arrive souvent (0,76 fois par partie) et paie un peu mieux qu'une
paire vivante : le cœur le joue déjà, sans le savoir, puisqu'il compte le joker
de sa main pour finir la paire.

**En cœur contre cœur** (`jokerTrap`, `src/sim/joker-ideas.js` : bonus pour la
2e carte d'une paire morte, joker en main) : 50,0 %, 50,3 %, 50,2 %, 49,7 % aux
poids 0,1 à 0,8. **Neutre**, et c'est attendu : un robot ne se fait pas piéger.
Le cœur adverse ne lit pas de signal, il compte les cartes invisibles, jokers
compris : une paire morte reste pour lui une menace tant qu'un joker manque.
Le piège joue sur la lecture d'un humain, que seuls des parties contre Sami ou
d'autres joueurs pourraient mesurer.

## Les bornes gagnées avec des cartes faibles : des pièges ? (02/10)

**La question de Sami** : les bornes gagnées avec 1-2-3 ou 1-1-1, que s'est-il
passé ? Des pièges ?

**`npm run weak-wins`** (`scripts/weak-wins.js`) : sur les 18 789 bornes gagnées
des 3 348 parties gardées, **2 928 (16 %)** l'ont été avec des cartes de 1 à 3
seulement (joker admis).

| Ce qui s'est passé | Cartes 1-3 | Toutes les bornes |
| --- | --- | --- |
| gagnée par une figure plus haute que celle d'en face | 33 % | 28 % |
| gagnée sur preuve, l'autre côté inachevé | 65 % | 61 % |
| en face : suite simple ou somme | 15 % | 18 % |
| en face : cartes hautes (moyenne 6 ou plus) | 42 % | 40 % |
| borne ouverte par le gagnant | 55 % | 52 % |
| le gagnant a fini son côté le premier | 73 % | 69 % |
| l'adversaire a encore joué dessus après | 18 % | 16 % |
| la partie aussi est gagnée | 67 % | 67 % |

- **Le côté faible est un brelan (77 %) ou une suite de couleur (21 %)** ; en
  face, un côté inachevé (65 %), une couleur (17 %) ou une somme (12 %). C'est
  la figure qui bat la hauteur : un brelan de 1 bat une couleur 8-9-10.
- **Leur histoire ressemble à celle des autres bornes**, à 2 à 5 points près :
  rien ne les distingue comme un piège.

**Un début bas, pour l'adversaire** (3 048 parties entre robots de même force,
chaque côté qui commence par une paire ou deux cartes de même couleur à deux
valeurs ou moins d'écart) :

| Début de côté | Borne gagnée | Cartes adverses posées ensuite | Nombre |
| --- | --- | --- | --- |
| paire basse (1-3) | 58 % | 1,09 | 3 525 |
| paire moyenne (4-7) | 71 % | 0,89 | 3 132 |
| paire haute (8-10) | 75 % | 0,80 | 2 584 |
| suite de couleur basse | 53 % | 1,25 | 3 922 |
| suite de couleur moyenne | 68 % | 1,04 | 6 580 |
| suite de couleur haute | 66 % | 0,99 | 2 372 |

- **Ce n'est pas un piège, c'est l'inverse** : un début bas attire l'adversaire
  (+0,2 à +0,3 carte posée en face) et se perd plus souvent (58 % contre 71 à
  75 % pour une paire). Quand il gagne, c'est que la figure a tenu.
- **Les suites de couleur gagnent le plus au milieu** (68 %), un peu moins en
  haut (66 %), nettement moins en bas (53 %) : l'intuition de Sami sur les
  suites du milieu et les suites basses se voit dans les parties. Le cœur la
  connaît déjà (`midRuns`, `weakRuns` neutres ou en baisse plus haut) : il note
  une borne d'après sa figure et sa somme.

## L'appât : des suites et brelans faibles pour vider la main adverse (02/10)

**L'idée de Sami** : poser des débuts bas (brelan ou suite de couleur) sur des
bornes qui ne comptent ni pour moi ni pour l'adversaire, pour y attirer ses
suites de couleur puissantes — des cartes qui lui manqueront là où ça compte.
L'arbre pourrait voir à travers ; et en cœur contre cœur ?

**`bait`** (`src/sim/bait.js`) : ma zone est la série de trois bornes côte à côte
où mes chances additionnées sont les meilleures, celle de l'adversaire la
série où les siennes le sont. Une borne hors des deux est un appât ; une carte
de 1 à 3 qui y commence ou y prolonge une paire basse ou une suite de couleur
basse reçoit le poids.

| Poids | Donnes 0 | Donnes 1 | Donnes 2 |
| --- | --- | --- | --- |
| 0,1 | 50,9 % | 50,0 % | 51,0 % |
| 0,2 | 49,5 % | — | — |
| 0,4 | 50,8 % | 49,6 % | 50,6 % |

**Neutre.** Ce qui se passe (600 parties, poids 0,4, contre le cœur du 0.9) :

| | Cœur du 0.9 | Avec l'appât |
| --- | --- | --- |
| départs bas (paire ou suite de couleur) par partie | 1,26 | 1,47 |
| cartes adverses posées en face, par départ bas | 1,29 | 1,48 |
| dont cartes de 7 ou plus | 0,58 | 0,62 |
| borne appât gagnée | 51 % | 46 % |

- **L'appât est tendu et l'adversaire mord un peu** : il pose 0,2 carte de plus
  en face, mais presque pas de cartes hautes en plus (+0,04) — ses suites de
  couleur puissantes ne sont pas vidées.
- **L'appât se paie** : la borne est perdue plus souvent. Les deux s'annulent.
- Contre un humain, qui lit une paire basse comme une borne facile, l'appât
  mordrait peut-être plus fort ; entre robots, l'adversaire compte les cartes
  sans lire d'intention.

## Le prix d'une erreur aux tours 6 à 14 (backlog de nuit, 02/10)

`npm run error-impact -- --turns 6-14 --games 120 --explain` : 120 parties par
tour, deux témoins chacune, 167 min. Les neuf tours sont dans le tableau du
« tour critique » plus haut (les mesures à 100 parties des tours 10 et 14 sont
remplacées ; le tour 6 retombe exactement sur la mesure d'avant : à graine
égale, le banc est reproductible).

- **Une erreur au milieu coûte 12 ± 3 points en moyenne** (tours 6 à 14), contre
  **20 ± 2** de 19 à 29. Le début du milieu coûte un peu moins (6-9 : 8,7 ± 4,9)
  que sa fin (10-14 : 14,4 ± 4,3).
- **Le « pic du tour 10 » n'en est pas un** : 18,3 ± 9,6, autant que les tours 11
  (17,5) et 13 (17,5), alors que 12 tombe à 5,4. À ± 10 points par tour, ces
  écarts sont du bruit ; seule la pente compte. Par paires de tours : 6-7 : 9,4 ;
  8-9 : 8,0 ; 10-11 : 17,9 ; 12-13 : 11,5.
- **`--explain` ne voit rien au milieu** : les traits mesurés (bornes
  disputées, côtés complets, jokers, pioche) sont les mêmes pour une erreur qui
  coûte et une erreur sans effet — à ce stade, les 7 bornes sont ouvertes et
  aucune n'est disputée. Ces traits ont été pensés pour la fin de partie.
- **Pour les versions futures** : le milieu (10-14) vaut déjà les deux tiers de
  la zone chère. C'est là qu'un meilleur jugement du cœur paierait (`jkx` y
  agit : côtés sans figure, surenchère, ouverture), avant que l'arbre ne voie la
  fin.


## L'oracle sur les replays (03/10, en cours)

**L'idée de Sami** : il ne trouve plus, en jouant, ce que le cœur rate. Un
arbre très large sur des positions réelles le trouvera peut-être : un coup que
l'arbre préfère et que le cœur ne met pas dans son top 3 est une omission du
cœur, donc une piste d'évolution.

**Ce que regarde le 0.9** : à la racine, les **8** meilleurs coups du cœur
(`candidates`) ; en dessous, ses **3** meilleures réponses (`widen`). Un coup
hors du top 8 n'est jamais examiné.

**L'oracle** (`npm run oracle`, `src/replay/oracle.js`) :
`ismcts+candidates=99+widen=6+depth=5@20000`, soit **tous** les coups légaux à
la racine (jokers refusés par l'habitude compris), 6 réponses par nœud, 25 fois
le budget du 0.9. Deux recherches de graines différentes ; un **écart** est leur
coup commun hors du top 3 du cœur (et noté s'il est hors du top 8).
- Positions : tours 15-16, 20-21 et 25-26 des 600 parties du 0.9 contre lui-même
  (les deux joueurs) ; et, avec `--at last-column`, le coup où chaque joueur
  remplit sa dernière colonne vide (1 187 positions, tour médian 16 — l'intuition
  de Sami : ce coup pèse lourd sur la suite).
- **Le coût** : 1,5 à 2,5 min de calcul par position au tour 25, environ 6 min
  au tour 15 (42 coups légaux) — cinq fois l'estimation faite sur le 0.9, l'arbre
  étant bien plus large. Environ 10 à 14 s par position sur 23 fils.
- **Deux économies** (Sami : ne pas perdre de temps) : une recherche s'arrête
  dès que son coup favori ne peut plus être rattrapé (`+smart=1`), et la
  seconde recherche, celle qui vérifie que la première n'a pas eu de chance,
  n'est lancée que si la première sort du top 3 du cœur — ailleurs il n'y a pas
  d'écart à confirmer.
- **Le backlog plafonne chaque traitement à 2 h** (`limit`, arrêté au-delà avec
  tous ses processus) ; l'oracle s'arrête de lui-même à 110 min.
- Chaque position est écrite dès qu'elle est lue (`oracle/positions.jsonl`, hors
  de git) ; une nouvelle passe reprend où la précédente s'est arrêtée. Le résumé
  va dans `data/oracle-diffs.json`.
- **Ensuite** : confirmer chaque écart par le jeu (le coup de l'oracle contre le
  premier du cœur, suite jouée par le 0.9, jugée au tour 30 ; `branchFrom` accepte
  désormais un coup à forcer), puis chercher les motifs.

## Les résultats de la nuit du 03/10

**Dans l'arbre, contre le 0.9** (duels longs, règle de la page, deux jeux de
donnes réunis) :

| Cœur | Donnes 0 | Donnes 1 | Réunis |
| --- | --- | --- | --- |
| `jkx` (junk + obex) | 48,6 % | 54,9 % | 51,7 % (46,6 – 56,9), 144 paires |
| `jk2` (junk seul) | 54,9 % | 50,0 % | 52,4 % (47,0 – 57,8), 144 paires |
| `obex` | 49,5 % | 51,6 % | 50,5 % (45,8 – 55,2), 192 paires |

- **Rien de net.** Le gain du cœur seul (+4 pour `jkx`) passe en partie dans
  l'arbre (environ +2), mais un duel de 20 min (144 à 192 parties) ne voit pas
  2 points. Quatre duels de plus pour `jkx` (`--offset 2` à `5`) porteront le
  total à environ 430 paires, soit ± 3 points.
- **Les deux phases, sur des parties entières** (`npm run ab`, 400 donnes contre
  le Stratège) : le 0.9 fait 66,8 % ; bascule au tour 20 : −1,3 ± 4,2 points ;
  bascule à la première borne : −2,0 ± 4,3. **Écarté.**

**Le prix d'une erreur, complet de 1 à 29** (les tours 1, 3-5 et 15-17 dans le
tableau du « tour critique ») :
- **Tours 1 à 5 : 0,4 point en moyenne.** Le brouillard du début se confirme.
- **Tours 15 et 17 : 27,9 et 26,7 points**, autant que le cœur de la zone chère.
  **Elle commence donc au tour 15**, pas au tour 19 : de 15 à 29, une erreur
  coûte 19,4 ± 2,1 points en moyenne, contre 11,9 ± 3,2 de 6 à 14. Le tour 18
  (2,9 ± 8,1) paraît isolé, sans doute du bruit.

**L'oracle au coup qui remplit la dernière colonne vide** (1 187 positions,
99 min) — **non confirmé** :
- l'oracle ouvre aussi une colonne vide dans 36,6 % des cas, et **joue ailleurs
  dans 63,4 %** ;
- il joue le coup du 0.9 dans 22,6 % des cas ;
- un écart stable hors du top 3 du cœur dans **50,1 %** des positions, hors du
  top 8 dans environ 37 % ;
- son favori reçoit en médiane 27 % des visites, avec 0,115 d'avance sur le second.

Ce taux d'écart est trop haut pour être pris tel quel : soit le cœur rate
beaucoup, soit l'oracle (simulations jouées par le cœur, 6 réponses par nœud)
se disperse. **Rien ne dit encore que l'oracle joue mieux que le 0.9.** La
confirmation par le jeu (le coup de l'oracle contre celui du cœur et celui du
0.9, suite jouée par le 0.9, jugée au tour 30) passe avant toute recherche de
motifs.

**La vitesse de l'oracle** : 3,7 s par position sur tous les fils, au lieu des
10 à 14 s estimées — les correctifs de vitesse du cœur, la seconde recherche
seulement quand il faut, l'arrêt anticipé.

**Les temps du cœur de la rétrospective** sont désormais une donnée
(`data/core-timings.json`), remesurée seulement par `npm run retrospective --
--measure`, sur une machine au repos : la page construite pendant le backlog
affichait 120 itérations par seconde au lieu de 556.

**La confirmation par le jeu** (`npm run oracle -- --confirm`,
`scripts/lib/oracle-confirm.js`) : pour chaque écart, le coup de l'oracle, le
premier du cœur et celui du 0.9 sont forcés, puis la partie est jouée par le
0.9 des deux côtés sur 4 graines et jugée au tour 30 par le solveur exact. Le
verdict d'ensemble est l'avance moyenne du coup de l'oracle sur celui du cœur
et sur celui du 0.9, par groupe (dernière colonne, tours fixes, marge de
l'oracle, hors du top 8). Un essai sur 3 écarts : 3,5 à 10 min de calcul par
écart, machine chargée. Les 1 176 écarts trouvés à 9 h passent la nuit du
03/10 (deux traitements de 110 min, programmés à partir de 21 h). Dans 196 de
ces écarts, le coup de l'oracle est celui que le 0.9 avait joué : son arbre
l'avait trouvé, hors du top 3 du cœur.

**L'oracle sur toutes les positions** (4 331 positions lues le 03/10, en
3 h 30 au total) — **non confirmé**, la confirmation par le jeu passe la nuit
suivante :

| Positions | Nombre | Écart hors du top 3 du cœur | hors du top 8 | L'oracle joue le coup du 0.9 |
| --- | --- | --- | --- | --- |
| tours 15-16 | 858 | 60 % | 40 % | 23 % |
| tours 20-21 | 1 105 | 56 % | 35 % | 25 % |
| tours 25-26 | 1 181 | 48 % | 31 % | 27 % |
| dernière colonne | 1 187 | 50 % | 37 % | 23 % |

- Les deux joueurs donnent les mêmes taux : celui qui a commencé 53,9 %
  d'écarts, l'autre 52,3 %.
- **Ce qui distingue le coup de l'oracle du premier coup du cœur**, sur les
  2 300 écarts :

  | Trait | oracle | cœur |
  | --- | --- | --- |
  | bâtit un côté ni brelan ni suite de couleur | 33 % | 9 % |
  | répond à une borne adverse | 7 % | 30 % |
  | pose une 2e carte | 65 % | 51 % |
  | complète un côté (3e carte) | 27 % | 17 % |
  | ouvre sans suite prévue en main | 4 % | 18 % |
  | joker | 14 % | 4 % |

- **L'oracle approfondit plutôt qu'il n'élargit** : il reste sur ses côtés déjà
  entamés au lieu de répondre ou d'ouvrir. Et il bâtit bien plus de côtés sans
  figure, à l'inverse de la règle `junk` — ce qui pourrait être une façon de
  sacrifier une borne pour en tenir d'autres.
- **Tant que la confirmation n'a pas parlé, ce sont des pistes, pas des
  règles** : l'oracle joue ses simulations avec le cœur, et ses écarts
  pourraient venir de sa dispersion (son favori ne reçoit que 27 % des visites
  en médiane). Le résumé est dans `data/oracle-diffs.json` (les taux et ce
  comparatif ; les écarts eux-mêmes restent dans `oracle/positions.jsonl`).

## Pousser le cœur dans le sens de l'oracle (03/10)

**L'idée de Sami** : des bonus qui alignent le cœur sur les écarts de l'oracle,
testés un par un puis ensemble, en cœur contre cœur (machine libre, 3 min 30
de calcul en tout).

**Les idées** (`src/sim/oracle-ideas.js`) : `stay`, une carte sur un côté déjà
commencé ; `noAnswer`, un malus pour répondre à une borne adverse ;
`noBlindOpen`, un malus pour ouvrir une borne vierge sans rien en main pour y
bâtir. Les côtés sans figure sont `junk` à poids négatif, et les jokers libres
un cœur sans l'habitude `joker`.

| Cœur | Contre le cœur du 0.9 |
| --- | --- |
| `stay` 0,1 / 0,2 | 48,6 % / 50,9 % (puis 49,7 % et 50,1 %) |
| **`stay` 0,4** | **51,9 %, 50,7 %, 52,1 %** |
| `stay` 0,8 | 44,5 %, 45,8 % |
| `noAnswer` 0,1 / 0,2 | 50,4 % (puis 50,2 %, 50,3 %) / 50,0 % |
| `noBlindOpen` 0,1 / 0,2 | 50,0 % / 50,3 % |
| `junk` à −0,1 / −0,2 (des côtés sans figure, comme l'oracle) | **44,3 % / 38,8 %** |
| sans l'habitude `joker` | 48,9 % |
| tout ensemble (0,1 / 0,2), sans `junk` négatif | 45,5 % / 47,8 % ; 49,1 % |

- **Rester sur ses côtés déjà entamés paie, au bon poids** : `stay` à 0,4 gagne
  sur les trois jeux de donnes ; à 0,8 il perd nettement.
- **Les côtés sans figure de l'oracle font perdre le cœur** (44 % et 39 %) : ils
  donnent raison à `junk`. Si l'oracle voit juste, c'est qu'il les bâtit pour
  une raison que le cœur ne voit pas (sacrifier une borne) ; la confirmation de
  ce soir le dira.
- **Le reste est neutre** : répondre ou non, ouvrir sans figure prévue.
- **Avec `jkx`** (cœur `jkxs` : junk 0,2, outbid 0,2, exposure 0,2, stay 0,4) :
  51,6 %, 52,1 %, 52,0 % contre `jkx`, et **55,5 %, 54,7 %, 54,5 %** contre le cœur
  du 0.9 — le meilleur cœur à ce jour. Deux duels longs dans l'arbre sont au
  backlog de ce soir (`duel-jkxs-0`, `-1`), avant ceux de `jkx`.

## `stay` dans l'arbre, et la variante gagnante : `stfig` (03/10)

**Dans l'arbre, à 400 itérations, en miroir** (chaque donne jouée des deux
sièges), 10 min :
- le 0.9 avec `stay` 0,4 contre le 0.9 : **58,3 % (52,1 – 64,6)**, 96 paires ;
- le 0.9 avec `stfig` 0,6 contre le 0.9, sur d'autres donnes : 54,9 %
  (47,8 – 61,9), 72 paires.
- Deux tendances positives, mais à ± 7 points : les tris de 10 min ont déjà
  trompé (57-60 % retombés à 49 %). Les duels longs de ce soir trancheront.

**Depuis le tour 10** (`npm run core-test -- … --from 10`, 100 parties) :
`stay` 0,4 fait −0,5 ± 6,0 points. Si son effet est réel, il se joue avant le
tour 10, quand on choisit entre approfondir et ouvrir : une partie entière est
la bonne mesure.

**Les variantes de `stay`, cœur contre cœur** (paramètres de
`src/sim/oracle-ideas.js`) :

| Cœur | Contre le cœur du 0.9 |
| --- | --- |
| `stay` 0,3 / 0,4 / 0,5 | 50,8 % / 51,9 % / 52,6 % |
| seulement la 2e carte / seulement la 3e | 50,9 % / **44,6 %** |
| jusqu'au tour 20 / à partir du tour 20 | 51,9 % / 49,1 % |
| seulement si l'adversaire a entamé autant de bornes ou plus | 52,2 % |
| **seulement si le côté peut encore devenir un brelan ou une suite de couleur (`stfig`)** | 0,4 : 55,1 %, 55,6 %, 56,8 % |
| **`stfig` 0,6** | **58,0 %, 57,9 %, 58,0 %** |
| `stfig` 0,8 / 1,0 / 1,2 / 1,5 | 57,0 % / 56,6 % / 55,5 % / 55,5 % |
| `jkx` + `stfig` 0,6 (`jkxf6`) | 57,9 %, 58,0 %, 57,6 % ; contre `stfig6` : 50,8 %, 49,2 % |

- **`stfig` 0,6 est le plus gros gain du cœur à ce jour : +8 points**, régulier
  sur trois jeux de donnes. Rester sur ses côtés entamés paie, à condition
  qu'ils gardent une figure possible.
- **`jkx` ne s'y ajoute plus** : `stfig` couvre ce que faisait `junk` (ne pas
  bâtir de côté sans figure), par l'autre bout.
- **Compléter un côté pour le compléter fait perdre** (seulement la 3e carte :
  44,6 %).
- **Au backlog de ce soir** : quatre duels longs de `stfig6` dans l'arbre (environ
  300 paires), à la place de ceux de `jkx` et `jkxs`.

## Des bonus seulement aux tours 1 à 10 (03/10)

**L'idée de Sami** : l'arbre est faible au début de la partie (trop de coups à
examiner) et fort ensuite. Des bonus écartés alors qu'ils gagnaient 51 % ou plus
pourraient aider aux tours 1 à 10 et nuire après. Chaque bonus est donc testé
**actif seulement aux tours 1 à 10** (`earlyIdeas`, `earlyUntil`,
`src/sim/tuning.js` : les idées s'ajoutent tant que `state.turn < 10`, dans les
vrais coups comme dans les simulations de l'arbre).

**Dans l'arbre, à 400 itérations, en miroir, 10 min par duel** (240 parties) :

| Cœur | Bonus aux tours 1-10 | Contre le 0.9 |
| --- | --- | --- |
| `jk2e10` | `junk` 0,2 | 47,9 % (42,0 – 53,9) |
| `obexe10` | `outbid` + `exposure` 0,2 | 52,1 % (46,4 – 57,8) |
| `jkxe10` | les trois | 48,8 % (42,7 – 54,8) |
| `wholee10` | `whole` | 49,2 % (43,3 – 55,1) |
| **`stay4e10`** | **`stay` 0,4** | **55,4 % (49,5 – 61,3)** |
| `stfig6e10` | `stfig` 0,6 | 51,7 % (45,5 – 57,8) |

- **Seul `stay` limité au début passe le seuil du tri (55 %).** Deux duels longs
  à 800 itérations sont au backlog de ce soir (`duel-stay4e10-0`, `-1`), comme le
  veut la règle 400 / 800.
- **`junk`, `obex`, `whole` limités au début ne gagnent rien** : leur faiblesse
  n'était pas de nuire en fin de partie.
- `stfig6` sur toute la partie (au backlog ce soir) dira si limiter `stfig` au
  début lui fait perdre ou non : ici 51,7 %.

## Les bonus du 0.9 limités aux tours 1 à 10 (03/10)

**L'idée de Sami** : les bonus du cœur du 0.9 jouent toute la partie. Les couper
après le tour 10, quand l'arbre voit assez loin, l'améliore-t-il ? Chacun est
gardé pour les tours 1 à 10 seulement (`earlyIdeas`, et pour les habitudes
`earlyHabits`, `src/sim/tuning.js`), un à la fois. `certain` n'est pas testé :
ce n'est pas un bonus, mais la connaissance exacte des bornes déjà perdues.

**Dans l'arbre, 400 itérations, en miroir, 10 min par duel** :

| Bonus gardé aux tours 1-10 seulement | Contre le 0.9 |
| --- | --- |
| `middle` (le centre seulement avec un départ solide) | 50,7 % (45,0 – 56,4) |
| `spread` (pas deux valeurs seules pareilles) | 50,0 % (44,4 – 55,6) |
| `connector` (ne pas casser un départ de suite) | 49,0 % (43,5 – 54,5) |
| habitude `joker` (le joker pour un brelan seulement) | 49,7 % (44,4 – 54,9) |
| habitude `opening` (ouvrir au milieu, une couleur nouvelle) | 50,9 % (46,1 – 55,7) |
| habitude `suited` (deux cartes qui se suivent en couleur) | 50,3 % (45,5 – 55,1) |

- **Rien ne bouge.** Couper ces bonus après le tour 10 ne gagne ni ne perd : à
  partir de là, l'arbre décide, et le cœur ne pèse presque plus (comme le
  banc depuis le tour 23 l'avait montré pour les variantes du cœur).
- Rien ne part en validation de nuit.
- Ces duels jouent 288 à 336 parties en 10 min, contre 240 pour la série
  précédente : le chemin rapide de l'évaluateur (côtés complets, paires de
  jokers) fait encore gagner environ 7 %. Remesuré sur machine libre, le 0.9
  tourne à 1 000 itérations par seconde (556 la veille).

## Les bonus du 0.9 à partir du tour 15, connector, et les simulations tronquées (03/10)

**Le coût de chaque bonus** (temps par itération de l'arbre, le bonus retiré) :
`middle` 6,6 %, `spread` 8,8 %, `connector` 13,7 %, habitude `joker` 5,2 %,
`opening` 9,9 %, `suited` 8,8 % ; les six ensemble 24,8 %. Au-delà de 3 %, une
variante se compare à temps égal (règle écrite dans `CLAUDE.md`).

**Chaque bonus actif seulement à partir du tour 15** (`lateIdeas`, `lateHabits`,
`lateFrom`, `src/sim/tuning.js` ; arbre, 400 itérations, en miroir, 10 min) :

| Bonus | Seulement aux tours 1-10 | Seulement à partir du tour 15 |
| --- | --- | --- |
| `middle` | 50,7 % | 49,3 % |
| `spread` | 50,0 % | 49,0 % |
| `connector` | 49,0 % | 54,5 % (49,5 – 59,5) |
| habitude `joker` | 49,7 % | 50,0 % |
| habitude `opening` | 50,9 % | 50,9 % |
| habitude `suited` | 50,3 % | **41,1 % (35,5 – 46,8)** |

- **`suited` sert au début** : coupée avant le tour 15, le cœur perd nettement.
  C'est le premier bonus du 0.9 dont on voit le travail.
- **`connector` à partir du tour 15** semblait gagner (54,5 %). Repris **à temps
  égal** (`@t400`), à partir des tours 11, 15 et 19 : **48,7 %, 48,5 %, 48,9 %**.
  Le 54,5 % était du bruit ; le moment où on l'active ne change rien.
- Les autres sont neutres dans les deux sens.

**Les simulations tronquées** (`ismcts+trunc=N`, `src/sim/truncate.js`, l'idée de
Sami) : une simulation s'arrête dès qu'une borne de plus est décidée (côtés
pleins, gagnant exact), après au moins N coups et tant que la pioche dure ; la
chance de gagner la partie selon le cœur (4 bornes, ou 3 côte à côte, sur les 128
façons dont les bornes peuvent tomber) tient lieu de résultat.
- Les simulations ne revendiquent jamais de borne (elles règlent tout à la fin,
  pour la vitesse) : il a fallu compter une borne « décidée » dès que ses deux
  côtés sont pleins, sinon rien n'était jamais coupé.
- **Le gain de vitesse** : 79-80 % des simulations coupées jusqu'au tour 12, pour
  17 à 27 % de temps en moins par itération ; rien après la pioche vide.
- **À temps égal** (`@t400`) contre le 0.9 : `trunc=5` **41,1 % (35,0 – 47,3)**,
  `trunc=8` **45,6 % (41,7 – 49,6)**. Plus on coupe tôt, plus on perd : juger la
  partie avant sa fin coûte plus que les ~20 % d'itérations gagnées — la même
  leçon que la valeur de position apprise (40,3 %, le 01/10).

**Le cœur dépouillé, à temps égal** (backlog du soir, `@t800` contre le 0.9
`@t800`, deux jeux de donnes chacun, réunis par paires avec `npm run versus`) :

| Cœur | Ce qu'il garde | Duels | Réunis |
| --- | --- | --- | --- |
| `nobonus` | `certain` seul | 36,9 % puis 42,6 % | **39,7 % (36,3 – 43,2)**, 672 parties |
| `lean` | `suited` et `certain` | 39,9 % puis 43,3 % | **41,9 % (38,7 – 45,1)**, 816 parties |

- **Les bonus valent bien plus que leur temps.** Sans eux, l'arbre fait un tiers
  d'itérations en plus et perd quand même nettement.
- **`suited` seul ne rachète presque rien** : deux points, dans le bruit. Coupée
  avant le tour 15, elle coûtait neuf points ; gardée seule, elle n'en rend que deux. Les
  six bonus travaillent ensemble, et aucun ne se retire sans perte.
- On le voit dans les coups : sans les autres bonus, le cœur ne pose presque plus
  de 2e carte au début (0,2-0,4 % contre 5,5 %), ne bâtit plus de suite de
  couleur avant le tour 12, et finit avec plus de côtés sans figure (2,44 contre
  2,08 pour `lean`).
- Piste close : on ne simplifie pas le cœur pour gagner du temps.

## La chance des jokers (03/10)

**La question de Sami** : quel taux de victoire avec deux jokers, un, aucun ?

Chaque partie gardée note maintenant les jokers de chaque joueur
(`src/replay/jokers-held.js`, dans l'analyse des duels et dans l'index) : ceux
de la main de départ (les 6 premières cartes du paquet pour le siège 0, les 6
suivantes pour le siège 1) et ceux piochés ensuite. `npm run jokers` en tire
les taux de victoire.

**Robots de même force** (4 008 parties, les deux côtés) :

| Jokers | obtenus dans la partie | dans la main de départ |
| --- | --- | --- |
| 0 | 36 % (1 991) | 48 % (5 870) |
| 1 | 50 % (4 038) | 56 % (2 076) |
| 2 | **64 %** (1 987) | 57 % (70) |

- **Un joker vaut environ 14 points de chances de gagner** : avoir les deux
  contre aucun, c'est 64 % contre 36 %. Presque toutes les parties vont
  jusqu'à la pioche vide, si bien que les deux jokers sont presque toujours
  tirés : « 1 joker » veut dire « un chacun » (4 034 cas sur 4 038).
- **Un joker dès la main de départ** donne 56 % au lieu de 48 %. Deux jokers en
  main de départ sont rares (70 cas) ; leur 57 % est trop incertain pour dire
  que le second ajoute peu.

**Sami contre les robots** (72 parties, son côté) : 28 % sans joker (18), 50 %
avec un (38), 56 % avec les deux (16) — la même pente, sur trop peu de parties
pour aller plus loin (± 20 points environ par case).

## Expérimental 1.0 : rester sur ses côtés tant qu'une figure y est possible (03/10)

**Ce qui change** : le cœur du 0.9 plus `stfig` 0,6 (`stay` avec `stayFigure`,
`src/sim/oracle-ideas.js`). Une carte posée sur un de mes côtés déjà commencés
reçoit 0,6, si ce côté peut encore devenir un brelan ou une suite de couleur.
Moteur : `ismcts+widen=3+depth=5+core=stfig6@800`. Le 0.9 reste `ismcts+widen=3+depth=5@800`,
et `EXPERIMENT` reste son cœur : les replays, l'oracle et les bancs qui lisent les
parties du 0.9 gardent leur sens. Les tests à venir se font contre le 1.0, avec `core=stfig6`.

**Ce qui l'a décidé** :
- l'oracle reste sur ses côtés entamés bien plus que le cœur (2e carte : 65 % de ses
  coups contre 51 %) ;
- en cœur contre cœur, `stfig` 0,6 fait 58,0 / 57,9 / 58,0 % sur trois jeux de donnes ;
- dans l'arbre, quatre duels longs à 800 itérations : 53,8 / 58,3 / 51,7 / 60,8 %,
  soit **56,1 % (53,2 – 59,1) sur 480 donnes jouées des deux côtés** (`npm run versus`).

**Le coût** : `stfig` demandait `shapeOf` à chaque coup de chaque simulation,
et l'arbre allait 24,5 % plus lentement par itération. `keepsFigure` donne la même
réponse sur les 65 763 côtés possibles, avec la même empreinte du 1.0
(`152e2a9c9d66170c`, `npm run fingerprint -- "ismcts+widen=3+depth=5+core=stfig6@150,greedy" 40`).
Le surcoût tombe à 2 % : sous les 3 % de la règle du temps égal, les duels à
itérations égales valent aussi au temps.

**Ce qu'il joue autrement** (`npm run versus`, 960 parties contre le 0.9) :

| | 1.0 | 0.9 |
| --- | --- | --- |
| tours 1-12 : pose une 2e carte | 18 % | 6 % |
| tours 1-12 : ouvre une borne vierge | 49 % | 60 % |
| tours 1-12 : bâtit une suite de couleur | 16 % | 6 % |
| tours 13-24 : répond à une borne adverse | 28 % | 17 % |
| tours 13-24 : bâtit un côté sans figure | 10 % | 20 % |
| bornes entamées au tour 10 | 4,3 | 4,9 |
| côtés complets sans figure à la fin | 1,95 | 2,29 |
| bornes gagnées | 2,97 | 2,63 |

Il approfondit au début au lieu d'ouvrir, garde ses figures possibles, et répond
plus tard, quand l'adversaire a déjà montré son jeu. Son gain ne dépend ni du
siège (54,8 % quand il commence, 57,5 % sinon) ni des jokers.

**Ce qu'en dit l'oracle** (`npm run oracle -- --disagree stfig6 --minutes 40`) :
- dans les 960 parties contre le 0.9, aux tours 5 à 16, 4 311 positions où les deux cœurs
  préfèrent un coup différent ; 470 lues, 280 où ses deux recherches s'accordent ;
- il joue le coup du 1.0 dans **13,9 %**, celui du 0.9 dans **3,6 %**, un troisième dans 82,5 % ;
- l'écart est le plus net au début : aux tours 5-8, 34 % contre 0 % ;
- reclassées par le cœur du 1.0 (`--summary --core stfig6`), ses 4 331 positions mettent
  son coup dans le top 8 dans **66 %** des cas, contre 54 % avec le cœur du 0.9 : l'arbre,
  qui n'examine que ce top 8, regarde plus souvent le coup de l'oracle.

Entre les deux cœurs, l'oracle penche nettement pour le 1.0. Mais il joue le plus
souvent un troisième coup (son favori n'a que 18 % des visites en médiane) : la
confirmation par le jeu reste ce qui dira s'il voit juste.

**Écarté le même jour** : `stay` limité aux tours 1-10 (`stay4e10`) : 55,4 % au tri à
400, puis 50,6 % (47,1 – 54,2) en deux duels longs. Les autres essais du 0.9 sont
dans `out/changelog-exp-1.0.html` (« Changelog Exp v1.0 »).

**La leçon** : les tris de 10 minutes à 400 itérations ont promu trois idées qui
n'ont pas tenu (stay 0,4 à 58,3 %, connector dès 15 à 54,5 %, stay4e10 à 55,4 %). Un
tri écarte, il ne promeut plus : voir la règle dans `CLAUDE.md` et `docs/validation.md`.

**Les versions passent à deux chiffres** (Sami) : `experimental@1.0`,
`stratege@2.1`, `basique@1.0`. Les parties enregistrées avant, en `x.y.0`, comptent
pour la même version (`shortTag`, `src/config/bots.js`).

## La base de référence V1 + Oracle : les pilotes de la nuit (04/10)

L'idée de Sami : faire de l'oracle un étalon — ses parties entières, les parties
du V1 relues par lui et inversement — pour juger une idée en minutes avant de lui
donner des duels longs. Avant d'y mettre des nuits, des pilotes. L'oracle est figé
en **version 1** (`ORACLE.version`, empreinte `c87b8b524dede38b`) ; les replays des
duels gardent désormais les 5 meilleurs candidats d'une recherche et leurs visites.

**L'oracle confirmé par le jeu** (`oracle-confirm-1`, 1 144 écarts des tours 14-26
rejoués jusqu'au tour 30 par le 0.9, 4 graines) : son coup tient **+6,3 ± 1,8 points**
de plus que le favori du cœur, **+3,1 ± 1,8** de plus que le coup du 0.9. Sûr de lui
(marge ≥ 0,15) : +3,7 ; hésitant : +1,0 ± 3,3, rien de prouvé. Au milieu de partie,
ses écarts sont de vraies leçons.

**Le banc oracle** (`npm run oracle -- --bench …`) : la part des positions où le coup
de l'oracle entre dans le top 8 d'un cœur classe les 8 cœurs mesurés en duels longs
comme les duels (corrélation de rang 0,93 ; top 1 et top 3 : 0,60). Ses positions
vont des tours 14 à 26 : il ne voit pas une idée qui agit plus tôt (stay4e10).

**Ce que coûte un coup de l'oracle** (`oracle-cost`, médiane sur 23 fils) : 97 s au
tour 2, 65 s au 10, 41 s au 18, 18 s au 26. Une partie Oracle contre 1.0 : une vague
de 22 parties en 12,6 min, soit environ 105 parties par heure.

**L'oracle au début de partie : le doute de Sami était fondé.**
- Ses deux recherches s'accordent dans **36 %** des positions des tours 2 à 12
  (10 % au tour 2, 17 % au 4, 30 % au 6, 43 % au 8, 60 % au 10, 53 % au 12), contre
  68-70 % aux tours 14-26. Son favori n'a que 10 % des visites en médiane.
- À 80 000 itérations (18 positions), le favori rejoint l'un des deux de 20 000 dans
  2 cas sur 6 aux tours 2 et 6, 6 sur 6 au tour 10.
- Avant le tour 10, l'oracle n'est pas une référence ; ses positions de début ne
  servent pas d'étalon. (Les pilotes ne lisaient que des tours pairs, donc le joueur
  qui commence second ; rien n'indique que l'autre siège diffère.)

**En parties entières** (22 parties chacun, une vague) :

| Pilote | Score contre le 1.0 | Fourchette par paires |
| --- | --- | --- |
| l'oracle | 45,5 % | 24,8 – 66,2 % |
| l'oracle jusqu'au tour 12, puis le 1.0 | 63,6 % | 44,5 – 82,7 % |

Trop peu de parties pour conclure, mais une surprise : rien ne dit encore que
l'oracle bat le V1 en partie entière. Il cherche avec le cœur du 0.9 (réponses et
simulations), le V1 avec celui du 1.0. Les deux questions partent ce matin en
110 parties de plus chacune (`ref-oracle-v1-0/1`, `ref-phase12-0`).

**Le V1 relit les 22 parties de l'oracle** (`npm run shadow`) : il joue le même coup
dans 4,5 % des cas aux tours 1-4, 16 % aux 9-12, 27 % aux 17-20, 38 % après le 25 ;
le coup de l'oracle est dans le top 8 de son cœur 23 % du temps au début, 75-83 %
à la fin.

**Pour la suite** : la base de référence part des tours 12 et plus (`ref-annotate-0` :
l'oracle relit les parties du 1.0 aux tours 12-28, deux recherches, classées par le
cœur du 1.0). Oracle contre Oracle attend : son début de partie n'est pas fiable.

### Le matin du 04/10 : l'oracle bat le V1

**La confirmation complète** (`oracle-confirm-1` et `-2`, les 2 300 écarts) : le coup
de l'oracle tient **+2,4 ± 1,3 points** de plus que celui du 0.9 au tour 30, +4,6 ± 1,2
de plus que le favori du cœur. Sûr de lui (marge ≥ 0,15, 1 269 écarts) : +3,5 ± 1,8 ;
hésitant : +1,1 ± 1,8.

**Oracle contre 1.0, réunis par paires** (`npm run versus`, pilote + deux passes) :

| | Parties | Score | Fourchette par paires |
| --- | --- | --- | --- |
| l'oracle | 242 | **57,4 %** | 51,7 – 63,1 % |
| l'oracle jusqu'au tour 12, puis le 1.0 | 132 | 59,1 % | 50,9 – 67,3 % |

La fourchette basse passe 50 % : l'oracle est plus fort que le V1, il peut servir
d'étalon — à partir du tour 10-12, où ses recherches sont stables. Et chercher
large au début rapporte autant que chercher large partout.

**Ce que l'oracle joue autrement** (sur ses 242 parties contre le 1.0) :
- au début (tours 1-12), il **ouvre moins de bornes vierges** (44 % de ses coups
  contre 60 %), **répond plus aux bornes adverses** (33 % contre 23 %), joue plus au
  centre (45 % contre 36 %) et bâtit plus tôt ses brelans ;
- au milieu, il répond encore plus (31 % contre 21 %), accepte des côtés sans figure
  (20 % contre 11 %) et bâtit moins de suites de couleur (26 % contre 34 %) ;
- à la fin, il joue à côté de ses bornes gagnées (41 % contre 31 %) ;
- au tour 10, il a entamé 4,08 bornes contre 4,37 ; il en gagne 3,02 contre 2,69.

Le constat sur les parties entières contredit en partie celui des écarts de la
veille (l'oracle « répondait » moins dans ses écarts, d'où `noAnswer`) : ici, sur
tous ses coups, il répond plus.

**Pour copier l'oracle, deux pistes en tri ce matin** :
- **regarder plus de coups** : son coup est dans le top 8 du cœur du 1.0 dans 66 % des
  positions, le top 12 dans 77,6 %, le top 16 dans 84 % (au début : 42, 62 et 73 %).
  Tris à temps égal : `candidates=12`, `candidates=16`, et 16 jusqu'au tour 12 ;
- **jouer comme lui** : quatre cœurs sur le 1.0 (`v1ans1/2` : un bonus pour répondre ;
  `v1blind1/2` : un coût pour ouvrir à l'aveugle), triés cœur contre cœur.

**La vitesse** : deux optimisations à coups identiques (les trois empreintes inchangées) —
la carte seule sur un côté vide calculée une fois par évaluation et non par borne vide,
et plus de tableau alloué pour la clé de la mémoire des paires — font environ 5 % de
temps en moins pour la recherche du 1.0. Le reste du temps est dans l'évaluation des
côtés à une et deux cartes, déjà optimisée : un gain plus gros demanderait de revoir
sa structure.

**L'oracle relit les parties du 1.0** (`ref-annotate-0`, tours 12 à 28, 2 159 positions,
deux recherches, classées par le cœur du 1.0) : ses deux recherches s'accordent dans
57 % des positions au tour 12, 65-71 % ensuite. Ses écarts face au cœur du 1.0 (1 035,
hors de son top 3) : il **bâtit un côté sans figure** dans 37 % de ses coups contre 2 %
pour le cœur, **complète un côté** (3e carte) 32 % contre 15 %, **joue un joker** 14 %
contre 2 % ; le cœur du 1.0, lui, bâtit une suite de couleur (46 % contre 18 %) et pose
une 2e carte (69 % contre 52 %) — stfig en fait peut-être trop. Ces positions
(`oracle/positions-v1ref.jsonl`) sont la base du banc des versions V1+ : sur elles, le
coup de l'oracle est dans le top 8 du cœur du 1.0 dans 60,6 % des cas, le top 16 dans 82 %.

**Le V1 relit toutes les parties de l'oracle** (`ref-shadow`, 242 parties) : même coup
dans 4 % des cas aux tours 1-4, 12 % aux 9-12, 20 % aux 17-20, 43 % après le 25 ; le
coup de l'oracle est dans le top 8 de son cœur 24 % du temps au début, 83 % à la fin.

**Copier l'oracle dans le cœur** (cœur contre cœur du 1.0, 6 000 à 8 000 parties, quelques
secondes) :

| Cœur (sur le 1.0) | Jeu de donnes 0 | 1 | 2 |
| --- | --- | --- | --- |
| `v1ans1` / `v1ans2` : un bonus pour répondre | 46,9 % / 45,8 % | | |
| `v1blind1` : ouvrir à l'aveugle coûte 0,1 | 51,1 % | 49,3 % | |
| `v1blind2` : 0,2 | 50,7 % | | |
| `v1jneg1` / `v1jneg2` : un côté sans figure accepté (junk -0,1 / -0,2) | 50,4 % / 51,0 % | — / 50,4 % | |
| `v1freejk` : sans l'habitude du joker | 47,5 % | | |
| **`v1bj`** : `noBlindOpen` 0,1 et `junk` -0,2 ensemble | **52,0 %** | **52,1 %** | **51,5 %** |

Répondre plus, comme l'oracle le fait dans ses parties entières, fait perdre le cœur :
il répond quand c'est juste, pas par principe. Seul `v1bj` tient sur trois jeux de donnes,
mais le banc oracle ne lui voit rien (top 8 : 60,0 % contre 60,6 % sur les positions du
1.0, 64,7 % contre 66,0 % sur celles du 0.9). Il passe un tri dans l'arbre à temps égal
ce matin (`screen-v1bj`) ; s'il n'est pas écarté, ses quatre duels longs ce soir.

**Regarder plus de coups, à temps égal** (`screen-copy-oracle`, tris à `@t400` contre le 1.0) :

| Variante | Score | Fourchette par paires |
| --- | --- | --- |
| `candidates=12` | 38,2 % | 31,3 – 45,0 % |
| `candidates=16` | 42,5 % | 36,9 – 48,1 % |
| 16 jusqu'au tour 12, puis 8 | 46,6 % | 42,7 – 50,4 % |

Les trois sont écartées. Le coup de l'oracle est bien plus souvent dans le top 12 ou 16
du cœur, mais à budget égal, l'arbre qui regarde plus de coups en creuse chacun moins
— et perd. L'oracle peut chercher large parce qu'il a 25 fois plus d'itérations : la
largeur ne se copie pas sans le budget qui va avec. Ce qui se copie, c'est le choix
du cœur (quels coups mettre dans le top 8), d'où les cœurs `v1…`.

**`v1bj` dans l'arbre** (`screen-v1bj`, `@t400` contre le 1.0, 528 parties) : **46,0 %**
(42,3 – 49,8) — écarté. Ses 52 % en cœur contre cœur ne passent pas dans l'arbre, et le
banc oracle l'avait annoncé (top 8 : 60,0 % contre 60,6 %). C'est le premier cas où le
banc tranche contre un tri du cœur : avant de donner un tri d'arbre à une idée, le banc
d'abord.

**Le 1.0 contre lui-même** (`ref-v1-self-0/1`, 2 × 336 parties gardées) : 50,0 % et 53,0 %,
comme attendu d'un miroir — le corpus V1 contre V1 de la base de référence.

**Le bilan de la nuit et du matin** : l'oracle est un étalon solide à partir du tour 12
(57,4 % contre le 1.0, ses écarts confirmés par le jeu), pas avant. Aucune variante du
1.0 n'a tenu : regarder plus de coups perd à temps égal, et les traits de l'oracle
copiés un par un dans le cœur ne passent pas dans l'arbre. La piste qui reste ouverte :
le début de partie, où l'oracle jusqu'au tour 12 gagne 59,1 % — c'est son budget, pas
sa largeur, qui gagne ; un 1.0 qui réfléchit plus longtemps aux premiers coups (temps,
pas largeur) est le prochain essai.

## Trois variantes du 1.0 pour le début de partie (04/10, après-midi)

Les trois traits de l'oracle au début (changelog 1.1, « Coup pour coup »), en bonus du
cœur actifs jusqu'au tour 12 seulement (`earlyIdeas`, `earlyUntil: 12`) :
- `noOpen` (nouveau, `oracle-ideas.js`) : toute carte posée sur une borne où personne
  n'a joué coûte, plan en main ou non (l'oracle ouvre 44 % de ses coups du début, le
  1.0 60 %) ;
- `junk` en négatif : un côté sans figure coûte moins (37 % des écarts de l'oracle
  contre 2 %) ;
- `noRun` (nouveau) : une carte qui fait d'un côté une suite de couleur coûte (18 %
  contre 46 %).

Testées sur 6 fils, d'abord cœur contre cœur du 1.0 (3 jeux de donnes), puis au banc
de similitude sur les 1 683 coups de l'oracle des tours 1 à 12 de ses parties
entières (`npm run banc -- … --positions games --turns 1-12`, les 5 candidats gardés par
les replays) :

| Cœur | Cœur contre cœur | Banc : écart de valeur oracle avec le 1.0 | Même coup que l'oracle (1.0 : 6,1 % aux tours 4-10) |
| --- | --- | --- | --- |
| `e12open1` (noOpen 0,1) | 50,0 / 49,7 / 50,5 % | **+1,3** (-0,5 – +3,1) | 8,4 % |
| `e12open2` (0,2) | 49,4 / 49,3 / 49,5 % | — | — |
| `e12junk1` (junk -0,1) | 49,7 / 49,2 / 49,5 % | — | — |
| `e12junk2` (-0,2) | 50,1 / 48,6 / 49,4 % | -1,0 (-2,5 – +0,6) | 6,7 % |
| `e12run1` (noRun 0,1) | 47,4 / 47,6 / 48,5 % | +0,3 (-1,4 – +2,0) | 6,4 % |
| `e12run2` (0,2) | 46,7 / 46,6 / 46,5 % | — | — |

- Aucune n'est « à pousser ». `e12open1` est la seule piste : elle rapproche le 1.0 de
  l'oracle au début (même coup 8,4 % contre 6,1 %), sans rien perdre en cœur contre cœur.
- Coûter les suites de couleur fait perdre le cœur, comme couper `suited` le 03/10 :
  l'oracle en bâtit moins, mais celles du 1.0 lui rapportent.
- Le banc n'est pas encore calibré (cette nuit) ; une fois calibré, `e12open1` repasse
  sur ses positions (deux recherches, 12 coups), et `--queue` s'il est « à pousser ».
- Le banc à 6 fils : 1 683 positions en 8,7 min pour la référence, mise en cache ; à
  18 fils environ 3 min par version, mais la machine est saturée.

**`e12open1` en parties réelles** (Sami : le banc contre le jeu) : 4 × 250 parties contre
le 1.0 à 800 itérations, règle de la page, 18 fils (11 min par jeu de donnes) :
47,6 %, 51,6 %, 52,0 %, 50,8 % ; réunies par paires, **50,5 % (47,9 – 53,1)** sur 1 000
parties. Neutre, comme le banc (+1,3 point, -0,5 – +3,1). Le banc et les duels
s'accordent : aucun des deux ne voit d'écart. `e12open1` rejoint les versions de la
calibration (`data/banc-calibration.json`).

## La calibration du banc : il ne trie pas (04/10, soir)

La nuit du banc lancée à 18 h sur 18 fils (Sami) : deux passes de l'oracle, 3 721
positions (parties 1.0 contre 1.0, oracle contre 1.0, 1.0 contre 0.9 ; tours 4 à 30,
deux recherches, 12 coups gardés). Stabilité de son favori : 38 % aux tours 4-10 (968
positions), 65 % aux 11-20 (1 345), 63 % aux 21-30 (1 408) ; le 1.0 a le trait dans 2 772.
Puis `npm run banc -- --calibrate` : les versions au résultat connu passées sur le banc.
Il s'est **arrêté à sa limite de 50 min** après 12 versions (le top 8 du cœur n'a pas
été écrit) ; corrélations recalculées depuis son journal. `e12open1`, la 13e, est
passée à part à 22 h 35 (`npm run banc`, 9,5 min sur 18 fils) : le 1.0 y retrouve
exactement ses valeurs, le banc est reproductible (`data/banc.json`, `calibration`).

| Version | Valeur oracle | Au début (4-10) | Duels contre le 0.9 |
| --- | --- | --- | --- |
| 0.9 | 45,5 % | 30,9 % | 50,0 % |
| **1.0** | 45,6 % | 35,5 % | 56,1 % |
| `e12open1` | 45,9 % | **36,3 %** | **56,6 %** (50,5 % contre le 1.0) |
| stay4e10 | 46,2 % | 33,7 % | 50,6 % |
| jkx | 45,1 % | 32,3 % | 51,7 % |
| jk2 | 45,0 % | 32,0 % | 52,4 % |
| obex | 46,4 % | 32,3 % | 50,5 % |
| lean (@t800) | 41,7 % | 26,9 % | 41,9 % |
| nobonus (@t800) | 40,6 % | 26,4 % | 39,7 % |
| candidates=12 (@t400) | 42,3 % | 31,9 % | 44,2 % |
| candidates=16 (@t400) | 40,3 % | 32,3 % | 48,6 % |
| 16 jusqu'au 12 (@t400) | 40,9 % | 31,5 % | 52,8 % |
| v1bj (@t400) | 40,2 % | 30,3 % | 52,2 % |

Corrélation de rang avec les duels, sur les 13 versions : **0,32** sur la valeur
oracle, **0,61** sur la valeur au début. Sur les 7 versions à 800 itérations seulement :
-0,18 et **0,72**.

- **Le banc entier ne trie pas.** Il ne sépare pas le 0.9 du 1.0 (45,5 % contre
  45,6 %) alors que le 1.0 gagne 56,1 % ; les sept versions à 800 itérations tiennent
  en 1,4 point. Aux tours 11 à 30, deux versions voisines jouent presque les mêmes coups,
  et l'écart est plus petit que ce que le banc sait voir.
- **Le début de partie dit quelque chose** : le 1.0 et `e12open1` y sont en tête
  (35,5 % et 36,3 %), et la corrélation y monte à 0,61, 0,72 sans les versions au
  temps. C'est là où l'oracle est le moins stable (38 %) : un banc des tours 4-10
  gagnerait à plus de recherches par position, pas à plus de positions. Sept points
  ne suffisent pas à en faire un filtre.
- **`e12open1` au banc** : +0,32 point contre le 1.0 (-0,40 – +1,05), « neutre » ;
  +0,8 au début. Ses 1 000 parties disent la même chose (50,5 %).
- **Les versions à temps fixe (`@t400`, `@t800`) sont faussées** : le banc tourne
  sur une machine chargée, elles y font moins d'itérations qu'en duel, et toutes
  sortent en bas (40-42 %), qu'elles gagnent ou perdent leurs duels.
- Ce n'est pas l'accord du banc oracle d'hier (top 8 du cœur, 0,93 sur 8 cœurs) : ce
  banc-là compare des cœurs seuls, sans arbre ; le banc de similitude juge le coup
  final de l'arbre, où le bruit de la recherche couvre l'écart entre deux cœurs.

Conséquence : le verdict du banc reste un indice, jamais un filtre (`CLAUDE.md`,
`docs/validation.md`) ; sa valeur aux tours 4-10 est celle à lire. Le parcours d'une
idée reste cœur contre cœur, tri d'arbre (400 parties), puis quatre duels longs.

## Vers 55 % contre la V1 : le labo à 2 000 itérations (04/10, nuit)

**La demande** (Sami) : des pistes qui pourraient atteindre 55 % contre la V1. Le cœur
est plus rapide : le labo passe de 800 à **2 000 itérations par coup** (environ 2 s), des
deux côtés. Le V1 à battre est `ismcts+widen=3+depth=5+core=stfig6@2000`. Une version se
décide toujours sur 4 duels longs, désormais de 250 parties chacun
(`--long --games 125 --page --offset 0..3`), réunis par `npm run versus`.

**Ce que valent 2,5 fois plus d'itérations** : le V1 à 2 000 contre le V1 à 800, 250
parties, **55,2 % (49,8 – 60,6)**, en 19 min sur 18 fils. Le 1.0 profite du calcul bien
plus que le 0.9 (1 600 contre 800 : 52,1 %) : à ce niveau, chaque gain de vitesse est un
gain de force. À 2 000 contre 2 000, un duel de 250 parties prend environ 27 min, un tri
de 400 parties environ 43 min.

**Le budget au début, au même total** : une partie compte en moyenne 6,5 coups cherchés
par joueur avant le tour 13 et 10,5 après (36,5 tours). Les variantes `phase:13:…@3000/…@1400`
et `phase:13:…@4000/…@750` dépensent donc autant qu'à 2 000 partout.

**Le plan** (dans l'ordre, chaque étape triée sur 400 parties puis, si elle tient, ses
4 duels longs) :
1. sans code : la largeur à 2 000 (`candidates=10/12+widen=4`), plus de budget au début,
   l'oracle allégé au début (`candidates=16+widen=4` jusqu'au tour 12) ;
2. `npm run distill` : tous les poids du cœur réglés ensemble sur les coups de l'oracle ;
3. `+infer=N` : la main adverse devinée d'après son dernier coup, au lieu d'un tirage
   uniforme ;
4. les gagnants combinés, puis les 4 duels longs.

**Le cœur appris sur l'oracle** (`npm run distill`, 15 min sur 18 fils, 218 manches de SPSA) :
les 13 poids de `src/sim/distill.js` bougent ensemble pour mettre le coup de l'oracle dans le
top 8 du cœur, sur ses 6 821 positions stables (`oracle/positions*.jsonl`), un quart des
parties gardé de côté.

| Sur les 1 580 positions gardées de côté | top 1 | top 3 | top 8 |
| --- | --- | --- | --- |
| le cœur du 1.0 (`stfig6`) | 9,9 % | 27,5 % | 59,6 % |
| **`dist1`** | 11,1 % | 32,2 % | **66,0 %** |

- Ce qui bouge le plus : `stay` 0,6 → 1,0, le coût d'un joker 0,08 → 0,04 (l'oracle joue
  plus de jokers), la température 0,35 → 0,28, `junk` 0 → 0,25, les bonus du milieu divisés
  par deux (`openMiddle` 0,1 → 0,03, `middleSolid`/`middleWeak` 0,15 → 0,08).
- Le gain de top 8 (+6,4 points) vaut la moitié de celui du 0.9 au 1.0 (+12 sur ce banc).
- **En cœur contre cœur, il perd** : 47,8 / 47,4 / 47,9 %. Le réglage porte sur les coups que
  l'arbre examine, pas sur le cœur qui joue seul. Deux tris dans l'arbre : `dist1` à la
  racine seulement (`+shortlist=dist1`, le 1.0 joue les simulations), et `dist1` partout à
  temps égal (16 % plus cher par itération : 1 720 itérations contre 2 000).

**La main adverse devinée** (`+infer=48`, `src/sim/infer.js`) : au début de chaque recherche,
48 mains sont tirées pour l'adversaire, chacune pondérée par la vraisemblance de son dernier
coup selon le cœur (un softmax à 0,2 : le 1er et le 8e coup du cœur sont à environ 0,4
d'écart). Chaque itération tire une de ces mains, la pioche avec le reste. Approximations :
la carte piochée après ce coup compte comme déjà en main ; un coup qui a revendiqué une
borne n'est pas lu. Même coût par itération que le V1 ; `infer=0` (par défaut) laisse
l'empreinte du 1.0 intacte (`152e2a9c9d66170c`).

**Le coût par itération des variantes** (µs, 4 parties à 300) : V1 960, `candidates=10/12/16+widen=4`
917 – 926 (un peu moins cher : les comparer au même nombre d'itérations est prudent),
`dist1` 1 115, `infer=48` 951.

**La file de la nuit** (`npm run backlog -- --threads 18`, 8 tris de 400 parties, environ
45 min chacun, une pause entre deux) : `dist1` à la racine, `dist1` partout, `infer`, puis
le budget au début (4 000 / 750), l'oracle allégé, le budget au début (3 000 / 1 400), la
largeur (10 puis 12 candidats).

**La nuit du 04 au 05/10** (`npm run backlog -- --threads 18`, lancé à 0 h 11) : six tris joués,
puis **Windows Update a redémarré le PC à 6 h 38** (mise à jour 26H2, redémarrage planifié) au
milieu du sixième. Tris de 400 parties contre le V1 à 2 000 :

| Tri | Parties | Score | Fourchette par paires | Verdict |
| --- | --- | --- | --- | --- |
| **`dist1` à la racine** (`+shortlist=dist1`) | 400 | **52,8 %** | 48,4 – 57,1 % | candidat aux duels longs |
| `dist1` partout, 1 720 itérations (temps égal) | 400 | 46,3 % | 42,0 – 50,5 % | écarté |
| `infer=48` | 400 | 49,5 % | 45,2 – 53,8 % | neutre |
| budget au début, 4 000 / 750 | 360 | 49,7 % | 44,4 – 55,0 % | neutre |
| oracle allégé au début (16 candidats, 4 réponses, 4 000 / 750) | 360 | 46,9 % | 41,0 – 52,9 % | plutôt perdant |
| budget au début, 3 000 / 1 400 | 180 | 49,4 % | 42,0 – 56,9 % | coupé par le redémarrage |
| 10 et 12 candidats, 4 réponses | — | — | — | pas joués |

- **`dist1` à la racine** est le seul qui se détache : le cœur appris sur l'oracle choisit
  mieux les coups que l'arbre examine, à condition de laisser le 1.0 jouer les simulations.
  Partout, il perd (46,3 %), comme en cœur contre cœur (47,6 %) : ses poids, réglés pour
  classer, jouent moins bien seuls. Un tri ne promeut pas : ses 4 duels longs décideront.
- **Deviner la main adverse** d'après son seul dernier coup ne change rien (49,5 %). Une
  inférence sur plus d'un coup (l'historique de la partie) serait l'étape suivante, plus
  coûteuse à écrire.
- **Le budget au début ne paie pas** à total égal (49,7 % et 49,4 %), et la largeur de
  l'oracle sans son budget perd encore (46,9 %) : les 59,1 % de l'oracle jusqu'au tour 12
  viennent de ses 20 000 itérations, qu'on ne peut pas prendre sur la fin de partie.
- Les deux tris « budget au début » ont dépassé leur limite de 60 min (2 × 180 parties en
  46 min) : les tours 1 à 12 coûtent plus cher par itération que la moyenne. Les tris
  restants ont maintenant 75 min.

**La main adverse devinée, v2** (`+memory=K`, 05/10, Sami) : la v1 ne lisait que le dernier
coup adverse (49,5 %). Le bot retient maintenant les coups de l'adversaire d'un coup à
l'autre (`createReader`, `src/sim/infer.js`) et pondère chaque main par le produit des
vraisemblances de ses K derniers coups. À un coup plus ancien, sa main est prise comme la
main devinée plus toutes les cartes jouées depuis : les cartes piochées depuis comptent
comme déjà en main, une approximation qui grandit avec K. Coût mesuré : 18,5 ms par coup
pour 32 mains et 3 coups lus, environ 1 % d'un coup à 2 000 itérations. L'empreinte du 1.0
reste `152e2a9c9d66170c`. Tri en file : `ismcts+…+core=stfig6+infer=48+memory=3@2000`.

**La file de jour du 05/10** (`--threads 18`, sans pauses, lancée à 8 h 22) : les 4 duels
longs de `dist1` à la racine (offsets 1 à 4 : le tri avait joué ceux de l'offset 0), puis
les tris `early3000`, `w10`, `w12` et `infer2`.

**`dist1` à la racine, en duels longs** (4 × 250 parties contre le V1 à 2 000, offsets 1 à 4,
de 8 h 22 à 10 h 15, 26 à 30 min chacun) :

| Jeu de donnes | Score | Fourchette par paires |
| --- | --- | --- |
| offset 1 | 53,6 % | 49,0 – 58,2 % |
| offset 2 | 48,8 % | 43,6 – 54,0 % |
| offset 3 | 50,8 % | 45,2 – 56,4 % |
| offset 4 | 53,2 % | 47,7 – 58,7 % |
| **les 4 réunis (500 paires)** | **51,6 %** | **49,0 – 54,2 %** |

- **Pas décidé** : la fourchette basse reste sous 50 %. `dist1` à la racine est au mieux
  un petit gain (environ +1,5 point), loin des 55 %. Avec le tri de la nuit (qui l'a choisi,
  donc biaisé), `npm run versus` donne 51,9 % (49,7 – 54,2) sur 1 400 parties.
- Ce qu'il joue autrement : au début, il ouvre moins de bornes vierges (45,7 % contre 54,1 %)
  et plus au centre ; au milieu, il répond bien plus (31,4 % contre 22,7 %) — les traits de
  l'oracle, sans l'oracle.
- Par jokers : 60,3 % à 2 contre 0, 43,1 % à 0 contre 2, 52,0 % à un chacun.
- Pour trancher sur un effet d'environ 1,5 point, il faudrait environ 4 000 parties : ce
  n'est pas la meilleure dépense tant qu'aucune autre piste n'a été combinée avec lui.

## Le coût du cœur, feature par feature (05/10, Sami)

**La question** : quelles features du cœur du 1.0 coûtent le plus et servent le moins, pour
les optimiser, les remplacer ou les retirer ? `npm run features` (sur un fil, 723 positions
de 40 parties du cœur contre lui-même, 181 recherches à 300 itérations) mesure :
- **le temps** : un profil CPU (`node:inspector`, un échantillon toutes les 100 µs), chaque
  fonction rattachée à sa feature (`scripts/lib/core-features.js`) ;
- **l'activité** : la feature éteinte, les mêmes coups notés à nouveau — la part des notes
  qui changent, et la part des positions où le coup préféré change.

| Feature | Temps, simulations | Temps, une itération | Notes changées | Favori changé |
| --- | --- | --- | --- | --- |
| le potentiel d'un côté (paires, pioche) | **45,0 %** | 43,5 % | toujours | — |
| le gain d'un coup (chances, menace) | 14,5 % | 15,5 % | toujours | — |
| l'aiguillage des bonus | **11,0 %** | 9,7 % | toujours | — |
| les idées éteintes, appelées pour rien | **6,9 %** | 7,0 % | — | — |
| idée `middle` | 5,0 % | 2,7 % | 17,5 % | 21,6 % |
| idée `connector` | **4,4 %** | 4,5 % | **3,0 %** | **1,7 %** |
| idée `stay` | 3,2 % | 3,5 % | 6,5 % | **27,8 %** |
| les règles du jeu | 3,1 % | 2,2 % | toujours | — |
| l'arbre, le tirage des cartes cachées | — | 3,0 % + 2,3 % | toujours | — |
| habitude « ouvrir » | 0,7 % | 0,4 % | 28,9 % | 21,0 % |
| habitude « départ assorti » | 0,3 % | 0,4 % | 1,5 % | 14,5 % |
| habitude « joker pour un brelan » | 0,1 % | 0,1 % | 7,1 % | 4,1 % |
| idée `spread` | < 0,1 % | < 0,1 % | 6,1 % | 9,5 % |
| les certitudes (racine seulement) | — | 0,0 % | 0,0 % | 0,0 % |

- **Le potentiel d'un côté est la moitié du coût** d'une itération : c'est là qu'un gain de
  vitesse paie. Le 1.0 gagne 55 % avec 2,5 fois plus d'itérations : chaque pourcent de vitesse
  compte.
- **18 % du temps sert à appeler des bonus**, dont 7 % pour des idées éteintes : leurs
  fonctions sont appelées à chaque coup et rendent 0. Les sauter quand elles sont éteintes
  serait un gain de vitesse sans changer un seul coup (l'empreinte resterait la même).
- **`connector` est la seule idée chère et peu utile** : 4,4 % du temps, 3 % des notes changées,
  le coup préféré change dans 1,7 % des positions. À tester sans lui, à temps égal.
- `stay` (le cœur du 1.0) et l'habitude « ouvrir » sont les plus décisives pour leur coût ;
  `spread` et les habitudes ne coûtent presque rien.
- Les certitudes prennent 13,5 % du temps à la racine et n'ont changé aucune note sur ces
  positions ; à la racine seulement, elles ne pèsent rien dans une itération.
- Le changelog 1.1 trace tout cela (section « Le coût du cœur »). Mesuré pendant que la file
  tournait sur 18 fils : les parts tiennent, les millisecondes sont à refaire au repos.

**Au repos, après la file** (05/10, 14 h 30) : les mêmes mesures, la machine libre.

| Arbre à 400, 107 positions, 3 passes | Itérations/s | µs par itération | Gain |
| --- | --- | --- | --- |
| V1 avant | 1 119 | 893 | — |
| V1, les familles d'idées éteintes plus appelées | 1 162 | 861 | +3,8 % (mêmes coups : les empreintes 1.0, 0.9 et oracle sont inchangées) |
| `v1nc` : sans `connector` | 1 253 | 798 | +12,0 % (+7,9 % sur le V1 actuel) |

- Les parts du profil au repos confirment celles mesurées sous charge, à un ou deux points
  près. Avec le V1 actuel : le potentiel d'un côté 45,9 % du temps des simulations, le gain
  d'un coup 13,5 %, l'aiguillage 12,3 %, `connector` 4,2 %, ce qui reste des idées éteintes
  3,7 % (surtout `borderFactors`, 1,9 %, qui calcule des facteurs tous à 1, et `gateOn`, 1 %).
- Sans `connector`, le potentiel monte à 49 % : c'est lui qui reste à accélérer.
- Les duels de `v1nc` en file passent à 2 160 itérations (temps égal mesuré au repos).
- Le détail par fonction du potentiel : `drawPotential` 18,8 % (surtout la mémoire des paires,
  une `Map` vidée à chaque évaluation), `singlePotential` 9,7 %, `drawPotentialOf` 6,8 %,
  `sidePotential` 4,5 %, `upsideOf` 3,7 % (une puissance par figure à chaque calcul).

**Les tris de la journée du 05/10** (400 parties contre le V1 à 2 000, `--threads 18`, sans pauses) :

| Tri | Score | Fourchette par paires | Verdict |
| --- | --- | --- | --- |
| budget au début, 3 000 / 1 400 (relancé en entier) | 50,2 % | 46,1 – 54,4 % | neutre |
| **10 candidats, 4 réponses** (`candidates=10+widen=4`) | **52,8 %** | 48,3 – 57,2 % | candidat (en second : 56,5 %) |
| 12 candidats, 4 réponses | 48,3 % | 43,9 – 52,6 % | neutre |
| `infer` v2 : les 3 derniers coups adverses (`infer=48+memory=3`) | 46,3 % | 41,8 – 50,7 % | plutôt perdant |

- **Le bilan des tris du plan des 55 %** : deux candidats seulement, `dist1` à la racine (52,8 %
  en tri, 51,6 % en 4 duels longs, pas décidé) et la largeur à 10 candidats (52,8 % en tri, un
  peu moins chère par itération). Le budget au début est neutre (49,4 – 50,2 %), l'oracle allégé
  et `dist1` partout perdent, et deviner la main adverse ne rapporte rien, que ce soit d'après
  le dernier coup (49,5 %) ou les trois derniers (46,3 %) : les mains devinées, trop sûres
  d'elles, appauvrissent les tirages.
- Aucune piste seule n'approche 55 %. Ce qui reste : les **combiner** (`dist1` à la racine et
  10 candidats sont indépendants : l'un choisit les candidats, l'autre en prend deux de plus),
  et **gagner en vitesse** sans changer les coups (le 1.0 gagne 55,2 % avec 2,5 fois plus
  d'itérations).

**Le potentiel plus vite, à coups identiques** (A1 à A4, 05/10, Sami) :
- A1 : la mémoire des paires de `drawPotential` n'est plus une `Map` par vue et par évaluation,
  mais deux tableaux typés partagés, chaque évaluation sous un numéro à elle
  (`createPairMemo`) ; une évaluation imbriquée ne cause qu'un manque, jamais une fausse valeur ;
- A2 : `upsideOf` lit les chances de pioche dans une table (cartes invisibles × tirages ×
  cartes utiles), calculée une fois ;
- A3 : `borderFactors` n'est plus appelé quand aucune idée ne pondère les bornes (`neighbors`,
  `weight`, `runs`) : ses facteurs valaient tous 1 ;
- A4 : l'aiguillage des bonus ne recrée plus d'objet par `...spread` à chaque coup.
- A5 (le meilleur appariement d'un côté à une carte, une fois pour tous) n'est pas fait : un côté
  à une carte n'est évalué qu'une fois par vue, il n'y avait rien à garder.

Les empreintes 1.0, 0.9, arbre du 0.9 et oracle sont inchangées. Au repos (arbre à 400, 107
positions, 3 passes) :

| Version | Itérations/s | Gain |
| --- | --- | --- |
| V1 avant | 1 131 | — |
| V1, idées éteintes sautées | 1 138 | +0,6 % (les +3,8 % du premier essai étaient du bruit) |
| **V1, A1 à A4** | **1 366** | **+20,7 %** |
| `v1nc`, A1 à A4 | 1 502 | +32,8 % |
| `v1nc` + 10 candidats, 4 réponses, A1 à A4 | 1 503 | +32,8 % |

Le V1 lui-même est 20 % plus rapide, sans changer un coup : dans la page (10 s par coup), c'est
20 % d'itérations de plus. La file passe à la combinaison `ismcts+candidates=10+widen=4+depth=5+core=v1nc`
à temps égal (2 200 itérations contre 2 000), 4 duels longs sur les offsets 1 à 4.

**Les pistes qui changent le jeu, pour le potentiel d'un côté** (B1 à B4, 05/10 ; à trier à
temps égal, après A1 à A4 qui ne changent aucun coup) :
- **B1, un potentiel allégé dans les simulations** : dans les simulations seulement, un côté à
  une carte vaut sa carte seule (`valuer.single`), sans essayer chaque paire de la main
  (`singlePotential` et les `pairPotential` qu'il appelle, environ un quart du temps des
  simulations) ; la racine garde le calcul complet. Des simulations moins justes mais bien plus
  nombreuses. La plus prometteuse : à écrire, puis tri et 4 duels longs.
- **B2, la mémoire des paires gardée d'un coup à l'autre** dans une même simulation : juste
  seulement tant que les cartes invisibles et les tirages ne changent pas ; il faudrait les mettre
  dans la clé, ou une mise à jour incrémentale. Gain incertain, code délicat.
- **B3, régler `PAIR_DISCOUNT`** (0,9 aujourd'hui, la remise sur une paire pas encore posée) :
  à faire avec `npm run distill`, en ajoutant ce paramètre aux poids réglés.
- **B4, pondérer la pioche par le nombre de tirages restants**, en fin de partie surtout : plus
  juste, pas plus rapide ; seulement si les autres échouent.

**B1 écrit : `+lite=1|2`, le cœur allégé selon l'étage de l'arbre** (05/10, Sami : « sablier,
pyramide ? »). L'arbre était déjà une pyramide à deux étages : la racine classe ses candidats
avec le cœur complet (certitudes comprises, ou `shortlist=dist1`), les nœuds de l'arbre
(`ctx.judge`) et les simulations (`ctx.rollout`) avec le cœur des simulations. Avec `lite`, un
côté à une carte vaut sa carte seule (`valuer.single`) dans ce cœur-là :
- `lite=1` : les simulations seulement ; les nœuds de l'arbre gardent le cœur complet
  (`treePolicy` dans `createIsmcts`) ;
- `lite=2` : les nœuds aussi ; seule la racine garde tout.

Sans `lite`, l'empreinte du 1.0 reste `152e2a9c9d66170c`. Mesures (la file tournait, les
rapports tiennent, les absolus non) :
- en cœur contre cœur, le cœur allégé perd lourdement : **37,4 / 39,3 / 39,7 %** — les paires
  que la main peut faire avec une carte seule sont une grande part de son jugement ;
- vitesse : `lite=1` +31 % par itération (2 620 à temps égal), `lite=2` +39 % (2 780) ;
  `dist1` à la racine ne se voit pas (un classement de plus par coup, contre 2 000 itérations).
- Deux tris de 400 parties à temps égal en file ; B1 n'entre dans la version combinée que s'ils
  tiennent.

**Ce que dit la littérature sur la profondeur** (de mémoire) : les *progressive strategies*
(Chaslot et al., 2008) n'appliquent une connaissance coûteuse qu'aux nœuds assez visités, donc en
haut de l'arbre ; le *simulation balancing* (Silver et Tesauro, 2009) montre qu'une politique de
simulation plus forte ne fait pas forcément un meilleur arbre — ce qui compte est qu'elle soit
sans biais (exactement `dist1` : meilleur pour classer, moins bon pour simuler) ; et des
simulations légères mais nombreuses gagnent souvent à temps égal (le pari de B1). Le précis en
haut (racine, premiers étages, nœuds très visités), le léger en fin de branche, où le bruit des
tirages domine. Plus fin, à essayer si B1 tient : le cœur complet dans un nœud à partir de K
visites seulement (`+heavyFrom=K`).

**10c4r en duels longs** : 48,8 / 48,8 / 50,4 / 49,6 % — environ 49,4 %, le 52,8 % du tri était du
bruit ; il est retiré de la combinaison. **Les autres features à 51 % ou plus sur 1 000 parties
contre le V1** : aucune autre que `dist1` à la racine (51,6 %) ; `e12open1` fait 50,5 %.

**La file du soir** : les duels de `v1nc` (fin vers 19 h), les tris de B1 (`lite=1`, `lite=2`,
vers 20 h 40), puis 4 duels longs de la combinaison `ismcts+widen=3+depth=5+core=v1nc+shortlist=dist1@2200`
(vers 22 h 20).

**10 candidats, 4 réponses, en duels longs** (4 × 250 parties contre le V1 à 2 000, offsets 1 à 4,
15 h 41 – 17 h 15) : 48,8 / 48,8 / 50,4 / 49,6 % ; **les 4 réunis, 49,4 % (46,6 – 52,2)** sur
500 paires. Écarté : le 52,8 % du tri était du bruit. `npm run versus`, qui compte aussi le tri de
l'offset 0 (celui qui l'a fait choisir) : 50,4 % (48,0 – 52,7) sur 1 400 parties ; 46,9 % quand il
commence, 53,9 % en second. Comme `dist1` à la racine (52,8 % en tri, 51,6 % en duels), un tri
de 400 parties qui sort à 52-53 % ne dit presque rien.

**`v1nc` en duels longs** (le 1.0 sans `connector`, 2 200 itérations à temps égal contre 2 000,
offsets 1 à 4, 17 h 15 – 18 h 37) : 48,4 / 48,8 / 48,4 / 48,8 % ; **les 4 réunis, 48,6 % (45,9 –
51,3)**. Les 10 % de vitesse ne rachètent pas ce que `connector` apporte au jugement (le cœur
seul perdait 1,7 point sans lui) : écarté, `connector` reste. La combinaison avec `dist1` à la
racine est remplacée par 4 duels de `dist1` à la racine seul sur de nouvelles donnes (offsets 5
à 8) : avec ceux du matin (51,6 %), 2 000 parties, assez pour trancher un écart de 1,5 point.
A1 à A4 ne changeant aucun coup, les deux séries se réunissent.

**B3, la remise sur une paire réglée par l'oracle** (`npm run distill -- --keys pairDiscount --name pair`,
15 min sur 6 fils, 463 manches de SPSA, seul ce paramètre bouge) : `PAIR_DISCOUNT` devient un
paramètre du cœur (`params.pairDiscount`, 0,9 par défaut : toutes les empreintes inchangées, `dist1`
compris). Il descend vite à environ 0,87 et y reste (**0,867**). Sur les 1 580 positions gardées de
côté, le coup de l'oracle dans le top 1 / 3 / 8 : 9,9 / 27,5 / 59,6 % pour le 1.0, 10,1 / 27,0 /
59,1 % réglé — **rien ne change** : 0,9 était déjà la bonne valeur pour classer les coups comme
l'oracle. Pas de tri dans l'arbre : il n'y a pas de signal à tester. Le cœur `distpair` reste
disponible (`src/sim/distilled-pair.js`). `distill` sait maintenant ne régler que certains poids
(`--keys`) et écrire ailleurs que dans le cœur en test (`--name`).

**Les validations courtes de B1** (400 parties contre le V1 à 2 000, temps égal mesuré pendant que
la file tournait) :

| Version | Itérations | Score | Fourchette par paires | Verdict |
| --- | --- | --- | --- | --- |
| **`B1Lite1`** (`lite=1` : les simulations allégées) | 2 620 | **55,8 %** | **51,5 – 60,0 %** | passe en validation longue |
| `B1Lite2` (`lite=2` : les nœuds aussi) | 2 780 | 47,3 % | 42,6 – 51,9 % | écarté |

La pyramide gagne : léger dans les simulations, complet dans les nœuds et à la racine. Alléger
les nœuds aussi fait perdre, même avec 39 % d'itérations de plus : les réponses regardées à
chaque étage doivent rester bien choisies. C'est la première validation courte dont la fourchette
basse dépasse 50 %, alors que le cœur allégé seul perd 38,8 % en cœur contre cœur : des
simulations moins justes mais plus nombreuses. La validation longue de `B1Lite1` se joue au même
temps par coup des deux côtés (`@t3200`), le temps égal mesuré sous charge n'étant pas assez sûr.

**`DistOracle1Root` sur 2 000 parties** (`dist1` à la racine, 8 duels de 250 parties contre le V1 à
2 000, offsets 1 à 8) : 53,6 / 48,8 / 50,8 / 53,2 % le matin, 52,0 / 50,8 / 48,4 / 46,8 % le soir ;
**les 8 réunis, 50,5 % (48,6 – 52,5)** sur 1 000 paires. Neutre : les 51,6 % des 4 premiers duels
étaient de la chance, la 2e série fait 49,5 %. `npm run versus` (avec le tri de l'offset 0, qui l'a
fait choisir) : 50,9 % (49,2 – 52,7) sur 2 400 parties. Mieux classer les candidats comme l'oracle
(top 8 : 59,6 → 66,0 %) ne fait pas gagner de parties : l'arbre, avec 2 000 itérations, retrouve
déjà le bon coup parmi les 8 du 1.0.

**L'arbre au début de la partie** (05/10, mesuré pour Sami : une recherche du V1 à 2 000
itérations, la même partie à trois moments, `root` exposé dans une copie temporaire de
`ismcts.js`) :

| Tour | Candidat le plus visité | Réponses adverses différentes sous lui | Les 5 plus suivies | Vues une seule fois |
| --- | --- | --- | --- | --- |
| 1 | 503 visites | 116 | 14, 14, 14, 13, 13 | 35 |
| 11 | 480 | 57 | 45, 31, 30, 30, 24 | 11 |
| 21 | 633 | 19 | 115, 66, 52, 50, 43 | 0 |

Une réponse est une carte précise sur une borne ; la main adverse imaginée change à chaque
itération, et son top 3 avec. Au tour 1, sous chaque candidat, les réponses se comptent par
dizaines, avec quelques visites chacune : aucune statistique n'y tient, l'arbre ne compare que
ses 8 candidats. Ce qui explique l'oracle instable au début (10 % de recherches d'accord au tour
2), l'échec des essais pour mieux jouer les premiers coups, et pourquoi la vitesse paie (plus de
fins de partie par candidat).

**Piste C1, les réponses regroupées** : compter une réponse adverse par borne et par hauteur de
carte (sans la couleur), ou par type (« une carte haute sur la borne 4 ») ; une réponse
accumulerait les visites de dizaines de mains imaginées, et l'arbre apprendrait sous ses candidats
dès le début de partie. Une abstraction des coups, classique dans les arbres à information cachée.
Du code (la clé des nœuds adverses dans `ismcts.js`), puis une validation courte.

**`B1Lite1` en validation longue** (même temps par coup des deux côtés, `@t3200`) : 48,0 puis 46,0 %,
**47,0 % réunis** ; la règle d'arrêt a annulé les duels 3 et 4. Écarté.

**La leçon de méthode : le temps égal se mesure dans les duels.** Les visites gardées dans les
replays donnent les itérations réelles par coup : dans la validation courte, `B1Lite1` en avait
2 620 contre 2 000 (le rapport 1,31 du banc de vitesse) ; dans les duels au même temps par coup,
2 463 contre 2 236 et 2 530 contre 2 277, **un rapport de 1,10 seulement**. Le banc de vitesse (un
fil, des positions du cœur seul) surestimait l'avance de B1 : dans un duel, 18 parties tournent en
même temps et l'écart fond. Sa validation courte (55,8 %) lui donnait donc 20 % d'itérations de
trop ; à temps vraiment égal, ses simulations moins justes coûtent plus que ses 10 % de vitesse.
Désormais, une version plus rapide ou plus lente se compare au même temps par coup (`@t`) des
deux côtés, ou son budget se vérifie dans les replays d'un premier duel. Les essais du jour à
budget ajusté (`NoConnector` à 2 200, `DistOracle1` à 1 720) avaient perdu malgré cela : leur
verdict tient.

**Le bilan du plan des 55 % (05/10)** : aucune version ne bat le V1. Validations longues :
`DistOracle1Root` 50,5 % (2 000 parties), `Tree-10c-4r` 49,4 %, `NoConnector` 48,6 %, `B1Lite1`
47,0 % (arrêté). Ce qui reste acquis : le V1 cherche 20,7 % plus vite à coups identiques (A1 à
A4), la règle d'arrêt, le glossaire, et une meilleure compréhension de l'arbre (au début de
partie, il ne fait que comparer ses 8 candidats : la piste C1).

## RootHalving : éliminer des candidats à la racine (05/10, soir)

**L'idée** (Sami) : à la racine, seul le choix final compte. UCB, lui, concentre ses visites sur
son favori (sur une vraie recherche : 471, 349, 269, 244, 237, 190, 168, 72), si bien que les
candidats moyens, ceux qu'il faut départager, sont peu mesurés. Le problème a un nom,
l'identification du meilleur bras à budget fixe : Successive Rejects (Audibert et al., 2010),
Sequential Halving (Karnin et al., 2013). En MCTS, un algorithme à « regret simple » à la racine et
UCB dessous (SR+CR, Tolpin et Shimony, 2012 ; H-MCTS, Pepels, Cazenave et Winands, 2014) fait
mieux que l'arbre UCB ; Gumbel MuZero met Sequential Halving à la racine.

**`+halving=1000-500-500`** (`src/sim/halving.js`) : les 8 candidats à tour de rôle pendant 1 000
itérations (125 chacun), les 4 meilleurs par taux de victoire pendant 500 (250 en tout), les 2
meilleurs pendant les 500 dernières (500 en tout) ; le finaliste au meilleur taux est joué. Sur une
recherche réelle : 500 / 500 / 250 / 250 / 125 × 4 visites. Sous les candidats, rien ne change
(UCB, 3 réponses, 5 coups). Sans l'option, l'empreinte du 1.0 reste `152e2a9c9d66170c`.

| Méthode | Visites à la 1re élimination | Finalistes | Choix |
| --- | --- | --- | --- |
| UCB 0,7 (le V1) | pas d'élimination ; le moins visité 28 à 98 | le 1er 500 à 633, le 2e 370 à 609 | le plus visité |
| 7 sections égales | 36 | 492 | meilleur taux |
| Successive Rejects | 112 | 449 | meilleur taux |
| Sequential Halving (3 × 667) | 83 | 583 | meilleur taux |
| **RootHalving 1000-500-500** | **125** | **500** | meilleur taux |

Une réserve : chez nous, les visites d'un candidat creusent aussi son sous-arbre ; un candidat
éliminé tôt n'est plus approfondi. Seul le jeu tranchera. Validation courte en file
(`VALIDATE_SHRT_@_RootHalving`), au même nombre d'itérations (même coût).

**Validation courte de RootHalving** (400 parties contre le V1, 2 000 itérations des deux côtés,
23 h 58 – 0 h 41) : **49,5 % (44,8 – 54,2)**, 48,5 % en commençant, 50,5 % en second. Neutre : mieux
départager les candidats ne change rien de visible. Avec ce qu'on sait de l'arbre au début de
partie (il ne fait que comparer ses 8 candidats) et de `DistOracle1Root` (mieux les choisir ne
paie pas), la racine du V1 n'est pas son point faible : les écarts entre ses bons candidats sont
trop petits pour que la façon de les départager compte, à 2 000 itérations. Pas de validation
longue. Avec 5 réponses par étage, `RootHalving-Tree-5w` a eu ses validations longues (52,0 % sur
3 000 parties) : rien de plus que la largeur seule, écarté (voir « Les validations longues de la
largeur »).

**Le duel pour l'honneur** (Sami, 06/10 : `RootHalving-Tree-2r-6d`, l'élimination à la racine en
750 / 375 / 375 avec un arbre de 2 réponses sur 6 coups, contre le V1, 1 500 itérations des deux
côtés, 300 parties, 0 h 58 – 1 h 23) : **50,0 % (45,0 – 55,0)**, 48,0 % en commençant, 52,0 % en
second. Une égalité parfaite : un arbre plus étroit et plus profond, avec l'élimination à la racine,
joue aussi bien que le V1, ni mieux ni moins bien.

**Plus large dans l'arbre : `RootHalving-Tree-5r`** (Sami, 06/10, lancé à la main : à chaque étage, le
cœur propose 5 réponses au lieu de 3 ; l'élimination à la racine en 750 / 375 / 375 ; 1 500
itérations des deux côtés, 300 parties, 2 h 08 – 2 h 34) : **54,3 % (49,3 – 59,4)**, 52,0 % en
commençant, 56,7 % en second. Le meilleur résultat contre le V1 du plan des 55 %, pas encore décidé
(la fourchette basse touche 50 %). Le coût par itération est le même (au repos, 743 et 748 µs contre
752 : le cœur note tous les coups à chaque étage, en garder 5 au lieu de 3 ne coûte rien) : le duel
était bien à temps égal. C'est la première largeur qui ne perd pas à ce budget : `Tree-10c-4r`
élargissait aussi la racine (10 candidats) et faisait 49,4 %.

### Les validations longues de la largeur : Tree-5w et RootHalving-Tree-5w (06/10, nuit)

Les noms en `w` (widen) du glossaire ; les jobs, lancés avant le renommage, gardent leur `r`
(`VALIDATE_LONG_01…12_RootHalving-Tree-5r`, `VALIDATE_LONG_1…4_Tree-5r`). Contre le V1
(`ismcts+widen=3+depth=5+core=stfig6@2000`), 2 000 itérations des deux côtés, 18 fils, sans règle
d'arrêt, 2 h 51 – 8 h 44 :

| Version | Moteur | Parties | Score | Fourchette à 95 % | En commençant / en second |
| --- | --- | --- | --- | --- | --- |
| **Tree-5w** | `ismcts+widen=5+depth=5+core=stfig6@2000` | 1 000 (4 × 250) | **53,4 %** | **50,6 – 56,2** | 53,2 / 53,6 % |
| RootHalving-Tree-5w | `…widen=5…+halving=1000-500-500@2000` | 3 000 (12 × 250) | 52,0 % | 50,5 – 53,5 | 48,3 / 55,7 % |

Par duel : Tree-5w 53,2 / 52,8 / 56,0 / 51,6 % ; RootHalving-Tree-5w 56,4 / 50,4 / 53,6 / 51,2 /
51,6 / 52,8 / 50,8 / 47,2 / 52,8 / 55,6 / 50,0 / 51,6 %.

**Les deux battent le V1** (fourchette basse au-dessus de 50 %) : ce sont les deux premières
versions validées du plan des 55 %. **Le gain vient de la largeur seule.** Sur les mêmes donnes
(décalages 1 à 4, 1 000 parties appariées une à une), Tree-5w fait +0,5 point de plus que
RootHalving-Tree-5w (± 3,7) ; 64 % des parties finissent pareil. L'élimination à la racine n'ajoute
rien, comme sa validation courte à 3 réponses (49,5 %) le laissait prévoir : à 2 000 itérations,
la façon de départager les candidats ne compte pas, ce que voit l'arbre sous eux, si.

Ce qui change dans le jeu (`npm run versus`, labels `tree5w` et `rhtree5w`) : peu de choses au
début ; au milieu et en fin de partie, plus de brelans (+1,3 à +2,6 points pour Tree-5w), moins
de côtés sans figure (-1,4 à -1,6), moins de cartes posées à côté d'une borne perdue (-3,0) ;
2,90 bornes gagnées par partie contre 2,71 (RootHalving-Tree-5w : 2,92 contre 2,69, la même forme). Voir 5 réponses adverses au lieu de 3 trouve les
parades que le V1 ne regardait pas.

**La suite** : RootHalving est écarté (du code en plus, sans gain). Tree-6w et Tree-7w (même
moteur, `widen=6` et `widen=7`, 4 × 250 parties chacun) tournent jusque vers 12 h 40 et donnent la
courbe de largeur au même budget. La version du robot ne change pas avant cette courbe et l'accord
de Sami.

### La courbe de largeur : Tree-6w et Tree-7w (06/10, matin)

Même protocole (contre le V1 à 2 000 itérations, décalages 1 à 4, 4 × 250 parties, sans règle
d'arrêt, 8 h 44 – 11 h 57) :

| Réponses par étage | Version | Score | Fourchette à 95 % | Par duel | Contre Tree-5w, mêmes donnes |
| --- | --- | --- | --- | --- | --- |
| 3 | V1 | 50 % | — | — | — |
| 5 | **Tree-5w** | **53,4 %** | **50,6 – 56,2** | 53,2 / 52,8 / 56,0 / 51,6 | — |
| 6 | Tree-6w | 52,5 % | 49,9 – 55,1 | 55,2 / 52,0 / 46,4 / 56,4 | -0,9 ± 3,7 |
| 7 | **Tree-7w** | **54,6 %** | **51,9 – 57,3** | 54,0 / 54,8 / 53,6 / 56,0 | +1,2 ± 3,8 |

Le coût par itération ne bouge pas avec la largeur (au repos, 3 passes : 749 – 756 µs à 3
réponses, 740 – 749 à 5, 748 – 750 à 6, 745 – 748 à 7) : le cœur note tous les coups d'un nœud
quelle que soit la largeur, en garder 7 au lieu de 3 ne coûte rien. Les duels de Tree-7w ont
pourtant duré 25 min contre 22 pour Tree-5w : la machine servait aussi en journée.

**La lecture** : le saut est entre 3 et 5 réponses (+3,4 points) ; au-delà, un plateau. Tree-5w
et Tree-7w sont validés, Tree-6w les frôle, et les trois se valent à la précision de 1 000
parties (± 3,7 points d'écart sur les mêmes donnes). Le creux de Tree-6w tient à un duel
(46,4 %, décalage 3) : du bruit, pas une forme. `npm run versus`, label `tree7w` : 2,89 bornes
gagnées par partie contre 2,69, côtés sans figure 1,77 contre 1,88 — la même forme que Tree-5w.

**Le biais de siège des donnes, et l'option par siège** (la question de Sami : 5 réponses en
commençant, 6 ou 7 en second). Entre deux robots proches du V1 à 2 000, le premier joueur gagne
48,1 % (12 200 parties ; 44,9 % au 1.0 contre lui-même à 800) : jouer second est un léger
avantage. Mais le score d'un siège dans un duel est dominé par les donnes : chacune est jouée
dans les deux sièges, une donne qui favorise le premier joueur gonfle le « en commençant » et
creuse le « en second » du même duel. Au décalage 1, les trois largeurs font 58 à 61 % en
commençant et 48 à 50 % en second ; aux décalages 3 et 4, l'inverse. Le score total annule ce
biais, pas le partage par siège (125 parties par case : ± 8,8 points). La seule mesure propre
compare deux largeurs dans le même siège sur les mêmes donnes :

| Écart sur les mêmes donnes | En commençant | En second |
| --- | --- | --- |
| Tree-6w − Tree-5w | -3,4 ± 5,1 | +1,6 ± 5,3 |
| Tree-7w − Tree-5w | 0,0 ± 5,5 | +2,4 ± 5,3 |
| RootHalving-Tree-5w − Tree-5w | -5,0 ± 5,4 | +4,0 ± 5,0 |

Le partage par siège, duel par duel (en commençant / en second, 125 parties par case, ± 8,8
points) : la forme de chaque ligne vient des donnes, pas de la largeur.

| Donnes | Tree-5w | Tree-6w | Tree-7w |
| --- | --- | --- | --- |
| décalage 1 | 58,4 / 48,0 | 60,8 / 49,6 | 57,6 / 50,4 |
| décalage 2 | 55,2 / 50,4 | 50,4 / 53,6 | 52,0 / 57,6 |
| décalage 3 | 49,6 / 62,4 | 40,0 / 52,8 | 48,8 / 58,4 |
| décalage 4 | 49,6 / 53,6 | 48,0 / 64,8 | 54,4 / 57,6 |
| décalage 5 | — | — | 49,6 / 59,2 |
| décalage 6 | — | — | 45,6 / 61,6 |

Les donnes sont bien les mêmes d'une version à l'autre pour un même décalage (graine
`SEED + 1 000 003 × décalage`, `scripts/duel.js`) : les 250 parties du décalage 1 concordent
une à une entre les quatre versions (force des mains, jokers de départ, qui commence). Seul le
hasard des recherches diffère.

Tree-7w ne perd rien en commençant : l'hypothèse « plus large coûte au premier joueur » ne tient
pas, et rien n'est significatif. Pas d'option par siège.

**La suite** : la largeur à retenir est entre 5 et 7, à coût égal ; 7 a le meilleur score et la
meilleure fourchette basse. Pour l'Expérimental 1.1 (`ismcts+widen=7+depth=5+core=stfig6`), à
décider avec Sami ; la version du robot n'a pas changé.

**Tree-7w confirmé sur 1 500 parties** (Sami, 06/10 : 500 parties de plus avant d'en faire
l'Expérimental 1.1 ; `VALIDATE_LONG_5` et `_6_Tree-7w`, donnes nouvelles, 12 h 39 – 13 h 40) :
54,4 et 53,6 % sur les décalages 5 et 6, 54,0 % (49,9 – 58,1) à eux deux. Les six duels réunis :
**54,4 % (52,1 – 56,7)**, 51,3 % en commençant, 57,5 % en second. Le score ne retombe pas sur
d'autres donnes : la largeur 7 est la candidate à l'Expérimental 1.1.

**Ce que la largeur fait à la profondeur** (06/10, 36 positions des tours 12 à 21, 2 000
itérations) : un nœud ne choisit par UCB qu'une fois toutes ses réponses visitées une fois ;
avant, il prend la première jamais jouée. Part des choix faits par UCB, étage par étage :

| Étage | 0 (racine) | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- | --- |
| 7 réponses par étage | 100 % | 82 % | 7 % | ~0 (173 passages sur 2 000) | ~0 (2) |
| 3 réponses (V1) | 100 % | 88 % | 42 % | 7 % (811 passages) | 3 % (85) |

Avec 7 réponses, l'arbre n'apprend vraiment que sur deux étages : ses propres candidats et les
réponses adverses ; la profondeur 5 ne sert presque plus. Ce qui paie dans la largeur, c'est de
voir plus de réponses adverses au premier étage, pas de voir plus loin.

## FirstExplo : moins d'exploration pour le premier joueur (06/10, après-midi)

**L'idée** (Sami) : les erreurs du premier joueur coûtent le plus. Au tour critique, aux tours
impairs 13 à 21, celles du premier joueur coûtent ≈ 24 points en moyenne, contre ≈ 10,5 pour
celles du second, aux tours pairs 14 à 20. Une exploration plus basse sur ses coups
concentrerait les itérations sur ses finalistes.

**`+firstExploration=0.6`** (`src/sim/ismcts.js`, `explorationAt`) : UCB prend c = 0,6 partout
où joue le premier joueur (toujours le joueur 0), racine comprise, dans l'arbre des deux sièges ;
les nœuds du second gardent 0,7. Avec 7 réponses par étage, UCB ne choisit vraiment qu'à la
racine et au premier étage (voir plus haut) : en pratique, l'option règle la racine quand le
robot commence, et les réponses qu'il attend du premier joueur quand il est second. Sans la clé,
rien ne change (empreintes du 1.0 et du 0.9 identiques).

**Le banc des finalistes** (`$CLAUDE_JOB_DIR/tmp/finalists.mjs`, Tree-7w à 2 000, 100 positions
des tours 12 à 21 de 10 parties du cœur, deux graines chacune) :

| c du premier joueur | Racine : part du 1er candidat | des 2 premiers | Étage 1 : part de la 1re réponse | Coup joué identique avec 2 graines (racine du 1er joueur) |
| --- | --- | --- | --- | --- |
| 0,4 | 40,4 % | 62,8 % | 12,0 % | 19 / 50 |
| 0,5 | 37,3 % | 57,3 % | 10,8 % | 15 / 50 |
| **0,6** | **31,7 %** | **52,5 %** | 9,6 % | 17 / 50 |
| 0,7 (Tree-7w) | 28,5 % | 47,4 % | 8,7 % | 19 / 50 |
| 0,8 | 26,2 % | 45,0 % | 7,9 % | 15 / 50 |

- **Le gain en visites** : à 0,6, les deux finalistes reçoivent 1 051 visites sur 2 000 au lieu de
  948 (+11 %) ; à 0,5, 1 145 (+21 %) ; à 0,4, 1 256 (+32 %).
- **L'étage 1** : une réponse adverse n'y reçoit jamais beaucoup (la première, 9 % des
  visites) : les 7 meilleures du cœur changent d'un monde tiré à l'autre, un nœud en accumule
  bien plus que 7.
- **Le bruit du coup joué** : à 2 000 itérations, avec deux graines différentes, Tree-7w ne
  joue le même coup que dans 19 positions sur 50 ; la racine départage des candidats très
  proches. Changer c change le coup dans 27 positions sur 50, autant que changer la graine, et
  aucun c ne rend le choix plus stable. Le banc ne dit donc pas quel c joue le mieux : il dit
  combien chacun concentre. Seuls les duels le disent.

**L'exploration avant FirstExplo** : une valeur fixe a déjà été essayée sur le 0.9 (0,5 : 56,9 %
au tri, 49,0 % en duel long ; 1,0 : 52,8 % au tri, 02/10) ; le score bouge peu avec c. Une
exploration qui baisse au fil des itérations (`ExploreDecay`, Sami, 05/10 : 0,9 puis 0,4, ou une
sigmoïde) n'a pas été écrite : le coup joué étant le plus visité, une exploration qui s'effondre
après 1 000 itérations entérine le favori du moment au lieu de le vérifier. L'élimination par
moitiés à la racine (`RootHalving`) l'a remplacée, neutre. `FirstExplo` est la première à ne
toucher qu'un joueur.

**La validation** : c = 0,6 (le choix de Sami, +11 % de visites aux finalistes), 4 duels contre
le V1 sur les donnes 1 à 4 de Tree-7w (`VALIDATE_LONG_1..4_FirstExplo6-Tree-7w`), comparés partie
par partie à Tree-7w.

**Le verdict de FirstExplo6-Tree-7w** (14 h 04 – 14 h 28 ; la règle d'arrêt, ajoutée à la demande
de Sami après le duel 1, a annulé les duels 3 et 4) : 48,4 puis 48,0 %, **48,2 % (44,5 – 51,9)**
contre le V1. Sur les mêmes 500 parties, contre Tree-7w :

| | FirstExplo6-Tree-7w | Tree-7w | Écart partie par partie |
| --- | --- | --- | --- |
| Total | 48,2 % | 54,4 % | **-6,2 ± 5,2** |
| En commençant | 47,6 % | 54,8 % | -7,2 ± 7,1 |
| En second | 48,8 % | 54,0 % | -5,2 ± 7,5 |

**Écarté.** Moins d'exploration pour le premier joueur coûte dans les deux sièges :
- **en commençant** (sa racine à 0,6) : concentrer les visites sur deux finalistes, quand les
  bons candidats sont si proches que la graine change le coup joué une fois sur deux, ne choisit
  pas mieux ; les autres candidats sont moins vérifiés ;
- **en second** (les réponses attendues du premier joueur à 0,6) : le robot regarde moins de
  réponses adverses, c'est-à-dire l'inverse de ce qui fait gagner Tree-7w (voir plus de réponses
  au premier étage).

La leçon rejoint la courbe de largeur : ici, ce qui paie, c'est de vérifier plus, pas de se
concentrer plus. Le tour critique dit que les erreurs du premier joueur coûtent le plus, mais
moins explorer ne les évite pas. Une piste dans l'autre sens, non testée : plus d'exploration aux
nœuds de l'adversaire (c = 0,8 à 1,0 au premier étage), comme une largeur de plus.

**FirstExplo8-Tree-7w, l'autre sens** (Sami, 06/10 : 0,8 au lieu de 0,6, plus d'exploration pour le
premier joueur ; 14 h 37 – 15 h 23) : 49,2 puis 50,8 %, **50,0 % (46,3 – 53,7)** sur 500 parties.
Contre Tree-7w sur les mêmes donnes : **-4,4 ± 5,3** points, -8,0 ± 8,0 en commençant, -0,8 ± 7,0 en
second. Arrêté à la main au duel 3 (Sami) : 0,6 et 0,8 font tous deux moins bien que 0,7, et
surtout quand le robot commence. Rien ne dit qu'on gagne à toucher c ; 0,7 reste partout.

## Expérimental 1.1 : 7 réponses par étage (06/10)

Moteur : `ismcts+widen=7+depth=5+core=stfig6@2000` (Tree-7w). Le 1.0 reste
`ismcts+widen=3+depth=5+core=stfig6@800` (`V1_ENGINE` dans `src/config/bots.js`, la référence de
la base de l'oracle et du banc, que la sortie ne déplace pas).

- **Ce qui change** : à chaque étage de l'arbre sous la racine, les 7 meilleures réponses du cœur
  au lieu de 3. Même coût par itération (740 à 756 µs au repos pour les largeurs 3 à 7) : le
  cœur note tous les coups d'un nœud de toute façon.
- **La mesure** : 54,4 % (52,1 – 56,7) contre le 1.0 sur 1 500 parties, six jeux de donnes, 2 000
  itérations des deux côtés (dont 54,0 % sur deux jeux de donnes nouveaux). Plus de brelans, moins
  de côtés sans figure, 2,89 bornes gagnées par partie contre 2,69.
- **Le budget de la gamme passe de 800 à 2 000 itérations** pour les duels hors de la page : c'est
  le budget du labo depuis le 04/10, celui où la largeur a été validée (à 800, une largeur de 7
  n'a pas été mesurée). Dans la page, rien ne change : jusqu'à 10 s par coup, environ 13 000
  itérations.
- **Ce qui a été essayé autour et écarté** : la largeur 5 et 6 (un plateau, 5 à 7 se valent),
  l'élimination par moitiés à la racine, une exploration différente pour le premier joueur (0,6
  et 0,8).

**Le 1.1 au banc de similitude** (`npm run banc`, 3 721 positions, contre le 1.0 à 2 000 itérations
lui aussi, 21 min) : valeur oracle **51,3 % contre 49,6 %**, soit +1,76 point (+0,63 – +2,90) sur les
2 306 positions où les deux jouent autrement : « à pousser », le premier verdict positif du banc
pour une version qui a aussi gagné ses duels. Le gain est tout en fin de partie : tours 4-10,
37,3 % contre 37,9 % ; tours 11-20, 48,7 % contre 48,8 % ; **tours 21-30, 63,5 % contre 58,4 %**
(même coup que l'oracle 32,9 % contre 26,3 %). C'est là que les réponses adverses se lisent : plus
de cartes connues, moins de réponses différentes d'un monde tiré à l'autre, et UCB qui en voit 7.

## Les pièges de fin de partie (07/10, feuille de route 1.2)

**La question** (Sami) : combien de puzzles faut-il pour voir les pièges qui reviennent, et
lesquels ajouter au cœur 1.2 ? `npm run traps` (`src/sim/traps.js`) résout exactement les fins de
partie des duels gardés (pioche vide, tours 31 à 37) ; là où le joueur au trait gagne mais où le
favori du cœur des simulations du 1.1 (`stfig6`) perd, l'erreur est rangée par famille.

**Le passage complet** (`traps-full`, 100 min sur 18 fils, chaque résolution plafonnée à
400 000 positions) : 82 403 fins de partie examinées sur 145 715 (le temps a manqué pour le
reste), 828 trop profondes laissées de côté, 42 074 gagnées pour le joueur au trait. **Le cœur
s'y trompe 1 507 fois, soit 3,6 %.** À 1 507 erreurs, une famille se lit à ± 2,4 points.

| Famille | Pièges | Part | Rang du coup gagnant chez le cœur (médiane) |
| --- | --- | --- | --- |
| ni la carte ni la borne du coup gagnant | 449 | 29,8 % | 2 |
| bonne carte, mauvaise borne | 288 | 19,1 % | 2 |
| **joker posé, alors qu'il fallait le garder** | 247 | **16,4 %** | 2 |
| **joker gardé, alors qu'il fallait le poser** | 226 | **15,0 %** | 3 |
| bonne borne, mauvaise carte | 165 | 10,9 % | 2 |
| une borne de plus devient perdue | 67 | 4,4 % | 2 |
| côté complété, et la borne est perdue | 64 | 4,2 % | 2 |
| borne vierge ouverte | 1 | 0,1 % | 4 |
| carte jetée sur une borne déjà perdue | 0 | 0 % | — |

- **Le joker est le piège le plus net** : 473 erreurs sur 1 507 (31 %), dans les deux sens. Le
  cœur juge le joker par un prix fixe (`jokerCost`) ; en fin de partie, tout est connu, et ce
  prix ne dit plus rien.
- **Le bon coup est presque toujours juste derrière** : 2e choix du cœur dans 927 pièges sur
  1 507 (62 %), 3e dans 238. Le cœur ne se trompe pas de plan, il départage mal deux coups proches.
- **Les erreurs de placement** (60 %) ne se lisent pas encore sur le plateau : il faudra des
  traits plus fins (l'ordre dans lequel les côtés se complètent, qui départage les égalités, et ce
  que la carte posée donne à l'adversaire).
- Les pièges tombent surtout juste après la fin de la pioche (tours 31-32 : 754 sur 1 507).

**Pistes pour le cœur 1.2**, à valider comme d'habitude (cœur contre cœur, puis duels longs contre
le 1.1) :
1. **le joker en fin de partie** : pioche vide, le prix fixe du joker remplacé par ce qu'il gagne
   vraiment sur la borne (le meilleur côté qu'il complète, contre le meilleur côté adverse possible) ;
2. **un second regard sur les deux premiers coups** quand la pioche est vide : une résolution
   bornée (quelques milliers de positions) entre le 1er et le 2e choix du cœur, puisque le bon coup
   est le 2e dans 62 % des pièges.

`data/traps.json` (les familles), `data/traps-list.json` (chaque piège, avec son duel, sa partie
et son tour : de quoi en faire des puzzles).

## EndJoker : le joker en fin de partie (07/10, cœur 1.2 en essai)

**Le piège visé** : 31 % des erreurs du cœur en fin de partie sont un joker posé ou gardé à tort
(`npm run traps`). Le cœur juge un joker par un prix fixe (`jokerCost` 0,08) ; une fois la pioche
vide, tout est connu, et garder le joker ne vaut que ce qu'il gagnerait ailleurs.

**Le réglage** (`endJoker`, `src/sim/end-joker.js`, cœur `stfig6ej`) : pioche vide, le joker posé
sur la borne b gagne ce qu'il y gagne, moins le plus qu'il gagnerait sur une autre borne (rien si
aucune n'est meilleure). Les autres cartes ne changent pas. Éteint par défaut : l'empreinte du
1.0 reste `152e2a9c9d66170c` ; le nouveau cœur a la sienne (`900b9e3dcf68083d`), à la même vitesse.

**Cœur contre cœur** (4 000 parties, règle de la page) : `stfig6ej` contre `stfig6`, **50,3 %
(49,2 – 51,4)**. Neutre, comme attendu : le changement ne touche que les coups pioche vide. C'est
dans l'arbre qu'il doit compter, puisque chaque simulation joue sa fin de partie avec le cœur.

**En file** : les pièges des deux cœurs sur les mêmes 1 500 parties (`npm run traps -- --games
1500 --core stfig6ej`), puis 4 duels longs `VALIDATE_LONG_n_EndJoker` contre le V1.1 à 2 000, avec
la règle d'arrêt.

## Ce qui reste à traiter (feuille de route 1.2, 07/10)

- **Le verdict d'EndJoker** (duels longs en file) ; s'il gagne, il devient le cœur du 1.2.
- **Un second regard sur les deux premiers coups** du cœur pioche vide : le bon coup est son 2e
  choix dans 62 % des pièges ; une résolution bornée entre les deux, à mesurer en coût d'abord.
- **Les erreurs de placement** (60 % des pièges) : des traits plus fins à écrire dans
  `src/sim/traps.js` (l'ordre dans lequel les côtés se complètent, ce que la carte donne à
  l'adversaire), avant d'en tirer une règle.
- **5 000 pièges** : le corpus des duels n'en donne qu'environ 3 000 ; il faut plus de parties
  (auto-jeu du 1.1) pour lire les petites familles.
- **Les puzzles de Sami** : `npm run puzzle-stats` une fois ses tentatives assez nombreuses, pour
  croiser ses faux pas avec les familles de pièges.

**EndJoker, les mesures** (07/10, soir) :
- **Les pièges, sur les mêmes 3 779 fins de partie gagnées** (`npm run traps -- --games 1500`) :
  le cœur du 1.1 s'y trompe 126 fois (3,33 %), dont 45 avec le joker ; EndJoker 119 fois (3,15 %),
  dont 40. Cinq pièges de joker en moins sur 45 : le bon sens, mais peu. Le joker se joue sur
  plusieurs coups, et sa meilleure autre borne n'en dit qu'une partie.
- **Contre le V1.1** (`VALIDATE_LONG_1..4_EndJoker`, 2 000 itérations des deux côtés, 19 h 00 –
  20 h 39) : 51,6 / 51,6 / 54,4 / 52,0 %, **52,4 % (49,6 – 55,2)** ; 50,4 % en commençant, 54,4 % en
  second ; 2,83 bornes gagnées par partie contre 2,73. La fourchette basse touche 50 % : une
  tendance, pas encore une version. Comme pour Tree-7w, 500 parties de plus sur des donnes
  nouvelles (décalages 5 et 6) sont en file pour trancher.

**L'extension avec l'arbre** (`extension-tree`, l'arbre du 1.1 à 200 itérations des deux côtés,
60 parties par pioche, 6 min ; `data/extension-tree.json`) : La Somme à 64,7 % ± 10,2 pour qui la
pose, le Valet de Trèfle à 59,3 ± 10,1, les autres entre 44 et 51 %. Trop peu de parties pour
conclure ; La Somme passe au-dessus de 60 % : 200 parties de plus sur sa pioche seule sont en file.
La page « L'extension » garde la mesure du cœur (1 000 parties par pioche).

## L'arbre et les pièges, le solveur et le banc de pièges (07/10, soir)

**La question** (Sami) : la famille « ni la carte ni la borne du coup gagnant » pèse 29,8 % ; faut-il
changer l'arbre, par exemple résoudre exactement chaque simulation dès que la pioche est vide ?

**Ce que fait vraiment le 1.1** : sur 101 pièges du cœur (un sur quinze de `traps-list.json`),
l'arbre à 2 000 itérations trouve le coup gagnant **69 fois (68 %)** : le bon coup est souvent le
2e ou 3e choix du cœur, l'arbre le regarde. Il en reste un tiers.

**Le solveur dans les simulations** : une résolution exacte d'une position pioche vide (la valeur
seule) coûte 20 ms en médiane, 232 ms en moyenne, 0,6 s au 9e décile, 5,6 s au pire. Dans chaque
simulation, environ 8 minutes par coup au lieu de 1,5 s : hors de portée. Le gain serait d'ailleurs
mince, le cœur ne se trompant que dans 3 à 4 % des fins gagnées.

**Le solveur pour le vrai coup** : pioche vide, tout est connu (la main adverse est le reste des
cartes). L'option `+exact=12` calcule le coup exactement jusqu'à 12 cartes (au lieu de 8), avec un
plafond de positions au-delà duquel l'arbre reprend : `ExactEnd12`, 4 duels longs contre le V1.1
en file. Essayée le 01/10 sur le 0.8 (47,2 % sur trop peu de parties), jamais avec le 1.1.

**Le banc de pièges** (`npm run trap-bench`, `src/sim/trap-bench.js`) : pour passer de 1 507 à
5 000 pièges, des parties cœur contre cœur (exactement les fins de partie que jouent les
simulations), chaque position pioche vide résolue ; un piège est gardé entier avec ses coups
gagnants, une position saine sur trois en témoin. Premier essai, 200 parties : 527 fins gagnées,
21 pièges (4,0 %). Un cœur y joue ensuite en secondes : pièges évités, positions saines cassées.
Trois passes de 16 000 parties en file (vers 5 000 pièges), puis EndJoker jugé dessus.

**EndJoker, le verdict** (07/10, 22 h) : les deux duels sur donnes nouvelles (`VALIDATE_LONG_5` et
`_6_EndJoker`) font 45,2 et 49,6 %, soit 47,4 % (43,7 – 51,1). Les six réunis : **50,7 % (48,5 –
53,0)**. **Neutre, écarté** : le 52,4 % des quatre premiers était du bruit, comme le montrent les
donnes nouvelles. Juger le joker par sa meilleure autre borne enlève quelques pièges (45 → 40 sur
les mêmes fins de partie), trop peu pour se voir en partie entière. Le banc de pièges dira s'il
faut une règle du joker plus fine (le joker se joue sur plusieurs coups).

**La Somme, 200 parties de plus avec l'arbre** (07/10, 21 h 43, `extension-tree-somme`,
`data/extension-sum-tree.json`) : sur sa pioche seule, le Valet de Carreau est posé dans 64,5 % des
parties, vers le tour 26 ; sa borne est gagnée 67,4 % du temps et la partie **64,3 % ± 8,3** pour
qui la pose. Les 60 premières disaient 64,7 % ± 10 : réunies, environ 64,5 % ± 6,4 sur quelque
210 parties où elle est posée. **Trop forte**, et la seule au-dessus de 60 %. Le premier joueur
reste à l'équilibre (49,5 %, 53,0 % sans figure). Sa règle ou sa place dans la pioche : à revoir
avec Sami.

**ExactEnd12, le verdict** (07/10, 23 h 22) : les quatre duels longs contre le V1.1 (donnes 1 à 4)
font 52,8 / 55,2 / 52,4 / 51,2 %. Réunis par paires (`npm run versus`, « ExactEnd12 ») :
**52,9 % (50,4 – 55,4)** sur 1 000 parties, la fourchette basse au-dessus de 50 %. **Gagne** : premier
candidat du 1.2. Calculer exactement le vrai coup, pioche vide, jusqu'à 12 cartes au lieu de 8 suffit
là où juger le joker (EndJoker) ne suffisait pas. Les duels ont duré 24 à 26 minutes, comme ceux
d'EndJoker : pas de surcoût visible en partie entière, mais le temps par coup dans la page (le
solveur à 9-12 cartes) reste à vérifier. La marge est mince (0,4 point) : 500 parties sur donnes
nouvelles la confirmeraient.

**ExactEnd12 confirmé sur 1 500 parties** (08/10, 02 h 46) : les deux duels sur donnes nouvelles
(`VALIDATE_LONG_5` et `_6_ExactEnd12`) font 50,4 et 54,0 %. Réunis par paires sur les six duels
(`npm run versus`, « ExactEnd12 ») : **52,7 % (50,5 – 54,8)** sur 1 500 parties, la fourchette basse
au-dessus de 50 %. **Gagne et confirmé** : ExactEnd12 devient le moteur de l'Expérimental 1.2.
Calculer le vrai coup exactement pioche vide jusqu'à 12 cartes résout les pièges où le joueur au
trait a une victoire garantie, sans alourdir le temps de recherche (24 min par duel de 250 parties).

## Le banc de pièges complet et les essais CriticalEnd (08/10, matin)

**Le banc de pièges complet** (`npm run trap-bench`, 08/10, 01 h 58) : 48 000 parties cœur contre cœur
en trois passes de 16 000 graines ; 6 377 pièges répertoriés entiers avec leurs coups gagnants (4,9 %
des fins gagnées), et 40 302 positions saines en contrôle.
- **EndJoker (`stfig6ej`)** n'évite que **293 pièges sur 6 377 (4,6 %)** et 76 positions saines cassées
  (0,2 %). Son gain est presque exclusivement sur le joker (196 pièges évités) et marginal ailleurs.
- **CriticalEnd (`stfig6crit`, `src/sim/end-urgency.js`)** : règle d'urgence pioche vide (remboursement
  du cardCost, priorité à la complétion des bornes à 2 cartes, arbitrage d'urgence face aux menaces
  adverses et parade des 3 adjacentes). Il évite **2 290 pièges sur 6 377 (35,9 %)** pour seulement
  1 158 positions saines cassées (2,9 %) : 708 pièges évités sur « mauvaise borne », 496 sur « autre »,
  394 sur « mauvaise carte », 373 sur le joker.

**CriticalEnd en duel long** (`VALIDATE_LONG_1` et `_2_CriticalEnd`, 08/10, 03 h 31) :
Donnes 1 et 2 : 51,2 et 48,0 %, soit **49,6 % (46,0 – 53,2)** sur 500 parties. Stoppé par la règle
d'arrêt. **Neutre, écarté** : un cœur tactique qui résout 36 % des pièges sur le banc statique ne
produit pas de meilleurs rollouts dans l'arbre ISMCTS, où forcer la fermeture de colonnes restreint
la variété des fins explorées.

**CriticalEnd-Exact12 (le combo)** (`VALIDATE_LONG_1` à `_4_CriticalEnd-Exact12`, 08/10, 05 h 02) :
Les quatre duels longs contre le V1.1 font 52,8 / 48,8 / 50,8 / 51,6 %, réunis par paires à
**51,0 % (48,4 – 53,6)** sur 1 000 parties. **Neutre** : le solveur exact pioche vide à 12 cartes
performe mieux quand les rollouts conservent le cœur `stfig6` neutre d'origine (52,7 %) que lorsqu'on
leur injecte l'heuristique d'urgence (51,0 %).

## L'extension consolidée avec l'arbre : 4 000 parties (08/10, 05 h 43)

La mesure consolidée (`npm run extension -- --games 500`, 41 min sur 18 fils, `data/extension-tree.json`)
joue 500 parties par pioche sur 8 configurations avec l'arbre du 1.1 à 200 itérations (barres d'erreur
resserrées à ±3,5 %) :
- **Équilibre du premier joueur** : 48,8 % sans figure, 48,0 % avec les six figures réunies (durée moyenne
  passant de 35,3 à 41,5 tours).
- **Valet de Trèfle (V♣, la plus faible gagne — règle remplacée le 08/10, voir plus bas)** : posée dans 71,8 % des parties (tour 25) ; borne gagnée
  55,6 % ; **partie gagnée 62,4 % ± 3,5**. **Trop forte** (la seule au-dessus de 60 %).
- **Valet de Carreau (V♦, La Somme)** : posée 65,1 % (tour 28) ; borne gagnée 65,0 % ; **partie gagnée
  59,9 % ± 3,8**. Redescend sous le seuil critique des 60 % avec l'échantillon élargi.
- **Les quatre autres figures** : posées tard (tours 24-26) par le joueur dominé, leur taux de victoire
  s'établit entre 41,5 % et 45,4 % (D♥ 43,5 % ± 3,2, D♠ 41,5 % ± 3,5, R♠ 45,4 % ± 3,6, R♦ 43,7 % ± 3,4).

## RolloutCrit-Exact12 : 1 000 parties (08/10, 11 h 17)

Test du découplage fin avec le cœur d'urgence v3 (45,6 % de pièges évités sur le banc complet, anti-suicide
de borne, balle de match et anti-overkill) utilisé uniquement pour les simulations de l'arbre (`rollout`),
tandis que les nœuds d'évaluation (profondeurs 1 à 5) conservent le cœur `stfig6` classique du V1.1, et
`exact=12` à la racine :
- **Quatre duels longs** (donnes 1 à 4) : 50,4 / 50,8 / 52,4 / 52,8 %.
- **Réunis par paires** (`npm run versus`, « RolloutCrit-Exact12 ») : **51,4 % (48,6 – 54,2)** sur 1 000 parties.
- **Enseignement définitif** : bien qu'amélioré (+0,4 point sur le combo initial à 51,0 %), le modèle avec
  rollout contraint reste nettement inférieur à **ExactEnd12 seul (52,7 %, borne basse 50,5 % > 50 %)**.

### La loi classique de Monte Carlo : heuristique déterministe vs diversité stochastique en rollout

Ce résultat illustre un principe classique en Monte Carlo Tree Search (MCTS / ISMCTS) : **le paradoxe de la politique de simulation**.

1. **La divergence entre banc statique et partie entière** :
   Sur le banc statique de pièges pioche vide (`tmp/trap-bench.json`), `stfig6crit` résout **45,6 % des pièges** là où le cœur de référence `stfig6` s'y trompe systématiquement (0 %). On pourrait s'attendre à ce qu'une politique individuellement plus « intelligente » rende le bot plus fort. Or en jeu complet, elle affaiblit la décision de l'arbre (51,4 % contre 52,7 % pour `stfig6`).
2. **Pourquoi l'heuristique rigide nuit au MCTS** :
   - *Perte de variété et biais d'évaluation* : La convergence de l'ISMCTS repose sur la loi des grands nombres appliquée à un faisceau large de trajectoires plausibles. Lorsqu'on injecte des règles d'urgence déterministes (compléter immédiatement une borne, pénaliser strictement un coup à risque), tous les rollouts convergent vers les mêmes fins de parties prévisibles. L'arbre perd sa capacité à échantillonner des distributions d'erreurs et de contre-attaques variées.
   - *Biais rétrograde sur le milieu de partie* : Une position médiane (tour 12 ou 18) qui préparerait une victoire globale peut être artificiellement sous-notée par les rollouts si la politique d'urgence se précipite trop mécaniquement sur un combat local en fin de simulation.
3. **Le découplage gagnant pour l'architecture 1.2** :
   - **Dans l'arbre et les simulations** : conserver un cœur de rollout stochastique, neutre et régulier (`stfig6`), garantissant la meilleure estimation statistique des valeurs de branches.
   - **À la racine en partie réelle** : activer le calcul exact rétrograde (`exact=12`) dès que la pioche est vide. Sur le plateau réel, le bot n'a alors plus besoin d'heuristique ni d'approximation : il joue à 100 % le coup mathématiquement parfait.

## Le Borné 1.0 : la canalisation de l'arbre et la fin de la saturation (09/10)

Après la sortie de l'Expérimental 1.2, une analyse du comportement en début de partie (tours 1-10) a révélé un goulot d'étranglement majeur :
- Le cœur heuristique proposait souvent 4 ou 5 coups pour une même carte sur des bornes vierges équivalentes, monopolisant le Top 7 de l'arbre sur 1 ou 2 cartes seulement.
- Dans le V1.1 et la 1.2, `widen=7` avait été introduit pour forcer artificiellement l'arbre à attraper au moins 2 cartes distinctes, mais au prix d'un facteur de branchement excessif ($7^5$ chemins) qui dispersait les 2 000 itérations sans converger au-delà du pli 1.

### La solution : Diversification au mérite (`diverse=2`) et réduction (`widen=5`)
1. **Plafond strict de 2 bornes par carte (`diverse=2`)** appliqué à tous les étages de l'arbre (`shortlist`) : la meilleure et la deuxième meilleure borne d'une carte sont conservées, les autres sont ignorées au profit de la meilleure borne des cartes suivantes.
2. **Rétrécissement de l'arbre à `widen=5`** : avec 2 bornes max par carte, 5 slots garantissent la présence d'au moins 3 cartes distinctes dans chaque nœud (contre 2 cartes auparavant sur 7 slots).
3. **Réduction de 28 % du branchement** : les 2 000 itérations de Monte Carlo descendent beaucoup plus profondément (convergence dès les plis 3 et 4).

### Le premier chiffre (09/10)
- Deux duels de 250 parties contre l'Expérimental 1.2 (@2000) : **81,2 %** (77,8 – 84,6 par paires),
  sur des donnes non notées, et pas gardés dans `duels/`. Le chiffre a suffi pour mettre le Borné au
  line-up.

### Le verdict du protocole (10/10) : il ne bat pas la 1.2
- Quatre duels longs de 250 parties, `--long --games 125 --page --offset 1` à `4`
  (`VALIDATE_LONG_1` à `4_Borne10`) : **45,6 %, 43,6 %, 49,2 %, 45,2 %**.
- Mis en commun par `npm run versus` : **45,9 % sur 1 000 parties (43,3 – 48,5 par paires)**. En
  commençant 45,6 %, en second 46,2 %. La borne haute est sous 50 % : la 1.2 est meilleure.
- Elo (`npm run elo`, 10/10) : Borné 978 ± 20, Expérimental 1.2 1 005 ± 14. Il bat toujours le
  Stratège 2.1 (75,5 % sur 200 parties). Resté au line-up comme adversaire jusqu'au 11/10, où
  Sami l'a retiré (ses replays et ses lignes d'Elo restent).
- Les 81,2 % ne se reproduisent pas, et le saut de +31 points ne ressemblait à aucun autre ; le cap à 2
  **à la racine seule** (`widen=7+diverse=2`) faisait déjà 49,0 % sur 1 000 parties. La piste
  « plus étroit, donc plus profond » n'a pas payé à 2 000 itérations.
- Ce que `versus` montre du jeu : le Borné ouvre plus de bornes vierges en début de partie (+2,7 points)
  et répond moins aux bornes adverses (−3,2) ; à jokers égaux il fait 49,2 %.
- Reste à savoir lequel coûte, de `widen=5` ou du cap dans l'arbre : un duel de chacun seul contre la 1.2.

## L'extension après la refonte du Valet de Trèfle (10/10)

`npm run extension` (cœur `stfig6` des deux côtés, 400 parties par pioche) rejoué avec la règle finale :
malus -10 pour son camp, défausse d'une carte contre deux piochées, défausse remélangée, pas de pioche
en fin de tour. Le V♣ est posé dans 39,6 % des parties (tour 34), gagne sa borne 11,7 % du temps et la
partie **29,0 % ± 5,0** : de la carte trop forte (62,4 %), il est devenu la plus faible du lot, posé tard
par le joueur dominé. Le premier joueur reste équilibré (48,0 % sans figure, 49,3 % avec les six).
À mesurer avec l'arbre avant d'y toucher (`npm run extension -- --engine …`), le cœur jouant mal la
défausse.

Un cas limite reste ouvert : pioche à une carte, le Valet avec défausse fait piocher cette carte, puis
remet la défausse dans la pioche ; la main finit à 5 (`cycleHand`, `figure-moves.js`).

## Le cœur `stfig6crit` : une branche morte (relecture du 10/10)

`sideCompletionBonus` (`end-urgency.js`) donnait 0,9 au lieu de 0,5 à un côté « de score 2 000 ou
plus » : aucun côté n'y arrive (64 par rang de combinaison, 286 au plus). Les chiffres mesurés
(45,6 % des pièges évités, RolloutCrit-Exact12 à 51,4 %) ont donc été obtenus sans elle. Le code
garde le comportement mesuré (empreinte `core:stfig6crit,greedy 10` → `de547e1ece02970b`, inchangée) ;
un seuil réel (une Suite couleur ou un Brelan, par exemple) serait une nouvelle idée à mesurer.

## `PW-ExactEnd12` : l'élargissement progressif sur la 1.2 (11/10)

`ismcts+widen=7+depth=5+core=stfig6+exact=12+pw=1@2000` : sous la racine, un nœud propose
1 + ⌊√visites⌋ réponses du cœur, jusqu'à 7. Testé le 02/10 sur le 0.9 à environ 800 itérations
(49,0 % au duel long) ; repris à 2 000 parce que la largeur y paie (Tree-7w) et que l'analyse d'arbre
(`w7_d5_pw1`, `docs/analyse-arbre-ismcts.md`) le montrait plus propre : arbre divisé par deux, pli 4
doublé, profondeur moyenne 4,16.
- Coût : +1,9 % par itération (`npm run bench` à 400, 1 282 contre 1 306 simulations/s, deux passes
  chacun), sous 3 % : duel à itérations égales.
- `VALIDATE_LONG_1_PW-ExactEnd12` (offset 1, 250 parties, 24 min) : **46,4 % (41,2 – 51,6)** ; 49,6 %
  en commençant, 43,2 % en second. La règle d'arrêt a annulé les duels 2 à 4.
- Hypothèse, non mesurée : il faut 36 visites pour qu'un nœud offre ses 7 réponses ; beaucoup de
  nœuds des plis 2-3 en ont 10 à 30, et y perdent 2 ou 3 réponses, là où la largeur avait payé. Le
  budget gagné va au pli 4, où le meilleur coup du cœur par donne joue déjà à peu près comme la
  simulation. Un élargissement plus rapide (7 réponses dès 9 visites, par exemple) serait une
  nouvelle idée à mesurer.

## Feuille de route 1.3 (11/10)

Après la diversité (Borné 45,9 %, cap321_2 46,8 %, w8_d4 47,0 %) et l'élargissement progressif
(46,4 %), la forme de l'arbre ne paie plus : la 1.2 reste à battre. Ce que disent les mesures :
- **Le choix à la racine, pas la couverture.** En milieu de partie, quand le coup de l'oracle est
  dans le top 8, l'arbre ne le joue qu'environ 40 % du temps (1.2 : 101 fois sur 242). Mettre le
  coup dans les candidats (w8_d4 : 56,5 % dans le top 10) n'a rien rapporté.
- **Le bruit du coup joué.** À 2 000 itérations, les visites du 1er et du 2e candidat sont dans
  un rapport de 1,38 (l'oracle : 2,05), et deux graines jouent le même coup 19 fois sur 50.
- **Le budget paie encore, sans qu'on sache combien pour la 1.2** : le 1.0 gagnait 55,2 % avec
  2,5 fois plus d'itérations, l'oracle (20 000) bat le 1.0 à 57,4 %. Jamais mesuré sur la 1.1/1.2.

**En file** (Sami, 11/10 : lancée de jour sur 18 fils si le CPU est libre) :
- `Budget4000` : la 1.2 à 4 000 contre la 1.2 à 2 000, 1 000 parties, sans règle d'arrêt.
- `PUCT` (`+puct`) : l'a priori du cœur (son rang) dans le bonus d'exploration, à la manière
  d'AlphaZero. Le chiffre retenu sort d'un tri à 400 itérations (qui écarte, ne promeut pas).
- `Ensemble` (`+trees=2`) : deux arbres de 1 000 itérations, visites additionnées.
- `ForkThreat` (`fork.js`, cœurs `stfig6fork1/2/4`) : la double menace, d'abord en cœur contre
  cœur ; ses duels longs seulement s'il y gagne.

**Ensuite, de la littérature, jamais essayé ici** : des retours à la marge (la part du résultat
qui compte les bornes d'avance), MO-ISMCTS (l'adversaire choisit selon ce qu'il voit ; la piste C1
des réponses regroupées), garder l'arbre d'un coup au suivant, les backups implicit minimax
(Lanctot 2014). Écartés d'emblée : OOS / CFR (trop lents à converger à 2 000), Gumbel (le halving a
perdu), RAVE (déjà perdu). Et une analyse d'arbre des tours 21-30, où le 1.1 a fait tout son gain.

**La vitesse** : A6 (`potential.js`) saute, dans un côté à une carte, les paires que la meilleure
troisième carte possible ne pourrait pas faire gagner ; empreintes 1.0, 1.2 et cœur inchangées.

**Les mesures du 11/10 (après-midi)** :
- **PUCT, tri à 400** contre la 1.2 à 400 (`--screen --page`, environ 400 parties chacun) :
  `puct=0.5` 47,5 % (42,7 – 52,3), `puct=1` **53,5 %** (49,0 – 58,1), `puct=2` 51,5 % (47,4 – 55,6).
  Aucun n'est écarté (le haut de chaque fourchette dépasse 50 %) ; `PUCT-1` part en 1k@2k.
- **ForkThreat, cœur contre cœur** (8 000 parties chacun, `--page`) : poids 0,1 / 0,2 / 0,4 :
  49,9 / 49,8 / 50,0 % ; poids 1,0 : 47,8 % (46,9 – 48,7). L'idée agit, mais ne rapporte rien :
  pas de duels longs. Hypothèse : l'arbre voit déjà les fourchettes qu'il peut atteindre.
- **Les puzzles « double menace »** : sur 5 665 fins de partie d'auto-jeu, 21 où chaque coup
  gagnant joue pour une borne de fourchette (#401-421, le Stratège en rate 2). Une borne y compte
  comme gagnée dès qu'elle est prouvée, revendiquée ou non.
- **En file** : `VALIDATE_LONG_1..4_Budget4000` (sans règle d'arrêt), puis `_PUCT-1` et `_Ensemble`
  (règle d'arrêt), lancés de jour sur 18 fils (Sami, 11/10).

**Leçons des premiers retours Budget4000 et pistes qualitatives (soirée du 11/10)** :
1. **Le plafond des 2 000 itérations est un mythe : le rendement du volume brut plafonne** :
   Les duels 1, 2 et 3 de `Budget4000` (750 parties sur 1 000) donnent 54,4 %, 54,4 % et 51,6 %,
   soit une moyenne cumulée de **53,5 %** pour un temps de calcul doublé. Doubler le budget de
   2 000 à 4 000 itérations n'apporte que ~3,5 points de victoire. C'est la confirmation que 2 000
   simulations par coup ne sont pas limitées par leur volume, mais par le bruit et la naïveté des
   choix sous-jacents.
2. **Double menace Puissance 4 : passer du bonus de cœur au Terminal Cutoff dans l'arbre** :
   Le test en cœur contre cœur (`stfig6fork`, 49,9 %) a montré qu'un bonus d'évaluation statique
   est dilué dans les rollouts Monte-Carlo. La vraie exploitation d'une fourche (2 bornes gagnées
   encadrées par 2 menaces imparables) consiste à l'injecter dans la simulation : dès qu'une fourche
   est verrouillée, interrompre le rollout immédiatement avec gain 1,0 (victoire garantie), et
   forcer le blocage défensif prioritaire si l'adversaire tente d'en créer une.
3. **Autopsie de Progressive Widening (Root-PW vs Fast-PW)** :
   `pw=1` a brisé le record de profondeur (4,16 en moyenne, pli 4 doublé à 335 nœuds) mais a perdu
   en duel (46,4 %) parce que la formule 1 + √visites a étranglé les plis 2-3 à 3-4 enfants faute
   d'atteindre 36 visites. Deux pistes concrètes pour garder le gain de profondeur sans brider la
   tactique :
   - *Root-PW* : n'appliquer le widening progressif qu'à la racine (les 2 000 itérations concentrent
     le budget sur le Top 4-5) tout en laissant l'arbre enfant libre à `widen=7`.
   - *Fast-Tree-PW* : élargissement accéléré ($k = \min(7, 2 + \lfloor N/3 \rfloor)$) qui libère les
     7 réponses dès 15 visites.
4. **Algorithmes de la littérature inexplorés** :
   - *MO-ISMCTS* (Multiple-Observer ISMCTS) : regrouper les répliques adverses selon ce que
     l'adversaire voit réellement plutôt que sur la donne omnisciente de la racine, éliminant la
     fusion de stratégie et l'illusion d'information.
   - *Subtree Reuse (Warm-Starting)* : conserver le sous-arbre du coup joué avec un facteur de decay
     ($\lambda = 0,5$), offrant virtuellement +500 itérations gratuites au coup suivant.
   - *Value Margin Backpropagation* : propager un score continu tenant compte de l'écart de bornes
     ($R = \text{win} + 0,15 \times \Delta_{\text{bornes}}$) pour donner un gradient net aux positions
     serrées.
   - *Budget dynamique par phase* : allouer 1 200 itérations en ouverture (T1-10, où le jeu est ouvert
     et l'accord Oracle de seulement 3-5 %) et 2 800 itérations en fin de manche (T21-30, où tout se
     décide), maintenant la moyenne exacte à 2 000 itérations par coup.


### Le verdict de la file du 11/10 (1k@2k, `npm run versus`)

| Version | Duels (offsets 1 à 4) | 1 000 parties | En commençant / en second |
| --- | --- | --- | --- |
| `Budget4000` (la 1.2 à 4 000) | 54,4 / 54,4 / 51,6 / 50,8 % | **52,8 % (50,2 – 55,4)** | 52,2 / 53,4 % |
| `PUCT-1` | 50,4 / 50,0 / 46,0 / 52,8 % | **49,8 % (47,2 – 52,4)** | 50,0 / 49,6 % |
| `Ensemble` (`trees=2`) | 54,4 / 52,8 / 55,2 / 47,6 % | **52,5 % (49,8 – 55,2)** | 53,0 / 52,0 % |

- **Le budget** : deux fois plus d'itérations ne rapportent que 2,8 points à la 1.2 (le 1.0 en
  prenait 5,2 pour ×2,5). Le plafond de ce qu'une astuce à budget égal peut espérer est bas.
- **PUCT** est neutre : l'avis du cœur dans UCB ne change pas la force. Ce n'est pas l'exploration
  qui manque à la racine. Écarté ; l'option reste (`+puct`).
- **Ensemble** fait presque autant que deux fois plus d'itérations (52,5 % contre 52,8 %) **au même
  coût** : le bruit du coup joué coûte autant que la moitié du budget. La borne basse touche 50 %
  (49,8) : une tendance, pas encore une version. Comme pour Tree-7w et EndJoker, 500 parties de plus
  sur des donnes neuves (offsets 5 et 6) trancheraient ; `trees=3` et `trees=4` seraient la suite.
- Le « budget par phase » de la liste ci-dessus a déjà été mesuré le 02/10 (`+late`, `+early` :
  45,8 et 48,6 %) et le 05/10 (`EarlyBudget` : 49,4 à 50,2 %) : à ne pas refaire sans raison neuve.

### La file du 12/10 : confirmer Ensemble, puis 3 et 4 arbres

- `VALIDATE_LONG_5_Ensemble` et `_6_` : deux jeux de donnes neufs, la série de confirmation
  (comme Tree-7w et EndJoker) ; puis `Ensemble3` (`trees=3`) et `Ensemble4` (`trees=4`) sur les
  offsets 1 à 4, tous avec la règle d'arrêt.
- **Pourquoi pas `depth=3` pour ces petits arbres** (question de Sami) : la profondeur n'est
  qu'un plafond. Un arbre s'arrête au premier nœud nouveau et ne crée un pli que si les visites y
  mènent ; à 2 000 itérations, la 1.2 n'a déjà que 159 nœuds au pli 4 et aucun au pli 5, le 3e
  étage n'est atteint que 173 fois. À 1 000, 667 ou 500 itérations, `depth=3` et `depth=5` font
  presque les mêmes arbres, sans rien coûter de plus. Le 01/10, la profondeur 3 contre 4-5 était
  déjà neutre.
- **Pourquoi pas `pw`** : il a perdu (46,4 %) en privant les plis 2-3 de leurs 7 réponses (36
  visites pour les ouvrir toutes). Un petit arbre a encore moins de visites par nœud : il en
  serait plus étranglé encore.
- Coût par itération (`npm run bench` à 400, deux passes alternées) : la 1.2 1 440 simulations/s,
  `trees=3` 1 438 (−0,2 %), `trees=4` 1 430 (−0,7 %) : duels à itérations égales.

**Le verdict de la file du 12/10** :

| Version | Duels | Mise en commun | Verdict |
| --- | --- | --- | --- |
| `Ensemble`, confirmation | offset 5 : 47,6 % ; offset 6 : 48,4 % | **51,0 % (48,8 – 53,2)** sur les 1 500 parties des offsets 1 à 6 | neutre : les 52,5 % des offsets 1-4 ne tiennent pas |
| `Ensemble3` | offset 1 : 42,0 % (36,7 – 47,3), arrêté | — | perd |
| `Ensemble4` | 48,8 % puis 43,6 %, arrêté | 46,2 % (42,6 – 49,8) sur 500 parties | perd |

- Partager le budget entre plusieurs arbres ne retire pas le bruit du coup joué : chaque arbre perd
  en profondeur ce que la moyenne gagne en stabilité, et plus il y a d'arbres, plus la perte
  domine (3 et 4 arbres perdent nettement). Écarté ; l'option reste (`+trees`).
- Avec PUCT (49,8 %) et Ensemble (51,0 %), les deux leviers de « la racine choisit mal » ne
  rapportent rien. Le seul gain mesuré du 1.3 reste le budget brut (Budget4000 : 52,8 %), et il
  coûte deux fois le temps. Dans la page, où le robot a jusqu'à 10 s, `@4000` y serait le
  levier le plus simple : à mesurer en temps réel (worker, pondération) avant d'en faire une version.

## Un cœur allégé pour plus d'itérations ? Non (12/10)

**L'idée de Sami** : un cœur de simulation moins cher, pour donner 3 000 à 4 000 itérations à
l'arbre dans le temps de la 1.2 à 2 000, l'arbre compensant ce que le cœur ne calcule plus
(`midCore@3000`, `lightCore@4000` contre `fullCore@2000`).

- **Le profil de la 1.2** (`node --cpu-prof`, les 12 positions de milieu de partie du banc, 400
  itérations, 3 graines) : **les simulations prennent 80,5 %** du temps, les shortlists de l'arbre
  10 %, le tirage 2,2 %. La notation des coups (`scoreStrategist`) 84,7 %, dont le potentiel 41 %
  (`drawPotentialOf` 19,8 % à lui seul, `singlePotential` 11,3 %, `pairPotential` 7,6 %) ; les
  bonus (`strategistAdjust`, `oracleBonus`, `openPair`…) environ 15 %.
- **Le Basique ne ferait presque rien gagner** dans les simulations : il passe par le même
  potentiel (`views`, `moveGain`) ; le cœur nu n'allait que 9 à 11 % plus vite (02/10). Le Stratège
  joue lui-même des fins de partie : bien plus lent.
- **Le plafond est déjà mesuré** : la 1.2 à 4 000 itérations, cœur complet, ne fait que **52,8 %**
  (Budget4000, 11/10). C'est le meilleur cas d'un cœur allégé (deux fois plus d'itérations sans
  rien perdre) ; un cœur moins juste resterait en dessous, ou perdrait comme B1Lite1 (47,0 % à
  temps égal).
- **Un cœur bon marché demande son propre réglage** : un premier cœur en O(1) par coup (côté à 2
  cartes noté par sa meilleure fin, à 1 carte par la carte seule, sans tirage) ouvrait une borne
  vide plutôt que de compléter un Brelan de 7 : face à un côté adverse vide, sa chance de gagner
  saturait, faute du potentiel avec tirages qui fait justement le coût du cœur. Le code n'a pas
  été gardé.
- **Décision (Sami)** : abandonner « moins cher, plus d'itérations », viser la **qualité** de ce
  que l'arbre évalue. Puisque doubler le budget ne rapporte que 2,8 points, le diviser par deux
  ne devrait en coûter qu'à peu près autant : un cœur de simulation plus juste, même deux fois plus
  lent, est rentable dès qu'il gagne ~3 points — à mesurer à temps égal. Les écarts sont toujours
  venus de là : `stfig` (1.0), la largeur (1.1), le solveur (1.2).

## Des simulations plus justes, à temps égal (12/10)

**L'idée de Sami** : puisque le budget rapporte peu au-dessus de 2 000, faire des simulations plus
justes quitte à en faire moins, à 2 s par coup. Deux versions (les simulations seulement ; la
racine et les nœuds gardent le cœur de la 1.2) :
- **`SimCertain`** (`+simCertain=1`) : les simulations gardent l'idée `certain`, retirée en 0.7
  (« un tiers de la vitesse pour rien de mesurable »).
- **`SimCertainExact4`** (`+simCertain=1+simExact=4`) : en plus, une simulation s'arrête dès que la
  pioche est vide et qu'il reste 4 cartes, et le solveur donne le résultat (`playOutExact`,
  `exact.js`). À 6 cartes, trop cher : 376 simulations/s contre 1 385.

| Mesure | 1.2 | `SimCertain` | `SimCertainExact4` |
| --- | --- | --- | --- |
| Simulations/s (`npm run bench`, 400, un fil) | 1 385 | 987 (71 %) | 875 (63 %) |
| Itérations par coup à 2 s, 18 fils (replays) | ≈ 1 820 | ≈ 1 150 | ≈ 1 040 |
| `npm run policy` : coup gagnant gardé (délicates) | 93,8 % (88,3) | **95,0 % (90,8)** | (le solveur, à 4 cartes) |
| Tri à 2 s par coup contre la 1.2 (`--screen --page`) | — | **40,7 % (31,7 – 49,7)**, 108 parties | **41,0 % (34,4 – 47,5)**, 144 parties |

- Les simulations sont plus justes (`policy` +1,2 point, +2,5 sur les positions délicates), mais
  perdre un tiers des itérations coûte bien plus : les deux tris écartent (borne haute sous 50 %).
- **Le budget n'est pas symétrique** : au-dessus de 2 000 il rapporte peu (×2 : +2,8 points), en
  dessous il coûte cher (−37 % d'itérations : environ −9 points). La 1.2 est au coude de la courbe :
  une amélioration doit y être **quasi gratuite** en temps (comme le solveur à la racine, qui ne
  joue qu'une fois par coup), ou rapporter plus que les itérations qu'elle prend.
- Écartés ; les options restent (`+simCertain`, `+simExact`).

## Les quatre pistes du 12/10

**TreeReuse (`+reuse=1`, `src/sim/reuse.js`)** : l'arbre gardé d'un coup au suivant (le nœud sous
mon coup et la réponse adverse devient la racine). Mesuré avant tout duel, sur deux parties de la
1.2 à 2 000 contre elle-même : **13 visites offertes en moyenne par recherche** (moins de 1 % du
budget ; 26 recherches sur 30 en reçoivent, une seule plus de 50 : 173 au tour 26). Sous mon coup,
les 7 réponses adverses se partagent quelques centaines de visites, celle qui est jouée en a au
mieux quelques dizaines, et l'étage d'après n'est presque jamais atteint. Pas de duel : il n'y a
presque rien à garder. L'option reste.

**Les tris des pistes 1 et 2** (400 itérations des deux côtés, contre la 1.2, `--screen --page`) :

| Version | Score | Fourchette par paires | Suite |
| --- | --- | --- | --- |
| `margin=0.05` | 51,4 % (360 parties) | 46,5 – 56,3 % | gardé en réserve |
| **`MarginBackup15`** (`margin=0.15`) | **52,8 %** (324) | 48,4 – 57,2 % | 1k@2k en file |
| **`DistOracle1Root-Exact12`** (`shortlist=dist1`) | **54,6 %** (324) | 49,3 – 60,0 % | 1k@2k en file |
| `exact=14` (solveur à la racine jusqu'à 14 cartes) | 47,5 % (360) | 43,3 – 51,7 % | abandonné : le plus faible, et son temps de résolution ne compte pas dans le budget. **Relu le 16/10 : identique à `exact=12`** dans le jeu de base, le solveur attend la pioche vide et il reste alors 12 cartes au plus (6 + 6) ; le 47,5 % était du bruit |

**La piste 3 : tes victoires contre la 1.2** (3 parties ; celle du 11/10 à 17 h 07 se jouait avec
l'extension et est mise à part). Chaque coup de la 1.2 avant la pioche vide, recherché à nouveau à
20 000 itérations avec tous les coups légaux en candidats ; un coup est signalé quand la recherche
longue joue ailleurs et que le coup de la 1.2 a moins de la moitié de ses visites :
- **16 coups signalés sur 30** dans les deux parties sans figure (5 sur 15 et 11 sur 15), dont les
  premiers coups, où l'oracle lui-même ne s'accorde avec lui-même qu'une fois sur dix.
- **Un motif** dans la partie du 11/10 à 17 h 15 : des tours 15 à 23, la recherche longue veut cinq
  fois de suite renforcer la **borne 7**, un bord disputé où Sami menait 2 cartes à 1 ; la 1.2 joue
  au centre ou ailleurs. Ailleurs, les désaccords sont variés (ouvrir, répondre, compléter).
- Deux parties, c'est un indice, pas une règle : à refaire quand Sami aura d'autres victoires
  contre la 1.2 (`sami-wins`, le script du 12/10, pourra devenir une commande).

**Le verdict des duels longs (12/10 au soir)** : les deux survivants des tris tombent.

| Version | Duels | Verdict |
| --- | --- | --- |
| `MarginBackup15` | offset 1 : **45,6 %** (40,3 – 50,9), arrêté | perd : compter la marge de bornes éloigne l'arbre de ce qui gagne la partie (une victoire 4-3 vaut une victoire 6-1) |
| `DistOracle1Root-Exact12` | 48,4 % (43,2 – 53,6) puis 50,4 % (45,0 – 55,8), **≈ 49,4 %** réunis, arrêté | neutre : comme sur le V1 (51,6 %), le cœur réglé sur l'oracle ne choisit pas de meilleurs candidats pour la 1.2 |

Des quatre pistes du 12/10, aucune ne bat la 1.2 : la marge perd, `DistOracle1Root` est neutre, le
solveur à 14 cartes et la réutilisation de l'arbre ont été écartés avant les duels. Le seul gain
mesuré du 1.3 reste le budget brut (Budget4000 : 52,8 %, deux fois le temps). La piste 3 (où la 1.2
se trompe) attend des parties : celles de Sami, et celles d'un agent en console (`npm run cli`).

## La nuit du 14/10 : Oracle2, et la 1.2 relue par l'oracle

**La question** (Sami) : des parties de la 1.2 jugées par l'oracle disent-elles où elle se trompe ?
Et la sélection des 8 candidats à la racine est-elle ce qu'il faut régler pour le 1.3 ?

**Oracle2** (`ORACLES[2]`, `npm run oracle -- --oracle 2`) : l'arbre de l'oracle gelé avec ce que la
1.2 a en plus, le cœur `stfig6`, le solveur `exact=12` et 7 réponses
(`ismcts+candidates=99+widen=7+depth=5+smart=1+core=stfig6+exact=12@20000`). Il ne coûte pas plus
par itération (0,99× l'Oracle2 à 6 réponses, sur les 6 premiers coups d'une partie). Une partie
Oracle1 contre Oracle2 : 470 s sur un fil, environ 17 min à 18 fils (un coup d'oracle prend 2,2 fois
plus de temps quand les 18 fils travaillent : 64 s contre 29 s au tour 1).

**Le duel** (`ORACLE_DUEL_1/2_Oracle2`, 2 × 54 parties, donnes décalées de 10 et 11, `--page`) :

| Duel | Oracle2 contre Oracle1 | Fourchette par paires |
| --- | --- | --- |
| offset 10 | 50,0 % | 38,3 – 61,7 % |
| offset 11 | 46,3 % | 35,9 – 56,7 % |
| **réunis** (108 parties) | **48,1 %** | ≈ 40,4 – 55,9 % |

Égalité dans les marges : le cœur, le solveur et la largeur de la 1.2 ne font pas un meilleur juge.
Le `stopIf` (nouveau seuil `atLeast`, `scripts/lib/backlog-stop.js`) a gardé **Oracle1** ; l'oracle
reste en version 1.

**La relecture** (`READ_V12_Oracle1`, 55 min) : les parties 1.2@4000 contre 1.2@2000 (les duels
Budget4000 du 11/10 : le même cœur des deux côtés), tours 12 à 28, classées par `stfig6`. **1 642
positions, 851 écarts** (le coup de l'oracle, le même dans ses deux recherches, hors du top 3 du
cœur), dont 523 hors du top 8, que la racine de la 1.2 ne regarde jamais. Environ 2 s par position
sur tous les fils. Les traits de ses écarts sont ceux du 04/10 sur le 1.0 : l'oracle bâtit un côté
sans figure (30 % contre 1 % pour le cœur), complète un côté (36 % contre 18 %), joue un joker
(17 % contre 1 %) ; le cœur bâtit une suite de couleur (49 % contre 21 %).

**La confirmation par le jeu** (`CONFIRM_1/2_V12_Oracle1`, 4 graines, les 851 écarts en 3 h 25) :
pour chaque écart, le coup de l'oracle, le favori du cœur et le coup joué par la 1.2, la suite jouée
par la 1.2 (@4000 et @2000, les robots de la partie), qui tient la partie au tour 30 selon le
solveur. Ce que le coup de l'oracle tient de plus :

| Groupe | contre le favori du cœur | contre le coup joué par la 1.2 |
| --- | --- | --- |
| tous les écarts | **+2,1 ± 1,7 pts** (851) | **+0,7 ± 2,0 pts** (676) |
| **hors du top 8** (la racine ne le voit pas) | +1,0 ± 2,2 (523) | **−0,2 ± 2,2** (523) |
| **dans le top 8** (rangs 4 à 8) | **+3,8 ± 2,9** (328) | +3,6 ± 4,7 (153) |
| oracle sûr de lui (marge ≥ 0,15) | +1,8 ± 2,4 (485) | +0,1 ± 2,8 (367) |
| oracle hésitant (marge < 0,15) | +2,4 ± 2,6 (366) | +1,3 ± 2,7 (309) |

Dans 175 écarts sur 851, la 1.2 a joué le coup de l'oracle : tous dans le top 8 (175 sur 328),
sa recherche l'a trouvé depuis les rangs 4 à 8.

**Ce qui en ressort** :
- **Oracle1 ne joue pas mieux que la 1.2.** Son coup bat le premier choix du cœur (+2,1, tout juste
  hors du bruit), pas le coup que la 1.2 joue après sa recherche (+0,7 ± 2,0) : l'arbre rattrape
  déjà ce que le cœur rate. La confiance de l'oracle n'y change rien (marge ≥ 0,15 : +0,1).
- **La sélection des 8 candidats n'est pas le goulot** : les 523 coups que la racine ne voit
  jamais ne valent rien de plus (−0,2 ± 2,2). Régler la sélection du cœur sur l'oracle ne
  rapporterait rien, ce que `DistOracle1Root` (49,4 % sur la 1.2) avait déjà montré.
- **Une piste, non significative** : dans le top 8, quand la 1.2 voit le coup de l'oracle et en
  joue un autre, +3,6 ± 4,7 sur 153 cas. C'est le choix entre candidats, le bruit et le budget,
  dans le sens de Budget4000 (+2,8 points à deux fois le temps).
- **Il manque un juge plus fort que la 1.2.** Ni Oracle1 ni Oracle2 n'en sont un (Oracle2 n'est pas
  meilleur qu'Oracle1, et Oracle1 pas meilleur que la 1.2 sur ses écarts).

**Pour la suite** : trancher les rangs 4 à 8 (relire plus de positions — `READ_V12_Oracle1`
reprend où il s'est arrêté — puis ne confirmer que ce groupe, à 8 graines) ; un juge exact là où
il peut l'être (le solveur à partir de 14-16 cartes) ; Oracle3 avec l'élargissement progressif, qui
étranglerait moins les plis 2-3 à 20 000 itérations qu'à 2 000.

### Ce que dit la littérature (recherche du 14/10)

Aucun article sur Schotten Totten ni Battle Line. Le plus proche est **Lost Cities** (Knizia, deux
joueurs, une pioche), dans Pepels, Cazenave et Winands (2015) : **H-MCTS** (Sequential Halving à la
racine, UCT dessous) y fait jeu égal avec l'arbre UCT. C'est notre `RootHalving`, neutre ici aussi
(49,5 % puis 52,0 % contre 53,4 % pour la largeur seule, 05-06/10). Les autres pistes :
- **Élargissement progressif** : la règle générale est `k · N^α` enfants pour N visites (Couëtoux et
  al., 2011) ; notre `pw=1` est k = 1, α = 0,5. Pas de valeurs recommandées : elles se règlent par
  jeu, et un élargissement prudent fait des arbres petits, un élargissement agressif des arbres plus
  profonds et plus chers.
- **Hybrides MCTS-minimax** (Baier et Winands) : un minimax court comme a priori des nœuds est
  l'hybride le plus fort de leurs trois jeux ; les **sauvegardes minimax implicites** (Lanctot et al.,
  2014) gardent à part la note heuristique et le résultat des simulations. Pour nous : le cœur comme
  note séparée, mêlée au taux de victoire, plutôt que seulement comme filtre. **À tester** (Sami,
  14/10) : `oddsOf` (`truncate.js`) donne déjà une estimation de la partie ; la stocker dans chaque nœud
  et la mêler à UCB sans couper la simulation (là où `trunc` la remplaçait, et perdait).
- **Information imparfaite** : ISMCTS bat PIMC parce qu'il limite la fusion de stratégies (Whitehouse,
  2014) ; **EPIMC** (Arjonilla, Saffidine et Cazenave, 2024) retarde la résolution en information
  parfaite et gagne là où la fusion de stratégies pèse le plus. **Rejeté** (Sami, 14/10) : il améliore
  PIMC, que l'ISMCTS dépasse déjà, et la fin de partie est en information parfaite (voir « Tentatives
  écartées »).
- **Le choix final** : le coup le plus visité (« robust child ») est la règle d'AlphaZero et de Gumbel
  MuZero ; *Anytime Sequential Halving* (Sagers, Winands et Soemers, 2024) en fait une version qui
  s'arrête à tout moment, utile pour un robot à l'horloge comme celui de la page.

Sources : [Pepels, Cazenave, Winands 2015, H-MCTS](https://www.lamsade.dauphine.fr/~cazenave/papers/po-hybrid.pdf) ;
[Anytime Sequential Halving](https://arxiv.org/abs/2411.07171) ;
[MCTS-minimax hybrids](https://dke.maastrichtuniversity.nl/m.winands/documents/mcts-minimax_hybrids_final.pdf) ;
[Implicit minimax backups](https://arxiv.org/abs/1406.0486) ;
[ISMCTS, Cowling et al.](https://eprints.whiterose.ac.uk/id/eprint/75048/1/CowlingPowleyWhitehouse2012.pdf) ;
[Whitehouse 2014](https://etheses.whiterose.ac.uk/id/eprint/8117/) ;
[Revue MCTS 2022](https://arxiv.org/abs/2103.04931) ;
[Élargissement progressif, POMDP continus](https://arxiv.org/abs/1709.06196).

## Le budget des couleurs (14/10)

**L'idée** (Sami) : ouvrir une troisième borne à cœur quand 8 cœurs sur 10 sont déjà vus demande
des cartes qui ne viendront pas. Le cœur jugeait chaque côté seul contre les cartes non vues
(`potential.js`) : deux de mes côtés à cœur comptaient chacun tous les cœurs restants comme les leurs.
`suitBudget` (`src/sim/suit-budget.js`) les pèse ensemble : un côté est « sur » une couleur (borne
non décidée, 1 ou 2 cartes, toutes ses vraies cartes de cette couleur) et en réclame 3 − sa longueur ;
j'attends de la couleur mes cartes en main plus ma part des non vues (mes pioches sur les non vues) ;
le manque est ce qui dépasse, et un coup coûte `poids × la variation du manque`.

**Le brelan, lui, est déjà compté** : la valeur d'une paire (`drawPotentialOf`) fait la moyenne sur
les cartes non vues et pèse la chance de piocher une troisième carte de la valeur ou un joker. Une
paire dont les deux autres cartes sont vues vaut déjà peu ; la concurrence entre deux de mes côtés
sur la même valeur est `spread`. Un « budget des brelans » ferait doublon.

**Cœur contre cœur** (8 000 parties par poids contre `stfig6`, `--page`) :

| Poids | Score | Fourchette par paires |
| --- | --- | --- |
| 0,05 | 52,1 % | 51,2 – 53,0 % |
| 0,1 | 51,9 % | 51,0 – 52,9 % |
| **0,3** | **52,8 %** | **51,9 – 53,8 %** |
| 0,6 | 51,1 % | 50,1 – 52,1 % |
| 1 | 49,2 % | 48,3 – 50,2 % |

Le coût : 13 % de plus sur le cœur dans sa première écriture, 4 % une fois les allocations retirées
(mêmes coups : empreinte `4a9034c132a35510` à 200 parties ; le cœur sans l'idée garde `e875ba6988a3b138`
contre greedy).

**Dans l'arbre** (`SuitBudget3`, `core=stfig6sb3`, tri à 400 à temps égal contre la 1.2, `--screen
--page`, 504 parties) : **48,8 % (45,0 – 52,6)**, neutre. Comme stfig, fork ou les idées copiées de
l'oracle, le gain du cœur ne passe pas l'arbre : la recherche corrige déjà ce que l'idée corrige.
Pas de duel long sans nouvelle raison ; l'option reste (`suitBudget`, cœurs `stfig6sb05` à `sb10`).

## La double menace dans les simulations (14/10)

**L'idée** (Sami, 11/10, « Pièges Puissance 4 ») : le bonus statique du cœur (`stfig6fork`, 49,9 % en
cœur contre cœur) ne voit pas la vraie force d'une fourche ; la chercher là où la partie se joue, dans
les simulations. Une simulation joue à la règle `final`, où aucune borne n'a de propriétaire avant la
fin ; pourtant une borne aux deux côtés pleins a déjà son gagnant (`pickWinner`). `+forkCut`
(`src/sim/fork-cut.js`) tient ces propriétaires à jour quand une borne se remplit, et arrête la
simulation :
- **niveau 1, exact** : à la première victoire sur les bornes remplies. Le gagnant est celui de la
  simulation entière (vérifié sur 300 parties) ;
- **niveau 2, un pari** : aussi quand un joueur tient au moins deux menaces (des bornes qui lui
  donneraient chacune la partie) et l'autre aucune, compté gagné.

**Tris à 400, à temps égal** contre la 1.2 (`--screen --page`) :

| Version | Score | Fourchette par paires | Parties |
| --- | --- | --- | --- |
| `ForkCut1` | 51,5 % | 47,7 – 55,3 % | 468 |
| `ForkCut2` | 49,6 % | 46,1 – 53,2 % | 540 |

**Le niveau 1 ne fait rien** : mêmes coups que la 1.2 (empreinte `8aa551a563200563` à 300 itérations
contre greedy, identique) et pas plus rapide (6 807 contre 6 721 ms par partie, puis 6 838 contre
6 773). La victoire tombe presque toujours en fin de simulation : s'y arrêter n'économise rien. Son
51,5 % à temps égal est du bruit. **Le niveau 2 est neutre** : parier sur la fourche ne perd pas comme
`trunc` (41-46 %), mais ne gagne rien. La piste de la double menace est close ; l'option reste
(`+forkCut`, éteinte par défaut : empreinte de la 1.2 inchangée, `1d041613cd7bcd8d`).

## L'hybride MCTS-minimax : les sauvegardes implicites (14/10)

**L'idée** (la littérature du 14/10 : Lanctot, Winands, Pepels et Sturtevant, 2014) : garder dans
chaque nœud une estimation de la partie à part du taux de victoire de ses simulations, et les mêler à
la sélection. `+implicit=α` (`src/sim/implicit-minimax.js`) : un nœud prend l'estimation du cœur
(`winOdds`) là où il est atteint pour la première fois, avant la simulation ; en remontant, un nœud vaut
1 − la meilleure estimation de ses enfants (l'adversaire choisit) ; UCB lit (1 − α) × taux + α ×
estimation. La simulation reste entière, là où `trunc` la remplaçait. Coût : 11 % par itération
(7 659 contre 6 864 ms par partie à 300 itérations), donc tri à temps égal.

| Version | Score contre la 1.2 (`@t400`, `--screen --page`) | Fourchette par paires | Parties |
| --- | --- | --- | --- |
| `Implicit2` (α = 0,2) | 48,6 % | 44,2 – 53,1 % | 432 |
| `Implicit4` (α = 0,4) | **40,0 %** | 33,2 – 46,8 % | 180, arrêté |

Plus l'estimation pèse, plus la version perd : l'estimation du cœur vaut moins que le résultat des
simulations, et la mêler ne fait que le diluer. C'est la leçon de `trunc` sous une autre forme. Un α
plus petit ramènerait vers la 1.2 : la piste est close, l'option reste (`+implicit`, éteinte par
défaut, empreinte de la 1.2 inchangée). Les simulations vont dans `src/sim/rollouts.js`
(`ismcts.js` dépassait ses 220 lignes).

## L'oracle profond : un juge plus fort que la 1.2 (14/10)

**La question** (Sami) : Oracle1 et Oracle2 regardent tous les coups à la racine et ne battent pas
la 1.2 ; garder sa racine (8 candidats) et donner le budget à la profondeur. Deux versions, chacune
contre la 1.2@2000 sur les mêmes donnes (offset 12, 140 parties, `--page`, lancées à 14 h 05, le
CPU libre) :

| Version | Moteur | Score | Fourchette par paires | En commençant / en second |
| --- | --- | --- | --- | --- |
| `Budget20000` | `ismcts+widen=7+depth=5+core=stfig6+exact=12@20000` | **55,7 %** | 48,1 – 63,3 % | 52,9 / 58,6 % |
| `Budget20000-Depth10Pw` | `…+depth=10+…+pw=1@20000` | **61,4 %** | **55,1 – 67,8 %** | 58,6 / 64,3 % |

- **`Depth10Pw` est le premier juge qui bat la 1.2** : le bas de sa fourchette passe 55 %, et il gagne
  des deux côtés. Oracle1 et Oracle2 faisaient jeu égal avec elle (14/10, nuit).
- **2 000 itérations sont un plafond** : ×2 rapporte +2,8 points (Budget4000), ×10 seulement +5,7
  (Budget20000). Au même budget de 20 000, la profondeur avec `pw` ajoute ~6 points de plus — pas
  encore significatif (les fourchettes se chevauchent), mais net.
- **`pw=1` paie à 20 000 et perdait à 2 000** (46,4 %, `PW-ExactEnd12`) : à 20 000, les nœuds atteignent
  plus vite les 36 visites qui ouvrent leurs 7 réponses.
- **La confirmation redescend** : `DEEP_DUEL_2_Budget20000-Depth10Pw` (offset 13, 140 parties, 16 h 41 –
  17 h 52) fait **52,9 % (44,9 – 60,8)**, 51,4 % en commençant, 54,3 % en second. **Réunis : 57,1 % sur
  280 parties (≈ 52,0 – 62,3)** — toujours au-dessus de la 1.2, sous les 60 % de la règle d'un juge ;
  le premier duel avait eu de la chance, comme souvent. Pour Sami, un juge autour de 58 % est
  utilisable : on y est presque, à ± 5 points.

**La profondeur atteinte, mesurée** (`src/sim/tree-stats.js`, une position du tour 15, 42 coups
légaux ; « nœuds » : tous ceux créés à ce niveau, même jamais essayés) :

| Moteur | Niveau 2 (nœuds / 0 visite / max) | Niveau 3 | Niveau 4 | Niveau 5 |
| --- | --- | --- | --- | --- |
| 1.2@2000 | 487 / 34 / 26 | 3 767 / 2 261 / 4 | 212 / 179 / **1** | — |
| 1.2@20000 | 625 / 12 / 501 | 11 315 / 2 965 / 56 | 43 959 / 33 090 / 4 | 1 074 / 914 / **1** |
| `Depth10Pw@20000` | 621 / 8 / 373 | 8 654 / **713** / 47 | 17 521 / **6 601** / 4 | 1 009 / 491 / **1** |

- **Les niveaux 6 à 10 ne sont jamais atteints** : avec `depth=10`, l'arbre s'arrête au 5e niveau
  comme avec `depth=5`. Le gain de `Depth10Pw` vient donc de `pw`, qui concentre les visites (4 fois
  moins de nœuds jamais visités au niveau 3, 5 fois moins au niveau 4), pas de la profondeur.
- **Pourquoi c'est si dur de descendre** : le niveau 2 compte ~620 nœuds pour 8 candidats, ~78
  réponses adverses par candidat au lieu de 7. Chaque donne distribue une autre main à l'adversaire,
  donc ses 7 meilleures réponses changent d'une donne à l'autre : l'information cachée multiplie la
  largeur sous chaque coup.
- **Un outil pour la suite** : chaque coup d'un robot à arbre porte maintenant `tree` dans les replays
  (les duels, la console, le self-play ; pas le worker de la page) : ses itérations, et par niveau
  les nœuds, ceux à 0 et 1 visite, le plus visité. Une partie dit en un coup d'œil quels niveaux
  servent, et départagera les formules de `pw`. Aucun coup ne change (empreinte de la 1.2 inchangée).

**Valider sur 500 parties** : il en resterait ~220 après la confirmation, ~2 h (≈ 30 s la partie à
18 fils). Précision du score (± à 95 %) : ± 6,3 points à 140 parties, ± 4,5 à 280, ± 3,4 à 500.
Pour Sami, un juge autour de 58 % et plus est utilisable.

**La suite** :
1. **Oracle3** : à 57 % (52 – 62) sur 280 parties, `Depth10Pw` est le juge le plus fort qu'on ait ; il
   peut relire les parties de la 1.2 comme Oracle1 la nuit dernière (relecture, confirmation par le
   jeu), environ 1,5 fois plus lentement — ou d'abord gagner quelques points avec une meilleure
   formule de `pw` (point 3).
2. **Une formule de `pw` réglable pour le 1.3** (`k + c · visites^α`, au lieu de 1 + √visites) :
   `2 + √visites` (7 réponses dès 25 visites), `3 + visites / 3`. La mesure par niveau dira laquelle
   remplit les niveaux 3-4 sans les étrangler ; à essayer à 2 000-4 000 itérations contre la 1.2, à
   temps égal, sans toucher au cœur.
3. **Renforcer l'oracle** : la même formule de `pw` à 20 000 ; le solveur plus tôt (`exact=14` ou `16`,
   trop lent pour jouer, pas pour juger). Plus de profondeur (`depth=15`) ne servirait à rien tant que
   le 6e niveau n'est pas atteint.

## La formule de `pw` à 2 000 itérations : `1+`, `2+`, `3+` (14/10, soir)

**L'idée** (Sami) : si `pw` fait le gain de l'oracle à 20 000, une formule réglée pourrait servir la 1.3
directement à 2 000, sans toucher au cœur. `+pw=k` offre désormais `k + √visites` réponses sous la racine
(jusqu'à 7) ; `pw=1` est l'ancienne formule (mêmes coups, empreinte `9f8c06c64bb5eca5` avant et après),
`pw=2` et `pw=3` ouvrent les 7 réponses dès 25 et 16 visites au lieu de 36. Coût : ~2 % par itération,
donc duels à itérations égales.

**Trois duels longs contre la 1.2@2000** (`--long --page`, 180 parties chacun, mêmes donnes : offset 14) :

| Version | Score | Fourchette par paires | En commençant / en second |
| --- | --- | --- | --- |
| `pw=1` (`PW-ExactEnd12`) | 51,1 % | 46,0 – 56,2 % | 45,6 / 56,7 % |
| `pw=2` (`Pw2-ExactEnd12`) | 47,8 % | 41,8 – 53,8 % | 41,1 / 54,4 % |
| `pw=3` (`Pw3-ExactEnd12`) | 56,1 % | 49,6 – 62,6 % | 48,9 / 63,3 % |

**La forme de l'arbre** (`npm run tree-stats -- --last 3`, ~2 700 coups par version, 8 069 pour la 1.2
qui jouait les trois duels ; « atteint » : la part des coups dont l'arbre a un nœud visité à ce niveau) :

| Moteur @2000 | Niveau 3 : nœuds / 0 visite | Niveau 4 : atteint / 0 visite | **Niveau 5 atteint** |
| --- | --- | --- | --- |
| 1.2 (sans `pw`) | 3 276 / 60,0 % | 88,1 % / 77,2 % | **15,7 %** |
| `pw=1` | 1 374 / **20,5 %** | 99,9 % / 39,2 % | **55,7 %** |
| `pw=2` | 1 822 / 33,5 % | 99,0 % / 54,8 % | 28,6 % |
| `pw=3` | 2 283 / 43,7 % | 95,8 % / 64,3 % | 20,0 % |

`k` règle exactement l'équilibre entre largeur et profondeur : `pw=1` descend le plus (le 5e niveau dans
plus d'un coup sur deux), `pw=3` reste proche de la largeur de la 1.2 en descendant un peu plus.

**La validation de `pw=3`** (le protocole 1k@2k, `VALIDATE_LONG_1..4_Pw3-ExactEnd12`, offsets 0 à 3, 14/10
de 19 h 14 à 20 h 44) : 51,6 %, 53,2 %, 47,2 % et 50,0 %. Réunis avec le duel de l'offset 14
(`npm run versus`) : **51,2 % sur 1 180 parties (48,9 – 53,5)**, 49,0 % en commençant, 53,4 % en second.
**Il ne passe pas** : le bas de la fourchette reste sous 50 %. Le 56,1 % du premier duel était un duel
chanceux, comme d'autres avant lui.

**Ce qui en ressort** :
- **À 2 000 itérations, `pw` ne change pas le niveau de jeu**, quelle que soit la formule : il change la
  forme de l'arbre, pas la qualité du coup. Aller plus profond ou rester large se vaut à ce budget.
- **À 20 000, `pw=1` paie** (Depth10Pw, 57,1 % sur 280 parties) : avec dix fois plus de visites, il
  descend sans étrangler. La bonne formule dépend du budget ; pour l'oracle c'est `pw=1`.
- La piste « une formule de `pw` pour le 1.3 » est close à 2 000 ; elle resterait à essayer à 4 000, où
  Budget4000 gagnait 2,8 points.
- **Un outil reste** : `npm run tree-stats` lit la forme de l'arbre dans n'importe quel duel gardé depuis
  le 14/10.

## Oracle3 : la 1.2 relue par l'oracle profond (nuit du 14/10, fin le 15/10)

**La mesure** : la même méthode qu'Oracle1 la nuit d'avant, avec le juge le plus fort qu'on ait
(`ORACLES[3]`, `Depth10Pw@20000`, 57,1 % contre la 1.2). `READ_V12_Oracle3` relit **3 728 positions**
des duels Budget4000 (tours 12-28, le corpus d'Oracle1 et sa suite) : **1 367 écarts** hors du top 3
du cœur. `CONFIRM_1..3_V12_Oracle3` les rejouent tous (4 graines, suite jouée par la 1.2, jugés au tour
30) ; arrêtés dans la nuit, repris le 15/10 de 10 h 55 à 12 h 58.

| Groupe (contre le coup joué par la 1.2) | Oracle1 | Oracle3 |
| --- | --- | --- |
| Tous les écarts | +0,7 ± 2,0 (676) | +1,6 ± 2,1 (643) |
| Hors du top 8 du cœur | −0,2 ± 2,2 (523) | −1,0 ± 4,5 (171) |
| **Dans le top 8 (rangs 4 à 8)** | +3,6 ± 4,7 (153) | **+2,5 ± 2,4 (472)** |
| Marge de l'oracle ≥ 0,15 | +0,1 ± 2,8 (367) | +1,8 ± 2,6 (445) |
| Bascules (la 1.2 perd, l'oracle gagne / l'inverse) | 26 / 16 | 29 / 22 |

En points de part gagnée au tour 30, entre parenthèses les écarts où la 1.2 a joué autre chose que le
coup de l'oracle (elle a joué le sien dans 724 des 1 367). Contre le favori du cœur : +3,1 ± 1,5.

**Ce qui en ressort** :
- **Hors du top 8, rien** chez les deux oracles : les 8 candidats de la racine ne ratent pas de coup
  qui compte. La sélection n'est pas le goulot, c'est confirmé par un juge plus fort que la 1.2.
- **Les rangs 4 à 8 sont la seule piste, et elle tient chez les deux juges** : +2,5 ± 2,4 sur 472 cas
  (fourchette ≈ +0,1 – +4,9), tout juste au-dessus de zéro ; Oracle1 disait +3,6 ± 4,7 dans le même
  sens. Réunis à poids inverses de la variance : ≈ +2,7 ± 2,1, mais les deux corpus se recouvrent
  (1 642 positions communes), donc c'est optimiste. Quand la 1.2 a vu le bon coup et en joue un autre,
  elle perd environ 2,5 points : c'est le **choix final entre candidats** (bruit, budget), dans le sens
  de Budget4000 (+2,8 points à deux fois le temps).
- **Les deux oracles ne s'accordent pas** : même coup favori dans 32 % des 1 642 positions communes
  seulement. L'avantage d'Oracle3 sur la 1.2 est diffus, pas une faute isolée qu'on corrigerait d'une
  règle ; les bascules (29 contre 22) ne sont pas un signal.

**Pour la suite** : réduire le bruit du choix final à la racine (le coup le plus visité contre la
meilleure moyenne, plus d'itérations réservées aux 2-3 premiers candidats en fin de recherche, un
ensemble de graines) et le mesurer en duels à temps égal ; Oracle3 reste l'adversaire de référence pour
juger une 1.3 plus forte que la 1.2.

## Le choix final à la racine : `FinalMean`, `FinalLcb1` (15/10)

**L'idée** : la 1.2 joue son candidat le plus visité ; Oracle3 dit qu'elle cherche le bon coup (rangs 4 à 8) et en
joue un autre (+2,5 ± 2,4 points). `+final=c` (`src/sim/final-choice.js`) joue le candidat au meilleur taux de
victoire moins c / √visites : c = 0 le meilleur taux (`FinalMean`), c = 1 une borne basse à ~95 % (`FinalLcb1`).
Même coût par itération ; sans l'option, rien ne change (empreinte de la 1.2 `1d041613cd7bcd8d`).

**Deux tris à 800** contre la 1.2@800 (Sami : à 400 les candidats sont trop peu visités pour que la règle compte),
`--screen --page --games 200 --offset 15`, 400 parties chacun, mêmes donnes :

| Version | Score | Fourchette par paires | En commençant / en second |
| --- | --- | --- | --- |
| `FinalMean` (`final=0`) | 49,8 % | 46,0 – 53,5 % | 46,0 / 53,5 % |
| `FinalLcb1` (`final=1`) | 51,7 % | 47,7 – 55,8 % | 50,0 / 53,5 % |

**Au tri** : aucun ne sort du bruit. Sami n'en est pas convaincu (à 800, les candidats sont peu visités et les
deux règles désignent presque toujours le même coup) et demande une dernière chance à 2 000.

**La dernière chance à 2 000** (`VALIDATE_LONG_1_FinalMean` / `_FinalLcb1`, `--long --games 125 --page --offset 0`,
250 parties chacun contre la 1.2@2000, 15/10 de 15 h 17 à 16 h 06) :

| Version | Score | Fourchette par paires | En commençant / en second |
| --- | --- | --- | --- |
| `FinalMean` (`final=0`) | **54,8 %** | 49,5 – 60,1 % | 59,2 / 50,4 % |
| `FinalLcb1` (`final=1`) | **55,2 %** | 50,4 – 60,0 % | 57,6 / 52,8 % |

**Ce que ça dit** :
- **Le budget change le verdict** : 49,8 % et 51,7 % à 800, 54,8 % et 55,2 % à 2 000. Plus les candidats sont
  visités, plus leur taux de victoire est fiable, et plus il vaut la peine de le préférer au nombre de visites. À
  800, un candidat rarement visité a un taux trop bruité pour qu'on le choisisse : la règle n'a rien à départager.
- **Les deux versions vont dans le même sens**, sur les mêmes donnes : c'est la règle « le taux plutôt que les
  visites » qui paie, la marge d'incertitude (`final=1`) n'y change presque rien.
- **Rien n'est décidé** : Pw3 avait fait 56,1 % sur un premier duel avant de finir à 51,2 % sur 1 180 parties. Les
  offsets 1 à 3 des deux versions sont en file (`VALIDATE_LONG_2..4_FinalLcb1` puis `_FinalMean`, règle d'arrêt
  sous 47 %), FinalLcb1 d'abord (sa borne basse est la seule au-dessus de 50 %). Rapport complet vers 18 h 35, après
  `npm run versus` sur chaque version.
- **Si l'un passe**, c'est le premier gain sur la 1.2 à budget égal, et sans coût : il deviendra la 1.3 (nom,
  version, ligne de robots), et le constat « la 1.2 est un plafond à 2 000 » de `docs/1.3-to-oracle-shift.md` sera
  à revoir.

**La 1k@2k** (`VALIDATE_LONG_1..4_FinalLcb1` puis `_FinalMean`, offsets 0 à 3, 15/10 de 15 h 17 à 18 h 33), réunie
avec `npm run versus` :

| Version | Duels (offsets 0 à 3) | Réunis sur 1 000 parties | En commençant / en second |
| --- | --- | --- | --- |
| **`FinalLcb1`** (`final=1`) | 55,2 / 54,4 / 49,6 / 51,6 % | **52,7 % (50,1 – 55,3)** | 52,2 / 53,2 % |
| `FinalMean` (`final=0`) | 54,8 / 52,4 / 49,2 / 51,2 % | 51,9 % (49,3 – 54,5) | 52,8 / 51,0 % |

- **`FinalLcb1` passe la règle** (borne basse au-dessus de 50 %) : le même score que l'ExactEnd12 quand il est
  devenu la 1.2, et sans coût par itération. **Candidat à l'Expérimental 1.3** (Sami).
- **`FinalMean` ne passe pas** : le meilleur taux brut choisit parfois un candidat peu visité au taux gonflé par la
  chance ; la marge d'incertitude (− 1 / √visites) ne détrône le plus visité que si l'écart tient. Sami l'avait
  pressenti : la version corrigée est la plus robuste.
- **Une borne basse à 50,1 %, c'est juste** : Ensemble avait fait 52,5 % sur quatre duels avant de retomber à 51,0 %
  sur deux jeux de donnes neufs. La série de confirmation (`VALIDATE_LONG_5/6_FinalLcb1`, offsets 4 et 5, 500
  parties) tourne avant de nommer la 1.3.
- **La leçon de méthode** : une idée qui touche la lecture des visites se juge à 2 000, pas au tri à 400-800 (49,8
  et 51,7 % à 800). D'où les quatre « dernière chance » à 2 000 (PUCT-2, Implicit 0,2, ForkCut1, MarginBackup05).

**La confirmation** (`VALIDATE_LONG_5/6_FinalLcb1`, offsets 4 et 5, 15/10 de 18 h 34 à 19 h 22) : **50,4 % puis
48,0 %**. Réunis sur les six duels (`npm run versus`) : **51,5 % (49,4 – 53,7) sur 1 500 parties**, 50,7 % en
commençant, 52,4 % en second. **La borne basse repasse sous 50 % : `FinalLcb1` n'est pas la 1.3.** Même histoire
qu'Ensemble (52,5 % sur les offsets 0 à 3, 51,0 % sur six) : une tendance d'un point et demi, peut-être réelle,
trop petite pour la règle. L'option `+final=1` reste ; la 1.2 reste la version à battre, et le constat de
`docs/1.3-to-oracle-shift.md` (la 1.2 comme plafond à 2 000) tient toujours.

## La soirée du 15/10 : les « dernière chance » et l'Oracle light

**Quatre idées vues seulement au tri à 400**, un duel long chacune à 2 000 contre la 1.2 (`VALIDATE_LONG_1_*`,
`--long --games 125 --page --offset 0`, 250 parties ; à temps égal, 2 s par coup des deux côtés, pour celles qui
changent le coût d'une itération) :

| Version | Tri à 400 | Duel long à 2 000 | Verdict |
| --- | --- | --- | --- |
| `PUCT-2` (`puct=2`) | 51,5 % | 47,2 % (41,8 – 52,6) | écarté |
| `Implicit2` (`implicit=0.2`, `@t2000`) | 48,6 % | 50,8 % (45,7 – 55,9) | écarté |
| `ForkCut1` (`forkCut=1`, `@t2000`) | 51,5 % | 45,2 % (39,5 – 50,9) | écarté |
| `MarginBackup05` (`margin=0.05`) | 51,4 % | 46,0 % (40,5 – 51,5) | écarté |

Aucune ne gagne à 2 000 ce qu'elle ne gagnait pas à 400 : le tri les avait bien jugées, et ces pistes sont closes
pour de bon.

**Le tri de l'Oracle light** (`LIGHT_DUEL_1_OracleLight-Pw1/2/3`, l'arbre d'Oracle3 à 10 000 itérations contre la
1.2@2000, `--long --games 70 --page --offset 12`, 140 parties chacun, les donnes du premier duel de Depth10Pw) :

| Version | Score | Fourchette par paires | En commençant / en second |
| --- | --- | --- | --- |
| `OracleLight-Pw1` (`pw=1`) | 50,7 % | 44,0 – 57,5 % | 48,6 / 52,9 % |
| **`OracleLight-Pw2`** (`pw=2`) | **57,9 %** | 51,4 – 64,4 % | 55,7 / 60,0 % |
| `OracleLight-Pw3` (`pw=3`) | 51,4 % | 44,2 – 58,6 % | 52,9 / 50,0 % |

Sur ces mêmes donnes, Depth10Pw à 20 000 faisait 61,4 % et Budget20000 55,7 %.
- **`pw=2` se détache**, mais l'ordre 1 < 2 > 3 n'a rien de régulier : à 140 parties (± 6,5 points), le bruit
  peut faire une partie de l'écart. Depth10Pw était passé de 61,4 % à 52,9 % sur un deuxième jeu de donnes.
- **C'est le bon ordre de grandeur pour un oracle jouable** : environ 58 % pour la moitié du budget d'Oracle3, et
  36 min pour 140 parties sur 18 fils (environ 5 s par coup et par fil, deux fois moins que prévu).
- **La suite** : confirmer `OracleLight-Pw2` sur des donnes neuves (offsets 13 et suivants, 140 parties chacun),
  puis mesurer sa vitesse dans le worker de la page.

**La confirmation de `OracleLight-Pw2`** (`LIGHT_DUEL_2/3_OracleLight-Pw2`, offsets 13 et 14, 140 parties chacun,
15-16/10 de 22 h 55 à 0 h 17) : **47,1 % puis 58,6 %**. Réunis avec le tri (`npm run versus`) : **54,5 % (50,6 –
58,4) sur 420 parties** contre la 1.2@2000, 51,0 % en commençant. La borne basse reste au-dessus de 50 % : l'Oracle
light bat la 1.2 avec la moitié du budget d'Oracle3 (57,1 % sur 280 parties), pour environ 5 s par coup et par fil.
C'est le candidat pour jouer contre l'oracle dans la page ; la suite est sa vitesse dans le worker.

## `pwl` : l'élargissement progressif en niveaux (Sami, 16/10)

`+pw=k` allait à l'envers de l'intuition (`pw=1` poussait le plus vers la profondeur). **`+pwl=n`** (`widening.js`)
va de 0 (aucun) à 4 (le plus profond) : avec `widen=7`, les 7 réponses s'ouvrent à 16, 25, 31 et 36 visites. `pw=k`
reste lu (obsolète) pour que les anciens moteurs rejouent les mêmes coups : `pw=1` = `pwl=4` (empreinte
`afcf0cce6dde1a56` avant et après), `pw=2` = `pwl=2`, `pw=3` = `pwl=1`. **Le niveau 3 est nouveau** (k = 1,5, Sami :
un pas entre 28,6 % et 55,7 %, visé à 42,5 %) ; mesuré sur un duel de 40 parties à 2 000 (`npm run tree-stats`) :

| `pwl` à 2 000 | 7 réponses dès | 5e niveau atteint |
| --- | --- | --- |
| 0 (la 1.2) | — | 15,7 % (16,8 % dans ce duel) |
| 1 | 16 visites | 20,0 % |
| 2 | 25 visites | 28,6 % |
| **3** | 31 visites | **40,1 %** |
| 4 | 36 visites | 55,7 % |

**Le niveau 5** (Sami, 16/10 : pousser plus loin, viser 65 % au 5e niveau, pour Oracle3 à 20 000) : k < 1, donc au moins
une réponse par nœud (sans effet pour k ≥ 1 : empreintes inchangées). k = 0,5 dépassait la cible (93,1 % au 5e niveau,
37,5 % sur 40 parties) ; **k = 0,75** (7 réponses à 40 visites) donne **67,6 %**, neutre sur 40 parties (52,5 %).

| `pwl` | 5 |
| --- | --- |
| 7 réponses dès | 40 visites |
| 5e niveau atteint à 2 000 | 67,6 % |

**La nuit du 16/10** (file lancée à 1 h 09, 140 parties chacun contre la 1.2@2000, pour classer, pas pour valider) :
Oracle3 à `pwl=5`, `3` et `2` (20 000, offset 12, où Oracle3 = `pwl=4` faisait 61,4 %), puis l'Oracle light à
`pwl=3` et à `pwl=2` avec `final=1` (10 000, offsets 12 et 13 ; `pwl=2` seul : 57,9 et 47,1 %). L'Oracle light à
`pwl=1` (l'ancien `pw=3`, 51,4 % sur l'offset 12) reste à rejouer sur un second jeu de donnes.

### Les résultats de la nuit du 16/10 (1 h 09 – 6 h 58)

**Oracle3 à d'autres niveaux** (20 000 contre la 1.2@2000, offset 12, 140 parties chacun ; Oracle3 = `pwl=4`) :

| `pwl` à 20 000 | Score | Fourchette par paires |
| --- | --- | --- |
| 2 | 57,1 % | 49,6 – 64,7 % |
| 3 | 59,3 % | 51,7 – 66,8 % |
| 4 (Oracle3, 14/10) | 61,4 % | 55,1 – 67,8 % |
| 5 | 57,1 % | 50,7 – 63,5 % |

Un plateau : aucun niveau ne se détache d'Oracle3, à ± 7 points. À 20 000, le niveau d'élargissement compte
peu ; Oracle3 garde `pwl=4`. Pousser plus loin (`pwl=5`) n'apporte rien.

**L'Oracle light** (10 000 contre la 1.2@2000, offsets 12 et 13, 280 parties) :

| Version | Offset 12 | Offset 13 | Réunis (280) |
| --- | --- | --- | --- |
| `pwl=2` (`OracleLight-Pw2`) | 57,9 % | 47,1 % | 52,5 % (54,5 % sur 420 avec l'offset 14) |
| **`pwl=3`** (`OracleLight-Pwl3`) | 59,3 % | 55,0 % | **57,1 % (52,4 – 61,9)** |
| `pwl=2` + `final=1` | 58,6 % | 48,6 % | 53,6 % (48,8 – 58,3) |

- **`pwl=3` fait mieux que `pwl=2` sur les mêmes donnes** (57,1 contre 52,5 %), autant qu'Oracle3 à 20 000 sur
  280 parties (57,1 %), pour la moitié du budget. Candidat pour l'Oracle light ; l'offset 14 (en cours) le compare à
  `pwl=2` sur les mêmes 420 parties.
- **`final=1` n'apporte rien à 10 000 non plus** (53,6 contre 52,5 % sur les mêmes donnes).

**La courbe complète de l'Oracle light** (16/10 au matin : `pwl=1` et `pwl=4` sur l'offset 13, `pwl=3` sur le 14, `pwl=5`
sur le 12 ; 10 000 contre la 1.2@2000, en %) :

| `pwl` à 10 000 | Offset 12 | Offset 13 | Offset 14 | Réunis |
| --- | --- | --- | --- | --- |
| 1 (l'ancien `pw=3`) | 51,4 | 52,9 | — | ~52,1 (280) |
| 2 (`OracleLight-Pw2`) | 57,9 | 47,1 | 58,6 | 54,5 (420, 50,6 – 58,4) |
| **3** | 59,3 | 55,0 | 53,6 | **56,0 (420, 52,0 – 59,9)** |
| 4 (l'ancien `pw=1`) | 50,7 | 49,3 | — | ~50,0 (280) |
| 5 | 58,6 | 52,1 | — | 55,4 (280, 51,2 – 59,5) |

- **Le bruit domine** : le niveau 4 retombe entre 3 et 5, ce qui n'a rien de physique ; à 140 parties, ± 6,5 points.
  Le second duel de `pwl=5` (Sami, 16/10 en fin de matinée, offset 13 : 52,1 %, 46,4 – 57,9) le ramène au niveau de
  `pwl=3` : de 2 à 5, les niveaux se valent à 10 000.
- **`pwl=3` est le choix de l'Oracle light** : le plus de parties (420) et la borne basse la plus haute (52,0 %),
  +1,5 point sur `pwl=2` sur les mêmes donnes ; `pwl=5` fait 55,4 % sur 280. `npm run versus` regroupe par nom de
  moteur exact : les parties jouées sous `pw=k` restent à part de celles sous `pwl=n`, il faut les réunir à la main.

**L'Oracle light dans le worker de la page** (16/10, Chrome, `think-worker.js` ouvert à la main sur les positions de
la partie gardée `2026-10-09_01-51-08_sami-vs-borne_4-2`, un coup sur deux, PC au calme) :

- **Chrome va un peu plus vite que Node** : aux tours 6 / 12 / 18 / 24, 10,0 / 7,3 / 4,8 / 2,7 s contre 11,9 / 9,0 /
  5,7 / 3,4 s en Node (un fil), soit de 840 à 3 700 itérations par seconde selon le moment de la partie.
- **Une partie entière** : 101 s de réflexion pour les 15 coups cherchés (6,8 s en moyenne), les fins de partie
  résolues en moins de 5 ms. Seuls les trois premiers coups passent les 10 s de la page (13,6 / 12,5 / 11,9 s) : avec
  la limite actuelle, il s'arrête à 8 164 itérations au tour 3. Il lui faut une limite d'environ 15 s.
- **La pondération coupait les arbres** : le worker retirait de la recherche la moitié du temps pondéré, mais
  l'ISMCTS ignore `warm` (seule la recherche plate du 0.7 s'en sert). Après 10 s de réflexion du joueur, l'Oracle
  light ne faisait plus que 4 634 à 5 772 itérations ; après 20 s, **la 1.2 de la page tombait à 1 178 de ses 2 000**,
  plus faible que la version de son Elo. Corrigé : le worker ne pondère plus que pour un robot qui lit `warm`
  (`bot.warms`) ; la 1.2 refait ses 2 000 itérations (2,6 s au tour 3) quel que soit le temps du joueur.
- **L'Oracle light 1.0 de la page** (`oracle-light`, Sami, 16/10) : le même arbre partagé entre deux arbres de 5 000
  (`trees=2`), un par worker, les scores additionnés comme `createEnsemble` (`web/app/think-join.js`) : les mêmes coups
  qu'en Node (tests, et 4 coups de la partie gardée comparés dans Chrome). 8,5 s au premier coup au lieu de 13,6, puis
  7,5 / 4,4 / 1,7 s aux tours 3, 13 et 25 : sous les 10 s de la page. L'Observer passe lui aussi par les workers.
  Sa force à deux arbres se mesure la nuit du 16-17/10 : `OracleLight-Pwl3-Trees2` contre la 1.2@2000 sur les
  offsets 12 à 14, qui doit faire au moins les 56,0 % de l'arbre unique sur les mêmes donnes (à 2 000, deux arbres
  tenaient à 51,0 %, trois et quatre perdaient). Avec lui, `OracleLight-Pwl2-Trees2` (des arbres plus petits veulent
  peut-être un niveau plus bas) et `Oracle3-Pwl3-Trees2` (2 × 10 000 : moins de bruit sans perdre la profondeur ?),
  sur les offsets 12 et 13. Trois et quatre arbres sont retirés de la file (Sami : deux suffisent en vitesse).

## Les donnes communes : `CommonDeals` (16/10, `docs/priorites-1.3.md`)

**La question** (prompt du 16/10, `docs/agents/prompt-fable-priorites-1.3.md`) : reste-t-il des idées qui méritent une
1k@2k contre la 1.2, ou est-ce le plafond ? Le diagnostic complet, les idées classées et le verdict sont dans
`docs/priorites-1.3.md`. L'essentiel :

- **Ce que la 1.2 fait de ses 2 000 itérations** (le `tree` de 1 197 coups de duels gardés) : un bandit de 8 candidats
  sur un bandit d'environ 55 réponses adverses par candidat. 22 % des itérations essaient une réponse pour la première
  fois, 65 % s'arrêtent au 3e étage sur le coup du cœur. Les échecs s'expliquent par le biais, le coût ou un bruit
  relu autrement ; aucun par la fusion de stratégies.
- **L'idée** : `+crn=1` (`src/sim/common-deals.js`) donne à la k-ième visite de chaque candidat la k-ième donne de la
  recherche et la k-ième suite de tirages des simulations, comme le 0.7 et le Stratège 2 comparaient leurs candidats.
  UCB, l'arbre, le coup joué et le coût ne changent pas. Sans la clé, l'empreinte de la 1.2 reste `1d041613cd7bcd8d` ;
  avec, `bef7b4df22f6c4c0`.
- **Mesuré de jour** (80 positions à 400 itérations, jugées par chaque candidat cherché seul 400 fois) :
  - ρ = 0,34 entre deux candidats sur une même donne (0,44 en simulations seules) ;
  - le regret de la racine baisse de 0,43 ± 0,34 point, plus qu'un doublement du budget (−0,37) ;
  - deux graines jouent le même coup 28,5 % du temps au lieu de 19,2 % ;
  - `final=1` ne change rien à 400.
- **Le tri à 400** : **55,3 % (50,5 – 60,0) sur 360 parties**. Il n'est pas écarté.
- **En file** :
  - `VALIDATE_LONG_1..4_CommonDeals`, offsets 0 à 3, avec la règle d'arrêt ;
  - `NOISE_DUEL_1/2_Ensemble2x2000`, deux arbres de 2 000 contre la 1.2@2000 sur les donnes de Budget4000 : ce que vaut
    le bruit du coup joué à 2 000, donc le plafond de toute cette famille.
- **Écartés** :
  - MO-ISMCTS, sur le papier : les coups sont publics, et sa racine adverse regroupe les mains elle aussi ;
  - la chance des jokers comme variable de contrôle, par la mesure : au plus 1,5 % de la variance (tableau du début).

### La nuit du 17/10

Les 13 jobs ont tourné de 1 h 11 à 9 h 17 (`npm run versus`, intervalles par paires de donnes) :

| Série | Parties | Score contre la 1.2@2000 | Sur les mêmes donnes |
| --- | --- | --- | --- |
| `CommonDeals` (offsets 0 à 3) | 1 000 | **50,7 % (48,2 – 53,2)** : 49,6 / 52,8 / 52,0 / 48,4 | — |
| `Ensemble2x2000` (offsets 1 et 2) | 500 | **54,6 % (50,8 – 58,4)** : 54,0 / 55,2 | Budget4000 : 54,4 % |
| `OracleLight-Pwl3-Trees2` (offsets 12 à 14) | 420 | 53,6 % (49,7 – 57,4) | l'arbre unique : 56,0 % |
| `OracleLight-Pwl2-Trees2` (offsets 12 et 13) | 280 | **57,9 % (52,3 – 63,4)** | `Pwl3-Trees2` : 53,9 % ; `pwl=2` en un arbre : 52,5 % |
| `Oracle3-Pwl3-Trees2` (offsets 12 et 13) | 280 | 55,4 % (50,3 – 60,4) | Oracle3 en un arbre : 57,1 % |

- **`CommonDeals` est écarté** : 50,7 %, sous les 51 % du tableau de décision. Le regret mesuré de jour à 400
  (−0,43 point) ne s'est pas traduit en parties à 2 000. Une part vient sans doute de la mesure elle-même : la
  référence (chaque candidat cherché seul 400 fois) était calculée sous `crn`, ce qui avantageait `crn`.
  `CommonDeals-FinalLcb1` n'a plus d'objet.
- **Mais le bruit vaut des points** : deux arbres de 2 000 indépendants font autant qu'un arbre de 4 000 sur les mêmes
  donnes (54,6 contre 54,4 %). Le gain du budget ×2 est donc, pour l'essentiel, la baisse du bruit du coup joué, pas
  un arbre plus profond. Ce bruit n'est pas celui des donnes de la racine (que `CommonDeals` apparie) : c'est celui du
  chemin que prend chaque arbre (quelles réponses adverses il essaie d'abord, ses simulations), que seuls des arbres
  indépendants moyennent. À budget égal, deux arbres de 1 000 perdaient la profondeur (`Ensemble`, 51,0 %).
- **Ce que ça donne pour la page** : deux arbres de 2 000 sur deux workers jouent dans le temps de la 1.2 (2,6 s au
  tour 3), comme l'Oracle light. C'est du calcul en plus, pas une idée, mais à temps égal pour le joueur. La 1k@2k
  complète (offsets 3 et 4, les autres donnes de Budget4000) est en file pour la nuit du 17-18/10 ; si elle tient,
  c'est la version de page la moins chère au-dessus de la 1.2.
- **L'Oracle light en deux arbres préfère `pwl=2`** : sur les mêmes donnes, 57,9 % contre 53,9 % avec `pwl=3`, alors
  qu'en un arbre de 10 000 `pwl=3` menait (57,1 contre 52,5 %). Des arbres de 5 000 veulent un niveau plus bas,
  comme Sami le pensait. Dans le bruit à 280 parties (± 5,6) : l'offset 14 est en file. Au-dessus de 56 % sur 420
  parties, l'Oracle light 1.1 passe à `pwl=2` (un moteur différent, donc une version).
- **Oracle3 en deux arbres n'apporte rien** : 55,4 % contre 57,1 % en un arbre, pour deux fois le temps de l'Oracle
  light. Il ne vient pas dans la page.

### ReplyFpu de jour (17/10)

Sami a demandé 250 parties à 2 000 de jour pour chaque marge, puis la 1k@2k de la meilleure, de jour aussi
(`docs/priorites-1.3.md`, § 2). Contre la 1.2@2000, offset 0 :

- `ReplyFpu0` (`+fpu=0`) : 45,6 % (40,0 – 51,2), 41,6 % en commençant.
- `ReplyFpu1` (`+fpu=1`) : 53,6 % (48,6 – 58,6), 53,6 % des deux côtés.
- `ReplyFpu2` (`+fpu=2`) : 48,4 % (43,0 – 53,8) ; `ReplyFpu3` (`+fpu=3`) : 45,6 % (39,8 – 51,4).

`ReplyFpu1`, offsets 1 à 3 (`VALIDATE_LONG_2..4_ReplyFpu1`) : 46,8 / 51,6 / 54,0 %, soit **51,5 % (49,0 – 54,0)**
sur 1 000 parties. Écartée, au même score que `FinalLcb1`. Comme `CommonDeals` la veille, une idée qui change
l'arbre sans ajouter de calcul ne bat pas la 1.2.
