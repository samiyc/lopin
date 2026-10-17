# La nuit du 14/10 et les oracles : profond, Oracle3, Oracle light, CommonDeals, ReplyFpu (14/10 – 17/10)

Journal de la stratégie des robots, chapitre 6 sur 6. [← le registre](../strategie.md) · [← 06/10 – 12/10](05-de-la-1.1-a-la-feuille-1.3.md)

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
Le `stopIf` (nouveau seuil `atLeast`, `scripts/lib/domain/backlog-stop.js`) a gardé **Oracle1** ; l'oracle
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
`suitBudget` (`src/sim/heuristics/suit-budget.js`) les pèse ensemble : un côté est « sur » une couleur (borne
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
(`src/sim/mcts/fork-cut.js`) tient ces propriétaires à jour quand une borne se remplit, et arrête la
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
la sélection. `+implicit=α` (`src/sim/mcts/implicit-minimax.js`) : un nœud prend l'estimation du cœur
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
défaut, empreinte de la 1.2 inchangée). Les simulations vont dans `src/sim/mcts/rollouts.js`
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

**La profondeur atteinte, mesurée** (`src/sim/mcts/tree-stats.js`, une position du tour 15, 42 coups
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
joue un autre (+2,5 ± 2,4 points). `+final=c` (`src/sim/mcts/final-choice.js`) joue le candidat au meilleur taux de
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
  (`trees=2`), un par worker, les scores additionnés comme `createEnsemble` (`web/app/workers/think-join.js`) : les mêmes coups
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
- **L'idée** : `+crn=1` (`src/sim/mcts/common-deals.js`) donne à la k-ième visite de chaque candidat la k-ième donne de la
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

[← le registre](../strategie.md) · [← 06/10 – 12/10](05-de-la-1.1-a-la-feuille-1.3.md)
