# L'oracle, `stfig` et l'Expérimental 1.0 (03/10 – 04/10)

Journal de la stratégie des robots, chapitre 3 sur 6. [← le registre](../strategie.md) · [← 02/10](02-le-0.9.md) · [04/10 – 06/10 →](04-labo-a-2000.md)

## L'oracle sur les replays (03/10, en cours)

**L'idée de Sami** : il ne trouve plus, en jouant, ce que le cœur rate. Un
arbre très large sur des positions réelles le trouvera peut-être : un coup que
l'arbre préfère et que le cœur ne met pas dans son top 3 est une omission du
cœur, donc une piste d'évolution.

**Ce que regarde le 0.9** : à la racine, les **8** meilleurs coups du cœur
(`candidates`) ; en dessous, ses **3** meilleures réponses (`widen`). Un coup
hors du top 8 n'est jamais examiné.

**L'oracle** (`npm run oracle`, `src/replay/oracle/oracle.js`) :
`ismcts+candidates=99+widen=6+depth=5@20000`, soit **tous** les coups légaux à
la racine (jokers refusés par l'habitude compris), 6 réponses par nœud, 25 fois
le budget du 0.9. Deux recherches de graines différentes ; un **écart** est leur
coup commun hors du top 3 du cœur (et noté s'il est hors du top 8).
- Positions : tours 15-16, 20-21 et 25-26 des 600 parties du 0.9 contre lui-même
  (les deux joueurs) ; et, avec `--at last-column`, le coup où chaque joueur
  remplit sa dernière colonne vide (1 187 positions, tour médian 16 — l'intuition
  de Sami : ce coup pèse lourd sur la suite).
- **Le coût** : 1,5 à 2,5 min de calcul par position au tour 25, environ 6 min
  au tour 15 (42 coups légaux) — cinq fois l'estimation faite sur le 0.9, l'arbre
  étant bien plus large. Environ 10 à 14 s par position sur 23 fils.
- **Deux économies** (Sami : ne pas perdre de temps) : une recherche s'arrête
  dès que son coup favori ne peut plus être rattrapé (`+smart=1`), et la
  seconde recherche, celle qui vérifie que la première n'a pas eu de chance,
  n'est lancée que si la première sort du top 3 du cœur — ailleurs il n'y a pas
  d'écart à confirmer.
- **Le backlog plafonne chaque traitement à 2 h** (`limit`, arrêté au-delà avec
  tous ses processus) ; l'oracle s'arrête de lui-même à 110 min.
- Chaque position est écrite dès qu'elle est lue (`oracle/positions.jsonl`, hors
  de git) ; une nouvelle passe reprend où la précédente s'est arrêtée. Le résumé
  va dans `data/oracle-diffs.json`.
- **Ensuite** : confirmer chaque écart par le jeu (le coup de l'oracle contre le
  premier du cœur, suite jouée par le 0.9, jugée au tour 30 ; `branchFrom` accepte
  désormais un coup à forcer), puis chercher les motifs.

## Les résultats de la nuit du 03/10

**Dans l'arbre, contre le 0.9** (duels longs, règle de la page, deux jeux de
donnes réunis) :

| Cœur | Donnes 0 | Donnes 1 | Réunis |
| --- | --- | --- | --- |
| `jkx` (junk + obex) | 48,6 % | 54,9 % | 51,7 % (46,6 – 56,9), 144 paires |
| `jk2` (junk seul) | 54,9 % | 50,0 % | 52,4 % (47,0 – 57,8), 144 paires |
| `obex` | 49,5 % | 51,6 % | 50,5 % (45,8 – 55,2), 192 paires |

- **Rien de net.** Le gain du cœur seul (+4 pour `jkx`) passe en partie dans
  l'arbre (environ +2), mais un duel de 20 min (144 à 192 parties) ne voit pas
  2 points. Quatre duels de plus pour `jkx` (`--offset 2` à `5`) porteront le
  total à environ 430 paires, soit ± 3 points.
- **Les deux phases, sur des parties entières** (`npm run ab`, 400 donnes contre
  le Stratège) : le 0.9 fait 66,8 % ; bascule au tour 20 : −1,3 ± 4,2 points ;
  bascule à la première borne : −2,0 ± 4,3. **Écarté.**

**Le prix d'une erreur, complet de 1 à 29** (les tours 1, 3-5 et 15-17 dans le
tableau du « tour critique ») :
- **Tours 1 à 5 : 0,4 point en moyenne.** Le brouillard du début se confirme.
- **Tours 15 et 17 : 27,9 et 26,7 points**, autant que le cœur de la zone chère.
  **Elle commence donc au tour 15**, pas au tour 19 : de 15 à 29, une erreur
  coûte 19,4 ± 2,1 points en moyenne, contre 11,9 ± 3,2 de 6 à 14. Le tour 18
  (2,9 ± 8,1) paraît isolé, sans doute du bruit.

**L'oracle au coup qui remplit la dernière colonne vide** (1 187 positions,
99 min) — **non confirmé** :
- l'oracle ouvre aussi une colonne vide dans 36,6 % des cas, et **joue ailleurs
  dans 63,4 %** ;
- il joue le coup du 0.9 dans 22,6 % des cas ;
- un écart stable hors du top 3 du cœur dans **50,1 %** des positions, hors du
  top 8 dans environ 37 % ;
- son favori reçoit en médiane 27 % des visites, avec 0,115 d'avance sur le second.

Ce taux d'écart est trop haut pour être pris tel quel : soit le cœur rate
beaucoup, soit l'oracle (simulations jouées par le cœur, 6 réponses par nœud)
se disperse. **Rien ne dit encore que l'oracle joue mieux que le 0.9.** La
confirmation par le jeu (le coup de l'oracle contre celui du cœur et celui du
0.9, suite jouée par le 0.9, jugée au tour 30) passe avant toute recherche de
motifs.

**La vitesse de l'oracle** : 3,7 s par position sur tous les fils, au lieu des
10 à 14 s estimées — les correctifs de vitesse du cœur, la seconde recherche
seulement quand il faut, l'arrêt anticipé.

