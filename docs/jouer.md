# Jouer contre les robots

## Lancer

```bash
npm run play      # puis ouvrir http://127.0.0.1:4742/
```

Un petit serveur local, sans dépendance, sert la page et enregistre les replays. Il
n'écoute que sur ta machine (127.0.0.1). Live Server ne suffit pas : il ne peut
pas écrire de fichier. `Ctrl+C` arrête le serveur.

Les règles sont celles de la fiche : le jeu de 52 cartes sans figures (As à 10),
les 2 jokers sans couleur et 7 bornes. Le premier à avoir 4 bornes, ou 3 côte à
côte, gagne.
- **Revendiquer** (règle officielle, `endMode: "claim-end"`) : **dès qu'un coup est
  joué**, le joueur qui vient de poser prend toute borne où ses 3 cartes sont
  posées et que l'adversaire ne peut plus battre ; puis l'adversaire prend les
  siennes, car une carte posée peut aussi prouver une borne de l'autre côté. Si
  les deux atteignent la victoire sur le même coup, elle va à celui qui a joué. La preuve ne s'appuie que sur les cartes de la table : sa propre
  main compte parmi ce que l'adversaire pourrait tenir. La page revendique pour
  toi, automatiquement. Une borne revendiquée ne prend plus de carte.
  - La fiche imprimée règle une borne dès que ses deux côtés ont 3 cartes, ce
    que ce mode respecte, et décrit la revendication dans un encadré à part,
    « Pour les habitués : prendre une borne plus tôt » (page 2).
- **La partie s'arrête dès la victoire**, sans jouer les cartes restantes : 97 %
  des parties entre robots finissent avant la dernière carte, en 37 coups en
  moyenne au lieu de 42.
- **Les bornes jamais revendiquées** se règlent en fin de partie, dans l'ordre où
  elles se sont complétées.
- **Les anciens replays** gardent leur règle et se relisent à l'identique : `final`
  (toutes les bornes réglées à la fin), ou `claim`, la revendication d'un coup en
  retard des parties du 30/09 (au début du tour suivant du joueur). Sur 1000 parties, les deux règles
  désignent le même vainqueur 91 fois sur 100 : une borne fermée change les coups
  possibles, donc parfois l'issue.

## Les six onglets

Dans l'ordre : Jouer, Labo (l'ancien Observer), Puzzles, Replays, Stats, Ordonnanceur.

**Jouer.** « Nouvelle partie », sur deux colonnes : à gauche ton adversaire,
à droite qui commence, les cartes bonus de l'extension (0 à 6), l'option
« Mains découvertes » et ton prénom. Chaque robot est décrit en une ligne
chiffrée : ce qu'il examine, son rythme, son Elo lu dans tes replays
(`/api/elo`) et son score contre le robot du dessous (« 76 % vs Stratège »,
`vsLower` dans `src/config/bots.js`).
- **Mains découvertes** : les deux mains restent visibles toute la partie, la
  pioche reste cachée. La case est décochée à chaque ouverture du dialogue ; le
  replay garde l'option (`rules.openHands`) et montre les deux mains.
- **Les figures de l'extension** se posent comme une carte, à côté d'une borne.
  La **Dame de Cœur** prend deux clics : sa borne, puis celle à échanger. Le
  **Valet de Trèfle**, pioche non vide, attend sa défausse : clique une carte de
  ta main pour la défausser (tu en pioches deux, la défausse retourne dans la
  pioche, pas de pioche en fin de tour), ou reclique sur la même borne pour le
  poser sans défausse. Échap, ou un clic sur le Valet, annule. Pendant
  l'attente, les cartes qu'il peut défausser sont **en orange** dans ta main.
  La **Dame de Pique** sélectionnée allume **en bleu-vert** la carte qu'elle
  reprendrait sur chaque borne où elle peut aller : la dernière posée de ton côté.
