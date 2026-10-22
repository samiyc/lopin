# La backlog vue comme une partie

Le schéma de Sami (prompt du 21/10) prend les mots du jeu : la pioche, la main, les bornes. Il est juste
dans l'esprit ; plusieurs pièces sont à déplacer. Ce document les reprend une à une, chiffre ce que
l'historique dit vraiment, puis décrit un planificateur ISMCTS et ce qu'on peut en attendre.

Tous les chiffres viennent de `data/backlog-done/2026-10.json` et des sorties `backlog-runs/` (relus le
22/10).

## 1. Le schéma, terme à terme

| Le terme de Sami | Ce qui tient | Ce qu'il faut corriger |
|---|---|---|
| **La pioche = les jobs déjà lancés** | l'historique est précieux | il ne se pioche pas : il **donne les lois** (durées, arrêts, pannes). Ce qui est caché, c'est **l'avenir des jobs en file** : combien de temps ils prendront, quel score ils sortiront. Une déterminisation, c'est **un scénario de nuit** tiré de ces lois (§ 4). |
| **La main = la todo** | oui | toute la todo est visible : pas 6 cartes, toutes. La pioche à la Lopin, avec des cartes qui arrivent en cours de route, n'existe que si des jobs **arrivent pendant la nuit** : c'est le cas des tickets d'une équipe (§ 7). |
| **Les bornes = les files** | il faut une ressource à répartir | les fils ne sont pas rangés côte à côte : réserver « les files 1 à 3 » ou « 3 files » revient au même. La ressource se compte : **18 fils, et de la RAM** (§ 3). |
| **L'action « passer 20-30 min »** | le temps doit avancer | inutile comme coup : on ne décide **qu'à un événement**, quand un job finit et libère des fils. Le temps saute d'un événement au suivant. La profondeur de l'arbre devient le nombre de jobs, pas 8 h découpées en tranches de 20 min. |
| **La récompense = tâches finies en T** | il faut une récompense | compter les tâches pousse à lancer les jobs courts, et ne dit rien de ce qu'on a appris. Mieux : **les décisions obtenues au matin** (une version écartée ou validée, une mesure faite), pondérées par la priorité de Sami, avec une pénalité si un job déborde sur la matinée ou si la RAM sature. |
| **La pioche d'imprévus (25 % stopIf, 5 % erreur…)** | les imprévus doivent être simulés | un stopIf n'est pas une carte au hasard : il **découle du score du duel**. On tire la force vraie de chaque version, puis ses scores de duel, et les stopIf en sortent d'eux-mêmes, cohérents d'un duel à l'autre (§ 4). Les erreurs sont rares (0 échec, 4 dépassements sur 315). La saturation mémoire se calcule à partir de la RAM de chaque job. |

## 2. Ce que dit l'historique d'octobre

**315 jobs finis** : 270 faits, 41 sautés par un stopIf, 4 arrêtés au bout de leur limite de temps
(`banc-calibrate`, `screen-early4000`, `screen-lite`, `reproduce-borne-early-500`), aucun en erreur.

**Les durées, comparées à l'estimation écrite dans la file.** Rapport durée réelle / estimation sur les
267 jobs qui ont les deux : médiane **0,89**, 1 job sur 10 au-dessus de **1,02**. Les estimations sont
plutôt prudentes, mais pas toujours :
- 32 jobs estimés à 30 min ont pris 26 min en médiane, mais 42 min pour 1 sur 10 ;
- **le 20/10**, les mêmes duels 1k@2k estimés à 30 min ont pris **40 à 43 min** pour les versions
  JokerWin (cœur `stfig6jw`) et **22 min** pour JokerTheirHand (cœur de la 1.2). La durée dépend
  **des moteurs du duel**, pas de l'étiquette du job : le simulateur doit l'apprendre par moteur.