**Les temps du cœur de la rétrospective** sont désormais une donnée
(`data/core-timings.json`), remesurée seulement par `npm run retrospective --
--measure`, sur une machine au repos : la page construite pendant le backlog
affichait 120 itérations par seconde au lieu de 556.

**La confirmation par le jeu** (`npm run oracle -- --confirm`,
`scripts/lib/domain/oracle-confirm.js`) : pour chaque écart, le coup de l'oracle, le
premier du cœur et celui du 0.9 sont forcés, puis la partie est jouée par le
0.9 des deux côtés sur 4 graines et jugée au tour 30 par le solveur exact. Le
verdict d'ensemble est l'avance moyenne du coup de l'oracle sur celui du cœur
et sur celui du 0.9, par groupe (dernière colonne, tours fixes, marge de
l'oracle, hors du top 8). Un essai sur 3 écarts : 3,5 à 10 min de calcul par
écart, machine chargée. Les 1 176 écarts trouvés à 9 h passent la nuit du
03/10 (deux traitements de 110 min, programmés à partir de 21 h). Dans 196 de
ces écarts, le coup de l'oracle est celui que le 0.9 avait joué : son arbre
l'avait trouvé, hors du top 3 du cœur.

**L'oracle sur toutes les positions** (4 331 positions lues le 03/10, en
3 h 30 au total) — **non confirmé**, la confirmation par le jeu passe la nuit
suivante :

| Positions | Nombre | Écart hors du top 3 du cœur | hors du top 8 | L'oracle joue le coup du 0.9 |
| --- | --- | --- | --- | --- |
| tours 15-16 | 858 | 60 % | 40 % | 23 % |
| tours 20-21 | 1 105 | 56 % | 35 % | 25 % |
| tours 25-26 | 1 181 | 48 % | 31 % | 27 % |
| dernière colonne | 1 187 | 50 % | 37 % | 23 % |

- Les deux joueurs donnent les mêmes taux : celui qui a commencé 53,9 %
  d'écarts, l'autre 52,3 %.
- **Ce qui distingue le coup de l'oracle du premier coup du cœur**, sur les
  2 300 écarts :

  | Trait | oracle | cœur |
  | --- | --- | --- |
  | bâtit un côté ni brelan ni suite de couleur | 33 % | 9 % |
  | répond à une borne adverse | 7 % | 30 % |
  | pose une 2e carte | 65 % | 51 % |
  | complète un côté (3e carte) | 27 % | 17 % |
  | ouvre sans suite prévue en main | 4 % | 18 % |
  | joker | 14 % | 4 % |

- **L'oracle approfondit plutôt qu'il n'élargit** : il reste sur ses côtés déjà
  entamés au lieu de répondre ou d'ouvrir. Et il bâtit bien plus de côtés sans
  figure, à l'inverse de la règle `junk` — ce qui pourrait être une façon de
  sacrifier une borne pour en tenir d'autres.
- **Tant que la confirmation n'a pas parlé, ce sont des pistes, pas des
  règles** : l'oracle joue ses simulations avec le cœur, et ses écarts
  pourraient venir de sa dispersion (son favori ne reçoit que 27 % des visites
  en médiane). Le résumé est dans `data/oracle-diffs.json` (les taux et ce
  comparatif ; les écarts eux-mêmes restent dans `oracle/positions.jsonl`).

## Pousser le cœur dans le sens de l'oracle (03/10)

**L'idée de Sami** : des bonus qui alignent le cœur sur les écarts de l'oracle,
testés un par un puis ensemble, en cœur contre cœur (machine libre, 3 min 30
de calcul en tout).

**Les idées** (`src/sim/heuristics/oracle-ideas.js`) : `stay`, une carte sur un côté déjà
commencé ; `noAnswer`, un malus pour répondre à une borne adverse ;
`noBlindOpen`, un malus pour ouvrir une borne vierge sans rien en main pour y
bâtir. Les côtés sans figure sont `junk` à poids négatif, et les jokers libres
un cœur sans l'habitude `joker`.

| Cœur | Contre le cœur du 0.9 |
| --- | --- |
| `stay` 0,1 / 0,2 | 48,6 % / 50,9 % (puis 49,7 % et 50,1 %) |
| **`stay` 0,4** | **51,9 %, 50,7 %, 52,1 %** |
| `stay` 0,8 | 44,5 %, 45,8 % |
| `noAnswer` 0,1 / 0,2 | 50,4 % (puis 50,2 %, 50,3 %) / 50,0 % |
| `noBlindOpen` 0,1 / 0,2 | 50,0 % / 50,3 % |
| `junk` à −0,1 / −0,2 (des côtés sans figure, comme l'oracle) | **44,3 % / 38,8 %** |
| sans l'habitude `joker` | 48,9 % |
| tout ensemble (0,1 / 0,2), sans `junk` négatif | 45,5 % / 47,8 % ; 49,1 % |

- **Rester sur ses côtés déjà entamés paie, au bon poids** : `stay` à 0,4 gagne
  sur les trois jeux de donnes ; à 0,8 il perd nettement.
- **Les côtés sans figure de l'oracle font perdre le cœur** (44 % et 39 %) : ils
  donnent raison à `junk`. Si l'oracle voit juste, c'est qu'il les bâtit pour
  une raison que le cœur ne voit pas (sacrifier une borne) ; la confirmation de
  ce soir le dira.
- **Le reste est neutre** : répondre ou non, ouvrir sans figure prévue.
- **Avec `jkx`** (cœur `jkxs` : junk 0,2, outbid 0,2, exposure 0,2, stay 0,4) :
  51,6 %, 52,1 %, 52,0 % contre `jkx`, et **55,5 %, 54,7 %, 54,5 %** contre le cœur
  du 0.9 — le meilleur cœur à ce jour. Deux duels longs dans l'arbre sont au
  backlog de ce soir (`duel-jkxs-0`, `-1`), avant ceux de `jkx`.

## `stay` dans l'arbre, et la variante gagnante : `stfig` (03/10)

**Dans l'arbre, à 400 itérations, en miroir** (chaque donne jouée des deux
sièges), 10 min :
- le 0.9 avec `stay` 0,4 contre le 0.9 : **58,3 % (52,1 – 64,6)**, 96 paires ;
- le 0.9 avec `stfig` 0,6 contre le 0.9, sur d'autres donnes : 54,9 %
  (47,8 – 61,9), 72 paires.
