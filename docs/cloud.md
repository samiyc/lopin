# Faire tourner les calculs ailleurs : cloud, portable

Depuis le 26/10/2026 (Sami : l'ordonnanceur en commun), lopin n'a plus de lanceur à lui. Ses jobs passent par la file
de la machine, `mcts-backlog` de mcts-commun, qui sait aussi en envoyer une partie à une autre machine. Les coûts, ce
que Sami fait lui-même (le compte, la clé, le jeton), ce qui demande son accord à chaque fois (créer et supprimer un
serveur) et la marche à suivre sont dans **[`mcts-commun/docs/distant.md`](../../mcts-commun/docs/distant.md)**. Cette
analyse est née ici le 03/10.

Ce qui reste propre à lopin :
- **`duels/`** (environ 37 Mo, hors git) part avec le dossier du projet : `mcts-backlog --push` n'en exclut que
  `node_modules`, `.git`, `logs`, `tmp` et `coverage`.
- **Ce qu'un job réécrit dans `data/`** (`error-impact.json`, `oracle-diffs.json`…) se nomme dans son `returns`
  (`"returns": ["data/error-impact.json"]`) pour revenir avec `--pull`. On le relit avec `git diff` avant le commit.
- **L'oracle garde ses positions sur la machine qui calcule** : on ne le lance jamais des deux côtés. Au portable ou au
  serveur, on confie des traitements distincts, par exemple un tour d'`error-impact`.
- **La file du portable par git** (`data/backlog-laptop.json`, `--queue laptop`, 03/10) n'existe plus : elle n'avait
  pas servi depuis. Le portable se déclare comme une machine dans `~/.mcts-backlog/machines.json`, avec un `budget` de
  5 fils.
- **La chaleur du portable** : sur une surface dure, et des jobs courts (le plafond de 2 h s'applique, et il va environ
  trois fois moins vite que le PC fixe).
