# Valider vite, valider bien

Pourquoi les dernières tâches duraient plus d'une heure, ce qui a changé, et quelle
commande lancer selon ce qu'on veut savoir. Objectif : **une tâche complète en
moins de 30 minutes**.

## Où partait le temps

| Poste | Avant | Pourquoi |
|---|---|---|
| Tests (`npm test`) | 9 s | ce n'était pas le problème |
| Rapport (`npm run build`) | 1 min 20 (18 fils, 17/10) | un million de parties, relancé à chaque changement du Stratège |
| Duel entre deux robots rapides | 10 à 30 s | rien à redire |
| **Duel avec le Stratège 2** | **10 à 25 min chacun**, 4 ou 5 par tâche | chaque partie rejoue 64 fins de partie par coup ; 800 parties d'office, même quand l'écart était net au bout de 200 |
| Attentes navigateur | quelques minutes | onglet en arrière-plan : les minuteries sont ralenties à 1 s |

Les duels du Stratège 2 faisaient donc l'essentiel de l'heure. Ils étaient chers
pour deux raisons :
- le cœur, qui joue chaque fin de partie simulée, recalculait beaucoup pour rien ;
- rien n'arrêtait un duel dont le résultat était déjà clair.

## Ce qui a changé

**1. Le cœur est 2,4 fois plus rapide, et joue exactement les mêmes coups.** Le
profil montrait qu'un seul coup demandait environ 500 fois la même estimation,
pour une quarantaine de paires de cartes différentes. Il recopiait aussi tout le
contexte pour chaque carte essayée.
- Une mémoire par coup, la main passée sans copie : 19,3 → 8,0 ms par partie du
  cœur, et 8,5 → 3,5 s par partie du Stratège 2.
- **Garantie** : `npm run fingerprint` joue des parties à graine fixe et calcule
  une empreinte de chaque coup. Une optimisation doit la laisser identique.

| Empreinte de référence (150 parties, 3 pour le Stratège 2) | Valeur |
|---|---|
| `strategist,greedy` | `abf3bc51801c81b4` |
| `strategist,strategist:1.1` | `61af1f11a5c2e46d` |
| `lookahead,strategist` | `9225bb33224f2147` |

**2. Les duels ont deux profils, avec arrêt anticipé et plafond de temps**
(`scripts/lib/domain/duel-plan.js`, testé).

| Profil | Pour quoi faire | Robots rapides | Robots qui cherchent | Plafond |
|---|---|---|---|---|
| `--quick` (par défaut) | trier des idées | 1 000 à 4 000 parties par côté | 30 à 100 | **5 min** |
| `--long` | décider une version | 4 000 à 12 000 | 150 à 400 | **20 min** |

- Le duel joue par rondes et s'arrête dès que le résultat est net. Pendant qu'il
  regarde en cours de route, il exige une fourchette à 99 %, parce que regarder
  plusieurs fois flatterait le hasard.
- À la fin, il donne la fourchette à 95 % de ce qu'il a eu le temps de jouer.
- Le plafond est vérifié entre deux rondes : la dernière ronde peut le dépasser
  d'une minute environ.
- `--games N` joue exactement N parties par côté, sans limite de temps.

**3. Donnes en miroir.** Chaque paquet est joué deux fois, chaque robot à son tour
en premier, comme au bridge en « duplicate ».
- La chance des cartes s'annule, et un écart devient net plus tôt.
- La fourchette affichée ignore ce gain, elle est donc plutôt prudente.

## Quelle commande pour quoi

| Je veux… | Commande | Durée |
|---|---|---|
| vérifier le code | `npm run check` | 20 s |
| savoir si une optimisation change le jeu | `npm run fingerprint -- strategist,greedy 150` | 2 s |
| trier une idée du cœur | `npm run duel -- idea:X strategist` | < 1 min |
| trier une idée du Stratège 2 ou de l'Expérimental | `npm run duel -- experimental:400 stratege` | ≤ 5 min |
| décider une nouvelle version | `npm run duel -- A B --long` | ≤ 20 min |
| régénérer rapport et fiche | `npm run build && npm run pdf` | 4 min |
| savoir si plus de temps de réflexion aide | `npm run time-study` | 8 min |
| faire jouer l'Expérimental contre lui-même | `npm run selfplay` | 20 min au plus |
| ne jouer que des mains faibles ou fortes au 1er joueur | `npm run duel -- A B --hands weak` | comme le profil |
| comparer deux variantes de vitesses différentes | `npm run duel -- A@t1400 B@t1400 --screen --page` (1,4 s par coup chacun) | 10 min |

