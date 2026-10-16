# Le glossaire

Les mots qui reviennent dans les mesures du robot Expérimental, et comment se nomment les
versions en essai et les jobs de la file (Sami, 05/10 : être sur la même longueur d'onde). Si
un terme ne parle pas, on le change ici d'abord. Les commandes, elles, sont dans
[commandes.md](commandes.md).

## Comment le robot choisit un coup

**En résumé** (le V1 à 2 000 itérations ; le changelog 1.1 le montre en schéma, section
« Comment le robot choisit un coup ») :

1. **42 coups** au plus (6 cartes en main × 7 bornes). Le cœur complet, certitudes comprises, en
   garde **8**, les candidats. Une seule fois par coup.
2. **2 000 fois** :
   1. **le tirage** : la main adverse et la pioche, invisibles, sont redistribuées au hasard ;
   2. **la descente** : un des 8 candidats, puis à chaque étage une des 3 réponses que le cœur
      propose dans ce monde-là — une par étage, selon UCB, jusqu'au premier nœud nouveau,
      5 coups au plus ;
   3. **la fin de partie** : le cœur des simulations joue son meilleur coup pour les deux joueurs,
      jusqu'au bout : gagné ou perdu ;
   4. **le retour** (la rétropropagation) : une visite, et une victoire ou non, sur chaque nœud du
      chemin jusqu'au candidat.
3. Le robot joue le candidat **le plus visité**.

**Les ordres de grandeur** :
- au premier coup, **42 coups** possibles (6 cartes × 7 bornes) ; le produit 42 × 41 × … × 37
  compte les mains de départ possibles (dans l'ordre ; C(42, 6) ≈ 5,2 millions sans l'ordre),
  mais une fois la donne faite, on n'en a qu'une, et on la voit ;
- ce qu'on ne voit pas est énorme : **36 cartes invisibles** au départ (6 en main adverse, 30 en
  pioche), soit C(36, 6) ≈ **1,95 million de mains adverses**, et la pioche dans n'importe quel
  ordre ; le tirage en essaie 2 000 ;
- **≈ 10⁵⁰ parties possibles** (35 coups, 20 à 40 choix chacun) : aucune recherche ne parcourt
  tout ; d'où les deux filtres, le cœur (8, puis 3) et le tirage (2 000 mondes).

- **Le cœur** : la fonction qui note tous les coups possibles d'une position en un éclair (moins
  d'un dixième de milliseconde) : la valeur de chaque côté de borne (le *potentiel*), les chances
  de gagner la borne avant et après le coup, plus des bonus (habitudes et idées). Le cœur du V1
  s'appelle `stfig6`.
- **L'arbre** (ISMCTS) : la recherche qui s'appuie sur le cœur. **« 2 000 simulations par coup »
  (`@2000`) veut dire 2 000 itérations pour choisir UN coup**, pas une partie de 2 000 coups.
  Les réglages du V1 : 8 candidats à la racine (`candidates`), 3 réponses par étage (`widen`),
  5 coups de profondeur au plus (`depth`), une exploration de 0,7 (`exploration`).

  **Avant la première itération**, le cœur complet (avec les certitudes) note tous les coups de la
  position réelle et garde les 8 meilleurs : ce sont les seuls que l'arbre regardera à la racine.

  **Une itération** (répétée 2 000 fois) :
  1. **le tirage** : les cartes qu'on ne voit pas (main adverse, pioche) sont distribuées au
     hasard — chaque itération imagine une autre main adverse ;
  2. **la descente, sur UN seul chemin** : à la racine, l'arbre choisit **un** des 8 candidats ;
     dans la position qui en résulte, le cœur note les coups de l'adversaire et en garde 3, parmi
     lesquels l'arbre en choisit **un** ; et ainsi de suite, en alternant les joueurs, 5 coups au
     plus. À chaque étage, le choix va d'abord à un coup jamais essayé, sinon à celui qui équilibre
     le mieux « il a souvent gagné » et « il a été peu essayé » (la formule UCB1). La descente
     s'arrête dès qu'elle arrive sur un coup jamais essayé : l'arbre grandit d'un nœud par itération ;
  3. **la simulation** : de là, la partie est jouée jusqu'au bout, vite (une trentaine de coups),
     le cœur des simulations choisissant chaque coup des deux joueurs ;
  4. **le retour** : qui a gagné cette simulation est compté sur chaque coup du chemin descendu
     (une visite de plus, une victoire de plus ou non).

  Il n'y a donc pas d'étape « valider un nœud puis revenir aux 3 fils » : chaque itération repart
  de la racine et descend un seul chemin. C'est la répétition qui fait le travail : les chemins qui
  gagnent sont redescendus plus souvent, donc creusés plus profond, et les autres restent courts.
  **Après 2 000 itérations, le robot joue le candidat de la racine le plus visité** (pas celui au
  meilleur taux de victoire : un coup peu visité a un taux trop incertain). Il a joué 2 000 fins de
  partie différentes, chacune sur une main adverse imaginée différente.

  ```
  racine (position réelle)                         itération 1 : A → a2 → (nouveau) → simulation
   ├─ A  ← 8 candidats, choisis une fois           itération 2 : B → (nouveau) → simulation
   │   ├─ a1  ← 3 réponses, notées par le cœur     itération 3 : A → a1 → (nouveau) → simulation
   │   ├─ a2      dans chaque position imaginée    …
   │   │   ├─ …  ← 3 réponses, 5 coups au plus     itération 2 000 : le candidat le plus visité
   │   └─ a3                                        est joué
   ├─ B
   └─ … (8 en tout)
  ```
- **Combien de chemins, et qui choisit** :
  - au plus 8 × 3⁴ = **648 chemins de 5 coups** (la profondeur compte le coup de la racine) ; mais
    les 3 réponses sont choisies dans une position où la main adverse est imaginée autrement à
    chaque itération : elles changent, et un nœud finit souvent avec plus de 3 réponses
    essayées. Les 8 candidats de la racine, eux, sont fixés une fois ;
  - **2 000 fins de partie toutes différentes** (un tirage et une fin par itération), pour
    quelques centaines de chemins dans l'arbre ;
  - **le cœur filtre, il ne classe pas** : il décide quels coups entrent (8, puis 3) ; ensuite
    chacun est essayé une fois, puis l'arbre choisit selon les résultats (UCB) — le 1er
    candidat du cœur n'a aucune avance sur le 8e ;
  - **ce qui est coupé** : les coups hors des 8 et des 3, par le filtre du cœur, jamais regardés ;
    la profondeur, par le budget — 250 visites par candidat en moyenne, seuls les chemins qui
    gagnent atteignent le 4e ou 5e coup. L'oracle regarde tous les coups à la racine et 6
    réponses : il lui faut 20 000 itérations, à 2 000 cela dilue les visites (`Tree-12c-4w`).