**Les séries 1k@2k** (4 duels de 250 parties et la règle d'arrêt). Sur les 27 séries complètes de 4
jobs :
- **4 arrêtées après le 1er duel** (15 %) ;
- **11 après le 2e** (41 %) ;
- **12 jouées jusqu'au bout** (44 %).

Une version coûte donc en moyenne **2,7 duels**, pas 4 : 0,15 × 1 + 0,41 × 2 + 0,44 × 4. À 40 min le
duel, c'est environ 110 min. **Une nuit de 8 h décide en moyenne 4 à 5 versions**, pas 3.

**Les scores des premiers duels** (36 séries) : médiane 49,6 %, de 42 à 55,2 %, la moitié entre
47,2 et 52,8 %. Un duel de 250 parties a lui-même un bruit d'environ ± 2,8 points (écart-type des paires
0,31 sur 125 paires). Les versions essayées sont donc **presque toutes proches de 50 %**, avec un écart
vrai de l'ordre de ± 3 points.

## 3. Les files : ce que découper peut et ne peut pas faire

**Le débit total ne change pas.** Un duel répartit ses parties entre les fils : sur 9 fils, il prend à peu
près deux fois plus longtemps que sur 18. Deux files de 9 fils font autant de parties à l'heure qu'une file
de 18. Découper ne crée pas de temps de calcul. C'est une première approximation : au-delà des 12 vrais cœurs du PC, chaque fil
rapporte moins, et les petits duels perdent des fils en fin de course (§ 8).

**Ce que découper apporte quand même** :
- **des ressources différentes.** L'analyse `endgame-moves` du 20/10 était limitée par la RAM : 10 fils
  pour garder 5 Go libres, donc 8 des 18 fils autorisés inoccupés pendant 4 h. Une deuxième file aurait
  pu y faire tourner un duel à 8 fils ;
- **la fin de nuit.** À 6 h 30, avec 30 min devant soi, mieux vaut deux petits jobs en parallèle qu'un
  duel de 40 min qui déborde ;
- **plusieurs machines** : la file du portable (`--queue laptop`) est une deuxième « borne » qui ne
  partage ni les cœurs ni la RAM.

La contrainte existante « jamais deux jobs à 18 fils en même temps » devient simplement : la somme des
fils ne dépasse pas 18, et la somme des RAM ne dépasse pas la RAM libre moins 5 Go.

## 4. Le planificateur, pièce par pièce

