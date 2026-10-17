# La 1.1, la 1.2, le Borné et la feuille de route 1.3 (06/10 – 12/10)

Journal de la stratégie des robots, chapitre 5 sur 6. [← le registre](../strategie.md) · [← 04/10 – 06/10](04-labo-a-2000.md) · [14/10 – 17/10 →](06-les-oracles.md)

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
lesquels ajouter au cœur 1.2 ? `npm run traps` (`src/sim/puzzles/traps.js`) résout exactement les fins de
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

**Le réglage** (`endJoker`, `src/sim/heuristics/end-joker.js`, cœur `stfig6ej`) : pioche vide, le joker posé
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
  `src/sim/puzzles/traps.js` (l'ordre dans lequel les côtés se complètent, ce que la carte donne à
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

**Le banc de pièges** (`npm run trap-bench`, `src/sim/puzzles/trap-bench.js`) : pour passer de 1 507 à
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
- **CriticalEnd (`stfig6crit`, `src/sim/heuristics/end-urgency.js`)** : règle d'urgence pioche vide (remboursement
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

**TreeReuse (`+reuse=1`, `src/sim/mcts/reuse.js`)** : l'arbre gardé d'un coup au suivant (le nœud sous
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

[← le registre](../strategie.md) · [← 04/10 – 06/10](04-labo-a-2000.md) · [14/10 – 17/10 →](06-les-oracles.md)
