# D'autres usages, dans la vie réelle

Sami demande d'autres applications, larges, pas seulement industrielles. La liste ci-dessous dit pour
chacune ce qui est caché ou aléatoire, ce qu'on décide, et **si le MCTS y sert vraiment ou si une autre
méthode fait mieux**. En industrie, la planification passe surtout par la programmation linéaire en
nombres entiers (MILP) et la programmation par contraintes (par exemple CP-SAT), et de plus en plus par
l'apprentissage par renforcement. Le MCTS y est une option parmi d'autres, pas la règle.

## 1. Le critère d'abord

Le MCTS, et l'ISMCTS pour l'information cachée, est à sa place quand **les quatre conditions** sont
réunies :
1. **on a un simulateur** : on sait jouer « ce qui se passerait si », même grossièrement ;
2. **les décisions s'enchaînent** : on agit, on observe, on agit à nouveau ;
3. **l'incertitude se révèle au fil de l'eau** : on en sait plus après chaque action ;
4. **il n'y a pas de bon modèle fermé** : pas d'équation ni de solveur qui donne directement la
   réponse.

Il est moins indiqué :
- pour une **décision unique** avec un modèle précis : un solveur d'optimisation la résout mieux ;
- pour des **millions de décisions répétées** avec beaucoup de données : une politique apprise coûte
  moins cher à l'usage ;
- quand **une erreur est grave** et qu'aucune validation indépendante n'est possible : le MCTS se trompe
  avec assurance si son simulateur se trompe (la leçon du § 12 de `docs/priorites-1.3.md`).

## 2. Les usages

| Domaine | Ce qui est caché ou aléatoire | Ce qu'on décide | Le MCTS y sert-il ? |
|---|---|---|---|
| **Jeux de cartes et de société** (tarot, belote, bridge, Hanabi, Scotland Yard) | les mains des autres ; dans Hanabi, sa propre main | le coup | **Oui, c'est le domaine d'origine de l'ISMCTS** (Cowling et al. 2012). Bornage en est un exemple complet. |
| **Tester l'équilibre d'un jeu** | les donnes | rien en direct : on fait jouer des bots pour mesurer | **Oui, et ce projet le fait** : l'équilibre de l'extension (`npm run extension`), les compensations de siège (`docs/sieges.md`). Un usage large, des jeux de société aux jeux vidéo. |
| **IA de jeux vidéo avec brouillard de guerre** | ce que l'adversaire prépare | les ordres des unités | Oui en recherche, et dans certains jeux ; souvent combiné à des règles écrites à la main. |
| **Patrouille, sécurité** (gardes-forestiers contre braconniers, contrôles) | où l'adversaire frappera | le trajet des patrouilles | Rarement : ce domaine utilise surtout la théorie des jeux (les jeux de sécurité de Stackelberg). L'ISMCTS est pertinent quand la patrouille réagit à ce qu'elle observe en route. |
| **Recherche et sauvetage, catastrophe** | où sont les victimes ; quelles routes sont coupées | où envoyer les drones et les équipes, et dans quel ordre | En recherche. C'est un POMDP typique (`README.md` § 2) : le POMCP est taillé pour ça. Les routes coupées découvertes en route sont le voyageur canadien de `entrepot.md`. |
| **Évacuation** | l'état des routes, la foule | quelles sorties ouvrir, quels itinéraires annoncer | Surtout des modèles de flux et des simulations de foule ; le MCTS au-dessus, en recherche. |
| **Énergie à la maison** (batterie, panneaux solaires, voiture électrique) | le soleil, la consommation, les prix de demain | charger, vendre ou attendre, heure par heure | Possible ; le métier utilise surtout la commande prédictive avec des scénarios, qui est très proche d'un tirage de scénarios sans arbre. |
| **Agriculture** | la météo | irriguer, traiter, récolter maintenant ou attendre | En recherche ; dans les faits, des règles et des prévisions. |
| **Voyage avec correspondances** | les retards, les annulations | rester dans ce train ou changer, réserver une alternative | Un bon terrain : décisions en série, incertitude révélée en route. Les applications de trajet calculent surtout des itinéraires fixes. |
| **Éducation** | le niveau réel de l'élève | l'exercice suivant | Un POMDP ; dans les faits, des modèles de réponse aux questions et des bandits. Le MCTS sert à planifier plusieurs exercices à l'avance. |
| **Négociation, enchères** | ce que l'autre est prêt à payer ou à céder | l'offre suivante | Oui en recherche : des agents de négociation par ISMCTS ou proches. |
| **Santé** (doses, ordre des examens) | la réponse du patient | la dose suivante, l'examen suivant | **En recherche seulement**, et jamais sans validation clinique. |
| **Ateliers de production** (job shop) | les durées, les pannes, les commandes urgentes | quelle opération sur quelle machine | Étudié : le MCTS gagne sur les petits problèmes, des méthodes plus simples (les « pilot methods ») sur les grands. En ligne, quand l'atelier change sans arrêt, des travaux récents l'utilisent pour décider état par état. Les solveurs (MILP, CP-SAT) dominent l'industrie. |
| **Tournées de livraison** avec demandes incertaines | quels clients appelleront, et quand | quel véhicule va où ensuite | Surtout des métaheuristiques ; le MCTS en recherche, sur la version dynamique. |
| **Backlog, renderfarm, tickets** | les durées, les échecs, les arrivées | quel job, sur quelles ressources | Voir [`backlog.md`](backlog.md) : utile quand l'échéance et les ressources se mêlent. |

## 3. Trois usages à portée de main

Si Sami veut un deuxième terrain d'essai après la backlog, trois idées concrètes, chacune avec un
simulateur facile à écrire :
1. **Un jeu de cartes connu** (belote, tarot, un jeu de plis) : tout ce que Bornage a appris se
   transpose directement ; les mains cachées sont le cas d'école de l'ISMCTS.
2. **La batterie d'une maison** : un simulateur de 50 lignes (soleil, consommation, prix heure par
   heure), une règle simple à battre (« charger quand le prix est bas »), et une incertitude qui se
   révèle d'heure en heure.
3. **Un voyage en train avec retards** : un graphe de trains, des retards tirés au hasard, et la
   décision « changer ou rester » à chaque gare. C'est le voyageur canadien à petite échelle.

## Références

Vérifiées le 22/10.

- Cowling, Powley et Whitehouse, « Information Set Monte Carlo Tree Search », *IEEE Transactions on
  Computational Intelligence and AI in Games*, 2012.
- Runarsson, Schoenauer et Sebag, « Pilot, Rollout and Monte Carlo Tree Search Methods for Job Shop
  Scheduling », arXiv 1210.0374 (2012) : le MCTS l'emporte sur les petites instances, les méthodes
  « pilot » sur les grandes.
- « DyRo-MCTS: A Robust Monte Carlo Tree Search Approach to Dynamic Job Shop Scheduling », arXiv
  2509.21902 (2025) : le MCTS en ligne, état par état.
