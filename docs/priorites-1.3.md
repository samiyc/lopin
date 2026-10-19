# Priorités 1.3 : battre la 1.2 à 2 000 itérations, ou s'arrêter (16/10)

> Réponse au prompt `docs/agents/prompt-fable-priorites-1.3.md`. Les mesures de ce document ont tourné de jour : 400
> itérations par recherche au plus, sur un fil, sauf le tri (`--screen`, 18 fils, 10 min). Sauf mention, un score est
> celui d'une version contre la 1.2 (`ismcts+widen=7+depth=5+core=stfig6+exact=12`) au même budget.

## En bref

- **Le résultat de la nuit du 17/10** (§ 6) : `CommonDeals` fait **50,7 % (48,2 – 53,2)** sur sa 1k@2k, écarté.
  Mais `Ensemble2x2000` fait **54,6 % (50,8 – 58,4)**, autant que Budget4000 sur les mêmes donnes : le bruit du coup
  joué vaut bien 2 à 3 points à 2 000, et il vient du chemin de chaque arbre, pas des donnes de la racine. Seuls des
  arbres indépendants le réduisent, donc du calcul en plus : à temps égal dans la page, sur deux workers.
- **Le diagnostic.** À 2 000 itérations, la 1.2 est un bandit de 8 candidats posé sur un bandit d'environ 55 réponses
  adverses par candidat, suivi d'une simulation où le cœur joue les deux camps. Ses erreurs ont deux sources :
  - le **bruit de la comparaison** de ses candidats ;
  - le **biais de ce qu'elle compare** : des réponses adverses peu visitées, et le cœur des deux côtés dans les
    simulations.

  Les familles essayées ont échoué de trois façons :
  - par le biais : retours d'arbre, PUCT, diversité ;
  - par le coût : des simulations plus justes, mais trop chères ;
  - en relisant autrement le même bruit : choix final, élimination par moitiés.

  Ensemble a payé la baisse du bruit en qualité d'arbre. **La fusion de stratégies n'explique aucun échec mesuré.**
  Elle existe à la première réponse adverse, mais aucune idée essayée ne la visait, et MO-ISMCTS ne la toucherait pas.
- **Une seule piste n'a jamais été essayée sur ce bruit : apparier les candidats.** La 1.2 tire une donne à chaque
  itération, si bien que deux candidats sont jugés sur des mains adverses différentes. Le Stratège 2 et le 0.7, eux,
  comparaient les leurs sur les mêmes. `CommonDeals` (`+crn=1`) donne à la k-ième visite de chaque candidat la k-ième
  donne de la recherche, sans rien changer d'autre : ni le coût, ni UCB, ni le coup joué.
- **Mesuré de jour** (80 positions, 400 itérations, jugées par chaque candidat cherché seul 400 fois) :
  - `CommonDeals` réduit le regret de la racine de **0,43 ± 0,34 point**, plus qu'un doublement du budget
    (−0,37) ;
  - deux graines jouent le même coup **28,5 % du temps au lieu de 19,2 %** ;
  - sur une même donne, deux candidats ont des résultats corrélés à ρ = 0,34 à travers l'arbre.
- **Le tri à 400** : **55,3 % sur 360 parties (50,5 – 60,0)** contre la 1.2@400. Il n'est pas écarté, et un tri ne
  promeut pas.
- **En file pour la nuit** :
  - la 1k@2k de `CommonDeals` (4 × 25 min) ;
  - une mesure, `Ensemble2x2000` (2 × 36 min), qui dit ce que vaut le bruit du coup joué à 2 000.
- **Le verdict** : hors de ce bruit, la 1.2 est au plafond de ce qu'une astuce à budget égal peut montrer. Les idées
  qui restent valent 2,5 points au plus, sous la marge d'une 1k@2k (± 2,7). `CommonDeals` est la dernière à tenter.
  Si elle tombe, et si `Ensemble2x2000` reste vers 50 %, la 1.3 viendra du budget : `@4000` dans la page, ou l'Oracle
  light.

## 1. Pourquoi les familles échouent

### Ce que la 1.2 fait de ses 2 000 itérations

Les replays des duels gardés portent la forme de l'arbre de chaque coup (`tree`, `src/sim/mcts/tree-stats.js`). Sur 1 197
coups de la 1.2@2000 (ses deux duels du 16/10 contre `pwl=3` et `pwl=5`), un « premier essai » est la visite qui crée
un nœud. UCB joue toujours d'abord un coup jamais essayé, puis la descente s'arrête sur ce nœud neuf et la simulation
prend la suite.

| Étage | Ce qui s'y choisit | Nœuds visités par recherche | Part des itérations qui y font un premier essai | Visites du nœud le plus suivi |
| --- | --- | --- | --- | --- |
| 1 | mes 8 candidats | 8 | 0,4 % | 577 |
| 2 | la réponse adverse | 444 (≈ 55 par candidat), dont 173 visités une fois | **22,2 %** | 62 |
| 3 | mon coup suivant | 1 303 | **65,1 %** | 10 |
| 4 | la réponse d'après | 228 | 11,4 % | 1,7 |
| 5 | — | 16 | 0,8 % | 0,3 |

- **Au 3e étage, presque chaque visite est un premier essai.** Le coup essayé est le premier du cœur dans cette donne,
  celui que la simulation aurait joué : l'arbre n'y apprend rien. On le voyait déjà le 06/10 (`strategie/04-labo-a-2000.md`,
  « Ce que la largeur fait à la profondeur » : UCB choisit 82 % des coups à l'étage 1, 7 % à l'étage 2).
