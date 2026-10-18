# Le Labo : feuille de route

L'onglet Labo (l'ancien Observer, Sami 17/10) est un outil de recherche à chaud. Deux robots
jouent coup par coup dans la page, et chaque robot arbre montre ce qu'il a cherché. Le mode
d'emploi est dans `docs/jouer.md`, le vocabulaire dans `docs/glossaire.md` (« Le Labo »).

Ce que le Labo fait trouver, ce sont des idées. Elles suivent ensuite le chemin habituel : le tri
à 400, puis la 1k@2k (`docs/validation.md`). Le Labo seul ne décide jamais d'une version.

Deux règles valent pour tous les lots :

- **Aucun coup ne change.** Le Labo lit l'arbre entre deux pas de recherche, il n'y touche pas.
  Les empreintes 1.0 `152e2a9c9d66170c`, 1.2 `1d041613cd7bcd8d` et Oracle v1 `c87b8b524dede38b`
  sont vérifiées à chaque lot.
- **La page reste fine.** Ce qui décide est pur et testé sous Node (`web/app/lab/confidence.js`,
  `tree-layout.js`, `tree-diagnosis.js`, `lab-text.js`, `src/sim/mcts/tree-snapshot.js`). Le DOM
  dessine et écoute (`lab-game.js`, `lab-panel.js`, `lab-parts.js`, `tree-view.js`).

## Lot 1 : l'arbre en direct et les cartes colorées (fait, 17/10)

Commit `b280fa3`.

- **Une partie coup par coup** : « Coup suivant », ou « En continu » jusqu'à « Pause ». Les bots
  sont ceux des duels, avec les mêmes graines (graine + 1, graine + 2), donc les mêmes coups.
- **Les workers** : 4 au plus par défaut, réglable jusqu'au nombre de cœurs moins 3.
- **En direct** : pendant qu'un robot arbre cherche, ses 8 candidats bougent toutes les 250 ms
  (visites, taux, intervalle de Wilson, rang du cœur).
- **Les cartes colorées** de la main du joueur au trait :
  - vert, aussi bon que le coup joué ;
  - jaune, plus loin ;
  - rouge, nettement derrière (tout l'intervalle sous celui du coup joué) ;
  - gris, hors des 8 candidats.

  Un clic sur une carte allume ses bornes avec leur taux.
- **Le diagnostic** :
  - coup incertain ;
  - réplique dangereuse de l'adversaire ;
  - meilleur taux ailleurs que sur le plus visité ;
  - coup que le cœur classait loin ;
  - candidats presque pas explorés ;
  - troisième pli plat ;
  - profondeur jamais atteinte ;
  - fin résolue par le solveur exact.
- **Les étages** : par pli, la part des nœuds visités plusieurs fois, une seule fois, jamais.
- **L'arbre en SVG** :
  - molette pour zoomer, glisser pour se déplacer ;
  - un clic sur un nœud donne sa suite de coups en clair et ses chiffres ;
  - un double-clic le déplie ;
  - un clic sur un étage donne ses chiffres ;
  - l'Oracle light montre ses deux arbres.
- **Le 18/10** (Sami) : l'arbre ne dessine que les 3 fils les plus visités de chaque nœud, à tous
  les étages, candidats compris. Les autres rejoignent le nœud « +n ». Un double-clic sur « +n »
  les montre tous.
- **Replays** : une partie du Labo enregistrée garde ses candidats et ses étages ; un replay de
  duel n'en garde que les étages.

## Lot 2 : les réglages et ce qui a déjà été mesuré (à faire)

- **Le constructeur de bots** (`web/app/lab/engine-builder.js`, pur).
  - Le formulaire donne un engine id : base 1.2, puis widen, depth, candidats, pwl, exact, trees,
    fpu, final, crn, puct, mirror, et les itérations ou un temps (`@t`).
  - Des préréglages tirés de la gamme et des versions nommées du glossaire.
  - L'id est validé par `ismctsSettings`, puis normalisé (clés triées) pour le retrouver parmi les
    configs mesurées.
- **Les garde-fous.** Une mesure des itérations par seconde est faite au lancement dans un worker
  (300 itérations de la 1.2), et donne une estimation par coup et par partie.
  - Orange au-delà de 10 000 itérations par coup ou de 5 min par partie.
  - Rouge, avec confirmation, au-delà de 50 000.
  - Une note quand depth > 10 : les étages 6 à 10 ne sont jamais atteints.
  - Les workers restent plafonnés au réglage du Labo.
- **Des moteurs libres** : `botPlayer` / `botEntry` acceptent un engine id hors gamme, enregistré
  dans le replay comme `{ kind: "bot", engine }`.
- **Les configs déjà mesurées.** `npm run lab-index` écrit `data/lab-configs.json`, sous 500 Ko,
  servi par `/api/lab/configs` :
  - `duels/index.json` regroupé par paire de moteurs, avec les intervalles appariés ;
  - les noms du glossaire ;
  - les verdicts des changelogs.

  Pour la config construite, la page dit « déjà mesurée : 51,5 % (49,0 – 54,0) sur 1 000 parties
  contre la 1.2, écarté (ReplyFpu1) », ou « jamais mesurée », avec ses voisines (les configs qui
  diffèrent d'une clé).
- **« Rejouer ce coup avec… »** : la position affichée (`stateAt(log, turn)`) est recherchée par 1
  à 4 variantes en workers, côte à côte, avec un message quand le coup choisi change.
- **Les préréglages sauvés** : `/api/lab/presets` écrit `data/lab-presets.json`. Chaque préréglage
  porte un nom, les moteurs, une graine et une note.

## Lot 3 : l'oracle, le connu, le profileur, l'export (à faire)

- **L'avis de l'oracle** sur le coup affiché :
  - l'Oracle light (10 000 itérations, deux workers, environ 5 s), ou Oracle3 à 20 000 avec un
    avertissement (environ 20 s) ;
  - son favori, sa part de visites, et le rang chez lui du coup du bot ;
  - avec 12 cartes au plus et la pioche vide, le solveur exact donne le verdict de chaque coup.
- **« Déjà rencontré »** : `lab-index` tire aussi des duels de la 1.2 la distribution, tour par
  tour, de quelques chiffres de l'arbre (part du premier, écart, nœuds à une visite). Le Labo situe
  le coup affiché : « plus incertain que 85 % des coups du tour 18 ».
- **Le profileur**, en option :
  - une sonde `probe` dans `createIsmcts` mesure le temps du tirage, de la descente et des
    simulations, et compte les évaluations du cœur et les plis simulés ; sans la sonde, rien ne
    change, et `npm run bench` le vérifie ;
  - si Edge le permet, l'API de profilage JS du navigateur donne en plus le temps par module.
- **Garder pour analyse** :
  - une note sur un coup (`entry.note`) ;
  - « Copier la commande » donne le `npm run branch` / `oracle` de la position et le
    `npm run duel` des deux configs, sans rien mettre dans le backlog.
- **Des workers qui démarrent plus vite** (point A7 de l'audit) : charger à la demande la vingtaine
  de modules d'idées rejetées.

## Les idées venues du Labo

- **Les coups miroirs** (`+mirror=1`, Sami 18/10, `src/sim/mcts/mirror.js`) : tant qu'aucune carte
  n'est posée hors de la borne du milieu, jouer sur la borne b ou sur la borne 8 − b donne deux
  parties miroirs de même valeur. L'arbre ne garde alors que les bornes 1 à 4, à la racine (les
  places libérées vont à d'autres cartes) et dans chaque liste courte (les réponses aussi). Le
  résultat est dans `docs/strategie/` (dernier chapitre).
