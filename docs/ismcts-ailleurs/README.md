# L'ISMCTS ailleurs que dans Bornage

Réponse au prompt de Sami du 21/10 (`docs/Prompt/Application rélles ISMCTS.md`) : peut-on reprendre
l'algorithme des robots de Bornage pour **la file de jobs** (la backlog) et pour **les trajets de robots
dans un entrepôt**, et ailleurs ? Ce dossier explique, corrige le schéma proposé et donne des exemples. Il
ne contient pas de code.

| Fichier | Ce qu'il traite |
|---|---|
| `README.md` (ici) | l'algorithme avec les mots du jeu, MCTS / ISMCTS / POMCP, ce que la 1.3 a appris, les dépôts |
| [`backlog.md`](backlog.md) | la nuit de jobs vue comme une partie, avec les chiffres d'octobre |
| [`entrepot.md`](entrepot.md) | les robots d'entrepôt : quelles actions, où est l'incertitude, A* et MCTS ensemble |
| [`autres-usages.md`](autres-usages.md) | d'autres usages réels, larges, et quand une autre méthode fait mieux |

## 1. Ce que fait l'ISMCTS, avec les mots de Bornage

Le détail pas à pas est dans `docs/glossaire.md`, section « Comment le robot choisit un coup ». En
résumé, pour choisir **un** coup :

| Brique | Dans Bornage | En général |
|---|---|---|
| **L'ensemble d'information** | ce que le joueur voit : sa main, les bornes, le nombre de cartes en pioche | tout ce qu'on sait au moment de décider |
| **La déterminisation** (le tirage) | `determinize` distribue au hasard la main adverse et la pioche | on tire **un monde possible** compatible avec ce qu'on sait |
| **La liste courte** | le cœur garde 8 candidats à la racine, 3 réponses par étage | une règle rapide propose quelques coups ; l'arbre ne regarde qu'eux |
| **La descente** | UCB choisit un coup par étage, 5 étages au plus | on équilibre « a souvent marché » et « peu essayé » |
| **La simulation** | le cœur joue la partie jusqu'au bout pour les deux joueurs | une politique simple joue jusqu'à la fin, dans le monde tiré |
| **Le retour** | gagné ou perdu, compté sur chaque coup du chemin | la récompense remonte le chemin |
| **Le budget** | 2 000 itérations par coup | autant de mondes tirés qu'on a de temps |
| **Le coup joué** | le candidat le plus visité ; puis l'adversaire répond, et on recommence | on n'exécute que **la première décision**, on observe, on recherche à nouveau |

La dernière ligne compte le plus pour les usages hors jeu : l'ISMCTS **ne produit pas un plan pour toute
la nuit**. Il choisit l'action d'aujourd'hui en ayant regardé beaucoup d'avenirs possibles, puis il
attend de voir ce qui se passe avant de choisir la suivante.

**Ce que l'arbre partage.** Le « IS » d'ISMCTS : les nœuds de l'arbre sont rangés par **ce que le
joueur peut observer**, pas par le monde tiré. Deux itérations qui ont tiré deux mains adverses
différentes, mais qui ont joué les mêmes coups publics, passent par les mêmes nœuds. C'est ce qui évite
la **fusion de stratégies**, déjà vue au § 12 de `docs/priorites-1.3.md` : un plan qui « sait » ce qu'il
ne peut pas encore savoir, parce qu'on l'a jugé monde par monde (le PIMC, qui prête au joueur la vue des
cartes).

## 2. MCTS, ISMCTS ou POMCP : lequel pour quel problème

Trois cousins, tous fondés sur des simulations :

| Famille | Quand | Exemple |
|---|---|---|
| **MCTS** | tout est visible, seul le hasard reste (dés, durées, pannes) | backgammon ; une file de jobs dont on connaît tout sauf les durées |
| **ISMCTS** | **un autre joueur** cache quelque chose, et il agit lui aussi | Bornage, les jeux de cartes, un adversaire qui patrouille |
| **POMCP** | **on est seul**, mais l'état du monde est caché et se révèle peu à peu | un robot qui ne sait pas quelles allées sont bloquées avant d'y arriver |

Les deux cas de Sami sont surtout du **« seul contre le hasard »** : personne n'y cache de cartes
exprès. La technique du tirage s'y transpose telle quelle : on tire un **scénario** (les durées des
jobs, les allées bloquées) au lieu d'une donne. La précaution de l'ISMCTS aussi : ranger l'arbre par ce
qu'on aura observé, pour ne pas planifier comme si on connaissait déjà le scénario.

## 3. Ce que la 1.3 a appris, et qui vaut partout

Les essais des 19-21/10 (`docs/priorites-1.3.md` § 7, 11 et 12) donnent quatre leçons qui ne dépendent
pas du jeu :

1. **Une meilleure estimation ne fait pas un meilleur choix.** Les variantes joker ont ramené l'erreur
   d'estimation de +3,6 à +0,7 point sans gagner un seul point en duel. Ce qui compte, c'est que la
   recherche **range les actions dans le bon ordre**, pas que la valeur affichée soit juste.
2. **Plus d'itérations ne corrigent pas une politique de simulation biaisée.** Dans 95 % des coups
   manqués en fin de partie, le mauvais coup avait le meilleur taux de l'arbre. Le biais vient de la
   politique qui joue les simulations. Hors jeu, la politique de simulation est **le modèle du monde** :
   s'il se trompe sur les durées ou les pannes, l'arbre se trompera avec assurance.
3. **Un tri rapide élimine, il ne valide pas.** Un essai court qui semble gagner doit être confirmé sur
   des données neuves (la règle du 03/10).
4. **D'abord le simulateur et des règles simples de référence.** Sans simulateur fidèle, impossible de
   savoir si l'algorithme bat la règle « bête ». Dans Bornage, c'est le moteur de règles et le cœur ; hors
   jeu, c'est le premier chantier, et souvent le plus long.

## 4. Les dépôts git

Les questions de Sami : un autre dépôt pour la backlog ? pour l'entrepôt ?

- **La backlog : commencer ici.** Le lanceur (`scripts/backlog.js`), la file (`data/backlog.json`) et
  tout l'historique (`data/backlog-done/`) sont dans ce dépôt ; le planificateur doit les lire. Un
  dossier `scripts/backlog-planner/` suffit, avec une règle : **son noyau MCTS n'importe rien de
  Bornage** (ni `src/sim`, ni le cœur). Le jour où un deuxième usage arrive (une renderfarm, des tickets),
  ce noyau part dans son propre dépôt sans rien réécrire.
- **L'entrepôt : un dépôt à part dès le départ.** Rien du jeu ne s'y réutilise tel quel : `src/sim/mcts`
  est lié au cœur, à `determinize` et aux règles de Bornage. Ce qui se reprend, ce sont **les idées**
  (le tirage, la liste courte par une règle rapide, la politique de simulation, le budget, le choix du
  plus visité) et la méthode de mesure (tri, puis validation sur données neuves).

## Références

Toutes vérifiées le 22/10.

- Cowling, Powley et Whitehouse, « Information Set Monte Carlo Tree Search », *IEEE Transactions on
  Computational Intelligence and AI in Games*, 2012, p. 120-143 : l'article qui définit l'ISMCTS.
- Browne et al., « A Survey of Monte Carlo Tree Search Methods », même revue, 4 (1), 2012, p. 1-43 : la
  vue d'ensemble du MCTS.
- Silver et Veness, « Monte-Carlo Planning in Large POMDPs », NIPS 2010 : le POMCP, testé entre autres
  sur la bataille navale 10 × 10.