**Règle de conduite.**
1. Une idée se trie d'abord en `--quick`, sur le cœur si possible (secondes plutôt
   que minutes).
2. Seuls les finalistes passent en `--long`, une fois.
3. Le rapport ne se régénère que si le cœur (`strategist`) change de coups : ce
   n'est pas le cas pour le Stratège 2 ni pour l'Expérimental.

## Premier résultat sous ce régime

- L'Expérimental avec 400 fins de partie par coup (environ 1 s par coup) bat le
  Stratège 2.1 dans **62,5 %** des parties (fourchette 52,5 % – 71,5 %).
- Mesure : 96 parties en 6 minutes, profil rapide avec donnes en miroir.
- Dans le navigateur, il dispose de 10 s par coup, et il réfléchit aussi pendant
  ton tour (`docs/jouer.md`).

## Plus de temps = meilleur ? (`npm run time-study`)

Des parties entières à 30 s par coup ne tiennent pas en 20 minutes : il en
faudrait des centaines pour voir une différence. La question se pose donc **coup
par coup**, sur 160 positions tirées de l'auto-jeu.

La recherche peut s'arrêter à tout moment. Une seule recherche va donc jusqu'à
une référence de 60 s, et on note le coup qu'elle jouerait à 5, 10, 15, 20 et
30 s.
- Les temps sont convertis en simulations au débit mesuré dans le navigateur :
  164 simulations par seconde.
- Les notes de la référence disent ce que coûte un autre coup.
- Durée totale de l'étude : 7,6 minutes.

| Temps par coup | Même coup que la référence (60 s) | Perte moyenne par coup | Arrêt anticipé (coup évident) |
|---|---|---|---|
| 5 s | 90,0 % | 0,11 point de victoire | 27 % |
| **10 s** | **92,5 %** | **0,05** | 36 % |
| 15 s | 94,4 % | 0,03 | 37 % |
| 20 s | 95,6 % | 0,03 | 41 % |
| 30 s | 97,5 % | 0,01 | 44 % |

**Lecture.**
- Sur une partie de 21 coups, passer de 5 à 10 s gagne environ 1 point de
  probabilité de victoire.
- De 10 à 30 s, moins d'un point : le bruit reprend le dessus sur des coups déjà
  bien jugés.
- Un tiers des coups sont évidents : la recherche s'arrête d'elle-même avant la
  limite.
- **La limite reste à 10 s.** Plus de temps n'apporterait presque rien.
- Limite de la méthode : la « perte » est estimée par la référence elle-même, qui
  a son propre bruit. Un duel 10 s contre 20 s demanderait plus d'une heure pour
  la confirmer.

**Le duel qui tranche** (Sami, 30/09, `npm run duel -- experimental:4000
experimental:400 --long`, 48 parties en 13 minutes) : 4 000 simulations par coup
gagnent **37,5 %** (fourchette 25,2 – 51,6 %) contre 400. Dix fois plus de
simulations ne rapportent rien, et peut-être moins. La page (10 s, soit 3 000 à
5 000 simulations) n'est donc pas plus forte que le classement mesuré à 400.

**Pourquoi** (`npm run bench -- 4000`, contre `-- 400`) :
- **Sur les puzzles difficiles**, la recherche trouve le coup gagnant **30 fois
  sur 60**, à 400 comme à 4 000. À 4 000, elle s'arrête même plus tôt, sûre
  d'elle, sur le mauvais coup. Le budget amplifie le jugement des simulations ;
  il ne le corrige pas.
- **En milieu de partie**, à 4 000 simulations, les trois graines choisissent
  encore des coups différents dans 4 positions sur 12. Les meilleurs candidats
  se valent à quelques pour cent près : les départager ne change pas la partie.

**L'étalon de la politique** (`npm run policy`) : sur 400 fins de partie
décisives de l'auto-jeu (9 cartes ou moins, vérité donnée par le solveur), la
politique qui joue les simulations garde le coup gagnant dans **94,3 %** des cas,
et **87,5 %** sur les positions délicates, où la moitié des coups ou moins
gagnent. C'est la mesure de départ de la 0.8, qui travaille la qualité des
simulations et non leur nombre.