- **Passer mon tour** : le bouton n'apparaît que si tu n'as plus aucun coup
  légal, comme le robot qui passe dans la même situation.
- **Poser une carte** : glisse-la de ta main vers une borne. Autre façon : clique
  la carte, puis la borne, ou tape 1 à 7. Échap annule la sélection.
- **Jouer à l'avance** : pendant que le robot réfléchit, sélectionne une carte
  puis clique une borne (ou tape 1 à 7). La borne est entourée de pointillés, et
  le coup part tout seul dès que c'est ton tour, s'il est encore légal ; sinon la
  carte reste sélectionnée. Échap annule. Une carte sélectionnée le reste quand le
  robot joue : seul ton propre coup efface la sélection.
- **Ranger ta main** : glisse une carte sur une autre, ou utilise « Trier par
  couleur » (♠ ♥ ♣ ♦, noir et rouge en alternance, jokers à la fin) ou « par
  valeur ». Tu peux ranger ta main même pendant le tour du robot.
- **Lire les piles** : chaque carte porte sa valeur et sa couleur dans le coin
  haut gauche, la partie qui reste visible quand les cartes se chevauchent.
  Survole une carte d'une pile pour la voir en entier.
- **Quatre couleurs** (Sami, 14/10) : le bouton « 4 couleurs », en haut à droite après « Règles »,
  met les ♦ en bleu et les ♣ en vert (♠ noir, ♥ rouge, le joker inchangé), pour ne jamais prendre
  un carreau pour un cœur dans une suite. Il vaut pour tous les onglets et le navigateur s'en
  souvient ; ses quatre symboles montrent les couleurs en cours.
- **Compter les couleurs** : en haut à droite, un bouton par couleur donne le
  nombre de cartes de cette couleur que tu vois, sur le plateau et dans ta main,
  sur 10 (« ♥ 6/10 »), puis les jokers sur 2 (« JK 1/2 »). Maintiens un bouton,
  à la souris ou avec Entrée : les cartes de cette couleur (ou les jokers)
  s'allument, les autres passent en gris.
- **À gauche** : la pioche (grisée une fois vide), le numéro du tour et un
  chronomètre discret : le temps du coup en cours et celui de la partie. Il
  s'arrête quand la fenêtre n'est plus active, pour une note prise ailleurs par
  exemple, et reprend à ton retour.
- **En cours de partie** : une borne revendiquée passe au vert si elle est à toi,
  au rouge sinon, avec sa combinaison. Le bandeau de fin s'affiche dès la victoire.
- **En fin de partie** : les bornes qui restent se règlent une à une. Chacune glisse vers son
  gagnant, verte si elle est à toi, rouge sinon, et la combinaison s'affiche de
  chaque côté.
- **Enregistrement** : la partie s'enregistre toute seule dans `replays/`. Le nom
  du fichier finit par le score, en bornes, premier joueur d'abord : `_4-3`.
  Une victoire par 3 bornes côte à côte remplace le chiffre du gagnant par un B :
  `_B-2`.
- **« Recommencer »** : demande confirmation, puis abandonne la partie sans rien
  enregistrer.

**Labo** (l'ancien Observer, 17/10 ; feuille de route : `docs/labo.md`). Deux robots de la gamme s'affrontent, avec les deux
mains visibles, **coup par coup** : « Nouvelle partie », puis « Coup suivant », ou
« En continu » jusqu'à « Pause ».
- Pendant qu'un robot arbre (Expérimental, Oracle light) réfléchit, ses 8 candidats
  bougent en direct sous la table : visites, taux de victoire et sa fourchette à 95 %.
  Chaque robot cherche ses propres itérations, comme en duel : la partie est celle
  que joueraient les mêmes robots avec la même graine dans Node.
- **Les cartes de sa main sont colorées** : vert, aussi bon que le coup joué (l'arbre
  ne les départage pas) ; jaune, plus loin ; rouge, nettement derrière ; gris, la
  carte n'est dans aucun des 8 candidats. Clique une carte (ou un candidat) : les
  bornes où elle irait s'allument avec leur taux.
- **Le diagnostic** relève ce qui frappe dans l'arbre : coup incertain (les deux
  premiers ne se départagent pas), réplique dangereuse de l'adversaire, meilleur taux
  ailleurs que sur le plus visité, coup que le cœur classait loin, candidats
  presque pas explorés, pli 3 où l'on juge sur une seule partie, profondeur jamais
  atteinte.