- **Le candidat le plus visité** : chacun des 8 est d'abord essayé une fois (une sorte
  d'initialisation), puis les 1 992 itérations restantes se répartissent selon UCB : le taux de
  victoire du candidat, plus un bonus qui grandit pour ceux qu'on visite peu (0,7 × √(ln N / n),
  N les visites de la racine, n les siennes). Le meilleur est repris tant que son taux tient ; si
  son taux baisse, ou si le bonus d'un autre a assez grandi, c'est l'autre qui passe. Pas un
  tour de rôle : un équilibre continu. À la fin, les visites sont très inégales (une recherche
  au tour 1 : 503, 371, 287, 222, 220, 165, 134, 98), et le plus visité est joué.
- **Le bonus de curiosité en chiffres** (`0,7 × √(ln N / n)`, à N = 2 000) : 0,09 pour un candidat
  visité 500 fois, 0,19 pour 100, 0,39 pour 25 ; au 10e essai, il dépasse 1 pour tous. Un candidat
  à 50 % visité 100 fois note 0,69, autant qu'un candidat à 60 % visité 500 fois : le moins bon garde
  une part des visites. Sur 2 000 essais, deux candidats à 2 ou 3 points l'un de l'autre ne se
  distinguent pas du hasard des fins de partie (une simulation dans le changelog 1.1 : le
  candidat à 58 % reçoit 391 visites, celui à 56 % 504) ; le 0,7 dose cette exploration.
- **Quand UCB choisit vraiment** : à un nœud, une réponse jamais essayée passe toujours avant
  les autres ; UCB ne départage qu'une fois toutes les réponses du nœud essayées une fois. Comme
  les réponses changent d'un monde tiré à l'autre, un nœud profond n'y arrive presque jamais.
  Part des choix faits par UCB, mesurée à 2 000 itérations (36 positions des tours 12 à 21) :

  | Étage | 0 (racine) | 1 | 2 | 3 | 4 |
  | --- | --- | --- | --- | --- | --- |
  | 3 réponses (V1) | 100 % | 88 % | 42 % | 7 % | 3 % |
  | 7 réponses (`Tree-7w`) | 100 % | 82 % | 7 % | ~0 | ~0 |

  Au-delà, l'arbre ne fait qu'essayer chaque réponse une fois : c'est un tour de rôle, pas un
  choix.
- **L'exploration** (`exploration`, c = 0,7 dans le V1) : le poids du bonus de curiosité d'UCB.
  Plus grand, les visites s'étalent ; plus petit, elles se concentrent sur les finalistes.
  Ce qui a été mesuré :
  - **une autre valeur fixe** : 0,5 sur le 0.9, 56,9 % au tri puis 49,0 % en duel long ; 1,0,
    52,8 % au tri (02/10). Le score bouge peu avec c ;
  - **une exploration qui baisse au fil des itérations** (`ExploreDecay`, l'idée de Sami du
    05/10, une sigmoïde de 0,9 à 0,4) : pas écrite. Le coup joué étant le plus visité, une
    exploration qui s'effondre après 1 000 itérations entérine le favori du moment au lieu de le
    vérifier ; c'est l'élimination par moitiés (`RootHalving`) qui a été essayée à la place ;
  - **`firstExploration`** (`FirstExplo6-Tree-7w`, 06/10) : c = 0,6 partout où joue le
    premier joueur, racine comprise. À la racine de Tree-7w, ses deux finalistes reçoivent 52,5 %
    des visites au lieu de 47,4 % (+11 %) ; 57,3 % à 0,5, 62,8 % à 0,4 (le banc des finalistes).
    En duel : 48,2 % contre le V1, -6,2 ± 5,2 points contre Tree-7w sur les mêmes donnes,
    dans les deux sièges ; écarté. Ici, vérifier plus paie, se concentrer plus non.
- **Le bruit du coup joué** : à 2 000 itérations, deux recherches de Tree-7w avec deux graines
  différentes ne jouent le même coup que dans 19 positions sur 50 (tours 12 à 21). Les bons
  candidats sont très proches : c'est pourquoi un réglage de la racine se juge en duels, jamais
  sur le coup qu'il change.
- **Une réponse** (un nœud) : **une carte précise sur une borne précise** (`7♠@4`) ; deux
  réponses ne se confondent que si c'est la même carte, couleur comprise, sur la même borne. Le
  paquet a 41 cartes différentes (les 2 jokers sont identiques), soit 287 coups possibles en
  tout ; au premier coup, l'adversaire peut tenir 36 de ces cartes : **252 réponses possibles**
  sous chaque candidat. Comme la main adverse est imaginée autrement à chaque itération, son
  top 3 change sans cesse : une recherche au tour 1 voit **116 réponses différentes** sous le
  candidat le plus visité (503 visites), la plus suivie n'en a que 14 ; au tour 21, 19 réponses,
  les principales à 50-140 visites. Au début de la partie, l'arbre ne fait donc guère que
  comparer ses 8 candidats sur la moyenne de leurs fins de partie ; il n'apprend vraiment sous
  eux qu'en milieu et fin de partie.