- **Au 2e étage, les réponses changent avec la main adverse tirée** : environ 55 par candidat, 3 ou 4 visites chacune
  en moyenne. Une itération sur cinq essaie une réponse nouvelle.
- **La 1.2 est donc un bandit de 8 candidats** (environ 250 visites chacun) au-dessus d'un bandit de réponses
  adverses ; ensuite, le cœur joue la fin pour les deux.

Ses erreurs ont deux sources :

1. **Le bruit de la comparaison.** La valeur d'un candidat est une moyenne sur environ 250 donnes, et deux candidats
   sont jugés sur des donnes différentes. À 2 000, l'écart-type de la différence des taux des deux premiers vaut
   environ 0,03 (500 et 450 visites), pour des écarts réels de quelques points. Deux graines ne jouent le même coup
   que 19 fois sur 50 (`glossaire.md`, « Le bruit du coup joué »).
2. **Le biais de ce qu'elle compare** :
   - un adversaire qui choisit sa réponse sur 3 ou 4 visites, presque au hasard parmi les 7 du cœur ;
   - ses réponses jugées sur toutes ses mains possibles (la fusion, plus bas) ;
   - le cœur qui joue ensuite les deux camps (il garde le coup gagnant dans 93,8 % des fins décisives, `npm run policy`).

Le budget réduit les deux à la fois : ×2 vaut +2,8 points (Budget4000), ×10 vaut +5,7 (Budget20000).

### Famille par famille

| Famille | Essais (score contre la 1.2) | Cause | Mécanisme |
| --- | --- | --- | --- |
| Diversité à la racine | `diverse`, Borné 1.0 : 45,9 – 47,0 % | biais (mauvaise cible) | Les relectures par l'oracle ne trouvent rien hors des 8 candidats : la couverture n'était pas le goulot. Le plafond par carte retire en plus des réponses adverses dans l'arbre, ce qui avait fait le gain de la 1.1 (3 → 5 réponses : +3,4 points). |
| Élargissement progressif | `pw=1/2/3` : 51,1 / 47,8 / 51,2 % | budget | Il échange de la largeur à l'étage 2 contre une profondeur que 2 000 itérations ne remplissent pas : l'étage 3 n'apprend rien (65 % de premiers essais). Il paie à 20 000 (Depth10Pw), où les nœuds ont les visites pour descendre. |
| Exploration | PUCT 1 et 2 : 49,8 ; 47,2 % | biais (redondance) | Le rang du cœur décide déjà quels coups entrent. Le remettre dans UCB pousse vers le favori du cœur, que l'arbre est là pour corriger. |
| Plusieurs arbres | Ensemble : 51,0 % sur 1 500 ; 3 et 4 arbres : 42,0 ; 46,2 % | bruit contre qualité | Deux arbres de 1 000, visites additionnées, ont à peu près le bruit d'un arbre de 2 000 (deux moitiés d'échantillon) et la qualité d'un arbre de 1 000. Avec plus d'arbres, la qualité s'effondre (500 itérations, environ 60 par candidat). |
| Simulations plus justes | SimCertain, SimCertainExact4 : 40,7 ; 41,0 % | coût par itération | −29 à −37 % d'itérations coûtent environ 9 points ; la politique ne gagne que 1,2 point sur `npm run policy`. |
| Retours d'arbre | `margin` 0,05 / 0,15 : 46,0 ; 45,6 % ; Implicit 0,2 / 0,4 : 50,8 ; 40,0 % ; ForkCut 1 / 2 : 45,2 ; 49,6 % | biais | `margin` change l'objectif : gagner par plus de bornes ne rapporte rien de plus. Implicit mêle l'estimation du cœur, moins bonne que les simulations : plus elle pèse, plus il perd. ForkCut 1 ne change aucun coup, ForkCut 2 parie. |
| Choix final | FinalLcb1 : 51,5 % sur 1 500 ; FinalMean : 51,9 % sur 1 000 | bruit | Ils relisent les mêmes statistiques, tirées sur des donnes indépendantes : la bonne direction (+1,5), mais aucune information de plus. RootHalving (49,5 % ; −0,5 ± 3,7 contre Tree-5w sur les mêmes donnes) répartissait autrement ces mêmes tirages. |
| Modèle adverse | `infer=48` ; `+memory=3` : 49,5 ; 46,3 % | signal faible | Les coups de l'adversaire disent peu de sa main (+4,3 % de cartes devinées) : pondérer les donnes sur si peu ajoute surtout de l'erreur. |
| Solveur plus tôt | `exact=14` | aucun effet | Identique à `exact=12` : il attend la pioche vide. |
| Budget | ×2 ; ×10 ; Oracle3 ; Oracle light | — | Il paie, parce qu'il réduit le bruit et le biais à la fois. |

**Les trois causes du prompt, réparties** :
- **le coût par itération** explique les simulations ;
- **le bruit** explique le choix final, RootHalving et Ensemble ;
- **le biais** explique le reste : un signal moins bon mêlé aux simulations, ou une mauvaise cible ;
- **la fusion de stratégies** n'en explique aucun.

### La fusion de stratégies

Elle existe à deux endroits de la 1.2, qui est un ISMCTS à un seul observateur (SO-ISMCTS) :

