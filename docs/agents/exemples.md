# Exemples : une position, le coup parfait

Quelques vraies positions, telles que tu les reçois (`INPUT`, le JSON de `--json`), avec le coup parfait (`OUTPUT`) :
celui de l'oracle (une recherche de 20 000 itérations, bien plus longue que celle du robot) ou, une fois la pioche
vide, celui que le solveur prouve gagnant. Réponds de la même façon : « carte borne ».

*Ce fichier est généré (`npm run agent-examples`) : ne le modifie pas à la main.*

## Exemple 1 — début de partie : le coup de l'oracle

INPUT :

```json
{
 "tour": 10,
 "pioche": 21,
 "main_robot": 6,
 "bornes_gagnees": {"toi":0,"robot":0},
 "cartes_vues": {"♠":"1/10","♥":"4/10","♣":"5/10","♦":"5/10","JK":"0/2"},
 "dernier_echange": {"toi":"4♦ → borne 2","robot":"8♣ → borne 7"},
 "bornes": [
  {"borne":1,"toi":["7♠"],"robot":["3♥"],"statut":"libre"},
  {"borne":2,"toi":["4♦"],"robot":["2♣"],"statut":"libre"},
  {"borne":3,"toi":[],"robot":["6♦"],"statut":"libre"},
  {"borne":4,"toi":[],"robot":[],"statut":"libre"},
  {"borne":5,"toi":[],"robot":[],"statut":"libre"},
  {"borne":6,"toi":["6♣"],"robot":["5♥"],"statut":"libre"},
  {"borne":7,"toi":["1♥"],"robot":["8♣"],"statut":"libre"}
 ],
 "main": ["8♥","9♣","10♣","3♦","5♦","8♦"],
 "bornes_jouables": [1,2,3,4,5,6,7],
 "terminee": false
}
```

OUTPUT : `3♦ 2`

## Exemple 2 — milieu de partie : le coup de l'oracle

INPUT :

```json
{
 "tour": 13,
 "pioche": 18,
 "main_robot": 6,
 "bornes_gagnees": {"toi":0,"robot":0},
 "cartes_vues": {"♠":"6/10","♥":"3/10","♣":"4/10","♦":"4/10","JK":"1/2"},
 "dernier_echange": {"toi":"1♦ → borne 7","robot":"3♦ → borne 2"},
 "bornes": [
  {"borne":1,"toi":["6♥"],"robot":[],"statut":"libre"},
  {"borne":2,"toi":["2♣"],"robot":["3♦"],"statut":"libre"},
  {"borne":3,"toi":["9♠"],"robot":["6♣"],"statut":"libre"},
  {"borne":4,"toi":["8♥"],"robot":["7♥"],"statut":"libre"},
  {"borne":5,"toi":["7♠"],"robot":["8♦"],"statut":"libre"},
  {"borne":6,"toi":[],"robot":["5♠"],"statut":"libre"},
  {"borne":7,"toi":["1♦"],"robot":["10♠"],"statut":"libre"}
 ],
 "main": ["2♠","6♠","1♣","8♣","5♦","JK"],
 "bornes_jouables": [1,2,3,4,5,6,7],
 "terminee": false
}
```

OUTPUT : `8♣ 4`

## Exemple 3 — milieu de partie : le coup de l'oracle

INPUT :

```json
{
 "tour": 16,
 "pioche": 15,
 "main_robot": 6,
 "bornes_gagnees": {"toi":0,"robot":0},
 "cartes_vues": {"♠":"6/10","♥":"4/10","♣":"7/10","♦":"3/10","JK":"1/2"},
 "dernier_echange": {"toi":"5♠ → borne 2","robot":"1♣ → borne 5"},
 "bornes": [
  {"borne":1,"toi":["9♣"],"robot":["6♥"],"statut":"libre"},
  {"borne":2,"toi":["4♠","5♠"],"robot":["9♠"],"statut":"libre"},
  {"borne":3,"toi":["6♣"],"robot":["5♦"],"statut":"libre"},
  {"borne":4,"toi":["7♥"],"robot":["7♠","6♠"],"statut":"libre"},
  {"borne":5,"toi":[],"robot":["1♣"],"statut":"libre"},
  {"borne":6,"toi":["3♦"],"robot":["2♣"],"statut":"libre"},
  {"borne":7,"toi":["10♥"],"robot":["8♣"],"statut":"libre"}
 ],
 "main": ["10♠","1♥","3♣","7♣","8♦","JK"],
 "bornes_jouables": [1,2,3,4,5,6,7],
 "terminee": false
}
```

OUTPUT : `7♣ 1`

## Exemple 4 — fin de partie : le coup de l'oracle

INPUT :