- **La profondeur (`depth`, 5) et la fin de partie** : deux rôles différents.
  - **Les 5 premiers coups, l'arbre, apprennent** : chaque coup essayé y devient un nœud qui garde
    ses visites et ses victoires ; d'une itération à l'autre, l'arbre compare, retient et revient
    sur ce qui gagne. C'est la seule partie de la recherche qui apprend.
  - **Au-delà, la simulation mesure** : le cœur joue seul jusqu'au bout, rien n'est retenu ; elle
    ne sert qu'à dire qui gagne, pour créditer le chemin. On va jusqu'au bout faute d'un bon juge
    d'une position en cours : une valeur apprise (40 %) et des simulations arrêtées tôt (41 à
    46 %) ont perdu.
  - **Pourquoi 5** : plus profond, il n'y a presque plus de visites (à 800 itérations, 12 % des
    descentes atteignaient le 4e coup, 0,2 % le 5e) : des statistiques de bruit. Moins profond,
    l'arbre ne voit pas les ripostes ; 5 couvre mon coup, sa réponse, mon coup, sa réponse, mon
    coup. Le 0.9 a pris 3 réponses sur 5 coups plutôt que 4 réponses sur 3 : un arbre plus
    étroit va plus loin pour le même nombre d'itérations.
  - **Avec 7 réponses** (`Tree-7w`, 06/10), l'arbre ne va plus aussi loin : à 2 000 itérations,
    3e étage atteint 173 fois sur 2 000, 4e étage 2 fois. La profondeur 5 ne sert presque plus ;
    ce qui paie, c'est de voir plus de réponses adverses au 1er étage (voir « Quand UCB choisit
    vraiment »).
  - D'où `B1Lite1` : un cœur moins juste dans la simulation n'ajoute que du bruit au résultat,
    qui se moyenne sur 2 000 itérations ; dans l'arbre (`B1Lite2`, 47,3 %), ce sont les choix
    eux-mêmes qui se dégradent.
- **Où sert le cœur, et combien de fois par coup** (V1 à 2 000 itérations) :

  | Où | Quel cœur | Combien de fois |
  | --- | --- | --- |
  | **la racine** | le cœur complet, avec les certitudes | **1 fois** : il choisit les 8 candidats |
  | **les nœuds de l'arbre** | le cœur des simulations (sans les certitudes) | **à chaque étage de chaque descente**, quelques milliers de fois : il choisit les 3 réponses regardées |
  | **les simulations** | le cœur des simulations, qui joue chaque fois son meilleur coup | **à chaque coup de chaque simulation** : environ 2 000 × 30 = 60 000 fois |

  C'est dans les simulations que part presque tout le temps (`npm run features`) : un cœur plus
  rapide y donne plus d'itérations, donc un robot plus fort. `B1Lite1` allège le cœur là
  seulement ; `DistOracle1Root` change seulement celui de la racine.
- **Itération, simulation** : ici, les deux mots désignent la même chose (une descente et une fin
  de partie jouée). **Coup** : une carte posée. **Tour** : le numéro du coup dans la partie (une
  partie en compte environ 35). **Partie** : une partie entière, du premier coup à la fin.
- **La fin exacte** : quand la pioche est vide et qu'il reste 8 cartes ou moins, il n'y a plus
  rien de caché ; le robot calcule le meilleur coup exactement, sans arbre.

## Le potentiel d'un côté, pas à pas

Le cœur note un coup par ce qu'il fait gagner à la borne jouée, face à ce que l'adversaire y
construit. Pour ça il lui faut, pour chaque côté, ce qu'il vaudra **une fois fini** : le
*potentiel*. C'est 45 % du temps du cœur (`npm run features`, 05/10), donc la moitié du temps de
chaque simulation. Le code : `src/sim/potential.js`, appelé par `moveGain`, `views` (la menace
adverse) et `borderChances` dans `src/sim/bots.js`.

- **L'échelle** : la valeur d'un côté fini est son **rang** (0 Somme, 1 Suite, 2 Couleur,
  3 Brelan, 4 Suite couleur dans l'ordre original) **plus sa somme / 31** (31 = une de plus que
  la plus grande somme, 10 + 10 + 10). 5♥ 7♥ 8♥ = Couleur, somme 20 : 2 + 20/31 = **2,645**.
  Une meilleure formation bat toujours une meilleure somme.
- **3 cartes** : la valeur exacte (une table, `evaluator.score3`).
- **2 cartes** (`pairPotential`) : le meilleur de deux chemins.
  - finir avec une carte de **la main** : chaque carte essayée (6 au plus) ;
  - finir avec **la pioche** (`drawPotential`) : la **moyenne** sur toutes les cartes encore
    invisibles, plus le meilleur **bonus** d'une formation supérieure, pondéré par la chance de
    tirer une de ses cartes (« outs ») : `1 − (1 − outs/invisibles)^tirages`. Les tirages : la
    moitié de la pioche pour soi ; pour l'adversaire, sa main entière plus la moitié de la pioche.
- **1 carte** (`singlePotential`) : le meilleur de la carte seule (elle + deux cartes moyennes)
  et, pour **chaque carte de la main**, 0,9 × le potentiel de la paire qu'elle ferait (0,9 : une
  paire pas encore posée vaut un peu moins qu'une paire posée).
- **0 carte** : une constante (trois cartes moyennes).

**Un exemple** (paquet classique, ordre original, joker sans couleur) : 7♥ seul sur ma borne 4,
en main 8♥ 7♣ 2♠ 10♦ 5♥ JK, 35 cartes invisibles, 10 tirages.

| Paire essayée | Meilleur avec la main | Potentiel de la paire | × 0,9 | Plafond (A6) |
| --- | --- | --- | --- | --- |
| 7♥ 8♥ | 2,645 (Couleur avec 5♥) | 2,886 (6♥ ou 9♥ dans la pioche : Suite couleur) | 2,597 | 4,774 |
| 7♥ 7♣ | 3,677 (Brelan avec JK) | 3,677 | **3,310** | 3,677 |
| 7♥ 2♠ | 0,613 (une Somme) | 0,613 | 0,552 | 0,613 |
| 7♥ 10♦ | 0,871 (une Somme) | 0,871 | 0,784 | 0,871 |
| 7♥ 5♥ | 2,645 (Couleur avec 8♥) | 2,645 | 2,381 | 4,581 |
| 7♥ JK | 3,677 (Brelan avec 7♣) | 3,677 | 3,310 | 3,677 |

Le 7♥ seul vaut 0,581 ; son potentiel est **3,310** : le Brelan de 7 qu'il ferait avec le 7♣ et le
joker. Une carte seule regarde ainsi 6 paires, chacune 5 cartes de la main et, une fois par paire
et par coup noté (la mémoire des paires), les 35 invisibles : environ 36 évaluations par côté à
une carte, et un coup en note une quarantaine.