| Brique ISMCTS | Pour la backlog |
|---|---|
| **L'ensemble d'information** | à 2 h du matin : les jobs finis avec leurs sorties (les scores des duels), les jobs en cours avec leur temps écoulé, la todo, l'heure de fin de nuit |
| **La déterminisation** | un scénario : pour chaque job, **sa durée** (tirée selon le moteur, et sachant le temps déjà écoulé s'il tourne) ; pour chaque version, **sa force vraie** (tirée autour de 49,6 % ± 3 points, puis **corrigée par ses scores déjà connus**) ; de là, les scores de ses duels à venir, avec le bruit de ± 2,8 points ; parfois une panne ou un dépassement |
| **Les coups** | quel job lancer maintenant, et avec combien de fils (18, ou 9 + 9 avec un autre job) |
| **La liste courte** | les k premiers selon une règle simple, comme le cœur propose 8 candidats |
| **La simulation** | la même règle simple joue le reste de la nuit, dans le scénario tiré, en appliquant les stopIf |
| **La récompense** | les décisions obtenues avant l'heure de fin, pondérées ; moins un débordement ou une saturation |
| **Le coup joué** | le plus visité ; puis le lanceur exécute, et on recommence à l'événement suivant |

**L'analogue de `jkHand`.** Corriger la force d'une version par ses scores déjà connus, c'est
exactement ce que fait `+jkHand` : placer le caché là où l'historique dit qu'il se trouve, au lieu de le
tirer à l'aveugle. Ici, la correction est un calcul simple : la moyenne de l'a priori et des scores,
pondérée par leurs précisions.

**La fusion de stratégies, en exemple.** Dans un scénario où la version A sortira 44 % à son premier
duel, un planificateur qui jugerait scénario par scénario (le PIMC) conclurait : « ne lance pas A ».
Mais on ne le saura qu'après l'avoir lancée. L'ISMCTS évite ce piège parce que ses nœuds ne distinguent
que ce qui aura été **observé** : tant que A n'a pas joué, tous les scénarios passent par le même nœud.

**Les règles simples à battre**, qui servent aussi de politique de simulation :
1. **l'ordre de la file** : ce que fait `npm run backlog` aujourd'hui ;
2. **le premier duel de chaque version d'abord** : on apprend vite quelles versions s'arrêtent ;
3. **le plus court d'abord**, près de l'heure de fin.

## 5. Où est le gain, honnêtement

- **L'ordre ne change le travail total que s'il y a une échéance ou des priorités.** Les stopIf d'une
  version ne dépendent que de ses propres duels : sans heure de fin, n'importe quel ordre fait le même
  travail. Le 20/10, la file a tourné de 13 h 01 à 19 h 20 : 16 jobs prévus, 10 lancés, 6 sautés,
  378 min de calcul. Sans échéance, aucun ordre n'aurait fait mieux.
- **Le gain apparaît quand la nuit est trop courte pour la file** : choisir ce qui donnera une
  décision avant le matin, et dans quel ordre de priorité ; finir la nuit sans débordement ; occuper
  les cœurs laissés libres par un job limité par la RAM.
- **Pour 10 à 20 jobs par nuit**, un simulateur et la comparaison des 3 règles simples en Monte-Carlo
  prendront l'essentiel du gain. **L'ISMCTS vaut la peine** quand plusieurs machines, la RAM et
  l'échéance se mêlent, ou comme projet d'apprentissage : c'est un très bon terrain pour comprendre
  l'algorithme hors du jeu.

## 6. Les étapes proposées

Rien n'est lancé ; chaque étape se mesure avant la suivante.

1. **Le simulateur** : `simulateNight(queue, policy, scenario)`, pur et testé. Il rejoue l'ordre des
   événements, les fils, la RAM, les stopIf (`stopReason`, `scripts/lib/domain/backlog-stop.js`, se
   réutilise tel quel).
2. **Le tireur de scénarios**, à partir de `backlog-done` : les durées par moteur, la force des
   versions, les pannes.
3. **Les 3 règles simples**, comparées sur quelques milliers de scénarios. Premier vrai résultat : de
   combien la meilleure bat l'ordre de la file, et quand.
4. **Le planificateur ISMCTS**, comparé à la meilleure règle, sur les mêmes scénarios.
5. **`npm run backlog -- --plan`** : affiche l'ordre proposé, sans rien lancer. Le lanceur ne change de
   comportement que si Sami le décide.

**Où le mettre** : dans ce dépôt, `scripts/backlog-planner/`, puisque le lanceur et les données y sont.
Le noyau MCTS n'importe rien de Lopin, pour pouvoir le sortir plus tard (`README.md`, § 4).

## 7. La même idée ailleurs : les tickets, la renderfarm

- **Les tickets d'une équipe** : là, la pioche de Sami existe vraiment. De nouveaux tickets arrivent
  pendant la journée, comme les cartes piochées. Le scénario tire aussi les arrivées (combien, de quelle
  taille, à quelle heure), à partir de l'historique de l'équipe. Les « files » sont les personnes, avec
  leurs compétences.
- **Une renderfarm** : des images à calculer, des durées incertaines, des priorités et une heure de
  livraison. C'est la backlog avec plus de machines, et le cas où la répartition des ressources pèse le
  plus.

## 8. Les jobs de jour, et combien de fils pour quel job

Sami (22/10) : ajouter aux jobs de la backlog tout ce qui a tourné de jour, sur 4 ou 6 fils, pour
apprendre un nombre de fils idéal par type de job.

**Ce que l'historique contient.** Les changelogs gardent les essais et leurs verdicts, mais ni les durées
ni les fils. La source utile est `duels/` : chaque partie y a son heure de début et de fin, de jour comme
de nuit. On en déduit les **fils occupés** de chaque duel (glossaire) :

| Fils occupés | Duels (sur 260) |
|---|---|
| 16 ou plus (médiane 17,2) | 193 |
| 11 à 16 | 65 |
| ~11 | 1 |
| ~4 | 1 |

- **De jour comme de nuit, presque tout a tourné à 18 fils** : 16,2 fils occupés en moyenne sur 164 duels
  de jour, 16,3 sur 96 de nuit.
- **Les petits jobs perdent des fils** : les duels de moins de 10 min n'en occupent que 12,5 sur 18, ceux
  de 10 à 30 min 16,9. En fin de duel, il reste moins de parties que de fils, et ce temps mort pèse plus
  sur un job court.
- **Les activités à 4-6 fils** (le Labo, les analyses lancées avec `LOPIN_THREADS`) n'ont laissé ni
  durée ni nombre de fils.

L'historique ne peut donc pas dire quel nombre de fils est le meilleur : il n'a presque jamais varié.
Deux pièces manquent.

**1. Un journal de jobs.** Que chaque job, de jour comme de nuit, écrive une ligne dans
`data/job-log.jsonl` : le type (duel, analyse, oracle), les moteurs, les fils demandés, la durée, le pic
de RAM, et le nombre de parties ou de positions. Les cas variés s'accumulent alors d'eux-mêmes, et le
tireur de scénarios (§ 6, étape 2) y lit les durées par moteur **et** par nombre de fils.

**2. Une mesure du débit selon les fils.** Le PC (Ryzen 9 3900X) a **12 vrais cœurs et 24 fils** :
au-delà de 12, deux fils partagent un cœur, et chaque fil de plus rapporte bien moins qu'un cœur entier.
L'hypothèse, à mesurer : 12 fils donnent déjà 85 à 90 % du débit de 18. Le protocole :
- le même duel de 250 parties de la 1.2 contre elle-même à 400 itérations (faisable de jour), à 6, 9, 12
  et 18 fils ;
- mesurer les parties par heure, et les fils occupés ;
- puis deux jobs côte à côte, 12 + 6 et 9 + 9, et comparer leur débit cumulé à celui d'un seul job à 18.

Si l'hypothèse tient, le coup du planificateur (§ 4) devient **(quel job, combien de fils)** : un job
long à 12 fils et un court à 6 feraient plus de travail qu'un seul à 18, et laisseraient le PC plus
fluide. La règle « la somme des fils ne dépasse pas 18 » reste la même.

## 9. L'ordonnanceur : ce qu'il apporte, les priorités, les enchaînements

Sami (22/10) : on commence par l'ordonnanceur, dans ce dépôt. Avant de l'écrire, qu'apporte-t-il au
lanceur actuel ? Et comment régler des priorités et des tâches qui s'enchaînent ?

### 9.1 Ce que fait le lanceur aujourd'hui

`npm run backlog` lance **un job après l'autre, dans l'ordre du fichier**. Il sait déjà :
- attendre une heure (`notBefore`) ;
- annuler un duel quand ceux d'avant ont mal commencé (`stopIf`) ;
- arrêter un job au bout de sa limite (2 h par défaut) ;
- donner à chaque job le même nombre de fils (`--threads`).

Il ne connaît ni priorité, ni échéance, ni prérequis, et ne fait jamais tourner deux jobs à la fois.

### 9.2 Ce qu'il apporterait, attente par attente

| L'attente de Sami | La réponse |
|---|---|
| **Mieux répartir les tâches sur les cœurs** | Oui, mais seulement en faisant tourner **plusieurs jobs côte à côte**, ce que le lanceur ne fait pas. Le gain vient des petits duels qui n'occupent que 12,5 fils sur 18 et des 12 vrais cœurs, à mesurer d'abord (§ 8). Un duel seul ne va pas plus vite. |
| **Prévenir les blocages** | Oui, c'est le gain **le plus sûr** : ne jamais dépasser la RAM (Claude Code avait tué `endgame-moves` le 20/10), ne pas lancer à 7 h un job de 2 h, ne pas lancer une analyse dont un prérequis a échoué. |
| **Remplir les 18 fils** | Oui, en logeant un job court à côté d'un job limité par la RAM (10 fils occupés sur 18 pour `endgame-moves`), ou dans le temps mort de la fin d'un duel. |
| **Ajuster les priorités** | Oui, c'est **le vrai changement de comportement** : aujourd'hui seul l'ordre du fichier compte (§ 9.3). |
| **Enchaîner des tâches** | Oui : une analyse part dès que ses duels sont finis, sans attendre la fin de la nuit ni un réveil (§ 9.4). |

### 9.3 Les priorités et les échéances

Deux champs de plus pour chaque job :
- **`priority`** : 1 urgent, 2 normal (par défaut), 3 peut attendre ;
- **`due`**, facultatif : l'heure à laquelle le résultat doit être là, par exemple « 8 h 30 » pour le lire
  au réveil.

**La règle de base, celle de Smith** (glossaire) : lancer d'abord le job qui a **le plus de poids par
minute**. Le poids vient de la priorité (1 → 4, 2 → 2, 3 → 1). Un exemple :

| Job | Durée | Priorité | Poids par minute |
|---|---|---|---|
| une analyse rapide demandée pour ce soir | 10 min | 1 (poids 4) | 0,40 |
| un duel 1k@2k | 40 min | 2 (poids 2) | 0,05 |
| une mesure longue sans urgence | 120 min | 3 (poids 1) | 0,008 |

L'analyse passe en premier : elle ne retarde le duel que de 10 min, alors que l'inverse la retarderait de
40. Un job dont l'échéance approche passe devant les autres, s'il peut encore la tenir. Un job lancé n'est
jamais interrompu (sauf par sa limite) : la priorité ne joue qu'au moment de choisir le suivant.

### 9.4 Les enchaînements

Un champ **`after`** : la liste des jobs qui doivent être finis avant celui-ci (ses **prérequis**,
glossaire). Un job n'est prêt que lorsque tous ses prérequis sont finis.
- **Un prérequis sauté par un `stopIf` compte comme fini** : l'analyse se fait sur les duels qui ont été
  joués. C'est le cas courant (une série 1k@2k s'arrête après 2 duels dans 41 % des cas, § 2).
