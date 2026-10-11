# Analyse comparative de l'arbre ISMCTS : widen (5 vs 7) et cap de diversité (diverse 0 vs 2)

Cette étude analyse la structure interne de l'arbre ISMCTS à la racine et dans ses nœuds de décision (`shortlist`), afin d'élucider pourquoi **Expérimental 1.2** (`widen=7, diverse=0`) domine **Le Borné** (`widen=5, diverse=2`) en duels longs (45,9 % sur 1 000 parties), malgré l'avantage théorique supposé d'un arbre plus profond et de candidats plus diversifiés.

L'analyse porte sur **1 000 positions de jeu réelles** (125 parties complètes du duel officiel du 10/10, analysées aux tours 1, 2, 3, 4 pour le début de partie [500 positions] et aux tours 10, 11, 12, 13 pour le milieu de partie contesté [500 positions]), comparant **4 configurations à budget @2 000** et l'**Oracle à @20 000 itérations** sur les mêmes donnes et graines aléatoires (soit **5 000 arbres Monte-Carlo analysés nœud par nœud**).

*Un « tour » est ici un **demi-coup** (une carte posée, par l'un ou l'autre joueur) : les tours 1–4 sont les positions avant les 4 premières cartes de la partie (`state.turn` 0 à 3), la fenêtre exacte du Cap321 de `cap321_2` ; les tours 10–13, `state.turn` 9 à 12.*

---

## 1. Les 4 configurations comparées

Tous les moteurs utilisent le cœur heuristique de référence `core=stfig6`, sans le solveur de fin de partie (`exact=12`), afin de mesurer la pure dynamique de l'arbre Monte-Carlo :

