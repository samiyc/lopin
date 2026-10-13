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
npm run cli -- --gb                  # lettres anglaises S H C D au lieu de P H T C
```

Sans `--name`, le jeu demande ton prénom au début (une ligne vide : « joueur ») ; un programme
(`--machine`, `--new`) s'appelle « agent ».

Un coup : **la carte telle que l'écran l'écrit, puis la borne (1-7)**, collées, puis Entrée :
`7h4` pose le 7 de cœur sur la borne 4. Les couleurs sont les lettres de l'écran : par défaut
les françaises, **P** pique, **H** cœur, **T** trèfle, **C** carreau ; avec `--gb` les anglaises,
**S** spade, **H** heart, **C** club, **D** diamond. Seul **C** change de sens (carreau, ou trèfle
avec `--gb`) ; S, P, T et D se lisent dans les deux. Les anciennes saisies restent : `7h 4`, `7♥ 4`, ou `3 4` (la 3e carte de la main,
même si l'écran ne numérote plus la main).

| Saisie | Effet |
| --- | --- |
| `7h4` | joue le 7♥ sur la borne 4 (`10p2`, `jk5` : le 10♠, le joker) |
| `t` | trie ta main par valeur, puis de nouveau par couleur (par défaut) |
| `p` | passe, seulement quand tu n'as aucun coup possible |
| `?` | l'aide |
| `q` | abandonne (rien n'est enregistré) |

## L'écran

Le modèle de Sami (14/10) :

```
 TURN:15 | DECK:16 | OHAND:6 | U:8H1 ─ EXP:9T1
 P:02/10 | H:07/10 | T:05/10 | C:06/10 | JK:0/2
 ┌──────────────────────────────────┐
 │ ··   ··   ··   ··   ··   8C│  ··││
 │ 9T   ··   ··   ··   ··   1C│  ··││
 │ 4T   6C   ··   ··   9H  10C│  8P││
 │ 1═╗  2─   3─   4─   5─   6═╝  7═╝│
 │ 1H│  ··   4C   5H   6T   ··   ·· │
 │ 2H│  ··   ··   6H   ··   ··   ·· │
 │10H│  ··   ··   ··   ··   ··   ·· │
 └──────────────────────────────────┘
  --=[ 3P  7H  1T  3T  2C  8C ]=--

