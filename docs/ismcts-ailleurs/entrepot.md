# Les robots d'entrepôt

Le schéma de Sami (prompt du 21/10) : 4 robots, chargés ou vides, font des allers-retours entre le stock et
un camion. À chaque tour, chaque robot reçoit une action : se déplacer, prendre ou déposer un colis. En fin
de partie, on compte les colis arrivés de A à B. Des liens du graphe peuvent se couper : obstacles,
bouchons.

La question centrale : **quelles sont les actions de chaque nœud ?** Haut, bas, gauche, droite dans la
grille ? La réponse courte : **pas pour le MCTS**. Les pas de grille restent l'affaire d'A*, et le MCTS
décide un étage au-dessus.

## 1. Pourquoi pas des pas de grille dans l'arbre

En théorie, oui : chaque robot a 6 actions par tour (4 directions, attendre, prendre ou déposer). Mais :
- **4 robots jouent ensemble** : 6⁴ = **1 296 actions jointes** par tour, à comparer aux 42 coups au plus
  d'une position de Lopin ;
- **une journée, ce sont des centaines de tours.** Un aller-retour sur le plan de Sami fait déjà une
  trentaine de pas ;
- **une simulation au hasard ne livre presque jamais un colis.** Des pas tirés au hasard tournent en
  rond, et la récompense reste nulle : l'arbre n'apprend rien.

Lopin marche parce que le cœur ne propose que 8 coups sensés, et que la partie finit en 35 coups. Il
faut retrouver ces deux conditions ici.

## 2. Deux étages : l'affectation et les chemins

| Étage | La question | L'outil |
|---|---|---|
| **L'affectation** | quel robot prend quelle commande, dans quel ordre ; ou attendre, ou aller se recharger | **le MCTS**, une décision chaque fois qu'**un robot se libère** (encore un événement, comme dans la backlog) |
| **Les chemins** | comment le robot va de sa case à la case visée sans heurter les autres | **A*** pour un robot ; pour plusieurs, un A* espace-temps avec une table de réservations (Cooperative A*), ou CBS quand il faut des chemins sans conflit et optimaux |

Avec ce découpage :
- **un coup** = « le robot 2 prend la commande G » : une dizaine de choix au plus, comme les candidats de
  Lopin ;
- **la liste courte** = une règle simple, « la commande la plus proche d'abord », qui joue le rôle du
  cœur ;
- **la simulation** = la même règle jusqu'à la fin de la journée, les chemins calculés par A* dans le
  monde tiré ;
- **la profondeur** = le nombre de commandes, pas le nombre de pas.

A* n'est pas remplacé : il est **la politique de déplacement** dans les simulations. Le MCTS ne
cherche que là où A* ne sait rien, c'est-à-dire **dans quel ordre servir, sachant ce qui peut arriver**.

## 3. Où est l'incertitude, et donc le tirage

Sans incertitude, l'affectation est un problème d'optimisation classique, et le MCTS n'a pas
d'avantage. Il en gagne un dès que l'avenir est incertain :
- **les allées bloquées ou ralenties** (un préparateur, une palette, un bouchon), qu'un robot ne
  découvre qu'en arrivant. Pour un seul robot, c'est le **problème du voyageur canadien** : traverser un
  graphe dont certaines routes sont peut-être coupées, en ne l'apprenant qu'à leur entrée. Eyerich,
  Keller et Helmert (AAAI 2010) y ont comparé l'hypothèse optimiste (« tout est ouvert ») à des
  politiques par UCT qui tirent des mondes possibles : celles-ci étaient nettement meilleures ;
- **les commandes qui arrivent pendant la journée** : c'est ici que la pioche de Sami existe vraiment.
  Une commande arrive comme une carte piochée, et le scénario tire aussi les arrivées ;
- les retards, la batterie, une panne.

**Une déterminisation = un scénario** : quelles allées seront bloquées et quand, quelles commandes
arriveront. Les nœuds de l'arbre sont rangés par **ce qui a été observé** : une allée vue bloquée, une
commande arrivée. Ainsi l'arbre ne planifie pas comme s'il connaissait déjà les bouchons (la fusion de
stratégies, `README.md` § 1).