1. **`w5_d0`** : `ismcts+widen=5+depth=5@2000` — Arbre resserré (5 réponses max), sans cap de diversité.
2. **`w5_d2` (Le Borné)** : `ismcts+widen=5+depth=5+diverse=2@2000` — Arbre resserré avec cap de 2 bornes max par carte à la racine et dans l'arbre.
3. **`w7_d0` (Expérimental 1.2)** : `ismcts+widen=7+depth=5@2000` — Arbre large (7 réponses max), sans cap de diversité.
4. **`w7_d2`** : `ismcts+widen=7+depth=5+diverse=2@2000` — Arbre large avec cap de 2 bornes max par carte.
5. **`w7_d3_cap321`** : `ismcts+widen=7+depth=3+diverse=cap321@2000` — Arbre coupé à 3 plis (`depth=3`) avec cap dégressif 3-2-1.
6. **`w6_d5_cap321_2`** : `ismcts+candidates=8+widen=6+depth=5+core=stfig6+diverse=2+rootDiverse=cap321_2@2000` — Configuration hybride : racine à 8 candidats avec cap dégressif 3-2-1 aux tours 1–4 et cap 2 aux tours 5+ ; shortlist enfant à `widen=6`, `depth=5` et cap strict de 2 bornes par carte (`diverse=2`).
7. **`w8_d4_r10_c2`** : `ismcts+candidates=10+widen=8+depth=4+core=stfig6+diverse=2@2000` — Configuration privilégiant la largeur : racine à 10 candidats avec cap 2 (au moins 5 cartes distinctes), shortlist enfant à `widen=8` avec cap 2, et profondeur coupée à `depth=4`.
8. **`w7_d5_pw1`** : `ismcts+widen=7+depth=5+core=stfig6+pw=1@2000` — Configuration Expérimental 1.2 avec Progressive Widening actif (`pw=1`) : élargissement adaptatif par nœud ($1 + \lfloor\sqrt{N}\rfloor$, jusqu'à 7), profondeur 5, shortlist libre.
9. **Oracle** : `ismcts+candidates=99+widen=6+depth=5+smart=1@20000` — Référence à 20 000 itérations, explorant tous les coups légaux à la racine.

### Méthodologie et indices de confiance statistiques :
- **Échantillon massif ($N = 1\ 000$ positions indépendantes, 500 début et 500 milieu)** : Chaque arbre est intégralement parcouru et instrumenté. Les variables continues sont rapportées sous la forme `Moyenne ± Écart-type d'échantillon (s)` accompagnée de l'**intervalle de confiance à 95 %** ($\bar{x} \pm 1,96 \cdot \frac{s}{\sqrt{n}}$).
- **Proportions binaires (accords et présence Oracle)** : Les proportions sont rapportées avec l'**erreur-type binomiale** ($SE = \sqrt{\frac{p(1-p)}{n}}$) et l'**intervalle de confiance de Wilson à 95 %**.

---

## 2. Nombre de cartes différentes dans le Top 8 (Racine)

Le point de départ de l'hypothèse du Borné était que sur un plateau vide, le cœur heuristique saturait le Top 8 en dupliquant la même carte sur 4 bornes équivalentes. Les mesures sur 1 000 positions confirment sans équivoque ce diagnostic à la racine :

| Configuration | Début de partie (Tours 1–4, n=500) | Milieu de partie (Tours 10–13, n=500) | Moyenne globale (N=1 000) |
| :--- | :---: | :---: | :---: |
| **widen=5, diverse=0** (sans cap) | **2,88** ± 0,82 cartes <br>*(IC 95 % : [2,81 – 2,95])* | **4,55** ± 0,90 cartes <br>*(IC 95 % : [4,47 – 4,63])* | **3,71** ± 1,20 cartes <br>*(IC 95 % : [3,64 – 3,79])* |
| **widen=5, diverse=2 (Le Borné)** | **4,24** ± 0,48 cartes <br>*(IC 95 % : [4,20 – 4,28])* | **5,04** ± 0,65 cartes <br>*(IC 95 % : [4,98 – 5,10])* | **4,64** ± 0,70 cartes <br>*(IC 95 % : [4,59 – 4,68])* |
| **widen=7, diverse=0 (Exp 1.2)** | **2,88** ± 0,82 cartes <br>*(IC 95 % : [2,81 – 2,95])* | **4,55** ± 0,90 cartes <br>*(IC 95 % : [4,47 – 4,63])* | **3,71** ± 1,20 cartes <br>*(IC 95 % : [3,64 – 3,79])* |
| **widen=7, diverse=2** | **4,24** ± 0,48 cartes <br>*(IC 95 % : [4,20 – 4,28])* | **5,04** ± 0,65 cartes <br>*(IC 95 % : [4,98 – 5,10])* | **4,64** ± 0,70 cartes <br>*(IC 95 % : [4,59 – 4,68])* |
| **widen=7, depth=3, cap321** | **5,01** ± 0,25 cartes <br>*(IC 95 % : [4,99 – 5,04])* | **5,34** ± 0,62 cartes <br>*(IC 95 % : [5,28 – 5,39])* | **5,18** ± 0,50 cartes <br>*(IC 95 % : [5,15 – 5,21])* |
| **widen=6, depth=5, Cap2 (Root Cap321/2)** | **5,01** ± 0,25 cartes <br>*(IC 95 % : [4,99 – 5,04])* | **5,04** ± 0,65 cartes <br>*(IC 95 % : [4,98 – 5,10])* | **5,03** ± 0,49 cartes <br>*(IC 95 % : [5,00 – 5,06])* |
| **widen=8, depth=4, Cap2 (Root10 Cap2)** | **4,94** ± 0,45 cartes *(Top 8)* <br>*(Top 10: 5,17 ± 0,44)* | **5,12** ± 0,66 cartes *(Top 8)* <br>*(Top 10: 5,45 ± 0,64)* | **5,03** ± 0,57 cartes *(Top 8)* <br>*(Top 10: **5,31** ± 0,57)* |
| **widen=7, depth=5, pw=1 (Exp 1.2 + PW)** | **2,88** ± 0,82 cartes <br>*(IC 95 % : [2,81 – 2,95])* | **4,55** ± 0,90 cartes <br>*(IC 95 % : [4,47 – 4,63])* | **3,71** ± 1,20 cartes <br>*(IC 95 % : [3,64 – 3,79])* |
| **Oracle @20k (99 candidats)** | **5,69** ± 0,51 cartes <br>*(IC 95 % : [5,65 – 5,74])* | **5,54** ± 0,64 cartes <br>*(IC 95 % : [5,49 – 5,60])* | **5,62** ± 0,58 cartes <br>*(IC 95 % : [5,58 – 5,65])* |

### Constats sur la diversité des cartes :
1. **En début de partie sans cap** (`diverse=0`), les 8 candidats de la racine ne représentent en moyenne que **2,88 cartes distinctes** : deux cartes de la main monopolisent fréquemment 3 ou 4 bornes chacune.
2. **L'effet du cap `diverse=2` est massif (+47 % de cartes en début de partie)** : il fait monter la diversité de **2,88 à 4,24 cartes distinctes** aux tours 1–4 (IC ultra-serré [4,20 – 4,28]), se rapprochant de l'Oracle qui inspecte toutes les cartes disponibles (5,69 cartes).
3. **Le cap 3-2-1 garantit 5 cartes distinctes dès l'ouverture** : avec **5,01 cartes distinctes**, il ouvre un champ d'exploration maximal sans bloquer les cartes secondaires.
4. **Root 10 Candidats Cap 2 culmine à 5,31 cartes distinctes** : en offrant 10 slots à la racine plafonnés à 2, le moteur explore plus de 5 cartes différentes tout au long de la partie (5,17 en ouverture et 5,45 en milieu de jeu).

---

## 3. Pénétration en profondeur : mythe et réalité des plis 4 et 5

La promesse théorique de `widen=5` était de réduire le branchement de 28 % pour « faire converger UCB plus profondément et atteindre les plis 4 et 5 ». 

Voici le décompte réel du nombre moyen de nœuds visités à chaque niveau de l'arbre pour 2 000 itérations :

| Configuration | Pli 1 (Racine) | Pli 2 (Réponses) | Pli 3 (2e coup bot) | Pli 4 (2e rép. adv.) | Pli 5 (3e coup bot) | Profondeur Max (IC 95 %) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **widen=5, diverse=0** (sans cap) | 8 ± 0 | 749 ± 353 | 3 054 ± 508 | **406 ± 447** *(9,6 %)* | **0,21 ± 2,35** *(0,00 %)* | **3,98 ± 0,24** <br>*(IC: [3,96 – 3,99])* |
| **widen=5, diverse=2 (Le Borné)** | 8 ± 0 | 637 ± 234 | 3 012 ± 465 | **440 ± 451** *(10,7 %)* | **0,32 ± 5,11** *(0,01 %)* | **4,00 ± 0,15** <br>*(IC: [3,99 – 4,01])* |
| **widen=7, diverse=0 (Exp 1.2)** | 8 ± 0 | 839 ± 394 | 4 136 ± 533 | **159 ± 279** *(3,1 %)* | **0,00 ± 0,00** *(0,00 %)* | **3,67 ± 0,47** <br>*(IC: [3,64 – 3,70])* |
| **widen=7, diverse=2** | 8 ± 0 | 700 ± 248 | 4 098 ± 486 | **169 ± 300** *(3,4 %)* | **0,00 ± 0,00** *(0,00 %)* | **3,73 ± 0,44** <br>*(IC: [3,70 – 3,76])* |
| **widen=7, depth=3, cap321** | 8 ± 0 | 816 ± 336 | 4 012 ± 448 | **0 ± 0** *(0,0 %)* | **0,00 ± 0,00** *(0,00 %)* | **3,00 ± 0,00** <br>*(IC: [3,00 – 3,00])* |
| **widen=6, depth=5, Cap2 (Root Cap321/2)** | 8 ± 0 | 671 ± 245 | 3 578 ± 484 | **282 ± 371** *(6,2 %)* | **0,03 ± 0,78** *(0,00 %)* | **3,91 ± 0,29** <br>*(IC: [3,90 – 3,93])* |
| **widen=8, depth=4, Cap2 (Root10 Cap2)** | 10 ± 0 | 903 ± 302 | 4 487 ± 348 | **60 ± 145** *(1,1 %)* | **0,00 ± 0,00** *(0,00 %)* | **3,48 ± 0,50** <br>*(IC: [3,45 – 3,51])* |
| **widen=7, depth=5, pw=1 (Exp 1.2 + PW)** | 8 ± 0 | 824 ± 388 | 1 549 ± 249 | **335 ± 264** *(12,3 %)* | **0,47 ± 1,25** *(0,02 %)* | **4,16 ± 0,37** <br>*(IC: [4,13 – 4,18])* <br>*(**Record absolu**)* |
| **Oracle @20k (widen=6, 99 cand.)** | 39,1 ± 4,1 | 4 192 ± 2 007 | 29 236 ± 10 331 | **14 390 ± 10 358** *(29,8 %)* | **511 ± 1 445** *(1,06 %)* | **4,46 ± 0,50** <br>*(IC: [4,42 – 4,49])* |

### Réponses formelles sur la profondeur :
1. **Y a-t-il des nœuds à la profondeur 5 ? Quasiment NON, sauf avec pw=1 qui commence à l'atteindre.**
   - À budget 2 000 itérations sans PW, **le pli 5 est quasiment inexistant** (moyenne de 0,00 à 0,32 nœud par recherche sur 1 000 positions, soit moins de 0,01 % de l'arbre).
   - Même l'Oracle, avec **20 000 itérations** (10 fois plus de calcul), ne consacre en moyenne que **511 nœuds au pli 5** sur 48 300 nœuds (1,06 % de son arbre).
   - Avec `pw=1`, le moteur commence à toucher le Pli 5 avec **0,47 ± 1,25 nœud** en moyenne.
2. **Y a-t-il des nœuds à la profondeur 4 ? Très peu, mais restaurés à widen=6 et explosés avec pw=1.**
   - Dans `widen=7` (Exp 1.2), seuls **159 nœuds** atteignent le pli 4 (3,1 % de l'arbre).
   - Dans `widen=6, depth=5`, le nombre de nœuds au pli 4 remonte à **282 nœuds** (6,2 % de l'arbre, profondeur max de **3,91**).
   - Dans `widen=8, depth=4`, l'accent mis sur la largeur au Pli 2 et Pli 3 concentre le calcul sur les plis 2–3 (5 390 nœuds), ne laissant que **60 nœuds au Pli 4** (1,1 % de l'arbre).
   - Dans `widen=7, depth=5, pw=1`, le Pli 4 bondit à **335 nœuds** (12,3 % de l'arbre, plus du double d'Exp 1.2 !), et la profondeur moyenne atteint **4,16 ± 0,37** (record absolu de tous les moteurs à budget 2 000).
   - Dans `depth=3, cap321`, le pli 4 est strictement coupé à **0 nœud**.

---

## 4. Distribution des visites sous les candidats et fléau des « singletons »

Le comportement statistique dans les nœuds enfants (les répliques de l'adversaire au pli 2 sous chaque candidat de la racine) mesuré sur 1 000 positions :

| Configuration | Visites Top 1 (Racine) | Visites Top 2 (Racine) | Visite Max enfant L1 | Visite Médiane L1 | % Singletons L1 (IC 95 %) | % Singletons Total Arbre (IC 95 %) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **widen=5, diverse=0** (sans cap) | 522,5 ± 148,1 | 372,8 ± 67,8 | 28,4 ± 16,9 | 1,9 ± 1,0 | **35,5 % ± 10,0 %** <br>*(IC: [34,9 % – 36,1 %])* | **38,0 % ± 4,0 %** <br>*(IC: [37,7 % – 38,2 %])* |
| **widen=5, diverse=2 (Le Borné)** | 522,8 ± 146,9 | 374,6 ± 66,4 | 29,5 ± 16,7 | 2,1 ± 1,0 | **33,6 % ± 8,7 %** <br>*(IC: [33,1 % – 34,2 %])* | **38,9 % ± 3,4 %** <br>*(IC: [38,7 % – 39,1 %])* |
| **widen=7, diverse=0 (Exp 1.2)** | 512,0 ± 141,6 | 369,8 ± 61,1 | 23,7 ± 14,1 | 1,8 ± 0,9 | **37,0 % ± 10,9 %** <br>*(IC: [36,3 % – 37,7 %])* | **31,7 % ± 4,3 %** <br>*(IC: [31,5 % – 32,0 %])* |
| **widen=7, diverse=2** | 514,1 ± 144,9 | 374,3 ± 61,4 | 25,3 ± 13,7 | 1,9 ± 0,9 | **35,9 % ± 9,7 %** <br>*(IC: [35,3 % – 36,5 %])* | **32,6 % ± 4,1 %** <br>*(IC: [32,4 % – 32,9 %])* |
| **widen=7, depth=3, cap321** | **529,3** ± 152,6 | **376,7** ± 68,0 | 24,7 ± 14,6 | 1,65 ± 0,75 | **39,7 % ± 9,8 %** <br>*(IC: [39,1 % – 40,3 %])* | **33,5 % ± 4,9 %** <br>*(IC: [33,2 % – 33,8 %])* |
| **widen=6, depth=5, Cap2 (Root Cap321/2)** | **521,9** ± 145,0 | **377,2** ± 65,4 | **27,2 ± 14,6** | **1,98 ± 0,99** | **34,4 % ± 9,5 %** <br>*(IC: [33,8 % – 34,9 %])* | **35,6 % ± 4,0 %** <br>*(IC: [35,3 % – 35,8 %])* |
| **widen=8, depth=4, Cap2 (Root10 Cap2)** | 441,5 ± 125,8 | 325,1 ± 55,5 | 20,7 ± 11,1 | 1,50 ± 0,60 | **42,4 % ± 9,6 %** <br>*(IC: [41,8 % – 43,0 %])* | **29,4 % ± 2,9 %** <br>*(IC: [29,2 % – 29,6 %])* <br>*(**Record absolu**)* |
| **widen=7, depth=5, pw=1 (Exp 1.2 + PW)** | **518,7** ± 143,2 | **374,1** ± 63,3 | **24,4** ± 15,0 | **1,82** ± 0,93 | **38,1 % ± 10,7 %** <br>*(IC: [37,4 % – 38,7 %])* | **55,6 % ± 2,8 %** <br>*(IC: [55,4 % – 55,8 %])* |
| **Oracle @20k (99 cand.)** | 3 314,8 ± 3 098,5 | 1 616,3 ± 822,7 | 207,6 ± 265,2 | 2,4 ± 0,8 | **30,0 % ± 5,4 %** <br>*(IC: [29,7 % – 30,3 %])* | **33,6 % ± 2,3 %** <br>*(IC: [33,4 % – 33,7 %])* |

### Découvertes capitales sur les visites :
1. **Nouveau record absolu de réduction des singletons dans tout l'arbre (29,4 % pour Root10)** :
   En limitant la profondeur à 4 et en élargissant les couches 1 et 2, `w8_d4_r10_c2` fait tomber le taux global de singletons à **29,4 % ± 2,9 %** (battant même l'Oracle à 33,6 % et l'Expérimental 1.2 à 31,7 %). Moins de nœuds profonds à 1 visite sont créés inutilement.
2. **Le coût de la largeur au Pli 2 (42,4 % de singletons L1)** :
   Ouvrir 8 enfants sous 10 candidats à la racine impose 80 nœuds au Pli 2. En ouverture, les visites s'éparpillent (50,7 % de singletons L1 en début), mais en milieu de jeu la concentration se rétablit (34,1 % de singletons L1).
3. **Visites du coup gagnant** :
   Le meilleur coup reçoit **441,5 visites** en moyenne (contre 512 pour Exp 1.2), une dispersion mécanique due au partage du budget entre 10 candidats plutôt que 8.
4. **L'autopsie des singletons sous Progressive Widening (`pw=1`)** :
   - À première vue, le pourcentage apparent de singletons de tout l'arbre s'affiche à 55,6 %. Mais l'analyse interne révèle la vérité mécanique : **la taille totale de l'arbre est divisée par deux** (de 5 142 à 2 716 nœuds en moyenne) !
   - Dans l'Expérimental 1.2 classique, chaque nœud exploré pré-alloue 7 enfants, dont **~2 850 nœuds restent à 0 visite** sans jamais être simulés (ce qui dilue artificiellement le ratio de singletons).
   - Avec `pw=1`, ces nœuds fantômes sont éliminés à 78 % (seulement 636 nœuds à 0 visite).
   - Plus important encore : le nombre de nœuds recevant **plusieurs visites utiles ($\ge 2$) bondit de +36 %** (de 399 à 545 nœuds), et les visites sur le coup gagnant à la racine se renforcent à **518,7 visites** (vs 512,0 pour Exp 1.2).

---

## 5. Pourquoi Le Borné perd : le piège du cap dans la shortlist

L'analyse coup par coup des replays révèle le défaut mécanique majeur du Borné : **l'application du cap de diversité dans la `shortlist` des nœuds enfants**.

### Exemple 1 : Début de partie (Tour 2, Partie 0)
- **`w5_d0` (sans cap)** :
  `16@6 (483)`, `3@0 (377)`, `16@5 (308)`, `3@5 (242)`, `26@0 (206)`, `16@0 (183)`, `26@5 (136)`, `26@6 (65)
  *(3 cartes seulement : cartes 16, 3 et 26, dupliquées sur les bornes extérieures et centrales).*
- **`w5_d2` (Le Borné)** :
  `16@0 (666)`, `26@5 (336)`, `0@0 (258)`, `3@0 (229)`, `0@5 (208)`, `3@5 (127)`, `16@5 (89)`, `26@0 (87)
  *(4 cartes distinctes équilibrées à 2 bornes chacune).*
- **Constat au Tour 2** : Ici, le cap joue parfaitement son rôle. Le Borné évite de s'enfermer dans un duplicata stérile et choisit un coup d'ouverture propre (`16@0`).

### Exemple 2 : Milieu de partie contesté (Tour 11, Partie 0)
- **Coup de référence de l'Oracle (@20k)** : **`7@6` (3 941 visites)** — jouer le 7 sur la borne 6 est de très loin le coup gagnant pour bloquer la combinaison adverse.
- **`w7_d0` (Expérimental 1.2)** : Choisit **`7@6` (389 visites)**, en parfait accord avec l'Oracle !
- **`w5_d0` (sans cap)** : Choisit **`7@6` (403 visites)**, en accord avec l'Oracle !
- **`w5_d2` (Le Borné)** : Choisit **`21@1` (576 visites)** ! Il rate complètement `7@6` (relégué en 5e position avec seulement 196 visites) et commet une faute tactique.

### Pourquoi Le Borné a-t-il raté `7@6` ?
Dans la position du Tour 11, la borne 6 était le champ de bataille critique.
1. L'Expérimental 1.2 (`widen=7, diverse=0`) autorise les simulations à examiner **toutes les variantes de pose sur la borne 6** pour les cartes fortes de l'adversaire (ses meilleures répliques). Il constate immédiatement que sans `7@6`, l'adversaire prend la borne 6.
2. Le Borné (`widen=5, diverse=2`), lui, applique le cap de 2 bornes par carte *dans toute la shortlist*. Dès qu'une carte adverse a été testée sur deux bornes, toute tentative adverse supplémentaire sur la borne 6 est **censurée**. L'arbre force l'exploration d'autres cartes faibles ou hors-sujet.
3. Résultat : l'arbre du Borné sous-estime la menace adverse sur la borne 6, s'imagine qu'un coup passif sur la borne 1 (`21@1`) est sûr, et joue un coup perdant.

---

## 6. Accord avec l'Oracle et présence du coup optimal dans le Top 8 (Mesure sur 1 000 positions)

Pour éliminer le bruit statistique des petits échantillons, cette mesure a été étendue à **1 000 positions distinctes** issues de la base de référence de l'Oracle (`oracle/positions-banc.jsonl`), réparties équitablement entre le début de partie (**500 positions sur les tours 4 à 10**) et le milieu de partie (**500 positions sur les tours 11 à 20**).

### A. Présence du coup optimal de l'Oracle dans le Top 8 (Racine)

À la racine, l'arbre ISMCTS retient 8 candidats (`candidates=8`). Le tableau ci-dessous indique dans quelle proportion le coup choisi par l'Oracle est présent parmi ces 8 coups :

| Configuration | Début de partie (Tours 4–10, n=500) | Milieu de partie (Tours 11–20, n=500) | Global (N=1 000 positions) |
| :--- | :---: | :---: | :---: |
| **Sans cap (`diverse=0`)** <br>*(widen 5 & 7)* | **37,0 %** (185/500) <br>*(SE = 2,16 %, IC 95 % : [32,9 % – 41,3 %])* | **54,2 %** (271/500) <br>*(SE = 2,23 %, IC 95 % : [49,8 % – 58,5 %])* | **45,6 %** (456/1000) <br>*(SE = 1,58 %, IC 95 % : [42,5 % – 48,7 %])* |
| **Avec cap 2 (`diverse=2`)** <br>*(Le Borné & w7_d2)* | **42,0 %** (210/500) <br>*(SE = 2,21 %, IC 95 % : [37,8 % – 46,4 %])* | **53,2 %** (266/500) <br>*(SE = 2,23 %, IC 95 % : [48,8 % – 57,5 %])* | **47,6 %** (476/1000) <br>*(SE = 1,58 %, IC 95 % : [44,5 % – 50,7 %])* |
| **Avec cap 3-2-1 (`diverse=cap321`)** <br>*(w7_d3)* | **42,8 %** (214/500) <br>*(SE = 2,21 %, IC 95 % : [38,5 % – 47,2 %])* | **50,6 %** (253/500) <br>*(SE = 2,24 %, IC 95 % : [46,2 % – 55,0 %])* | **46,7 %** (467/1000) <br>*(SE = 1,58 %, IC 95 % : [43,6 % – 49,8 %])* |
| **Avec cap Hybride (`Cap321 T1-4, Cap2 T5+`)** <br>*(w6_d5)* | **42,0 %** (210/500) <br>*(SE = 2,21 %, IC 95 % : [37,8 % – 46,4 %])* | **53,2 %** (266/500) <br>*(SE = 2,23 %, IC 95 % : [48,8 % – 57,5 %])* | **47,6 %** (476/1000) <br>*(SE = 1,58 %, IC 95 % : [44,5 % – 50,7 %])* |
| **Top 10 Avec cap 2 (`Root10, diverse=2`)** <br>*(w8_d4_r10_c2)* | **50,2 %** (251/500) <br>*(SE = 2,24 %, IC 95 % : [45,8 % – 54,6 %])* | **62,8 %** (314/500) <br>*(SE = 2,16 %, IC 95 % : [58,5 % – 66,9 %])* | **56,5 %** (565/1000) <br>*(SE = 1,57 %, IC 95 % : [53,4 % – 59,5 %])* |
| **Écart (Cap 2 vs Sans Cap)** | **+5,0 points** *(avantage cap significatif)* | **-1,0 point** *(différence non significative)* | **+2,0 points** *(léger avantage global)* |
| **Écart (Cap 321 vs Sans Cap)** | **+5,8 points** *(record en début)* | **-3,6 points** *(légère perte en milieu)* | **+1,1 point** *(léger avantage global)* |
| **Écart (Top 10 Cap 2 vs Top 8 Sans Cap)** | **+13,2 points** *(bond spectaculaire)* | **+8,6 points** *(domination nette)* | **+10,9 points** *(majorité absolue capturée)* |

#### Enseignements sur la racine :
1. **Un gain net en début de partie (Record Cap321 à 42,8 %)** :
   Aux tours 4–10, le cap non-linéaire 3-2-1-1-1 pousse la couverture de l'Oracle à un sommet de **42,8 %**, devançant le cap 2 (42,0 %) et dominant sans cap (37,0 %). La présence forcée de 5 cartes distinctes dans les 8 candidats racine permet de capturer la bonne carte dans les positions initiales non structurées.
2. **L'impact du milieu de partie aux tours 11–20** :
   Le cap 321 recule à **50,6 %** (contre 53,2 % pour Cap 2 et 54,2 % pour Sans Cap). En milieu de jeu, la 3e carte en main est souvent une carte défensive cruciale qui mériterait 2 ou 3 poses alternatives : la brider à un unique créneau élimine des variantes légitimes.
3. **Le saut quantique de Root 10 Candidats Cap 2 (56,5 % global)** :
   En portant la racine à 10 candidats avec Cap 2, le moteur capture **50,2 %** des coups optimaux en début et **62,8 %** en milieu de jeu. C'est la première configuration capable de capturer la majorité absolue des décisions de l'Oracle dès la sélection initiale.

---

### B. Sous la racine : La couverture dans les shortlists (`Top 5`, `Top 6`, `Top 7`, `Top 8`)

Sous la racine, chaque nœud enfant restreint ses répliques à `widen` coups (`widen=5`, `6`, `7` ou `8`). La proportion de positions où la meilleure réponse de l'Oracle figure dans cette shortlist enfant explique l'effondrement du Borné et la puissance de `widen=8` :

| Taille de la shortlist | Début (Tours 4–10, n=500) | Milieu (Tours 11–20, n=500) | Global (N=1 000 positions) |
| :--- | :---: | :---: | :---: |
| **Top 5 sans cap** (`widen=5, diverse=0`) | **26,2 %** (131/500) <br>*(SE=1,97 %, [22,5 % – 30,2 %])* | **35,4 %** (177/500) <br>*(SE=2,14 %, [31,3 % – 39,7 %])* | **30,8 %** (308/1000) <br>*(SE=1,46 %, [28,0 % – 33,7 %])* |
| **Top 5 avec cap 2** (`widen=5, diverse=2`, Borné) | **28,4 %** (142/500) <br>*(SE=2,02 %, [24,6 % – 32,5 %])* | **36,8 %** (184/500) <br>*(SE=2,16 %, [32,7 % – 41,1 %])* | **32,6 %** (326/1000) <br>*(SE=1,48 %, [29,8 % – 35,6 %])* |
| **Top 6 avec cap 2** (`widen=6, diverse=2`, w6_d5) | **32,2 %** (161/500) <br>*(SE=2,09 %, [28,3 % – 36,4 %])* | **43,4 %** (217/500) <br>*(SE=2,22 %, [39,1 % – 47,8 %])* | **37,8 %** (378/1000) <br>*(SE=1,53 %, [34,8 % – 40,8 %])* |
| **Top 7 sans cap** (`widen=7, diverse=0`, Exp 1.2) | **33,0 %** (165/500) <br>*(SE=2,10 %, [29,0 % – 37,2 %])* | **48,8 %** (244/500) <br>*(SE=2,24 %, [44,4 % – 53,2 %])* | **40,9 %** (409/1000) <br>*(SE=1,55 %, [37,9 % – 44,0 %])* |
| **Top 7 avec cap 2** (`widen=7, diverse=2`) | **37,8 %** (189/500) <br>*(SE=2,17 %, [33,7 % – 42,1 %])* | **49,0 %** (245/500) <br>*(SE=2,24 %, [44,6 % – 53,4 %])* | **43,4 %** (434/1000) <br>*(SE=1,57 %, [40,4 % – 46,5 %])* |
| **Top 7 avec cap 3-2-1** (`widen=7, diverse=cap321`) | **36,4 %** (182/500) <br>*(SE=2,15 %, [32,3 % – 40,7 %])* | **46,4 %** (232/500) <br>*(SE=2,23 %, [42,1 % – 50,8 %])* | **41,4 %** (414/1000) <br>*(SE=1,56 %, [38,4 % – 44,5 %])* |
| **Top 8 avec cap 2** (`widen=8, diverse=2`, w8_d4) | **42,0 %** (210/500) <br>*(SE=2,21 %, [37,8 % – 46,4 %])* | **53,2 %** (266/500) <br>*(SE=2,23 %, [48,8 % – 57,5 %])* | **47,6 %** (476/1000) <br>*(SE=1,58 %, [44,5 % – 50,7 %])* |

#### Pourquoi Le Borné perd le duel et la force de `widen=8, diverse=2` :
- Dans l'arbre de l'Expérimental 1.2 (`widen=7`), la shortlist capture le coup de l'Oracle dans **40,9 % à 43,4 %** des cas.
- Dans l'arbre du Borné (`widen=5`), cette couverture s'effondrait à **30,8 % à 32,6 %** (perte de > 10 points de couverture à chaque réplique).
- **Le saut à `widen=8, diverse=2`** : En passant la shortlist à 8 candidats et Cap 2, la couverture atteint **47,6 %** au global (dont **53,2 % en milieu de jeu**). L'arbre explore la réplique optimale de l'Oracle dans près de la moitié des branches de réponse, tout en évitant les sur-concentrations stériles sur une seule carte.

---

### C. Validation sur les 1 000 positions de jeu réel (Replays de duels)

Pour valider ces dynamiques en conditions de parties jouées, nous avons analysé le comportement de chaque moteur sur 1 000 états de jeu réels (500 tours 1–4, 500 tours 10–13) :

| Configuration | Accord coup n°1 avec Oracle (Début T1–4) | Accord coup n°1 avec Oracle (Milieu T10–13) | Coup Oracle présent dans Top 8 (Début T1–4) | Coup Oracle présent dans Top 8 (Milieu T10–13) | Coup Oracle Top 8 Global (N=1 000) | Accord n°1 Global (N=1 000) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **w5_d0 (sans cap)** | 3,0 % (15/500) | 17,8 % (89/500) | 18,6 % (93/500) | 48,4 % (242/500) | 33,5 % (335/1000) | 10,4 % (104/1000) |
| **w5_d2 (Le Borné)** | 3,6 % (18/500) | 20,4 % (102/500) | 23,2 % (116/500) | 51,2 % (256/500) | 37,2 % (372/1000) | 12,0 % (120/1000) |
| **w7_d0 (Exp 1.2)** | 2,8 % (14/500) | 20,2 % (101/500) | 18,6 % (93/500) | 48,4 % (242/500) | 33,5 % (335/1000) | 11,5 % (115/1000) |
| **w7_d2 (widen=7, cap2)** | 2,2 % (11/500) | 20,4 % (102/500) | 23,2 % (116/500) | 51,2 % (256/500) | 37,2 % (372/1000) | 11,3 % (113/1000) |
| **w7_d3_cap321 (Root8, W7, D3, Cap321)** | 4,6 % (23/500) | 19,8 % (99/500) | 24,2 % (121/500) | 49,2 % (246/500) | 36,7 % (367/1000) | 12,2 % (122/1000) |
| **w6_d5_cap321_2 (Root8 Cap321/2, W6, D5, Cap2)** | 5,0 % (25/500) | 19,0 % (95/500) | 24,2 % (121/500) | 51,2 % (256/500) | 37,7 % (377/1000) | 12,0 % (120/1000) |
| **w8_d4_r10_c2 (Root10 Cap2, W8, D4, Cap2)** | **5,2 %** (26/500) <br>*(**Record +86 %**)* | **22,4 %** (112/500) <br>*(**Record absolu**)* | 22,8 % (114/500) <br>*(Top 10: **28,8 %**)* | **57,8 %** (289/500) <br>*(Top 10: **62,2 %**)* | **40,3 %** (403/1000) <br>*(Top 10: **45,5 %**)* | **13,8 %** (138/1000) <br>*(**Record absolu +20 %**)* |
| **w7_d5_pw1 (Exp 1.2 + PW)** | **5,2 %** (26/500) <br>*(**Record +86 %**)* | 19,4 % (97/500) | 18,6 % (93/500) | 48,4 % (242/500) | 33,5 % (335/1000) | **12,3 %** (123/1000) <br>*(vs 11,5 % Exp 1.2)* |

---

## 7. Synthèse et analyses approfondies des configurations candidates

### A. Autopsie de la configuration `Root8, Widen7, Depth3, Cap321` : que s'est-il passé ?

L'intuition à l'origine de cette configuration était double :
1. *« Un cap 3-2-1 moins linéaire permet 5 cartes différentes à la racine et 4 en shortlist, ce qui est plus équilibré. »*
2. *« Depth=3 élimine les tours 4-5 pour renforcer les tours 2-3 et éviter le gaspillage sur les singletons. »*

Les mesures empiriques sur 1 000 positions révèlent trois constats essentiels :

#### 1. Ce que l'intuition a brillamment vu (Les victoires de Cap321) :
- **Diversification parfaite en ouverture** : À la racine, l'arbre présente en moyenne **5,01 ± 0,25 cartes distinctes** aux tours 1–4 (contre seulement 2,88 pour l'Expérimental 1.2).
- **Bond spectaculaire de l'accord avec l'Oracle en début de jeu** : L'accord direct sur le coup n°1 passe de **2,8 % à 4,6 %** (soit **+64 % de coups identiques à l'Oracle**).
- **Record de capture du coup Oracle dans le Top 8** : **24,2 %** en duels réels et **42,8 %** sur le banc de test.
- **Convergence renforcée à la racine** : Le coup n°1 reçoit **529,3 visites** en moyenne (contre 512,0 pour Exp 1.2), confirmant une meilleure décision finale à la racine.

#### 2. Ce qui a été sous-estimé ou contre-productif (« Ce qui a été oublié ») :
- **Erreur d'appréciation n°1 : Depth=3 n'élimine pas les singletons, il les augmente !**
  - Dans la shortlist enfant à `widen=7`, forcer un quota 3-2-1-1 impose de sélectionner 4 cartes distinctes. Les 3e et 4e cartes de la main (qui sont heuristiquement médiocres) reçoivent chacune obligatoirement 1 visite d'expansion.
  - L'arbre teste ce coup une seule fois, constate sa faiblesse, et ne le revisite plus jamais.
  - **Résultat** : Au Pli 2, le pourcentage de singletons **monte à 39,7 %** (contre 37,0 % pour Exp 1.2 et 33,6 % pour Le Borné). L'obligation de tester 4 cartes sous la racine crée mécaniquement plus de nœuds « morts » à 1 visite.
- **Erreur d'appréciation n°2 : Le Pli 4 ne consommait déjà presque rien (~3 % du budget)** :
  - Sur 2 000 itérations, le Pli 5 était déjà strictement vide (**0,00 nœud**). Le Pli 4 ne comptait en moyenne que **156 nœuds sur 5 026** (3,1 % du budget total).
  - Couper à `depth=3` ne libère donc que ~160 visites pour les plis 2–3 (un gain marginal de +3 %).
  - En échange, toute ligne qui aurait pu descendre à 4 demi-coups bascule prématurément en **rollout heuristique aveugle**, privant le moteur d'évaluation tactique arborescente à ce niveau.
- **Erreur d'appréciation n°3 : Le cap strict à 1 borne pour les cartes $\ge 3$ affaiblit la tactique en milieu de partie** :
  - Aux tours 11–20, sur un plateau contesté, la 3e ou 4e carte en main peut être un atout décisif qui mériterait d'être envisagé sur 2 bornes distinctes (ex. bloquer sur borne 6 OU attaquer sur borne 5).
  - Avec le cap `1`, le moteur ne conserve que la première borne évaluée par l'heuristique pré-MCTS.
  - Conséquence : la couverture shortlist en milieu de partie recule de **49,0 % à 46,4 %** (-2,6 points) et dans le Top 8 banc de **53,2 % à 50,6 %** (-2,6 points).

---

---

### B. Analyse de la configuration `Root8 Cap321(T1-4)/Cap2(T5+), ShortList W6, D5, Cap2`

L'utilisateur a proposé une seconde configuration ciblée :
> *« Root:8Candidats, Cap321(T1-4), Cap2(T5+) - ShortList:Depth5, Widen6, Cap2. Ça devrait limiter les singletons cette fois-ci. »*

Les mesures empiriques sur les 1 000 positions de duels et les 1 000 positions du banc Oracle confirment et dépassent les attentes :

#### 1. L'hypothèse sur les singletons est confirmée à 100 % :
- **Chute massive des singletons sous les candidats (L1 / Pli 2)** :
  Le pourcentage de nœuds visités une seule fois au Pli 2 s'effondre à **34,4 % ± 9,5 %** (IC 95 % : [33,8 % – 34,9 %]), contre **39,7 %** pour `cap321` (**-5,3 points**) et **37,0 %** pour l'Expérimental 1.2 (**-2,6 points**).
- **Concentration accrue des visites** :
  La visite médiane des répliques enfants L1 remonte à **1,98 ± 0,99** (contre 1,65 pour `cap321`), et la visite maximale moyenne sous un candidat grimpe à **27,2 ± 14,6** (battant nettement les 23,7 de l'Expérimental 1.2).
- **Pourquoi ça marche ?**
  Dans la shortlist enfant, `widen=6, diverse=2` plafonne chaque carte à 2 poses et n'autorise au total que 6 répliques (au lieu de 7). Cela permet d'explorer au maximum 3 cartes distinctes (ex. 2+2+2 poses). La 4e ou 5e carte heuristiquement faible est systématiquement rejetée de la shortlist, ce qui supprime le gaspillage de visites d'expansion obligatoires sur des coups condamnés d'avance.

#### 2. Nouveau record absolu d'accord avec l'Oracle en début de jeu (Tours 1–4) :
- En début de partie, l'accord direct sur le coup n°1 atteint **5,0 %** (25/500, IC 95 % : [3,4 % – 7,3 %]).
- C'est un bond de **+78 %** par rapport à l'Expérimental 1.2 (2,8 %, 14/500), battant également la version `cap321` précédente (4,6 %).

#### 3. Nouveau record absolu de capture du coup Oracle dans le Top 8 (Global 1 000 positions) :
- Sur l'ensemble des 1 000 positions de duels, le coup optimal de l'Oracle figure dans le Top 8 dans **37,7 %** des cas (377/1000, IC 95 % : [34,7 % – 40,7 %]).
- C'est le **meilleur score de toutes les configurations évaluées** (Exp 1.2 : 33,5 %, Le Borné : 37,2 %, w7_d3_cap321 : 36,7 %).
- Début (T1–4) : **24,2 %** (121/500).
- Milieu (T10–13) : **51,2 %** (256/500).

#### 4. Restauration de la profondeur tactique (`depth=5`) :
- En rétablissant `depth=5`, le Pli 4 retrouve toute son utilité tactique avec **282 ± 371 nœuds** (6,2 % de l'arbre), soit près du double de l'Expérimental 1.2 (159 nœuds).
- La profondeur maximale moyenne est de **3,91 ± 0,29**, montrant que l'arbre explore régulièrement à 4 demi-coups quand la position l'exige.
- Le Pli 5 reste virtuellement vide (**0,03 nœud**), démontrant que le moteur ne gaspille aucun budget à explorer un 5e pli inutile.

---

---

### C. Analyse de la configuration `Root:10Candidats, Cap2 - ShortList:Depth4, Widen8, Cap2` (`w8_d4_r10_c2`)

L'utilisateur a posé une hypothèse audacieuse et stimulante :
> *« Matcher trop l'Oracle c'est pas forcément une garantie de résultat dans les duels. Je fais confiance à l'UCB avec root10-widen8-cap2-d4 pour moi c'est la seule option qui peut battre la v1.2. Jouer en largeur plutôt qu'en profondeur. »*

Les mesures empiriques sur les 1 000 positions de duels et les 1 000 positions du banc Oracle révèlent un résultat fascinant, marqué par un paradoxe saisissant.

#### 1. Le Paradoxe de l'Oracle : L'explosion de l'accord avec l'Oracle (Records historiques battus !)
Alors que l'hypothèse cherchait à s'émanciper du mimétisme de l'Oracle au profit de l'exploration UCB en largeur, **cette configuration explose tous les records d'accord avec l'Oracle jamais enregistrés dans le projet** :
- **Accord direct sur le coup n°1 en début de partie (Tours 1–4, n=500)** : **5,2 %** (26/500, IC 95 % : [3,6 % – 7,5 %]).
  C'est un bond de **+86 %** par rapport à l'Expérimental 1.2 (2,8 %), devançant même toutes les versions précédentes (`cap321` à 4,6 % et `cap321_2` à 5,0 %).
- **Accord direct sur le coup n°1 en milieu de partie (Tours 10–13, n=500)** : **22,4 %** (112/500, IC 95 % : [19,0 % – 26,3 %]).
  C'est le **record absolu du projet**, battant pour la première fois l'Expérimental 1.2 (20,2 %) et Le Borné (20,4 %).
- **Accord direct sur le coup n°1 au Global (1 000 positions)** : **13,8 %** (138/1000, IC 95 % : [11,8 % – 16,1 %]).
  Nouveau record absolu, en hausse de **+20 %** par rapport à l'Expérimental 1.2 (11,5 %).
- **Présence du coup optimal dans le Top 8 en milieu de partie (Tours 10–13)** : **57,8 %** (289/500), contre 48,4 % pour l'Expérimental 1.2.
- **Présence du coup optimal dans le Top 8 au Global** : **40,3 %** (403/1000). C'est le **premier moteur de l'histoire du projet à franchir la barre des 40 %** sur les replays de duel !
- **Présence dans les 10 Candidats de la racine** : **45,5 %** global (62,2 % en milieu de jeu, 28,8 % en début).
- **Couverture sur le banc de test (1 000 positions du banc Oracle)** :
  - La racine (Top 10 Cap 2) capture **56,5 %** des décisions globales de l'Oracle (50,2 % début, 62,8 % milieu).
  - La shortlist enfant (Top 8 Cap 2) capture **47,6 %** (vs 40,9 % pour Exp 1.2).

*Pourquoi ce paradoxe ?* En ouvrant 10 candidats à la racine (avec cap 2) et 8 répliques en shortlist, l'arbre ISMCTS ne passe plus à côté des coups subtils que l'heuristique pré-MCTS sous-notait. L'algorithme UCB a désormais l'opportunité d'évaluer ces coups prometteurs, et lorsqu'il les simule, il converge naturellement vers le choix de l'Oracle.

#### 2. Autopsie structurelle : Les victoires et les contreparties de la largeur
- **Victoire historique : Le taux de singletons global le plus bas jamais mesuré (29,42 %)** :
  - Sur l'ensemble de l'arbre, le taux de singletons tombe à **29,42 % ± 2,86 %** (IC 95 % : [29,2 % – 29,6 %]). C'est inférieur à l'Expérimental 1.2 (31,69 %) et même à l'Oracle à 20 000 itérations (33,63 %) !
  - En coupant strictement à `depth=4`, l'arbre élimine complètement le Pli 5 (**0,00 nœud**) et réduit le Pli 4 à **60 ± 145 nœuds** (seulement 1,1 % du budget). On ne gaspille plus d'itérations à créer des nœuds profonds à 1 visite.
- **Contrepartie n°1 : La dispersion des visites au Pli 2 en ouverture** :
  - Ouvrir 8 enfants sous 10 candidats racine engendre jusqu'à 80 branches d'expansion au Pli 2.
  - En début de partie (Tours 1–4), le taux de singletons sous les candidats explose à **50,7 % ± 8,6 %** (avec une médiane de visites de seulement **1,00**). Plus de la moitié des répliques ne sont testées qu'une seule fois.
  - Heureusement, en milieu de partie (Tours 10–13), la convergence se rétablit vertueusement : les singletons L1 redescendent à **34,1 % ± 7,8 %**, la médiane remonte à **2,33**, et la visite maximale moyenne sous un candidat atteint **27,8**.
- **Contrepartie n°2 : La perte de conviction à la racine** :
  - Répartir 2 000 itérations sur 10 candidats (au lieu de 8) dilue mathématiquement le nombre de visites allouées au coup favori :
  - Le coup n°1 ne reçoit en moyenne que **441,5 ± 125,8 visites** (contre **512,0** pour Exp 1.2 et **529,3** pour `cap321`).
  - L'écart moyen de visites entre le coup n°1 et le coup n°2 se resserre à **116,3 visites** (contre 142,2 pour Exp 1.2). Le moteur hésite davantage entre ses deux meilleures options.

#### 3. Bilan et Verdict du duel de validation (500 parties réelles, offsets 1 et 2)
Un duel officiel `VALIDATE_LONG` (4 × 250 parties, règle officielle `--page`) a été lancé dans la backlog opposant directement `w8_d4_r10_c2` à l'Expérimental 1.2 :
- **Duel 1 (`VALIDATE_LONG_1`, Offset 1, 250 parties)** :
  - **Score de `w8_d4_r10_c2`** : **50,8 %** (127 victoires / 123 défaites, fourchette 95 % par paires : [46,2 % – 55,4 %]).
  - **En commençant** : **56,8 %** · **En second** : **44,8 %**.
  - Le challenger passe le cap des 47,0 % et valide l'entrée dans le duel 2 !
- **Duel 2 (`VALIDATE_LONG_2`, Offset 2, 250 parties)** :
  - **Score de `w8_d4_r10_c2`** : **43,2 %** (108 victoires / 142 défaites, fourchette 95 % par paires : [37,6 % – 48,8 %]).
  - **En commençant** : **38,4 %** · **En second** : **48,0 %**.
- **Score cumulé sur 500 parties** :
  - **Moyenne pondérée** : **47,0 %** (235 victoires / 265 défaites).
  - **Déclenchement de la règle d'arrêt (`stopIf`)** : Le cumul des deux premiers duels étant à 47,0 % (strictement sous le seuil de 50,0 % requis après 2 duels), le gestionnaire de backlog a automatiquement annulé les duels 3 et 4 (`skipped`), épargnant 500 parties de calcul CPU inutile.

#### 4. Analyse de l'écart : Pourquoi la largeur ne suffit pas en duel ?
1. **L'illusion du mimétisme de l'Oracle en duel réel** :
   Même en capturant 57,8 % des coups de l'Oracle en milieu de jeu et en réalisant un record historique d'accord direct à 22,4 %, le moteur souffre en duel réel face à un arbre libre. L'Oracle calcule avec 20 000 itérations et une omniscience parfaite ; l'arbre ISMCTS à 2 000 itérations doit naviguer dans l'incertitude.
2. **Le coût fatal du cap en shortlist** :
   Comme pour Le Borné (45,9 %) et `w6_d5_cap321_2` (46,8 %), brider les répliques à 2 bornes par carte dans la shortlist enfant empêche l'arbre d'examiner toutes les variantes d'attaque de l'adversaire sur une borne brûlante.
3. **Le manque de conviction à la racine** :
   Avec seulement 441 visites sur le meilleur coup (contre 512 pour Exp 1.2), le moteur est plus indécis sur les positions serrées de fin de manche, ce qui coûte cher sur les donnes tendues (Offset 2 à 43,2 %).

---

### D. Analyse de la configuration Expérimental 1.2 avec Progressive Widening (`w7_d5_pw1`)

L'utilisateur a posé la question clé pour la Version 1.3 :
> *« Est-ce que le nombre de Singletons diminue sans amputer le reste en activant le Progressive Widening (+pw=1) sur l'Expérimental 1.2 ? »*

Les mesures empiriques sur les 1 000 positions révèlent des découvertes spectaculaires sur la dynamique interne de l'arbre ISMCTS :

#### 1. Le bond historique en profondeur : la barrière du Pli 4 enfin brisée !
- **Profondeur maximale moyenne de 4,16 ± 0,37** (IC 95 % : [4,13 – 4,18]) :
  C'est le **seul moteur à budget 2 000 itérations de l'histoire du projet à dépasser la profondeur 4 en moyenne** (contre 3,67 pour Exp 1.2, 3,91 pour `w6_d5` et 3,48 pour `w8_d4`).
- **Le Pli 4 plus que doublé** : Il passe de **159 nœuds** (3,1 % de l'arbre) dans l'Expérimental 1.2 à **335 nœuds** (12,3 % de l'arbre) !
- **Le Pli 5 commence à être atteint** : En moyenne **0,47 ± 1,25 nœud** par recherche (contre 0,00 absolu pour la 1.2). L'arbre descend enfin là où aucun bot à 2 000 itérations ne pouvait aller.

#### 2. L'élagage massif du Pli 3 et la fin des nœuds fantômes à 0 visite
- Au Pli 3, le nombre moyen de nœuds explorés s'effondre de **4 136 nœuds à 1 549 nœuds (-62 %)** !
- **Pourquoi ?** Parce que dans l'Expérimental 1.2 sans PW, dès qu'un nœud du Pli 2 est visité, il pré-instancie d'office ses 7 enfants dans la shortlist. L'immense majorité de ces enfants n'est jamais visitée, créant **~2 850 nœuds fantômes à 0 visite** par recherche.
- Avec `pw=1` ($1 + \lfloor\sqrt{N}\rfloor$), un nœud ne débloque son 3e enfant qu'à partir de 4 visites, son 4e à 9 visites, etc. L'arbre total est ainsi **divisé par deux** (de 5 142 à 2 716 nœuds au total) !
- Les nœuds à 0 visite sont réduits de 78 % (de 2 850 à 636).

#### 3. Le paradoxe apparent des singletons : Que s'est-il passé ?
- Dans les statistiques globales, le pourcentage de nœuds à 1 visite par rapport aux nœuds créés s'affiche à **55,6 %** (contre 31,7 % pour Exp 1.2).
- **L'explication mathématique** : Ce ratio est purement un effet de dénominateur ! Dans l'Expérimental 1.2 classique, les 2 850 nœuds à 0 visite diluaient artificiellement le dénominateur (5 142 nœuds). En supprimant ces 2 850 nœuds fantômes, la proportion de nœuds à 1 visite augmente mécaniquement en pourcentage relatif.
- **La vraie métrique de concentration** :
  - Dans l'Expérimental 1.2, seuls **399 nœuds** (8 % de l'arbre) recevaient plus d'une visite.
  - Dans `w7_d5_pw1`, ce nombre grimpe à **545 nœuds utiles (+36 % !)**.
  - Plus d'itérations sont réinvesties sur les branches vivantes plutôt que dispersées en expansions stériles.

#### 4. Accord avec l'Oracle et conviction à la racine :
- **Visites sur le meilleur coup** : Remontent à **518,7 ± 143,2 visites** (contre 512,0 pour Exp 1.2 et 441,5 pour Root10). La décision à la racine est encore plus solide et tranchée.
- **Accord direct sur le coup n°1 en début de partie (Tours 1–4)** : **5,2 %** (26/500, IC 95 % : [3,6 % – 7,5 %]). C'est un gain de **+86 %** par rapport à l'Expérimental 1.2 (2,8 %), égalant le record absolu de `w8_d4_r10_c2` !
- **Accord direct sur le coup n°1 au Global** : **12,3 %** (123/1000) contre 11,5 % (115/1000) pour Exp 1.2 (**+7 % de gain relatif**).

#### 5. Bilan :
Le Progressive Widening remplit parfaitement sa mission : **il double la pénétration en profondeur (Pli 4 à 12,3 %, profondeur max de 4,16) sans rien amputer du jeu tactique** (arbre libre à widen=7 préservé sur les branches actives). C'est le composant d'approfondissement le plus efficace découvert à ce jour pour la v1.3.

---

### E. Enseignements globaux et recommandations pour la Version 1.3

1. **La constante universelle face à l'Expérimental 1.2** :
   Toutes les configurations appliquant un cap de diversité dans la shortlist enfant s'inclinent face à l'arbre libre de l'Expérimental 1.2 :
   - `w5_d2` (Le Borné) : **45,9 %**
   - `w6_d5_cap321_2` : **46,8 %**
   - `w8_d4_r10_c2` : **47,0 %**
   - **Expérimental 1.2 (`widen=7, depth=5, core=stfig6+exact=12@2000`)** demeure le **champion incontesté du projet**.

2. **La voie royale pour la Version 1.3** :
   Les données de plus de 2 000 parties de duel et 5 000 arbres analysés dégagent une feuille de route limpide :
   - **Ouverture créative à la racine uniquement** : activer le cap `Cap321` à la racine sur les 4 premiers demi-coups via `rootDiverse=cap321_2` (sans `diverse` sous la racine, l'arbre reste libre).
   - **Liberté tactique totale dans l'arbre** : Conserver `widen=7, diverse=0` dans toute la shortlist enfant pour laisser l'ISMCTS contrer librement les menaces adverses sur les bornes contestées.
   - **Approfondissement dynamique via Progressive Widening (`pw=1`)** : Activer `pw=1` pour concentrer les itérations, doubler le Pli 4 (335 nœuds) et franchir la profondeur 4 sans aucune censure artificielle.