- **Les étages** : par pli, les nœuds visités plusieurs fois, une seule, jamais.
- **L'arbre** se dessine quand le coup est joué : un nœud par coup, sa taille selon
  ses visites, sa couleur selon le taux de qui le joue (rouge 30 % ou moins, vert
  70 % ou plus). Molette pour zoomer, glisser pour se déplacer, double-clic dans le
  vide (ou Échap) pour tout revoir ; clic sur un nœud pour son détail (la suite de
  coups en clair, taux, visites, disponibilité, suites), double-clic pour le déplier ;
  clic sur un étage pour ses chiffres. L'arbre va jusqu'au pli 5 (Sami, 18/10) : 3
  candidats, puis 2 fils par nœud, le pli 4 sous les deux meilleurs candidats, le
  pli 5 sous le meilleur. « +205 » regroupe les autres fils, un double-clic sur lui les
  dessine tous.
- La table montre le dernier coup joué (« Tour 29 » sous la pioche), le panneau le
  coup qui suit, cherché sur cette table (« Tour 30 »). L'Oracle light montre ses deux arbres (« Arbres : 1 2 »).
- Coup par coup, le lecteur reste sur la position que le robot vient d'étudier :
  > montre son coup. En continu, il suit la partie jusqu'au bout.
- « Fils pour les robots » : 4 workers au plus par défaut (jusqu'au nombre de cœurs
  moins 3), à côté des duels de jour.
- Boutons début ⏮, coup précédent <, lecture et pause, coup suivant >, fin ⏭
  (les bornes réglées), et vitesse. Les touches Début et Fin font la même chose.
  Depuis la fin, < revient au coup d'avant. La pioche est vide pendant les 12
  derniers coups : c'est normal, il n'y a plus rien à piocher.
- Les deux mains sont triées par couleur à la distribution, et les cartes piochées
  arrivent à droite, comme en jeu. « Trier : par couleur / par valeur » range les
  deux mains à partir du coup affiché.
- Le compteur affiche le tour du coup montré, comme les journaux et le panneau de
  droite.
- La **graine** identifie la partie : remets la même pour la revoir.
- Le panneau de droite dit ce que le robot avait en main, où il a joué, ce qu'il y
  avait en face, et ses meilleures options avec leur gain estimé.
- « Enregistrer cette partie » la range dans `replays/`.
- **Régler un robot** (lot 2, 18/10) : un formulaire part de l'Expérimental 1.2 (ou d'un robot
  de la gamme, ou d'une config nommée par les duels) et donne l'identifiant du moteur. Dessous :
  - ce qu'il coûte par coup et par partie, d'après la vitesse de la 1.2 mesurée une fois dans un worker ;
  - les garde-fous : orange au-delà de 10 000 itérations par coup ou de 5 min par partie, rouge
    au-delà de 50 000 (la partie ne part qu'avec « J'accepte une partie très longue »), une note
    au-delà de la profondeur 10 ;
  - ce que les duels en ont déjà mesuré (« 51,5 % (49,0 – 54,0) sur 1 000 parties contre
    Expérimental 1.2 : pas d'écart net »), ou « jamais mesurée » avec ses voisines (un réglage de
    différence), qu'un clic charge. La source est `data/lab-configs.json` (`npm run lab-index`).

  « En bas » / « En haut » le mettent dans la liste des robots, « Variante » dans « Rejouer ce coup avec… ».
