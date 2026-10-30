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

**Dans la file** (30/10) : quatre tranches de 51 positions (`claim-pile-2026-10-30-a` à `-d`), puis la réunion.
