# Bornage — les règles pour un agent

Bornage est Schotten Totten joué avec un jeu de cartes ordinaire. Tu joues contre un robot
(l'Expérimental 1.2) dans la console : tu lis la position, tu choisis un coup parmi `legal`.

## Le matériel

- **42 cartes** : les valeurs 1 à 10 dans 4 couleurs (♠ ♥ ♣ ♦), et **2 jokers** (`JK`).
- **7 bornes** entre les deux joueurs, numérotées 1 à 7 de gauche à droite.
- Chaque joueur a **6 cartes en main** ; le reste fait la pioche (30 cartes au départ).

## Un tour

1. Tu poses **une carte** de ta main sur **ton côté** d'une borne (3 cartes au plus par côté).
2. Tu **pioches** une carte si la pioche n'est pas vide (la console le fait pour toi).
3. Pioche vide : on joue sans piocher ; sans coup possible, on passe (`p`).

## Qui gagne une borne

Quand les deux côtés ont 3 cartes, la meilleure combinaison gagne. De la plus forte à la plus
faible :

| Combinaison | Exemple |
| --- | --- |
| **Suite couleur** : 3 valeurs qui se suivent, même couleur | 4♥ 5♥ 6♥ |
| **Brelan** : 3 fois la même valeur | 7♠ 7♦ 7♣ |
| **Couleur** : 3 cartes de même couleur | 2♣ 6♣ 9♣ |
| **Suite** : 3 valeurs qui se suivent | 8♦ 9♠ 10♥ |
| **Somme** : n'importe quoi | 1♠ 5♦ 9♥ |

- À combinaison égale, **la plus forte somme** gagne ; à somme égale, **celui qui a complété son
  côté le premier**.
- Une suite ne boucle pas : 9-10-1 n'est pas une suite.
- **Le joker** remplace n'importe quelle valeur, mais **n'a pas de couleur** : il fait un Brelan
  ou une Suite, jamais une Couleur ni une Suite couleur. On peut en poser jusqu'à 3 sur un côté.

## La revendication (automatique)

- Une borne est **revendiquée** dès que le côté complet d'un joueur ne peut plus être battu,
  quelles que soient les cartes encore hors de la table (la pioche, et les deux mains : ta main
  compte comme si l'adversaire pouvait l'avoir). La console le fait seule, après chaque coup.
- Après un coup, **celui qui vient de jouer revendique en premier**, puis l'autre.
- Une borne revendiquée est fermée : plus personne n'y pose de carte.

## La victoire

- **3 bornes voisines** (par exemple 2-3-4), ou **4 bornes** en tout.
- La partie s'arrête à la **première** victoire, même si l'autre aurait pu revendiquer aussi.

## Lire la position

L'écran (`board` dans le JSON) :

```
Tour 21 · pioche 10 · main du robot 6 · bornes : toi 1, robot 0
Après ton coup : tu revendiques la borne 5 · Expérimental : 3♥ → borne 7
Vues : ♠ 7/10 · ♥ 7/10 · ♣ 4/10 · ♦ 7/10 · JK 1/2

5♥        3♦                  3♥        ← la 2e carte du robot sur ses bornes
4♥   10♠  4♦   8♣   5♠   2♣   3♠        ← sa 1re carte
1-   2-   3-   4-   5A   6-   7-        ← les bornes : - libre, A à toi, B au robot,
7♥        6♠        8♦        1♣        ← ta 1re carte (= : pleine, pas encore revendiquée)
8♥        7♠        7♦        1♦        ← ta 2e carte
                    9♦        1♠        ← ta 3e carte

Main : 1:2♠  2:2♥  3:10♥  4:4♣  5:10♦  6:JK
```

- **Vues** : pour chaque couleur, les cartes que tu vois (le plateau et ta main) sur 10. Ce qui
  manque est dans la pioche ou dans la main du robot : c'est ce qui peut encore sortir.
- Le JSON donne aussi `hand` (numéros 1-6), `borders` (`mine`, `theirs`, `won`), `seen`, et
  **`legal`** : tous les coups permis, écrits comme il faut les taper (`"3 5"` = ta 3e carte sur la
  borne 5). Les numéros de la main changent quand une carte arrive : relis `hand` à chaque tour.

## Conseils (ce qui fait gagner les robots et Sami)

- **Compte les cartes** avant de viser une combinaison : pour finir 4♥ 5♥ il faut 3♥ ou 6♥ ;
  regarde dans `Vues` et sur la table s'ils sont encore dehors.
- **Ne sépare pas une paire de même couleur** qui se suit (8♠ 9♠) : c'est une Suite couleur en
  puissance, la meilleure combinaison. Pose-les sur la même borne.
- **N'ouvre pas deux bornes avec la même valeur** (deux 7 seuls) : elles veulent les mêmes cartes,
  l'une ratera son Brelan.
- **Le milieu (bornes 3-4-5)** compte plus : chaque suite de 3 bornes voisines passe par lui. Ouvre
  le milieu avec un bon départ (une paire, deux cartes qui se suivent de même couleur).
- **Garde le joker** pour finir un Brelan ou une Suite qui gagne ; le poser tôt le gaspille.
- **Complète tôt une borne disputée** : à combinaison et somme égales, le premier complet gagne.
- **Vise la double menace** (comme au Puissance 4) : avec deux bornes voisines gagnées (3 et 4),
  chacune des bornes autour (2 et 5) donne la victoire ; le robot ne peut pas tenir les deux.

## Pièges à éviter

- **Jeter une carte sur une borne déjà perdue** : elle ne sert plus à rien ; une carte faible y
  est au mieux une défausse, pas un coup.
- **Compléter un côté qui perd d'avance** contre un côté adverse plein : regarde d'abord ce qui
  peut encore le battre.
- **Laisser passer une borne décisive** : quand le robot a deux bornes voisines, la borne qui
  ferait trois est à défendre en premier.
- **Oublier que le joker n'a pas de couleur** : JK + 4♥ + 5♥ est une Suite, pas une Suite couleur.
- **Lire autre chose que la sortie de la commande** : le fichier de partie contient l'ordre de la
  pioche ; le lire serait tricher, et la partie ne vaudrait plus rien pour l'analyse.
