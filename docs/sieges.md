# L'avantage du siège et sa compensation (16/10)

Réponse au prompt `docs/agents/prompt-fable-sieges.md`. Tout ce qui suit est mesuré à la règle de la page
(`claim-end`, `OFFICIAL_RULES`). Les outils : `npm run seats` (lecture seule des duels gardés), `npm run deals --
--engine E --plays 1 [--seat …] [--paired …]` (un robot contre lui-même, une partie par donne neuve) et les
compensations de `src/config/seats.js`, éteintes par défaut. Le vocabulaire : `docs/glossaire.md`, « Les sièges ».

## En bref

- **L'avantage du second dépend de la force.** Le même robot des deux côtés, 40 000 donnes neuves : le premier joueur
  gagne 46,1 % avec Basique, 47,2 % avec `strategist`, 49,2 % avec le cœur de la 1.2. Dans les duels gardés, la
  famille de la 1.2 (`exact=12`, @2000) est à 49,3 %, les arbres plus anciens à 47,9 %. Le 48,5 % des 35 178 parties
  mélange les deux, et compté par donne il vaut 46,9 – 50,1 % (les duels rejouent 1 951 donnes ~18 fois chacune).
- **Le mécanisme : le second répond.** Il joue chacune de ses cartes en ayant vu une carte de plus de l'adversaire.
  Sur les bornes, il complète son côté en dernier dans 54 % des bornes pleines des deux côtés, et celui qui complète en
  dernier les gagne à 74,5 % : il sait ce qu'il doit battre. Le premier se rattrape en partie par les revendications
  (il complète d'abord, il prouve d'abord) : **sans revendications, l'écart grandit d'environ 2 points.**
- **Écartés par la mesure** : l'ordre des revendications (319 parties sur 35 178, gagnées 168 contre 151 par le
  premier), le trait quand la pioche se vide (il favorise le premier), la règle d'égalité (déjà établi), ouvrir une
  borne (49,7 contre 50,3 %). La fin de partie mal jouée par les arbres sans `exact=12` est un artefact de robot.
- **Où l'écart se fait** : au milieu de partie tardif (coups 20 à 30). Regarder la pioche ne sert qu'à ses derniers
  tours ; 7 cartes pendant les 4 premiers tours ne servent à rien.
- **La recommandation : B, « Avant chacun de ses coups, le premier joueur regarde la carte du dessus de la pioche ».**
  Pour les trois robots rapides, elle ramène le premier joueur à 50,3 / 49,5 / 50,8 %, et son effet croît avec l'écart
  à combler (+4,3 / +2,4 / +1,5 points). Elle ne déplace ni la durée des parties, ni la part des victoires à la
  majorité, ni le joker. **À confirmer cette nuit sur la 1.2 à 400 itérations**, où elle pourrait trop donner
  (+5,3 ± 7,5 points sur 300 parties à 150 itérations).

## 1. D'où vient l'avantage du second

### Les duels gardés, par phase (`npm run seats`)

| Moteurs | Parties | 1er joueur | Finies avant la pioche vide | Position au coup 30 (solveur) | Jeu de la fin | Fins gagnées jetées (1er / 2e) |
| --- | --- | --- | --- | --- | --- | --- |
| arbres @2000 et plus | 35 178 | 48,5 % | 2 355 : 42,8 % (0,48 pt) | 49,5 % (0,45 pt) | 49,1 % (0,40 pt) | 494 / 328 |
| … avec `exact=12` (la famille de la 1.2) | 14 870 | 49,3 % | 1 070 : 44,7 % (0,38 pt) | 49,8 % (0,23 pt) | 49,9 % (−0,13 pt) | 0 / 0 |
| … sans `exact=12` | 16 700 | 47,9 % | 969 : 41,7 % (0,48 pt) | 49,3 % (0,68 pt) | 48,4 % (0,80 pt) | 431 / 292 |

Les points sont la part de l'écart à 50 % qui vient de chaque phase. Le reste (0,17 à 0,19 pt selon le groupe) vient
des positions au coup 30 trop grosses pour le solveur (151 chez les arbres, au-delà de 400 000 positions) : le second
en gagne 89 %. Les quatre parts font les 1,5 point des arbres.

- **La famille de la 1.2 n'a presque plus d'avantage du second** : 49,3 %, et sa fin de partie ne coûte rien. Le
  solveur exact joue tout à partir de 12 cartes : dans les 13 738 parties de ce groupe encore en cours et résolues au
  coup 30, le camp qui tenait la victoire ne l'a jamais perdue.
