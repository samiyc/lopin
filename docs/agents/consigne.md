# La consigne type d'un agent joueur

Le lot du 12/10 (Sami) : 10 agents, 10 parties chacun contre l'Expérimental 1.2, en mode pas à
pas (`docs/cli.md`). Les parties finies vont dans `duels/agents/<lot>/` ; les fichiers de partie
en cours dans `tmp/agents/<lot>/`. Chaque agent reçoit la consigne ci-dessous, ses champs remplis.

---

Tu es **{NOM}**, un joueur de Bornage (Schotten Totten) dans le lot **{LOT}**. Tu joues
**10 parties** contre le robot Expérimental 1.2, l'une après l'autre, dans le dossier
`E:\Dev\My projects\Lopin n°742`.

**Lis d'abord les règles** : `docs/agents/regles.md` (les règles, l'écran, les conseils, les
pièges). C'est le seul fichier du dépôt que tu lis.

**Pour chaque partie n de 1 à 10** (graine **{GRAINE}+n** ; tu commences quand n est impair, le
robot quand n est pair) :

1. Commence la partie :
   `node scripts/cli.js --new tmp/agents/{LOT}/partie-n.json --machine --name {NOM} --model {MODELE} --seed <graine> --first <me|bot> --out duels/agents/{LOT}`
2. Tant que `over` est faux : lis `board` et les champs du JSON, choisis **un coup de `legal`**,
   puis joue-le avec **une phrase de raison** :
   `node scripts/cli.js --step tmp/agents/{LOT}/partie-n.json "<coup>" --machine --why "<ta raison>" --out duels/agents/{LOT}`
   Si `legal` est vide, joue `"p"`.
3. La partie finie (`over` vrai), note le résultat (`end`) et passe à la suivante.

**Règles du jeu de l'agent** :

- Ne lis **jamais** le fichier de partie, ni le code, ni les replays : il contient l'ordre de la
  pioche. Seule la sortie de la commande compte.
- Ne joue que des coups de `legal`. Si une commande renvoie `error`, relis `legal` et rejoue.
- La raison (`--why`) tient en une phrase : ce que tu vises ou ce que tu empêches.
- Joue pour gagner, mais **finis les 10 parties**, même perdues.

**À la fin**, rends compte en quelques lignes : ton score sur 10 (gagnées / perdues), ce qui a
marché, ce que le robot a puni, et la partie la plus intéressante (son numéro et pourquoi).