**L'ISMCTS au sens propre**, avec quelqu'un qui cache quelque chose, apparaît seulement :
- si les robots **ne partagent pas leurs plans**, par exemple deux flottes de deux fabricants, ou des
  chariots conduits par des humains. Chacun devine les intentions des autres, comme l'arbre de Lopin
  devine la main adverse (et comme `+theirs` fait jouer l'adversaire par un autre cœur) ;
- face à un adversaire : la sécurité, la patrouille (`autres-usages.md`).

## 4. La récompense

**Les colis livrés de A à B avant l'heure T**, moins une pénalité pour les retards de chaque commande.
« Itinéraire fini ou non, en combien d'étapes » n'est pas le bon objectif : A* garantit déjà qu'un
chemin existant est trouvé, au plus court. Ce qui se joue, c'est l'**ordre** et la **répartition** des
commandes.

## 5. Le plan de Sami en scénario jouable

Le plan du prompt, 17 colonnes × 7 lignes. Les rayonnages `###` deviennent 12 blocs (A à L), un par
commande ; le camion `T` est au bord droit de la ligne 3 :

```
     colonne 0       8       16
l0   .................
l1   .AAA.BBB.CCC.DDD.
l2   .................
l3   .EEE.FFF.GGG.HHHT
l4   .................
l5   .III.JJJ.KKK.LLL.
l6   .................
```

**Le scénario** :
- 4 robots, tous au camion à l'heure 0 ;
- 12 commandes, une par bloc : aller jusqu'à une case libre au bord du bloc, prendre, revenir déposer
  au camion ;
- un pas par tour, prendre ou déposer coûte un tour ;
- **le couloir de la ligne 2, entre les colonnes 4 et 8, est bloqué pendant 10 tours avec une
  probabilité de 0,2**, à un moment inconnu, et un robot ne le voit qu'en y arrivant ;
- la fin à T = 120 tours ; on compte les commandes livrées.

**Une décision, pas à pas.** Au tour 37, le robot 2 revient au camion ; il reste B, F et J, et le
couloir n'a pas encore été vu bloqué.
1. **Les distances.** Depuis `T`, B, F et J sont tous à 11 cases : B par la ligne 2 (devant le bloc,
   en (2, 6)), F par la ligne 2 ou la ligne 4, J par la ligne 4. B par la ligne 0 en fait 13.
2. **La règle simple** (la plus proche d'abord, à égalité la première de la liste) envoie le robot 2
   vers B, par la ligne 2 : le chemin le plus court passe par le couloir qui peut se bloquer.
3. **Le MCTS** tire 2 000 scénarios. Dans ceux où le couloir se bloque juste avant que le robot y
   entre, il fait demi-tour et repasse par la ligne 0 : quelques tours perdus, pendant lesquels les
   autres commandes attendent.
4. Il compare, sur ces mêmes scénarios, « le 2 prend B », « le 2 prend F » et « le 2 prend J ». Il peut
   préférer F ou J : même distance, par la ligne 4 qui ne se bloque jamais. B est gardé pour un robot
   qui partira plus tard, quand on saura si le couloir est ouvert.
5. Le robot 2 part vers F. Les chemins de chaque pas, eux, viennent d'A* avec réservations.

Les chiffres de cet exemple sont à mesurer, pas à croire : c'est le rôle du simulateur.

## 6. Ce qui existe déjà dans le métier

- Le problème des chemins à plusieurs robots s'appelle le **MAPF** (*multi-agent path finding*). Les
  outils de base :
  - **Cooperative A*** (Silver, AIIDE 2005) : chaque robot planifie à son tour dans l'espace et le
    temps, en évitant les cases déjà réservées par les autres, et peut attendre sur place ;
  - **CBS** (Sharon, Stern, Felner et Sturtevant ; AAAI 2012, puis *Artificial Intelligence* 2015) : un
    arbre des conflits au-dessus d'A* par robot, optimal.
- Pour un entrepôt qui tourne sans fin, où chaque robot reçoit une nouvelle cible dès qu'il en atteint
  une, Li et al. (AAAI 2021, avec Amazon Robotics) découpent la journée en **fenêtres glissantes** :
  jusqu'à 1 000 robots en simulation. C'est la même idée que « décider, exécuter un peu, recommencer ».
- Le MCTS n'y remplace pas ces outils : il s'ajoute au-dessus, pour l'affectation sous incertitude.

## 7. Un dépôt à part, et dans quel ordre

Ce projet sort du cadre de Lopin : **un dépôt à part**, qui reprend les idées et pas le code.

1. **Un simulateur de grille** : le plan, les robots, les commandes, les blocages tirés au hasard. Pur et
   testé, comme le moteur de règles du jeu.
2. **A* et la table de réservations.**
3. **La règle simple** « la plus proche d'abord », mesurée sur quelques milliers de scénarios.
4. **Le MCTS d'affectation**, comparé à cette règle sur les mêmes scénarios ; puis avec les arrivées de
   commandes et les blocages découverts en route.

Comme pour la backlog, le simulateur est le vrai chantier. L'algorithme vient ensuite, et se juge contre
la règle simple.

## Références

Vérifiées le 22/10.

- Eyerich, Keller et Helmert, « High-Quality Policies for the Canadian Traveler's Problem », AAAI 2010,
  p. 51-58.
- Silver, « Cooperative Pathfinding », AIIDE 2005, p. 117-122.
- Sharon, Stern, Felner et Sturtevant, « Conflict-Based Search for Optimal Multi-Agent Path Finding »,
  AAAI 2012 ; version longue dans *Artificial Intelligence* 219 (2015), p. 40-66.
- Li, Tinka, Kiesel, Durham, Kumar et Koenig, « Lifelong Multi-Agent Path Finding in Large-Scale
  Warehouses », AAAI 2021, p. 11272-11281.
