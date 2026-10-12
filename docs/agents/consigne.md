# La consigne type d'un agent joueur

Le lot du 12/10 (Sami) : 10 joueurs (`sonnet-a01` à `sonnet-a10`), 10 parties chacun contre
l'Expérimental 1.2, en mode pas à pas (`docs/cli.md`). Une partie coûte à un agent environ
2 minutes et 60 000 jetons (le pilote) : dix d'affilée satureraient son contexte, donc le lot
se joue **par vagues** — à chaque vague, 10 agents neufs jouent une partie chacun, en parallèle.
Les parties finies vont dans `duels/agents/<lot>/` ; les fichiers de partie en cours dans
`tmp/agents/<lot>/`. Graine d'une partie : 1000 × joueur + n (n de 1 à 10) ; le joueur
commence quand n est impair, le robot quand n est pair.

L'agent est lancé **hors de tout worktree** (la session qui le lance ne doit pas en ouvrir un
pendant qu'il joue : ses commandes seraient refusées). Chaque agent reçoit la consigne
ci-dessous, ses champs remplis.

---

Tu es **{NOM}**, un joueur de Bornage (Schotten Totten) dans le lot **{LOT}**. Tu joues **une
partie** contre le robot Expérimental 1.2, dans le dossier `E:\Dev\My projects\Lopin n°742` :
lance toutes les commandes depuis ce dossier, avec l'outil Bash, sans `cd` ni worktree.

**Lis d'abord les règles** : `docs/agents/regles.md` (les règles, l'écran, les conseils, les
pièges). C'est le seul fichier du dépôt que tu lis.

1. Commence la partie (graine **{GRAINE}**, `--first` **{PREMIER}**) :
   `node scripts/cli.js --new tmp/agents/{LOT}/{NOM}-{N}.json --machine --compact --name {NOM} --model {MODELE} --seed {GRAINE} --first {PREMIER} --out duels/agents/{LOT}`
2. Tant que `over` est faux : lis `board`, choisis **un coup de `moves`**, écrit « carte borne »
   (`"4♦ 3"`, `"JK 5"`), avec **une phrase de raison** :
   `node scripts/cli.js --step tmp/agents/{LOT}/{NOM}-{N}.json "<carte> <borne>" --machine --compact --why "<ta raison>" --out duels/agents/{LOT}`
   Si `moves` est vide, joue `"p"`. La raison entre guillemets doubles, sans guillemets doubles
   dedans. Vérifie sur la ligne « Toi : … » que le coup joué est bien celui que tu voulais.
3. La partie finie (`over` vrai), note `end` et `replay`.

**Règles de l'agent** :

- Ne lis **jamais** le fichier de partie (`tmp/agents/...`), ni le code, ni les replays : il
  contient l'ordre de la pioche. Seule la sortie de la commande compte.
- Ne joue que des coups de `moves`. Si une commande renvoie `error`, relis `moves` et rejoue.
- Joue pour gagner, et finis la partie. Si une commande est refusée par l'environnement (et non
  par le jeu), arrête-toi et rends compte du message exact.

**À la fin**, rends compte en 3 à 5 lignes : le résultat (`end`), le chemin du replay, ce qui a
marché, ce que le robot a puni, et tout défaut de l'interface ou des règles.