- **Rejouer ce coup avec…**, sous les candidats, dans le Labo comme dans les Replays : la position
  affichée est recherchée de nouveau par 1 à 4 variantes, l'une après l'autre, côte à côte, avec
  « Autre coup » quand le choix change. Avec « la graine du coup joué », le même moteur retrouve le
  même coup : un témoin pour les autres.
- **Réglages sauvés** : les deux robots, la graine et une note, sous un nom, dans `data/lab-presets.json`.
- **L'avis des juges** (lot 3), un bouton chacun : l'Oracle light et Oracle3 jugent la décision avec
  ce que le robot savait, l'Omniscient juge la donne (il voit les deux mains et la pioche) ; un coup
  que lui seul refuse a perdu à cause des cartes cachées. La pioche vide, à 12 cartes au plus, le
  **solveur exact** dit de chaque coup s'il gagne, fait nul ou perd.
- **Déjà rencontré**, dans le diagnostic : le coup parmi ceux de l'Expérimental 1.2 au même tour en
  duel (« favori à 31 % des visites : plus incertain que 62 % d'entre eux »).
- **Profileur** (la case à gauche, avant « Nouvelle partie ») : où va le temps d'une itération
  (tirage, descente, simulation, remontée), et ce qu'elle coûte en évaluations du cœur et en plis.
  Aucun coup ne change.
- **Garder pour analyse** : une note sur le coup, gardée quand tu enregistres la partie, et
  « Copier les commandes » : `npm run position` sur cette position et le duel long des deux robots.

**Replays.** La liste des parties récentes (`replays/`) et gardées
(`data/replays/`), cinq visibles à la fois.
- Chaque partie tient sur trois lignes :
  - « (W) Sami -vs- Stratège 2.1.0 » : le (W) est du côté du gagnant, et le
    bouton est vert si tu as gagné, rouge sinon ;
  - le score (ou « 3 bornes connectées ») et le mode : « Standard » ou
    « Extension (6 bonus) » ;
  - la durée et la date.
- Même lecteur que le Labo. Une partie jouée au Labo et enregistrée garde, coup par
  coup, les candidats et les étages de l'arbre (pas l'arbre lui-même) : le panneau
  du Labo les remontre ; un replay de duel n'en a que les étages.
- Pour chacun de tes coups, le panneau donne le temps que tu as mis (« Joue 5♥
  sur la borne 2 en 2 min 30 s »). Il dit aussi ce que le **Stratège 2.1**
  aurait joué : ses 4 meilleurs coups et le tien, chacun rejoué sur les mêmes
  16 fins de partie, avec la part gagnée (« le Stratège 2.1 préférait 6♥ →
  borne 6 : 75 % des fins de partie simulées gagnées, contre 54 % pour ton
  coup »).
  - Le replay s'ouvre tout de suite : l'avis est calculé en arrière-plan, coup
    par coup (« Le Stratège 2.1 réfléchit… » en attendant), environ 0,2 s par
    coup.
  - Un joker posé hors d'une paire est signalé à part : il ne le jouerait
    jamais, il n'y a donc pas d'écart à mesurer. Un coup forcé (un seul coup
    possible) n'a rien à comparer.
- « Garder pour l'analyse » copie la partie dans `data/replays/`, qui est versionné.

**Puzzles.** Des fins de partie, pioche vide, où toutes les cartes sont connues :
la main adverse, ce sont les cartes vues nulle part.
- **Le principe** : tu joues le camp du bas contre un adversaire qui joue
  parfaitement. Seuls quelques coups gagnent, parfois un seul ; à toi de le
  trouver.
- **Chaque coup est jugé** d'après la solution exacte (`src/sim/eval/endgame.js`). Un
  faux pas est signalé, avec le coup qu'il fallait jouer.