**Où va le temps** (05/10) : `drawPotential` 18,8 %, `singlePotential` 9,7 %, `drawPotentialOf`
6,8 %, `sidePotential` 4,5 %, `upsideOf` 3,7 %. Déjà fait, à coups identiques : la mémoire des
paires en tableaux typés (A1), la table des chances (A2), +20,7 % ensemble.

**A6** (11/10) : la colonne « Plafond » est la meilleure valeur qu'une troisième carte, quelle
qu'elle soit, pourrait donner à la paire (`valuer.best3`, une table par évaluateur). Le potentiel
d'une paire ne la dépasse jamais. Une fois le Brelan de 7 trouvé (3,310), 7♥ 2♠ (0,9 × 0,613) et
7♥ 10♦ (0,9 × 0,871) ne peuvent plus faire mieux : on ne les calcule pas. Même résultat au bit
près (les empreintes ne bougent pas), **+5 %** de simulations par seconde sur la 1.2.

**Plus léger, mais faux** : B1 (`lite`, une carte seule vaut sa carte, sans regarder les paires)
allait 31 % plus vite sur un fil, 10 % sur 18, et a perdu à temps égal (47,0 %) : les paires que
la main peut faire sont une grande part du jugement du cœur.

## Mesurer une version

- **V1.1** : l'Expérimental 1.1 (`ismcts+widen=7+depth=5+core=stfig6@2000`, Tree-7w), sorti le 06/10 :
  la version à battre depuis. Les mesures du 04/10 au 06/10 disent « contre le V1 » : c'est le 1.0.
- **V1** : l'Expérimental 1.0 (`ismcts+widen=3+depth=5+core=stfig6`), dans
  le labo à 2 000 itérations par coup depuis le 04/10. On travaille toujours sur la dernière
  version : les nouvelles se nomment par ce qu'elles changent, sans numéro.
- **Le labo** : les parties robot contre robot, hors du jeu. Dans le jeu, le robot réfléchit
  jusqu'à 10 s par coup (environ 13 000 itérations).
- **Une paire** : une même donne jouée deux fois, chaque version commençant une fois. La chance
  des cartes s'y annule en grande partie ; le score d'une paire va de 0 à 1.
- **Un jeu de donnes** (`--offset N`) : une série de donnes tirées d'une graine
  (`SEED + 1 000 003 × N`) ; l'offset 0 est celui des tris, les offsets 1 à 4 ceux des
  validations longues (jamais les donnes qui ont fait choisir une version), 5 et au-delà les
  séries de confirmation (Tree-7w, 06/10). **Un même offset donne les mêmes donnes, dans le même
  ordre et aux mêmes sièges, quelle que soit la version** : deux versions validées sur les
  offsets 1 à 4 se comparent partie par partie (voir « Les sièges »).
- **La fourchette à 95 %** : l'intervalle où se trouve très probablement le vrai score. Environ
  ±5,5 points sur 250 parties, ±4,5 sur 400, ±2,7 sur 1 000. **Une version est meilleure quand
  la fourchette basse dépasse 50 %**, sur 1 000 parties.
