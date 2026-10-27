# Feuille de route hors du jeu

Sami (22/10) : d'abord l'ordonnanceur, dans ce dépôt ; ensuite trois thèmes concrets, l'entrepôt, la
cuisine et **les urgences d'un hôpital** (pas les secours sur le terrain, trop vastes pour un petit
projet). Dans les trois, **un humain coopère avec des robots**. Une bibliothèque commune, avec des
signatures, servira à tous. Les adversaires cachés passent après.

## 1. L'ordre

1. **L'ordonnanceur de la backlog**, ici : les priorités, les échéances, les prérequis, puis plusieurs
   jobs côte à côte et le planificateur ([`backlog.md`](backlog.md), § 9.6). C'est la famille A de
   [`planification.md`](planification.md).
2. **Les urgences**, dans un dépôt à part. Conseillé juste après l'ordonnanceur, parce qu'elles en
   reprennent toutes les pièces : la couleur du bracelet est une priorité, son délai maximal une échéance,
   le parcours du patient une suite de prérequis, les box et les blocs des ressources
   ([`planification.md`](planification.md) § 3). Elles ajoutent l'état caché (la gravité réelle) et les
   arrivées, sans grille ni trajets dans un premier temps.
3. **Les déplacements** : l'entrepôt puis la cuisine, un moteur de grille pour les deux (§ 2). C'est la
   famille B.
4. **L'hôpital en plan** (Sami, 22/10) : les urgences reprennent le moteur de grille. Les patients et
   les soignants se déplacent entre les salles, la salle d'attente sature, les couloirs se bouchent, les
   patients impatients peuvent causer un incident et l'on appelle la sécurité
   ([`planification.md`](planification.md) § 3, « Dans un deuxième temps »).
5. **Les adversaires cachés** (famille C) : seulement si un défi CodinGame en temps réel plaît (§ 5).

La bibliothèque commune (§ 4) naît pendant l'étape 1 et sort du dépôt au début de l'étape 2.

**L'ordonnanceur, sorti de Lopin** (Sami, 23/10) : les urgences, l'entrepôt et la cuisine auront aussi leurs
mesures longues (balayages de réglages, recherche sur des centaines de gardes ou de journées). Le lanceur
devra donc servir plusieurs dépôts. Le plus simple :
- `src/schedule/` passe dans `mcts-commun` (module `schedule`), puisqu'il n'importe déjà rien du jeu ;
- le lanceur (`scripts/backlog.js`, le journal de jobs, la garde thermique) devient un outil
  `mcts-backlog` dans `mcts-commun/bin/` ;
- une seule file pour la machine, et chaque job y dit dans quel dossier il tourne (`cwd`). La règle des
  18 fils et de la RAM reste ainsi globale : deux dépôts ne lancent jamais chacun leur job à 18 fils en
  même temps.

Lopin garde ses `stopIf` sur les duels, qui restent un réglage propre au jeu. On le fait une fois la
validation du 23/10 finie (`backlog.md` § 9.9).

## 2. Trois thèmes, deux moteurs

| | Les urgences | L'entrepôt | La cuisine |
|---|---|---|---|
| **Le moteur** | celui de l'ordonnanceur : des ressources, des tâches, des événements ; la grille dans un deuxième temps (l'hôpital en plan) | une grille, A* avec réservations | la même grille |
| **Les tâches** | des patients à soigner, dans l'ordre de leur parcours | des colis à porter au camion | des plats à préparer et à servir |
| **Ce qui est incertain** | **l'état réel des patients**, que la couleur estime ; les arrivées | les allées bloquées, découvertes en arrivant (le voyageur canadien) | les commandes qui arrivent |
| **La difficulté propre** | la priorité change pendant l'attente ; la crise, quand l'afflux dépasse les ressources ; puis la salle d'attente qui sature et les patients impatients | les embouteillages entre robots | **les recettes s'enchaînent** : couper, cuire, dresser |
| **Ce que fait l'humain** | il coordonne : il décide qui passe, l'assistant propose | un cariste qui prend des commandes | un cuisinier, comme dans *Overcooked* |

L'entrepôt passe avant la cuisine : il est plus simple, et le plan de 17 × 7 est prêt dans
[`entrepot.md`](entrepot.md). La cuisine y ajoute les enchaînements.

## 3. La coopération entre un humain et des robots

C'est ce qui rend les thèmes parlants, et c'est là que l'expérience de Lopin sert directement.
- **Les robots ne commandent pas l'humain** : il fait ce qu'il veut. Ses intentions sont cachées, comme la
  main adverse dans Lopin. Les robots tirent ce qu'il va probablement faire et replanifient à chaque
  événement.
- **Un modèle de l'humain**, comme `+theirs` fait jouer l'adversaire par un autre cœur. Carroll et al.
  (NeurIPS 2019, [`planification.md`](planification.md) § 4) l'ont mesuré : un agent qui ne s'est entraîné
  qu'avec lui-même coordonne mal avec un humain. Au départ, trois humains simulés suffisent : celui qui
  prend la tâche la plus proche, celui qui prend la plus urgente, celui qui joue au hasard.