- **Un prérequis en échec ou en dépassement bloque la suite**, et le lanceur l'écrit dans `--list` au
  lieu de lancer une analyse sur des données manquantes.

**L'exemple de Sami : des duels, leur analyse, puis le rapport.**

```json
{ "id": "VALIDATE_LONG_1_JokerWin", "command": "npm run duel -- … --offset 0", "estimate": "40 min", "priority": 2 },
{ "id": "VALIDATE_LONG_2_JokerWin", "command": "npm run duel -- … --offset 1", "estimate": "40 min", "priority": 2,
  "stopIf": { "…": "les règles actuelles" } },
{ "id": "VALIDATE_LONG_3_JokerWin", "…": "idem, offset 2" },
{ "id": "VALIDATE_LONG_4_JokerWin", "…": "idem, offset 3" },
{ "id": "VERSUS_JokerWin", "command": "npm run versus -- <moteur> <moteur de la 1.2> --label JokerWin",
  "after": ["VALIDATE_LONG_1_JokerWin", "VALIDATE_LONG_2_JokerWin", "VALIDATE_LONG_3_JokerWin", "VALIDATE_LONG_4_JokerWin"],
  "estimate": "1 min", "priority": 1 },
{ "id": "CHANGELOG_1.3", "command": "npm run changelog -- 1.3", "after": ["VERSUS_JokerWin"], "estimate": "1 min", "priority": 1 }
```

