# Méthode, hypothèses et limites

Ce document explique d'où sortent les chiffres de `out/deck-options.md` et de
`out/deck-options.html`, et ce qu'ils ne disent pas. Tout se recalcule avec
`npm run build` (environ 1 min 20 sur 18 fils, graine fixe : même résultat à chaque fois).

## Les paquets comparés

| Paquet | Cartes | Bornes | Jokers |
|---|---|---|---|
| Original | 6 couleurs × 1-9 = 54 | 9 (victoire : 5, ou 3 côte à côte) | aucun |
| Rapide | 6 couleurs × 1-7 = 42 | 7 (victoire : 4, ou 3 côte à côte) | aucun |
| Classique | 4 couleurs × 1-10 + 2 jokers = 42 | 7 | 2 |
| Tarot | 5 couleurs × 1-8 + 2 atouts libres = 42 | 7 | 2 |

Deux témoins sans joker (4 × 10 et 5 × 8, 40 cartes) isolent l'effet des jokers
dans les calculs exacts. Ils ne sont pas simulés : 40 cartes ne remplissent pas
42 places. Main de 6 cartes partout.

Les règles de joker comparées :

- **libre** : le joker devient n'importe quelle carte, même une carte déjà posée ;
- **1 par borne** : jamais deux jokers du même côté d'une borne ;
- **1 par joueur** : un seul joker posé par joueur sur toute la partie ;
- **sans couleur** : le joker prend n'importe quelle valeur mais aucune couleur,
  donc il ne compte jamais pour une Couleur ni pour une Suite couleur.

Dans tous les cas, la valeur du joker est choisie au moment de régler la borne, au
mieux pour son camp : la meilleure combinaison, puis la plus grosse somme.

## Premier angle : les mains de 3 cartes

Toutes les mains de 3 cartes du paquet sont énumérées (11 480 pour 42 cartes,
24 804 pour l'original). Chaque main est classée dans sa meilleure combinaison.
Avec des jokers, « meilleure » dépend de l'ordre des combinaisons : l'ordre est
donc un paramètre du calcul, pas une constante.

Pour les paquets sans joker, les tests vérifient les comptes par une seconde
méthode, avec des formules fermées. Par exemple, Suite couleur = couleurs ×
(valeurs − 2).

**Le paradoxe des jokers.** Classer par rareté suppose que la rareté ne dépende pas
du classement. Avec des cartes libres, c'est faux : en 4 couleurs, la Suite
couleur (208 mains) est plus courante que le Brelan (160). Si on les échange, les
mains à 2 jokers deviennent des Brelans (200 contre 168), et l'inversion revient.
C'est le paradoxe décrit par Steve Gadbois (*Poker with Wild Cards — A Paradox?*,
Mathematics Magazine, 1996).

## Deuxième angle : la main de départ

200 000 mains de 6 cartes tirées au hasard par paquet et par règle de joker. On
compte la part des mains qui contiennent déjà chaque combinaison complète.
Contrairement au premier angle, ce n'est pas exclusif : une Suite couleur compte
aussi comme Couleur et comme Suite. Précision : environ ±0,2 point.

## Troisième angle : les cartes qui complètent

Pour une amorce typique de deux cartes (une paire, deux cartes qui se suivent…),
on compte les cartes du reste du paquet qui terminent la combinaison. C'est un
calcul exact sur une amorce représentative, en milieu de gamme.

## Quatrième angle : les parties simulées

Un moteur joue les règles complètes : pose, pioche, règlement d'une borne quand
les deux côtés ont 3 cartes, départage par la somme puis par celui qui a fini le
premier, victoire à la majorité ou à 3 bornes côte à côte.

Trois robots :

- **au hasard** : n'importe quelle carte, n'importe où. Il sert de contrôle : entre
  deux robots au hasard, les fréquences retombent sur les calculs exacts ;
- **gourmand** : pour chaque coup possible, il estime ce que la ligne deviendra
  (cartes en main certaines, cartes non vues pondérées par la chance de les
  piocher) et joue le coup qui augmente le plus sa chance de gagner la borne, face à
  ce que l'adversaire construit ;
- **stratège** : le gourmand plus les trois habitudes de Sami, relevées pendant ses
  parties réelles. Le joker attend une paire pour faire un Brelan. Les colonnes
  s'ouvrent avec des cartes du milieu, une couleur à la fois. Deux cartes qui se
  suivent dans la même couleur passent avant une paire, tant que la Suite couleur
  reste possible. Depuis la version 1.1, il suit aussi deux idées tirées des
  parties de Sami contre les robots (`docs/analyse-replays.md`) : les trois bornes
  du milieu seulement pour un départ solide, et jamais la même valeur seule sur
  deux bornes. Depuis la version 1.2, une troisième : ne jamais séparer deux cartes
  de même couleur qui se suivent (`docs/strategie.md`).