**Les duels à la règle de la page** (`--page`) ne coûtent rien de plus : 190,8 s
contre 194,1 s pour les mêmes 48 parties. Les parties plus courtes paient les
preuves de revendication.

## Des duels plus courts ? (profil `--screen`, fourchette par paires)

Pour essayer plus d'idées, deux pistes ont été mesurées le 30/09 sur un même duel,
`experimental@200` contre `experimental@400`, 10 minutes, règle de la page.

- **Trier à 200 simulations** : 200 contre 400 gagne **45,8 %** (38,4 – 53,3 %),
  soit pas de différence nette. Le budget change peu le classement, comme le
  disait déjà le duel 4000 contre 400. Le tri des idées se fait donc à 200
  simulations : deux fois plus de parties dans le même temps.
- **La fourchette par paires** (chaque donne jouée des deux côtés, la paire
  comme unité, `pairedInterval`) : 14,9 points de large contre 16,1 partie par
  partie. Seulement **8 % plus étroite** : entre deux robots proches, la chance
  des donnes pèse moins que prévu. Elle reste la fourchette de décision, car
  c'est la bonne analyse d'un plan apparié, mais elle ne suffit pas à diviser la
  durée par deux.

**Protocole retenu.**
- **Tri** : `npm run duel -- candidat@200 référence@200 --screen --page`, 10
  minutes au plus. Un candidat passe s'il atteint 52 % ou plus.
- **Confirmation** : `npm run duel -- candidat référence --long --page`, 20
  minutes au plus, 400 simulations. La version monte si la borne basse de la
  fourchette par paires dépasse 50 %.

Les identifiants de moteur se combinent :
- `experimental+sample=0.05+prior=0.15`, pour les variantes ;
- `experimental:0.6@200` ou `ismcts@t1400`, pour le budget (en simulations ou en temps) ;
- `ismcts+depth=2`, pour la recherche en arbre.

## Les duels gardés en replays (`duels/`)

Les parties des duels sont gardées, pour bâtir les tests suivants sur elles au
lieu de rejouer des parties entières (`src/replay/core/bot-games.js`,
`scripts/lib/domain/duel-save.js`).

- **Quand** : avec `--save`, et d'office pour un duel long ou quand les deux
  robots jouent à pleine force. C'est le cas d'un robot qui ne cherche pas
  (Basique, Stratège), d'une recherche à 800 itérations ou plus, ou d'une
  recherche à l'horloge (`@t`).
- **Où** : `duels/<date>_<a>_vs_<b>.json`, hors de git (environ 11 Ko par
  partie). Un fichier par duel : ses réglages, puis chaque partie au format des
  replays (paquet et coups), donc relisible comme une partie de la page.
- **L'analyse, calculée une fois** :
  - `handClasses` : la main de départ de chacun, faible, moyenne ou forte.
    `balancedGames()` ne garde que les parties où les deux sont moyennes,
    pour un milieu de partie équilibré ;
  - `advantage` : qui tient la partie au tour 30, la pioche vide, en jeu parfait.
    Le solveur exact le dit en moins d'une seconde en général ; aucun test
    suivant n'a à le recalculer.
- **Rejouer à partir d'un tour** : `stateAt(log, tour)` (`src/replay/core/log.js`)
  rend la position exacte, même paquet et même pioche. On n'y change qu'un
  mécanisme, sur un seul coup, et on rejoue la suite : une partie qui bascule au
  tour 30 se voit sur la même donne. Valable tant que la version des robots est
  la même.

### Retrouver une partie, et la rejouer depuis un tour (02/10)

- **Ce que l'analyse note en plus** (`src/replay/core/game-analysis.js`) :
  - `columns` : le tour où chaque joueur a une carte sur les 7 bornes ;
  - `firstBorder` : la première borne gagnée, par qui et à quel tour ;
  - la pioche vide n'est pas notée : c'est toujours le tour 30.
- **Un robot par partie**, construit à partir de la graine de la partie
  (`seatRng`) : la même graine et la même position donnent les mêmes coups.
  Une partie rejouée depuis n'importe quel tour redonne exactement la même
  fin.
