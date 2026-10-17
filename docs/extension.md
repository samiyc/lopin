# L'extension : six cartes bonus

Première mouture (Sami, 07/10, `docs/Prompt/roadmap-1.2-and-extension.md`). Le jeu de base ne
change pas : l'extension **ajoute** des cartes à la pioche, et chacune change la règle **d'une
borne**. Le but de cette mouture est d'en vérifier la faisabilité et de **mesurer l'équilibre**
avant de toucher à la page ou à la règle imprimée.

## Ce qui ne change pas

- 42 cartes (As à 10 dans quatre couleurs, 2 jokers), 7 bornes, 3 cartes par côté, une main de 6.
- Les combinaisons et leur ordre : Suite couleur, Brelan, Couleur, Suite, Somme. À égalité de
  combinaison, la plus grosse somme ; à égalité de somme, le premier côté complet.
- La revendication : on gagne une borne dès que son côté est complet et qu'aucune fin du côté
  adverse ne peut le battre, preuve faite avec les seules cartes de la table. **Une borne
  revendiquée ou gagnée est définitive** : aucune carte bonus ne la touche plus.
- La victoire : 4 bornes, ou 3 côte à côte.

## Ce qui s'ajoute

On choisit combien de cartes bonus on mélange à la pioche : **de 0 à 6**, dans la page comme sur
table (tirées au hasard parmi les six quand on en prend moins).

- **Une carte bonus se pioche comme une autre** et compte dans la main de 6.
- **La poser est le coup du tour** : on la pose, face visible, **à droite de ses trois cartes**,
  à côté d'une borne, puis on pioche. On ne pose pas de carte numérotée ce tour-là.
- **Seulement à côté d'une borne non décidée** (ni revendiquée, ni gagnée). Elle peut aller à côté
  d'un côté déjà complet : c'est le moyen de retourner une borne mal partie.
- **Une figure au plus par borne et par joueur** : 7 au plus pour chacun.
- Elle reste là jusqu'à la fin et montre que cette borne joue avec une autre règle.

**Le matériel** (Sami, 07/10) : les 12 figures du paquet ne suffisent pas pour 7 bornes et 6 cartes
bonus. Les bornes deviennent des jetons, ou les figures d'un autre paquet.

## Les six cartes

| Carte | Effet | Pour qui |
| --- | --- | --- |
| **Valet de Trèfle** | **-10 à égalité & recyclage** : sur sa borne, malus de 10 points sur la somme en cas d'égalité (ou sur la somme brute sous La Somme), pour celui qui l'a posé (inverse du Roi de Carreau). En bonus immédiat, le joueur peut défausser une carte de sa main, piocher deux cartes dans la pioche, puis remélanger la défausse dans la pioche (pas de pioche en fin de tour, la main revient à 6). Si le joueur choisit de ne pas défausser, il pioche normalement en fin de tour. | celui qui le pose |
| **Valet de Carreau** | **La Somme** : sur sa borne, les combinaisons ne comptent plus, la plus grosse somme gagne. | les deux côtés |
| **Dame de Cœur** | **L'Échange** : sa borne échange sa place avec **n'importe quelle autre borne non décidée**, cartes et figures des deux joueurs comprises. La Dame reste avec la borne à côté de laquelle on l'a posée : elle n'occupe que cette place-là, l'autre borne garde sa place libre pour une figure. | les deux bornes |
| **Dame de Pique** | **Le Rappel** : posée à côté d'une borne non décidée, elle reprend en main **la dernière carte qu'on y a posée** de son côté, même si ce côté était complet. **Pas de pioche** ce tour-là : la main reste à 6. | celui qui la pose |
| **Roi de Pique** | **La Couleur impaire** : sur sa borne, trois cartes **impaires** d'une même couleur, qui se suivent ou non (1-3-7, 3-5-9, 1-7-9), forment une combinaison **au-dessus de la Suite couleur** ; entre deux, la plus grosse somme. Un joker, sans couleur, ne peut pas en faire partie. | **les deux côtés** : l'adversaire peut aussi en faire une |
| **Roi de Carreau** | **+10** : sur sa borne, à combinaison égale, une Suite ou une Suite couleur compte 10 de plus dans sa somme. 5-6-7 + 10 = 28 bat 8-9-10 = 27 ; 1-2-3 + 10 = 16 perd contre 8-9-10 mais bat 4-5-6. Le Brelan et la Suite couleur restent au-dessus d'une Suite. | celui qui le pose |

Choisis par Sami le 07/10 et 08/10 : La Somme et Le Rappel ; l'Échange vers n'importe quelle borne non décidée ; la Couleur impaire sans suite ; le Roi de Carreau (+10) ; et la refonte du Valet de Trèfle (malus -10 à égalité + recyclage de main) pour remplacer l'ancienne règle trop forte « la plus faible gagne ».

**Les jokers** gardent leur règle : sans couleur, ils prennent n'importe quelle valeur. Sous La
Somme, un joker vaut la valeur qui l'arrange, comme ailleurs.

## Deux figures sur une même borne

Chaque joueur peut en poser une à côté d'une même borne. Elles **se cumulent**, dans cet ordre :
1. les Rois et Valets : la Couleur impaire pour les deux côtés, le +10 du Roi de Carreau et le malus -10 du Valet de Trèfle pour le camp de qui l'a posé ;
2. La Somme : on ne compare plus que les sommes.

Valet de Trèfle face à un Roi de Carreau : le +10 et le -10 s'appliquent indépendamment à leur camp respectif. Sur une borne où les deux joueurs ont une Suite égale, celui au Roi a 10 de plus et celui au Valet a 10 de moins.