- **Les arbres plus anciens** (solveur à 8 cartes) jettent des fins gagnées, et plus souvent en premier : 431 contre 292.
  C'est le joueur qui doit s'engager le premier dans la fin de partie qui se trompe. Un artefact de robot pour la 1.2,
  mais peut-être pas pour un humain.
- **Les parties finies avant la pioche vide** (7 %) vont au second à 55 – 58 % dans tous les groupes.
- **L'intervalle par donne** : 48,5 % (46,9 – 50,1 %) sur 1 951 donnes. Le chiffre des duels gardés ne prouve un
  avantage du second qu'au bord ; les robots rapides sur des donnes neuves le prouvent nettement.

### Le même robot des deux côtés, sur des donnes neuves

40 000 donnes, une partie par donne, ± 0,5 point. À la règle de la page (`npm run deals -- --engine E --plays 1
--deals 40000`, offset 0) : Basique **46,1 %**, `strategist` **47,2 %**, le cœur **49,2 %**. Sur d'autres donnes, les
trois façons de régler les bornes (les mêmes 40 000 donnes par colonne) :

| Robot | Revendications (la page, `claim-end`) | Bornes réglées à la fin (`final`) | Bornes réglées dès qu'elles sont pleines (`early`) |
| --- | --- | --- | --- |
| Basique (`greedy`) | 46,2 % | 44,3 % | 44,3 % |
| `strategist` | 47,6 % | 45,8 % | 46,3 % |
| le cœur de la 1.2 (`core:stfig6`) | 49,3 % | 47,1 % | 47,5 % |

Pour mémoire, dans le glossaire : le 1.0 contre lui-même à 800 itérations, 44,9 % ; et « le tour critique » (une erreur
au hasard coûte ≈ 24 points au premier joueur aux tours 13 à 21, ≈ 10,5 au second).

**L'écart fond quand le jeu s'améliore**, et **il existe sans revendications**, plus grand de 1,3 à 2,2 points : la
règle imprimée le réduit déjà.

### Les mécanismes, un par un

| Mécanisme | La mesure | Ce qu'elle dit | Verdict |
| --- | --- | --- | --- |
| **Le second voit l'engagement adverse** : sur une borne, celui qui complète en dernier sait ce qu'il doit battre | bornes pleines des deux côtés (71 087) : qui complète en dernier, et qui gagne | le second complète en dernier dans 53,9 % des cas ; le dernier à compléter gagne 74,5 % (71,6 % s'il est premier, 77,0 % s'il est second) ; le second gagne 54,6 % de ces face-à-face | **mesuré, la source principale** |
| … et ouvrir une borne coûte-t-il ? | qui pose la première carte d'une borne, et qui la gagne | 49,7 % pour le premier qui ouvre, 50,3 % pour le second : neutre | écarté |
| **Le moment où les bornes se ferment** (les revendications) | revendications contre un côté incomplet ; les mêmes robots sans revendications | le premier en gagne 52,1 % (66 901 contre 61 565) : compléter d'abord, c'est prouver d'abord ; sans revendications, l'écart grandit de 1,3 à 2,2 points | **mesuré, une compensation partielle, pas la source** |
| **L'ordre des revendications** (celui qui vient de jouer revendique d'abord) | après le dernier coup, le perdant pouvait-il aussi revendiquer une victoire ? (`--claims`) | 319 parties sur 35 178 (0,9 %), gagnées 168 par le premier, 151 par le second | écarté (il aide le premier de 0,05 point) |
| **Le rythme des pioches** : le second pioche la dernière carte, le premier joue le premier coup sans pioche | positions du coup 30 résolues deux fois, chaque joueur au trait (`--tempo`) | sur 1 595 positions, le vainqueur change 39 fois : 29 en faveur de celui qui joue, 10 de celui qui attend. Le trait vaut environ un point, et c'est le premier qui l'a | écarté (il favorise le premier) |
| **La fin des parties** : sur quel coup elles finissent | la part des parties qui finissent à chaque coup, parmi celles encore en cours | à partir du coup 33, chaque coup du second finit la partie plus souvent que les coups du premier qui l'entourent : 14,3 → **22,4** → 25,2 → **37,3** → 41,7 → **57,1** → 55,6 → **73,1** % (coups 33 à 40, le second en gras) ; 13 343 victoires du second sur son propre coup, 11 756 du premier | mesuré, la même chose vue d'en haut : le second a le dernier mot |
| **La règle d'égalité** (le premier à compléter gagne) | bornes départagées ainsi | 466 sur 199 553, 232 contre 234 (revue du 16/10) | écarté |
| **Les passes** (aucun coup légal) | qui passe, et qui gagne | le premier passe 2 898 fois, le second 1 635 (il remplit ses côtés plus tôt) ; passer n'est pas un handicap : le premier à passer gagne 48,0 % quand c'est le premier joueur, 56,8 % quand c'est le second | marginal (11 % des parties) |
| **La fin de partie jouée** | fins gagnées perdues, par siège | 431 contre 292 sans `exact=12`, 0 contre 0 avec | artefact des robots qui ne résolvent pas la fin |