- Les 4 duels d'une version s'enchaînent déjà : le `stopIf` du 2e lit le 1er, celui du 3e les deux
  premiers. Un `stopIf` est un prérequis implicite. Avec deux jobs côte à côte, ce sont les duels de
  **deux versions différentes** qui tournent ensemble.
- `VERSUS_JokerWin` part dès que le dernier duel joué est fini, même au milieu de la nuit.
- **La mise à jour des docs** (le carnet, le changelog écrit) n'est pas un job : elle demande de lire et
  de juger. Le lanceur peut seulement noter « prêt à relire », et le réveil suivant de Claude s'en charge.

**Le chemin critique** (glossaire). Avec des enchaînements, l'ordre compte même sans échéance pour savoir
**quand** chaque résultat arrive. Deux versions à valider (4 duels + analyse chacune) et une mesure de 2 h
indépendante : lancer d'abord les premiers duels des deux versions donne les deux verdicts plus tôt,
parce que les `stopIf` décident vite (§ 2 : 15 % des séries s'arrêtent après le 1er duel). La mesure de
2 h vient ensuite, ou à côté si les fils le permettent.

### 9.5 Et l'ISMCTS dans tout ça

Les priorités, les échéances et les prérequis entrent dans le planificateur du § 4 sans changer sa
forme :
- **les coups** ne sont que les jobs prêts (prérequis finis, fils et RAM disponibles) ;
- **la récompense** additionne les poids des jobs finis, et retire un retard sur `due` ;
- **le tirage** décide, scénario par scénario, si une série s'arrête après 1, 2 ou 4 duels, et donc
  quand son analyse sera prête. C'est là que l'arbre apporte quelque chose qu'une règle ne voit pas :
  « cette série va probablement s'arrêter après 2 duels, son rapport arrivera tôt ; la mesure longue peut
  partir maintenant ».

### 9.6 Les étapes, revues

Les étapes du § 6 restent, mais l'ordonnanceur passe devant, sans MCTS d'abord :
1. **Les champs `priority`, `due` et `after`** dans le lanceur, avec la règle de Smith. Encore un job à la
   fois. Tests purs : quel job est prêt, lequel passe devant. **Fait le 22/10** (§ 9.7).
2. **Le journal de jobs** (§ 8) : chaque job y écrit ses fils, sa durée et sa RAM.
3. **La mesure du débit selon les fils** (§ 8), de jour à 400 itérations.
4. **Plusieurs jobs côte à côte**, si la mesure le justifie : un budget de fils (18) et de RAM (libre
   moins 5 Go), un pic de RAM estimé par type de job à partir du journal.
5. **Le simulateur et le planificateur ISMCTS** (§ 6, étapes 1 à 5), jugés contre la règle de Smith sur
   les mêmes scénarios.

Les étapes 1 et 2 apportent les priorités et les enchaînements dès la première semaine, sans aucun
algorithme de recherche.

### 9.7 Ce qui est fait (22/10)

L'étape 1 est dans le lanceur : `scripts/lib/domain/backlog-order.js`, pur et testé
(`tests/web-cli/backlog-order.test.js`), qui n'importe rien du jeu.
- **Le choix du job suivant** : ses prérequis d'abord (`after`, et les duels que lit son `stopIf`, pour
  que le duel 2 ne parte jamais avant le duel 1), puis un job qui manquerait son `due`, puis la règle de
  Smith. Les durées sont lues dans `estimate` (« 40 min », « 1 h 30 », « ≤ 2 h »).
- **`npm run backlog -- --list`** affiche la nuit prévue, avec les heures de début et de fin si chaque job
  tient son estimation, « EN RETARD » sur un `due` manqué, puis les jobs qui attendent ou sont bloqués et
  pourquoi.
- **`--fifo`** garde l'ordre du fichier, comme avant.

**Un changement à connaître** : sans priorité ni échéance, le job le plus court passe maintenant devant.
Les duels d'une même série restent dans l'ordre (leur `stopIf`), mais une file qui comptait sur l'ordre du
fichier doit passer `--fifo` ou des `after`.

Vérifié sur une file factice (`--queue`, des commandes `echo`) : un job urgent de 10 min part en premier,
le duel 2 est annulé par son `stopIf`, l'analyse part ensuite sur le duel joué, le job de 2 h à
priorité 3 finit la nuit, et un job au prérequis inconnu reste bloqué avec sa raison.