```json
{
 "tour": 25,
 "pioche": 6,
 "main_robot": 6,
 "bornes_gagnees": {"toi":0,"robot":0},
 "cartes_vues": {"♠":"6/10","♥":"9/10","♣":"7/10","♦":"7/10","JK":"1/2"},
 "dernier_echange": {"toi":"7♥ → borne 1","robot":"5♣ → borne 2"},
 "bornes": [
  {"borne":1,"toi":["5♥","1♥","7♥"],"robot":["4♥"],"statut":"libre"},
  {"borne":2,"toi":["10♣"],"robot":["6♣","5♣"],"statut":"libre"},
  {"borne":3,"toi":["8♥","10♥"],"robot":["3♥","3♣"],"statut":"libre"},
  {"borne":4,"toi":["5♦"],"robot":["6♥","6♦"],"statut":"libre"},
  {"borne":5,"toi":["2♥","2♣"],"robot":["9♣"],"statut":"libre"},
  {"borne":6,"toi":["3♠"],"robot":["2♦"],"statut":"libre"},
  {"borne":7,"toi":["8♦","10♦"],"robot":["10♠","1♠","8♠"],"statut":"libre"}
 ],
 "main": ["4♠","7♠","7♣","3♦","4♦","JK"],
 "bornes_jouables": [2,3,4,5,6,7],
 "terminee": false
}
```

OUTPUT : `JK 5`

## Exemple 5 — fin de partie, pioche vide : le solveur prouve ce coup gagnant

INPUT :

```json
{
 "tour": 31,
 "pioche": 0,
 "main_robot": 6,
 "bornes_gagnees": {"toi":2,"robot":2},
 "cartes_vues": {"♠":"7/10","♥":"8/10","♣":"9/10","♦":"10/10","JK":"2/2"},
 "dernier_echange": {"toi":"1♣ → borne 5","robot":"1♥ → borne 2","revendications":["tu revendiques la borne 2"]},
 "bornes": [
  {"borne":1,"toi":["7♥","5♥"],"robot":["4♣"],"statut":"libre"},
  {"borne":2,"toi":["6♣","6♦","JK"],"robot":["3♦","4♦","1♥"],"statut":"gagnée"},
  {"borne":3,"toi":["6♠","7♠","8♠"],"robot":["8♦"],"statut":"gagnée"},
  {"borne":4,"toi":["9♦","1♦"],"robot":["3♥","3♣"],"statut":"libre"},
  {"borne":5,"toi":["1♠","1♣"],"robot":["7♦","5♠"],"statut":"libre"},
  {"borne":6,"toi":["2♥","2♦"],"robot":["9♣","9♠","JK"],"statut":"perdue"},
  {"borne":7,"toi":["5♣"],"robot":["10♣","10♦","10♠"],"statut":"perdue"}
 ],
 "main": ["4♥","6♥","10♥","7♣","8♣","5♦"],
 "bornes_jouables": [1,4,5],
 "terminee": false
}
```

OUTPUT : `6♥ 1`

Le coup qui paraît naturel, `5♦ 4`, perd.

## Exemple 6 — fin de partie, pioche vide : le solveur prouve ce coup gagnant

INPUT :

```json
{
 "tour": 32,
 "pioche": 0,
 "main_robot": 5,
 "bornes_gagnees": {"toi":2,"robot":2},
 "cartes_vues": {"♠":"9/10","♥":"9/10","♣":"9/10","♦":"8/10","JK":"2/2"},
 "dernier_echange": {"toi":"6♦ → borne 5","robot":"8♦ → borne 6","revendications":["tu revendiques la borne 5"]},
 "bornes": [
  {"borne":1,"toi":["7♠","7♥","7♦"],"robot":["9♥","9♦","JK"],"statut":"perdue"},
  {"borne":2,"toi":["6♣"],"robot":["1♦"],"statut":"libre"},
  {"borne":3,"toi":["1♣","9♣"],"robot":["2♥","2♠","2♣"],"statut":"perdue"},
  {"borne":4,"toi":["8♣","8♥","JK"],"robot":["6♠","6♥"],"statut":"gagnée"},
  {"borne":5,"toi":["4♦","5♦","6♦"],"robot":["7♣"],"statut":"gagnée"},
  {"borne":6,"toi":["5♠"],"robot":["10♠","1♠","8♦"],"statut":"libre"},
  {"borne":7,"toi":["9♠","10♥"],"robot":["5♣","5♥","10♣"],"statut":"libre"}
 ],
 "main": ["3♠","4♠","1♥","4♥","4♣","10♦"],
 "bornes_jouables": [2,6,7],
 "terminee": false
}
```

OUTPUT : `4♥ 6`

Le coup qui paraît naturel, `4♣ 2`, perd.