- Deux tendances positives, mais à ± 7 points : les tris de 10 min ont déjà
  trompé (57-60 % retombés à 49 %). Les duels longs de ce soir trancheront.

**Depuis le tour 10** (`npm run core-test -- … --from 10`, 100 parties) :
`stay` 0,4 fait −0,5 ± 6,0 points. Si son effet est réel, il se joue avant le
tour 10, quand on choisit entre approfondir et ouvrir : une partie entière est
la bonne mesure.

**Les variantes de `stay`, cœur contre cœur** (paramètres de
`src/sim/heuristics/oracle-ideas.js`) :

| Cœur | Contre le cœur du 0.9 |
| --- | --- |
| `stay` 0,3 / 0,4 / 0,5 | 50,8 % / 51,9 % / 52,6 % |
| seulement la 2e carte / seulement la 3e | 50,9 % / **44,6 %** |
| jusqu'au tour 20 / à partir du tour 20 | 51,9 % / 49,1 % |
| seulement si l'adversaire a entamé autant de bornes ou plus | 52,2 % |
| **seulement si le côté peut encore devenir un brelan ou une suite de couleur (`stfig`)** | 0,4 : 55,1 %, 55,6 %, 56,8 % |
| **`stfig` 0,6** | **58,0 %, 57,9 %, 58,0 %** |
| `stfig` 0,8 / 1,0 / 1,2 / 1,5 | 57,0 % / 56,6 % / 55,5 % / 55,5 % |
| `jkx` + `stfig` 0,6 (`jkxf6`) | 57,9 %, 58,0 %, 57,6 % ; contre `stfig6` : 50,8 %, 49,2 % |

- **`stfig` 0,6 est le plus gros gain du cœur à ce jour : +8 points**, régulier
  sur trois jeux de donnes. Rester sur ses côtés entamés paie, à condition
  qu'ils gardent une figure possible.
- **`jkx` ne s'y ajoute plus** : `stfig` couvre ce que faisait `junk` (ne pas
  bâtir de côté sans figure), par l'autre bout.
- **Compléter un côté pour le compléter fait perdre** (seulement la 3e carte :
  44,6 %).
- **Au backlog de ce soir** : quatre duels longs de `stfig6` dans l'arbre (environ
  300 paires), à la place de ceux de `jkx` et `jkxs`.

## Des bonus seulement aux tours 1 à 10 (03/10)

**L'idée de Sami** : l'arbre est faible au début de la partie (trop de coups à
examiner) et fort ensuite. Des bonus écartés alors qu'ils gagnaient 51 % ou plus
pourraient aider aux tours 1 à 10 et nuire après. Chaque bonus est donc testé
**actif seulement aux tours 1 à 10** (`earlyIdeas`, `earlyUntil`,
`src/sim/heuristics/tuning.js` : les idées s'ajoutent tant que `state.turn < 10`, dans les
vrais coups comme dans les simulations de l'arbre).

**Dans l'arbre, à 400 itérations, en miroir, 10 min par duel** (240 parties) :

| Cœur | Bonus aux tours 1-10 | Contre le 0.9 |
| --- | --- | --- |
| `jk2e10` | `junk` 0,2 | 47,9 % (42,0 – 53,9) |
| `obexe10` | `outbid` + `exposure` 0,2 | 52,1 % (46,4 – 57,8) |
| `jkxe10` | les trois | 48,8 % (42,7 – 54,8) |
| `wholee10` | `whole` | 49,2 % (43,3 – 55,1) |
| **`stay4e10`** | **`stay` 0,4** | **55,4 % (49,5 – 61,3)** |
| `stfig6e10` | `stfig` 0,6 | 51,7 % (45,5 – 57,8) |

- **Seul `stay` limité au début passe le seuil du tri (55 %).** Deux duels longs
  à 800 itérations sont au backlog de ce soir (`duel-stay4e10-0`, `-1`), comme le
  veut la règle 400 / 800.
- **`junk`, `obex`, `whole` limités au début ne gagnent rien** : leur faiblesse
  n'était pas de nuire en fin de partie.
- `stfig6` sur toute la partie (au backlog ce soir) dira si limiter `stfig` au
  début lui fait perdre ou non : ici 51,7 %.

## Les bonus du 0.9 limités aux tours 1 à 10 (03/10)

**L'idée de Sami** : les bonus du cœur du 0.9 jouent toute la partie. Les couper
après le tour 10, quand l'arbre voit assez loin, l'améliore-t-il ? Chacun est
gardé pour les tours 1 à 10 seulement (`earlyIdeas`, et pour les habitudes
`earlyHabits`, `src/sim/heuristics/tuning.js`), un à la fois. `certain` n'est pas testé :
ce n'est pas un bonus, mais la connaissance exacte des bornes déjà perdues.

**Dans l'arbre, 400 itérations, en miroir, 10 min par duel** :

| Bonus gardé aux tours 1-10 seulement | Contre le 0.9 |
| --- | --- |
| `middle` (le centre seulement avec un départ solide) | 50,7 % (45,0 – 56,4) |
| `spread` (pas deux valeurs seules pareilles) | 50,0 % (44,4 – 55,6) |
| `connector` (ne pas casser un départ de suite) | 49,0 % (43,5 – 54,5) |
| habitude `joker` (le joker pour un brelan seulement) | 49,7 % (44,4 – 54,9) |
| habitude `opening` (ouvrir au milieu, une couleur nouvelle) | 50,9 % (46,1 – 55,7) |
| habitude `suited` (deux cartes qui se suivent en couleur) | 50,3 % (45,5 – 55,1) |

- **Rien ne bouge.** Couper ces bonus après le tour 10 ne gagne ni ne perd : à
  partir de là, l'arbre décide, et le cœur ne pèse presque plus (comme le
  banc depuis le tour 23 l'avait montré pour les variantes du cœur).
- Rien ne part en validation de nuit.
- Ces duels jouent 288 à 336 parties en 10 min, contre 240 pour la série
  précédente : le chemin rapide de l'évaluateur (côtés complets, paires de
  jokers) fait encore gagner environ 7 %. Remesuré sur machine libre, le 0.9
  tourne à 1 000 itérations par seconde (556 la veille).