**Où se fait l'écart.** Deux mesures de compensation le situent (section 3). Regarder la carte du dessus ne rapporte
qu'à ses derniers tours : jusqu'au tour 6, rien ; les deux derniers (tours 14 et 15, coups 27 et 29) rapportent à eux
seuls 0,9 à 1,1 point : plus que les treize premiers pour le cœur (1,0 contre 0,5), presque autant pour `strategist`
(1,1 contre 1,3). Et 7 cartes
pendant les 1 à 4 premiers tours ne rapportent rien, contre +14 points pour toute la partie. Le premier joueur souffre au
milieu de partie tardif, quand les bornes se complètent et se prouvent, pas à l'ouverture.

**L'explication.** Le second pose chacune de ses cartes en ayant vu une carte de plus du premier. Comme le premier a
toujours une carte d'avance sur la table, il complète ses côtés d'abord, et le second complète en sachant ce qu'il doit
battre. La revendication rend une partie de l'avance à qui complète d'abord. Le reste dépend du jeu : un joueur fort
s'engage le premier sans trop se découvrir, un joueur faible se fait punir.

## 2. La part des règles et celle de l'information

**Ce qu'on sait déjà** : l'écart existe dans les trois façons de régler les bornes, et B le referme sans rien
montrer de l'adversaire (le premier ne voit que sa propre prochaine carte). L'information compte donc. Mais
« information » et « ordre des coups » sont mêlés : on ne les sépare qu'en donnant tout à voir aux deux joueurs.

**La mesure** : Omniscient contre Omniscient (`+omniscient=1` : les deux mains et la pioche vues), la part du premier
joueur. Si elle est à 50 %, l'avantage du second est d'information ; si elle reste à l'écart de la 1.2 à information
cachée au même budget, il vient des règles. Une réserve : l'Omniscient voit aussi la pioche, ce qui n'est pas « le jeu
sans information cachée » mais un autre jeu, où chacun regarde toutes ses pioches à l'avance.

**K et N.** Pour la part du premier joueur, **une partie par donne (K = 1)** est le plan le moins cher. Avec K parties
par donne, la variance par partie vaut (K σ²_donne + σ²_dans)/N : elle est minimale à K = 1, où elle vaut 0,25/N. La
donne pèse lourd (sur les duels gardés, l'écart-type entre donnes est de 24,4 points une fois le bruit retiré,
σ²_donne ≈ 0,059), et K = 10 coûterait trois fois plus de parties pour la même précision. Entre omniscients la donne pèse
encore plus. Pour ± 1,5 point : N = 1,96² × 0,25 / 0,015² ≈ 4 270 parties ; **N = 5 000 (deux jobs de 2 500 donnes)**,
± 1,4 point.

**La durée** : mesurée le 16/10 au soir à 18 fils, ~16 s par partie et par fil (le prompt disait ~30 s), soit
2 500 × 16 / 18 ≈ 37 min par job, 70 min au pire. Les deux jobs jouent les mêmes donnes que la 1.2 à information cachée
(offsets 20 et 21, section 4) : la différence se lit donne par donne (`--paired`).

**L'essai du 16/10** (50,0 %, 41,2 – 58,8, 120 parties) était vraisemblablement 12 donnes jouées 10 fois
(`--plays 10` par défaut). Son intervalle était compté partie par partie ; compté par donne, il fait au moins ± 16 points. `judgeDeals` compte désormais les donnes quand K > 1.

## 3. Les compensations, classées

Effet apparié sur 40 000 donnes (la même donne avec et sans la compensation, `--paired`), ± 0,5 à 0,7 point ; entre
parenthèses, la part du premier joueur qui en résulte. Bases : Basique 46,1 %, `strategist` 47,2 %, cœur 49,2 %.