## Décisions du 07/10 (Sami)

- Le Rappel ne fait pas piocher : l'avantage de cartes serait trop fort, la main reste à 6.
- Le Rappel reprend la dernière carte qu'on a posée sur la borne, pour simplifier ; reprendre une
  carte plus ancienne reste une idée pour plus tard. Si le côté était complet, il redevient
  incomplet, et c'est le moment où il se complète à nouveau qui compte pour une égalité.
- Le Roi de Pique s'appelle la Couleur impaire, et vaut pour les deux côtés de sa borne.

## Le premier équilibre (07/10)

`npm run extension` : 1 000 parties par pioche, à la règle de la page, le cœur du 1.1
(`core:stfig6`) des deux côtés ; la page « L'extension » du menu Versions les montre.

| Figure | Posée dans | Au tour | Borne gagnée | Partie gagnée par qui la pose |
| --- | --- | --- | --- | --- |
| Valet de Trèfle | 95 % des parties | 19 | 43 % | 56,6 % ± 2,2 |
| Valet de Carreau | 89 % | 23 | 56 % | 56,9 % ± 2,3 |
| Dame de Cœur | 52 % | 33 | 29 % | 37,5 % ± 2,9 |
| Dame de Pique | 74 % | 32 | 21 % | 36,5 % ± 2,4 |
| Roi de Pique | 58 % | 31 | 26 % | 43,0 % ± 2,9 |
| Roi de Carreau | 67 % | 32 | 17 % | 38,1 % ± 2,6 |

- **Aucune figure ne dépasse 60 %.** Les deux Valets donnent le plus : ils se posent tôt et
  changent la borne pour les deux côtés.
- **Un score bas ne dit pas qu'une carte est faible** : le Rappel, l'Échange et les Rois se
  posent tard (tour 31 à 33), souvent par le joueur qui est en train de perdre.
- **Le premier joueur** gagne 49,7 % sans figure, 51 à 57 % avec une figure seule, 52,8 % avec
  les six : les figures l'avantagent un peu.
- **Les parties** passent de 35 à 41 tours avec les six figures.
- **La limite** : le cœur ne fait qu'estimer grossièrement les figures (`src/sim/eval/figure-gains.js`).
  Ce sont ses habitudes qu'on mesure. La prochaine mesure se fait avec l'arbre, qui joue les
  figures dans ses simulations.

## Avec l'arbre, le nouveau Valet de Trèfle (11/10)

`npm run extension -- --engine "ismcts+widen=7+depth=5+core=stfig6@200" --games 500` : l'arbre du 1.1
à 200 itérations des deux côtés, 500 parties par pioche, à la règle de la page (46 min sur 18 fils,
`data/extension-tree.json`). Le Valet de Trèfle est celui du 10/10 (-10 à égalité et recyclage) ;
la colonne « 08/10 » est la même mesure, avec l'ancien Valet (« la plus faible gagne »).

| Figure | Posée dans | Au tour | Borne gagnée | Partie gagnée par qui la pose | 08/10 |
| --- | --- | --- | --- | --- | --- |
| Valet de Trèfle | 88 % des parties | 25 | 17 % | 44,0 % ± 3,3 | 62,4 % ± 3,5 |
| Valet de Carreau | 66 % | 27 | 68 % | **62,4 % ± 3,7** | 59,9 % ± 3,8 |
| Dame de Cœur | 91 % | 24 | 32 % | 44,4 % ± 3,2 | 43,5 % ± 3,2 |
| Dame de Pique | 79 % | 25 | 27 % | 41,1 % ± 3,4 | 41,5 % ± 3,5 |
| Roi de Pique | 72 % | 26 | 40 % | 44,0 % ± 3,6 | 45,4 % ± 3,6 |
| Roi de Carreau | 83 % | 24 | 31 % | 42,5 % ± 3,4 | 43,7 % ± 3,4 |

- **Le nouveau Valet de Trèfle n'est plus trop fort** : 44,0 % pour qui le pose, contre 62,4 % pour
  l'ancien. L'arbre le pose bien plus que le cœur (88 % des parties contre 40 %) : les 29 % du cœur
  seul, le 10/10, le jugeaient trop sévèrement.
- **Le Valet de Carreau (la Somme) est la seule figure au-dessus de 60 %**, de peu, et son écart
  avec le 08/10 tient dans la marge : c'est la prochaine à regarder.
- **Le premier joueur** gagne 48,8 % sans figure, de 45,6 % (Dame de Pique seule) à 53,2 % (Valet
  de Carreau seul) avec une figure, 49,2 % avec les six. Les parties durent 35 à 37 tours, 41 avec
  les six.

## Où en est l'extension (07/10)

- **Le moteur** : fait (`src/core/figures.js`, `src/sim/engine/border-rules.js`, `figure-moves.js`,
  `figure-gains.js`), le jeu de base inchangé au bit près (empreintes identiques).
- **L'équilibre** : mesuré avec le cœur, puis avec l'arbre du 1.1 (ci-dessus, 11/10, le nouveau
  Valet de Trèfle compris).
- **La page** : le choix de 0 à 6 cartes bonus dans « Nouvelle partie », la figure dessinée en
  petit à droite de son côté, la Dame de Cœur en deux clics.
- **La règle imprimée** : une 3e page « L'extension » (`regles/regles.pdf`, 3 pages).

**Plus tard** : affiner l'estimation des figures par le cœur (`figure-gains.js`), qui les juge
grossièrement ; le Rappel d'une carte plus ancienne (une idée de Sami) ; la règle imprimée relue
sur papier.