## Les bonus du 0.9 à partir du tour 15, connector, et les simulations tronquées (03/10)

**Le coût de chaque bonus** (temps par itération de l'arbre, le bonus retiré) :
`middle` 6,6 %, `spread` 8,8 %, `connector` 13,7 %, habitude `joker` 5,2 %,
`opening` 9,9 %, `suited` 8,8 % ; les six ensemble 24,8 %. Au-delà de 3 %, une
variante se compare à temps égal (règle écrite dans `CLAUDE.md`).

**Chaque bonus actif seulement à partir du tour 15** (`lateIdeas`, `lateHabits`,
`lateFrom`, `src/sim/heuristics/tuning.js` ; arbre, 400 itérations, en miroir, 10 min) :

| Bonus | Seulement aux tours 1-10 | Seulement à partir du tour 15 |
| --- | --- | --- |
| `middle` | 50,7 % | 49,3 % |
| `spread` | 50,0 % | 49,0 % |
| `connector` | 49,0 % | 54,5 % (49,5 – 59,5) |
| habitude `joker` | 49,7 % | 50,0 % |
| habitude `opening` | 50,9 % | 50,9 % |
| habitude `suited` | 50,3 % | **41,1 % (35,5 – 46,8)** |

- **`suited` sert au début** : coupée avant le tour 15, le cœur perd nettement.
  C'est le premier bonus du 0.9 dont on voit le travail.
- **`connector` à partir du tour 15** semblait gagner (54,5 %). Repris **à temps
  égal** (`@t400`), à partir des tours 11, 15 et 19 : **48,7 %, 48,5 %, 48,9 %**.
  Le 54,5 % était du bruit ; le moment où on l'active ne change rien.
- Les autres sont neutres dans les deux sens.

**Les simulations tronquées** (`ismcts+trunc=N`, `src/sim/mcts/truncate.js`, l'idée de
Sami) : une simulation s'arrête dès qu'une borne de plus est décidée (côtés
pleins, gagnant exact), après au moins N coups et tant que la pioche dure ; la
chance de gagner la partie selon le cœur (4 bornes, ou 3 côte à côte, sur les 128
façons dont les bornes peuvent tomber) tient lieu de résultat.
- Les simulations ne revendiquent jamais de borne (elles règlent tout à la fin,
  pour la vitesse) : il a fallu compter une borne « décidée » dès que ses deux
  côtés sont pleins, sinon rien n'était jamais coupé.
- **Le gain de vitesse** : 79-80 % des simulations coupées jusqu'au tour 12, pour
  17 à 27 % de temps en moins par itération ; rien après la pioche vide.
- **À temps égal** (`@t400`) contre le 0.9 : `trunc=5` **41,1 % (35,0 – 47,3)**,
  `trunc=8` **45,6 % (41,7 – 49,6)**. Plus on coupe tôt, plus on perd : juger la
  partie avant sa fin coûte plus que les ~20 % d'itérations gagnées — la même
  leçon que la valeur de position apprise (40,3 %, le 01/10).

**Le cœur dépouillé, à temps égal** (backlog du soir, `@t800` contre le 0.9
`@t800`, deux jeux de donnes chacun, réunis par paires avec `npm run versus`) :

| Cœur | Ce qu'il garde | Duels | Réunis |
| --- | --- | --- | --- |
| `nobonus` | `certain` seul | 36,9 % puis 42,6 % | **39,7 % (36,3 – 43,2)**, 672 parties |
| `lean` | `suited` et `certain` | 39,9 % puis 43,3 % | **41,9 % (38,7 – 45,1)**, 816 parties |

- **Les bonus valent bien plus que leur temps.** Sans eux, l'arbre fait un tiers
  d'itérations en plus et perd quand même nettement.
- **`suited` seul ne rachète presque rien** : deux points, dans le bruit. Coupée
  avant le tour 15, elle coûtait neuf points ; gardée seule, elle n'en rend que deux. Les
  six bonus travaillent ensemble, et aucun ne se retire sans perte.
- On le voit dans les coups : sans les autres bonus, le cœur ne pose presque plus
  de 2e carte au début (0,2-0,4 % contre 5,5 %), ne bâtit plus de suite de
  couleur avant le tour 12, et finit avec plus de côtés sans figure (2,44 contre
  2,08 pour `lean`).
- Piste close : on ne simplifie pas le cœur pour gagner du temps.

## La chance des jokers (03/10)

**La question de Sami** : quel taux de victoire avec deux jokers, un, aucun ?

Chaque partie gardée note maintenant les jokers de chaque joueur
(`src/replay/core/jokers-held.js`, dans l'analyse des duels et dans l'index) : ceux
de la main de départ (les 6 premières cartes du paquet pour le siège 0, les 6
suivantes pour le siège 1) et ceux piochés ensuite. `npm run jokers` en tire
les taux de victoire.

**Robots de même force** (4 008 parties, les deux côtés) :

| Jokers | obtenus dans la partie | dans la main de départ |
| --- | --- | --- |
| 0 | 36 % (1 991) | 48 % (5 870) |
| 1 | 50 % (4 038) | 56 % (2 076) |
| 2 | **64 %** (1 987) | 57 % (70) |

- **Un joker vaut environ 14 points de chances de gagner** : avoir les deux
  contre aucun, c'est 64 % contre 36 %. Presque toutes les parties vont
  jusqu'à la pioche vide, si bien que les deux jokers sont presque toujours
  tirés : « 1 joker » veut dire « un chacun » (4 034 cas sur 4 038).
- **Un joker dès la main de départ** donne 56 % au lieu de 48 %. Deux jokers en
  main de départ sont rares (70 cas) ; leur 57 % est trop incertain pour dire
  que le second ajoute peu.

**Sami contre les robots** (72 parties, son côté) : 28 % sans joker (18), 50 %
avec un (38), 56 % avec les deux (16) — la même pente, sur trop peu de parties
pour aller plus loin (± 20 points environ par case).

## Expérimental 1.0 : rester sur ses côtés tant qu'une figure y est possible (03/10)

**Ce qui change** : le cœur du 0.9 plus `stfig` 0,6 (`stay` avec `stayFigure`,
`src/sim/heuristics/oracle-ideas.js`). Une carte posée sur un de mes côtés déjà commencés
reçoit 0,6, si ce côté peut encore devenir un brelan ou une suite de couleur.
Moteur : `ismcts+widen=3+depth=5+core=stfig6@800`. Le 0.9 reste `ismcts+widen=3+depth=5@800`,
et `EXPERIMENT` reste son cœur : les replays, l'oracle et les bancs qui lisent les
parties du 0.9 gardent leur sens. Les tests à venir se font contre le 1.0, avec `core=stfig6`.

**Ce qui l'a décidé** :
- l'oracle reste sur ses côtés entamés bien plus que le cœur (2e carte : 65 % de ses
  coups contre 51 %) ;