- **Mes nœuds suivants regroupent mes pioches.** Après mon coup et sa réponse, le nœud est le même quelle que soit
  la carte que j'ai piochée. Un coup avec la carte piochée n'est offert que si je la tiens, mais la valeur de mes
  autres coups est une moyenne sur mes pioches. À 2 000, cet étage est la frontière de l'arbre (65 % de premiers
  essais) : il n'y apprend rien, donc la fusion n'y coûte rien de mesurable.
- **Les nœuds adverses regroupent ses mains.** Sa réponse est choisie sur des valeurs moyennées sur toutes les mains
  où il pouvait la jouer ; seule la liste des réponses offertes, le top 7 du cœur dans la donne, dépend de sa main.
  L'adversaire modélisé connaît donc mal sa propre main, ce qui rend les candidats un peu optimistes, surtout ceux qui
  laissent une réfutation propre à certaines mains.

**MO-ISMCTS (Cowling, Powley et Whitehouse 2012) ne touche à aucun des deux.** Il garde un arbre par joueur pour les
jeux où un coup cache quelque chose à l'adversaire, une carte posée face cachée par exemple. Chaque joueur choisit
alors dans un arbre qui distingue ce qu'il a vu.

- **Dans Bornage, un coup est public** (une carte sur une borne). Seules la donne et les pioches sont cachées, et ce
  sont des tirages, que l'ISMCTS fait à la racine. Avec des coups publics, les arbres de chaque joueur suivent les
  mêmes chemins et reçoivent les mêmes résultats : ils sont l'arbre de la 1.2.
- **Faire des pioches des nœuds de hasard** séparerait mes nœuds de l'étage 3 par ma pioche, un étage que la 1.2
  n'apprend pas à 2 000.
- **Les mains adverses resteraient regroupées à sa première réponse.** MO-ISMCTS tire lui aussi ses donnes dans mon
  ensemble d'information, et la racine de l'arbre adverse regroupe toutes ses mains.

Les « nœuds adverses regroupés par ce que l'adversaire voit » du panel se lisent donc mal. Ce sont les coups que
chacun observe qui sont regroupés, pas la main de l'adversaire. Séparer ses nœuds par sa main, la vraie cure de cette
fusion, partagerait 3 ou 4 visites par réponse entre des milliers de mains ; une abstraction en quelques classes
n'en laisserait qu'une. Cela ne se mesure pas à 2 000.

### Ce qui reste

Le bruit de la comparaison est la seule source d'erreur qu'on puisse réduire sans dépenser d'itérations et sans
mêler un signal moins bon. Ce qui a manqué aux trois essais sur ce bruit, c'est **l'appariement** :
- FinalLcb1 lisait des taux tirés sur des donnes indépendantes ;
- RootHalving répartissait autrement ces mêmes tirages ;
- Ensemble divisait le budget.

La chance des donnes entre en entier dans chaque comparaison de candidats. Le Stratège 2 (`lookahead.js` : « Every
candidate is played out on the same deals (common random numbers) ») et la recherche du 0.7 (`search.js` :
« successive halving on common deals ») comparaient les leurs sur les mêmes donnes. L'ISMCTS a perdu cette propriété
en tirant sa donne avant de choisir son candidat.

## 2. Les idées, classées

Trois idées, et une mesure qui borne la famille du bruit. Les lignes citées sont celles de `docs/strategie.md` au
16/10, avant son découpage en chapitres (`docs/strategie/`, 17/10).

### 1. `CommonDeals` : les candidats comparés sur les mêmes donnes (codé, trié, en file)

- **Le mécanisme** : des variables aléatoires communes à la racine. La k-ième visite de chaque candidat joue la
  k-ième donne de la recherche, et ses simulations tirent leurs égalités dans la k-ième suite. Le sous-arbre d'un
  candidat ne dépend plus que de ses propres visites, et deux candidats sont comparés donne à donne. UCB, l'arbre
  sous la racine, le coup joué (le plus visité) et le coût d'une itération ne changent pas.
- **Ce qui le distingue de l'échec le plus proche** :
  - `FinalLcb1` (l. 3531, 51,5 % sur 1 500) relisait des taux tirés sur des donnes indépendantes ;
  - `RootHalving` (l. 2389, 49,5 %) répartissait autrement ces mêmes tirages ;
  - `Ensemble` (l. 3039, 51,0 %) réduisait le bruit en divisant l'arbre en deux.

  `CommonDeals` réduit la variance de la comparaison elle-même, à arbre égal. Le Stratège 2 et le 0.7 le faisaient
  dans leurs recherches à plat ; l'arbre l'avait perdu.
- **L'effet attendu** : avec ρ ≈ 0,34, la variance d'une comparaison entre deux candidats sur leurs donnes communes
  est multipliée par 0,66, ce qui vaut environ 1,5 fois plus de donnes pour cette comparaison. Le budget ×2 rapporte
  +2,8 points (Budget4000), mais ce gain mêle le bruit du choix et la qualité des sous-arbres, et `CommonDeals` ne
  touche que le premier. D'où **+1 à +2,5 points attendus à 2 000** : la mesure de jour (section 3) et
  `Ensemble2x2000` (plus bas) disent où, dans cette fourchette.