- **À temps égal** : quand une version est plus rapide ou plus lente par itération (plus de 3 %
  d'écart), les deux camps jouent au **même temps par coup** (`@t3200` : 3,2 s). Un nombre
  d'itérations ajusté (`@2200` contre `@2000`) n'est sûr que vérifié dans les replays d'un duel :
  le 05/10, le banc de vitesse donnait à `B1Lite1` 31 % d'avance, les duels 10 % seulement.
- **Les écritures `@`** : `@800`, `@2000` : itérations par coup ; `@t3200` : millisecondes par
  coup ; `1k@2k` : 1 000 parties à 2 000 itérations par coup.
- **L'empreinte** (`npm run fingerprint`) : une signature de tous les coups de parties fixes. Une
  optimisation qui la laisse identique ne change aucun coup : pas besoin de la valider en parties.

## Les sièges

- **Le premier joueur** : toujours le joueur 0 (une partie commence avec `current: 0`) ; dans un
  duel, chaque donne est jouée deux fois, chaque version commençant une fois (une paire).
- **L'avantage du second** : entre deux robots proches du V1 à 2 000 itérations, le premier
  joueur gagne **48,1 %** des parties (12 200 parties) ; 44,9 % au 1.0 contre lui-même à 800.
  « 51,3 % en commençant, 57,5 % en second » (Tree-7w) se lit donc contre ≈ 48 et ≈ 52, pas
  contre 50.
- **Le tour critique** (`npm run error-impact`, 02/10, le 0.9 contre lui-même) : une erreur au
  hasard coûte, aux tours impairs 13 à 21 (le premier joueur), ≈ 24 points de chances de gagner
  en moyenne ; aux tours pairs 14 à 20 (le second), ≈ 10,5. Le premier joueur a moins droit à
  l'erreur : c'est l'idée de `FirstExplo`.
- **Le biais de siège des donnes** : une donne peut favoriser le premier joueur ; jouée dans les
  deux sièges, elle gonfle le « en commençant » d'une version et creuse son « en second » dans le
  même duel. Le score total annule ce biais (c'est le but des paires), pas le partage par siège :
  125 parties par siège et par duel, c'est **± 8,8 points**. Au décalage 1, Tree-5w, 6w et 7w
  font tous 58 à 61 % en commençant et 48 à 50 % en second ; aux décalages 3 et 4, l'inverse.
- **Comparer sur les mêmes donnes** : deux versions jouées sur le même offset se comparent partie
  par partie (même fichier de duel trié, même numéro de partie, `duels/index.json`) : leurs
  graines de recherche diffèrent, mais pas les mains. Deux largeurs de l'arbre finissent une
  même partie de la même façon 64 % du temps ; l'écart garde ± 3,7 points sur 1 000 parties
  (au lieu de ± 2,7 contre le V1 pour chacune, mais sans le bruit des donnes). Par siège, sur les
  mêmes donnes : ± 5 points. C'est la seule façon propre de dire qu'une version fait mieux en
  commençant qu'une autre.

## Les étapes d'une validation

Du plus rapide au plus sûr. Aucune étape rapide ne suffit à adopter une version : elles servent
à écarter.

| Terme | Ce que c'est | Durée |
| --- | --- | --- |
| **cœur contre cœur** (`VALIDATE_CORE`) | les deux cœurs jouent seuls, sans arbre, des milliers de parties | ~1 min |
| **le banc** (`VALIDATE_BANC`) | la version joue un coup sur les positions où l'oracle a cherché ; on mesure si elle joue ses coups (banc de similitude, `npm run banc`) | <10 min |
| **validation courte** (`VALIDATE_SHRT`, « tri ») | 400 parties contre le V1 à 2 000 itérations ; écarte une version si le haut de la fourchette est sous 50 % | ~45-55 min |
| **validation longue** (`VALIDATE_LONG`, « 1k@2k ») | 4 duels de 250 parties sur les jeux de donnes 1 à 4, réunis par paires ; décide | ~2 h |

- **Un duel** : une série de parties entre deux versions (`npm run duel`).
- **La règle d'arrêt** (`stopIf`) : une validation longue s'arrête après un 1er duel sous 47 %,
  ou deux réunis sous 50 % ; il est alors presque impossible de finir au-dessus.
- Leçon du 05/10 : une validation courte à 52-53 % ne dit presque rien (10c4r et
  DistOracle1Root y étaient à 52,8 % ; 49,4 % et 51,6 % en validation longue).

## Les pièges

- **Un piège** (Sami, 07/10) : une fin de partie (pioche vide, tout est connu) gagnée pour le
  joueur au trait, où le coup favori du cœur perd. Pas de nul dans ce jeu : ne pas gagner, c'est
  perdre. `npm run traps` les cherche dans les duels gardés et les range par **famille**, la
  première règle qui distingue le coup du cœur du coup gagnant : joker posé ou gardé à tort, carte
  jetée sur une borne perdue, côté complété sur une borne perdue, une borne de plus perdue, borne
  vierge ouverte ; sinon par placement : bonne carte et mauvaise borne, bonne borne et mauvaise
  carte, ou ni l'une ni l'autre.
- **Combien en faut-il** : environ 5 000 erreurs pour classer une dizaine de familles à ± 1,5
  point chacune. Le passage du 07/10 : le cœur se trompe dans 3,6 % des fins de partie gagnées,
  1 507 pièges sur 82 403 fins de partie examinées (± 2,4 points par famille). Le joker y est pour
  31 %, et le bon coup est le 2e choix du cœur dans 62 % des cas.
- **Le banc de pièges** (`npm run trap-bench`, 07/10) : des fins de partie de parties cœur
  contre cœur — celles que jouent les simulations de l'arbre — gardées entières, chacune avec ses
  coups gagnants : les pièges du cœur des simulations du 1.1 (4 à 4,5 % des fins gagnées), et une
  position saine sur trois en témoin. Un cœur y joue en secondes : les pièges qu'il évite, les
  positions saines qu'il casse. Un tri pour un cœur, jamais un verdict : le duel long décide.
- **L'arbre et les pièges** : sur 101 pièges du cœur, l'arbre du 1.1 trouve le coup gagnant 69 fois
  (68 %). Une résolution exacte pioche vide coûte 20 ms en médiane, 232 ms en moyenne : trop cher
  dans chaque simulation (environ 8 min par coup), pas pour le vrai coup (`ExactEnd12`).
- **Pourquoi ça compte** : sous 9 cartes, le robot calcule la fin exactement ; mais le cœur joue
  toutes les fins de partie simulées de l'arbre, et chacun de ses pièges y fausse un résultat.
- **Une menace** (Sami, 11/10, `src/sim/fork.js`) : une borne non décidée dont le gain donne la
  partie à son joueur, par 3 bornes adjacentes ou par la majorité (4 sur 7).
- **La fourchette** (la double menace, comme au Puissance 4) : une borne dont le gain laisserait
  **deux menaces ou plus** — bornes 3 et 4 gagnées, chacune des bornes 2 et 5 fait trois à la
  suite, et l'adversaire ne peut pas tenir les deux. `forkValue` vaut 1 pour une menace, ½ pour une
  borne de fourchette, 0 sinon ; l'idée `fork` du cœur en tire un bonus, pour soi et (aux ¾) pour
  bloquer l'adversaire. Avec trois bornes à soi, toute autre borne est une menace (la majorité).
- **La famille `fork`** des pièges : le coup gagnant joue pour une borne de plus grande valeur
  (menace ou fourchette) que celle du coup du cœur. Les puzzles « double menace »
  (`kind: "fork"`, `npm run puzzles -- --fork`, ids à partir de 401) n'ont que des coups gagnants
  de ce genre.

## L'oracle

- **L'oracle** : le même arbre que le V1, en beaucoup plus large et plus long (tous les coups à
  la racine, 6 réponses par étage, 20 000 itérations). Trop lent pour jouer, il sert d'étalon.
- **Une position stable** : une position où ses deux recherches choisissent le même coup ;
  avant le tour 10, c'est rare (il hésite).
- **Top 8** : le coup de l'oracle est-il parmi les 8 candidats que le cœur donne à la racine ?
- **Distiller** (`npm run distill`) : régler les poids du cœur pour qu'il mette les coups de
  l'oracle dans son top 8.
- **Oracle1 / Oracle2** (Sami, 14/10) : Oracle1 est l'oracle gelé (`ORACLE.version` 1,
  `ismcts+candidates=99+widen=6+depth=5+smart=1@20000`, le cœur du 0.9, sans solveur). Oracle2
  est le même arbre avec ce que la 1.2 a en plus : le cœur `stfig6`, le solveur `exact=12` et 7
  réponses (`ORACLES[2]`, `npm run oracle -- --oracle 2` ; pas plus cher par itération, 0,99×).
  Ses écarts avec la 1.2 ne viennent donc que de la racine (tous les coups) et du budget. Le duel
  Oracle1 contre Oracle2 (`ORACLE_DUEL_1/2_Oracle2`, nuit du 14/10) devait dire lequel relit les
  parties de la 1.2 : **48,1 % pour Oracle2** sur 108 parties, une égalité ; Oracle1 reste la
  référence (`ORACLE.version` 1). Le détail : `docs/strategie.md`, « La nuit du 14/10 ».
- **Oracle3** (Sami, 14/10) : l'oracle profond `Budget20000-Depth10Pw`
  (`ismcts+widen=7+depth=10+core=stfig6+exact=12+pw=1@20000`, `ORACLES[3]`, `npm run oracle -- --oracle
  3`) : la racine de la 1.2 (8 candidats) avec l'élargissement progressif, 57,1 % contre la 1.2@2000 sur
  280 parties — le premier juge plus fort qu'elle. Il relit les parties de la 1.2 sur le même corpus
  qu'Oracle1, pour comparer leurs avis position par position.