| Rang | Nom | La phrase | Basique | `strategist` | cœur | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **`PeekAll` (B)** | Avant chacun de ses coups, le premier joueur regarde la carte du dessus de la pioche. | +4,3 (50,3 %) | +2,4 (49,5 %) | +1,5 (50,8 %) | **retenue** : à 50 ± 1 aux trois niveaux, l'effet suit l'écart |
| 2 | `Peek1` (A) | Avant son tout premier coup, le premier joueur regarde la carte du dessus de la pioche. | −0,0 | +0,1 | −0,1 | sans effet : la carte vue ne sert qu'au premier coup |
| 3 | `Hand7First` (C) | Le premier joueur reçoit 7 cartes, le second 6. | +13,8 (59,9 %) | +16,3 (63,5 %) | +14,4 (63,6 %) | dix fois trop |
| 4 | `Hand5Second` | Le second joueur reçoit 5 cartes au lieu de 6. | — | — | +15,1 (64,4 %) | dix fois trop |
| 5 | `PeekTurnsN` (B(N)) | Pendant ses N premiers tours, le premier joueur regarde la carte du dessus avant de jouer. | voir le réglage | | | le réglage de B, si B donne trop |
| 6 | `Peek2First` (A2) | Avant son tout premier coup, le premier joueur regarde les deux cartes du dessus. | +4,2 (50,3 %) | +1,6 (48,8 %) | −0,4 (48,8 %) | inégale : une carte de la main adverse sert un robot simple, pas un bon |
| 7 | `PeekUntilClaim` | Tant qu'aucune borne n'est gagnée, … | +2,7 | +0,9 | +0,1 | s'arrête avant les tours qui comptent |
| 8 | `PeekInPlay24` | Tant qu'il y a moins de 24 cartes posées, … | +3,2 | +1,1 | +0,2 | idem |
| 9 | `Hand7SkipN` | Le premier joueur reçoit 7 cartes et ne pioche pas après son N-ième coup. | N = 1, 2, 4 : −0,1 / −0,2 / +0,2 | −0,2 / −0,2 / +0,5 | −0,8 / −0,6 / −1,3 | sans effet : la carte en plus ne sert qu'en fin de partie |
| — | `peek=2` à chaque tour | Avant chacun de ses coups, il regarde les deux cartes du dessus. | +24,6 | +17,4 | +7,2 | bien trop : il voit tout ce que pioche le second, donc sa main |

« Le premier joueur pioche deux cartes à son premier tour » revient à C dès le tour 2 (+14 points). Une autre règle de
revendication n'a pas été codée : les revendications aident déjà le premier (+2 points contre les bornes réglées à la
fin), et leur ordre ne pèse rien.

**Le réglage B(N)** (effet en points ; la dernière pioche du premier est à son 15e tour, B = B(15)) :

| N | 6 | 10 | 12 | 13 | 14 | 15 (B) | À combler |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Basique | +0,1 | +2,2 | +3,2 | +3,4 | +3,7 | +4,3 | 3,9 |
| `strategist` | −0,3 | +0,6 | +1,1 | +1,3 | +1,7 | +2,4 | 2,8 |
| cœur | −0,1 | +0,1 | +0,2 | +0,5 | +0,7 | +1,5 | 0,8 |

L'effet croît avec N pour les trois robots. Le N qui ramène à 50 % : ~14,3 pour Basique, ~14 pour le cœur, plus de 15
pour `strategist`. Arrondi à une règle simple, c'est B. Si B donne trop aux robots forts, « pendant ses 12 premiers
tours » est le cran du dessous.

**Ce que B ne déplace pas** (Basique / `strategist` / cœur, sans → avec) : la durée (35,8 → 35,8 / 35,8 → 35,8 /
35,2 → 35,2 coups), la part des victoires à la majorité (53,5 → 53,7 / 52,5 → 52,6 / 52,2 → 52,7 %), le joker (celui qui
en a posé plus gagne 68,4 → 67,7 / 67,6 → 67,8 / 63,4 → 63,4 %).