Avec ses trois habitudes, le stratège battait le gourmand dans environ 58 % des
parties (4 000 parties, des deux côtés de la table), et chaque habitude seule le
rend déjà meilleur. Les deux idées de la version 1.1 le portent à environ 65 %, la
troisième (1.2) à environ 69 %.
**C'est lui qui joue toutes les parties du rapport.** Le Stratège 2.1 du
navigateur part de lui et rejoue la fin de partie avant chaque coup. Il est plus
fort, mais bien trop lent pour le million de parties du rapport. Le gourmand rejoue les variantes du tableau
principal, pour comparer l'ancien résultat au nouveau.

2 000 parties robot stratège contre robot stratège par variante, réparties sur les
cœurs du processeur. Le résultat ne dépend pas de l'ordre de calcul.

## Cinquième angle : les parties réelles

Sami a photographié 10 parties d'essai (les photos n'ont pas été gardées).
Elles sont transcrites dans `data/irl/essais.json`, une colonne par chaîne de
caractères. Un test vérifie que chaque photo contient les 42 cartes, une fois
chacune : une carte mal lue le fait échouer.

**Son protocole.** Le paquet est coupé en deux moitiés de 21. Chaque moitié se joue
seul (main de 6, puis la pioche) sur 7 colonnes de 3, pour faire la meilleure
combinaison dans chaque colonne. La ligne du haut est jouée sans savoir ce qui
reste dans la pioche. La ligne du bas voit l'autre moitié sur la table, donc
connaît sa pioche carte par carte.

**La comparaison juste.** Les robots rejouent exactement ce protocole
(`src/sim/engine/solo.js`), 2 000 fois chacun, sans adversaire. Les chiffres de la partie
à deux ne se comparent pas directement : là, une borne déjà perdue ne vaut plus
qu'on y mette une belle carte.

**Le meilleur rangement possible.** Pour une ligne de 21 cartes, un calcul exact
(programmation dynamique sur les sous-ensembles, `src/core/partition.js`) trouve
la meilleure répartition en 7 trios. Une combinaison vaut son rang (4 pour la Suite
couleur, 0 pour la Somme) plus sa somme en fraction. C'est une borne supérieure :
en jouant carte par carte avec 6 en main, on ne l'atteint pas toujours. Toutes les
lignes réelles sont calculées, et 100 parties par robot.

Avec 140 colonnes, les parts mesurées sur les parties réelles restent
approximatives. Le rapport donne leur fourchette à 95 % (intervalle de Wilson).

**La ressemblance avec l'original.** Pour chaque variante, on mesure la part des
bornes gagnées par la 1re combinaison de l'ordre, par la 2e, etc., jusqu'à la
Somme. La ressemblance vaut 1 − la distance en variation totale avec le même
profil dans l'original : 100 % veut dire que les bornes se gagnent exactement dans
les mêmes proportions. Avec 2 000 parties (environ 30 000 bornes), le bruit
statistique est d'environ un point.

## Limites

- **Les robots ne sont pas des humains.** Ils ne bluffent pas, ne se souviennent
  pas de tout et ne regardent pas plus loin que le coup en cours. Ils poursuivent
  les combinaisons que l'ordre récompense. C'est pourquoi les parties servent à
  comparer des variantes entre elles, pas à classer les combinaisons dans l'absolu.
- **Pas de revendication anticipée.** Dans le vrai jeu, on peut prendre une borne
  dès qu'on prouve que l'adversaire ne peut plus gagner. La simulation attend que
  les deux côtés soient complets. Cela change le moment où l'on gagne une borne,
  peu les combinaisons que l'on construit.
- **Le second joueur gagne un peu plus souvent** (entre 51 et 57 %) dans les
  variantes du tableau, original compris. C'est vraisemblablement un effet du jeu,
  ou des robots, et pas des cartes. À vérifier autour d'une vraie table.
- **Le classement des variantes dépend un peu du robot.** Avec le gourmand, le
  tarot sortait devant (95 %) ; avec le stratège, c'est le 4 couleurs avec joker sans
  couleur (95 %), et le tarot recule (86 %). La conclusion sur le 4 couleurs ne
  change pas : c'est la règle du joker sans couleur qui le rend fidèle.
- **Le joker peut copier une carte déjà posée.** Cela ne change aucun compte de
  combinaison, seulement quelques sommes.

## Changer une règle et tout recalculer

- Paquets, bornes, main, victoire : `src/config/decks.js`.
- Ordres testés : `src/config/formations.js`.
- Variantes simulées et tailles d'échantillons : `src/config/simulations.js`.

Ensuite `npm run build`. Si les nouveaux chiffres ne soutiennent plus le verdict
écrit dans les rapports, le build s'arrête et dit pourquoi : le texte des rapports
est écrit autour de ce verdict (`assertNarrative` dans `src/report/analysis.js`).
