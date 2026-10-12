# Bornage — les règles pour un agent

Bornage est Schotten Totten joué avec un jeu de cartes ordinaire. Tu joues contre un robot
(l'Expérimental 1.2) dans la console : tu lis la position (un JSON), tu choisis une carte de `main` et une borne de `bornes_jouables`.

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

## Ce que tu reçois : un JSON par commande

Chaque commande (`--new`, puis `--step`) répond **un objet JSON** avec `--json` : les données
nommées et groupées, aucun plateau dessiné dans un texte. Voici une vraie réponse, au tour 3 (tu as
posé le 9♥ sur la borne 4, le robot a répondu par un 3♦ sur la même borne) :

```json
{
 "tour": 3,
 "pioche": 28,
 "main_robot": 6,
 "bornes_gagnees": {"toi":0,"robot":0},
 "cartes_vues": {"♠":"1/10","♥":"3/10","♣":"1/10","♦":"2/10","JK":"1/2"},
 "dernier_echange": {"toi":"9♥ → borne 4","robot":"3♦ → borne 4"},
 "bornes": [
  {"borne":1,"toi":[],"robot":[],"statut":"libre"},
  {"borne":2,"toi":[],"robot":[],"statut":"libre"},
  {"borne":3,"toi":[],"robot":[],"statut":"libre"},
  {"borne":4,"toi":["9♥"],"robot":["3♦"],"statut":"libre"},
  {"borne":5,"toi":[],"robot":[],"statut":"libre"},
  {"borne":6,"toi":[],"robot":[],"statut":"libre"},
  {"borne":7,"toi":[],"robot":[],"statut":"libre"}
 ],
 "main": ["2♠","1♥","6♥","4♣","4♦","JK"],
 "bornes_jouables": [1,2,3,4,5,6,7],
 "terminee": false
}
```

Pour répondre, une carte de `main` et une borne de `bornes_jouables` : `2♠ 3` pose le 2♠ sur la
borne 3. Plus loin dans la partie, `bornes_jouables` se réduit (`[1,3,6]` : les autres bornes sont
gagnées, perdues, ou ton côté y a déjà 3 cartes) ; vide, tu passes avec `p`.

| Champ | Contenu |
| --- | --- |
| `tour` | Le numéro du tour (les deux joueurs comptés : toi 1, 3, 5…, ou 2, 4, 6… si le robot commence). |
| `pioche` | Les cartes qui restent dans la pioche. |
| `main_robot` | Le nombre de cartes dans la main du robot (tu ne vois pas lesquelles). |
| `bornes_gagnees` | Les bornes déjà revendiquées par toi et par le robot. |
| `cartes_vues` | Par couleur, les cartes que tu vois (le plateau et ta main) sur le total : `"5/10"`. Ce qui manque est dans la pioche ou dans la main du robot, donc peut encore sortir. |
| `dernier_echange` | Ce qui vient de se passer : `toi` (ton dernier coup), `robot` (sa réponse), et `revendications` (« tu revendiques la borne 5 », « le robot revendique la borne 4 ») seulement s'il y en a. Vide au début ; sans `robot` si ton coup a fini la partie. |
| `bornes` | Les 7 bornes, de 1 à 7. `toi` et `robot` : les cartes de chaque côté, **dans l'ordre où elles ont été posées**. |
| `bornes[].statut` | `libre` : pas revendiquée ; `gagnée` : à toi ; `perdue` : au robot ; `pleine` : les deux côtés ont 3 cartes et personne ne peut encore la revendiquer (plus rien à y poser). |
| `main` | Tes cartes. |
| `bornes_jouables` | **Les bornes où tu peux poser une carte** : n'importe quelle carte de `main` va sur n'importe laquelle. Vide : tu dois passer (joue `p`). |
| `terminee` | `false` tant que la partie continue. |
| `resultat`, `replay` | Seulement quand `terminee` est `true` : le résultat en une phrase, et le chemin du replay. |
| `erreur` | Seulement quand ton coup est refusé : la raison. La partie n'a pas avancé, rejoue. |
| `regles` | Seulement à la toute première réponse : les règles en une ligne, et un exemple de réponse. |

**Un coup s'écrit « carte borne »** : `"4♦ 3"` = le 4♦ sur la borne 3 (`"JK 3"` pour un joker). La
carte est nommée, pas numérotée : sa position dans `main` change à chaque pioche. `dernier_echange`
confirme le coup joué.

**Ce que tu ne reçois pas** : la main du robot et la pioche (cachées, comme à la table) ; l'historique
des tours (`bornes` montre ce qui est posé, et `dernier_echange` l'échange qui vient d'avoir lieu — pas plus).

## Conseils (ce qui fait gagner les robots et Sami)

- **Compte les cartes** avant de viser une combinaison : pour finir 4♥ 5♥ il faut 3♥ ou 6♥ ;
  regarde dans `cartes_vues` et sur les `bornes` s'ils sont encore dehors.
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
  (ce qui manque dans `cartes_vues`).

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