- **Montrer le plan** : chaque robot affiche la tâche qu'il vise, l'assistant des urgences dit pourquoi il
  propose un patient. L'humain s'organise mieux avec des robots lisibles, et la démonstration s'explique
  toute seule.
- **La mesure** : le score de l'équipe avec chaque humain simulé, puis avec de vrais joueurs dans le
  navigateur. Aux urgences, trois manières de jouer la même crise : l'humain seul, l'humain aidé par
  l'assistant, l'assistant seul. L'écart entre les deux premières est l'argument de la démonstration.

## 4. La bibliothèque commune

**Où.** Elle commence dans ce dépôt, dans un dossier `lib/` qui n'importe rien du jeu (ni `src/sim`, ni
le cœur), pendant l'ordonnanceur. Sa première pièce, le futur module `schedule`, est
`src/schedule/` (22/10 : l'ordre, les `stopIf`, la nuit simulée), qui n'importe déjà rien du jeu et tourne
aussi dans la page (l'onglet Ordonnanceur). Elle sort dans son propre dépôt quand l'étape 2 commence. Lopin pourra
en devenir un client si son empreinte ne bouge pas ([`README.md`](README.md) § 4).

**Les modules.**

| Module | Ce qu'il contient | Qui s'en sert |
|---|---|---|
| `random` | le tirage reproductible, à partir d'une graine (celui de `src/core/random.js`) | tous |
| `events` | la simulation à événements discrets : une file d'événements datés | l'ordonnanceur, les trois thèmes |
| `schedule` | les ressources, les priorités, les échéances, les prérequis, la règle de Smith | l'ordonnanceur, les urgences |
| `mcts` | la recherche : le tirage d'un scénario, la liste courte, la descente, la simulation, le coup le plus visité | tous |
| `grid` | A*, la table de réservations | l'entrepôt, la cuisine |
| `measure` | les intervalles de Wilson, la comparaison par paires sur les mêmes scénarios | tous |

**Les signatures de `mcts`.** Un problème décrit ce que la recherche doit savoir faire ; la recherche ne
connaît rien d'autre.

```js
/**
 * What a problem gives the search.
 * @typedef {object} Problem
 * @property {(state, rng) => World} sample        a scenario consistent with what is known
 * @property {(world) => string} actor             who decides now: a robot, the human, an opponent
 * @property {(world) => Move[]} moves             the legal decisions at this event
 * @property {(world, moves) => Move[]} shortlist  the fast rule's best few
 * @property {(move) => string} key                a move's name, shared by every scenario
 * @property {(world, move) => World} play         applies the move, runs to the next decision
 * @property {(world) => boolean} over
 * @property {(world, rng) => World} rollout       the fast rule to the end
 * @property {(world, actor) => number} score      the reward of a finished world, 0 to 1
 */

/** @returns {{ move: Move, visits: Map<string, number>, value: number }} */
export function search(state, problem, { budget, rng, depth = 5, explore = 0.7 }) {}
```

Les autres modules, plus simples :

```js
export function createEvents() {}                   // { schedule(at, event), next(), now }
export function readyTasks(tasks, done, free) {}    // prerequisites finished, resources free
export function smithOrder(tasks) {}                // most weight per minute first
export function astar(grid, from, to, options) {}   // options: { cost(cell, unit), reserved }
export function createReservations() {}             // { reserve(path, start), isFree(cell, t) }
export function wilson(wins, games) {}              // { low, high }
export function paired(scoresA, scoresB) {}         // { mean, low, high }
```

Un **adversaire** se décrit avec le même problème : `actor` le nomme, et `score` lui donne la récompense
de son côté. La bibliothèque sert donc aussi à la famille C, le jour où elle viendra.

## 5. Les adversaires cachés : moins pressés, et pourquoi

Sami trouve ce thème moins parlant, moins vendable hors des jeux vidéo et du wargame. **C'est juste pour
la vitrine** :
- en dehors des jeux, de la défense et de la sécurité, peu d'entreprises ont un adversaire qui cache ses
  cartes ;
- une démonstration de coopération (un humain et des robots) se comprend en dix secondes ; un bot qui bat
  un autre bot demande d'expliquer le jeu d'abord.

**Mais la compétence ne se perd pas** : deviner ce que l'autre cache est exactement ce que demande la
coopération avec un humain (§ 3), et deviner la gravité réelle d'un patient derrière sa couleur est le même
geste que deviner une main derrière les cartes posées. Lopin est l'argument : « mes robots devinent ce
qu'ils ne voient pas, comme mon bot devine la main adverse ».

**CodinGame** reste une bonne idée si un défi en temps réel plaît : un classement public donne un
résultat comparable aux autres, et la plateforme sert aussi au recrutement. Ce n'est pas une étape de la
feuille de route, plutôt un terrain d'entraînement pour la bibliothèque.

## 6. Où on en est, et la suite (Sami, 23/10 au soir)

**L'état.** L'étape 1 est faite (l'ordonnanceur, `backlog.md` § 9.9) : sorti de Lopin le 26/10, c'est
`mcts-backlog` de mcts-commun, la file de la machine pour tous les dépôts mcts-* (point 1 ci-dessous). Les
étapes 2 et 3 tournent : les urgences (la réévaluation, le plan animé de la garde), l'entrepôt (les quais,
les zones d'attente, un chargeur par zone, les allées qui se bloquent encore et encore) et la cuisine (les
postes, la cuisson sans surveillance, les comptoirs en relais, le chef au clavier). Chaque dépôt a sa
`docs/modele.md` et un journal des versions dans sa page (`web/changelog.html`). L'étape 4 n'est pas
commencée : le plan animé des urgences ne fait que montrer la garde.

**Le 23/10 tard** : les premières parties de Sami aux urgences (la garde, le médecin et l'infirmier sur le plan, `docs/modele.md` des urgences) ; dans la cuisine, les bugs du chef au clavier retrouvés un par un avec ses replays (le robot qui attendait le chef, les tours perdus avant la soupe) ; l'allure commune des trois pages (`mcts-commun/web/theme.css`) : rouge et blanc pour les urgences, bleu-gris pour l'entrepôt, orange pour la cuisine.

**La suite, dans l'ordre que Sami a validé :**

1. **L'ordonnanceur en commun** — **fait le 23/10** : `mcts-backlog` dans mcts-commun (`bin/backlog.js`, l'ordre de `src/schedule.js` repris de Lopin, `node/machine.js` pour les fils et les gardes), des jobs côte à côte tant que leurs fils tiennent dans le budget (`~/.mcts-backlog/slots.json`) ; chaque dépôt a son `night.json`. **Le 26/10, Lopin n'a plus de lanceur à lui** (`5f573d4`) : `npm run backlog` verse ses jobs dans `mcts-backlog`, et un nouveau job s'y ajoute par sa CLI (`--add`, `--add-file`, `mcts-commun/docs/backlog.md`) ; ses `stopIf` restent à Lopin (`scripts/stop-check.js`, le `skipIf` du job). Une file pour
   la machine, un `cwd` par job, la garde thermique et la garde mémoire pour tous. Les trois dépôts lancent
   alors leurs mesures de nuit : la recherche contre les règles sur des centaines de journées, de gardes ou
   de services (aujourd'hui 8 à 40), et les réglages de la recherche (budget, profondeur), en particulier
   pour l'entrepôt à 80 % de blocage.
2. **Les replays avec un humain** — **faits le 23/10** pour la cuisine (le chef au clavier, « Analyser les écarts ») et les urgences (« Jouer la garde vous-même », seul ou aidé), gardés d'eux-mêmes dans `replays/` (hors de git) ; reste le cariste de l'entrepôt (point 4). Pour analyser les écarts : enregistrer les parties jouées dans les pages
   (le chef au clavier en cuisine, les choix aux urgences, le cariste de l'entrepôt), les rejouer pas à pas,
   et comparer à chaque décision ce que l'humain a fait et ce que la recherche aurait fait. Puis les trois
   manières de jouer du § 3 : l'humain seul, aidé par l'assistant, l'assistant seul. Les replays servent
   aussi à ajuster le modèle de l'humain sur de vraies parties.
3. **Le plan de l'hôpital** (l'étape 4) — **fait le 23/10 au soir** (`mcts-urgences`, « Le service en plan » : 6 s par case, un médecin ou l'infirmier de tri au clavier, la garde contre un robot à sa place) : les urgences sur la grille de l'entrepôt, les patients et les
   soignants qui se déplacent, la salle d'attente qui sature. Sami : **un médecin ou un infirmier joué au
   clavier** (Z Q S D et E, comme le chef), qui ajoute l'aléa d'un vrai joueur.
4. **L'entrepôt, la suite** :
   - **le transfert de colis entre deux robots bloqués** — **fait le 23/10 au soir** (les relais : aux trois quais, le dernier colis au tour 119 au lieu de 126) — dans une allée étroite : une case libre sert un
     moment de zone d'attente, le robot le plus proche du camion fait les allers-retours courts, les autres
     repartent chercher ;
   - **un personnage au clavier** (Z Q S D et E) qui prend et pose des colis ;
   - **une zone d'assemblage** (Sami, à préciser) : une commande faite de plusieurs colis, réunis sur une
     zone avant de partir au camion, comme les recettes à plusieurs ingrédients de la cuisine.
5. **La vitrine** : les journaux des versions, et une page de résultats par dépôt qui chiffre ce que gagne
   la recherche (ISMCTS) contre les règles, avec ses intervalles, mesurés de nuit (point 1).