- **Omniscient 1.0** (Sami, 15/10, à construire plus tard) : un moteur qui voit tout — les deux mains et
  l'ordre de la pioche — et joue le jeu à information parfaite qui en résulte (un MCTS sans tirage des
  cartes cachées, puis le solveur exact bien avant 12 cartes). Ce n'est pas un oracle : son meilleur coup
  exploite la pioche qu'il voit (« fusion de stratégies »), il ne juge donc pas les coups de la 1.2, sauf
  en toute fin de partie. Il juge **la donne** : qui gagne avec un jeu parfait des deux côtés, et de
  combien. Le détail : `docs/1.3-to-oracle-shift.md`.
- **Confirmer par le jeu** (`npm run oracle -- --confirm`) : pour chaque écart (le coup de
  l'oracle hors du top 3 du cœur), on repart de la position en forçant tour à tour le coup de
  l'oracle, le favori du cœur et le coup joué ; les robots de la partie jouent la suite avec 6
  graines (même pioche, autre chance des recherches) jusqu'au tour 30, où le solveur exact dit
  qui tient la partie. L'écart vaut la différence moyenne entre ces suites.

## Nommer les versions et les jobs

**Une version** se nomme par ce qu'elle change par rapport au V1, en CamelCase, sans numéro de
version :

| Nom | Ce qu'elle change | Moteur |
| --- | --- | --- |
| `B1Lite1` | le cœur allégé (un côté à une carte vaut sa carte seule) dans les simulations | `…+lite=1` |
| `B1Lite2` | le même, aussi dans les nœuds de l'arbre | `…+lite=2` |
| `DistOracle1Root` | le cœur réglé sur l'oracle, à la racine seulement | `…+shortlist=dist1` |
| `DistOracle1` | le même, partout | `…+core=dist1` |
| `DistOraclePair` | la remise sur une paire réglée sur l'oracle (B3) | `…+core=distpair` |
| `NoConnector` | le V1 sans l'idée `connector` | `…+core=v1nc` |
| `Tree-10c-4w` | l'arbre à 10 candidats et 4 réponses par étage (`widen`) | `ismcts+candidates=10+widen=4…` |
| `Tree-5w` | le V1 avec 5 réponses par étage (`widen=5`) au lieu de 3 (même profondeur, UCB à la racine) | `ismcts+widen=5+depth=5+…` |
| `Tree-6w`, `Tree-7w` | le V1 avec 6 ou 7 réponses par étage (profondeur 5, UCB à la racine) | `ismcts+widen=6+depth=5+…` |
| `FirstExplo6-Tree-7w` | Tree-7w, avec une exploration de 0,6 au lieu de 0,7 partout où joue le premier joueur (toujours le joueur 0), racine comprise, dans l'arbre des deux sièges ; les nœuds du second gardent 0,7. En pratique : la racine quand le robot commence, les réponses adverses attendues quand il est second. Le chiffre est c × 10 | `ismcts+widen=7+depth=5+…+firstExploration=0.6` |
| `FirstExplo8-Tree-7w` | le même, avec 0,8 au lieu de 0,6 : plus d'exploration pour le premier joueur | `ismcts+widen=7+depth=5+…+firstExploration=0.8` |
| `EndJoker` | le cœur du 1.2 en essai (`stfig6ej`) : une fois la pioche vide, le joker jugé par ce qu'il gagne de plus que sur sa meilleure autre borne, au lieu de son prix fixe (`src/sim/end-joker.js`). Comparé au V1.1 | `ismcts+widen=7+depth=5+core=stfig6ej@2000` |
| `ExactEnd12` | le V1.1 qui, pioche vide, calcule exactement son vrai coup jusqu'à 12 cartes en main (au lieu de 8), avec un plafond de positions au-delà duquel l'arbre reprend | `ismcts+widen=7+depth=5+core=stfig6+exact=12@2000` |
| `PW-ExactEnd12` | l'Expérimental 1.2 avec l'élargissement progressif (`pw=1`) : sous la racine, un nœud propose 1 + ⌊√visites⌋ réponses du cœur, jusqu'à 7, au lieu de 7 d'emblée ; la racine garde ses 8 candidats. Dans l'analyse d'arbre : `w7_d5_pw1`. Coût +1,9 % par itération : duel à itérations égales | `ismcts+widen=7+depth=5+core=stfig6+exact=12+pw=1@2000` |
| `Budget4000` | la 1.2 à 4 000 itérations par coup au lieu de 2 000 : une mesure, pas une version (le plafond de ce que le budget rapporte) | `ismcts+widen=7+depth=5+core=stfig6+exact=12@4000` |
| `PUCT` | la 1.2 avec l'avis du cœur dans UCB (règle d'AlphaZero) : le bonus d'exploration devient `puct × a priori × √disponibilité / (1 + visites)`, l'a priori d'un coup venant de son rang chez le cœur (1 / (rang + 1), normalisé). Le chiffre est `puct` : `PUCT-1`, `PUCT-2`, `PUCT-4` | `ismcts+…+exact=12+puct=2@2000` |
| `Ensemble` | la 1.2 dont les 2 000 itérations se partagent entre deux arbres de graines différentes, les visites de la racine additionnées (root parallelization) | `ismcts+…+exact=12+trees=2@2000` |
| `Ensemble3`, `Ensemble4` | Ensemble avec 3 ou 4 arbres (667 ou 500 itérations chacun, même total) | `ismcts+…+exact=12+trees=3@2000` |
| `SimCertain` | la 1.2 dont les simulations gardent l'idée `certain` (plus de carte jetée sur une borne perdue) ; l'arbre juge sans elle | `ismcts+…+exact=12+simCertain=1` |
| `SimCertainExact4` | `SimCertain`, et chaque simulation finie par le solveur exact dès que la pioche est vide et qu'il reste 4 cartes (le chiffre) | `ismcts+…+exact=12+simCertain=1+simExact=4` |
| `MarginBackup15` | la 1.2 dont chaque simulation rend, pour 15 % de sa note, l'écart de bornes à la fin (½ + l'avance / 14) au lieu du seul gagné / perdu (`pointsOf`, `choice.js`) | `ismcts+…+exact=12+margin=0.15@2000` |
| `DistOracle1Root-Exact12` | `DistOracle1Root` sur la 1.2 : le cœur réglé sur l'oracle choisit les 8 candidats de la racine, le reste de l'arbre garde `stfig6` | `ismcts+widen=7+depth=5+core=stfig6+shortlist=dist1+exact=12@2000` |
| `Pw2-ExactEnd12` / `Pw3-ExactEnd12` | la 1.2 avec l'élargissement progressif `k + √visites` (Sami, 14/10 : `pw=k`, k = 2 ou 3, 7 réponses dès 25 ou 16 visites ; `pw=1` est le 1 + √visites de `PW-ExactEnd12`). Duels longs du 14/10 : 47,8 % et 56,1 % ; la validation 1k@2k de `Pw3-ExactEnd12` : 51,2 % sur 1 180 parties (48,9 – 53,5), écarté | `ismcts+widen=7+depth=5+core=stfig6+exact=12+pw=2@2000` |
| `Budget20000` | la 1.2 à 20 000 itérations : le même arbre, dix fois le budget ; un candidat juge (Sami, 14/10 : il doit battre la 1.2@2000 nettement) | `ismcts+widen=7+depth=5+core=stfig6+exact=12@20000` |
| `Budget20000-Depth10Pw` | la même, plus profonde : 10 étages et l'élargissement progressif d'aujourd'hui (1 + √visites, jusqu'à 7 réponses) | `ismcts+widen=7+depth=10+core=stfig6+exact=12+pw=1@20000` |
| `pwl=n` (élargissement progressif) | Sami, 16/10 (`widening.js`) : sous la racine, un nœud propose ⌊k + √visites⌋ réponses du cœur, jusqu'à `widen`. **`pwl` va de 0 à 5** : 0 aucun, et plus le niveau monte, plus l'arbre est poussé vers la profondeur. Avec `widen=7`, les 7 réponses s'ouvrent à 16 visites (`pwl=1`), 25 (2), 31 (3), 36 (4) et 40 (5, au moins une réponse par nœud) ; à 2 000, le 5e niveau est atteint dans 20,0 / 28,6 / 40,1 / 55,7 / 67,6 % des coups (les niveaux 3 et 5 visés à 42,5 et 65 %). **`pw=k` est obsolète**, gardé pour que les anciens moteurs rejouent les mêmes coups : `pw=1` = `pwl=4` (Oracle3, `PW-ExactEnd12`, `Depth10Pw`), `pw=2` = `pwl=2` (`Pw2-ExactEnd12`, `OracleLight-Pw2`), `pw=3` = `pwl=1` (`Pw3-ExactEnd12`). Les noms déjà mesurés ne changent pas | `ismcts+…+exact=12+pwl=3@2000` |
| `OracleLight-Pwl3` / `OracleLight-Pwl2-FinalLcb1` | l'Oracle light (10 000) au niveau `pwl=3`, ou au niveau 2 avec le choix final `final=1` (les taux de victoire sont plus fiables à 10 000 qu'à 2 000) ; nuit du 16/10 : `Pwl3` **56,0 % (52,0 – 59,9) sur 420 parties** (`pwl=2` : 54,5 % sur les mêmes donnes), retenu pour l'Oracle light, `Pwl2-FinalLcb1` 53,6 % | `ismcts+widen=7+depth=10+core=stfig6+exact=12+pwl=2+final=1@10000` |
| `Oracle3-Pwl2` / `-Pwl3` / `-Pwl5` | Oracle3 (20 000, `pwl=4`) à un autre niveau d'élargissement ; `Pwl5` pousse le plus vers la profondeur (Sami, 16/10). Nuit du 16/10, offset 12 : `Pwl2` 57,1 %, `Pwl3` 59,3 %, `Pwl5` 57,1 % (Oracle3 = `pwl=4` : 61,4 %), un plateau | `ismcts+widen=7+depth=10+core=stfig6+exact=12+pwl=5@20000` |
| `FinalMean` / `FinalLcb1` | la 1.2 qui joue, au lieu du candidat le plus visité, celui au meilleur taux de victoire moins c / √visites (Sami, 15/10 : `final=c`, `final-choice.js`) : c = 0, le meilleur taux ; c = 1, une borne basse à ~95 %. Pour les rangs 4 à 8 qu'Oracle3 trouve meilleurs (+2,5 ± 2,4) ; même coût par itération. Tri à 800 : 49,8 et 51,7 % ; premier duel long à 2 000 : 54,8 et 55,2 % ; la 1k@2k (15/10) : `FinalMean` 51,9 % (49,3 – 54,5), `FinalLcb1` 52,7 % (50,1 – 55,3), retombé à **51,5 % (49,4 – 53,7) sur 1 500 parties** avec la confirmation : pas de 1.3 | `ismcts+widen=7+depth=5+core=stfig6+exact=12+final=1@2000` |
| `MarginBackup05` | `MarginBackup15` à 5 % (`margin=0.05`) : 51,4 % au tri à 400, gardé en réserve ; un duel long « dernière chance » à 2 000 (15/10) | `ismcts+…+exact=12+margin=0.05@2000` |
| `OracleLight-Pw1` / `-Pw2` / `-Pw3` | l'Oracle light (Sami, 15/10, `docs/1.3-to-oracle-shift.md`) : l'arbre d'Oracle3 à 10 000 itérations au lieu de 20 000, avec `pw=k` (k + √visites réponses), pour un oracle jouable dans la page ; le tri dit quel `k` va avec 10 000. Premier tri (15/10, 140 parties contre la 1.2@2000) : 50,7 / **57,9** / 51,4 % ; `OracleLight-Pw2` confirmé à **54,5 % (50,6 – 58,4) sur 420 parties** (= `pwl=2`) | `ismcts+widen=7+depth=10+core=stfig6+exact=12+pw=2@10000` |
| `ForkCut1` / `ForkCut2` | la double menace dans les simulations (`fork-cut.js`, 14/10) : arrêter une simulation à la première victoire sur les bornes remplies (1, exact), ou aussi à une fourche, compté gagné (2) | `ismcts+widen=7+depth=5+core=stfig6+exact=12+forkCut=1@2000` |
| `Implicit2` / `Implicit4` | l'hybride MCTS-minimax (`implicit-minimax.js`, 14/10) : chaque nœud garde une estimation de la partie (`winOdds` là où il est atteint, puis le minimax de ses enfants), mêlée au taux de victoire avec α = 0,2 ou 0,4 ; la simulation reste entière | `ismcts+widen=7+depth=5+core=stfig6+exact=12+implicit=0.2@2000` |
| `SuitBudget3` | le budget des couleurs (Sami, 14/10, `suit-budget.js`) sur le cœur de la 1.2 : mes côtés lancés sur une couleur réclament plus de cartes de cette couleur que je n'en ai en main plus ma part des non vues ; chaque carte de manque coûte 0,3 | `ismcts+widen=7+depth=5+core=stfig6sb3+exact=12@2000` |
| `TreeReuse` | la 1.2 qui garde son arbre d'un coup au suivant (`reuse.js`) ; mesurée : 13 visites offertes par recherche, sans duel | `ismcts+…+exact=12+reuse=1` |
| `ForkThreat` | la 1.2 dont le cœur donne un bonus aux bornes qui gagnent la partie ou laisseraient une double menace, pour les deux camps (`fork.js`, cœurs `stfig6fork1/2/4`, le chiffre est le poids × 10) | `ismcts+…+core=stfig6fork2+exact=12@2000` |
| `CriticalEnd` | le cœur 1.2 d'urgence tactique (`stfig6crit`, `src/sim/end-urgency.js`) : pioche vide, remboursement du cardCost, priorité de complétion et parades des 3 adjacentes | `ismcts+widen=7+depth=5+core=stfig6crit@2000` |
| `CriticalEnd-Exact12` | le combo cœur tactique `stfig6crit` + solveur exact pioche vide à 12 cartes | `ismcts+widen=7+depth=5+core=stfig6crit+exact=12@2000` |
| `Diverse1` | à la racine, le meilleur coup de chaque carte distincte d'abord, puis les meilleurs gains (`diverse=1`, `pickCandidates` dans `src/sim/pick.js`) | `ismcts+…+diverse=1@2000` |
| `Diverse2` | au plus 2 bornes par carte parmi les candidats, au mérite (`diverse=2`) ; complété par les gains si les cartes manquent | `ismcts+widen=7+…+diverse=2@2000` |
| `Lead2` | 2 bornes pour la carte du meilleur coup, 1 pour les autres (`diverse=lead2`, ou `2-1`) | `ismcts+widen=4+…+diverse=lead2@2000` |
| `Canalisé` (Le Borné 1.0) | le cap `diverse=2` à la racine **et** à chaque étage de l'arbre, avec 5 réponses par étage au lieu de 7 | `ismcts+widen=5+depth=5+core=stfig6+exact=12+diverse=2@2000` |
| `RootHalving-Tree-5w` | RootHalving avec 5 réponses par étage au lieu de 3 (même profondeur) | `ismcts+widen=5+depth=5+…+halving=…` |
| `RootHalving-Tree-2w-6d` | RootHalving avec un arbre de 2 réponses sur 6 coups | `ismcts+widen=2+depth=6+…+halving=750-375-375@1500` |
| `RootHalving` | à la racine, les candidats à tour de rôle puis la moitié éliminée à chaque phase (1 000 / 500 / 500 itérations : 125, 250, 500 visites) au lieu d'UCB | `…+halving=1000-500-500` |
| `EarlyBudget-4000-750` | plus d'itérations aux tours 1-12, moins ensuite, même total | `phase:13:…@4000/…@750` |
| `InferLast3` | la main adverse devinée d'après ses 3 derniers coups | `…+infer=48+memory=3` |

