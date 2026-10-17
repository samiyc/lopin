# Prompt pour Fable : l'avantage du siège et sa compensation

> À coller tel quel dans une session Claude Code (modèle Fable), ouverte dans le dépôt `Lopin n°742`. Préparé le 16/10
> (`docs/agents/revue-2026-10-16.md`). Tu réponds en français ; le code et ses commentaires restent en anglais.

## Si tu es lancé pendant que le backlog tourne (la nuit du 16-17/10)

- **Ne modifie pas `data/backlog.json`** : le lanceur (`npm run backlog`) y écrit les statuts de ses jobs, et ta
  modification les effacerait. Écris tes jobs (id, commande, durée, raison) dans `docs/sieges.md` ; ils seront mis en
  file après la nuit.
- **Ne lance ni duel ni `npm run deals`** : ils prendraient du CPU aux duels de la nuit. Une analyse en lecture seule
  de `duels/`, un test, `npm run check` et une empreinte (20 parties à 150 itérations) restent permis.
- **Committe après chaque étape** (hypothèses mesurées, options de code, document) : le budget de la semaine peut
  s'épuiser en cours de route, et ce qui est commité reste.

## Ta mission

Explique **d'où vient l'avantage du second joueur** dans Bornage, à la règle de la page, et propose **une compensation
simple** qui ramène le premier joueur à 50 % ± 1 point. Elle doit tenir en une phrase sur la feuille de règles, lue par
une grand-mère. Tu ne joues pas de duels longs toi-même : tu analyses, tu écris le code minimal pour tester, et tu
prépares les jobs de nuit avec leurs commandes exactes.

## Ce qui est établi (ne le remesure pas)

- **Le jeu** : 42 cartes (4 couleurs de 1 à 10 et 2 jokers sans couleur), 7 bornes, 3 cartes par côté, 6 cartes en main.
  On gagne avec 3 bornes adjacentes ou une majorité de 4. Règle de la page (`endMode: "claim-end"`, `OFFICIAL_RULES`,
  `src/config/rules.js`) : juste après chaque coup, celui qui vient de jouer revendique les bornes prouvées, puis
  l'adversaire. Une borne revendiquée est fermée. Voir `CLAUDE.md`, « The web game plays the printed claim rule », et
  `src/sim/engine/settle.js`.
- **Les 35 178 parties des duels gardés** (`duels/`, arbres @2000 et plus, règle de la page, mesuré le 16/10) :

  | Fin de partie | Gagnée par le 1er joueur | Gagnée par le 2e joueur |
  | --- | --- | --- |
  | Trois bornes à la suite | 23,7 % | 24,5 % |
  | Majorité | 24,9 % | 26,9 % |
  | Épuisement ou nul | 0 | 0 |

  - Le premier joueur gagne 48,5 % ; **l'écart est surtout dans les victoires à la majorité.**
  - **Pas la règle d'égalité** : 466 bornes sur 199 553 (0,2 %) se départagent par « le premier à compléter », gagnées
    232 contre 234.
  - **Pas le dernier coup** : aucune partie ne va jusqu'au bout des cartes.
- **La donne pèse lourd** : elle explique 84 % de la variance de la part du premier joueur d'une donne à l'autre (1 126
  donnes jouées au moins 10 fois). Les duels sont joués en miroir (chaque donne des deux côtés), ce qui annule la donne
  entre deux versions, mais pas l'effet du siège.
- **Entre deux Omniscient 1.0** (`+omniscient=1` : tout est vu), un essai trop petit donne 50,0 % (41,2 – 58,8, 120
  parties, `npm run deals`). C'est la piste pour séparer la part des règles de la part de l'information.
- **Ce qui manque** : `createGame` (`src/sim/engine/game.js`) ne permet pas des mains de tailles différentes.

## Ce qu'on attend de toi, dans l'ordre

1. **Les hypothèses** : 3 à 5 mécanismes qui feraient gagner le second joueur à la majorité, chacun avec la mesure qui
   le confirmerait ou l'écarterait **sur les parties existantes**. Exemples à creuser, pas à prendre pour acquis :
   - le second voit l'engagement adverse avant de choisir sa borne ;
   - l'ordre des revendications après chaque coup ;
   - le moment où les bornes se ferment ;
   - le rythme des pioches.
   Les parties gardées ont tout : `turns` (coups, pioches, `claimedAt`) et `result.borders` (`filledAt`, `decidedBy`).
   Écris l'analyse en script (lecture seule de `duels/`), lance-la, rapporte les chiffres.
2. **La part des règles et celle de l'information** : un job de nuit `npm run deals -- --plays K` sur assez de donnes
   pour ± 1,5 point sur la part du premier joueur entre omniscients. Calcule K et N, et donne la durée attendue. Les
   mesures du 16/10 : ~30 s par partie et par fil à 400 itérations, 18 fils.
