# Bornage dans la console (`npm run cli`)

Jouer contre les robots sans navigateur (Chrome reste libre), et laisser un programme ou un
agent (un LLM) jouer en tour par tour. Le jeu de base seulement (pas d'extension), à la règle de
la page : une borne se revendique dès qu'un coup la prouve. Rien du moteur n'est réécrit : la
console joue comme la page (`web/app/runner.js`) et écrit le même replay dans `replays/`, que la
page liste et que l'Elo compte.

## Jouer

```
npm run cli                          # contre l'Expérimental 1.2 (2 000 itérations, ~1,5 s par coup)
npm run cli -- --bot stratege        # ou basique
npm run cli -- --first bot           # le robot commence
npm run cli -- --seed 42 --name sami # une donne choisie, ton prénom dans le replay
```

Sans `--name`, le jeu demande ton prénom au début (une ligne vide : « joueur ») ; un programme
(`--machine`, `--new`) s'appelle « agent ».

Un coup : **le numéro de la carte dans ta main (1-6), puis la borne (1-7)**, séparés par une
espace, une virgule ou un tiret, puis Entrée : `3 5` pose ta 3e carte sur la borne 5.

| Saisie | Effet |
| --- | --- |
| `3 5` | joue la carte 3 sur la borne 5 |
| `t` | trie ta main par valeur, puis de nouveau par couleur (par défaut) |
| `p` | passe, seulement quand tu n'as aucun coup possible |
| `?` | l'aide |
| `q` | abandonne (rien n'est enregistré) |

## L'écran

```
Tour 3 · pioche 28 · main du robot 6 · bornes : toi 0, robot 0
Basique : 4♠ → borne 5
Vues : ♠ 1/10 · ♥ 2/10 · ♣ 2/10 · ♦ 2/10 · JK 1/2



                    4♠
1-   2-   3-   4-   5-   6-   7-
               3♥



Main : 1:10♥  2:1♣  3:8♣  4:1♦  5:7♦  6:JK
```

- Sept colonnes, une par borne, sur sept lignes : les trois cartes du robot (sa 3e en haut), la
  ligne des bornes, tes trois cartes.
- Une borne : `-` libre, `A` gagnée par toi, `B` par le robot, `=` les deux côtés pleins mais
  personne n'a encore pu la revendiquer.
- L'en-tête : le tour, la pioche, les cartes en main du robot, les bornes gagnées ; puis le
  dernier coup du robot et qui revendique quoi : « Expérimental : 1♥ → borne 7 · tu revendiques
  la borne 7 », « Après ton coup : le robot revendique la borne 2 ».
- La fin dit qui gagne et avec quelles bornes (« le robot l'emporte, bornes 2-3-4 à la suite »),
  et, s'il y en a, les bornes que le perdant aurait pu revendiquer : celui qui vient de jouer
  revendique en premier, et la partie s'arrête à la première victoire.
- **Vues** : pour chaque couleur, les cartes que tu vois (le plateau et ta main) sur 10, et les
  jokers sur 2, comme la barre des couleurs de la page.
- La main est triée par couleur (♠ ♥ ♣ ♦, du plus petit au plus grand, jokers à la fin) : les
  numéros changent quand une carte arrive.

## Pour un programme : `--machine`

Une ligne JSON par état sur la sortie, un coup par ligne en entrée (`3 5`), comme ci-dessus :

```json
{"turn":3,"pile":28,"opponentHand":6,
 "hand":[{"n":1,"card":"10♥"},{"n":2,"card":"1♣"}],
 "borders":[{"n":4,"mine":["3♥"],"theirs":[],"won":null},{"n":5,"mine":[],"theirs":["4♠"],"won":null}],
 "moves":["10♥ 1","10♥ 2","1♣ 1","1♣ 2"],
 "last":"Basique : 4♠ → borne 5","over":false,"winner":null}
```

`won` vaut `"me"`, `"opponent"` ou `null` ; `seen` les cartes vues par couleur
(`{"♠":"3/10",…,"JK":"1/2"}`) ; `moves` donne **tous** les coups permis, la carte nommée puis la
borne (`"10♥ 1"`), tels qu'il faut les rendre. Le numéro de la carte dans la main n'y figure plus
(Sami, 13/10) : il change à chaque pioche et ne dit rien. Une saisie refusée renvoie le même état
avec `"error"`.

Au clavier, `3 5` (la 3e carte de la main sur la borne 5) reste la saisie courte : pas de
caractère spécial à taper. `10♥ 1` ou `10h 1` fonctionnent aussi.

## La trace dans le replay

Un replay joué en console porte `"client": { "app": "cli", "mode": "interactive" }` (ou
`"machine"`, `"step"`) ; ceux de la page n'ont pas ce champ. On retrouve ainsi les parties de la
console, ou d'un agent, pour une analyse ou un bug. Le reste du replay est celui de la page : tes
temps de réflexion (`thinkMs`), les candidats du robot à chaque coup, les revendications.

## Pour un agent : le pas à pas

Un agent (Claude Code, par exemple) fait un appel d'outil par coup ; il ne garde pas un programme
ouvert. La partie vit donc dans un fichier, qui est le replay lui-même :

```
npm run cli -- --new partie.json --machine [--bot experimental] [--first me|bot] [--name claude]
npm run cli -- --step partie.json "3♥ 5" --machine
```

Chaque `--step` relit la partie, joue le coup, fait répondre le robot, réécrit le fichier et
affiche le nouvel état ; à la fin, le replay est aussi copié dans `replays/`.

Pour un lot d'agents (`docs/agents/` : les règles pour un agent, la consigne type) :
`--out <dossier>` range le replay fini ailleurs (`duels/agents/<lot>/`), `--why "…"` garde la
raison du coup dans le replay (`note` sur le tour), `--model <nom>` inscrit le modèle dans
`client`. Le JSON porte aussi `board`, l'écran en texte, et `rules`, les règles en une ligne au
premier tour. Le fichier de partie contient l'ordre de la pioche : un agent ne doit lire que la
sortie de la commande.

**Une consigne prête à coller pour un agent** :

> Tu joues à Bornage (Schotten Totten) contre l'Expérimental 1.2. Lance
> `npm run cli -- --new tmp/agent.json --machine --name claude`, puis, tant que `over` est faux,
> choisis un coup parmi `moves` (la carte puis la borne, `"7♠ 5"`) et lance
> `npm run cli -- --step tmp/agent.json "<coup>" --machine`.
> Règles : 7 bornes ; sur chacune, 3 cartes par joueur ; la meilleure combinaison gagne la borne
> (Suite couleur > Brelan > Couleur > Suite > Somme, puis la plus forte somme, puis qui a fini en
> premier) ; le joker (`JK`) remplace n'importe quelle valeur, sans couleur. On gagne avec 3 bornes
> voisines ou 4 bornes. Explique en une ligne chaque coup avant de le jouer.

## Faut-il une API ?

**Non.** La ligne de commande suffit à un humain comme à un agent : `--machine` pour un programme
qui garde le jeu ouvert, `--new` / `--step` pour un agent qui joue un coup par appel. Une API HTTP
(sur le serveur de `npm run play`) n'apporterait qu'un serveur à lancer de plus ; elle ne serait
utile que pour jouer depuis une autre machine.

## Est-ce que ça sert ?

- **Jouer sans le navigateur** : oui, c'est le but premier.
- **Un LLM comme adversaire** : il jouera sans doute faiblement (il ne compte pas les cartes comme
  le cœur), mais **autrement** que les robots : ses parties sont des situations que les duels entre
  robots ne produisent pas. Ses victoires, comme les tiennes, se diagnostiquent avec l'outil du
  12/10 (chaque coup de la 1.2 recherché de nouveau à 20 000 itérations) : c'est la piste 3 de la
  feuille de route, qui manquait de parties.
- **Ce n'est pas un oracle** : un LLM ne dit pas le bon coup. Il sert à trouver des positions où la
  1.2 se trompe, l'oracle (ou le solveur) juge ensuite.

## Suggestions pour la suite

1. **Un tableau des parties d'agent** : les replays nommés `claude-vs-experimental` sont déjà
   comptés par l'Elo (`/api/elo`) ; un agent y aurait sa ligne, comme toi.
2. **Le diagnostic en commande** : faire du script `sami-wins` du 12/10 une commande
   (`npm run diagnose -- replays/<partie>.json`) qui marque les coups de la 1.2 qu'une recherche
   longue joue autrement, pour toutes les parties perdues par la 1.2, humain ou agent.
3. **Les mains découvertes** (`--open`) : l'option existe dans le moteur ; en console, elle
   permettrait à un agent de jouer à information complète, pour isoler ce qui vient du hasard.
4. **Le temps du robot** : afficher « réfléchit 1,6 s » sous son coup, et une option `--budget`
   pour jouer contre la 1.2 à 4 000 itérations.
5. **Rejouer une position** : `--from replays/<partie>.json --turn 18` pour reprendre une partie au
   tour 18 (après une erreur) contre le même robot.