**Le code** (commits `4b1b36e`, `5bdd6b8`, `5bbdd15`) : `createGame(spec, { …, seat })`, `seat` lu par
`parseSeat` (`src/sim/engine/seat-rules.js`) depuis un id ou un nom de `src/config/seats.js` ; rien par défaut.
- **Les mains** : `hands=a/b` distribue a et b cartes ; `skip=N` saute la pioche du premier après son N-ième coup.
- **Le regard** (`src/sim/engine/peek.js`) : `state.known`, pour chaque siège, combien de cartes du dessus il connaît et
  quelles cartes il sait dans la main adverse. Mis à jour à chaque pioche et à chaque carte posée ; le premier regarde
  au début de ses tours tant que la condition tient (`turns`, `claim`, `inplay`).
- **Les robots s'en servent** : `determinize` laisse les cartes vues à leur place (`dealKnowing`) pour celui qui les a
  vues, et tire le reste. Le cœur compte la carte qu'il va piocher comme une carte de sa main dans ses potentiels, et
  retire les cartes connues des non vues (`coreCounts`). Coût : rien de mesurable (1.2@400 : 18 s par partie et par
  fil avec B, 17,5 sans).
- **Les règles ne s'en servent jamais** : une revendication se prouve avec la table seule (`certainty.js` n'a pas
  changé).
- **Les empreintes n'ont pas bougé** : la 1.2 (`"ismcts+widen=7+depth=5+core=stfig6+exact=12@150,greedy" 20`)
  `1d041613cd7bcd8d`, `strategist,greedy 150` `abf3bc51801c81b4`, `core:stfig6,strategist 150` `067ba6d1c1f4b600` ; à
  la règle de la page, le cœur contre lui-même rejoue les mêmes 40 000 parties (49,2 %, 19 688 donnes gagnées par le
  premier).
- **Les replays** gardent `rules.seat` et se rejouent ; `tests/sim-engine/seat-rules.test.js` vérifie les mains, la pioche
  sautée, le regard (B, B(N), A2), `determinize` et les comptes du cœur.

## 4. Les jobs de nuit

Mis en file le 17/10 (`data/backlog.json`) pour la nuit du 17-18/10, reporté à celle du 18-19/10 (derrière MirrorMoves), dans cet ordre : chaque job apparié lit la base
écrite avant lui. Les sorties vont dans `tmp/` (une base manquante ne fait perdre que la comparaison, refaisable avec
`--compare`). Durées mesurées à 18 fils le 16/10 : la 1.2@400 ~19 s par partie et par fil, l'Omniscient@400 ~16 s.

```json
[
  { "id": "SEATS_1_Base", "command": "npm run deals -- --engine \"ismcts+widen=7+depth=5+core=stfig6+exact=12@400\" --plays 1 --deals 4500 --offset 20 --out tmp/seats-20-base.json", "estimate": "1 h 20", "limit": 118, "why": "La part du premier joueur pour la 1.2@400 contre elle-même, sans compensation : la référence de B (docs/sieges.md). Offset 20, 4 500 donnes neuves.", "status": "todo" },
  { "id": "SEATS_1_PeekAll", "command": "npm run deals -- --engine \"ismcts+widen=7+depth=5+core=stfig6+exact=12@400\" --plays 1 --deals 4500 --offset 20 --seat PeekAll --paired tmp/seats-20-base.json --out tmp/seats-20-peekall.json", "estimate": "1 h 20", "limit": 118, "why": "B : le premier joueur regarde la carte du dessus avant chaque coup. Mêmes donnes que SEATS_1_Base, effet donne par donne.", "status": "todo" },
  { "id": "DEALS_1_Omniscient", "command": "npm run deals -- --plays 1 --deals 2500 --offset 20 --paired tmp/seats-20-base.json --out tmp/seats-20-omniscient.json", "estimate": "40 min", "limit": 118, "why": "La part des règles : Omniscient contre Omniscient à 400, une partie par donne, sur les 2 500 premières donnes de SEATS_1_Base.", "status": "todo" },
  { "id": "SEATS_2_Base", "command": "npm run deals -- --engine \"ismcts+widen=7+depth=5+core=stfig6+exact=12@400\" --plays 1 --deals 4500 --offset 21 --out tmp/seats-21-base.json", "estimate": "1 h 20", "limit": 118, "why": "La référence, deuxième moitié (offset 21) : 9 000 parties en tout, ± 1,0 point.", "status": "todo" },
  { "id": "SEATS_2_PeekAll", "command": "npm run deals -- --engine \"ismcts+widen=7+depth=5+core=stfig6+exact=12@400\" --plays 1 --deals 4500 --offset 21 --seat PeekAll --paired tmp/seats-21-base.json --out tmp/seats-21-peekall.json", "estimate": "1 h 20", "limit": 118, "why": "B, deuxième moitié : l'effet sur 9 000 donnes, ± 1,2 point.", "status": "todo" },
  { "id": "DEALS_2_Omniscient", "command": "npm run deals -- --plays 1 --deals 2500 --offset 21 --paired tmp/seats-21-base.json --out tmp/seats-21-omniscient.json", "estimate": "40 min", "limit": 118, "why": "La part des règles, deuxième moitié : 5 000 parties d'omniscients, ± 1,4 point.", "status": "todo" }
]
```