- en cœur contre cœur, `stfig` 0,6 fait 58,0 / 57,9 / 58,0 % sur trois jeux de donnes ;
- dans l'arbre, quatre duels longs à 800 itérations : 53,8 / 58,3 / 51,7 / 60,8 %,
  soit **56,1 % (53,2 – 59,1) sur 480 donnes jouées des deux côtés** (`npm run versus`).

**Le coût** : `stfig` demandait `shapeOf` à chaque coup de chaque simulation,
et l'arbre allait 24,5 % plus lentement par itération. `keepsFigure` donne la même
réponse sur les 65 763 côtés possibles, avec la même empreinte du 1.0
(`152e2a9c9d66170c`, `npm run fingerprint -- "ismcts+widen=3+depth=5+core=stfig6@150,greedy" 40`).
Le surcoût tombe à 2 % : sous les 3 % de la règle du temps égal, les duels à
itérations égales valent aussi au temps.

**Ce qu'il joue autrement** (`npm run versus`, 960 parties contre le 0.9) :

| | 1.0 | 0.9 |
| --- | --- | --- |
| tours 1-12 : pose une 2e carte | 18 % | 6 % |
| tours 1-12 : ouvre une borne vierge | 49 % | 60 % |
| tours 1-12 : bâtit une suite de couleur | 16 % | 6 % |
| tours 13-24 : répond à une borne adverse | 28 % | 17 % |
| tours 13-24 : bâtit un côté sans figure | 10 % | 20 % |
| bornes entamées au tour 10 | 4,3 | 4,9 |
| côtés complets sans figure à la fin | 1,95 | 2,29 |
| bornes gagnées | 2,97 | 2,63 |

Il approfondit au début au lieu d'ouvrir, garde ses figures possibles, et répond
plus tard, quand l'adversaire a déjà montré son jeu. Son gain ne dépend ni du
siège (54,8 % quand il commence, 57,5 % sinon) ni des jokers.

**Ce qu'en dit l'oracle** (`npm run oracle -- --disagree stfig6 --minutes 40`) :
- dans les 960 parties contre le 0.9, aux tours 5 à 16, 4 311 positions où les deux cœurs
  préfèrent un coup différent ; 470 lues, 280 où ses deux recherches s'accordent ;
- il joue le coup du 1.0 dans **13,9 %**, celui du 0.9 dans **3,6 %**, un troisième dans 82,5 % ;
- l'écart est le plus net au début : aux tours 5-8, 34 % contre 0 % ;
- reclassées par le cœur du 1.0 (`--summary --core stfig6`), ses 4 331 positions mettent
  son coup dans le top 8 dans **66 %** des cas, contre 54 % avec le cœur du 0.9 : l'arbre,
  qui n'examine que ce top 8, regarde plus souvent le coup de l'oracle.

Entre les deux cœurs, l'oracle penche nettement pour le 1.0. Mais il joue le plus
souvent un troisième coup (son favori n'a que 18 % des visites en médiane) : la
confirmation par le jeu reste ce qui dira s'il voit juste.

**Écarté le même jour** : `stay` limité aux tours 1-10 (`stay4e10`) : 55,4 % au tri à
400, puis 50,6 % (47,1 – 54,2) en deux duels longs. Les autres essais du 0.9 sont
dans `out/changelog-exp-1.0.html` (« Changelog Exp v1.0 »).

**La leçon** : les tris de 10 minutes à 400 itérations ont promu trois idées qui
n'ont pas tenu (stay 0,4 à 58,3 %, connector dès 15 à 54,5 %, stay4e10 à 55,4 %). Un
tri écarte, il ne promeut plus : voir la règle dans `CLAUDE.md` et `docs/validation.md`.

**Les versions passent à deux chiffres** (Sami) : `experimental@1.0`,
`stratege@2.1`, `basique@1.0`. Les parties enregistrées avant, en `x.y.0`, comptent
pour la même version (`shortTag`, `src/config/bots.js`).

## La base de référence V1 + Oracle : les pilotes de la nuit (04/10)

L'idée de Sami : faire de l'oracle un étalon — ses parties entières, les parties
du V1 relues par lui et inversement — pour juger une idée en minutes avant de lui
donner des duels longs. Avant d'y mettre des nuits, des pilotes. L'oracle est figé
en **version 1** (`ORACLE.version`, empreinte `c87b8b524dede38b`) ; les replays des
duels gardent désormais les 5 meilleurs candidats d'une recherche et leurs visites.

**L'oracle confirmé par le jeu** (`oracle-confirm-1`, 1 144 écarts des tours 14-26
rejoués jusqu'au tour 30 par le 0.9, 4 graines) : son coup tient **+6,3 ± 1,8 points**
de plus que le favori du cœur, **+3,1 ± 1,8** de plus que le coup du 0.9. Sûr de lui
(marge ≥ 0,15) : +3,7 ; hésitant : +1,0 ± 3,3, rien de prouvé. Au milieu de partie,
ses écarts sont de vraies leçons.

**Le banc oracle** (`npm run oracle -- --bench …`) : la part des positions où le coup
de l'oracle entre dans le top 8 d'un cœur classe les 8 cœurs mesurés en duels longs
comme les duels (corrélation de rang 0,93 ; top 1 et top 3 : 0,60). Ses positions
vont des tours 14 à 26 : il ne voit pas une idée qui agit plus tôt (stay4e10).

**Ce que coûte un coup de l'oracle** (`oracle-cost`, médiane sur 23 fils) : 97 s au
tour 2, 65 s au 10, 41 s au 18, 18 s au 26. Une partie Oracle contre 1.0 : une vague
de 22 parties en 12,6 min, soit environ 105 parties par heure.

**L'oracle au début de partie : le doute de Sami était fondé.**
- Ses deux recherches s'accordent dans **36 %** des positions des tours 2 à 12
  (10 % au tour 2, 17 % au 4, 30 % au 6, 43 % au 8, 60 % au 10, 53 % au 12), contre
  68-70 % aux tours 14-26. Son favori n'a que 10 % des visites en médiane.
- À 80 000 itérations (18 positions), le favori rejoint l'un des deux de 20 000 dans
  2 cas sur 6 aux tours 2 et 6, 6 sur 6 au tour 10.
- Avant le tour 10, l'oracle n'est pas une référence ; ses positions de début ne
  servent pas d'étalon. (Les pilotes ne lisaient que des tours pairs, donc le joueur
  qui commence second ; rien n'indique que l'autre siège diffère.)

