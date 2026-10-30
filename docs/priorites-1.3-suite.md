# Priorités 1.3, la suite (depuis le 30/10)

> La suite de `docs/priorites-1.3.md`, arrivé à 787 lignes sur 800. Les paragraphes continuent sa numérotation.

## 16. `ClaimPile2` : la règle de la partie dans l'arbre, à 2 cartes de pioche ou moins (30/10)

**La question** (Sami, 30/10, après le § 15). L'arbre joue ses itérations à `final` (`determinize`, pour la vitesse),
la partie se joue à `claim-end`. Parmi les fins « sûres » perdues à cause de cet écart, 83 sur 86 avaient 1 ou 2 cartes
de pioche, et dans 34 sur 76 un autre coup gagnait plus de donnes, souvent le 2e de l'arbre. Sami a retenu **2 cartes ou
moins** : on couvre 33 de ces 34 positions.

**Le code.** `+claimPile=k` (`src/sim/mcts/deal.js`, `dealFor`) : quand la pioche de la position cherchée a `k` cartes ou
moins, la donne de chaque itération garde la règle de la partie, pour l'arbre comme pour la simulation. Elle est éteinte
par défaut, et les empreintes n'ont pas bougé (`abf3bc51801c81b4`, la 1.2 `1d041613cd7bcd8d`). Les tests sont dans
`tests/sim-search/claim-pile.test.js`. La version s'appelle `ClaimPile2` (`docs/glossaire.md`).

**Le banc** (`scripts/archive/claim-pile.js`). Il reprend les positions de `tmp/sure-lost.jsonl`, en deux groupes :
- les 86 cas de l'écart des règles, dont `sure-lost-moves` a déjà résolu tous les coups ;
- les 117 sûres gagnées à 1-2 cartes de pioche, les témoins.

Quatre moteurs y cherchent, chacun avec 3 graines, à 2 000 itérations : la 1.2, `ClaimPile2`, `EndPimc3` et les deux
ensemble. Le banc juge ensuite le coup choisi à `claim-end`, avec le solveur sur les donnes que le joueur ne distingue
pas, et chronomètre chaque coup. La question est double : la variante choisit-elle des coups qui gagnent plus de
donnes, et casse-t-elle des témoins ? Aucun duel n'est prévu, car le gain attendu (0,25 point au plus, § 15) est loin
sous ce qu'un 1k@2k peut voir.

**L'essai** (4 positions de l'écart des règles, créneau de 4 fils, 51 s) :

| Moteur | Coup choisi : donnes gagnées à `claim-end` | Temps d'un coup, pioche 1 / pioche 2 |
|---|---|---|
| 1.2 | 7,1 % | 608 / 911 ms |
| `ClaimPile2` | 59,5 % (mieux dans 3 positions sur 4) | ×1,4 / ×1,8 |
| `EndPimc3` | 27,4 % | ×5,2 / ×1,2 |
| les deux | 60,7 % | ×5,8 / ×1,6 |

Le surcoût ne porte que sur les derniers coups d'une partie. Sur une partie entière, il se mesure avec le banc.

**Le résultat** (file du 30/10, `claim-pile-2026-10-30-a` à `-d` et la réunion, 203 positions) : le coup choisi est
jugé par la part des donnes qu'il gagne à `claim-end`, en moyenne sur les 3 graines.

| Moteur | Écart des règles (85 jugées) | mieux / moins bien que la 1.2 | Témoins (113 jugés) | Temps d'un coup, pioche 1 / 2 |
|---|---|---|---|---|
| 1.2 | 22,4 % | — | 98,4 % | 766 / 914 ms médian |
| **`ClaimPile2`** | **43,4 %** | 29 / 5 (1 de 25 points ou plus) | 99,1 % (2 mieux, 0 moins bien) | ×1,27 / ×1,41 en moyenne |
| `EndPimc3` | 37,3 % | 26 / 0 | 98,4 % | ×16 / ×0,97 (3 s médian à pioche 1) |
| les deux | 45,2 % | 33 / 1 | 99,1 % | ×15 / ×1,43 |

- **`ClaimPile2` double la part des donnes gagnées** sur les positions perdues à cause de l'écart des règles (22 →
  43 %), et **ne casse aucun témoin**. Elle en améliore même deux. Position par position, l'écart à la 1.2 est de
  **+21,0 points (+13,2 à +28,8, à 95 %)**. Sur les témoins, il est de +0,7 (−0,3 à +1,7). Pour `EndPimc3`, il est de
  +14,9 (+9,0 à +20,8), et pour les deux ensemble de +22,9 (+15,1 à +30,6). L'intervalle est imprimé par
  `--summary` depuis le 30/10 au soir. Il porte sur les 85 positions, pas sur les 3 graines.
- **`EndPimc3` en fait moins**, et seulement à une carte de pioche, pour un coût seize fois plus grand. Les deux ensemble
  ne gagnent que 2 points de plus que `ClaimPile2` seule.
- **Le coût sur une partie** : la pioche n'a 2 puis 1 carte que pour deux coups d'une partie (à 0 carte, le solveur
  `exact=12` joue déjà à `claim-end`). Cela fait environ +0,6 s sur une partie de 1.2@2000, quelques dixièmes de pour
  cent, sous le seuil de 3 % de la règle « itérations égales ou temps égal ».
- **Ce que ça vaut en parties** : environ 0,25 point au plus (§ 15). Un 1k@2k ne le verrait pas. Le banc est la seule
  mesure possible, et il est net.

**La décision** (Sami, 30/10) : **`ClaimPile2` est adoptée sur ce banc**, sans duel. `EndPimc3` reste dans le code,
éteinte. Des coups changent, donc l'Expérimental change de version : la règle de `src/config/bots.js` (deux numéros,
le second à chaque changement de comportement) en fait la 1.3, à confirmer par Sami avant de toucher la line-up.
