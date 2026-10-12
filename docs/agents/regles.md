# Bornage — les règles pour un agent

Bornage est Schotten Totten joué avec un jeu de cartes ordinaire. Tu joues contre un robot
(l'Expérimental 1.2) dans la console : tu lis la position, tu choisis un coup parmi `moves`.

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
- **Un côté complet n'est donc pas revendiqué tout de suite** tant que l'adversaire peut encore
  faire mieux avec des cartes hors de la table, même si son côté est vide : ta Suite couleur
  7-8-9♥ attend tant qu'une Suite couleur plus haute (8-9-10 d'une autre couleur, par exemple)
  reste possible. Elle tombe dès que les cartes qui la battraient sont posées ailleurs.
- Après un coup, **celui qui vient de jouer revendique en premier**, puis l'autre.
- Une borne revendiquée est fermée : plus personne n'y pose de carte.

## La victoire

- **3 bornes voisines** (par exemple 2-3-4), ou **4 bornes** en tout.
- La partie s'arrête à la **première** victoire, même si l'autre aurait pu revendiquer aussi.

## Ce que tu reçois : une ligne JSON par commande

Chaque commande (`--new`, puis `--step`) répond **une ligne JSON** avec `--machine --compact`. Voici
une vraie réponse, au tour 13 (la ligne est unique ; les retours à la ligne ne sont là que pour la
lecture, et `\n` est un saut de ligne dans `board`) :

```json
{
 "board": "Tour 13 · pioche 18 · main du robot 6 · bornes : toi 0, robot 0\nToi : 1♥ → borne 3 · Expérimental : 2♦ → borne 4\nVues : ♠ 2/10 · ♥ 5/10 · ♣ 5/10 · ♦ 5/10 · JK 1/2\n\n\n               2♦             3♣\n8♦        7♠   3♦             1♣\n1-   2-   3-   4-   5-   6-   7-\n          2♠   9♥   4♦   4♣\n          1♥   6♥\n\n\nMain : 1:5♥  2:10♥  3:2♣  4:10♣  5:7♦  6:JK",
 "moves": ["JK 1","JK 2","JK 3","JK 4","JK 5","JK 6","JK 7","10♥ 1","10♥ 2","10♥ 3","10♥ 4","10♥ 5","10♥ 6","10♥ 7","5♥ 1","5♥ 2","5♥ 3","5♥ 4","5♥ 5","5♥ 6","5♥ 7","2♣ 1","2♣ 2","2♣ 3","2♣ 4","2♣ 5","2♣ 6","2♣ 7","7♦ 1","7♦ 2","7♦ 3","7♦ 4","7♦ 5","7♦ 6","7♦ 7","10♣ 1","10♣ 2","10♣ 3","10♣ 4","10♣ 5","10♣ 6","10♣ 7"],
 "over": false
}
```

| Champ | Contenu |
| --- | --- |
| `board` | **L'écran, en texte** : tout ce que tu sais de la partie (voir plus bas). |
| `moves` | **Tous les coups permis**, chacun écrit comme tu dois le rendre : « carte borne ». |
| `over` | `false` tant que la partie continue. |
| `end`, `replay` | Seulement quand `over` est `true` : le résultat en une phrase, et le chemin du replay. |
| `error` | Seulement quand ton coup est refusé : la raison. La partie n'a pas avancé, rejoue. |
| `rules` | Seulement à la toute première réponse : les règles en une ligne. |

Sans `--compact`, la réponse ajoute les mêmes faits en champs (`turn`, `pile`, `opponentHand`,
`hand`, `borders`, `seen`, `last`, `winner`) : c'est `board` découpé, pour un programme. Un agent n'en
a pas besoin.

**Ce que tu ne reçois pas** : la main du robot et la pioche (cachées, comme à la table) ; l'historique
des tours (l'écran montre ce qui est posé, et l'échange qui vient d'avoir lieu — pas plus).

### Lire `board`

Le même `board`, mis en page, avec ce que chaque ligne veut dire :

```
Tour 13 · pioche 18 · main du robot 6 · bornes : toi 0, robot 0     ← le tour, les cartes de la pioche, les bornes revendiquées
Toi : 1♥ → borne 3 · Expérimental : 2♦ → borne 4                    ← ton dernier coup, la réponse du robot (et les revendications)
Vues : ♠ 2/10 · ♥ 5/10 · ♣ 5/10 · ♦ 5/10 · JK 1/2                  ← les cartes que tu as vues, par couleur


               2♦             3♣       ← la 2e carte du robot sur chaque borne
8♦        7♠   3♦             1♣       ← sa 1re carte, la plus proche des bornes
1-   2-   3-   4-   5-   6-   7-       ← les bornes : - libre, A à toi, B au robot, = pleine non revendiquée
          2♠   9♥   4♦   4♣            ← ta 1re carte
          1♥   6♥                      ← ta 2e carte (et la 3e dessous, quand il y en a une)


Main : 1:5♥  2:10♥  3:2♣  4:10♣  5:7♦  6:JK
```

- **Vues** : pour chaque couleur, les cartes que tu vois (le plateau et ta main) sur 10. Ce qui
  manque est dans la pioche ou dans la main du robot : c'est ce qui peut encore sortir.
- **Un coup s'écrit « carte borne »**, recopié de `moves` : `"4♦ 3"` = le 4♦ sur la borne 3 (`"JK 3"`
  pour un joker). N'utilise pas les numéros de la main (`1:`, `2:` sur la ligne `Main`) : ils
  changent à chaque pioche. La ligne « Toi : 4♦ → borne 3 » en tête de l'écran confirme le coup
  joué ; elle dit aussi qui revendique quoi (« tu revendiques la borne 5 »).

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

## La fin de pioche

- Une fois la pioche vide, on ne pioche plus : chaque carte posée est une carte de moins en
  main, et il faut poser à chaque tour tant qu'un coup existe (on ne passe que sans coup).
- Les dernières cartes doivent aller **quelque part** : garde une place libre (un côté pas plein)
  pour tes cartes faibles, sur une borne déjà perdue ou sans enjeu, plutôt que d'être forcé de
  gâcher une borne disputée.
- Compte ce qui reste : avec la pioche vide, toutes les cartes sont connues sauf la main du robot
  (ce qui manque dans `Vues`).

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