- **Le coût** : nul (un générateur de nombres par itération, autant de donnes qu'avant) : duel à itérations égales.
- **Le code** :
  - `src/sim/mcts/common-deals.js` (`visitRng`) ;
  - 7 lignes dans `ismcts.js` : `begin` choisit le candidat avant la donne, `dealFor` prend le générateur de la visite,
    `descend` reçoit le choix de la racine, `resolveCtx` garde le générateur des simulations ;
  - le test `tests/sim-search/common-deals.test.js` : un candidat cherché seul retrouve son sous-arbre de la recherche complète,
    ce qui n'est pas le cas sans l'option.
- **Le nom** : `CommonDeals` (`glossaire.md`).
- **Les commandes** : section 4.

### 2. `ReplyFpu` : le premier essai d'une réponse adverse au mérite (codé et écarté le 17/10)

- **Le résultat (17/10, de jour, Sami)** : les quatre marges sur les mêmes 250 parties à 2 000 contre la 1.2@2000
  (offset 0), puis la 1k@2k de la meilleure.

  | Variante | Offset 0 (250 parties) | 1k@2k |
  | --- | --- | --- |
  | `ReplyFpu0` (`+fpu=0`) | 45,6 % (40,0 – 51,2) | — |
  | `ReplyFpu1` (`+fpu=1`) | 53,6 % (48,6 – 58,6) | 53,6 / 46,8 / 51,6 / 54,0 : **51,5 % (49,0 – 54,0)** |
  | `ReplyFpu2` (`+fpu=2`) | 48,4 % (43,0 – 53,8) | — |
  | `ReplyFpu3` (`+fpu=3`) | 45,6 % (39,8 – 51,4) | — |

  **Écarté** : la borne basse sur 1 000 parties reste sous 50 %, comme `FinalLcb1` (51,5 % aussi). Le pic de
  `fpu=1` entre trois marges sous 50 % était du bruit de 250 parties (± 5 points). Revenir plus tôt aux réponses
  connues ne rend pas l'adversaire modélisé meilleur : la 1.2 reste au plafond pour tout ce qui ne rajoute pas de
  calcul. Le coût (+3,6 % sur un fil pour `fpu=1`) n'a pas eu à être vérifié. L'option `+fpu=d` reste.

- **Le mécanisme** : la « first-play urgency » sous la racine. Une réponse jamais essayée vaut la moyenne des réponses
  déjà essayées du nœud, moins δ, au lieu de passer avant toutes (+∞ dans UCB). Les 22 % d'itérations qui essaient
  une réponse nouvelle reviendraient aux réponses connues tant qu'elles valent mieux que la moyenne. L'adversaire
  modélisé reviendrait plus souvent à ses meilleures réponses, et un candidat qui laisse une réfutation paraîtrait
  moins bon. La racine garde son premier essai de chaque candidat.
- **Ce qui le distingue de l'échec le plus proche** :
  - `pw` à 2 000 (l. 3426, 51,1 / 47,8 / 51,2 %) coupait aussi des premiers essais, mais au rang du cœur (k + √n
    réponses offertes) ;
  - PUCT (l. 3005) gardait le +∞ des coups jamais essayés.

  Ce serait la première fois que les résultats décident entre essayer une réponse nouvelle et revenir à une connue.
- **L'effet attendu, de signe inconnu, ± 2 points** :
  - pour : 22 % du budget, à l'étage où se forme la valeur des candidats ;
  - contre : une réponse qui n'existe que dans certaines mains (un joker) serait moins essayée. L'adversaire modélisé
    raterait des réfutations rares, et c'est encore la fusion de stratégies.
- **Le coût** : nul. `select` parcourt déjà les enfants du nœud, la moyenne s'y ajoute.
- **Le code** :
  - `src/sim/mcts/first-play.js` : `untriedScore(children, fpu, bonus)` rend +∞ sans l'option ou sans enfant visité,
    sinon la moyenne des enfants visités moins δ, plus le bonus d'exploration d'UCB pour une visite ;
  - dans `select`, `child.visits === 0 ? untried(child, rank) : …`, aux étages 1 et plus seulement ;
  - `+fpu=d` dans `ismctsSettings`, δ = d / 10 ;
  - sans la clé, mêmes coups (l'empreinte de la 1.2, `1d041613cd7bcd8d`) ; `fpu=0` `d7ea4c190e6e63c0`, `fpu=1`
    `1a42545c7dcbaeeb` ;
  - le test (`tests/sim-search/first-play.test.js`) : la racine essaie autant de candidats, les nœuds adverses ouvrent moins de
    réponses.
- **Les noms** : `ReplyFpu0` (δ = 0) et `ReplyFpu1` (δ = 0,1).
- **Les commandes** : un tri à 400 d'abord ; il change l'évaluation, pas la lecture des visites, donc un tri peut
  l'écarter.

  ```
  npm run duel -- "ismcts+widen=7+depth=5+core=stfig6+exact=12+fpu=0@400" "ismcts+widen=7+depth=5+core=stfig6+exact=12@400" --screen --page
  ```

  S'il n'est pas écarté, `VALIDATE_LONG_1..4_ReplyFpu0` comme ceux de `CommonDeals` (section 4), avec `+fpu=0`.

### 3. `CommonDeals-FinalLcb1` : la décision lue sur des taux appariés (sans code, après la nuit)

- **Le mécanisme** : `CommonDeals` avec le choix final de `FinalLcb1`, le meilleur taux moins 1 / √visites au lieu du
  plus visité. Sous `CommonDeals`, deux candidats ont joué les mêmes donnes jusqu'au plus petit de leurs nombres de
  visites. L'écart de leurs taux est alors presque l'écart apparié : à ρ = 0,34, avec 500 et 450 visites, son
  écart-type (0,027) est celui de l'écart apparié sur leurs 450 donnes communes. C'est « la décision sur la
  différence appariée » du panel, sans une ligne de plus.
- **Ce qui le distingue de l'échec le plus proche** : `FinalLcb1` (+1,5 point) lisait des taux non appariés ; ici,
  ses taux sont comparables.
- **L'effet attendu** : celui de `CommonDeals`, plus 0,5 à 1 point si la lecture des taux et l'appariement
  s'additionnent. `FinalLcb1` gagnait +1,5 point sur des taux plus bruités.
- **Le coût** : nul. **Le code** : aucun (`+crn=1+final=1`). **Le nom** : `CommonDeals-FinalLcb1`.
- **Les commandes** : `VALIDATE_LONG_1..4_CommonDeals-FinalLcb1` (section 4), seulement si `CommonDeals` fait au
  moins 51 % sur sa 1k@2k : la direction tient, on pousse la lecture. Sous 49 %, on l'abandonne.

### Une mesure, pas une idée : `Ensemble2x2000`

**Deux arbres de 2 000, visites additionnées** (`trees=2@4000`), contre la 1.2@2000 : la qualité d'arbre de la 1.2, la
moitié du bruit de son choix. À comparer à `Budget4000`, un arbre de 4 000, plus profond, sur les mêmes donnes
(offsets 1 et 2 : 54,4 et 54,4 % le 11/10).
- **S'il fait autant que Budget4000**, le gain du budget ×2 est le bruit du choix, et les idées de cette famille ont
  jusqu'à +2,8 points devant elles.
- **S'il reste vers 50 – 51 %**, le bruit du choix d'un arbre de 2 000 ne vaut presque rien, et la famille est close
  à 2 000. Un bon score de `CommonDeals` serait alors de la chance.

C'est ce qui manque pour trancher entre « plafond » et « bruit encore exploitable ».

### Écartées, sur le papier ou par une mesure

| Idée | Pourquoi |
| --- | --- |
| **MO-ISMCTS** (le panel) | Les coups de Bornage sont publics : ses arbres sont celui de la 1.2. Il ne sépare pas non plus les mains adverses (section 1, « La fusion de stratégies ») |
| Séparer les nœuds adverses par sa main (la vraie cure de la fusion) | 3 ou 4 visites par réponse à 2 000, à partager entre les mains : rien n'y apprendrait. Une piste pour un oracle à 20 000, pas pour la 1.3 |
| Retirer la chance des jokers des résultats (variable de contrôle) | Mesuré : corrélation −0,04 avec les jokers de la main adverse tirée, +0,12 avec ceux de mes pioches (30 positions, 300 donnes chacune). Au plus 1,5 % de la variance |
| Partager les réponses adverses entre candidats (« coup tueur ») | La famille de RAVE (l. 39, 44,4 %) ; une réponse forte contre un candidat peut être parée par un autre |
| PIMC exact quand il reste une carte dans la pioche | 7 résolutions d'environ 14 cartes (3,7 s médianes pour l'Omniscient) contre environ 1 s pour la 1.2 à ce moment : hors budget. Et PIMC rouvre la fusion |
| Les simulations à la règle de la page (revendications) | `0.8-early` a perdu sur le coût (l. 26, 47,9 %) ; le biais de la règle `final` touche tous les candidats à peu près pareil |

## 3. `CommonDeals` : le code, les mesures de jour, le tri

### Le code

- **`src/sim/mcts/common-deals.js`** (`visitRng`) : la visite k d'un candidat reçoit la donne de la suite 2k ; le
  générateur des simulations est remis à la suite 2k + 1.
- **`ismcts.js`, 7 lignes de code de plus** (203 sur 220) :
  - `begin` choisit le candidat de la racine avant la donne quand `crn` est là ;
  - `dealFor` prend le générateur de la visite ;
  - `descend` reçoit le choix de la racine ;
  - `resolveCtx` garde le générateur des simulations.
- **Sans l'option, rien ne change** : l'empreinte de la 1.2 reste `1d041613cd7bcd8d` (20 parties à 150 contre greedy),
  et `npm run check` passe (432 tests, 0 échec, 7 en attente). Celle de `CommonDeals` est `bef7b4df22f6c4c0`.
- **Le test** (`tests/sim-search/common-deals.test.js`) : chaque candidat cherché seul, autant de visites que dans la recherche
  complète, retrouve exactement ses visites, ses victoires et son sous-arbre ; sans l'option, ce n'est pas le cas.
  C'est la propriété qui rend la comparaison appariée.
- **Le coût** : aucun. Avec `npm run bench -- 400 3 <moteur>`, en deux passes alternées sur les 12 positions de
  milieu de partie, `CommonDeals` fait 1 288 et 1 285 simulations/s, la 1.2 1 245 et 1 232. Il n'est pas plus
  lent ; il trouve le coup gagnant des puzzles autant (27 / 60). Le duel se joue donc à itérations égales.

### La corrélation des résultats sur une même donne

| Mesure | ρ | Positions |
| --- | --- | --- |
| Simulations seules : les deux premiers candidats de la 1.2@400, 300 donnes, la même suite de tirages | 0,44 (0,19 – 0,96) | 30 |
| À travers l'arbre : chaque candidat cherché seul sous `crn`, 400 visites | **0,34** (0,24 aux tours 6 à 10, 0,35 de 11 à 20, 0,43 de 21 à 26) | 80 |

La variance d'une comparaison appariée est celle d'une comparaison non appariée multipliée par 1 − ρ, soit 0,66 à
travers l'arbre. La corrélation monte avec la partie : moins de cartes cachées, des donnes qui pèsent plus.

### Le choix à la racine, jugé par une référence

**Le protocole** : 80 positions (les deux duels du 16/10 de la 1.2@2000 contre `pwl=3` et `pwl=5`, une partie sur
quatre, tours 6 à 26).
- **La référence** : chacun des 8 candidats de la racine cherché seul sous `crn`, 400 visites, avec une graine à part.
  C'est le jugement de l'arbre avec 8 fois plus de visites qu'un candidat n'en reçoit dans une recherche de 400, et
  sur des donnes indépendantes de celles des variantes.
- **Le regret** : la référence du meilleur candidat moins celle du coup choisi, en points de part gagnée.
- **L'accord** : la part des paires de graines, sur 4 graines, qui jouent le même coup.

Écarts appariés par position, avec leur marge à 95 % :

| Variante | Regret | Accord entre graines | Meilleur candidat joué |
| --- | --- | --- | --- |
| 1.2@100 | 3,65 | 15,4 % | 21,3 % |
| `CommonDeals`@100 | 3,62 (−0,03 ± 0,55) | 26,0 % (+10,6 ± 6,0) | 24,1 % |
| 1.2@200 | 3,30 | 17,5 % | 26,9 % |
| `CommonDeals`@200 | 3,12 (−0,18 ± 0,45) | 22,1 % (+4,6 ± 4,8) | 24,1 % |
| **1.2@400** | **2,93** | **19,2 %** | 27,2 % |
| **`CommonDeals`@400** | **2,50 (−0,43 ± 0,34)** | **28,5 % (+9,4 ± 5,3)** | 31,6 % |
| `FinalLcb1`@400 | 2,93 (0,00 ± 0,14) | 20,6 % | 27,2 % |
| `CommonDeals-FinalLcb1`@400 | 2,51 (−0,42 ± 0,36) | 28,5 % | 30,9 % |

- **À 400, `CommonDeals` vaut plus qu'un doublement du budget pour le choix** : −0,43 point de regret, quand passer
  de 200 à 400 itérations fait −0,37 ± 0,40 (et de 100 à 200, −0,35 ± 0,37). Le coup joué est aussi plus stable :
  deux graines s'accordent une fois sur 3,5 au lieu d'une sur 5.
- **Le gain grandit avec le budget** (−0,03, −0,18, −0,43) : il faut assez de visites par candidat pour que
  l'appariement trie. À 100 itérations, 12 par candidat, le choix reste fait d'essais forcés.
- **Par phase** (à 400) : tours 6 à 10, 3,96 → 3,04 ; tours 11 à 20, 2,98 → 2,77 ; tours 21 à 26, 1,78 → 1,40.
- **`final=1` ne change rien à 400** : les candidats y ont trop peu de visites pour que la règle compte, ce que le tri
  à 800 de `FinalLcb1` avait déjà montré. `CommonDeals-FinalLcb1` ne se juge qu'à 2 000.

### Le tri à 400

`npm run duel -- "ismcts+widen=7+depth=5+core=stfig6+exact=12+crn=1@400" "ismcts+widen=7+depth=5+core=stfig6+exact=12@400" --screen --page`
(16/10 au soir, 570 s sur 18 fils) :

| Version | Score | Fourchette par paires | En commençant / en second |
| --- | --- | --- | --- |
| `CommonDeals`@400 | **55,3 %** sur 360 parties | **50,5 – 60,0 %** | 54,4 / 56,1 % |

**Il n'est pas écarté.** Le tri ne promeut jamais : trois tris à 57 – 60 % sont retombés vers 49 % sur des donnes
neuves. Les trois mesures du jour vont pourtant dans le même sens (le regret, l'accord entre graines, le tri), et le
mécanisme ne coûte rien : la 1k@2k est méritée.

**Ce qu'on peut attendre à 2 000** : moins qu'à 400 en valeur absolue, parce que le bruit du choix y pèse moins. Si
l'appariement y vaut encore un doublement du budget **pour le choix**, son gain est la part du choix dans les +2,8 de
Budget4000. `Ensemble2x2000` mesure cette part cette nuit. **Prévision : +1 à +2,5 points.**

## 4. La nuit

Six jobs ajoutés **à la fin** de `data/backlog.json`, après les 7 de la nuit déjà prévus (l'Oracle light et Oracle3 en
deux arbres, environ 6 h). Ils arrivent sur la branche `priorites-1.3` : `main` doit l'avoir reçue avant le lancement
de `npm run backlog`.

| Job | Commande | Durée | Règle d'arrêt |
| --- | --- | --- | --- |
| `VALIDATE_LONG_1_CommonDeals` | `npm run duel -- "ismcts+widen=7+depth=5+core=stfig6+exact=12+crn=1@2000" "ismcts+widen=7+depth=5+core=stfig6+exact=12@2000" --long --games 125 --page --offset 0` | 25 min | — |
| `VALIDATE_LONG_2_CommonDeals` | la même, `--offset 1` | 25 min | le 1 sous 47 % |
| `VALIDATE_LONG_3_CommonDeals` | la même, `--offset 2` | 25 min | le 1 sous 47 %, ou 1 et 2 réunis sous 50 % |
| `VALIDATE_LONG_4_CommonDeals` | la même, `--offset 3` | 25 min | idem |
| `NOISE_DUEL_1_Ensemble2x2000` | `npm run duel -- "ismcts+widen=7+depth=5+core=stfig6+exact=12+trees=2@4000" "ismcts+widen=7+depth=5+core=stfig6+exact=12@2000" --long --games 125 --page --offset 1` | 36 min | — |
| `NOISE_DUEL_2_Ensemble2x2000` | la même, `--offset 2` | 36 min | — |

Environ 3 h en tout, dont 1 h 40 pour la 1k@2k. Les durées sont celles des séries de `FinalLcb1` (23 – 24 min les 250
parties) et de `Budget4000` (34 – 36 min pour 4 000 contre 2 000). Si la nuit est trop courte, la 1k@2k passe
d'abord et `Ensemble2x2000` attend.

**Le lendemain** :

```
npm run versus -- "ismcts+widen=7+depth=5+core=stfig6+exact=12+crn=1@2000" "ismcts+widen=7+depth=5+core=stfig6+exact=12@2000" --label commondeals
npm run versus -- "ismcts+widen=7+depth=5+core=stfig6+exact=12+trees=2@4000" "ismcts+widen=7+depth=5+core=stfig6+exact=12@2000" --label ensemble2x2000
npm run versus -- "ismcts+widen=7+depth=5+core=stfig6+exact=12@4000" "ismcts+widen=7+depth=5+core=stfig6+exact=12@2000"
```

La dernière commande relit Budget4000 ; ses offsets 1 et 2 sont les donnes d'`Ensemble2x2000`.

| Si `CommonDeals` fait… | Alors |
| --- | --- |
| **52,7 % ou plus** (borne basse au-dessus de 50 %) | La série de confirmation, `VALIDATE_LONG_5/6_CommonDeals` (offsets 4 et 5), avant d'en faire la 1.3. `FinalLcb1` était tombé là. |
| **51 à 52,7 %** | La direction tient : `CommonDeals-FinalLcb1` (`+crn=1+final=1`) a sa 1k@2k la nuit suivante, avec les mêmes jobs et `+final=1`. |
| **sous 51 %** | La piste du bruit est close à 2 000, surtout si `Ensemble2x2000` reste vers 50 %. |

## 5. Le verdict

**Hors du bruit de la comparaison, la 1.2 est au plafond de ce qu'une astuce à budget égal peut montrer à 2 000.**

- **Le diagnostic laisse peu de place.** L'arbre n'apprend que sur deux étages (ses candidats, les réponses adverses).
  Tout ce qui le rend plus profond demande des visites qu'il n'a pas, et tout ce qui mêle un signal à ses simulations
  est moins bon qu'elles. La fusion de stratégies est réelle à la première réponse adverse, mais on ne peut la soigner
  qu'en partageant encore les 3 ou 4 visites d'une réponse.
- **Les idées qui restent valent chacune 2,5 points au plus** : `CommonDeals` +1 à +2,5, `ReplyFpu` ± 2 (signe inconnu),
  `CommonDeals-FinalLcb1` 0,5 à 1 de plus.
- **La 1k@2k ne voit pas ces écarts.** Sa marge est de ± 2,7 points (variance par paire 0,093, 500 paires). Une idée
  qui vaut vraiment +1,5 la passe 1 fois sur 5, une à +2 1 fois sur 3, une à +2,8 (Budget4000) 1 fois sur 2 ; une
  idée nulle, 1 fois sur 40. `FinalLcb1` (+1,5 sur 1 500 parties) et `Ensemble` (+1,0) sont sans doute de vrais petits
  gains que le protocole ne pouvait pas valider.

**Donc** :
- cette nuit, la 1k@2k de `CommonDeals`, la seule idée jamais essayée sur la faiblesse mesurée, gratuite et positive
  aux trois mesures du jour ;
- `Ensemble2x2000`, qui borne toute la famille ;
- ensuite, on s'arrête, sauf si l'un des cas ci-dessous se produit.

**Ce qui ferait changer d'avis** :

1. **`CommonDeals` à 52,7 % ou plus sur sa 1k@2k, puis au moins 51 % sur les offsets 4 et 5** (la confirmation, là
   où `FinalLcb1` est tombé) : la piste du bruit est ouverte. `CommonDeals` devient la 1.3, et
   `CommonDeals-FinalLcb1` est l'essai suivant.
2. **`Ensemble2x2000` aussi bon que Budget4000** sur les mêmes donnes (54,4 % sur les offsets 1 et 2) : le bruit du
   choix vaut environ 3 points à 2 000. Apparier davantage mériterait alors sa 1k@2k même si `CommonDeals` seul
   reste court : un élagage par moitiés sur donnes communes, ou une phase finale où les 2 ou 3 premiers candidats
   jouent les mêmes donnes.
3. **`ReplyFpu` à 54 % ou plus au tri, et qui tient à 2 000** : l'étage des réponses adverses, où va un cinquième
   du budget en premiers essais, est un levier. Ce serait une famille nouvelle.
4. **Un autre évaluateur** : une valeur ou une politique apprise, ou un modèle adverse qui sépare vraiment les mains
   (à 20 000 itérations). C'est un changement d'architecture, pas un réglage.

**Et sinon, la 1.3 viendra du budget.** La page donne jusqu'à 10 s par coup, et la 1.2 y fait ses 2 000 itérations
en 2,6 s au tour 3 : à `@4000`, elle gagnerait 2,8 points (Budget4000) en restant sous la limite. Et l'Oracle light
(56,0 % sur 420 parties) existe déjà sur deux workers (`docs/1.3-to-oracle-shift.md`).

## 6. Le résultat (nuit du 17/10)

Les 13 jobs ont tourné de 1 h 11 à 9 h 17 (`npm run versus`, intervalles par paires de donnes) :

| Série | Parties | Score contre la 1.2@2000 | Sur les mêmes donnes |
| --- | --- | --- | --- |
| `CommonDeals` (offsets 0 à 3) | 1 000 | **50,7 % (48,2 – 53,2)** : 49,6 / 52,8 / 52,0 / 48,4 | — |
| `Ensemble2x2000` (offsets 1 et 2) | 500 | **54,6 % (50,8 – 58,4)** : 54,0 / 55,2 | Budget4000 : 54,4 % |
| `OracleLight-Pwl3-Trees2` (offsets 12 à 14) | 420 | 53,6 % (49,7 – 57,4) | l'arbre unique : 56,0 % |
| `OracleLight-Pwl2-Trees2` (offsets 12 et 13) | 280 | **57,9 % (52,3 – 63,4)** | `Pwl3-Trees2` : 53,9 % ; `pwl=2` en un arbre : 52,5 % |
| `Oracle3-Pwl3-Trees2` (offsets 12 et 13) | 280 | 55,4 % (50,3 – 60,4) | Oracle3 en un arbre : 57,1 % |

- **`CommonDeals` est écarté** : 50,7 %, sous les 51 % du tableau de décision. Le regret mesuré de jour à 400
  (−0,43 point) ne s'est pas traduit en parties à 2 000. Une part vient sans doute de la mesure elle-même : la
  référence (chaque candidat cherché seul 400 fois) était calculée sous `crn`, ce qui avantageait `crn`.
  `CommonDeals-FinalLcb1` n'a plus d'objet.
- **Mais le bruit vaut des points** : deux arbres de 2 000 indépendants font autant qu'un arbre de 4 000 sur les mêmes
  donnes (54,6 contre 54,4 %). Le gain du budget ×2 est donc, pour l'essentiel, la baisse du bruit du coup joué, pas
  un arbre plus profond. Ce bruit n'est pas celui des donnes de la racine (que `CommonDeals` apparie) : c'est celui du
  chemin que prend chaque arbre (quelles réponses adverses il essaie d'abord, ses simulations), que seuls des arbres
  indépendants moyennent. À budget égal, deux arbres de 1 000 perdaient la profondeur (`Ensemble`, 51,0 %).
- **Ce que ça donne pour la page** : deux arbres de 2 000 sur deux workers jouent dans le temps de la 1.2 (2,6 s au
  tour 3), comme l'Oracle light. C'est du calcul en plus, pas une idée, mais à temps égal pour le joueur. La 1k@2k
  complète (offsets 3 et 4, les autres donnes de Budget4000) est en file, reportée à la nuit du 18-19/10 ; si elle tient,
  c'est la version de page la moins chère au-dessus de la 1.2.
- **L'Oracle light en deux arbres préfère `pwl=2`** : sur les mêmes donnes, 57,9 % contre 53,9 % avec `pwl=3`, alors
  qu'en un arbre de 10 000 `pwl=3` menait (57,1 contre 52,5 %). Des arbres de 5 000 veulent un niveau plus bas,
  comme Sami le pensait. Dans le bruit à 280 parties (± 5,6) : l'offset 14 est en file. Au-dessus de 56 % sur 420
  parties, l'Oracle light 1.1 passe à `pwl=2` (un moteur différent, donc une version).
- **Oracle3 en deux arbres n'apporte rien** : 55,4 % contre 57,1 % en un arbre, pour deux fois le temps de l'Oracle
  light. Il ne vient pas dans la page.

**Le verdict, revu** : la 1.2 est au plafond à 2 000 pour tout ce qui ne rajoute pas de calcul. Les trois cas
« qui feraient changer d'avis » du § 5 ont été tranchés ou déplacés :
1. `CommonDeals` ne passe pas : la piste des donnes communes est close.
2. `Ensemble2x2000` égale Budget4000 : le bruit vaut environ 2,5 points. Mais il ne se réduit qu'avec des arbres
   indépendants. Apparier davantage (élagage par moitiés sur donnes communes, finalistes appariés) viserait le mauvais
   bruit et n'est pas proposé.
3. `ReplyFpu` restait une famille nouvelle, sans priorité : son effet avait un signe inconnu. Codé le 17/10 et joué
   de jour à 2 000 (§ 2) : quatre marges, la meilleure (`fpu=1`) à 51,5 % (49,0 – 54,0) sur 1 000 parties, écartée.

**La suite** : la 1.3 de la page sera « la 1.2 sur deux workers » (`Ensemble2x2000`) si ses offsets 3 et 4 tiennent,
ou la 1.2@4000. L'Oracle light reste au-dessus.

**La nuit du 18-19/10** : les offsets 3 et 4 ne tiennent pas (46,0 et 50,4 %). Sur 1 000 parties, `Ensemble2x2000`
fait **51,4 % (48,7 – 54,1)** : pas de « 1.2 sur deux workers ». Le point 2 du verdict est à revoir : le bruit du coup
joué vaut au plus 1 à 2 points à 2 000, pas 2,5. `OracleLight-Pwl2-Trees2` fait 56,0 % (51,7 – 60,2) sur 420 parties,
+2,4 points (−3,4 – +8,2) sur la version de la page : pile à la barre, la décision revient à Sami. `MirrorMoves`
s'arrête à 47,8 % (44,2 – 51,4) après deux duels.