3. **Les compensations candidates**, classées par simplicité de la règle puis par effet attendu. Par exemple : une carte
   de plus pour le premier joueur, une carte de moins au départ pour le second, le premier joueur pioche deux cartes
   au premier tour, une autre règle de revendication. Pour chacune :
   - la phrase de règle ;
   - le changement de code (une option de `createGame` ou de `rules.js`, éteinte par défaut) ;
   - la preuve que **l'empreinte de la 1.2 ne bouge pas**
     (`npm run fingerprint -- "ismcts+widen=7+depth=5+core=stfig6+exact=12@150,greedy" 20` → `1d041613cd7bcd8d`) ;
   - la commande du job qui la mesure : la même version contre elle-même, la part du premier joueur, au moins ~8 000
     parties pour ± 1 point.
   **Les pistes de Sami (16/10), à traiter en premier** : de l'information pour le premier joueur, en miroir de celle que
   le second a en voyant son coup.
   - **A** : il regarde la carte du dessus de la pioche avant son tout premier coup.
   - **B** : il la regarde à chaque tour, avant de jouer.
   - **C** : il reçoit 7 cartes au lieu de 6.
   - **B(N), une compensation réglable** (Sami, 16/10) : il regarde la carte du dessus avant de jouer **jusqu'à une
     condition**. A et B en sont les deux bouts. Conditions proposées :
     - jusqu'au tour N (la plus simple à dire et à doser) ;
     - jusqu'à la première borne revendiquée (s'arrête d'elle-même quand la partie se tend, mais sa durée varie) ;
     - jusqu'à un nombre de cartes en jeu.

     **Calibrage** : mesure 2 ou 3 valeurs de N, vérifie que l'effet croît avec N, et interpole celle qui ramène le
     premier joueur à 50 %. Arrondis-la à une règle simple (« pendant ses 3 premiers tours »).
   - **A2** : il regarde les **deux** cartes du dessus à son premier tour. La deuxième est la prochaine pioche de
     l'adversaire : c'est une information de nature différente, à mesurer à part.

   Pour A et B, **les robots doivent se servir de l'information**, sinon la mesure vaut zéro : `determinize`
   (`src/sim/search/lookahead.js`) tire aujourd'hui toutes les cartes cachées au hasard. La carte vue doit y rester en tête de
   pioche pour ce joueur, et le cœur doit la compter comme connue (`unseenCards`). Dis ce qu'il faut changer et ce que
   ça coûte. C se mesure sans rien adapter. **Avant toute compensation, mesure la référence sans compensation au même
   niveau de robot** (la 1.2 à 400 ou le cœur seul contre lui-même) : l'effet du siège peut dépendre de la force.
4. **Ta recommandation**, et ce qu'il faudrait observer pour en changer.

## Les contraintes du dépôt (dans `CLAUDE.md`)

- **CPU** : de jour, pas plus de 400 itérations par arbre, et pas de duels longs. De nuit, des jobs de moins de 2 h,
  mis en file dans `data/backlog.json` (`"status": "todo"`, lancés par `npm run backlog`), 18 fils au plus.
- **Le vocabulaire** : nomme toute nouvelle variante dans `docs/glossaire.md` avant de l'utiliser. Tout nouveau script
  npm va dans `docs/commandes.md`. Les fichiers de `data/` restent sous 500 KB. Une analyse jetable va dans `tmp/`.
- **La vérification** : `npm run check` (lint et tests) avant tout commit. Le lint plafonne la complexité à 8, la
  fonction à 40 lignes et le fichier à 220.
- **Les règles changent dans `src/config/`**, et la feuille de règles (`regles/regles.html`) s'écrit en français
  simple, en gros caractères.

## Les pièges

- **Ne pas confondre le siège et la force** : pour mesurer le siège, il faut le même moteur des deux côtés. La colonne
  « en commençant / en second » d'un duel entre deux versions mélange les deux.
- **Le bruit** : ± 1 point demande ~10 000 parties. Un écart de 1,5 point sur 1 000 parties ne prouve rien.
- **Les robots ne sont pas des humains** : un effet de siège mesuré entre robots peut ne pas être celui des joueurs.
  Dis-le si ta compensation en dépend.
- **Une compensation change le jeu** : vérifie qu'elle ne déplace pas autre chose (durée des parties, part des victoires
  à la majorité, joker).

## Quand c'est fini

Un document `docs/sieges.md` (en français) avec :
- les mécanismes, chacun **mesuré ou écarté** ;
- la part des règles et celle de l'information, ou le job qui la mesurera ;
- les compensations classées ;
- les commandes de nuit prêtes et leur durée ;
- la recommandation.

Le code des options est éteint par défaut, l'empreinte est inchangée, `npm run check` passe, et tout est commité.