**En parties entières** (22 parties chacun, une vague) :

| Pilote | Score contre le 1.0 | Fourchette par paires |
| --- | --- | --- |
| l'oracle | 45,5 % | 24,8 – 66,2 % |
| l'oracle jusqu'au tour 12, puis le 1.0 | 63,6 % | 44,5 – 82,7 % |

Trop peu de parties pour conclure, mais une surprise : rien ne dit encore que
l'oracle bat le V1 en partie entière. Il cherche avec le cœur du 0.9 (réponses et
simulations), le V1 avec celui du 1.0. Les deux questions partent ce matin en
110 parties de plus chacune (`ref-oracle-v1-0/1`, `ref-phase12-0`).

**Le V1 relit les 22 parties de l'oracle** (`npm run shadow`) : il joue le même coup
dans 4,5 % des cas aux tours 1-4, 16 % aux 9-12, 27 % aux 17-20, 38 % après le 25 ;
le coup de l'oracle est dans le top 8 de son cœur 23 % du temps au début, 75-83 %
à la fin.

**Pour la suite** : la base de référence part des tours 12 et plus (`ref-annotate-0` :
l'oracle relit les parties du 1.0 aux tours 12-28, deux recherches, classées par le
cœur du 1.0). Oracle contre Oracle attend : son début de partie n'est pas fiable.

### Le matin du 04/10 : l'oracle bat le V1

**La confirmation complète** (`oracle-confirm-1` et `-2`, les 2 300 écarts) : le coup
de l'oracle tient **+2,4 ± 1,3 points** de plus que celui du 0.9 au tour 30, +4,6 ± 1,2
de plus que le favori du cœur. Sûr de lui (marge ≥ 0,15, 1 269 écarts) : +3,5 ± 1,8 ;
hésitant : +1,1 ± 1,8.

**Oracle contre 1.0, réunis par paires** (`npm run versus`, pilote + deux passes) :

| | Parties | Score | Fourchette par paires |
| --- | --- | --- | --- |
| l'oracle | 242 | **57,4 %** | 51,7 – 63,1 % |
| l'oracle jusqu'au tour 12, puis le 1.0 | 132 | 59,1 % | 50,9 – 67,3 % |

La fourchette basse passe 50 % : l'oracle est plus fort que le V1, il peut servir
d'étalon — à partir du tour 10-12, où ses recherches sont stables. Et chercher
large au début rapporte autant que chercher large partout.

**Ce que l'oracle joue autrement** (sur ses 242 parties contre le 1.0) :
- au début (tours 1-12), il **ouvre moins de bornes vierges** (44 % de ses coups
  contre 60 %), **répond plus aux bornes adverses** (33 % contre 23 %), joue plus au
  centre (45 % contre 36 %) et bâtit plus tôt ses brelans ;
- au milieu, il répond encore plus (31 % contre 21 %), accepte des côtés sans figure
  (20 % contre 11 %) et bâtit moins de suites de couleur (26 % contre 34 %) ;
- à la fin, il joue à côté de ses bornes gagnées (41 % contre 31 %) ;
- au tour 10, il a entamé 4,08 bornes contre 4,37 ; il en gagne 3,02 contre 2,69.

Le constat sur les parties entières contredit en partie celui des écarts de la
veille (l'oracle « répondait » moins dans ses écarts, d'où `noAnswer`) : ici, sur
tous ses coups, il répond plus.

**Pour copier l'oracle, deux pistes en tri ce matin** :
- **regarder plus de coups** : son coup est dans le top 8 du cœur du 1.0 dans 66 % des
  positions, le top 12 dans 77,6 %, le top 16 dans 84 % (au début : 42, 62 et 73 %).
  Tris à temps égal : `candidates=12`, `candidates=16`, et 16 jusqu'au tour 12 ;
- **jouer comme lui** : quatre cœurs sur le 1.0 (`v1ans1/2` : un bonus pour répondre ;
  `v1blind1/2` : un coût pour ouvrir à l'aveugle), triés cœur contre cœur.

**La vitesse** : deux optimisations à coups identiques (les trois empreintes inchangées) —
la carte seule sur un côté vide calculée une fois par évaluation et non par borne vide,
et plus de tableau alloué pour la clé de la mémoire des paires — font environ 5 % de
temps en moins pour la recherche du 1.0. Le reste du temps est dans l'évaluation des
côtés à une et deux cartes, déjà optimisée : un gain plus gros demanderait de revoir
sa structure.

**L'oracle relit les parties du 1.0** (`ref-annotate-0`, tours 12 à 28, 2 159 positions,
deux recherches, classées par le cœur du 1.0) : ses deux recherches s'accordent dans
57 % des positions au tour 12, 65-71 % ensuite. Ses écarts face au cœur du 1.0 (1 035,
hors de son top 3) : il **bâtit un côté sans figure** dans 37 % de ses coups contre 2 %
pour le cœur, **complète un côté** (3e carte) 32 % contre 15 %, **joue un joker** 14 %
contre 2 % ; le cœur du 1.0, lui, bâtit une suite de couleur (46 % contre 18 %) et pose
une 2e carte (69 % contre 52 %) — stfig en fait peut-être trop. Ces positions
(`oracle/positions-v1ref.jsonl`) sont la base du banc des versions V1+ : sur elles, le
coup de l'oracle est dans le top 8 du cœur du 1.0 dans 60,6 % des cas, le top 16 dans 82 %.