Les optimisations qui ne changent aucun coup (A1 à A4, vérifiées par l'empreinte) n'ont pas de
nom de version : elles profitent à toutes.

**Un job de validation** se nomme en colonnes de largeur fixe à gauche, la version à droite ;
`@` marque une colonne vide :

```
VALIDATE_SHRT_@_B1Lite1           validation courte
VALIDATE_LONG_1_B1Lite1           validation longue, jeu de donnes 1 (sur 4)
VALIDATE_LONG_5_DistOracle1Root   validation longue, jeu de donnes 5 (une deuxième série)
VALIDATE_BANC_@_Tree-10c-4r       banc de similitude
VALIDATE_CORE_@_NoConnector       cœur contre cœur
```

Une série de plus de 9 duels numérote sur deux chiffres, pour garder la colonne fixe :
`VALIDATE_LONG_01_RootHalving-Tree-5r` à `VALIDATE_LONG_12_RootHalving-Tree-5r`.

**Les lettres des noms d'arbre** (Sami, 06/10) : `c` les candidats à la racine (`candidates`),
`w` les réponses par étage (`widen`), `d` la profondeur (`depth`) : `Tree-10c-4w`, `Tree-5w`,
`RootHalving-Tree-2w-6d`. Les jobs lancés avant le 06/10 au matin gardent l'ancien `r` (pour
réponses) : `VALIDATE_LONG_01_RootHalving-Tree-5r`, `VALIDATE_LONG_1_Tree-5r`.

Les autres jobs (construire des positions de l'oracle, mesurer, régler) n'ont pas à suivre ces
largeurs ; seuls les jobs lancés en groupe gardent le même gabarit.

## La file et les réveils

- **La file** (le backlog, `data/backlog.json`) : les jobs joués l'un après l'autre par
  `npm run backlog` ; le lanceur relit la file avant chaque job, on peut en ajouter pendant qu'il
  tourne.
- **Un réveil** : une tâche programmée dans la session de Claude (elle meurt si la console se
  ferme) qui lit les résultats à l'heure prévue, met à jour les docs et le changelog, et fait le
  point.
- **Les fils** : le nombre de calculs en parallèle. Par défaut (Sami, 07/10), tous les fils de la
  machine moins 3, 18 au plus, la moitié jusqu'à 6 fils : 18 sur les 24 du PC fixe, 5 sur les 8
  du portable, jour et nuit. `--threads N` ou `LOPIN_THREADS=N` en force N, `max` les prend tous
  moins un (pour aller plus vite, ou sur un serveur). Plus de pause de 15 min entre deux jobs. Le
  nombre de fils découpe certains calculs (`selfplay`, `distill`, les vagues d'un duel) : deux
  mesures se comparent à nombre de fils égal.
