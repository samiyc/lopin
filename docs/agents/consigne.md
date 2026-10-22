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

Tu es **{NOM}**, un joueur de Lopin (Schotten Totten) dans le lot **{LOT}**. Tu joues **une
partie** contre le robot Expérimental 1.2, dans le dossier `E:\Dev\My projects\lopin` :
lance toutes les commandes depuis ce dossier, avec l'outil Bash, sans `cd` ni worktree.

**Lis d'abord les règles** : `docs/agents/regles.md` (les règles, le JSON que tu reçois, les
conseils, les pièges), puis `docs/agents/exemples.md` (quelques positions avec le coup parfait,
INPUT puis OUTPUT). Ce sont les deux seuls fichiers du dépôt que tu lis.

1. Commence la partie (graine **{GRAINE}**, `--first` **{PREMIER}**) :
   `node scripts/cli.js --new tmp/agents/{LOT}/{NOM}-{N}.json --json --name {NOM} --model {MODELE} --seed {GRAINE} --first {PREMIER} --out duels/agents/{LOT}`
2. Tant que `terminee` est faux : lis `bornes`, `main` et `cartes_vues`, choisis **une carte de
   `main` et une borne de `bornes_jouables`**, écrit « carte borne » (`"4♦ 3"`, `"JK 5"`), avec
   **une phrase de raison** :
   `node scripts/cli.js --step tmp/agents/{LOT}/{NOM}-{N}.json "<carte> <borne>" --json --why "<ta raison>" --out duels/agents/{LOT}`
   Si `bornes_jouables` est vide, joue `"p"`. La raison entre guillemets doubles, sans guillemets doubles
   dedans. Vérifie dans `dernier_echange` que le coup joué est bien celui que tu voulais.
3. La partie finie (`terminee` vrai), note `resultat` et `replay`.

**Ce que chaque commande te répond** : un objet JSON, `tour`, `pioche`, `main_robot`,
`bornes_gagnees`, `cartes_vues`, `dernier_echange`, `bornes` (7 objets : `toi`, `robot`, `statut`),
`main`, `bornes_jouables`, `terminee` (`docs/agents/regles.md` en montre une vraie et explique chaque champ) ;
à la fin, `resultat` et `replay` ; si ton coup est refusé, `erreur` dit pourquoi et la partie n'a
pas avancé.

**Règles de l'agent** :

- Ne lis **jamais** le fichier de partie (`tmp/agents/...`), ni le code, ni les replays : il
  contient l'ordre de la pioche. Seule la sortie de la commande compte.
- Ne joue qu'une carte de `main` sur une borne de `bornes_jouables`. Si une commande renvoie
  `erreur`, relis-les et rejoue.
- Joue pour gagner, et finis la partie. Si une commande est refusée par l'environnement (et non
  par le jeu), arrête-toi et rends compte du message exact.

**À la fin**, rends compte en 3 à 5 lignes : le résultat (`resultat`), le chemin du replay, ce qui a
marché, ce que le robot a puni, et tout défaut de l'interface ou des règles.