**Le V1 relit toutes les parties de l'oracle** (`ref-shadow`, 242 parties) : même coup
dans 4 % des cas aux tours 1-4, 12 % aux 9-12, 20 % aux 17-20, 43 % après le 25 ; le
coup de l'oracle est dans le top 8 de son cœur 24 % du temps au début, 83 % à la fin.

**Copier l'oracle dans le cœur** (cœur contre cœur du 1.0, 6 000 à 8 000 parties, quelques
secondes) :

| Cœur (sur le 1.0) | Jeu de donnes 0 | 1 | 2 |
| --- | --- | --- | --- |
| `v1ans1` / `v1ans2` : un bonus pour répondre | 46,9 % / 45,8 % | | |
| `v1blind1` : ouvrir à l'aveugle coûte 0,1 | 51,1 % | 49,3 % | |
| `v1blind2` : 0,2 | 50,7 % | | |
| `v1jneg1` / `v1jneg2` : un côté sans figure accepté (junk -0,1 / -0,2) | 50,4 % / 51,0 % | — / 50,4 % | |
| `v1freejk` : sans l'habitude du joker | 47,5 % | | |
| **`v1bj`** : `noBlindOpen` 0,1 et `junk` -0,2 ensemble | **52,0 %** | **52,1 %** | **51,5 %** |

Répondre plus, comme l'oracle le fait dans ses parties entières, fait perdre le cœur :
il répond quand c'est juste, pas par principe. Seul `v1bj` tient sur trois jeux de donnes,
mais le banc oracle ne lui voit rien (top 8 : 60,0 % contre 60,6 % sur les positions du
1.0, 64,7 % contre 66,0 % sur celles du 0.9). Il passe un tri dans l'arbre à temps égal
ce matin (`screen-v1bj`) ; s'il n'est pas écarté, ses quatre duels longs ce soir.

**Regarder plus de coups, à temps égal** (`screen-copy-oracle`, tris à `@t400` contre le 1.0) :

| Variante | Score | Fourchette par paires |
| --- | --- | --- |
| `candidates=12` | 38,2 % | 31,3 – 45,0 % |
| `candidates=16` | 42,5 % | 36,9 – 48,1 % |
| 16 jusqu'au tour 12, puis 8 | 46,6 % | 42,7 – 50,4 % |

Les trois sont écartées. Le coup de l'oracle est bien plus souvent dans le top 12 ou 16
du cœur, mais à budget égal, l'arbre qui regarde plus de coups en creuse chacun moins
— et perd. L'oracle peut chercher large parce qu'il a 25 fois plus d'itérations : la
largeur ne se copie pas sans le budget qui va avec. Ce qui se copie, c'est le choix
du cœur (quels coups mettre dans le top 8), d'où les cœurs `v1…`.

**`v1bj` dans l'arbre** (`screen-v1bj`, `@t400` contre le 1.0, 528 parties) : **46,0 %**
(42,3 – 49,8) — écarté. Ses 52 % en cœur contre cœur ne passent pas dans l'arbre, et le
banc oracle l'avait annoncé (top 8 : 60,0 % contre 60,6 %). C'est le premier cas où le
banc tranche contre un tri du cœur : avant de donner un tri d'arbre à une idée, le banc
d'abord.

**Le 1.0 contre lui-même** (`ref-v1-self-0/1`, 2 × 336 parties gardées) : 50,0 % et 53,0 %,
comme attendu d'un miroir — le corpus V1 contre V1 de la base de référence.

**Le bilan de la nuit et du matin** : l'oracle est un étalon solide à partir du tour 12
(57,4 % contre le 1.0, ses écarts confirmés par le jeu), pas avant. Aucune variante du
1.0 n'a tenu : regarder plus de coups perd à temps égal, et les traits de l'oracle
copiés un par un dans le cœur ne passent pas dans l'arbre. La piste qui reste ouverte :
le début de partie, où l'oracle jusqu'au tour 12 gagne 59,1 % — c'est son budget, pas
sa largeur, qui gagne ; un 1.0 qui réfléchit plus longtemps aux premiers coups (temps,
pas largeur) est le prochain essai.

## Trois variantes du 1.0 pour le début de partie (04/10, après-midi)

Les trois traits de l'oracle au début (changelog 1.1, « Coup pour coup »), en bonus du
cœur actifs jusqu'au tour 12 seulement (`earlyIdeas`, `earlyUntil: 12`) :
- `noOpen` (nouveau, `oracle-ideas.js`) : toute carte posée sur une borne où personne
  n'a joué coûte, plan en main ou non (l'oracle ouvre 44 % de ses coups du début, le
  1.0 60 %) ;
- `junk` en négatif : un côté sans figure coûte moins (37 % des écarts de l'oracle
  contre 2 %) ;
- `noRun` (nouveau) : une carte qui fait d'un côté une suite de couleur coûte (18 %
  contre 46 %).

Testées sur 6 fils, d'abord cœur contre cœur du 1.0 (3 jeux de donnes), puis au banc
de similitude sur les 1 683 coups de l'oracle des tours 1 à 12 de ses parties
entières (`npm run banc -- … --positions games --turns 1-12`, les 5 candidats gardés par
les replays) :

| Cœur | Cœur contre cœur | Banc : écart de valeur oracle avec le 1.0 | Même coup que l'oracle (1.0 : 6,1 % aux tours 4-10) |
| --- | --- | --- | --- |
| `e12open1` (noOpen 0,1) | 50,0 / 49,7 / 50,5 % | **+1,3** (-0,5 – +3,1) | 8,4 % |
| `e12open2` (0,2) | 49,4 / 49,3 / 49,5 % | — | — |
| `e12junk1` (junk -0,1) | 49,7 / 49,2 / 49,5 % | — | — |
| `e12junk2` (-0,2) | 50,1 / 48,6 / 49,4 % | -1,0 (-2,5 – +0,6) | 6,7 % |
| `e12run1` (noRun 0,1) | 47,4 / 47,6 / 48,5 % | +0,3 (-1,4 – +2,0) | 6,4 % |
| `e12run2` (0,2) | 46,7 / 46,6 / 46,5 % | — | — |