- **L'index** `duels/index.json` : une ligne par partie, avec la clé
  (`gameKey` : règle, paquet, joueurs, graine). Une partie déjà gardée n'est pas
  réécrite (« N doublons ignorés »). `npm run games -- --reindex` le refait à
  partir des fichiers.
- **Les commandes** :

| Je veux… | Commande |
| --- | --- |
| trouver des parties | `npm run games -- --lost-by experimental@0.9 --hands medium --from first-border --limit 100` |
| vérifier que le rejeu redonne la même fin | `npm run branch -- --vs experimental@0.9 --from first-border --check` |
| voir ce qu'une erreur change | `npm run branch -- … --force random` |
| essayer un autre moteur depuis un tour | `npm run branch -- --lost-by experimental@0.9 --from first-border --engine <moteur>` |
| tester un changement de jugement depuis un tour décisif (6 min) | `npm run core-test -- "ismcts+widen=3+depth=5+core=nb1@800" --from 23` |
| tester une fin de partie depuis un tour de bascule | `npm run core-test -- "ismcts+widen=3+depth=7+core=plain@880" --from 20` |
| comparer des variantes contre le Stratège, mêmes donnes | `npm run ab -- "ismcts+widen=3+depth=5@800" "phase:20:…/…" --pairs 400 --page` |
| chercher dans les replays ce que les gagnants font plus que les perdants (10 s) | `npm run rules -- --min 0.7` |
| où vont les jokers, et ce qu'ils rapportent (10 s) | `npm run jokers` |
| l'oracle sur les replays : un arbre sur tous les coups, aux tours 15-16, 20-21, 25-26 (≈ 10 s par position ; reprend où il s'est arrêté) | `npm run oracle -- --minutes 240` |
| l'oracle au coup qui remplit la dernière colonne vide de chaque joueur | `npm run oracle -- --at last-column --minutes 240` |
| relire le résumé de l'oracle (data/oracle-diffs.json) | `npm run oracle -- --summary` |
| confirmer les écarts de l'oracle par le jeu (suite jouée par le 0.9, jugée au tour 30) | `npm run oracle -- --confirm --seeds 4 --minutes 110` → `data/oracle-confirm.json` |
| tester un moteur à arbre en journée | **400 itérations au plus** (`…@400`), sauf demande ; 800 pour valider, au backlog de nuit |
| décider une version (Sami, 03/10 : un tri à 400 écarte une idée, il ne la promeut plus) | 4 duels longs (`--long --games 125 --page --offset 0` à `3`, 1 000 parties), à 2 000 itérations des deux côtés depuis le 04/10 (la version à battre : l'Expérimental 1.2, `…stfig6+exact=12@2000`, depuis le 08/10), puis `npm run versus -- <A> <B>` : la borne basse réunie par paires au-dessus de 50 % |
| demander à l'oracle avant les duels longs : quel coup joue-t-il là où deux cœurs divergent ? | `npm run oracle -- --disagree <cœur> --minutes 40` → `data/oracle-disagree.json` |
| le coup de l'oracle est-il entré dans le top 8 d'un cœur ? (sans nouvelle recherche, quelques s) | `npm run oracle -- --summary --core <cœur>` → `data/oracle-diffs.json` |
| **le banc de similitude** : une version du V1 jouée sur les positions de référence de l'oracle, sa valeur oracle (part des visites de l'oracle sur son coup, rapportée à celle de son favori) contre celle du 1.0, l'écart par paires et un verdict « à pousser / neutre / à écarter » (environ 20 min sur 18 fils pour un arbre à 2 000 itérations) | `npm run banc -- <moteur> [--threads N|max] [--queue]` → `data/banc.json` ; `--queue` ajoute ses 4 duels longs au backlog |
| construire les positions du banc : deux recherches de l'oracle par position, ses 12 coups les plus visités gardés | `npm run oracle -- --source <A>,<B> --out banc --turns 4-30 --runs 2 --keep 12 --spread` → `oracle/positions-banc.jsonl` |
| le banc classe-t-il les versions comme les duels ? Non pour l'instant (04/10 : corrélation de rang 0,32 sur 13 versions, 0,61 aux tours 4-10) : son verdict reste un indice, sa valeur au début est celle à lire | `npm run banc -- --calibrate` (versions de `data/banc-calibration.json`) → `data/banc.json` |
| le banc oracle : l'accord de chaque cœur avec l'oracle, à côté de ses duels longs (classe-t-il les cœurs comme les duels ?) | `npm run oracle -- --bench stfig6,lean,…` → `data/oracle-bench.json` |
| l'oracle sur un autre corpus : les parties de deux moteurs, une plage de tours, toujours une ou deux recherches, classées par un autre cœur | `npm run oracle -- --source <A>,<B> --out <nom> --turns 1-30 --runs 2 --rank stfig6` → `oracle/positions-<nom>.jsonl`, `data/oracle-diffs-<nom>.json` (avec le temps médian par tour) |
| les parties de l'oracle relues par le V1 : même coup, top 1/3/8 du cœur, visites perdues, par tranche de tours | `npm run shadow -- [<moteur oracle>] [--engine <V1>]` → `data/oracle-shadow.json` |
| comparer deux moteurs sur toutes leurs parties gardées (score par paires, siège, jokers, ce que A joue autrement) | `npm run versus -- <moteur A> <moteur B> --label nom` → `data/versus.json` |
| comparer deux cœurs de coût différent (plus de 3 % par itération) | à temps égal : `…@t400` contre `…@t400` (à ~1 000 itérations par seconde, `@400` ≈ `@t400`) ; sinon à itérations égales, reproductibles |
| programmer un traitement pour la nuit | dans `data/backlog.json` : `"status": "scheduled", "notBefore": "2026-10-03T21:00"` |
| lancer les traitements longs de la nuit (2 h au plus chacun, arrêtés au-delà) | `npm run backlog` (`--list` pour voir la file, `data/backlog.json`) |
| ranger les traitements finis et lus (n'en garder que 3 dans la file) | `npm run backlog -- --archive` → `data/backlog-done.json` ; `--list` n'affiche que les 3 derniers finis |
| le nombre de fils de calcul : par défaut tous moins 3, 18 au plus (la moitié jusqu'à 6) ; en forcer N, ou tous moins un | `LOPIN_THREADS=4 npm run …`, `LOPIN_THREADS=max npm run …`, ou `--threads N|max` (docs/cloud.md) |
| envoyer les calculs sur un serveur loué | voir docs/cloud.md |
| la file du portable (git pull, lancer, git push) | `npm run backlog -- --queue laptop` : 5 fils sur 8 par défaut, `LOPIN_THREADS=4` pour garder plus de marge (docs/cloud.md) |
| refaire la rétrospective du robot (Elo, versions, cœur, prix des erreurs ; archivée) | `npm run retrospective` → `out/OLD/retrospective.html` |
| le changelog d'une version de l'Expérimental : chaque essai, la frise, l'oracle, la vitesse, les jobs | `npm run changelog -- 1.2` → `out/changelog-exp-1.2.html`, depuis `data/changelog-exp-1.2.json` et la page `src/report/changelog/1.2.html` ; une version sortie s'arrête à son `until` |
| ouvrir le changelog d'une nouvelle version | copier la page de la précédente en `src/report/changelog/<version>.html` (le style commun est `src/report/changelog/style.css`, les sections du V1 `v1-sections.html`, insérés par `scripts/changelog.js` : la page n'a que ses propres sections), n'y garder que les sections qui valent encore, commencer `data/changelog-exp-<version>.json`, poser `until` sur la précédente, ajouter le lien au menu Versions (`web/index.html`) |
| remesurer ce que coûte le cœur, pour la rétrospective (machine au repos seulement) | `npm run retrospective -- --measure` → `data/core-timings.json` |
| savoir à quel tour une erreur coûte le plus | `npm run error-impact -- --turns 18-29 --games 120 --explain` (`--points` : les tours charnières) |

- **Les filtres** : `--lost-by` ou `--won-by` (un joueur), `--hands` (sa main de
  départ), `--balanced` (deux mains moyennes), `--vs` (les deux sièges sont ce
  joueur), `--from first-border|columns|N`, `--limit`.
- **Une suite modifiée n'est pas jouée jusqu'au bout** : elle s'arrête au tour 30,
  et le solveur exact dit qui tient la partie. Le camp en avance à ce moment
  gagne 92 à 97 % des parties.