- **Boutons** : « Révéler le coup gagnant », « Recommencer ce puzzle », « Puzzle
  suivant ».
  - « Puzzle suivant » reste blanc tant que le puzzle n'est pas fini, et passe
    au vert sous une ligne « Résolu ✓ » quand tu l'as gagné. Il reste cliquable
    à tout moment.
  - Puzzle perdu : une ligne rouge « Perdu », et « Révéler » et « Recommencer »
    passent au vert. « Révéler » montre alors le coup gagnant du départ.
- **Identifiant** : chaque puzzle a un numéro fixe (« Puzzle #13 »).
  « Copier l'identifiant » le met dans le presse-papier, pour en parler sans
  capture d'écran.
- **Favoris** : l'étoile ★ garde un puzzle dans tes favoris (dans ton
  navigateur) ; la case « Favoris seulement » ne tire plus que parmi eux.
- **Ordre** : au hasard, au démarrage comme au « Puzzle suivant » ; ceux que tu
  n'as pas encore résolus passent d'abord.
- **Suivi** : les puzzles résolus sans aide sont comptés, et gardés dans ton
  navigateur.
- **Tes tentatives** (07/10) : chaque puzzle tenté est enregistré par le serveur
  de `npm run play`, une ligne par tentative dans `data/puzzle-attempts.jsonl` :
  le temps actif (l'horloge s'arrête quand la page n'est plus au premier plan),
  chaque coup et son temps, les faux pas et les coups qui gagnaient, « Révéler »,
  et la fin (résolu seul, avec de l'aide, perdu, abandonné, passé sans jouer).
  Le titre du puzzle dit ton meilleur temps et ton nombre d'essais ; un puzzle
  gagné dit en combien de temps. `npm run puzzle-stats` en tire une difficulté
  mesurée, et compte les faux pas qui sont le coup favori du cœur (le même piège).
  Si le serveur ne répond pas, la tentative attend dans le navigateur.
- **Source** (06/10) : 145 puzzles. Les 45 favoris de Sami sont gardés sous
  leurs numéros (37 fins de partie, 8 gains immédiats) ; les 95 autres, résolus
  en un coup sans réfléchir, sont retirés. 100 fins de partie nouvelles (#291 à
  #390) leur ressemblent : tirées des parties gardées entre robots, à la règle
  de la page, **au moins 12 coups possibles et le coup du Stratège perd**
  (18 coups possibles en moyenne, 7 à 12 cartes à jouer, 27 à solution unique).
  `npm run puzzles -- --add --source duels --count 100 --min-moves 12
  --core-fails --keep <favoris>` ; un numéro retiré n'est jamais réutilisé.
  L'adversaire répond en quelques dizaines de millisecondes en général, jusqu'à
  7 s dans le pire des 100.
- **Aujourd'hui** (17/10) : 212 puzzles en quatre familles (`kind` dans
  `web/data/puzzles.json`, `web/app/puzzles/puzzle-kinds.js`) : 163 fins de
  partie (dont #422 à #447, ajoutées le 16/10), 8 gains immédiats, 21 doubles
  menaces (#401 à #421, `npm run puzzles -- --fork`) et 20 doubles tours (#501 à
  #520, `--pass` : le coup gagnant laisse l'adversaire sans coup légal, il passe
  et tu rejoues).
- **Gain immédiat** (8 gardés, `npm run puzzles:immediate`, `-- --add` pour
  en ajouter) : il reste une
  pioche, et la main adverse est cachée. Un seul coup, parfois deux ou trois, te
  fait revendiquer la victoire tout de suite, quoi que tienne l'adversaire : la
  preuve n'utilise que les cartes de la table. La partie s'arrête sur ce coup. Le Stratège, lui, ne le voit dans aucun d'eux.
  - L'astuce qui revient : **poser une carte n'importe où** pour la sortir du jeu,
    ce qui rend une autre borne prouvable. Dans trois puzzles, la même carte
    gagne sur quatre bornes différentes.

**Ordonnanceur** (Sami, 22/10). La file de nuit (`npm run backlog`) jouée en simulation, pour
essayer l'ordonnanceur sans lancer un seul job (`src/schedule/night.js`, `docs/ismcts-ailleurs/backlog.md` § 9).
- **Quatre exemples** : une nuit de validation (trois versions en 1k@2k, un peu trop de travail pour la
  nuit), une soirée avec échéances, des imprévus en série (un job urgent qui arrive à 1 h, un job fragile,
  un job qui touche sa limite, un autre qui attend 4 h), une machine qui flanche (des coupures bien plus
  fréquentes qu'en vrai, et un correctif urgent).
- **Chaque nuit tire ce que la vraie cache** : la durée réelle des jobs (autour de 0,9 fois l'estimation,
  comme en octobre), leurs échecs, et le score des duels de chaque version, donc les `stopIf`. « Nuit
  suivante » en tire une autre ; la variabilité des durées, le taux d'échec et la durée de la nuit se
  règlent.
- **Les deux ordres jouent la même nuit** : l'ordre du fichier (`--fifo`) et la règle de Smith avec
  prérequis et échéances, une barre par job. Gris : annulé par son `stopIf` ; rouge : en échec ; orange :
  arrêté à sa limite ; contour rouge : fini après son échéance (le trait jaune).
- **La machine peut flancher** (Sami, 22/10, `src/schedule/incidents.js`) : alertes chaleur, redémarrages
  de Windows, coupures de courant, chacun à son taux. Le job en cours est perdu (barre hachurée), la bande
  colorée montre la machine arrêtée. La case « Reprise automatique » relance la file après un redémarrage,
  sinon la nuit s'arrête là. La case « Un job pressé interrompt le job en cours » laisse passer un job
  arrivé pendant la nuit (le triangle) qui manquerait son échéance en attendant.
- **« Comparer sur 500 nuits »** : les moyennes des deux ordres sur les mêmes nuits, l'écart de poids fait
  avant le matin avec son intervalle, et les échéances manquées ; avec des coupures, les jobs interrompus,
  le calcul perdu, la machine arrêtée et les nuits où la file ne repart pas.
- **« Modifier la file (JSON) »** : le format de `data/backlog.json`, plus `version`, `arrivesAt` et
  `failRate` pour la simulation.

**Stats.** Tout est tiré de tes replays, anciens compris (`/api/stats`,
`src/replay/stats/stats.js`).
- **Classement Elo** : toi et chaque version de robot, avec sa marge à 95 %.
  - Le Basique vaut 500, comme un joueur qui débute au tennis de table (1000 avant le 01/10 : tout a baissé de 500, les écarts sont les mêmes).
  - Le calcul prend toutes tes parties enregistrées (y compris `replays/OLD/`) et
    les duels entre robots de `data/elo-duels.json`, en un seul ajustement
    (modèle de Bradley-Terry, `src/replay/stats/elo.js`). Un robot que tu n'as pas
    affronté est donc quand même placé par rapport à toi.
  - Les Expérimental y sont mesurés à 2 000 itérations par coup, comme dans la
    page depuis le 11/10 (avant, la page les laissait chercher jusqu'à 10 s : tu
    jouais contre plus fort que la version classée). Ils ne réfléchissent pas
    pendant ton tour : un arbre ISMCTS n'en tirait rien et y perdait des
    itérations (coupé le 16/10 ; seule la recherche plate du 0.7 le fait encore).
  - Seules les 3 dernières versions de chaque robot sont affichées
    (`KEPT_VERSIONS`, `src/config/bots.js`), ici comme dans les autres
    tableaux. Tes parties contre les plus anciennes comptent toujours dans ton Elo.
- **Tes parties**, par adversaire et version : parties, victoires, en premier et
  en second, durée moyenne, réflexion moyenne par coup.
- **Mains de départ** : pour toi et pour chaque robot, les parties gagnées selon
  sa main de départ, faible, moyenne ou forte (`src/sim/eval/hand-classes.js`, environ
  10 % de mains faibles et 9 % de fortes). Le paquet de chaque replay suffit : les
  anciennes parties comptent aussi.
- **Les combinaisons qui gagnent les bornes** : la part de chacune des cinq dans
  les bornes gagnées, pour toi et pour les robots.

`?debug` dans l'adresse expose les commandes du jeu dans la console
(`window.__lopin`), pour piloter une partie par script.

## Les robots

Quatre robots, du plus faible au plus fort (`BOT_LINEUP`, `src/config/bots.js`).

| Robot | Version | Ce qu'il fait |
|---|---|---|
| **Basique** | 1.0 | Joue la carte qui vaut le plus à l'instant T, face à ce que l'adversaire construit. |
| **Stratège** | 2.1 | **Il anticipe.** Il prend ses 4 meilleurs coups selon son cœur, le Stratège 1.2 (plus bas). Pour chacun, il rejoue 16 fois la fin de la partie en distribuant au hasard les cartes qu'il ne voit pas. Il garde le coup qui gagne le plus souvent, en tenant un peu compte de l'avis du cœur. Le 2.0 battait le cœur 1.1 dans 74 % des parties, et le 2.1 bat le 2.0 dans 55 %. |
| Stratège 1.2 | (cœur du 2.1) | Le Basique, plus les trois habitudes de Sami : garder le joker pour un Brelan, ouvrir au milieu une couleur à la fois, préférer une suite de même couleur à une paire. Plus trois idées tirées des parties en ligne : les trois bornes du milieu seulement pour un départ solide ; jamais la même valeur seule sur deux bornes ; ne jamais séparer deux cartes de même couleur qui se suivent (1.2). C'est lui qui joue les statistiques du rapport : le 2.1 est trop lent pour un million de parties. Le détail : `docs/strategie.md`. |
| **Expérimental** | 1.3 | **Depuis le 1.3 (30/10), quand la pioche a 2 cartes ou moins, il simule la fin de partie à la vraie règle** : les bornes prouvées sont revendiquées tout de suite, au lieu d'être réglées à la fin (`claimPile=2`, ClaimPile2). Sur les fins « sûres » qu'il perdait à cause de cet écart, le coup choisi gagne 43 % des donnes au lieu de 22 %, pour environ 0,6 s de plus par partie. **Depuis le 1.2, il résout exactement la fin de partie à la racine dès 12 cartes restantes.** Pioche vide, si la somme de sa main et des cartes restantes est ≤ 12, le solveur exact rétrograde calcule à coup sûr le chemin gagnant (`exact=12`). Il bat le 1.1 dans 52,7 % des parties (fourchette 50,5 – 54,8 %, 1 500 parties) et franchit pour la première fois le cap symbolique des 1 000 Elo (1 003 ± 18). Il conserve la recherche en arbre ISMCTS sur 5 coups d'avance et 7 réponses par niveau (`widen=7`). |
| **Oracle light** | 1.0 | **L'oracle de l'atelier, allégé** (16/10). Le même arbre, mais 10 coups d'avance et 10 000 itérations, partagées entre deux arbres de 5 000 : un par fil du navigateur (`think.workers`), leurs visites additionnées (`web/app/workers/think-join.js`). Il bat l'Expérimental 1.2 dans 53,6 % des parties (49,7 – 57,4 %, 420 parties), en 2 à 7 s par coup. |

Le Borné 1.0 (l'arbre canalisé : 2 bornes au plus par carte, 5 réponses par étage) a quitté la
liste le 11/10 : **45,9 %** contre l'Expérimental 1.2 sur 1 000 parties (43,3 – 48,5). Ses replays
se relisent toujours.

**Versions.** Deux chiffres, depuis le 03/10. Un robot ne change de numéro qu'une fois le changement validé
(duels longs sur plusieurs jeux de donnes) :
- second chiffre : tout changement de comportement ;
- premier chiffre : une autre façon de penser.

Chaque replay enregistre le robot et sa version (`stratege@2.1`), donc les
générations restent comparables. Les parties enregistrées avant portent un
troisième chiffre, toujours 0 (`stratege@2.1.0`) : elles comptent pour la
même version. L'historique des versions et les mesures
qui les justifient sont dans `docs/analyse-replays.md`.

**Tester une idée :**

```bash
npm run duel -- idea:counter strategist            # une idée du cœur : moins d'une minute
npm run duel -- experimental:400 stratege           # profil rapide : 5 min au plus
npm run duel -- experimental:400 stratege --long    # profil long : 20 min au plus
```

Le duel joue par rondes, les mêmes paquets des deux côtés, et s'arrête dès que
le résultat est net ou que le temps du profil est écoulé. Il affiche le taux de
victoire avec sa fourchette à 95 %. `experimental:N` est l'Expérimental avec N
fins de partie par coup. Si l'Expérimental gagne nettement en profil long, l'idée
passe dans le Stratège, avec une nouvelle version. Détails et durées :
`docs/validation.md`.

## Les replays

Un replay est un fichier JSON lisible, cartes notées « 7♥ » et « JK », bornes
numérotées de 1 à 7 :

- **en-tête** : dates, règles, joueurs (humain ou `robot@version`, et leur place),
  graine, et **l'ordre complet du paquet**, qui permet de rejouer la partie à
  l'identique ;
- **chaque tour** :
  - la main (6 cartes) et la taille de la pioche ;
  - la carte jouée et la borne ;
  - ce qu'il y avait des deux côtés de la borne avant le coup, si la borne était
    vide, si le coup la complète ;
  - la carte piochée, si c'était un joker ;
  - pour toi, le temps de réflexion (`thinkMs`, en millisecondes, chronomètre
    arrêté quand la fenêtre n'est pas active) ;
  - pour un robot, ses 5 meilleurs coups avec leur gain ;
- **la fin** : pour chaque borne, les deux côtés, les combinaisons, les sommes, le
  gagnant, ce qui a départagé et l'ordre de complétion ; le vainqueur, le type
  de victoire et la durée de jeu (`activeMs`).

Relire un replay rejoue la partie coup par coup et vérifie chaque coup et chaque
pioche : un fichier abîmé est refusé.

```bash
npm run replays   # bilan de toutes les parties enregistrées
npm run luck      # la chance de chaque paquet : rejoué 16 fois entre robots égaux (~10 min)
npm run selfplay  # l'Expérimental contre lui-même, 20 min au plus → selfplay/ (hors git)
npm run mine      # ce que l'auto-jeu dit des motifs prouvés (docs/strategie.md)
npm run elo       # le classement Elo complet ; --duels rejoue les duels entre robots (~20 min)
npm run puzzles -- --add --source duels   # 50 puzzles de fin de partie de plus, tirés des parties gardées → web/data/puzzles.json (10 min au plus)
npm run puzzles:immediate -- --add       # 20 puzzles « gain immédiat » de plus, règle de revendication (quelques secondes)
npm run bench     # banc d'essai de l'Expérimental : puzzles difficiles et milieu de partie (~1 min)
npm run hiding    # coups forts joués tout de suite ou gardés, dans l'auto-jeu (docs/strategie.md)
npm run policy    # la politique de simulation face au solveur, sur les fins de partie de l'auto-jeu (1 s ; 4 min la 1re fois)
```

Le bilan donne tes résultats contre chaque robot, les combinaisons faites de
chaque côté et l'usage des jokers. Il donne aussi le pourcentage de tes coups
identiques au meilleur choix du Stratège 1.2, tes plus grands écarts avec lui, et tes
coups les plus longs à jouer.
C'est la matière pour améliorer le robot, ou ton jeu.

`replays/` est ignoré par git ; `data/replays/` est versionné, pour les parties
qu'on veut garder : cas particuliers, parties marquantes, preuves d'une faiblesse du
robot.