- Aucune n'est « à pousser ». `e12open1` est la seule piste : elle rapproche le 1.0 de
  l'oracle au début (même coup 8,4 % contre 6,1 %), sans rien perdre en cœur contre cœur.
- Coûter les suites de couleur fait perdre le cœur, comme couper `suited` le 03/10 :
  l'oracle en bâtit moins, mais celles du 1.0 lui rapportent.
- Le banc n'est pas encore calibré (cette nuit) ; une fois calibré, `e12open1` repasse
  sur ses positions (deux recherches, 12 coups), et `--queue` s'il est « à pousser ».
- Le banc à 6 fils : 1 683 positions en 8,7 min pour la référence, mise en cache ; à
  18 fils environ 3 min par version, mais la machine est saturée.

**`e12open1` en parties réelles** (Sami : le banc contre le jeu) : 4 × 250 parties contre
le 1.0 à 800 itérations, règle de la page, 18 fils (11 min par jeu de donnes) :
47,6 %, 51,6 %, 52,0 %, 50,8 % ; réunies par paires, **50,5 % (47,9 – 53,1)** sur 1 000
parties. Neutre, comme le banc (+1,3 point, -0,5 – +3,1). Le banc et les duels
s'accordent : aucun des deux ne voit d'écart. `e12open1` rejoint les versions de la
calibration (`data/banc-calibration.json`).

## La calibration du banc : il ne trie pas (04/10, soir)

La nuit du banc lancée à 18 h sur 18 fils (Sami) : deux passes de l'oracle, 3 721
positions (parties 1.0 contre 1.0, oracle contre 1.0, 1.0 contre 0.9 ; tours 4 à 30,
deux recherches, 12 coups gardés). Stabilité de son favori : 38 % aux tours 4-10 (968
positions), 65 % aux 11-20 (1 345), 63 % aux 21-30 (1 408) ; le 1.0 a le trait dans 2 772.
Puis `npm run banc -- --calibrate` : les versions au résultat connu passées sur le banc.
Il s'est **arrêté à sa limite de 50 min** après 12 versions (le top 8 du cœur n'a pas
été écrit) ; corrélations recalculées depuis son journal. `e12open1`, la 13e, est
passée à part à 22 h 35 (`npm run banc`, 9,5 min sur 18 fils) : le 1.0 y retrouve
exactement ses valeurs, le banc est reproductible (`data/banc.json`, `calibration`).

| Version | Valeur oracle | Au début (4-10) | Duels contre le 0.9 |
| --- | --- | --- | --- |
| 0.9 | 45,5 % | 30,9 % | 50,0 % |
| **1.0** | 45,6 % | 35,5 % | 56,1 % |
| `e12open1` | 45,9 % | **36,3 %** | **56,6 %** (50,5 % contre le 1.0) |
| stay4e10 | 46,2 % | 33,7 % | 50,6 % |
| jkx | 45,1 % | 32,3 % | 51,7 % |
| jk2 | 45,0 % | 32,0 % | 52,4 % |
| obex | 46,4 % | 32,3 % | 50,5 % |
| lean (@t800) | 41,7 % | 26,9 % | 41,9 % |
| nobonus (@t800) | 40,6 % | 26,4 % | 39,7 % |
| candidates=12 (@t400) | 42,3 % | 31,9 % | 44,2 % |
| candidates=16 (@t400) | 40,3 % | 32,3 % | 48,6 % |
| 16 jusqu'au 12 (@t400) | 40,9 % | 31,5 % | 52,8 % |
| v1bj (@t400) | 40,2 % | 30,3 % | 52,2 % |

Corrélation de rang avec les duels, sur les 13 versions : **0,32** sur la valeur
oracle, **0,61** sur la valeur au début. Sur les 7 versions à 800 itérations seulement :
-0,18 et **0,72**.

- **Le banc entier ne trie pas.** Il ne sépare pas le 0.9 du 1.0 (45,5 % contre
  45,6 %) alors que le 1.0 gagne 56,1 % ; les sept versions à 800 itérations tiennent
  en 1,4 point. Aux tours 11 à 30, deux versions voisines jouent presque les mêmes coups,
  et l'écart est plus petit que ce que le banc sait voir.
- **Le début de partie dit quelque chose** : le 1.0 et `e12open1` y sont en tête
  (35,5 % et 36,3 %), et la corrélation y monte à 0,61, 0,72 sans les versions au
  temps. C'est là où l'oracle est le moins stable (38 %) : un banc des tours 4-10
  gagnerait à plus de recherches par position, pas à plus de positions. Sept points
  ne suffisent pas à en faire un filtre.
- **`e12open1` au banc** : +0,32 point contre le 1.0 (-0,40 – +1,05), « neutre » ;
  +0,8 au début. Ses 1 000 parties disent la même chose (50,5 %).
- **Les versions à temps fixe (`@t400`, `@t800`) sont faussées** : le banc tourne
  sur une machine chargée, elles y font moins d'itérations qu'en duel, et toutes
  sortent en bas (40-42 %), qu'elles gagnent ou perdent leurs duels.
- Ce n'est pas l'accord du banc oracle d'hier (top 8 du cœur, 0,93 sur 8 cœurs) : ce
  banc-là compare des cœurs seuls, sans arbre ; le banc de similitude juge le coup
  final de l'arbre, où le bruit de la recherche couvre l'écart entre deux cœurs.

Conséquence : le verdict du banc reste un indice, jamais un filtre (`CLAUDE.md`,
`docs/validation.md`) ; sa valeur aux tours 4-10 est celle à lire. Le parcours d'une
idée reste cœur contre cœur, tri d'arbre (400 parties), puis quatre duels longs.

[← le registre](../strategie.md) · [← 02/10](02-le-0.9.md) · [04/10 – 06/10 →](04-labo-a-2000.md)
