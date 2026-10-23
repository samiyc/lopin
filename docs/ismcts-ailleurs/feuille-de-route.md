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