Total : ~6 h 40 (8 h 30 au pire). **Lire les résultats** :

```bash
npm run deals -- --compare tmp/seats-20-peekall.json,tmp/seats-21-peekall.json tmp/seats-20-base.json,tmp/seats-21-base.json
npm run deals -- --compare tmp/seats-20-omniscient.json,tmp/seats-21-omniscient.json tmp/seats-20-base.json,tmp/seats-21-base.json
```

Le premier donne la part du premier joueur avec et sans B (± 1,0 point chacune) et l'effet de B donne par donne
(± 1,2 point). Le second donne la part entre omniscients (± 1,4 point) et la différence avec la 1.2 à information cachée
sur les mêmes donnes.

**La nuit suivante, selon B** (à décider le matin, pas de `stopIf` pour ces jobs : il ne lit que les duels) :
- **B à 49 – 51 %** : rien de plus ; B est la règle.
- **B au-dessus de 51 %** : le réglage, sur les mêmes offsets. `SEATS_1_PeekTurns12`, `SEATS_2_PeekTurns12`, puis
  `…PeekTurns13` : la même commande que `SEATS_n_PeekAll` avec `--seat "peek=1+turns=12"` (ou `13`) et
  `--out tmp/seats-2n-peekturns12.json` ; 4 jobs, ~5 h 20. On interpole le N qui donne 50 % et on l'arrondit (« pendant
  ses 12 premiers tours »).
- **B sous 49 %** : rien de plus simple ne donne plus. `peek=2` à chaque tour donne bien trop, et C (7 cartes) dix fois
  trop. Il faudrait une nouvelle option (deux cartes au premier tour puis une) ; à discuter.

## 5. La recommandation

**B : « Avant chacun de ses coups, le premier joueur regarde la carte du dessus de la pioche, sans la montrer. »** Il la
pioche ensuite après son coup, comme d'habitude : en pratique, il sait toujours quelle carte il va recevoir.

- **Pourquoi elle** : une phrase, rien à compter ni à retenir. Aux trois niveaux de robot, elle ramène le premier
  joueur à 50 ± 1 %, alors que l'écart va de 0,8 à 3,9 points : plus le second a d'avance, plus la carte vue sert.
  Elle ne change ni la durée, ni la façon de gagner, ni le joker. Elle répond au mécanisme : le second a une carte
  d'information de plus, le premier en reçoit une. Les autres pistes ratent : A ne sert à rien, C donne dix fois trop,
  A2 sert un robot simple et pas un bon.
- **Ce qui la ferait changer** :
  - **la nuit** : si la 1.2@400 avec B passe 51 %, B donne trop aux joueurs forts, et le réglage B(N) prend le relais
    (N ≈ 12 – 13, à mesurer). À 150 itérations, B donnait déjà +5,3 points (−2,2 – +12,8) : l'arbre se sert mieux de la
    carte que le cœur.
  - **les omniscients** : s'ils gardent le même écart que la 1.2 à information cachée, l'avantage du second vient des
    règles, pas de l'information. B resterait une correction qui marche, mais pas pour la raison donnée ici.
  - **les humains** : un humain qui oublie de se servir de la carte n'en tire rien. Un robot simple en tire 4 points ;
    un humain qui joue « au feeling » est sans doute entre Basique et `strategist`. Le seul juge sera la table : les
    parties réelles (`data/irl/essais.json` n'en a que 10, sans les sièges) ou, dans la page, des parties où l'humain
    commence avec B. La page ne montre pas encore la carte du dessus : il faudrait l'afficher au joueur humain quand il
    commence (les robots s'en servent déjà, par le moteur).
- **La feuille de règles n'est pas modifiée** : la phrase attend la nuit et la décision de Sami. Pour l'imprimer, il
  suffira de l'ajouter au déroulement du tour de `regles/regles.html` (et de vérifier que les trois pages tiennent en A4).