FR => PHTC Prononcé Pchit!  (Pic,Heart,Trefle,Carreau)
Input exemple: 7h4   (7Coeur sur la borne 4)
```

- L'en-tête : le tour, la pioche (`DECK`), les cartes en main du robot (`OHAND`), puis le
  dernier échange : ton coup (`U:8H1`, le 8♥ sur la borne 1) et celui du robot (`EXP:9T1`, les
  trois premières lettres de son nom : `EXP`, `STR`, `BAS`). Jusqu'à l'échange, la largeur ne
  bouge pas : le tour et la pioche sur deux chiffres (`TURN:05`, `DECK:07`), `DECK:--` quand la
  pioche est vide ; seul l'échange s'allonge d'un caractère pour un 10 (`U:10H1`).
- La deuxième ligne : pour chaque couleur, les cartes que tu vois (le plateau et ta main) sur 10,
  et les jokers sur 2, comme la barre des couleurs de la page.
- Les cartes s'écrivent valeur puis lettre de couleur : `8H`, `10P`, `JK`, alignées à droite sur
  trois caractères (` 8H`, `10H`) pour que les 10 ne décalent rien. `··` : une place vide.
- Sept colonnes, une par borne : les trois cartes du robot (sa 3e en haut), la ligne des bornes,
  tes trois cartes. Une borne : `4─` pas encore gagnée, `1═╗` gagnée par toi (le coin descend
  vers ton côté, barré à droite), `6═╝` par le robot (le coin monte vers le sien). Le cadre a
  toujours la même largeur.
- La légende ne donne que l'alphabet en cours (FR, ou GB avec `--gb`).
- Sous la main, les revendications de l'échange (« tu revendiques la borne 7 »), s'il y en a.
- La fin dit qui gagne et avec quelles bornes (« le robot l'emporte, bornes 2-3-4 à la suite »),
  et, s'il y en a, les bornes que le perdant aurait pu revendiquer : celui qui vient de jouer
  revendique en premier, et la partie s'arrête à la première victoire.
- La main est triée par couleur (P H T C, du plus petit au plus grand, jokers à la fin) ; `t`
  la trie par valeur.
- `--machine` (llm-play) garde l'ancien plateau dans `board` (`boardText`), pour que le prompt
  des modèles ne change pas.

## En JSON : `--json` (le format d'un agent, et pour vérifier)

```
npm run cli -- --json --name sami
```

La partie se joue comme à l'écran, mais chaque état est un vrai objet JSON (les données nommées et
groupées, aucun plateau dessiné dans un texte) ; tu tapes le coup `10♥ 1` ou `3 1` comme
d'habitude (la carte, puis une borne de `bornes_jouables`). Une clé par ligne, et une ligne par borne :

```json
{
 "tour": 13,
 "pioche": 18,
 "main_robot": 6,
 "bornes_gagnees": {"toi":0,"robot":0},
 "cartes_vues": {"♠":"2/10","♥":"5/10","♣":"5/10","♦":"5/10","JK":"1/2"},
 "dernier_echange": {"toi":"1♥ → borne 3","robot":"2♦ → borne 4"},
 "bornes": [
  {"borne":1,"toi":[],"robot":["8♦"],"statut":"libre"},
  {"borne":3,"toi":["2♠","1♥"],"robot":["7♠"],"statut":"libre"},
  {"borne":4,"toi":["9♥","6♥"],"robot":["3♦","2♦"],"statut":"libre"}
 ],
 "main": ["5♥","10♥","2♣","10♣","7♦","JK"],
 "bornes_jouables": [1,3,4],
 "terminee": false
}
```

(Exemple raccourci : `bornes` en a 7.)

| Champ | Contenu |
| --- | --- |
| `tour`, `pioche`, `main_robot` | le tour, les cartes de la pioche, les cartes du robot en main |
| `bornes_gagnees` | les bornes revendiquées, par toi et par le robot |
| `cartes_vues` | par couleur, les cartes que tu vois sur le total |
| `dernier_echange` | un objet : `toi` (ton dernier coup), `robot` (sa réponse), et `revendications` (une phrase chacune, seulement s'il y en a) ; vide au début |
| `bornes[]` | `borne` (1-7), `toi` et `robot` (les cartes de chaque côté, dans l'ordre de pose), `statut` : `libre`, `gagnée`, `perdue`, `pleine` (les deux côtés à 3 cartes, pas encore revendiquée) |
| `main` | ta main, triée par couleur |
| `bornes_jouables` | les bornes où une carte peut aller (toute carte de `main` va sur toute borne jouable) ; vide : joue `p`. Pas de liste « carte × borne » : trop répétitive (Sami, 13/10) |
| `terminee` | `true` à la fin, avec `resultat` (la phrase) et `replay` (le chemin) |
| `erreur` | un coup refusé : la raison (la partie n'a pas avancé) |
| `regles` | la première fois seulement : les règles en une ligne |

Avec `--new` / `--step`, la même réponse, un coup par commande (voir plus bas).

## Pour un programme : `--machine`

Le format plat de `llm-play` (le plateau y est aussi un texte, `board`). Une ligne JSON par état
sur la sortie, un coup par ligne en entrée (`3 5`), comme ci-dessus :

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
`"machine"` — `--json` en fait partie —, `"step"`) ; ceux de la page n'ont pas ce champ. On retrouve ainsi les parties de la
console, ou d'un agent, pour une analyse ou un bug. Le reste du replay est celui de la page : tes
temps de réflexion (`thinkMs`), les candidats du robot à chaque coup, les revendications.

**Les notes sur les coups** : `--step … --why "<la raison>"` écrit la raison dans le tour du replay
(`"note"`, à côté de `move`, `hand`, `thinkMs`) ; `llm-play` y met la `raison` du modèle, ou
« (repli : aucune réponse valable en 3 essais) » / « aucun coup possible ». On les lit dans le
fichier du replay, ou en bilan avec `npm run agents` (la part des coups avec une raison). La page
(onglet Replays) ne les affiche pas encore.

**Le journal d'une partie de `llm-play`** : à côté du replay, `<replay>.log.txt`. Pour chaque coup :
le JSON renvoyé par la console (`CLI →`), la question posée au modèle, sa réponse brute et sa
réflexion éventuelle (`Modèle ←`, une par essai), la commande jouée avec sa raison. Il garde aussi la
consigne système et les options de la série.

## Pour un agent : le pas à pas

Un agent (Claude Code, par exemple) fait un appel d'outil par coup ; il ne garde pas un programme
ouvert. La partie vit donc dans un fichier, qui est le replay lui-même :

```
npm run cli -- --new partie.json --json [--bot experimental] [--first me|bot] [--name claude]
npm run cli -- --step partie.json "3♥ 5" --json
```

Chaque `--step` relit la partie, joue le coup, fait répondre le robot, réécrit le fichier et
affiche le nouvel état ; à la fin, le replay est aussi copié dans `replays/`.

Pour un lot d'agents (`docs/agents/` : les règles pour un agent, la consigne type) :
`--out <dossier>` range le replay fini ailleurs (`duels/agents/<lot>/`), `--why "…"` garde la
raison du coup dans le replay (`note` sur le tour), `--model <nom>` inscrit le modèle dans
`client`. Le JSON porte aussi `regles`, les règles en une ligne au premier tour. Le fichier de
partie contient l'ordre de la pioche : un agent ne doit lire que la sortie de la commande.

**Une consigne prête à coller pour un agent** :

> Tu joues à Bornage (Schotten Totten) contre l'Expérimental 1.2. Lance
> `npm run cli -- --new tmp/agent.json --json --name claude`, puis, tant que `terminee` est faux,
> choisis une carte de `main` et une borne de `bornes_jouables` (`"7♠ 5"`) et lance
> `npm run cli -- --step tmp/agent.json "<coup>" --json`.
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

## Les modèles locaux (Ollama, `npm run llm-play`, 12-13/10)

10 parties chacune contre la 1.2, mêmes graines (80000), 2 à la fois. Les parties sont dans
`duels/agents/<série>/`. Le coup du modèle est classé par le cœur de la 1.2 (`stfig6`) : « top 1 »
= le coup que le cœur préfère ; la colonne « hasard » est ce qu'un joueur au hasard obtiendrait.

| Série | Victoires | Bornes par partie | Top 1 du cœur | Top 3 | Top 8 |
|---|---|---|---|---|---|
| hasard | — | — | 5 % | 14 % | 34 % |
| llama3.2, série du 12/10 (sans schéma ni exemples) | 0/10 | — | 7 % | 12 % | 24 % |
| llama3.2, 12 exemples | 0/10 | 0,30 | 5 % | 12 % | 28 % |
| qwen3.5:9b, schéma JSON | 0/10 | 0,30 | 5 % | 14 % | 28 % |
| qwen3.5:9b, 12 exemples | 0/10 | 0,20 | 5 % | 11 % | 27 % |

**Aucun des deux modèles ne trouve de coups** : leur accord avec le cœur est celui du hasard (le
top 8 est même en dessous). Les exemples (`npm run llm-examples`, `--examples`) changent la forme
des raisons, pas le jeu : le modèle recopie le gabarit, y compris « Pioche vide : le solveur
prouve… » avec une pioche pleine, et nomme parfois une autre borne que celle qu'il joue (31 %
pour llama3.2, 13 % pour qwen3.5). Le schéma JSON de la réponse (`coup` borné à la liste des coups
permis) a réglé la vitesse (2 s par coup au lieu de 45 s) et les réponses hors liste, pas la force.

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
